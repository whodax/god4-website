'use strict';
const {test} = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const vm = require('node:vm');
const root = path.resolve(__dirname, '..');
function provider(){
  const requests = [];
  const realm = vm.createContext({fetch(url){
    requests.push(url);
    const data = JSON.parse(fs.readFileSync(path.join(root, url), 'utf8'));
    return Promise.resolve({ok:true, json:() => Promise.resolve(data)});
  }});
  vm.runInContext(fs.readFileSync(path.join(root, 'js/word-study/original-language-provider.js'), 'utf8'), realm);
  return {api:realm.OriginalLanguageWordStudyProvider, requests};
}
const plain = value => JSON.parse(JSON.stringify(value));

for(const [verse, canonical] of [[24,25],[25,26],[26,27]]){
  test(`WEB Romans 14:${verse} resolves only to canonical 16:${canonical} without mutation`, () => {
    const {api} = provider();
    const input = Object.freeze({translationId:'web', bookId:'romans', chapter:14, verse});
    assert.deepEqual(plain(api.resolveOriginalLanguageReference(input)), {bookId:'romans', chapter:16, verse:canonical});
    assert.equal(input.chapter, 14); assert.equal(input.verse, verse);
  });
}

for(const input of [
  {translationId:'web', bookId:'romans', chapter:14, verse:23},
  ...[24,25,26,27].map(verse => ({translationId:'web', bookId:'romans', chapter:16, verse})),
  ...['kjv','asv','ylt','dby','webster','rv','gnv','unknown',undefined].map(translationId => ({translationId, bookId:'romans', chapter:14, verse:24})),
  {translationId:'web', bookId:'john', chapter:14, verse:24},
  {translationId:'web', bookId:'genesis', chapter:14, verse:24}
]) test(`identity reference ${input.translationId || 'unspecified'} ${input.bookId} ${input.chapter}:${input.verse}`, () => {
  const {api} = provider();
  assert.deepEqual(plain(api.resolveOriginalLanguageReference(input)), {bookId:input.bookId, chapter:input.chapter, verse:input.verse});
});

for(const [verse, target, count] of [[24,25,20],[25,26,20],[26,27,13]]){
  test(`WEB provider loads 16.json for 14:${verse} and returns ${count} canonical tokens`, async () => {
    const {api, requests} = provider();
    const context = {translationId:'web', bookId:'romans', chapter:14, verse};
    const result = await api.lookupVerse(context);
    const expected = JSON.parse(fs.readFileSync(path.join(root, 'data/word-study/original-language/romans/16.json'))).records.filter(r => r.verse === target);
    assert.equal(result.status, 'available'); assert.equal(result.records.length, count);
    assert.deepEqual(plain(result.records), expected);
    const token = await api.lookup({...context, tokenIndex:0, displayWord:'English'});
    assert.deepEqual(plain(token), {word:'English', ...expected[0]});
    assert.deepEqual(requests, ['data/word-study/original-language/romans/16.json']);
  });
}

for(const [translationId, chapter, verse] of [['web',14,23], ['web',16,25], ['kjv',16,25], ['asv',16,25]]){
  test(`${translationId} provider preserves canonical ${chapter}:${verse}`, async () => {
    const {api, requests} = provider();
    const result = await api.lookupVerse({translationId, bookId:'romans', chapter, verse});
    const url = `data/word-study/original-language/romans/${chapter}.json`;
    const expected = JSON.parse(fs.readFileSync(path.join(root, url))).records.filter(r => r.verse === verse);
    assert.deepEqual(plain(result.records), expected);
    assert.deepEqual(requests, [url]);
  });
}

test('mapped and identity references share the canonical chapter request cache', async () => {
  const {api, requests} = provider();
  await Promise.all([24,25,26].map(verse => api.lookupVerse({translationId:'web', bookId:'romans', chapter:14, verse})));
  await api.lookupVerse({translationId:'kjv', bookId:'romans', chapter:16, verse:25});
  assert.deepEqual(requests, ['data/word-study/original-language/romans/16.json']);
});

for(const translationId of ['dra','web','kjv']){
  for(const [bookId,chapter,verse,language] of [['isaiah',1,1,'hebrew'],['isaiah',53,5,'hebrew'],['john',1,1,'greek']]){
    test(translationId+' canonical original-language '+bookId+' '+chapter+':'+verse, async()=>{
      const {api,requests}=provider();
      const context={translationId,bookId,chapter,verse,bookName:'Isaias',verseText:'Different displayed translation text',lookupTerm:'different'};
      const url='data/word-study/original-language/'+bookId+'/'+chapter+'.json';
      const expected=JSON.parse(fs.readFileSync(path.join(root,url))).records.filter(r=>r.verse===verse);
      const actual=await api.lookupVerse(context);
      assert.equal(actual.status,'available');assert.ok(expected.length>0);
      assert.deepEqual(plain(actual.records),expected);
      assert.ok(actual.records.every(r=>r.language===language));
      assert.deepEqual(plain(await api.lookup({...context,tokenIndex:0,displayWord:'Translation word'})),{word:'Translation word',...expected[0]});
      assert.deepEqual(requests,[url]);
    });
  }
}
for(const [bookId,chapter,verse] of [['tobit',1,1],['judith',1,1],['sirach',1,1],['esther',10,4],['daniel',3,24],['daniel',13,1],['genesis',49,1],['genesis',50,1],['isaiah',45,1],['isaiah',46,1],['john',6,1]]){
  test('DRA unavailable without reviewed source coordinates '+bookId+' '+chapter+':'+verse,async()=>{
    const {api,requests}=provider();const context={translationId:'dra',bookId,chapter,verse,tokenIndex:0};
    assert.deepEqual(plain(await api.lookupVerse(context)),{status:'unavailable',records:[]});
    assert.equal((await api.lookup(context)).status,'unavailable');assert.deepEqual(requests,[]);
  });
}

test('local DRA chapter-bound differences stay excluded from original-language lookup',async()=>{
  const realm=vm.createContext({});
  for(const id of ['dra','kjv'])vm.runInContext(fs.readFileSync(path.join(root,'js/bible/'+id+'.js'),'utf8'),realm);
  const dra=vm.runInContext('draLibrary',realm),kjv=vm.runInContext('kjvLibrary',realm);
  const differences=[];
  const {api,requests}=provider();
  for(const bookId of ['genesis','isaiah','john','romans']){
    assert.equal(dra[bookId].chapters,kjv[bookId].chapters);
    for(let chapter=1;chapter<=kjv[bookId].chapters;chapter++){
      const d=dra[bookId][chapter].verses.length,k=kjv[bookId][chapter].verses.length;
      if(d===k)continue;
      differences.push([bookId,chapter,d,k]);
      assert.deepEqual(plain(await api.lookupVerse({translationId:'dra',bookId,chapter,verse:1})),{status:'unavailable',records:[]});
    }
  }
  assert.deepEqual(differences,[['genesis',49,32,33],['genesis',50,25,26],['isaiah',45,26,25],['isaiah',46,12,13],['john',6,72,71]]);
  assert.deepEqual(requests,[]);
});
