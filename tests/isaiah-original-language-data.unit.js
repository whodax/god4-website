'use strict';
const {test}=require('node:test'),assert=require('node:assert/strict');
const fs=require('node:fs'),path=require('node:path'),os=require('node:os'),crypto=require('node:crypto');
const {execFileSync}=require('node:child_process');
const {SCHEMA_FIELDS,normalizeRecords}=require('../tools/import-original-language');
const {isaiahBookConfig,readerBook}=require('../tools/original-language-config');
const {loadReviewLexicon}=require('../tools/strong-hebrew-xml-lexicon');
const {validateLocalIsaiah,defaultSourceRoot}=require('../tools/validate-isaiah-original-language');
const {stageIsaiah,verifyCandidate,publishIsaiah}=require('../tools/publish-isaiah-original-language');
const root=path.resolve(__dirname,'..'),sourceRoot=process.env.GOD4_ORIGINAL_LANGUAGE_SOURCES||defaultSourceRoot;
const directory=process.env.GOD4_ISAIAH_CANDIDATE||path.join(root,'data/word-study/original-language/isaiah');
const manifest=JSON.parse(fs.readFileSync(path.join(root,'docs/isaiah-original-language-publication-manifest.json')));
const chapters=manifest.chapters.map(c=>({...c,bytes:fs.readFileSync(path.join(directory,c.chapter+'.json'))}));
const records=chapters.flatMap(c=>JSON.parse(c.bytes).records),verse=(ch,v)=>records.filter(r=>r.chapter===ch&&r.verse===v);
const sha=bytes=>crypto.createHash('sha256').update(bytes).digest('hex');
const localAvailable=['morphhb/wlc/Isa.xml','strongs/hebrew/StrongHebrewG.xml'].every(p=>fs.existsSync(path.join(sourceRoot,p)));
const skip=localAvailable?false:'Pinned local OSHB and Hebrew XML required; no downloads or DAT fallback';
function protectedBytes(){return Object.fromEntries(['genesis','john','romans'].flatMap(book=>fs.readdirSync(path.join(root,'data/word-study/original-language',book)).map(file=>[book+'/'+file,sha(fs.readFileSync(path.join(root,'data/word-study/original-language',book,file)))])));}

test('exactly 66 ordered Isaiah chapter files match every manifest byte count and SHA-256',()=>{
  assert.deepEqual(manifest.chapters.map(c=>c.chapter),Array.from({length:66},(_,i)=>i+1));
  assert.deepEqual(fs.readdirSync(directory).sort(),chapters.map(c=>c.chapter+'.json').sort());
  for(const c of chapters){
    const rows=JSON.parse(c.bytes).records;
    assert.equal(c.bytes.length,c.byteSize);assert.equal(sha(c.bytes),c.sha256);
    assert.equal(rows.length,c.recordCount);assert.equal(new Set(rows.map(r=>r.verse)).size,c.verseCount);
  }
  assert.equal(records.length,16932);assert.equal(chapters.reduce((n,c)=>n+c.bytes.length,0),manifest.totals.bytes);
  assert.equal(manifest.lexicalStrategy,'strongs-hebrew-xml-subset');
  assert.equal(manifest.lexicalSource.artifact,'hebrew/StrongHebrewG.xml');
  assert.doesNotMatch(manifest.attribution,/DAT|Grier|MIT/);
});
test('all 1292 canonical Reader coordinates have contiguous unique tokens, without extras',()=>{
  const expected=[],reader=readerBook('isaiah');
  for(let ch=1;ch<=66;ch++)for(let v=1;v<=reader[ch].verses.length;v++){
    expected.push(ch+':'+v);const rows=verse(ch,v);assert.ok(rows.length);
    assert.deepEqual(rows.map(r=>r.tokenIndex),rows.map((_,i)=>i));
  }
  assert.equal(expected.length,1292);
  assert.deepEqual([...new Set(records.map(r=>r.chapter+':'+r.verse))],expected);
  assert.deepEqual(normalizeRecords(records),records);
});
test('authoritative 15-field records retain attribution, language classification and populated lexical values',()=>{
  const config=isaiahBookConfig();let hebrew=0,aramaic=0,withoutId=0;
  for(const r of records){
    assert.deepEqual(Object.keys(r),SCHEMA_FIELDS);assert.equal(r.bookId,'isaiah');assert.equal(r.status,'authoritative');
    assert.equal(r.source,config.source.attribution);assert.equal(r.partOfSpeech,null);
    for(const f of ['surface','lemma','morphology'])assert.ok(r[f].trim());
    assert.equal(r.language,r.morphology[0]==='A'?'aramaic':'hebrew');
    if(r.language==='hebrew')hebrew++;else aramaic++;
    if(r.strongsNumber){assert.match(r.strongsNumber,/^H[1-9]\d*$/);for(const f of ['lemma','transliteration','pronunciation','definition'])assert.ok(r[f]?.trim());}
    else {withoutId++;for(const f of ['transliteration','pronunciation','definition'])assert.equal(r[f],null);}
  }
  assert.deepEqual({hebrew,aramaic,withoutId},{hebrew:16932,aramaic:0,withoutId:310});
});
test('every numeric Strong join matches only the pinned reviewed five-field XML subset',{skip},()=>{
  const lexicon=loadReviewLexicon(path.join(sourceRoot,'strongs/hebrew/StrongHebrewG.xml')).entries,ids=new Set();
  for(const r of records)if(r.strongsNumber){ids.add(r.strongsNumber);assert.ok(lexicon.has(r.strongsNumber));for(const f of ['strongsNumber','lemma','transliteration','pronunciation','definition'])assert.equal(r[f],lexicon.get(r.strongsNumber)[f]);}
  assert.equal(ids.size,2443);
});
test('apparatus policy excludes 53 blocks/56 words and preserves the 63:19 / 64:1 running-token split',{skip},()=>{
  const dry=validateLocalIsaiah(sourceRoot);
  assert.equal(dry.diagnostics.excludedApparatus.length,53);
  assert.equal(dry.diagnostics.excludedApparatus.reduce((n,a)=>n+a.words.length,0),56);
  assert.equal(verse(63,19).length,9);assert.equal(verse(63,19).at(-1).surface,'עֲלֵי/הֶ֑ם');
  assert.equal(verse(64,1).length,7);assert.equal(verse(64,1)[0].surface,'לוּא');
  assert.equal(verse(64,1)[0].tokenIndex,0);
  assert.equal(verse(3,15)[0].surface,'מ/ל/כם');
  assert.equal(verse(3,15).some(r=>['מַה','לָּ/כֶם֙'].includes(r.surface)),false);
  assert.equal(verse(11,3).length,11);assert.equal(records.filter(r=>r.chapter===53).length,166);
});
test('fresh independent stages reproduce all publication bytes and tampering blocks copying',{skip},()=>{
  const temporary=fs.mkdtempSync(path.join(os.tmpdir(),'god4-isaiah-candidate-')),before=protectedBytes();
  try{
    const staging=path.join(temporary,'fresh'),output=path.join(temporary,'publication');
    const generated=stageIsaiah(staging,sourceRoot);assert.deepEqual(generated,manifest);
    assert.throws(()=>stageIsaiah(staging,sourceRoot),/fresh/);
    for(const c of chapters)for(const run of ['run-1','run-2'])assert.ok(fs.readFileSync(path.join(staging,run,'isaiah',c.chapter+'.json')).equals(c.bytes));
    const damaged=path.join(staging,'run-2/isaiah/64.json'),original=fs.readFileSync(damaged);
    fs.appendFileSync(damaged,' ');assert.throws(()=>publishIsaiah(staging,sourceRoot,output),/bytes mismatch/);
    assert.equal(fs.existsSync(output),false);fs.writeFileSync(damaged,original);
    assert.deepEqual(verifyCandidate(staging,sourceRoot).manifest,manifest);
    assert.deepEqual(publishIsaiah(staging,sourceRoot,output),manifest);
    for(const c of chapters)assert.ok(fs.readFileSync(path.join(output,'isaiah',c.chapter+'.json')).equals(c.bytes));
    assert.throws(()=>publishIsaiah(staging,sourceRoot,output),/overwrite/);
    assert.deepEqual(protectedBytes(),before);
  }finally{assert.ok(path.resolve(temporary).startsWith(path.resolve(os.tmpdir())+path.sep));fs.rmSync(temporary,{recursive:true,force:true});}
});
test('all 87 Genesis/John/Romans shards remain unchanged from the reviewed adapter baseline',()=>{
  assert.equal(Object.keys(protectedBytes()).length,87);
  const changed=execFileSync('git',['diff','--name-only','c61fbafcf9823f7c472f7d05dfed4bd35a7e7113','--',...['genesis','john','romans'].map(b=>'data/word-study/original-language/'+b)],{cwd:root,encoding:'utf8'});
  assert.equal(changed,'');
});
