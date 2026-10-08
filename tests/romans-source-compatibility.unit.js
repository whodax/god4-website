'use strict';
const {test}=require('node:test');
const assert=require('node:assert/strict');
const fs=require('fs'),path=require('path');
const imp=require('../tools/import-original-language');
const cfg=require('../tools/original-language-config');
const config=cfg.romansBookConfig();
const clone=v=>JSON.parse(JSON.stringify(v));
const lexicon=new Map([['G3956',{lemma:'πᾶς',transliteration:'pâs',definition:'all'}],['G1722',{lemma:'ἐν',transliteration:'en',definition:'in'}]]);
function syntheticBook(alternate=true){
  return config.sourceVerseCounts.flatMap((n,i)=>Array.from({length:n},(_,v)=>(i+1)+','+(v+1)+','+(alternate&&i===7&&v===27?'παντα 3956 {A-APN} 3956 {A-NPN}':'εν 1722 {PREP}'))).join('\n');
}

test('Romans config captures exact canonical/source identity and pinned artifacts',()=>{
  assert.equal(cfg.validateBookConfig(config),config);
  assert.equal(config.sourceBookId,'ROM');assert.equal(config.bookId,'romans');assert.equal(config.readerBookId,'romans');
  assert.equal(config.chapterCount,16);assert.equal(config.testament,'NT');assert.equal(config.morphologyFormat,'Robinson');
  assert.equal(config.source.revision,'27a45ff1b7be6c17ccbfeac414f3f55732ae8e28');
  assert.equal(config.source.version,'v3.3.2');assert.equal(config.source.date,'2024-12-31');
  assert.equal(config.source.lexicalSource.revision,'0acd2f251c2d35ff8db2dece4e0593979d3ac223');
  assert.equal(config.source.lexicalSource.version,'1.4');assert.equal(config.source.lexicalSource.date,'2007-09-14');
  assert.equal(config.source.lexicalSource.license,'public domain');assert.match(config.source.lexicalSource.copyingNotice,/Copy Freely/);
  assert.doesNotMatch(config.source.attribution,/Ruter|MIT/);
});

test('alternate analyses describe one παντα token with ordered complete analyses',()=>{
  const ts=imp.parseByzantineTokens('παντα 3956 {A-APN} 3956 {A-NPN} εν 1722 {PREP}');
  assert.equal(ts.length,2);assert.equal(ts[0].surface,'παντα');
  assert.deepEqual(ts[0].analyses,[{strongsNumber:'G3956',morphology:'A-APN'},{strongsNumber:'G3956',morphology:'A-NPN'}]);
});

test('malformed alternate analyses and detached tokens are rejected strictly',()=>{
  for(const text of ['παντα 3956 {A-APN} 3956','παντα 3956 {A-APN} {A-NPN}','παντα 3956 {A-APN} 3956 {}','παντα 3956 {A-APN} 3956 {A-}','παντα 3956 {A-APN} 3956 {A-NPN} junk','3956 3956 {A-NPN}','παντα 3956 {A-APN}εν 1722 {PREP}','παντα 3956 {A-APN} 3956 {A-APN}']) assert.throws(()=>imp.parseByzantineTokens(text));
});

test('Romans 8:28 uses primary morphology and retains its alternate outside the schema',()=>{
  const result=imp.parseConfiguredSourceDetailed(syntheticBook(),lexicon,config);
  const row=result.records.find(r=>r.chapter===8&&r.verse===28);
  assert.equal(row.surface,'παντα');assert.equal(row.morphology,'A-APN');assert.equal(row.strongsNumber,'G3956');
  assert.deepEqual(Object.keys(row),imp.SCHEMA_FIELDS);
  assert.deepEqual(result.diagnostics.alternateAnalyses,[{sourceBookId:'ROM',chapter:8,verse:28,tokenIndex:0,surface:'παντα',primary:{strongsNumber:'G3956',morphology:'A-APN'},alternates:[{strongsNumber:'G3956',morphology:'A-NPN'}]}]);
  assert.equal(result.diagnostics.serializationPolicy,'first-source-analysis');
});

test('record-only APIs cannot silently discard alternate diagnostics',()=>{
  assert.throws(()=>imp.parseConfiguredSource(syntheticBook(),lexicon,config),/detailed import API/);
  const c=clone(config);delete c.alternateAnalysisPolicy;
  assert.throws(()=>imp.parseConfiguredSourceDetailed(syntheticBook(),lexicon,c),/explicit policy/);
});

test('historical Greek extraction preserves primary records and warns with nonserialized diagnostics',()=>{
  const warning=process.emitWarning,notices=[];
  process.emitWarning=message=>notices.push(message);
  try{
    const rs=imp.parseByzantineJohn('1,1,παντα 3956 {A-APN} 3956 {A-NPN}',lexicon);
    assert.equal(rs.length,1);assert.equal(rs[0].morphology,'A-APN');assert.deepEqual(Object.keys(rs[0]),imp.SCHEMA_FIELDS);
    assert.equal(rs.importDiagnostics.alternateAnalyses[0].alternates[0].morphology,'A-NPN');
    assert.doesNotMatch(JSON.stringify(rs),/alternateAnalyses/);assert.equal(notices.length,1);
  }finally{process.emitWarning=warning;}
});

test('all alternative lexical identifiers must resolve',()=>{
  const text=syntheticBook().replace('3956 {A-NPN}','99999 {A-NPN}');
  assert.throws(()=>imp.parseConfiguredSourceDetailed(text,lexicon,config),/lexical join/);
});

for(const [source,target]of [[24,25],[25,26],[26,27]])test('Romans doxology 14:'+source+' maps to 16:'+target,()=>{
  assert.deepEqual(cfg.mapReference(config,14,source),{bookId:'romans',chapter:16,verse:target});
});

test('unaffected references including 14:23 and 16:24 remain identity-mapped',()=>{
  for(const [ch,v]of [[1,1],[8,28],[14,23],[16,24]])assert.deepEqual(cfg.mapReference(config,ch,v),{bookId:'romans',chapter:ch,verse:v});
});

test('full 433 verse mapping has exact coverage and preserves within-verse ordering',()=>{
  const result=imp.parseConfiguredSourceDetailed(syntheticBook(),lexicon,config),refs=new Set(result.records.map(r=>r.chapter+':'+r.verse));
  assert.equal(refs.size,433);assert.equal(result.records.length,433);
  assert.equal(result.records.filter(r=>r.chapter===14).length,23);assert.equal(result.records.filter(r=>r.chapter===16).length,27);
  const reader=cfg.readerBook('romans');for(let ch=1;ch<=16;ch++)for(let v=1;v<=reader[ch].verses.length;v++)assert.ok(refs.has(ch+':'+v));
  assert.equal(result.records.every(r=>r.tokenIndex===0&&r.definition&&r.transliteration&&r.morphology&&r.source),true);
});

test('mapping collisions and duplicate targets cannot pass validation',()=>{
  const c=clone(config);c.referenceMapping.overrides={'16:24':{chapter:16,verse:25}};assert.throws(()=>cfg.validateBookConfig(c),/collision/);
  const d=clone(config);d.referenceMapping.ranges.push({...d.referenceMapping.ranges[0]});assert.throws(()=>cfg.validateBookConfig(d),/Overlapping/);
});

test('invalid alternate policies and missing provenance are rejected',()=>{
  const c=clone(config);c.alternateAnalysisPolicy='guess-best';assert.throws(()=>cfg.validateBookConfig(c),/policy/);
  const d=clone(config);delete d.source.lexicalSource.revision;assert.throws(()=>cfg.validateBookConfig(d),/provenance/);
});

const sourceRoot=process.env.GOD4_ORIGINAL_LANGUAGE_SOURCES||'C:/Users/whoda/OneDrive/Documents/GOD4-OriginalLanguage-Sources';
const csvPath=path.join(sourceRoot,'byzantine-majority-text/csv-unicode/strongs/with-parsing/ROM.csv');
const bpPath=path.join(sourceRoot,'byzantine-majority-text/source/Strongs/06_ROM.BP5');
const xmlPath=path.join(sourceRoot,'strongs/greek/StrongsGreekDictionaryXML_1.4/strongsgreek.xml');
test('complete verified local Romans inputs pass in-memory generation and BP5 cross-check',{skip:![csvPath,bpPath,xmlPath].every(p=>fs.existsSync(p))},()=>{
  const csv=fs.readFileSync(csvPath,'utf8'),beta=fs.readFileSync(bpPath,'utf8');
  const result=imp.generateConfiguredSourceDetailed(csv,fs.readFileSync(xmlPath,'utf8'),config);
  const rs=result.records;assert.equal(rs.length,7210);assert.equal(new Set(rs.map(r=>r.chapter)).size,16);assert.equal(new Set(rs.map(r=>r.chapter+':'+r.verse)).size,433);
  assert.deepEqual(imp.normalizeRecords(rs),rs);assert.equal(rs.every(r=>r.definition&&r.transliteration&&r.lemma&&r.morphology&&r.source),true);
  const groups=new Map();for(const r of rs){const k=r.chapter+':'+r.verse;if(!groups.has(k))groups.set(k,[]);groups.get(k).push(r);}
  const betaRows=new Map(beta.split(/\r?\n/).flatMap(line=>{const m=line.match(/^(\d+)\.(\d+)\s+(.*)$/);return m?[[Number(m[1])+':'+Number(m[2]),m[3]]]:[];}));
  let sourceTokenCount=0;
  for(const line of csv.split(/\r?\n/)){
    const m=line.match(/^(\d+),(\d+),(.*)$/);if(!m)continue;
    const ch=+m[1],v=+m[2],target=cfg.mapReference(config,ch,v),raw=imp.parseByzantineTokens(m[3]);
    sourceTokenCount+=raw.length;assert.deepEqual(groups.get(target.chapter+':'+target.verse).map(r=>r.surface),raw.map(t=>t.surface));
    const analysisPairs=text=>(text.match(/\d+\s+\{[A-Z0-9-]+\}/g)||[]).map(p=>p.replace(/\s+/g,' '));
    assert.deepEqual(analysisPairs(m[3]),analysisPairs(betaRows.get(ch+':'+v)));
  }
  assert.equal(sourceTokenCount,7210);assert.equal(result.diagnostics.alternateAnalyses.length,1);
  assert.equal(result.diagnostics.alternateAnalyses[0].surface,'παντα');assert.equal(result.diagnostics.alternateAnalyses[0].tokenIndex,7);
  const p=groups.get('8:28').filter(r=>r.surface==='παντα');assert.equal(p.length,1);assert.equal(p[0].morphology,'A-APN');
  for(const [source,target]of [[24,25],[25,26],[26,27]]){
    assert.match(betaRows.get('14:'+source),source===24?/^tw /:source===25?/^fanerwqentos /:/^monw /);
    assert.equal(groups.get('16:'+target)[0].surface,source===24?'τω':source===25?'φανερωθεντος':'μονω');
  }
});
