const {test}=require('node:test');
const assert=require('node:assert/strict');
const canon=require('../js/bible/canon');

test('Deuterocanonical labels derive only from existing Catholic-only membership',()=>{
  const labeled=canon.books.filter(b=>canon.isDeuterocanonical(b.id)).map(b=>b.id);
  assert.deepEqual(labeled,['tobit','judith','wisdom','sirach','baruch','1-maccabees','2-maccabees']);
  for(const b of canon.books)assert.equal(canon.bookLabel(b.id,b.name),b.name+(labeled.includes(b.id)?' — Deuterocanonical':''));
  assert.equal(canon.isDeuterocanonical('unknown'),false);
});
for(const [book,chapter,first,last] of [['esther',10,4,13],['daniel',3,24,90]])test(`${book} partial additions respect source boundaries`,()=>{
  assert.equal(canon.catholicOnly(book,chapter,null),false);
  assert.equal(canon.catholicOnly(book,chapter,first-1),false);
  assert.equal(canon.catholicOnly(book,chapter,first),true);
  assert.equal(canon.catholicOnly(book,chapter,last),true);
  assert.equal(canon.catholicOnly(book,chapter,last+1),false);
  assert.equal(canon.passageLabel('dra',book,chapter),`Includes Catholic additions (verses ${first}–${last})`);
  assert.equal(canon.passageLabel('web',book,chapter),'');
});
test('full addition chapters have contextual labels only in Catholic editions',()=>{
  for(const [book,chapters] of [['esther',[11,12,13,14,15,16]],['daniel',[13,14]]])for(const chapter of chapters){
    assert.equal(canon.catholicOnly(book,chapter,null),true);
    assert.equal(canon.passageLabel('dra',book,chapter),'Catholic addition');
    assert.equal(canon.passageLabel('web',book,chapter),'');
  }
  for(const [book,chapter] of [['esther',9],['daniel',12],['john',1],['genesis',1]]){
    assert.equal(canon.catholicOnly(book,chapter,1),false);
    assert.equal(canon.passageLabel('dra',book,chapter),'');
  }
  assert.equal(canon.passageLabel('dra','tobit',1),'Deuterocanonical');
});
