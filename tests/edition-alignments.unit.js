'use strict';

const {test}=require('node:test');
const assert=require('node:assert/strict');
const fs=require('node:fs');
const path=require('node:path');
const vm=require('node:vm');
const {createHash}=require('node:crypto');
const {TRANSLATIONS,loadBibleLibrary,READER_TOKEN_PATTERN}=require('../tools/audit-word-study-coverage');
const {provider}=require('../tools/import-web-alignment');
const {choose,validGroups}=require('../tools/import-edition-alignments');
const {ignoreTransparentMarkup}=require('../tools/audit-kjv-residual');
const report=require('../docs/shell-83-edition-publication.json');
const frozen=require('../docs/shell-81-web-review-v1.json');
const root=path.resolve(__dirname,'..');
const base='data/word-study/alignment/editions/';
const read=file=>fs.readFileSync(path.join(root,file));
const hash=bytes=>createHash('sha256').update(bytes).digest('hex');

function runtime(){
  const realm=vm.createContext({AbortController,setTimeout,clearTimeout,async fetch(url){
    const data=read(url.replace(/^\//,''));
    return {ok:true,json:async()=>JSON.parse(data)};
  }});
  vm.runInContext(read('js/word-study/alignment.js').toString('utf8'),realm);
  return realm.WordStudyAlignment;
}

test('all edition plans reuse checked witnesses without changing English or entering held-out passages',async()=>{
  const bible=Object.fromEntries(TRANSLATIONS.concat({id:'dra',file:'dra.js',variable:'draLibrary'})
    .map(({id,file,variable})=>[id,loadBibleLibrary(file,variable)]));
  const acceptedWeb=require('../docs/shell-80-web-alignment-report.json');
  const acceptedKjv=require('../docs/shell-76-crosswire-import.json');
  const alternate=require('../docs/shell-82-kjv-tr-publication.json');
  const index=JSON.parse(read(base+'index.json')), lookup=provider(),engine=runtime();
  const protectedRefs=new Set(frozen.holdout.flatMap(row=>[row.passage.coordinate,...row.tokens.map(token=>
    [token.bookId,token.chapter,token.verse].join(':'))]));
  const byEdition={};
  let total=0,words=0;
  for(const [file,pin] of Object.entries(report.files)){
    const bytes=read(base+file);
    assert.equal(hash(bytes),pin.sha256,file);
    if(file==='index.json') continue;
    const [bookId,chapterId]=file.slice(0,-5).split('/');
    const chapter=Number(chapterId), plans=JSON.parse(bytes);
    for(const [translationId,rows] of Object.entries(plans)){
      for(const [verseId,[origin,mode,text,groups]] of Object.entries(rows)){
        const verse=Number(verseId), verseText=bible[translationId][bookId][chapter].verses[verse-1];
        const ref=[bookId,chapter,verse].join(':');
        assert.ok(!protectedRefs.has(ref));
        assert.ok(index[translationId][bookId][chapter].includes(verse));
        assert.notEqual(origin,translationId);
        if(translationId==='web'||translationId==='kjv'){
          const pins=translationId==='web'?acceptedWeb.files:acceptedKjv.files;
          if(pins[file]) assert.ok(!JSON.parse(read('data/word-study/alignment/'+translationId+'/'+file))[verse]);
          if(translationId==='kjv'&&alternate.files[file])
            assert.ok(!JSON.parse(read('data/word-study/alignment/kjv-tr/'+file)).verses[verse]);
        }
        if(mode!=='exact') assert.equal(text,verseText);
        const context={translationId,bookId,chapter,verse,verseText};
        const {records}=await lookup.lookupVerse(context);
        for(const token of records) assert.ok(!protectedRefs.has([token.bookId,token.chapter,token.verse].join(':')));
        const result=await engine.lookupEdition(context,records);
        assert.equal(result?.status,'available',translationId+' '+ref);
        assert.ok(result.source.editionPlan);
        const spans=result.groups.flatMap(group=>group.english);
        words += [...verseText.matchAll(READER_TOKEN_PATTERN)].filter(word=>spans.some(span=>
          span.start<=word.index&&span.end>=word.index+word[0].length)).length;
        if(!total){
          assert.equal(await engine.lookupEdition({...context,verseText:verseText+' changed'},records),null);
          const corrupted=records.map((record,index)=>index?record:{...record,morphology:'wrong'});
          assert.equal(await engine.lookupEdition(context,corrupted),null);
        }
        byEdition[translationId]=(byEdition[translationId]||0)+1;
        total++;
      }
    }
  }
  assert.equal(total,2348);
  assert.equal(words,32959);
  assert.deepEqual(byEdition,Object.fromEntries(Object.entries(report.published).map(([id,s])=>[id,s.verses])));
  assert.deepEqual(report.newPriority,{});
});

test('edition adapter requires an exact contextual frame and excludes editorial markup',()=>{
  const row={edition:'kjv',text:'God saw light.',tokens:[['x','G1','N-NSM']],groups:[[[[0,3]],[0]]]};
  assert.equal(choose('God saw light.',[row]).mode,'exact');
  assert.equal(choose('God  saw light.',[row]).mode,'typography');
  assert.equal(choose('God saw the light.',[row]),null);
  assert.equal(choose('God saw [light].',[row]),null);
  assert.equal(validGroups(row.text,[[[[0,2]],[0]]],1),false);
  assert.equal(validGroups(row.text,[[[[0,3]],[5]]],1),false);
});

test('KJV residual trial strips only balanced, transparent OSIS wrappers',()=>{
  const strong='<w src="1">Lord</w>';
  assert.equal(ignoreTransparentMarkup('<divineName>'+strong+'</divineName>'),strong);
  assert.equal(ignoreTransparentMarkup('<divineName>'+strong),'<divineName>'+strong);
  const supplied='<transChange type="added">these</transChange>';
  assert.equal(ignoreTransparentMarkup(supplied),supplied);
});
