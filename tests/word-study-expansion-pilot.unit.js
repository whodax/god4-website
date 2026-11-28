'use strict';
const assert=require('node:assert/strict');
const {createHash}=require('node:crypto');
const test=require('node:test');
const {gate,prepareBook}=require('../tools/audit-web-book-coverage');
const {assessBook}=require('../tools/adjudicate-web-book');
const {hebrewEvidence,projectExactTypography,readTr}=require('../tools/audit-kjv-expansion');
const existing=require('../docs/shell-81-web-review-v1.json');

test('typographic repair keeps exact Reader offsets and disjoint groups',()=>{
  assert.deepEqual(projectExactTypography("I don't   know him.",'I don’t know him.',[[[[2,7],[15,18]],[1,3]]]),
    [[[[2,7],[13,16]],[1,3]]]);
  assert.equal(projectExactTypography('He [came].','He came.',[[[[4,8]],[1]]]),null);
  assert.equal(projectExactTypography('He came, and spoke.','He came and spoke.',[[[[3,7]],[1]]]),null);
  assert.equal(projectExactTypography("I don't know.",'I do not know.',[[[[2,7]],[1]]]),null);
  assert.equal(projectExactTypography("I don't know.",'I don’t know.',[[[[3,7]],[1]]]),null);
});

test('Hebrew Strong leads keep repeats and absent identities separate from position evidence',()=>{
  const result=hebrewEvidence('<w lemma="strong:H001 strong:H002">x</w><w lemma="strong:H003">y</w>',
    [{strongsNumber:'H1'},{strongsNumber:'H2'},{strongsNumber:'H2'}]);
  assert.deepEqual(result,{sourcePositions:false,unique:1,repeated:1,absent:1});
});

test('book review gate protects held-out coordinates and checks exact token order',()=>{
  const row=existing.holdout[0].passage;
  const context={bookId:row.bookId,chapter:row.chapter,verse:row.verse,verseText:'Recorded text'};
  assert.equal(gate(context,[]),'held-out');
  assert.equal(gate({bookId:'ruth',chapter:1,verse:3,verseText:'Text'},[{...row,tokenIndex:0}]),'held-out');
  assert.equal(gate({bookId:'ruth',chapter:1,verse:3,verseText:'Text'},[{status:'authoritative',tokenIndex:1}]),'invalid-original-positions');
});

test('whole-book packet keeps every slot and strips text and hints from withheld entries',async()=>{
  const row=existing.holdout.find(x=>x.passage.bookId==='matthew').passage;
  const {bookId,chapter,verse}=row;
  const book={chapters:chapter};
  for(let i=1;i<=chapter;i++) book[i]={verses:[]};
  book[chapter].verses=Array(verse+1).fill('Example.');
  const out=await prepareBook(bookId,{[bookId]:book},{lookupVerse:async()=>({records:[]})},new Map());
  assert.equal(out.rows.length,verse+1);
  assert.equal(out.rows[verse-1].status,'held-out');
  assert.ok(!('text' in out.rows[verse-1]));
  assert.ok(out.counts['missing-original-witness']>0);
  assert.deepEqual(out.hints,[]);
});

test('book adjudication binds submissions to the exact packet and protects withheld rows',()=>{
  const row={id:'example',status:'reviewable',text:'Word',tokens:[{index:0,surface:'α',language:'greek',morphology:'N'}]};
  const bytes=Buffer.from(JSON.stringify({version:1,bookId:'ruth',rows:[row,{id:'held',status:'held-out'}]}));
  const submissions={bookId:'ruth',reviewPacketSha256:createHash('sha256').update(bytes).digest('hex'),passages:{}};
  assert.deepEqual(assessBook(bytes,submissions,[]).counts,{pending:1,agreed:0,disagreement:0,resolved:0,unavailable:1});
  assert.throws(()=>assessBook(bytes,{...submissions,passages:{held:{}}},[]),/withheld/);
  assert.throws(()=>assessBook(bytes,{...submissions,reviewPacketSha256:'wrong'},[]),/frozen/);
  const review=id=>({reviewerId:id,mode:'independent-human',date:'2026-11-27',
    rationale:'Fixture',evidence:[{source:'fixture',revision:'1',locator:'example'}],
    groups:[{spans:[{start:0,end:4,text:'Word'}],positions:[0]}]});
  submissions.passages.example={reviews:[review('first'),review('second')]};
  assert.equal(assessBook(bytes,submissions,['first','second']).counts.agreed,1);
});

test('Textus Receptus parser preserves verse and token identity, and refuses partial markup',()=>{
  const data=readTr('1:1 biblov 976 {N-NSF}\n ihsou 2424 {N-GSM}\n1:2 ? unclear 1 {N-NSF}\n','matthew');
  assert.deepEqual(data.verses.get('1:1').map(({surface,strongsNumber,morphology,tokenIndex})=>
    [surface,strongsNumber,morphology,tokenIndex]),[['βιβλος','G976','N-NSF',0],['ιησου','G2424','N-GSM',1]]);
  assert.ok(!data.verses.has('1:2'));
  assert.equal(data.issues['unsupported TR markup'],1);
});
