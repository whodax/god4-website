'use strict';
const fs=require('node:fs');
const path=require('node:path');
const {execFileSync}=require('node:child_process');
const {createHash}=require('node:crypto');
const {loadBibleLibrary}=require('./audit-word-study-coverage');
const {provider}=require('./import-web-alignment');
const {readTr}=require('./audit-kjv-expansion');
const {validateVerse,readTaggedVerse,checksum,osisCodes}=require('./import-crosswire-kjv-alignment');
const canon=require('../js/bible/canon');
const prior=require('../docs/shell-82-kjv-witness-audit.json');
const primaryPins=require('../docs/shell-76-crosswire-import.json');
const alternatePins=require('../docs/shell-82-kjv-tr-publication.json');
const root=path.resolve(__dirname,'..');
const sha=bytes=>createHash('sha256').update(bytes).digest('hex');
const bump=(dict,key)=>{dict[key]=(dict[key]||0)+1;};

function accepted(base,pins){
  const verses=new Set();
  for(const [file,pin] of Object.entries(pins)){
    const bytes=fs.readFileSync(path.join(root,'data/word-study/alignment',base,file));
    if(sha(bytes)!==pin.sha256) throw Error('Runtime alignment source changed: '+file);
    if(file==='index.json') continue;
    const rows=JSON.parse(bytes);
    for(const id of Object.keys(rows.verses||rows)) verses.add(file.slice(0,-5)+'/'+id);
  }
  return verses;
}

function ignoreTransparentMarkup(body){
  const stack=[];
  let unknown=false;
  const result=body.replace(/<(\/?)(divineName|inscription)>/g,(_,close,name)=>{
    if (close) {if(stack.pop()!==name) unknown=true;}
    else stack.push(name);
    return '';
  });
  return !unknown&&!stack.length?result:body;
}

async function run(input,repository,onVerifiedTitle){
  const bytes=fs.readFileSync(input);
  if(sha(bytes)!==checksum) throw new Error('Unexpected source OSIS checksum');
  const rows=new Map();
  for(const [,ref,body] of bytes.toString('utf8').matchAll(/<verse\b[^>]*\bosisID="([^"]+)"[^>]*\bsID="[^"]+"[^>]*\/>([\s\S]*?)<verse\b[^>]*\beID="\1"[^>]*\/>/g)){
    if(rows.has(ref)) throw new Error('Duplicate source address');
    rows.set(ref,body);
  }
  if(rows.size!==31102) throw new Error('OSIS reference count mismatch');
  const kjv=loadBibleLibrary('kjv.js','kjvLibrary'), lookup=provider();
  const before=accepted('kjv',primaryPins.files), additional=accepted('kjv-tr',alternatePins.files);
  const findings={examined:0,unchangedReasons:{},englishMismatchAgainstInstalledWitness:0,
    wrapperTrial:{examined:0,kjvTextExact:0,fullyValidated:0,cases:[]},ambiguousCases:[],
    positionTrial:{recordsWithGreekSurfaceSequenceDifferent:0,recordsWithMatchingSurfaceSequenceAfterProjection:0}};
  for(const [index,[file,pin]] of Object.entries(prior.trExperiment.files).entries()){
    const bookId=canon.order('kjv')[index+39], code=osisCodes[index+39];
    const text=execFileSync('git',['-C',repository,'show',prior.trExperiment.revision+':'+file]);
    if(sha(text)!==pin.sha256) throw new Error('Unexpected parsed TR source hash '+file);
    const tr=readTr(text.toString('utf8'),bookId).verses, book=kjv[bookId];
    for(let chapter=1;chapter<=book.chapters;chapter++) for(const [offset,verseText] of book[chapter].verses.entries()){
      const verse=offset+1, ref=code+'.'+chapter+'.'+verse, coordinate=[bookId,chapter,verse].join('/');
      if(before.has(coordinate)||additional.has(coordinate)) continue;
      const body=rows.get(ref), witness=tr.get(chapter+':'+verse);
      const context={bookId,chapter,verse,verseText,translationId:'kjv'};
      const {records}=await lookup.lookupVerse(context);
      const treated=witness&&validateVerse(verseText,body,witness);
      const reason=treated?.reason||'TR reference missing';
      if(treated?.alignments) throw new Error('Forgotten accepted row '+ref);
      findings.examined++;
      bump(findings.unchangedReasons,reason);
      const parsed=readTaggedVerse(body);
      if(!parsed.reason&&parsed.text!==verseText) findings.englishMismatchAgainstInstalledWitness++;
      if(treated?.ambiguous) findings.ambiguousCases.push(ref);
      if(reason==='Greek position, surface or Strong identity differs'&&!parsed.reason){
        const projections=parsed.tags.flatMap(tag=>tag.indexes.map((index,i)=>[index,tag.forms[i]]));
        const byPosition=new Map(projections);
        const surface=text=>text.normalize('NFD').replace(/\p{Mark}/gu,'').toLowerCase().replace(/ς/g,'σ');
        if(witness.every((token,index)=>byPosition.get(index+1)===surface(token.surface)))
          findings.positionTrial.recordsWithMatchingSurfaceSequenceAfterProjection++;
        else findings.positionTrial.recordsWithGreekSurfaceSequenceDifferent++;
      }
      if(parsed.reason!=='unsupported markup') continue;
      const normalized=ignoreTransparentMarkup(body);
      findings.wrapperTrial.examined++;
      const after=readTaggedVerse(normalized);
      if(after.text===verseText) findings.wrapperTrial.kjvTextExact++;
      const baseline=validateVerse(verseText,normalized,records);
      const alternative=witness&&validateVerse(verseText,normalized,witness);
      if(baseline.alignments||alternative?.alignments) findings.wrapperTrial.fullyValidated++;
      if(normalized!==body && baseline.alignments) {
        onVerifiedTitle?.({context,records,groups:baseline.alignments});
      }
      findings.wrapperTrial.cases.push({ref,transparent:normalized!==body,englishExact:after.text===verseText,
        installed:baseline.reason||'fully validated',tr:alternative?.reason||(alternative?'fully validated':'reference missing')});
    }
  }
  if(findings.examined!==1548) throw new Error('Unexpected unresolved KJV NT population');
  return findings;
}

if(require.main===module){
  const [osis,repository,out]=process.argv.slice(2);
  if(!out) throw new Error('Expected pinned KJV OSIS, parsed Textus Receptus repository, and report path');
  run(osis,repository).then(value=>fs.writeFileSync(out,JSON.stringify(value,null,2)+'\n'))
    .catch(error=>{console.error(error);process.exitCode=1;});
}
module.exports={ignoreTransparentMarkup,run};
