'use strict';
const {test}=require('node:test');
const assert=require('node:assert/strict');
const fs=require('node:fs'),path=require('node:path'),os=require('node:os'),crypto=require('node:crypto');
const {spawnSync}=require('node:child_process');
const c=require('../tools/original-language-config');
const imp=require('../tools/import-original-language');
const clone=x=>JSON.parse(JSON.stringify(x));
const sample=JSON.parse(fs.readFileSync(path.join(__dirname,'../data/word-study/original-language/genesis/1.json'))).records[0];
const fixture=fs.readFileSync(path.join(__dirname,'fixtures/original-language/isaiah-oshb-extract.xml'),'utf8');
function splitConfig(){
  const config=c.createBookConfig('obadiah','oshb','Obad');
  config.sourceVerseCounts=[20];
  config.referenceMapping={strategy:'identity-with-exceptions',verified:true,evidence:'Synthetic split fixture only',
    overrides:{'1:20':{chapter:1,verse:21}},
    tokenSplits:{'1:19':{tokenCount:4,segments:[{start:0,end:1,chapter:1,verse:19},{start:2,end:3,chapter:1,verse:20}]}}};
  return config;
}
function sourceRecords(){return Array.from({length:20},(_,i)=>Array.from({length:i===18?4:1},(_,tokenIndex)=>({...sample,bookId:'obadiah',chapter:1,verse:i+1,tokenIndex,surface:`source-${i+1}-${tokenIndex}`}))).flat();}

test('generic two-way split covers every Reader verse and reindexes only split destinations',()=>{
  const config=splitConfig(),source=sourceRecords(),before=clone(source);
  assert.equal(c.validateBookConfig(config),config);
  const result=imp.mapSourceRecords(source,config);
  assert.deepEqual(source,before);
  assert.equal(new Set(result.map(r=>r.verse)).size,21);
  assert.deepEqual(result.filter(r=>[19,20].includes(r.verse)).map(r=>[r.verse,r.tokenIndex,r.surface]),
    [[19,0,'source-19-0'],[19,1,'source-19-1'],[20,0,'source-19-2'],[20,1,'source-19-3']]);
  assert.deepEqual(imp.mapSourceRecords(source,config),result);
  for(const r of result) assert.deepEqual(Object.keys(r),imp.SCHEMA_FIELDS);
  assert.deepEqual(result.filter(r=>r.verse<19),source.filter(r=>r.verse<19));
});

test('explicit mappings support splits without an identity fallback',()=>{
  const config=splitConfig();config.referenceMapping.strategy='explicit';
  for(let v=1;v<=18;v++)config.referenceMapping.overrides['1:'+v]={chapter:1,verse:v};
  assert.equal(imp.mapSourceRecords(sourceRecords(),config).length,23);
  delete config.referenceMapping.overrides['1:1'];
  assert.throws(()=>c.validateBookConfig(config),/Unmapped/);
});

for(const [name,modify,pattern] of [
  ['overlap',s=>s.segments[1].start=1,/Overlapping/],
  ['gap',s=>s.segments[1].start=3,/uncovered/],
  ['trailing gap',s=>s.segments[1].end=2,/Uncovered/],
  ['negative index',s=>s.segments[0].start=-1,/Invalid/],
  ['fractional index',s=>s.segments[0].end=0.5,/Invalid/],
  ['string index',s=>s.segments[1].end='3',/Invalid/],
  ['out-of-range index',s=>s.segments[1].end=4,/Invalid/],
  ['reversed range',s=>s.segments[1].end=1,/Invalid/],
  ['bad token count',s=>s.tokenCount=3.5,/Invalid/],
  ['colliding split targets',s=>s.segments[1].verse=19,/collision/],
  ['whole-verse collision',s=>s.segments[1].verse=1,/collision/],
  ['invalid Reader target',s=>s.segments[1].verse=22,/invalid Reader/]
])test('split rejects '+name,()=>{const config=splitConfig();modify(config.referenceMapping.tokenSplits['1:19']);assert.throws(()=>c.validateBookConfig(config),pattern);});

test('split rejects overlapping whole-verse overrides/ranges, noncanonical keys and missing Reader targets',()=>{
  for(const modify of [
    m=>m.overrides['1:19']={chapter:1,verse:19},
    m=>m.ranges=[{sourceChapter:1,sourceStart:19,sourceEnd:19,readerChapter:1,readerStart:19}],
    m=>{m.tokenSplits['01:19']=m.tokenSplits['1:19'];delete m.tokenSplits['1:19'];},
    m=>delete m.tokenSplits['1:19']
  ]){const config=splitConfig();modify(config.referenceMapping);assert.throws(()=>c.validateBookConfig(config));}
});

test('actual source split tokens cannot be missing, duplicated or beyond declared bounds',()=>{
  const config=splitConfig(),source=sourceRecords();
  assert.throws(()=>imp.mapSourceRecords(source.filter(r=>r.verse!==19||r.tokenIndex!==3),config),/token count mismatch/);
  assert.throws(()=>imp.mapSourceRecords([...source,{...source.find(r=>r.verse===19),tokenIndex:4}],config),/valid source token index/);
  assert.throws(()=>imp.mapSourceRecords([...source,source.find(r=>r.verse===19)],config),/duplicate/);
  assert.throws(()=>c.mapReference(config,1,19),/valid source token index/);
  for(const index of [-1,0.5,'1',4]) assert.throws(()=>c.mapReference(config,1,19,index),/valid source token index/);
});

test('Genesis and Romans declared boundary exceptions retain their reviewed targets',()=>{
  const genesis=c.existingBookConfig('genesis'),romans=c.romansBookConfig();
  assert.equal(genesis.referenceMapping.tokenSplits,undefined);assert.equal(romans.referenceMapping.tokenSplits,undefined);
  assert.deepEqual(c.mapReference(genesis,32,1),{bookId:'genesis',chapter:31,verse:55});
  for(let v=2;v<=33;v++)assert.deepEqual(c.mapReference(genesis,32,v),{bookId:'genesis',chapter:32,verse:v-1});
  for(let v=24;v<=26;v++)assert.deepEqual(c.mapReference(romans,14,v),{bookId:'romans',chapter:16,verse:v+1});
});

test('reviewed Isaiah config covers every Reader coordinate with declared split targets',()=>{
  const config=c.isaiahBookConfig(),targets=[];
  config.sourceVerseCounts.forEach((n,i)=>{for(let v=1;v<=n;v++)targets.push(...c.sourceTargets(config,i+1,v).map(r=>r.chapter+':'+r.verse));});
  assert.equal(targets.length,1292);assert.equal(new Set(targets).size,1292);
  assert.deepEqual(c.mapReference(config,8,23),{bookId:'isaiah',chapter:9,verse:1});
  for(let v=1;v<=20;v++)assert.equal(c.mapReference(config,9,v).verse,v+1);
  for(let v=1;v<=11;v++)assert.equal(c.mapReference(config,64,v).verse,v+1);
  for(let i=0;i<16;i++)assert.deepEqual(c.mapReference(config,63,19,i),{bookId:'isaiah',chapter:i<9?63:64,verse:i<9?19:1});
  assert.equal(config.publication.enabled,false);
});

test('retained Isaiah 8/9 and 63/64 fixture words follow the reviewed boundaries',()=>{
  const config=c.isaiahBookConfig();
  for(const [ref,targetChapter,targetVerse] of [['8.23',9,1],['9.1',9,2],['64.1',64,2]]){
    const body=fixtureBody(ref),rows=imp.parseOshbGenesis('<verse osisID="Gen.1.1">'+body+'</verse>',new Map());
    const [chapter,verse]=ref.split('.').map(Number);
    assert.ok(rows.length);
    for(const r of rows)assert.deepEqual(c.mapReference(config,chapter,verse,r.tokenIndex),{bookId:'isaiah',chapter:targetChapter,verse:targetVerse});
  }
  const rows=imp.parseOshbGenesis('<verse osisID="Gen.1.1">'+fixtureBody('63.19')+'</verse>',new Map());
  assert.equal(rows.length,16);assert.equal(rows[8].surface,'עֲלֵי/הֶ֑ם');assert.equal(rows[9].surface,'לוּא');
  assert.deepEqual(rows.map(r=>c.mapReference(config,63,19,r.tokenIndex).chapter),[...Array(9).fill(63),...Array(7).fill(64)]);
});

function parserFixture(body){
  const config=c.createBookConfig('obadiah','oshb','Obad');
  config.referenceMapping={strategy:'identity',verified:true,evidence:'Synthetic fixture with retained OSHB verse body'};
  const text='<verse osisID="Obad.1.1">'+body+'</verse>'+Array.from({length:20},(_,i)=>`<verse osisID="Obad.1.${i+2}"><w lemma="1" morph="HNcmsa">א</w></verse>`).join('');
  return {config,text};
}
function fixtureBody(ref){return fixture.match(new RegExp('<verse osisID="Isa\\.'+ref.replace('.','\\.')+'"[^>]*>([\\s\\S]*?)</verse>'))[1];}

test('retained Isaiah variant note excludes only its alternate words with exact diagnostics',()=>{
  const {text,config}=parserFixture(fixtureBody('3.15'));
  const result=imp.parseConfiguredSourceDetailed(text,new Map(),config);
  const rows=result.records.filter(r=>r.verse===1);
  assert.equal(rows[0].surface,'מ/ל/כם');assert.equal(rows[0].lemma,'m/l');
  assert.equal(rows.some(r=>r.surface==='מַה'||r.surface==='לָּ/כֶם֙'),false);
  assert.deepEqual(rows.map(r=>r.tokenIndex),rows.map((_,i)=>i));
  assert.equal(result.diagnostics.excludedVariantNotes,1);assert.equal(result.diagnostics.excludedVariantWords,2);
  const excluded=result.diagnostics.excludedApparatus[0];
  assert.deepEqual(excluded.words.map(w=>w.id),['23UCh','23jZZ']);
  assert.equal(excluded.chapter,1);assert.equal(excluded.verse,1);assert.match(excluded.xml,/<rdg type="x-qere">/);
  assert.deepEqual(imp.parseConfiguredSourceDetailed(text,new Map(),config),result);
  assert.throws(()=>imp.parseConfiguredSource(text,new Map(),config),/detailed import API/);
});

test('ordinary retained Isaiah 11:3 and legacy Genesis extraction remain unchanged without notes',()=>{
  const body=fixtureBody('11.3'),{text,config}=parserFixture(body);
  const result=imp.parseConfiguredSourceDetailed(text,new Map(),config);
  assert.equal(result.records.filter(r=>r.verse===1).length,11);
  assert.equal(result.diagnostics.excludedVariantWords,0);
  const legacy=imp.parseOshbGenesis('<verse osisID="Gen.1.1">'+body+'</verse>',new Map());
  assert.deepEqual(result.records.filter(r=>r.verse===1),legacy.map(r=>({...r,bookId:'obadiah'})));
});

test('configured Genesis intentionally excludes apparatus while its historical helper preserves replay',()=>{
  const config=c.existingBookConfig('genesis');
  const note='<note type="variant"><rdg type="x-qere"><w id="test-note" lemma="2" morph="ANp">ב</w></rdg></note>';
  const text=Array.from({length:31},(_,i)=>`<verse osisID="Gen.1.${i+1}"><w lemma="1" morph="HNcmsa">א</w>${i===0?note:''}</verse>`).join('');
  const main=imp.parseConfiguredSourceDetailed(text,new Map(),config,{chapters:[1]});
  assert.equal(main.records.length,31);assert.equal(main.diagnostics.excludedVariantWords,1);
  assert.equal(imp.parseOshbGenesis(text,new Map()).length,32);
});

test('nested apparatus, self-closing notes and comment words cannot leak into the token stream',()=>{
  const body='<w lemma="1" morph="HNcmsa">א</w><note type="variant"><rdg><w lemma="2" morph="ANp">ב</w></rdg><note><w lemma="3" morph="HNcmsa">ג</w></note></note><note/><w lemma="4" morph="ANp">ד</w><!-- <w lemma="5" morph="HNcmsa">ה</w> -->';
  const {text,config}=parserFixture(body),result=imp.parseConfiguredSourceDetailed(text,new Map(),config);
  assert.deepEqual(result.records.filter(r=>r.verse===1).map(r=>[r.surface,r.language]),[['א','hebrew'],['ד','aramaic']]);
  assert.equal(result.diagnostics.excludedVariantWords,2);
  for(const broken of ['<note><w lemma="1" morph="HNcmsa">א</w>','<note></rdg>']){
    const f=parserFixture(broken);assert.throws(()=>imp.parseConfiguredSourceDetailed(f.text,new Map(),f.config),/apparatus/);
  }
  config.oshbWordPolicy='include-notes';assert.throws(()=>c.validateBookConfig(config),/word policy/);
});

test('unresolved license verification cannot become publication eligible by changing its label or enabled flag',()=>{
  for(const modify of [c=>c.publication.enabled=true,c=>{c.publication.enabled=true;c.source.lexicalSource.license='MIT';},c=>{c.publication.enabled=true;c.source.lexicalSource.verification='verified';},c=>{c.publication.enabled=true;c.source.lexicalSource.licenseVerification.status='verified';}]){
    const config=c.isaiahBookConfig();modify(config);assert.throws(()=>c.validateBookConfig(config),/verified license evidence/);
  }
  assert.throws(()=>c.assertPublicationEligible(c.isaiahBookConfig()),/disabled/);
});

test('all authoritative writer paths require publication evidence before making files',()=>{
  const directory=fs.mkdtempSync(path.join(os.tmpdir(),'god4-write-gate-'));
  try{
    const config=splitConfig(),records=imp.mapSourceRecords(sourceRecords(),config),out=path.join(directory,'blocked');
    assert.throws(()=>imp.writeStaticData(records,out),/publication-eligible/);
    assert.throws(()=>imp.writeStaticData(records,out,[config]),/disabled/);
    config.publication.enabled=true;
    assert.throws(()=>imp.writeStaticData(records,out,[config]),/verified license evidence/);
    assert.equal(fs.existsSync(out),false);
  }finally{
    assert.ok(path.resolve(directory).startsWith(path.resolve(os.tmpdir())+path.sep));fs.rmSync(directory,{recursive:true,force:true});
  }
});

test('verified synthetic input can write complete chapters; changed input hashes cannot',()=>{
  const directory=fs.mkdtempSync(path.join(os.tmpdir(),'god4-verified-write-'));
  try{
    const config=c.createBookConfig('obadiah','oshb','Obad');
    config.referenceMapping={strategy:'identity',verified:true,evidence:'Synthetic test coordinates'};
    const text=Array.from({length:21},(_,i)=>`<verse osisID="Obad.1.${i+1}"><w lemma="1" morph="HNcmsa">א</w></verse>`).join('');
    const lexical='\\00001\\synthetic definition$$T',sha=b=>crypto.createHash('sha256').update(b).digest('hex');
    for(const [component,input] of [[config.source,text],[config.source.lexicalSource,lexical],[config.source.textSource,text]])Object.assign(component,{
      artifact:'synthetic-fixture',revision:'synthetic-test-only',sha256:sha(input),license:'Synthetic test fixture',
      licenseVerification:{status:'verified',evidence:'Synthetic test fixture created in this unit test'}});
    config.publication.enabled=true;
    assert.equal(c.validateBookConfig(config),config);
    for(const component of ['source','lexicalSource','textSource'])for(const field of ['artifact','revision','sha256','licenseVerification']){
      const broken=clone(config),target=component==='source'?broken.source:broken.source[component];
      delete target[field];assert.throws(()=>c.validateBookConfig(broken),/provenance|verified license evidence/);
    }
    const result=imp.generateConfiguredSourceDetailed(text,lexical,config);
    imp.writeStaticData(result.records,directory,[config]);
    assert.equal(JSON.parse(fs.readFileSync(path.join(directory,'obadiah/1.json'))).records.length,21);
    assert.throws(()=>imp.generateConfiguredSourceDetailed(text+' ',lexical,config),/SHA-256/);
    assert.throws(()=>imp.generateConfiguredSourceDetailed(text,lexical+' ',config),/SHA-256/);
    const configPath=path.join(directory,'config.json'),sourcePath=path.join(directory,'source.xml'),lexPath=path.join(directory,'lex.dat');
    config.publication.enabled=false;
    fs.writeFileSync(configPath,JSON.stringify(config));fs.writeFileSync(sourcePath,text);fs.writeFileSync(lexPath,lexical);
    const out=path.join(directory,'cli-blocked');
    const run=spawnSync(process.execPath,['tools/import-original-language.js','--config',configPath,'--source',sourcePath,'--lexicon',lexPath,'--output',out],{cwd:path.join(__dirname,'..'),encoding:'utf8'});
    assert.notEqual(run.status,0);assert.match(run.stderr,/disabled/);assert.equal(fs.existsSync(out),false);
  }finally{
    assert.ok(path.resolve(directory).startsWith(path.resolve(os.tmpdir())+path.sep));fs.rmSync(directory,{recursive:true,force:true});
  }
});
