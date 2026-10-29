const {test}=require('node:test');
const assert=require('node:assert/strict');
const fs=require('node:fs'),path=require('node:path'),vm=require('node:vm');
const canon=require('../js/bible/canon');
const source=fs.readFileSync(path.join(__dirname,'../js/bible/compare.js'),'utf8');
function decision(from,to,reference){
  const context={BibleCanon:canon,compareReferenceTranslation:from,getCompareReference:()=>reference};
  vm.runInNewContext(source.slice(source.indexOf('function canComparePassage('),source.indexOf('function getCompareVerses('))+';result=canComparePassage('+JSON.stringify(to)+');',context);
  return context.result;
}
const ids=['web','asv','kjv','ylt','dby','webster','rv','gnv','dra'];
const approved=new Set(['dra:ylt','ylt:dra','dra:gnv','gnv:dra']);
for(const from of ids)test(from+': only the four reviewed directions extend existing compatibility',()=>{
  for(const to of ids)for(const reference of [
    {bookId:'ruth',chapter:2,verse:2},{bookId:'ruth',chapter:2,verse:1},
    {bookId:'ruth',chapter:2,verse:3},{bookId:'ruth',chapter:1,verse:2},
    {bookId:'ruth',chapter:3,verse:2},{bookId:'ruth',chapter:2,verse:null},
    {bookId:'psalms',chapter:23,verse:1},{bookId:'esther',chapter:16,verse:24},
    {bookId:'daniel',chapter:3,verse:90},{bookId:'tobit',chapter:1,verse:2},
    {bookId:'john',chapter:1,verse:2}
  ]){
    const expected=canon.comparable(from,to,reference.bookId) || reference.bookId==='ruth' && reference.chapter===2 && reference.verse===2 && approved.has(from+':'+to);
    assert.equal(decision(from,to,reference),expected,JSON.stringify({from,to,reference}));
  }
});
test('reviewed equivalence never changes the shared Reader/voice canon policy',()=>{
  for(const id of ['ylt','gnv'])assert.equal(canon.comparable('dra',id,'ruth'),false);
  for(const reference of [{bookId:'ruth',chapter:2,verse:'2'},{bookId:'ruth',chapter:'2',verse:2}])assert.equal(decision('dra','ylt',reference),false);
});
