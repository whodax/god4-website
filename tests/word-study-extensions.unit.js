'use strict';

const {test}=require('node:test');
const assert=require('node:assert/strict');
const fs=require('node:fs');
const {createHash}=require('node:crypto');
const {sharedText,selectGroups,taggedGreek,finiteSecondPerson,wholeWordGroups}=require('../tools/word-study-extension-evidence');
const {runtime,tokens}=require('../tools/audit-word-study-corpus');
const {provider}=require('../tools/import-web-alignment');

test('edition transfer preserves exact frames and rejects changed scope, repeated clauses and reordered clauses',()=>{
  const source='Paul sent them away. Barnabas went with him.';
  const groups=[[[[5,9]],[1]],[[[21,29]],[6]]];
  assert.deepEqual(sharedText(source,'Paul sent them away. Barnabas remained behind.',groups),
    {groups:[groups[0]],method:'exact-clause'});
  for(const unsafe of ['Paul sent them away. Paul sent them away.',
    'Paul sent them away. Barnabas did not follow him.',
    'Barnabas went with him. Paul sent them away.',
    'Paul sent them away! Barnabas remained behind.',
    'Paul sent them away. “Barnabas remained behind.”']){
    assert.deepEqual(sharedText(source,unsafe,groups).groups,[],unsafe);
  }
  assert.deepEqual(sharedText('The king\u2019s house.','The king\'s house.',[[[[4,10]],[0]]]).groups,[[[[4,10]],[0]]]);
  assert.deepEqual(wholeWordGroups('Paul [was] there.',[[[[5,10]],[1]],[[[0,10]],[0]],[[[0,3]],[0]]]),[]);
});

test('competing native positions and reused English spans are withheld',()=>{
  const old=[[[[0,3]],[1]]], candidate=(group,shared)=>({group,method:'test',shared});
  const supplemental=[[[4,8]],[2]], conflicting=[[[4,8]],[3]], nativeOverlap=[[[9,10]],[1]];
  assert.equal(selectGroups(old,[candidate(supplemental),candidate(conflicting),candidate(nativeOverlap)]).accepted.length,0);
  assert.equal(selectGroups(old,[candidate(supplemental),candidate(supplemental)]).accepted.length,1);
  assert.equal(selectGroups(old,[candidate(nativeOverlap,true)]).accepted.length,1);
  assert.equal(selectGroups(old,[candidate([[[0,3]],[2]],true)]).accepted.length,0);
});

test('KJV positions require complete ownership, compatible inflection and unsupplied English spans',()=>{
  const record={status:'authoritative',language:'greek',bookId:'john',chapter:1,verse:1};
  const records=[{...record,tokenIndex:0,surface:'ἐστίν',strongsNumber:'G1510',morphology:'V-PAI-3S'},
    {...record,tokenIndex:1,surface:'λόγος',strongsNumber:'G3056',morphology:'N-NSM'}];
  const text='Is [the] Word.';
  const tags=[
    {start:0,end:2,indexes:[1],ids:['G1510'],forms:['εστι'],morphology:['V-PAI-3S'],split:''},
    {start:9,end:13,indexes:[2],ids:['G3056'],forms:['λογοσ'],morphology:['N-NSM'],split:''}
  ];
  assert.equal(taggedGreek(text,{text,tags},records).groups.length,2);
  assert.equal(taggedGreek(text,{text,tags:tags.slice(0,1)},records).reason,'incomplete Greek witness');
  assert.equal(taggedGreek(text,{text,tags:[...tags,tags[1]]},records).reason,'ambiguous native ownership');
  assert.equal(taggedGreek(text,{text,tags},records.map((row,i)=>i?row:{...row,surface:'ἦν'})).reason,'ordered Greek witness differs');
  assert.equal(taggedGreek(text,{text,tags},records.map((row,i)=>i?row:{...row,morphology:'V-IAI-3S'})).groups.length,1);
  assert.equal(taggedGreek('Is the Word.',{text,tags},records).reason,'KJV English or supplied-word boundaries differ');
});

test('second-person future completion requires its exact passage, morphology and linked main verb',()=>{
  const text='Having confidence in thy obedience I wrote unto thee, knowing that thou wilt also do more than I say.';
  const records=Array(13).fill({bookId:'philemon',chapter:1,verse:21});
  records[12]={surface:'ποιήσεις',strongsNumber:'G4160',morphology:'V-FAI-2S'};
  const start=text.indexOf('do more');
  assert.equal(finiteSecondPerson(text,records,[[[[start,start+2]],[12]]]).length,1);
  assert.equal(finiteSecondPerson(text,records,[[[[start,start+2]],[11]]]).length,0);
  assert.equal(finiteSecondPerson(text.replace('thou wilt','he will'),records,[[[[start,start+2]],[12]]]).length,0);
});

test('every Shell 85 row matches the runtime, source digests and protected evaluation set',async()=>{
  const report=require('../docs/shell-85-alignment-publication.json');
  const coverage=require('../docs/shell-85-coverage.json'),baseline=require('../docs/shell-84-coverage.json');
  const prefix='data/word-study/alignment/extensions/';
  const index=JSON.parse(fs.readFileSync(prefix+'index.json'));
  const holdout=require('../docs/shell-81-web-review-v1.json').holdout;
  const protectedRefs=new Set(holdout.flatMap(row=>[row.passage.coordinate,...row.tokens.map(t=>[t.bookId,t.chapter,t.verse].join(':'))]));
  const engine=runtime(), native=provider(), counts={}, keys=new Set();
  for(const [file,pin] of Object.entries(report.files)){
    const bytes=fs.readFileSync(prefix+file);
    assert.equal(createHash('sha256').update(bytes).digest('hex'),pin.sha256,file);
    if(file==='index.json') continue;
    const [bookId,label]=file.slice(0,-5).split('/'),chapter=Number(label);
    const shard=JSON.parse(bytes);
    for(const [translationId,rows] of Object.entries(shard.editions)){
      for(const [key,row] of Object.entries(rows)){
        const verse=Number(key),ref=[bookId,chapter,verse].join(':');
        const [verseText,,groups,,mode,donors,grammar]=row;
        const ctx={translationId,bookId,chapter,verse,verseText};
        assert.ok(!protectedRefs.has(ref));
        assert.ok(index[translationId][bookId][chapter].includes(verse));
        assert.ok(!keys.has(translationId+':'+ref));
        keys.add(translationId+':'+ref);
        assert.equal(donors.length,groups.length);
        assert.ok(donors.every(ids=>!ids.includes(translationId)));
        assert.equal(wholeWordGroups(verseText,groups).length,groups.length);
        const {records}=await native.lookupVerse(ctx);
        let result=await engine.lookupExtension(ctx,records);
        if(!result&&translationId==='kjv'&&mode==='reader'){
          const named=await engine.lookupKjvWitness(ctx)||await engine.lookupScrivenerWitness(ctx);
          if(named) result=await engine.lookupExtension(ctx,named.records,named.alignment);
        }
        assert.equal(result?.status,'available',translationId+':'+ref);
        if(mode==='scrivener') assert.match(result.records[0].source,/^Scrivener 1894/);
        if(grammar.length) assert.equal(translationId+':'+ref,'kjv:philemon:1:21');
        counts[translationId]=(counts[translationId]||0)+1;
      }
    }
  }
  assert.equal(Object.values(index).flatMap(books=>Object.values(books)).flatMap(chapters=>Object.values(chapters)).flat().length,keys.size);
  for(const [id,row] of Object.entries(report.editions)){
    assert.equal(counts[id],row.newVerses+row.improvedVerses);
    const now=coverage.editions[id], previous=baseline.editions[id];
    assert.equal(now.verifiedWords,previous.verifiedWords+row.occurrences,id);
    assert.equal(now.anyAlignedVerses,previous.anyAlignedVerses+row.newVerses,id);
    assert.equal(now.eligibleWords,previous.eligibleWords);
    for(const [bookId,old] of Object.entries(previous.books)){
      const book=now.books[bookId];
      assert.ok(book.verifiedWords>=old.verifiedWords,id+':'+bookId);
      assert.ok(book.fullyAlignedVerses>=old.fullyAlignedVerses,id+':'+bookId);
    }
  }
});

test('contextual definition requires the verified selected span and matching native morphology',async()=>{
  const {loadBibleLibrary}=require('../tools/audit-word-study-coverage');
  const verseText=loadBibleLibrary('kjv.js','kjvLibrary').philemon[1].verses[11];
  const ctx={translationId:'kjv',bookId:'philemon',chapter:1,verse:12,verseText};
  const word=tokens(verseText).find(row=>row.term==='bowels');
  const engine=runtime(), {records}=await provider().lookupVerse(ctx);
  const {alignment,records:alternate}=await engine.lookupExtension(ctx,records);
  const study={...ctx,displayWord:'bowels',englishStart:word.start,englishEnd:word.end};
  assert.match(engine.contextualDefinition(study,alternate,alignment).definition,/My own heart/);
  assert.equal(engine.contextualDefinition({...study,englishStart:0,englishEnd:4},alternate,alignment),null);
  assert.equal(engine.contextualDefinition(study,alternate.map(token=>({...token,morphology:'PREP'})),alignment),null);
});
