'use strict';
const {test}=require('node:test');
const assert=require('node:assert/strict');
const fs=require('node:fs'),path=require('node:path'),crypto=require('node:crypto');
const {execFileSync}=require('node:child_process');
const os=require('node:os');
const {compareLocalIsaiah,serializeComparison,historicalDatConfig}=require('../tools/compare-isaiah-lexical-sources');
const imp=require('../tools/import-original-language');
const {isaiahBookConfig,readerBook}=require('../tools/original-language-config');
const {validateIsaiahText,validateLocalIsaiah,defaultSourceRoot}=require('../tools/validate-isaiah-original-language');
const root=path.resolve(__dirname,'..');
const sourceRoot=process.env.GOD4_ORIGINAL_LANGUAGE_SOURCES||defaultSourceRoot;
const sourcePath=path.join(sourceRoot,'morphhb/wlc/Isa.xml'),lexicalPath=path.join(sourceRoot,'strongs/hebrew/StrongHebrewG.xml');
const localAvailable=[sourcePath,lexicalPath].every(p=>fs.existsSync(p));
const skip=localAvailable?false:'Pinned local OSHB Isaiah and Hebrew XML required; no network fallback';
const sha=bytes=>crypto.createHash('sha256').update(bytes).digest('hex');
function existingBytes(){
  return Object.fromEntries(['genesis','john','romans'].flatMap(book=>{
    const directory=path.join(root,'data/word-study/original-language',book);
    return fs.readdirSync(directory).map(file=>[book+'/'+file,sha(fs.readFileSync(path.join(directory,file)))]);
  }));
}

test('retained XML blocks match the selected source without Unicode normalization',{skip},()=>{
  const extract=fs.readFileSync(path.join(__dirname,'fixtures/original-language/isaiah-oshb-extract.xml'),'utf8');
  const source=fs.readFileSync(sourcePath,'utf8');
  let count=0;
  for(const m of extract.matchAll(/<verse\s+osisID="([^"]+)"[^>]*>[\s\S]*?<\/verse>/g)){
    const original=[...source.matchAll(/<verse\s+osisID="([^"]+)"[^>]*>[\s\S]*?<\/verse>/g)].find(v=>v[1]===m[1]);
    assert.ok(original);assert.equal(m[0].replace(/\r\n/g,'\n'),original[0].replace(/\r\n/g,'\n'));count++;
  }
  assert.equal(count,7);
});

test('full pinned Isaiah dry validation is deterministic, complete and read-only',{skip},()=>{
  const before=existingBytes(),production=path.join(root,'data/word-study/original-language/isaiah');
  assert.equal(Object.keys(before).length,87);
  assert.equal(fs.existsSync(production),false);
  const result=validateLocalIsaiah(sourceRoot);
  assert.deepEqual(validateLocalIsaiah(sourceRoot),result);
  assert.deepEqual(result.summary,{
    publicationEligible:false,sourceChapters:66,sourceVerses:1291,readerChapters:66,readerVerses:1292,tokens:16932,
    hebrew:16932,aramaic:0,excludedVariantNotes:53,excludedVariantWords:56,numericStrongsJoinFailures:0,wordsWithoutNumericStrongs:310,distinctNumericStrongs:2443,missingSelectedLexicalFields:0,
    sourceSha256:'ce039243b56e4de55b85a635f17343fe9cac7176123fbde5f72af623f9c8f0a5',
    lexicalSha256:'f5a0258d39e9ae37edab27feba5301ff7db540a424e28a41a7af57b8ba5058f2',
    inlineKjvAnnotations:33,splitSourceVerse:'63:19',splitReaderVerses:{'63:19':9,'64:1':7},
    blocker:'Publication disabled pending separate publication-candidate milestone.'
  });
  assert.equal(result.diagnostics.excludedApparatus.reduce((n,v)=>n+v.words.length,0),56);
  assert.deepEqual(existingBytes(),before);
  assert.equal(fs.existsSync(production),false);
  const changed=execFileSync('git',['diff','--name-only','db5d46a5d39b54b20d11c5ee501420bcf59b6376','--','data/word-study/original-language'],{cwd:root,encoding:'utf8'});
  assert.equal(changed,'');
});

test('all Reader verses have contiguous running tokens, exact fields, joins and attribution',{skip},()=>{
  const config=isaiahBookConfig(),text=fs.readFileSync(sourcePath,'utf8'),lexical=fs.readFileSync(lexicalPath,'utf8');
  const result=imp.generateConfiguredSourceDetailed(text,lexical,config);
  assert.deepEqual(imp.generateConfiguredSourceDetailed(text,lexical,config),result);
  const groups=new Map();
  for(const r of result.records){
    const key=r.chapter+':'+r.verse;if(!groups.has(key))groups.set(key,[]);groups.get(key).push(r);
    assert.deepEqual(Object.keys(r),imp.SCHEMA_FIELDS);assert.equal(r.source,config.source.attribution);
    assert.equal(r.language,'hebrew');assert.equal(r.morphology[0],'H');
    if(r.strongsNumber)assert.ok(r.definition);
  }
  const reader=readerBook('isaiah');
  for(let ch=1;ch<=66;ch++)for(let v=1;v<=reader[ch].verses.length;v++){
    const rows=groups.get(ch+':'+v);assert.ok(rows?.length);
    assert.deepEqual(rows.map(r=>r.tokenIndex),rows.map((_,i)=>i));
  }
  assert.equal(groups.size,1292);
  assert.equal(groups.get('11:3').length,11);
  assert.equal(groups.get('11:3')[0].surface,'וַ/הֲרִיח֖/וֹ');
  assert.equal(result.records.filter(r=>r.chapter===53).length,166);
  assert.equal([...groups.keys()].filter(k=>k.startsWith('53:')).length,12);
  assert.equal(groups.get('63:19').at(-1).surface,'עֲלֵי/הֶ֑ם');
  assert.equal(groups.get('64:1')[0].surface,'לוּא');
  assert.equal(groups.get('64:1')[0].tokenIndex,0);
  assert.deepEqual(imp.normalizeRecords(result.records),result.records);
});

test('changed source/lexical bytes fail closed before parsing',{skip},()=>{
  const text=fs.readFileSync(sourcePath,'utf8'),lexical=fs.readFileSync(lexicalPath,'utf8');
  assert.throws(()=>validateIsaiahText(text+' ',lexical),/source SHA-256/);
  assert.throws(()=>validateIsaiahText(text,lexical+' '),/XML SHA-256/);
});

test('reviewed XML provenance is explicit and all Isaiah writes remain blocked',{skip},()=>{
  const config=isaiahBookConfig();
  assert.equal(config.lexicalJoinStrategy,'strongs-hebrew-xml-subset');
  assert.equal(config.source.lexicalSource.fieldProvenance.status,'verified');
  assert.equal(config.source.lexicalSource.licenseVerification.status,'verified');
  assert.equal(config.publication.enabled,false);
  assert.doesNotMatch(config.source.attribution,/Grier|corrected Hebrew DAT|MIT/);
  const dir=fs.mkdtempSync(path.join(os.tmpdir(),'god4-isaiah-publication-block-'));
  try{
    const input=fs.readFileSync(sourcePath,'utf8'),xml=fs.readFileSync(lexicalPath,'utf8');
    const {records}=imp.generateConfiguredSourceDetailed(input,xml,config);
    const out=path.join(dir,'blocked');
    assert.throws(()=>imp.writeStaticData(records,out,[config]),/disabled/);
    assert.equal(fs.existsSync(out),false);
  }finally{fs.rmSync(dir,{recursive:true,force:true});}
});
test('normal XML dry validation never requires or falls back to historical DAT',{skip},()=>{
  const dir=fs.mkdtempSync(path.join(os.tmpdir(),'god4-xml-only-'));
  try{
    fs.mkdirSync(path.join(dir,'morphhb/wlc'),{recursive:true});fs.mkdirSync(path.join(dir,'strongs/hebrew'),{recursive:true});
    fs.copyFileSync(sourcePath,path.join(dir,'morphhb/wlc/Isa.xml'));
    fs.copyFileSync(lexicalPath,path.join(dir,'strongs/hebrew/StrongHebrewG.xml'));
    assert.equal(validateLocalIsaiah(dir).summary.tokens,16932);
    const datOnly=path.join(dir,'dat-only');
    fs.mkdirSync(path.join(datOnly,'morphhb/wlc'),{recursive:true});fs.mkdirSync(path.join(datOnly,'strongs/hebrew'),{recursive:true});
    fs.copyFileSync(sourcePath,path.join(datOnly,'morphhb/wlc/Isa.xml'));
    fs.writeFileSync(path.join(datOnly,'strongs/hebrew/strongshebrew.dat'),'\\00001\\synthetic DAT, never selected$$T');
    assert.throws(()=>validateLocalIsaiah(datOnly),/StrongHebrewG.xml/);
  }finally{fs.rmSync(dir,{recursive:true,force:true});}
});
const historicalAvailable=localAvailable && fs.existsSync(path.join(sourceRoot,'strongs/hebrew/strongshebrew.dat'));
test('complete lexical comparison report reproduces exact bytes and exposes every definition difference',{skip:historicalAvailable?false:'Pinned local historical DAT also required; no fallback'},()=>{
  const before=existingBytes(),report=compareLocalIsaiah(sourceRoot),bytes=serializeComparison(report);
  assert.deepEqual(JSON.parse(bytes),report);
  assert.equal(serializeComparison(compareLocalIsaiah(sourceRoot)),bytes);
  assert.equal(bytes,fs.readFileSync(path.join(root,'docs/isaiah-lexical-comparison.json'),'utf8').replace(/\r\n/g,'\n'));
  assert.deepEqual(report.fieldChanges,{lemma:16622,transliteration:16622,pronunciation:16622,definition:16622,source:16932});
  assert.equal(report.distinctDefinitionsCompared,2443);assert.equal(report.distinctDefinitionsDifferent,2443);
  assert.equal(report.unchangedNonlexicalFieldValues,169320);
  assert.equal(report.definitions.reduce((n,r)=>n+r[1],0),16622);
  assert.equal(new Set(report.definitions.map(r=>r[0])).size,2443);
  assert.ok(report.definitions.every(r=>r[2]!==r[3] && /^[a-f0-9]{64}$/.test(r[2]) && /^[a-f0-9]{64}$/.test(r[3])));
  const replay=historicalDatConfig();assert.equal(replay.publication.enabled,false);
  assert.equal(replay.source.lexicalSource.licenseVerification.status,'unresolved');
  assert.deepEqual(existingBytes(),before);
});

test('publication-disabled Isaiah stays unavailable to the unchanged runtime provider',async()=>{
  const vm=require('node:vm'),urls=[];
  const realm=vm.createContext({fetch:async url=>{urls.push(url);return {ok:false};}});
  vm.runInContext(fs.readFileSync(path.join(root,'js/word-study/original-language-provider.js'),'utf8'),realm);
  const result=await realm.OriginalLanguageWordStudyProvider.lookupVerse({bookId:'isaiah',chapter:11,verse:3});
  assert.equal(result.status,'unavailable');
  assert.deepEqual(urls,['data/word-study/original-language/isaiah/11.json']);
  assert.equal(fs.existsSync(path.join(root,urls[0])),false);
});
