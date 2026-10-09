'use strict';
const {test} = require('node:test');
const assert = require('node:assert/strict');
const fs = require('fs');
const path = require('path');
const vm = require('vm');
const os = require('os');
const {spawnSync} = require('child_process');
const importer = require('../tools/import-original-language');
const configs = require('../tools/original-language-config');
const root = path.resolve(__dirname, '..');
function records(book){
  const dir = path.join(root, 'data/word-study/original-language', book);
  return fs.readdirSync(dir).sort((a,b) => parseInt(a) - parseInt(b)).flatMap(file => JSON.parse(fs.readFileSync(path.join(dir,file))).records);
}
const genesis = records('genesis'), john = records('john');
const boundary = require('../tools/repair-genesis-references').readSource();
// Parser replay must use retained source coordinates, not repaired Reader shards.
const sourceGenesis = genesis.filter(r=>![31,32].includes(r.chapter))
  .concat(boundary.records.filter(r=>[31,32].includes(r.chapter)))
  .sort((a,b)=>a.chapter-b.chapter||a.verse-b.verse||a.tokenIndex-b.tokenIndex);
const genConfig = configs.existingBookConfig('genesis'), johnConfig = configs.existingBookConfig('john');
const clone = value => JSON.parse(JSON.stringify(value));
const sample = clone(genesis[0]);
function xmlEscape(value){ return value.replace(/&/g,'&amp;').replace(/"/g,'&quot;').replace(/</g,'&lt;').replace(/>/g,'&gt;'); }
function sourceInput(rs, bookId){
  const groups = new Map(), lexicon = new Map();
  for(const r of rs){
    const key = r.chapter + ':' + r.verse;
    if(!groups.has(key)) groups.set(key, []);
    groups.get(key).push(r);
    if(r.strongsNumber){
      const entry = bookId === 'Gen' ? r.definition : {lemma:r.lemma,transliteration:r.transliteration,definition:r.definition};
      if(lexicon.has(r.strongsNumber)) assert.deepEqual(lexicon.get(r.strongsNumber), entry);
      lexicon.set(r.strongsNumber, entry);
    }
  }
  const text = [...groups].map(([key, rows]) => bookId === 'Gen'
    ? '<verse osisID="Gen.' + key.replace(':','.') + '">' + rows.map(r => '<w lemma="'+xmlEscape(r.lemma)+'" morph="'+xmlEscape(r.morphology)+'">'+xmlEscape(r.surface)+'</w>').join('') + '</verse>'
    : key.replace(':',',') + ',' + rows.map(r => r.surface + ' ' + r.strongsNumber.slice(1) + ' {' + r.morphology + '}').join(' ')).join('\n');
  return {text, lexicon};
}

test('generic Hebrew config parses a different canonical book without new shards', () => {
  const config = configs.createBookConfig('exodus','oshb','Exod');
  config.referenceMapping = {strategy:'identity',verified:true,evidence:'Synthetic unit-test coordinates only'};
  const n = configs.readerBook('exodus')[1].verses.length;
  const text = Array.from({length:n},(_,i) => '<verse osisID="Exod.1.'+(i+1)+'"><w lemma="7225" morph="HNcfsa">א</w></verse>').join('');
  const rs = importer.parseConfiguredSource(text,new Map([['H7225','beginning']]),config,{chapters:[1]});
  assert.equal(rs.length,n); assert.equal(rs[0].bookId,'exodus'); assert.equal(rs[0].language,'hebrew');
});

test('generic Greek config parses another canonical book using the same strategy', () => {
  const config = configs.createBookConfig('mark','byzantine','Mark');
  config.referenceMapping = {strategy:'identity',verified:true,evidence:'Synthetic unit-test coordinates only'};
  const n = configs.readerBook('mark')[1].verses.length;
  const text = Array.from({length:n},(_,i) => '1,'+(i+1)+',εν 1722 {PREP}').join('\n');
  const rs = importer.parseConfiguredSource(text,new Map([['G1722',{lemma:'ἐν',transliteration:'en',definition:'in'}]]),config,{chapters:[1]});
  assert.equal(rs.length,n); assert.equal(rs[0].bookId,'mark'); assert.equal(rs[0].transliteration,'en');
});

test('future Isaiah and Romans configs validate but cannot import unverified references', () => {
  for(const [book,profile,id] of [['isaiah','oshb','Isa'],['romans','byzantine','Rom']]){
    const config = configs.createBookConfig(book,profile,id);
    assert.equal(configs.validateBookConfig(config),config);
    assert.throws(() => importer.mapSourceRecords([],config), /unknown\/unverified/);
  }
});

test('identity mapping is explicit and bounded', () => {
  assert.deepEqual(configs.mapReference(johnConfig,1,1),{bookId:'john',chapter:1,verse:1});
  assert.throws(() => configs.mapReference(johnConfig,22,1), /Unmapped/);
  assert.throws(() => configs.mapReference(johnConfig,1,999), /Unmapped/);
});

test('Genesis 31/32 mapping is a declared exception including both endpoints', () => {
  assert.deepEqual(configs.mapReference(genConfig,32,1),{bookId:'genesis',chapter:31,verse:55});
  for(let v=2;v<=33;v++) assert.deepEqual(configs.mapReference(genConfig,32,v),{bookId:'genesis',chapter:32,verse:v-1});
  assert.throws(() => configs.mapReference(genConfig,31,55), /Unmapped/);
  assert.throws(() => configs.mapReference(genConfig,32,34), /Unmapped/);
  assert.match(sourceGenesis.find(r=>r.chapter===32&&r.verse===1&&r.tokenIndex===1).definition,/Laban/);
  assert.match(configs.readerBook('genesis')[31].verses[54],/Laban/);
  assert.match(configs.readerBook('genesis')[32].verses[31],/sinew/);
  assert.ok(sourceGenesis.some(r=>r.chapter===32&&r.verse===33&&/sinew/i.test(r.definition||'')));
});

test('explicit mappings reject any omitted source verse', () => {
  const config=clone(johnConfig); config.referenceMapping={strategy:'explicit',verified:true,evidence:'test',overrides:{'1:1':{chapter:1,verse:1}}};
  assert.throws(()=>configs.validateBookConfig(config),/Unmapped/);
});

test('mapping collisions, overlaps and invalid entries are rejected', () => {
  for(const modify of [
    c=>{c.referenceMapping.ranges.push({...c.referenceMapping.ranges[0]});},
    c=>{c.referenceMapping.overrides['1:1']={chapter:1,verse:2};},
    c=>{c.referenceMapping.ranges[0].sourceEnd=34;},
    c=>{c.referenceMapping.overrides['0:1']={chapter:1,verse:1};},
    c=>{c.referenceMapping.overrides['1:1']=null;}
  ]){const c=clone(genConfig);modify(c);assert.throws(()=>configs.validateBookConfig(c));}
});

test('missing expected Reader mapping and actual verse coverage are detected', () => {
  const c=clone(johnConfig); c.sourceVerseCounts[0]--;
  assert.throws(()=>configs.validateBookConfig(c),/Missing Reader mapping/);
  assert.throws(()=>importer.mapSourceRecords(john.filter(r=>!(r.chapter===1&&r.verse===2)),johnConfig),/Missing Reader coverage: 1:2/);
});

test('unmapped source coordinates fail even outside a selected chapter', () => {
  assert.throws(()=>importer.mapSourceRecords([...john,{...john[0],chapter:22}],johnConfig,{chapters:[1]}),/Unmapped/);
});

test('contiguous indexes are validated without changing input token order', () => {
  const pair=[sample,{...sample,tokenIndex:1}];
  assert.deepEqual(importer.normalizeRecords(pair),pair);
  assert.throws(()=>importer.normalizeRecords([{...sample,tokenIndex:1}]),/Noncontiguous/);
  assert.throws(()=>importer.normalizeRecords([sample,{...sample,tokenIndex:2}]),/Noncontiguous/);
});

test('partial mapped chapters cannot overwrite complete Reader shards', () => {
  const source = sourceGenesis.filter(r=>r.chapter===32);
  const rs = importer.mapSourceRecords(source,genConfig,{chapters:[32]});
  assert.throws(()=>importer.writeStaticData(rs,'unused'),/Incomplete Reader chapter output/);
  assert.throws(()=>importer.selectedChapters('1,invalid'),/Invalid chapter selection/);
});

test('duplicate tokens and invalid schema cannot deploy', () => {
  assert.throws(()=>importer.normalizeRecords([sample,sample]),/duplicate/);
  for(const bad of [{...sample,chapter:0},{...sample,tokenIndex:'0'},{...sample,morphology:null},{...sample,lemma:undefined},{...sample,bookId:'../escape'},{...sample,status:'other'}]) assert.throws(()=>importer.normalizeRecord(bad));
});

test('language metadata supports Hebrew Aramaic and Greek without changing the schema', () => {
  assert.equal(importer.normalizeRecord({...sample,language:'aramaic',morphology:'ANp'}).language,'aramaic');
  assert.equal(importer.normalizeRecord(john[0]).language,'greek');
  assert.throws(()=>importer.normalizeRecord({...sample,language:'greek'}),/language mismatch/);
  assert.throws(()=>importer.normalizeRecord({...sample,language:'other'}),/unsupported language/);
  const mapped=importer.mapSourceRecords(sourceGenesis,genConfig);
  assert.equal(mapped.filter(r=>r.language==='aramaic').length,2);
  assert.equal(mapped.filter(r=>r.language==='aramaic').every(r=>r.morphology[0]==='A'),true);
  assert.deepEqual(Object.keys(mapped[0]),importer.SCHEMA_FIELDS);
});

test('configuration validates parser strategies and explicit provenance gaps', () => {
  assert.equal(genConfig.source.revision,null); assert.equal(genConfig.source.verification,'unknown/unverified');
  for(const change of [c=>{c.source.license='';},c=>{delete c.source.revision;},c=>{c.source.lexicalSource=null;},c=>{c.morphologyFormat='invented';},c=>{c.testament='NT';},c=>{c.readerBookId='john';},c=>{c.sourceBookId='';}]){const c=clone(genConfig);change(c);assert.throws(()=>configs.validateBookConfig(c));}
});

test('legacy Genesis extraction reproduces retained source records and generic mapping remains distinct from coordinate-only production', () => {
  const {text,lexicon}=sourceInput(sourceGenesis,'Gen');
  assert.deepEqual(importer.normalizeRecords(importer.parseOshbGenesis(text,lexicon,genConfig.sourceVerseCounts.map((_,i)=>i+1))),sourceGenesis);
  const generated=importer.parseConfiguredSource(text,lexicon,genConfig);
  const expected=sourceGenesis.map(r=>({...r,chapter:r.chapter===32&&r.verse===1?31:r.chapter,verse:r.chapter===32?(r.verse===1?55:r.verse-1):r.verse,language:r.morphology[0]==='A'?'aramaic':r.language}));
  assert.deepEqual(generated,expected);
  assert.deepEqual(generated,genesis.map(r=>({...r,language:r.morphology[0]==='A'?'aramaic':r.language})));
  assert.equal(new Set(generated.map(r=>r.chapter+':'+r.verse)).size,1533);
});

test('John generic identity generation preserves all deployed fields and chapter bytes', () => {
  const {text,lexicon}=sourceInput(john,'John');
  const generated=importer.parseConfiguredSource(text,lexicon,johnConfig);
  assert.deepEqual(generated,john);
  for(let ch=1;ch<=21;ch++){
    const output=JSON.stringify({records:generated.filter(r=>r.chapter===ch)},null,2)+'\n';
    const actual=fs.readFileSync(path.join(root,'data/word-study/original-language/john',ch+'.json'),'utf8').replace(/\r\n/g,'\n');
    assert.equal(output,actual);
  }
});

test('configured lexical join strategies preserve existing Hebrew and Greek source fields', () => {
  const h=importer.parseStrongDat('\\07225\\beginning$$T','hebrew');assert.equal(h.get('H7225'),'beginning');
  const g=importer.parseStrongGreekXml('<entry strongs="1722"><greek unicode="ἐν" translit="en"/><strongs_def>in</strongs_def></entry>');
  assert.deepEqual(g.get('G1722'),{definition:'in',lemma:'ἐν',transliteration:'en'});
});

test('legacy JSON import refuses authoritative writes without source configuration', () => {
  assert.throws(()=>importer.importOriginalLanguage([sample],'unused'),/configured source import/);
});

test('configured CLI dry-runs and writes reviewed complete chapters with local lexical inputs', () => {
  const temporary = fs.mkdtempSync(path.join(os.tmpdir(),'god4-configured-import-'));
  try{
    for(const config of [genConfig,johnConfig]){
      const count = config.sourceVerseCounts[0], hebrew = config.language === 'hebrew';
      const source = hebrew ? Array.from({length:count},(_,i)=>'<verse osisID="Gen.1.'+(i+1)+'"><w lemma="7225" morph="HNcfsa">א</w></verse>').join('')
        : Array.from({length:count},(_,i)=>'1,'+(i+1)+',εν 1722 {PREP}').join('\n');
      const lexical = hebrew ? '\\07225\\beginning$$T' : '<entry strongs="1722"><greek unicode="ἐν" translit="en"/><strongs_def>in</strongs_def></entry>';
      const configFile=path.join(temporary,'config.json'), sourceFile=path.join(temporary,'input'), lexicalFile=path.join(temporary,'lexicon');
      fs.writeFileSync(configFile,JSON.stringify(config));fs.writeFileSync(sourceFile,source);fs.writeFileSync(lexicalFile,lexical);
      const out=path.join(temporary,config.bookId), args=['tools/import-original-language.js','--config',configFile,'--source',sourceFile,'--lexicon',lexicalFile,'--chapters','1'];
      const dry=spawnSync(process.execPath,[...args,'--dry-run'],{cwd:root,encoding:'utf8'});
      assert.equal(dry.status,0,dry.stderr);assert.match(dry.stdout,/Validated dry-run/);assert.equal(fs.existsSync(out),false);
      const write=spawnSync(process.execPath,[...args,'--output',out],{cwd:root,encoding:'utf8'});
      assert.equal(write.status,0,write.stderr);
      const generated=JSON.parse(fs.readFileSync(path.join(out,config.bookId,'1.json'))).records;
      assert.equal(generated.length,count);assert.equal(generated[0].definition,hebrew?'beginning':'in');
      assert.equal(generated[0].transliteration,hebrew?null:'en');
    }
  }finally{
    const resolved=path.resolve(temporary), allowed=path.resolve(os.tmpdir())+path.sep;
    if(!resolved.startsWith(allowed)) throw new Error('Temporary test directory escaped its root');
    fs.rmSync(resolved,{recursive:true,force:true});
  }
});

test('configured parsers reject unknown references and malformed Greek tokens', () => {
  const config=clone(johnConfig);
  assert.throws(()=>importer.parseConfiguredSource('22,1,εν 1722 {PREP}',new Map(),config,{chapters:[1]}),/Unmapped/);
  assert.throws(()=>importer.parseConfiguredSource('1,1,εν 1722 {PREP} malformed',new Map(),config,{chapters:[1]}),/Malformed/);
  const c=clone(genConfig);c.referenceMapping.overrides['032:01']={chapter:31,verse:55};
  assert.throws(()=>configs.validateBookConfig(c),/Invalid source mapping key/);
});

test('provider still performs lazy per-chapter lookup on unchanged deployed records', async () => {
  const fetched=[]; const realm=vm.createContext({fetch:async url=>{fetched.push(url);const file=path.join(root,url);return {ok:fs.existsSync(file),json:async()=>JSON.parse(fs.readFileSync(file))};}});
  vm.runInContext(fs.readFileSync(path.join(root,'js/word-study/original-language-provider.js'),'utf8'),realm);
  for(const [book,ch,v] of [['genesis',1,1],['genesis',14,1],['john',1,1]]){
    const context={bookId:book,chapter:ch,verse:v};const actual=await realm.OriginalLanguageWordStudyProvider.lookupVerse(context);
    const expected=(book==='genesis'?genesis:john).filter(r=>r.chapter===ch&&r.verse===v);
    assert.equal(JSON.stringify(actual.records),JSON.stringify(expected));
    const calls=fetched.length;await realm.OriginalLanguageWordStudyProvider.lookupVerse(context);assert.equal(fetched.length,calls);
  }
  assert.equal((await realm.OriginalLanguageWordStudyProvider.lookupVerse({bookId:'isaiah',chapter:11,verse:3})).status,'unavailable');
});
