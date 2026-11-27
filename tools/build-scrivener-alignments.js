'use strict';

const fs=require('node:fs');
const path=require('node:path');
const {createHash}=require('node:crypto');
const {gzipSync}=require('node:zlib');
const {READER_TOKEN_PATTERN,normalizeDictionaryTerm}=require('./audit-word-study-coverage');
const {run,pins}=require('./audit-scrivener-witness');
const remaining=Object.entries(require('../docs/shell-82-kjv-tr-publication.json').remainingPriority)
  .filter(([,count])=>!count).map(([term])=>term);
const sha=bytes=>createHash('sha256').update(bytes).digest('hex');

function build(osis,json,notice,output){
  if(fs.existsSync(output)) throw Error('Use a fresh Scrivener output directory');
  const chapters=new Map(), index={}, files={};
  let occurrences=0;
  const priority=Object.fromEntries(remaining.map(term=>[term,0]));
  const audit=run(osis,json,notice,({bookId,chapter,verse,text,records,groups})=>{
    const file=bookId+'/'+chapter+'.json';
    const current=chapters.get(file)||{bookId,chapter,revision:pins.revision,lexicon:{},verses:{}};
    current.verses[verse]=[text,records.map(token=>[token.surface,token.strongsNumber,token.morphology]),groups];
    chapters.set(file,current);
    ((index[bookId]||={})[chapter]||=[]).push(verse);
    for(const word of text.matchAll(READER_TOKEN_PATTERN)){
      if(!groups.some(([spans])=>spans.some(([a,b])=>a<=word.index&&b>=word.index+word[0].length))) continue;
      occurrences++;
      const term=normalizeDictionaryTerm(word[0]);
      if(Object.hasOwn(priority,term)) priority[term]++;
    }
  });
  function write(file,value){
    const bytes=Buffer.from(JSON.stringify(value)+'\n');
    const target=path.join(output,file);
    fs.mkdirSync(path.dirname(target),{recursive:true});
    fs.writeFileSync(target,bytes);
    files[file]={sha256:sha(bytes),bytes:bytes.length,gzipBytes:gzipSync(bytes).length};
  }
  for(const [file,chapter] of chapters) write(file,chapter);
  write('index.json',index);
  return {...audit,occurrences,priority,files};
}

if(require.main===module){
  const [osis,source,notice,output,report]=process.argv.slice(2);
  if(!report) throw Error('Expected pinned CrossWire OSIS, Scrivener JSON, Scrivener notice, fresh output directory and report file');
  fs.writeFileSync(report,JSON.stringify(build(osis,source,notice,output),null,2)+'\n');
}
module.exports={build};
