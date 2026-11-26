'use strict';

const fs=require('node:fs');
const path=require('node:path');
const {createHash}=require('node:crypto');
const {gzipSync}=require('node:zlib');
const {normalizeDictionaryTerm}=require('./audit-word-study-coverage');
const baseReport=require('../docs/shell-79-web-alignment-report.json');
const sha=data=>createHash('sha256').update(data).digest('hex');

function build(baselineDirectory,packages,output) {
  if (fs.existsSync(output)) throw new Error('Output directory must be fresh');
  const chapters=new Map();
  for (const [relative,pin] of Object.entries(baseReport.files)) {
    const bytes=fs.readFileSync(path.join(baselineDirectory,relative));
    if (sha(bytes)!==pin.sha256) throw new Error('Shell 79 baseline checksum mismatch: '+relative);
    if(relative!=='index.json') chapters.set(relative,JSON.parse(bytes));
  }
  const report={baseline:{verses:385,occurrences:1964},added:{verses:0,occurrences:0,groups:0},
    sources:{},books:{},forms:{},files:{},bytes:0,gzipBytes:0,maxChapterBytes:0};
  for (const [id,input,auditFile] of packages) {
    const bytes=fs.readFileSync(input);
    const audit=JSON.parse(fs.readFileSync(auditFile,'utf8'));
    if (audit.id!==id || !['WLCM','SBLGNT'].includes(id)) throw new Error('Unexpected publication package');
    const type=id==='WLCM'?'clear-hebrew-dual':'clear-greek-dual';
    const counts=report.sources[id]={sha256:sha(bytes),verses:0,occurrences:0,groups:0};
    for (const [chapter,rows] of Object.entries(JSON.parse(bytes))) {
      if (!/^[a-z0-9-]+\/[1-9]\d*$/.test(chapter)) throw new Error('Invalid publication path '+chapter);
      const file=chapter+'.json';
      const current=chapters.get(file)||{};
      const book=report.books[chapter.split('/')[0]]||={verses:0,occurrences:0,groups:0};
      for (const [verse,row] of Object.entries(rows)) {
        if(!/^[1-9]\d*$/.test(verse) || current[verse] || row[3]!==type || !row[2]?.length) {
          throw new Error('Invalid publication row or baseline conflict: '+chapter+' '+verse);
        }
        current[verse]=row;
        const [text,,groups]=row;
        const positions=new Map(groups.flatMap(([spans])=>spans.map(([start,end])=>[start,end])));
        for(const scope of [counts,book,report.added]) {
          scope.verses++;
          scope.occurrences+=positions.size;
          scope.groups+=groups.length;
        }
        for(const [start,end] of positions) {
          const term=normalizeDictionaryTerm(text.slice(start,end));
          report.forms[term]=(report.forms[term]||0)+1;
        }
      }
      chapters.set(file,current);
    }
    if (counts.verses!==audit.methods.clearAndUlt.newVerses || counts.occurrences!==audit.methods.clearAndUlt.newOccurrences) {
      throw new Error('Candidate and audit counts differ: '+id);
    }
  }
  const index={};
  function save(file,data) {
    const buffer=Buffer.from(JSON.stringify(data)+'\n');
    fs.mkdirSync(path.dirname(path.join(output,file)),{recursive:true});
    fs.writeFileSync(path.join(output,file),buffer);
    report.files[file]={sha256:sha(buffer),bytes:buffer.length};
    report.bytes+=buffer.length;
    report.gzipBytes+=gzipSync(buffer).length;
    if(file!=='index.json') report.maxChapterBytes=Math.max(report.maxChapterBytes,buffer.length);
  }
  for (const [file,rows] of [...chapters].sort(([a],[b])=>a<b?-1:1)) {
    save(file,rows);
    const [book,chapter]=file.split('/');
    (index[book]||=[]).push(Number(chapter.split('.')[0]));
  }
  for (const list of Object.values(index)) list.sort((a,b)=>a-b);
  save('index.json',index);
  return report;
}

if(require.main===module) {
  const [baseline,hebrew,hebrewAudit,greek,greekAudit,output,report]=process.argv.slice(2);
  if(!report) throw new Error('Pass Shell 79 data, Hebrew candidates/report, Greek candidates/report, fresh output, and output report');
  const result = build(baseline,[['WLCM',hebrew,hebrewAudit],['SBLGNT',greek,greekAudit]],output);
  fs.writeFileSync(report,JSON.stringify(result,null,2)+'\n');
}

module.exports={build};
