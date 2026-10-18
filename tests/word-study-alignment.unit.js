const {test} = require('node:test');
const assert = require('node:assert/strict');
const alignment = require('../js/word-study/alignment');
const context = {translationId:'fixture', bookId:'fixture', chapter:1, verse:1, verseText:'First phrase and another phrase'};
const records = [0,1,2].map(tokenIndex => ({status:'authoritative',bookId:'fixture',chapter:1,verse:1,tokenIndex,surface:'fixture-' + tokenIndex}));
function fixture(){
  return {...context, status:'verified', englishText:context.verseText, originalTokens:records,
    source:{title:'Synthetic test only',reference:'test fixture',revision:'1',reviewedBy:'test harness'},
    groups:[{english:[{start:0,end:12},{start:17,end:31}],original:[0,2]}]};
}
test('production catalog provides no inferred alignments', () => {
  assert.equal(alignment.lookup(context, records).status, 'unavailable');
});
test('verified many-to-many groups work in both directions and preserve occurrence identity', () => {
  const result = alignment.createProvider([fixture()]).lookup(context, records);
  assert.equal(result.status, 'available');
  assert.equal(alignment.matchingGroups(result,{start:0,end:5}).length,1);
  assert.equal(alignment.matchingGroups(result,{start:13,end:16}).length,0);
  assert.equal(alignment.matchingGroups(result,{tokenIndex:2}).length,1);
  assert.equal(alignment.matchingGroups(result,{tokenIndex:1}).length,0);
});
for(const field of ['translationId','bookId','chapter','verse','verseText']) test('mismatched '+field+' fails closed',()=>{
  assert.equal(alignment.createProvider([fixture()]).lookup({...context,[field]:'changed'},records).status,'unavailable');
});
for(const mutate of [
  entry=>{entry.status='unreviewed';},entry=>{delete entry.source.reviewedBy;},
  entry=>{entry.originalTokens[0].surface='changed';},entry=>{entry.originalTokens[0].verse=2;},
  entry=>{entry.groups[0].original=[9];},entry=>{entry.groups[0].english=[{start:-1,end:3}];},
  entry=>{entry.groups[0].english=[{start:0,end:999}];},entry=>{entry.groups=[];}
]) test('invalid provenance, identities or ranges fail closed '+mutate.toString(),()=>{
  const entry=JSON.parse(JSON.stringify(fixture()));mutate(entry);
  assert.equal(alignment.createProvider([entry]).lookup(context,records).status,'unavailable');
});
test('ambiguous catalog records and fixture lexical records are unavailable',()=>{
  assert.equal(alignment.createProvider([fixture(),fixture()]).lookup(context,records).status,'unavailable');
  assert.equal(alignment.createProvider([fixture()]).lookup(context,records.map(record=>({...record,status:'fixture'}))).status,'unavailable');
});
test('offsets cannot split a Unicode surrogate pair',()=>{
  const text='😀 phrase';
  const entry={...fixture(),englishText:text,groups:[{english:[{start:1,end:2}],original:[0]}]};
  assert.equal(alignment.createProvider([entry]).lookup({...context,verseText:text},records).status,'unavailable');
  entry.groups[0].english=[{start:0,end:2}];
  assert.equal(alignment.createProvider([entry]).lookup({...context,verseText:text},records).status,'available');
});
test('repeated wording uses exact occurrences and overlapping groups stay many-to-many',()=>{
  const entry=fixture();
  entry.groups=[{english:[{start:6,end:12}],original:[0,2]},{english:[{start:25,end:31}],original:[1]}];
  const result=alignment.createProvider([entry]).lookup(context,records);
  assert.deepEqual(alignment.matchingGroups(result,{start:6,end:12})[0].original,[0,2]);
  assert.deepEqual(alignment.matchingGroups(result,{start:25,end:31})[0].original,[1]);
  entry.groups.push({english:[{start:6,end:12},{start:25,end:31}],original:[1]});
  const overlapping=alignment.createProvider([entry]).lookup(context,records);
  assert.equal(alignment.matchingGroups(overlapping,{start:6,end:12}).length,2);
});
for(const field of ['translationId','bookId','chapter','verse']) test('missing '+field+' cannot validate against another missing field',()=>{
  const entry=fixture(),missing={...context};delete entry[field];delete missing[field];
  assert.equal(alignment.createProvider([entry]).lookup(missing,records).status,'unavailable');
});
test('duplicate original-token identities are ambiguous and unavailable',()=>{
  const duplicate=[records[0],records[0]],entry={...fixture(),originalTokens:duplicate};
  assert.equal(alignment.createProvider([entry]).lookup(context,duplicate).status,'unavailable');
});
