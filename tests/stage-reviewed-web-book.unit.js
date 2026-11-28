'use strict';

const assert=require('node:assert/strict');
const {createHash}=require('node:crypto');
const {test}=require('node:test');
const {stage}=require('../tools/stage-reviewed-web-book');
const {prepareBook}=require('../tools/audit-web-book-coverage');
const {provider}=require('../tools/import-web-alignment');
const {loadBibleLibrary,READER_TOKEN_PATTERN}=require('../tools/audit-word-study-coverage');

const hash=bytes=>createHash('sha256').update(bytes).digest('hex');

test('review import stages only independently reviewed groups anchored to the live WEB witness',async()=>{
  const bible=loadBibleLibrary('web.js','webLibrary');
  const packet=await prepareBook('ruth',bible,provider(),new Map());
  const row=packet.rows.find(record=>record.status==='reviewable'&&record.passage.verse===1);
  const word=[...row.text.matchAll(READER_TOKEN_PATTERN)][0];
  const entry={spans:[{start:word.index,end:word.index+word[0].length,text:word[0]}],positions:[0]};
  const review=id=>({reviewerId:id,mode:'independent-human',date:'2026-11-27',groups:[entry],
    evidence:[{source:'synthetic-test-fixture',revision:'v1',locator:row.passage.coordinate}],rationale:'Test fixture only'});
  const create=()=>{const bytes=Buffer.from(JSON.stringify(packet)+'\n');return [bytes,{
    bookId:packet.bookId,reviewPacketSha256:hash(bytes),passages:{[row.id]:{reviews:[review('first'),review('second')]}}
  }];};
  const [bytes,submissions]=create();
  const result=await stage(bytes,submissions,['first','second']);
  assert.equal(result.counts.staged,1);
  assert.equal(result.chapters[row.passage.chapter][row.passage.verse].reviewId,row.id);
  row.tokens[0].morphology+='changed';
  const bad=await stage(...create(),['first','second']);
  assert.equal(bad.counts.invalidLiveWitness,1);
  assert.equal(bad.counts.staged,0);
  const pending=await stage(bytes,submissions,['first']);
  assert.equal(pending.counts.staged,0);
});

test('a partially aligned verse can stage disjoint groups without replacing published evidence',()=>{
  const {supplement}=require('../tools/stage-reviewed-web-book');
  const prior=[[[[5,12]],[2]]], unrelated=[[[[16,20]],[4]]];
  assert.deepEqual(supplement(prior,prior.concat(unrelated)),unrelated);
  assert.deepEqual(supplement(prior,prior),[]);
  assert.equal(supplement(prior,[[[[9,15]],[4]]]),null);
  assert.equal(supplement(prior,[[[[16,20]],[2]]]),null);
});
