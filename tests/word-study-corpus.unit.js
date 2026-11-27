'use strict';

const {test}=require('node:test');
const assert=require('node:assert/strict');
const fs=require('node:fs');
const vm=require('node:vm');
const {createHash}=require('node:crypto');
const {TRANSLATIONS,loadBibleLibrary,READER_TOKEN_PATTERN}=require('../tools/audit-word-study-coverage');
const {provider}=require('../tools/import-web-alignment');
const {properNameAgreement,nativeKjvAgreement,confirmedOutsideSupplied}=require('../tools/import-word-study-corpus');
const report=require('../docs/shell-84-corpus-publication.json');
const holdout=require('../docs/shell-81-web-review-v1.json').holdout;
const base='data/word-study/alignment/corpus/';
const sha=bytes=>createHash('sha256').update(bytes).digest('hex');

function runtime(){
  const realm=vm.createContext({BibleCanon:require('../js/bible/canon'),AbortController,setTimeout,clearTimeout,
    async fetch(url){return {ok:true,json:()=>JSON.parse(fs.readFileSync(url.slice(1),'utf8'))};}});
  vm.runInContext(fs.readFileSync('js/word-study/alignment.js','utf8'),realm);
  return realm.WordStudyAlignment;
}

test('all new corpus rows preserve installed words, ordered witnesses and holdouts',async()=>{
  const engine=runtime(), lookup=provider(), totals={};
  const bible=Object.fromEntries(TRANSLATIONS.concat({id:'dra',file:'dra.js',variable:'draLibrary'})
    .map(({id,file,variable})=>[id,loadBibleLibrary(file,variable)]));
  const protectedRefs=new Set(holdout.flatMap(row=>[row.passage.coordinate,...row.tokens.map(t=>[t.bookId,t.chapter,t.verse].join(':'))]));
  const index=JSON.parse(fs.readFileSync(base+'index.json'));
  for(const [file,pin] of Object.entries(report.files)){
    const bytes=fs.readFileSync(base+file);
    assert.equal(sha(bytes),pin.sha256,file);
    if(file==='index.json') continue;
    const [bookId,label]=file.slice(0,-5).split('/'),chapter=Number(label);
    const shard=JSON.parse(bytes);
    for(const [translationId,rows] of Object.entries(shard.editions)){
      for(const [id,[recorded,groups]] of Object.entries(rows)){
        const verse=Number(id),verseText=bible[translationId][bookId][chapter].verses[verse-1];
        const context={translationId,bookId,chapter,verse,verseText};
        assert.equal(recorded,verseText);
        assert.ok(index[translationId][bookId][chapter].includes(verse));
        assert.ok(!protectedRefs.has([bookId,chapter,verse].join(':')));
        const {records}=await lookup.lookupVerse(context);
        for(const token of records) assert.ok(!protectedRefs.has([token.bookId,token.chapter,token.verse].join(':')));
        const resolved=await engine.lookupCorpus(context,records);
        assert.equal(resolved?.status,'available',translationId+' '+file+':'+verse);
        assert.ok(resolved.source.corpusPlan);
        const counted=[...verseText.matchAll(READER_TOKEN_PATTERN)].filter(word=>groups.some(([spans])=>
          spans.some(([a,b])=>a<=word.index&&b>=word.index+word[0].length)));
        const metrics=totals[translationId]||={rows:0,words:0};
        if(!metrics.rows){
          assert.equal(await engine.lookupCorpus({...context,verseText:verseText+' changed'},records),null);
          assert.equal(await engine.lookupCorpus(context,records.map((t,i)=>i?t:{...t,morphology:'changed'})),null);
        }
        metrics.rows++;
        metrics.words+=counted.length;
      }
    }
  }
  assert.deepEqual(totals,Object.fromEntries(Object.entries(report.editions)
    .map(([id,entry])=>[id,{rows:entry.verses,words:entry.occurrences}])));
});

test('name alignment requires a unique English occurrence and exact joint original position',()=>{
  const left={text:'Go toward Moab.',groups:[[[[10,14]],[0]]]};
  const right={text:'We went to Moab.',groups:[[[[11,15]],[0]]]};
  const records=[{strongsNumber:'H4124',morphology:'HNp'},{strongsNumber:'H4124',morphology:'HNp'}];
  assert.deepEqual(properNameAgreement('Leave Moab.',left,right,records),[[[[6,10]],[0]]]);
  assert.deepEqual(properNameAgreement('Moab met Moab.',left,right,records),[]);
  assert.deepEqual(properNameAgreement('Leave [Moab].',left,right,records),[]);
  assert.deepEqual(properNameAgreement('Leave Moab.',left,{...right,groups:[[[[11,15]],[1]]]},records),[]);
  assert.deepEqual(properNameAgreement('Leave Moab.',left,right,[{morphology:'HNcmsa'}]),[]);
});

test('native KJV lexical tagging must agree with two independently positioned phrases',()=>{
  const text='Go toward Moab.';
  const parsed={text,tags:[{start:3,end:14,hebrewIds:['H4124']}]};
  const source={text:'Toward Moab.',groups:[[[[7,11]],[0]]]};
  const records=[{strongsNumber:'H4124'},{strongsNumber:'H4124'}];
  assert.deepEqual(nativeKjvAgreement(text,parsed,source,source,records),[[[[10,14]],[0]]]);
  assert.deepEqual(nativeKjvAgreement(text,{text,tags:[{start:3,end:8,hebrewIds:['H4124']}]},source,source,records),[]);
  assert.deepEqual(nativeKjvAgreement(text,parsed,source,{...source,groups:[[[[7,11]],[1]]]},records),[]);
  assert.deepEqual(nativeKjvAgreement(text,parsed,source,{...source,text:'Never go to Moab.'},records),[]);
});

test('supplied words also invalidate other spans linked to their native token',()=>{
  const text='Keep [added] words plain.';
  const groups=[[[[0,4]],[0]],[[[6,11]],[1]],[[[13,18]],[1]],[[[19,24]],[2]]];
  assert.deepEqual(confirmedOutsideSupplied(text,groups),[groups[0],groups[3]]);
  assert.deepEqual(confirmedOutsideSupplied('Keep <added> words plain.',groups),[]);
});

test('English contractions explain grammar without claiming a witness',async()=>{
  const realm=vm.createContext({});
  vm.runInContext(fs.readFileSync('js/word-study/provider.js','utf8'),realm);
  const result=await realm.WordStudyProvider.lookup({displayWord:'don\u2019t'});
  assert.equal(result.source,'English usage');
  assert.match(result.definition,/^Do not/);
  assert.equal(result.partOfSpeech,'contraction');
});

test('all newly published Scrivener rows resolve with pinned English and an edition-specific Greek witness',async()=>{
  const report=require('../docs/shell-84-scrivener-publication.json'), engine=runtime();
  const bible=loadBibleLibrary('kjv.js','kjvLibrary'), base='data/word-study/alignment/kjv-scrivener/';
  let verses=0, occurrences=0;
  for(const [file,pin] of Object.entries(report.files)){
    const bytes=fs.readFileSync(base+file);
    assert.equal(sha(bytes),pin.sha256,file);
    if(file==='index.json') continue;
    const {bookId,chapter,verses:rows}=JSON.parse(bytes);
    for(const [label,[text]] of Object.entries(rows)){
      const verse=Number(label), verseText=bible[bookId][chapter].verses[verse-1];
      const context={translationId:'kjv',bookId,chapter,verse,verseText};
      assert.equal(text,verseText);
      const result=await engine.lookupScrivenerWitness(context);
      assert.equal(result?.status,'available',file+':'+verse);
      assert.equal(result.records[0].source,'Scrivener 1894 Textus Receptus, parsed transcription');
      assert.equal(await engine.lookupScrivenerWitness({...context,translationId:'web'}),null);
      if(!verses) assert.equal(await engine.lookupScrivenerWitness({...context,verseText:text+' changed'}),null);
      const words=[...text.matchAll(READER_TOKEN_PATTERN)];
      occurrences+=words.filter(word=>result.alignment.groups.some(group=>group.english.some(span=>
        span.start<=word.index&&span.end>=word.index+word[0].length))).length;
      verses++;
    }
  }
  assert.equal(verses,report.publishable);
  assert.equal(occurrences,report.occurrences);
});
