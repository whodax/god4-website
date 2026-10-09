'use strict';
const {test} = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const {execFileSync} = require('node:child_process');
const repair = require('../tools/repair-genesis-references');
const importer = require('../tools/import-original-language');
const config = require('../tools/original-language-config');
const directory = path.resolve(__dirname,'../data/word-study/original-language/genesis');
const source = repair.readSource();
const files = fs.readdirSync(directory).sort((a,b)=>parseInt(a)-parseInt(b));
const production = files.flatMap(file=>JSON.parse(fs.readFileSync(path.join(directory,file))).records);
const expected = repair.generate();
const boundaryRows = production.filter(r=>[31,32].includes(r.chapter));
const clone = value=>JSON.parse(JSON.stringify(value));

test('fixture has pinned compressed/uncompressed hashes and historical baseline provenance',()=>{
  assert.equal(repair.sha256(fs.readFileSync(repair.fixturePath)),repair.FIXTURE_SHA256);
  assert.equal(source.records.length,1242);
  for(const ch of [31,32,33]){
    const baseline=JSON.parse(execFileSync('git',['show',source.origin.commit+':data/word-study/original-language/genesis/'+ch+'.json'],{maxBuffer:16000000,encoding:'utf8'})).records;
    assert.deepEqual(source.records.filter(r=>r.chapter===ch),ch===33?baseline.filter(r=>r.verse===1):baseline);
  }
});
test('50 Genesis shards retain 20,629 tokens and all 1,533 canonical verses',()=>{
  assert.deepEqual(files,Array.from({length:50},(_,i)=>(i+1)+'.json'));
  assert.equal(production.length,20629);
  assert.equal(new Set(production.map(r=>r.chapter+':'+r.verse)).size,1533);
  assert.deepEqual(importer.normalizeRecords(production),production);
  const book=config.readerBook('genesis');
  for(let ch=1;ch<=50;ch++){
    const rows=production.filter(r=>r.chapter===ch);
    assert.deepEqual([...new Set(rows.map(r=>r.verse))],Array.from({length:book[ch].verses.length},(_,i)=>i+1));
  }
  assert.equal(production.filter(r=>r.chapter===31).length,780);
  assert.equal(production.filter(r=>r.chapter===32).length,441);
});
for(const [ch,v,sourceCh,sourceVerse,count,first] of [
  [31,54,31,54,12,'וַ/יִּזְבַּ֨ח'],[31,55,32,1,12,'וַ/יַּשְׁכֵּ֨ם'],
  [32,1,32,2,7,'וְ/יַעֲקֹ֖ב'],[32,31,32,32,11,'וַ/יִּֽזְרַֽח'],
  [32,32,32,33,23,'עַל'],[33,1,33,1,21,'וַ/יִּשָּׂ֨א']
]) test(`Genesis ${ch}:${v} has the complete retained expected token set`,()=>{
  const actual=production.filter(r=>r.chapter===ch&&r.verse===v);
  const wanted=source.records.filter(r=>r.chapter===sourceCh&&r.verse===sourceVerse).map(r=>({...r,chapter:ch,verse:v}));
  assert.equal(actual.length,count);assert.equal(actual[0].surface,first);
  assert.deepEqual(actual,wanted);
});
test('Reader 32:33 is absent and existing mapping covers both endpoints exactly',()=>{
  assert.equal(production.some(r=>r.chapter===32&&r.verse===33),false);
  const cfg=config.existingBookConfig('genesis');
  assert.deepEqual(config.mapReference(cfg,32,1),{bookId:'genesis',chapter:31,verse:55});
  for(let v=2;v<=33;v++)assert.deepEqual(config.mapReference(cfg,32,v),{bookId:'genesis',chapter:32,verse:v-1});
});
test('exactly 453 coordinate moves preserve every other field, including bookId',()=>{
  assert.deepEqual(boundaryRows,expected);
  assert.deepEqual(repair.validateOutput(boundaryRows,source.records),{moved:453,transferred:12,decremented:441});
  const before=source.records.filter(r=>r.chapter!==33);
  for(let i=0;i<before.length;i++)for(const key of importer.SCHEMA_FIELDS.filter(k=>!['chapter','verse'].includes(k)))assert.equal(boundaryRows[i][key],before[i][key],key);
  assert.deepEqual(production.filter(r=>r.chapter===31&&r.verse<=54),source.records.filter(r=>r.chapter===31));
});
test('31:47 Aramaic morphology tokens deliberately retain deployed Hebrew labels',()=>{
  const labels=production.filter(r=>r.chapter===31&&r.verse===47&&r.morphology.startsWith('A'));
  assert.deepEqual(labels.map(r=>[r.surface,r.language]),[['יְגַ֖ר','hebrew'],['שָׂהֲדוּתָ֑א','hebrew']]);
  assert.deepEqual(labels,source.records.filter(r=>r.chapter===31&&r.verse===47&&r.morphology.startsWith('A')));
});
test('all 48 unaffected shard hashes match baseline and Git contains only the two shard changes',()=>{
  let count=0;
  for(const file of files)if(!['31.json','32.json'].includes(file)){
    const bytes=fs.readFileSync(path.join(directory,file));
    assert.equal(repair.sha256(repair.canonical(bytes)),source.baselineCanonicalHashes[file],file);count++;
  }
  assert.equal(count,48);
  const changed=execFileSync('git',['diff','--name-only',source.origin.commit,'--','data/word-study/original-language','js/bible','js/word-study','sw.js'],{encoding:'utf8'}).trim().split(/\r?\n/).filter(Boolean);
  assert.deepEqual(changed,['data/word-study/original-language/genesis/31.json','data/word-study/original-language/genesis/32.json']);
});
test('generation is deterministic; repeated repair writes no files or bytes',()=>{
  assert.deepEqual(repair.generate(),repair.generate());
  const before=files.map(file=>repair.sha256(fs.readFileSync(path.join(directory,file))));
  assert.deepEqual(repair.repair(),{changedFiles:[],moved:453});
  assert.deepEqual(files.map(file=>repair.sha256(fs.readFileSync(path.join(directory,file)))),before);
});
test('corrupted fixture integrity, missing source verses and duplicate indexes are rejected',()=>{
  const bytes=Buffer.from(fs.readFileSync(repair.fixturePath));bytes[20]^=1;
  assert.throws(()=>repair.readSource(bytes),/integrity/);
  const missing=clone(source);missing.records=missing.records.filter(r=>!(r.chapter===32&&r.verse===33));
  assert.throws(()=>repair.generate(missing));
  const duplicate=clone(source);duplicate.records[1]=clone(duplicate.records[0]);
  assert.throws(()=>repair.generate(duplicate),/duplicate/);
  const gap=clone(source);gap.records[0].tokenIndex=100;
  assert.throws(()=>repair.generate(gap),/Noncontiguous/);
});
test('invalid output collisions, missing canonical coverage and extra 32:33 fail',()=>{
  assert.throws(()=>repair.validateOutput([...expected,expected[0]],source.records),/duplicate/);
  assert.throws(()=>repair.validateOutput(expected.filter(r=>!(r.chapter===31&&r.verse===55)),source.records));
  const wrong=clone(expected);wrong.find(r=>r.chapter===32&&r.verse===32).verse=33;
  assert.throws(()=>repair.validateOutput(wrong,source.records));
});
test('every unexpected non-coordinate token mutation is rejected, including language and provenance',()=>{
  for(const key of importer.SCHEMA_FIELDS.filter(k=>!['chapter','verse'].includes(k))){
    const changed=clone(expected);
    changed[0][key]=key==='tokenIndex'?99:key==='strongsNumber'?'H9999':key==='bookId'?'john':key==='language'?'aramaic':key==='status'?'fixture':'unexpected';
    assert.throws(()=>repair.validateOutput(changed,source.records),key);
  }
});
