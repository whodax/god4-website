'use strict';
const fs = require('node:fs');
const path = require('node:path');
const zlib = require('node:zlib');
const crypto = require('node:crypto');
const assert = require('node:assert/strict');
const importer = require('./import-original-language');
const config = require('./original-language-config');
const root = path.resolve(__dirname, '..');
const directory = path.join(root, 'data/word-study/original-language/genesis');
const fixturePath = path.join(root, 'tests/fixtures/original-language/genesis-source-boundary.json.gz');
const SOURCE_SHA256 = 'f44725fef72896ba87aa2f02ae261bc9cb19dbe47736cca2926924d7226a89f4';
const FIXTURE_SHA256 = '5ce2db4366f6e19a1d262a2a72dd2c1306df941396000d82e3405016ef54fe06';
const sha256 = bytes => crypto.createHash('sha256').update(bytes).digest('hex');
const canonical = bytes => bytes.toString().replace(/\r\n/g, '\n');
const order = (a,b) => a.chapter-b.chapter || a.verse-b.verse || a.tokenIndex-b.tokenIndex;
function check(condition, message){ if(!condition) throw new Error(message); }
function validateSource(fixture){
  check(fixture.version === 1 && fixture.origin.commit === 'c0362476989ba2aef240a2ef36656fb9dbf729c9', 'Unexpected fixture provenance');
  const records = fixture.records;
  check(Array.isArray(records) && records.length === 1242, 'Expected 1,242 retained records');
  for(const row of records){
    check(row.bookId === 'genesis' && row.status === 'authoritative', 'Unexpected source book/status');
    assert.deepEqual(Object.keys(row), importer.SCHEMA_FIELDS, 'Unexpected source schema');
  }
  assert.deepEqual(importer.normalizeRecords(records), records, 'Source normalization must not change fields');
  assert.deepEqual([...records].sort(order), records, 'Unexpected source ordering');
  for(const [chapter,count,tokenCount] of [[31,54,768],[32,33,453],[33,1,21]]){
    const rows = records.filter(r => r.chapter === chapter);
    check(rows.length === tokenCount, `Unexpected source chapter count: ${chapter}`);
    assert.deepEqual([...new Set(rows.map(r => r.verse))], Array.from({length:count},(_,i)=>i+1), `Missing source verses: ${chapter}`);
  }
  for(const [ch,v,count,first] of [[31,54,12,'וַ/יִּזְבַּ֨ח'],[32,1,12,'וַ/יַּשְׁכֵּ֨ם'],[32,2,7,'וְ/יַעֲקֹ֖ב'],[32,32,11,'וַ/יִּֽזְרַֽח'],[32,33,23,'עַל'],[33,1,21,'וַ/יִּשָּׂ֨א']]){
    const rows = records.filter(r => r.chapter === ch && r.verse === v);
    check(rows.length === count && rows[0].surface === first, `Unexpected source boundary: ${ch}:${v}`);
  }
  const labels = records.filter(r => r.chapter === 31 && r.verse === 47 && r.morphology.startsWith('A'));
  check(labels.length === 2 && labels.every(r => r.language === 'hebrew'), 'Historical 31:47 labels must remain Hebrew');
  return fixture;
}
function readSource(compressed = fs.readFileSync(fixturePath)){
  check(sha256(compressed) === FIXTURE_SHA256, 'Compressed fixture integrity mismatch');
  const bytes = zlib.gunzipSync(compressed);
  check(sha256(bytes) === SOURCE_SHA256, 'Source fixture integrity mismatch');
  return validateSource(JSON.parse(bytes));
}
function validateOutput(records, source){
  const normalized = importer.normalizeRecords(records);
  assert.deepEqual(normalized, records, 'Output normalization must not change fields');
  assert.deepEqual([...records].sort(order), records, 'Output must be deterministically ordered');
  check(records.length === 1221, 'Expected 1,221 boundary tokens');
  const byLocation = new Map(records.map(r => [r.chapter+':'+r.verse+':'+r.tokenIndex,r]));
  let moved = 0, transferred = 0, decremented = 0;
  const bookConfig = config.existingBookConfig('genesis');
  const classified = importer.mapSourceRecords(source,bookConfig,{chapters:[31,32]});
  const languages = new Map(classified.map(r => [r.chapter+':'+r.verse+':'+r.tokenIndex,r.language]));
  for(const before of source.filter(r => r.chapter === 31 || r.chapter === 32)){
    const target = config.mapReference(bookConfig,before.chapter,before.verse);
    const after = byLocation.get(target.chapter+':'+target.verse+':'+before.tokenIndex);
    check(Boolean(after), 'Missing mapped token');
    // Only configured source language classification may differ beyond coordinates.
    const language = languages.get(target.chapter+':'+target.verse+':'+before.tokenIndex);
    assert.deepEqual(after, {...before,...target,language}, 'Unexpected token-field mutation');
    if(before.chapter !== after.chapter || before.verse !== after.verse) moved++;
    if(before.chapter === 32 && after.chapter === 31) transferred++;
    if(before.chapter === 32 && after.chapter === 32 && after.verse === before.verse-1) decremented++;
  }
  check(moved === 453 && transferred === 12 && decremented === 441, 'Unexpected coordinate move counts');
  for(const [ch,count,tokens] of [[31,55,780],[32,32,441]]){
    const rows = records.filter(r => r.chapter === ch);
    check(rows.length === tokens, `Unexpected output token count: ${ch}`);
    assert.deepEqual([...new Set(rows.map(r => r.verse))], Array.from({length:count},(_,i)=>i+1), `Missing canonical coverage: ${ch}`);
  }
  check(!records.some(r => r.chapter === 32 && r.verse === 33), 'Reader 32:33 must be absent');
  return {moved,transferred,decremented};
}
function generate(fixture = readSource()){
  validateSource(fixture);
  const bookConfig = config.existingBookConfig('genesis');
  // The frozen fixture retains source coordinates and legacy language labels.
  const records = importer.mapSourceRecords(fixture.records,bookConfig,{chapters:[31,32]});
  validateOutput(records,fixture.records);
  return records;
}
function inspect(){
  const fixture = readSource(), expected = generate(fixture);
  const files = fs.readdirSync(directory).sort((a,b)=>parseInt(a)-parseInt(b));
  assert.deepEqual(files,Array.from({length:50},(_,i)=>(i+1)+'.json'), 'Expected exactly 50 Genesis shards');
  const buffers = new Map(files.map(f => [f,fs.readFileSync(path.join(directory,f))]));
  const shards = new Map(files.map(f => [f,JSON.parse(buffers.get(f)).records]));
  const all = files.flatMap(f => shards.get(f));
  check(all.length === 20629, 'Genesis must retain 20,629 records');
  for(const [file,bytes] of buffers) if(!['31.json','32.json'].includes(file)){
    check(sha256(canonical(bytes)) === fixture.baselineCanonicalHashes[file], `Changed unaffected shard: ${file}`);
  }
  assert.deepEqual(shards.get('33.json').filter(r => r.verse === 1),fixture.records.filter(r => r.chapter === 33), '33:1 guard changed');
  const current = [...shards.get('31.json'),...shards.get('32.json')];
  const baseline = fixture.records.filter(r => r.chapter !== 33);
  const coordinateOnly = baseline.map(r => ({...r,...config.mapReference(config.existingBookConfig('genesis'),r.chapter,r.verse)})).sort(order);
  const corrected = JSON.stringify(current) === JSON.stringify(expected);
  check(corrected || JSON.stringify(current) === JSON.stringify(baseline) || JSON.stringify(current) === JSON.stringify(coordinateOnly), 'Current boundary must be baseline, coordinate-only, or corrected; refusing unexpected input');
  const canonicalRecords = all.filter(r => r.chapter !== 31 && r.chapter !== 32).concat(expected).sort(order);
  importer.normalizeRecords(canonicalRecords);
  const reader = config.readerBook('genesis');
  for(let ch=1;ch<=50;ch++){
    const rows = canonicalRecords.filter(r => r.chapter === ch);
    assert.deepEqual([...new Set(rows.map(r => r.verse))],Array.from({length:reader[ch].verses.length},(_,i)=>i+1),`Incomplete Genesis coverage: ${ch}`);
  }
  return {fixture,expected,buffers,corrected};
}
function pendingShards(state){
  if(state.corrected) return [];
  return [31,32].map(ch => {
    const file = ch+'.json', before = state.buffers.get(file).toString();
    const output = JSON.stringify({records:state.expected.filter(r => r.chapter === ch)},null,2)+'\n';
    const bytes = Buffer.from(before.includes('\r\n')?output.replace(/\n/g,'\r\n'):output,'utf8');
    return {file,bytes};
  }).filter(({file,bytes}) => !bytes.equals(state.buffers.get(file)));
}
function repair(){
  const state = inspect(), updates = pendingShards(state);
  if(state.corrected) return {changedFiles:[],moved:453};
  for(const {file,bytes} of updates) fs.writeFileSync(path.join(directory,file),bytes);
  const after = inspect();
  check(after.corrected,'Repair verification failed');
  for(const [file,bytes] of state.buffers) if(!updates.some(update => update.file === file)){
    check(bytes.equals(fs.readFileSync(path.join(directory,file))),`Unaffected shard bytes changed: ${file}`);
  }
  return {changedFiles:updates.map(update => update.file),moved:453};
}
if(require.main === module){
  const args = process.argv.slice(2);
  check(args.length <= 1 && args.every(a => ['--check','--dry-run'].includes(a)), 'Only --check or --dry-run is supported');
  if(args[0] === '--check'){
    check(inspect().corrected,'Genesis coordinates or language metadata still need correction');
    console.log('Genesis validated: 50 shards, 20,629 tokens, full canonical coverage; 48 unaffected hashes preserved.');
  } else if(args[0] === '--dry-run'){
    const state = inspect();
    console.log(JSON.stringify({moved:453,chapter31:780,chapter32:441,filesToChange:pendingShards(state).map(update => update.file)}));
  } else console.log(JSON.stringify(repair()));
}
module.exports = {fixturePath,SOURCE_SHA256,FIXTURE_SHA256,sha256,canonical,readSource,validateSource,validateOutput,generate,inspect,repair};
