'use strict';

const fs=require('node:fs');
const path=require('node:path');
const {createHash}=require('node:crypto');
const {assessBook}=require('./adjudicate-web-book');
const {gate}=require('./audit-web-book-coverage');
const {verifyBaseline}=require('./audit-shell81-crosswalk');
const {loadBibleLibrary}=require('./audit-word-study-coverage');
const {provider}=require('./import-web-alignment');
const alignment=require('../js/word-study/alignment');

const editionPublication=require('../docs/shell-83-edition-publication.json');

const identity=['bookId','chapter','verse','surface','language','strongsNumber','morphology','source'];

function exactWitness(packetTokens,live) {
  return Array.isArray(packetTokens)&&packetTokens.length===live.length&&live.every((token,index)=>
    packetTokens[index]?.index===token.tokenIndex&&identity.every(field=>packetTokens[index][field]===token[field]));
}

async function stage(bytes,submissions,roster) {
  const assessed=assessBook(bytes,submissions,roster);
  const packet=JSON.parse(bytes), rows=new Map(packet.rows.map(row=>[row.id,row]));
  const web=loadBibleLibrary('web.js','webLibrary'), lookup=provider(), existing=verifyBaseline();
  const editionBytes=fs.readFileSync(path.join(__dirname,'../data/word-study/alignment/editions/index.json'));
  if(createHash('sha256').update(editionBytes).digest('hex')!==editionPublication.files['index.json'].sha256)
    throw new Error('Edition alignment index does not match its publication report');
  const editions=JSON.parse(editionBytes).web;
  const staged={version:1,bookId:packet.bookId,reviewPacketSha256:assessed.reviewPacketSha256,
    counts:{...assessed.counts,staged:0,invalidLiveWitness:0,existingVerifiedVerse:0,emptyReviewedVerse:0},chapters:{}};
  for(const decision of assessed.decisions){
    if(!['agreed','resolved'].includes(decision.status)) continue;
    if(!decision.groups.length) {staged.counts.emptyReviewedVerse++;continue;}
    const row=rows.get(decision.id);
    const {bookId,chapter,verse}=row.passage;
    const text=web[bookId]?.[chapter]?.verses?.[verse-1];
    const context={translationId:'web',bookId,chapter,verse,verseText:text};
    const {records}=await lookup.lookupVerse(context);
    if(row.passage.source!=='reader-web'||bookId!==packet.bookId||row.text!==text||
      gate(context,records)!=='reviewable'||!exactWitness(row.tokens,records)){
      staged.counts.invalidLiveWitness++;
      continue;
    }
    if(Object.hasOwn(existing.get(bookId+'/'+chapter+'.json')||{},verse)||
      editions?.[bookId]?.[chapter]?.includes(verse)||alignment.lookup(context,records).status==='available'){
      staged.counts.existingVerifiedVerse++;
      continue;
    }
    const chapterRows=staged.chapters[chapter]||={};
    chapterRows[verse]={
      text,tokens:records.map(token=>identity.map(field=>token[field])),
      groups:decision.groups,reviewId:decision.id,reviewers:decision.reviewers,
      adjudicator:decision.adjudicator||null,decision:decision.status,
      evidence:submissions.passages[decision.id]
    };
    staged.counts.staged++;
  }
  return staged;
}

if(require.main===module){
  const [packet,submissions,roster,output]=process.argv.slice(2);
  if(!output) throw new Error('Expected frozen WEB book packet, submissions, roster and a fresh staging file');
  const target=path.resolve(output);
  const runtime=path.resolve(__dirname,'../data');
  if(target===runtime||target.startsWith(runtime+path.sep)) throw new Error('Reviewed output must stay outside published data');
  const read=file=>JSON.parse(fs.readFileSync(file,'utf8'));
  stage(fs.readFileSync(packet),read(submissions),read(roster)).then(report=>
    fs.writeFileSync(target,JSON.stringify(report,null,2)+'\n',{flag:'wx'}))
    .catch(error=>{console.error(error);process.exitCode=1;});
}

module.exports={stage,exactWitness};
