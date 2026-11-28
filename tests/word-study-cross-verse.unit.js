'use strict';

const {test}=require('node:test');
const assert=require('node:assert/strict');
const fs=require('node:fs');
const vm=require('node:vm');
const {runtime,tokens}=require('../tools/audit-word-study-corpus');
const {studyClass}=require('../tools/word-study-grammar');
const {terminalPunctuationProjection}=require('../tools/word-study-extension-evidence');
const {morphology}=require('../tools/word-study-berean');
const {loadBibleLibrary}=require('../tools/audit-word-study-coverage');
const bible=loadBibleLibrary('kjv.js','kjvLibrary');
const context={translationId:'kjv',bookId:'ephesians',chapter:1,verse:10,verseText:bible.ephesians[1].verses[9]};
const chapter=require('../data/word-study/alignment/continuations/ephesians/1.json');

test('cross-verse lookup preserves source coordinates and established group IDs',async()=>{
  const alignment=runtime(), before=await alignment.lookupScrivenerWitness(context);
  const result=await alignment.lookupContinuation(context,before.records,before.alignment);
  assert.ok(result);
  assert.deepEqual(result.alignment.groups.slice(0,before.alignment.groups.length),before.alignment.groups);
  const expected=result.records.filter(record=>record.adjacentReference);
  assert.equal(expected.length,2);
  assert.equal(expected[0].tokenIndex,0);
  assert.equal(expected[1].tokenIndex,1);
  for(const [i,record] of expected.entries()){
    assert.equal(record.verse,11);
    assert.equal(record.panelTokenIndex,before.records.length+i);
  }
  const him=tokens(context.verseText).find(word=>word.term==='him');
  const matched=alignment.matchingGroups(result.alignment,him);
  assert.equal(matched.length,1);
  assert.deepEqual([...matched[0].original],expected.map(record=>record.panelTokenIndex));
  const even=tokens(context.verseText).find(word=>word.term==='even');
  assert.equal(alignment.matchingGroups(result.alignment,even).length,0);
  assert.equal(await alignment.lookupContinuation({...context,translationId:'web'},before.records,before.alignment),null);
});

test('cross-verse links reject unreliable ownership, wrong verse, clipped words and witness drift',async()=>{
  const original=await runtime().lookupScrivenerWitness(context);
  const source=fs.readFileSync('js/word-study/alignment.js','utf8');
  for(const mutate of [
    row=>row.groups[0].native.push(row.groups[0].native[0]),
    row=>row.groups[0].native[0][1]=12,
    row=>row.groups[0].english[0][0]++,
    row=>row.local[0][2]='BAD',
    row=>row.groups[0].english[0][0]=context.verseText.indexOf('even'),
    row=>row.revision='unpinned'
  ]){
    const shard=structuredClone(chapter);
    mutate(shard.crossVerse[10]);
    const realm=vm.createContext({BibleCanon:require('../js/bible/canon'),AbortController,setTimeout,clearTimeout,
      fetch:async url=>({ok:true,json:async()=>url.endsWith('index.json')?{kjv:{ephesians:{1:[10]}}}:shard})});
    vm.runInContext(source,realm);
    assert.equal(await realm.WordStudyAlignment.lookupContinuation(context,original.records,original.alignment),null);
  }
});

test('implicit candidates remain unresolved and editorial supplied wording stays distinct',()=>{
  for(const [book,verse,term] of [['philemon',9,'yet'],['titus',1,'is']]){
    const verseText=bible[book][1].verses[verse-1],word=tokens(verseText).find(word=>word.term===term);
    const result=studyClass({translationId:'kjv',bookId:book,chapter:1,verse,verseText},word,null);
    assert.equal(result.category,'unresolved');
    assert.equal(result.proposed,'implicit-english');
  }
  assert.equal(studyClass(context,tokens(context.verseText).find(word=>word.term==='even'),null).category,'marked-supplied');
});
test('declarative projections preserve words and reject punctuation with scope, supplied words and quotation changes',()=>{
  const groups=[[[[0,3]],[0]]];
  assert.deepEqual(terminalPunctuationProjection('God spoke.','God spoke;',groups),groups);
  for(const [a,b] of [['God spoke?','God spoke.'],['God did not speak.','God did not speak;'],['God [had] spoken.','God [had] spoken;'],
    ['God spoke, then rested.','God spoke then rested;'],['"God spoke".','"God spoke";']]){
    assert.deepEqual(terminalPunctuationProjection(a,b,groups),[]);
  }
});
test('the Matthew indirect question highlights one same-verse passive verb and all three English words',async()=>{
  const verseText=bible.matthew[2].verses[3], study={translationId:'kjv',bookId:'matthew',chapter:2,verse:4,verseText};
  const {records}=await require('../tools/import-web-alignment').provider().lookupVerse(study);
  const engine=runtime(), base=await engine.lookupExtension(study,records,{status:'unavailable'});
  const hit=await engine.lookupContinuation(study,base.records,base.alignment);
  assert.ok(hit);
  for(const word of tokens(verseText).slice(-3)){
    const [group]=engine.matchingGroups(hit.alignment,word);
    assert.deepEqual([...group.original],[15]);
    assert.equal(studyClass(study,word,hit.alignment).category,'verified-grammatical');
  }
  assert.equal(hit.records[15].morphology,'V-PPI-3S');
  assert.equal(hit.records[15].verse,4);
  assert.equal(hit.records.some(row=>row.adjacentReference),false);
});
test('extended Hebrew morphology requires the complete stem, conjugation, person and affix codes',()=>{
  const verb={language:'hebrew',morph:'Conj-w | V-Qal-ConsecImperf-3ms'};
  assert.equal(morphology(verb,{morphology:'HC/Vqw3ms'},true),true);
  assert.equal(morphology(verb,{morphology:'HVqw3ms'},true),false);
  assert.equal(morphology(verb,{morphology:'HC/Vqw3mp'},true),false);
  assert.equal(morphology(verb,{morphology:'HC/Vqi3ms'},true),false);
  assert.equal(morphology(verb,{morphology:'HC/Vqw3ms'}),false);
  const greek={language:'greek',morph:'V-AIA-3S'};
  assert.equal(morphology(greek,{morphology:'V-AAI-3S'},true),true);
  assert.equal(morphology(greek,{morphology:'V-AIA-3S'},true),false);
  assert.equal(morphology({...greek,morph:'V-PIM/P-3S'},{morphology:'V-PMI-3S'},true),false);
  const noun={language:'hebrew',morph:'N-msc | 3ms'};
  assert.equal(morphology(noun,{morphology:'HNcmsc/Sp3ms'},true),true);
  assert.equal(morphology(noun,{morphology:'HNcmsc/Sp3fs'},true),false);
});
