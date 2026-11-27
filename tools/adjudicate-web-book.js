'use strict';

const fs=require('node:fs');
const {createHash}=require('node:crypto');
const {adjudicate}=require('./web-alignment-review');

function assessBook(bytes,submissions,roster) {
  const packet=JSON.parse(bytes);
  const checksum=createHash('sha256').update(bytes).digest('hex');
  if(packet.version!==1||!Array.isArray(packet.rows)||
    submissions?.bookId!==packet.bookId||submissions?.reviewPacketSha256!==checksum||
    !submissions.passages||Array.isArray(submissions.passages)) throw new Error('Submissions do not match the frozen book packet');
  if(!Array.isArray(roster)||roster.some(id=>typeof id!=='string'||!id.trim())||new Set(roster).size!==roster.length) {
    throw new Error('Invalid approved reviewer roster');
  }
  const ids=new Set(packet.rows.map(row=>row.id));
  const eligible=new Set(packet.rows.filter(row=>row.status==='reviewable').map(row=>row.id));
  if(ids.size!==packet.rows.length||Object.keys(submissions.passages).some(id=>!eligible.has(id))) {
    throw new Error('Submission includes a foreign or withheld passage');
  }
  const approved=new Set(roster);
  const counts={pending:0,agreed:0,disagreement:0,resolved:0,unavailable:0};
  const decisions=[];
  for(const row of packet.rows){
    if(!eligible.has(row.id)) {counts.unavailable++;continue;}
    const submission=submissions.passages[row.id];
    const result=adjudicate(row,submission?.reviews,approved,submission?.resolution);
    counts[result.status]++;
    if(result.status!=='pending') decisions.push({id:row.id,passage:row.passage,...result});
  }
  return {version:1,bookId:packet.bookId,reviewPacketSha256:checksum,counts,decisions};
}

if(require.main===module){
  const [packet,submissions,roster]=process.argv.slice(2);
  if(!roster) throw new Error('Expected frozen book packet, review submissions and approved roster');
  const read=file=>JSON.parse(fs.readFileSync(file,'utf8'));
  console.log(JSON.stringify(assessBook(fs.readFileSync(packet),read(submissions),read(roster)),null,2));
}

module.exports={assessBook};
