'use strict';

const fs=require('node:fs');
const path=require('node:path');
const {createHash}=require('node:crypto');
const {loadBibleLibrary,TRANSLATIONS}=require('./audit-word-study-coverage');
const {provider}=require('./import-web-alignment');
const {address}=require('./scripture-crosswalk');
const primary=require('../docs/shell-76-crosswire-import.json');
const alternate=require('../docs/shell-82-kjv-tr-publication.json');

const root=path.resolve(__dirname,'..');
const sha=bytes=>createHash('sha256').update(bytes).digest('hex');

function readSources(base,pins) {
  const verses=[];
  for(const [file,pin] of Object.entries(pins)){
    if(file==='index.json') continue;
    const raw=fs.readFileSync(path.join(root,'data/word-study/alignment',base,file));
    if(sha(raw)!==pin.sha256) throw new Error('Pinned alignment shard changed: '+file);
    const json=JSON.parse(raw);
    const [bookId,chapterId]=file.replace('.json','').split('/');
    const chapter=Number(chapterId);
    for(const [verseId,[verseText,tokens]] of Object.entries(json.verses||json)){
      const verse=Number(verseId);
      verses.push({bookId,chapter,verse,verseText,tokens});
    }
  }
  return verses;
}

async function run(){
  const original=provider();
  const datasets=[['byzantine-or-explicit-override',readSources('kjv',primary.files)],
    ['robinson-tr',readSources('kjv-tr',alternate.files)]];
  const editions=TRANSLATIONS.filter(item=>item.id!=='kjv').concat({id:'dra',file:'dra.js',variable:'draLibrary'});
  const result={version:1,scope:'Research only. Identical English and original tokens are screened separately from independence.',
    published:0,editions:{}};
  for(const {id,file,variable} of editions){
    const bible=loadBibleLibrary(file,variable);
    const byEdition=result.editions[id]={};
    for(const [source,verses] of datasets){
      const counts=byEdition[source]={screened:verses.length,exactEnglish:0,referenceRemappedOrUnavailable:0,
        exactNativeAtReaderReference:0,eligibleForIndependentReview:0};
      for(const {bookId,chapter,verse,verseText,tokens} of verses){
        const coordinate=[bookId,chapter,verse].join(':');
        const target=address('reader-'+id,coordinate);
        if(!target||bible[bookId]?.[chapter]?.verses?.[verse-1]!==verseText) continue;
        counts.exactEnglish++;
        const {records}=await original.lookupVerse({translationId:id,bookId,chapter,verse,verseText});
        if(!records.length||records.some((record,index)=>record.bookId!==bookId||record.chapter!==chapter||
          record.verse!==verse||record.tokenIndex!==index||record.status!=='authoritative'||record.language!=='greek')){
          counts.referenceRemappedOrUnavailable++;
          continue;
        }
        if(records.length===tokens.length&&records.every((record,index)=>{
          const [surface,id,morph]=tokens[index];
          return record.surface===surface&&record.strongsNumber===id&&record.morphology===morph;
        })){
          counts.exactNativeAtReaderReference++;
          counts.eligibleForIndependentReview++;
        }
      }
    }
  }
  return result;
}
if(require.main===module){
  const output=process.argv[2];
  if(!output) throw new Error('Expected an output report path');
  run().then(report=>fs.writeFileSync(output,JSON.stringify(report,null,2)+'\n'))
    .catch(error=>{console.error(error);process.exitCode=1;});
}
module.exports={run};
