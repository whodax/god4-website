'use strict';

const {test}=require('node:test');
const assert=require('node:assert/strict');
const fs=require('node:fs');
const path=require('node:path');
const vm=require('node:vm');
const {createHash}=require('node:crypto');
const {loadBibleLibrary,READER_TOKEN_PATTERN}=require('../tools/audit-word-study-coverage');
const {spanIntersectsSupplied}=require('../tools/import-kjv-tr-alignment');
const report=require('../docs/shell-82-kjv-tr-publication.json');
const root=path.resolve(__dirname,'..');
const base='data/word-study/alignment/kjv-tr/';
const read=file=>fs.readFileSync(path.join(root,file));

function runtime(){
  const realm=vm.createContext({BibleCanon:require('../js/bible/canon'),AbortController,setTimeout,clearTimeout,
    async fetch(url){
      const bytes=read(url.replace(/^\//,''));
      return {ok:true,json:async()=>JSON.parse(bytes)};
    }
  });
  vm.runInContext(read('js/word-study/alignment.js').toString('utf8'),realm);
  return realm.WordStudyAlignment;
}

test('every alternate witness is byte-pinned, disjoint from accepted groups, and uses exact KJV English',async()=>{
  const bible=loadBibleLibrary('kjv.js','kjvLibrary'), alignment=runtime(), index=JSON.parse(read(base+'index.json'));
  let verses=0,occurrences=0;
  for(const [file,pin] of Object.entries(report.files)){
    const bytes=read(base+file);
    assert.equal(bytes.length,pin.bytes);
    assert.equal(createHash('sha256').update(bytes).digest('hex'),pin.sha256);
    if(file==='index.json') continue;
    const chapter=JSON.parse(bytes), {bookId,chapter:chapterNumber}=chapter;
    const primaryPath=path.join(root,'data/word-study/alignment/kjv',file);
    const primary=fs.existsSync(primaryPath)?JSON.parse(fs.readFileSync(primaryPath)):{};
    assert.deepEqual(index[bookId][chapterNumber],Object.keys(chapter.verses).map(Number));
    for(const [verseId,[verseText,tokens,groups]] of Object.entries(chapter.verses)){
      const verse=Number(verseId);
      assert.equal(verseText,bible[bookId][chapterNumber].verses[verse-1]);
      assert.ok(!primary[verse]);
      assert.equal(spanIntersectsSupplied(verseText,groups),false);
      const context={translationId:'kjv',bookId,chapter:chapterNumber,verse,verseText};
      const paired=await alignment.lookupKjvWitness(context);
      assert.equal(paired?.alignment.status,'available',bookId+' '+chapterNumber+':'+verse);
      assert.ok(paired.records.every((record,index)=>record.source.includes(report.revision)&&
        record.tokenIndex===index&&record.surface===tokens[index][0]&&
        record.strongsNumber===tokens[index][1]&&record.morphology===tokens[index][2]));
      if(verses===0){
        assert.equal(await alignment.lookupKjvWitness({...context,verseText:verseText+'!'}),null);
        assert.equal(alignment.lookupKjvWitness({...context,translationId:'web'}),null);
      }
      verses++;
      occurrences+=[...verseText.matchAll(READER_TOKEN_PATTERN)].filter(word=>groups.some(([spans])=>
        spans.some(([start,end])=>word.index>=start&&word.index+word[0].length<=end))).length;
    }
  }
  assert.equal(verses,476);
  assert.equal(occurrences,11103);
  assert.deepEqual(report.publishedCoverage,{verses:6409,occurrences:135805,priorityForms:476});
});

test('original-witness bounds reject supplied words even where neighboring words match',()=>{
  assert.equal(spanIntersectsSupplied('This [is] text.',[[[[0,4]],[0]]]),false);
  assert.equal(spanIntersectsSupplied('This [is] text.',[[[[6,8]],[0]]]),true);
});
