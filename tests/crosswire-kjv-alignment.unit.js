'use strict';

const {test}=require('node:test');
const assert=require('node:assert/strict');
const fs=require('node:fs');
const path=require('node:path');
const vm=require('node:vm');
const {createHash}=require('node:crypto');
const {validateVerse}=require('../tools/import-crosswire-kjv-alignment');
const {loadBibleLibrary,TRANSLATIONS,tokenizeVerseText,normalizeDictionaryTerm}=require('../tools/audit-word-study-coverage');
const root=path.resolve(__dirname,'..');
const read=file=>fs.readFileSync(path.join(root,file));
const record=(tokenIndex,surface,strongsNumber,morphology)=>({status:'authoritative',language:'greek',tokenIndex,surface,strongsNumber,morphology});
const records=[record(0,'λογος','G3056','N-NSM'),record(1,'δε','G1161','CONJ')];
const w=(src,ids,morph,body,type='')=>'<w src="'+src+'" lemma="'+ids+'" morph="'+morph+'"'+type+'>'+body+'</w>';
const word=(text,type)=>w('1','strong:G3056 lemma.TR:λόγος','robinson:N-NSM',text,type);
const and=w('2','strong:G1161 lemma.TR:δέ','robinson:CONJ','and');

test('strict CrossWire import retains display spans, noncontiguous groups and multiple Greek tokens',()=>{
  const pair=w('1 2','strong:G3056 strong:G1161 lemma.TR:λόγος lemma.TR:δέ','robinson:N-NSM robinson:CONJ','the word');
  assert.deepEqual(validateVerse('the word [is].',pair+' <transChange type="added">is</transChange>.',records).alignments,[[[[0,8]],[0,1]]]);
  const marker=' type="x-split-1"';
  assert.deepEqual(validateVerse('the and word', word('the',marker)+' '+and+' '+word('word',marker),records).alignments,
    [[[[0,3],[8,12]],[0]],[[[4,7]],[1]]]);
  assert.ok(validateVerse('The word',pair,records).reason);
  assert.ok(validateVerse('the word is.',pair+' <transChange type="added">is</transChange>.',records).reason);
  assert.ok(validateVerse('the word',pair,records.map((token,index)=>index ? {...token,morphology:'PRT'} : token)).reason);
  assert.ok(validateVerse('the word',pair,records.map((token,index)=>index ? {...token,surface:'και'} : token)).reason);
  assert.ok(validateVerse('the word',pair,records.map((token,index)=>index ? {...token,strongsNumber:'G2532'} : token)).reason);
  assert.equal(validateVerse('the word and word',word('the word')+' '+and+' '+word('word'),records).ambiguous,true);
  assert.ok(validateVerse('the word',word('the word'),records).reason);
});

test('Reader and standalone normalization preserve typographic apostrophes across all nine editions',()=>{
  const realm=vm.createContext({window:{},document:{readyState:'loading',addEventListener(){}}});
  vm.runInContext(read('js/word-study/loader.js').toString(),realm);
  vm.runInContext(read('js/word-study/provider.js').toString(),realm);
  const editions=[...TRANSLATIONS,{id:'dra',file:'dra.js',variable:'draLibrary'}];
  for(const edition of editions){
    const bible=loadBibleLibrary(edition.file,edition.variable);
    // Geneva's installed text has no selectable apostrophe forms.
    const apostrophes=new Set(["don’t","Lord’s","Lord's"]);
    for(const book of Object.values(bible)) for(const chapter of Object.values(book)){
      if(!Array.isArray(chapter.verses)) continue;
      for(const text of chapter.verses) for(const word of tokenizeVerseText(text)){
        if(/['’]/.test(word)) apostrophes.add(word);
      }
    }
    for(const word of apostrophes){
      const expected=normalizeDictionaryTerm(word);
      assert.equal(realm.WordStudyLoader.normalizeLookupTerm(word),expected,edition.id+' '+word);
      assert.equal(realm.WordStudyProvider.normalizeLookupTerm(word),expected);
    }
  }
});

test('every generated chapter matches the pinned import report and exact KJV text',()=>{
  const report=require('../docs/shell-76-crosswire-import.json');
  const bible=loadBibleLibrary('kjv.js','kjvLibrary');
  assert.equal(report.oldTestament.anyPositionAttributes,0);
  assert.equal(Object.values(report.books).reduce((sum,book)=>sum+book.accepted+book.rejected+book.ambiguous,0),7957);
  assert.ok(Object.keys(report.files).length>250);
  for(const [filename,pin] of Object.entries(report.files)){
    const content=read('data/word-study/alignment/kjv/'+filename);
    assert.equal(content.length,pin.bytes);
    assert.equal(createHash('sha256').update(content).digest('hex'),pin.sha256);
    const [book, chapter]=filename.replace('.json','').split('/');
    for(const [verse,[text,tokens,groups]] of Object.entries(JSON.parse(content))){
      assert.equal(text,bible[book][chapter].verses[Number(verse)-1]);
      assert.ok(groups.length && groups.every(([spans,indices])=>spans.length && indices.length &&
        indices.every(index=>Number.isInteger(index)&&index>=0&&index<tokens.length)));
    }
  }
});

test('all accepted verses pass the live providers, which reject a changed Greek analysis',async ()=>{
  const realm=vm.createContext({
    BibleCanon:require('../js/bible/canon'),AbortController,setTimeout,clearTimeout,
    async fetch(url){
      const bytes=read(url.replace(/^\//,''));
      return {ok:true,json:async()=>JSON.parse(bytes)};
    }
  });
  for(const name of ['original-language-provider','alignment']){
    vm.runInContext(read('js/word-study/'+name+'.js').toString(),realm);
  }
  const report=require('../docs/shell-76-crosswire-import.json');
  let count=0;
  for(const filename of Object.keys(report.files)){
    const [bookId, chapter]=filename.replace('.json','').split('/');
    for(const [verse,[verseText]] of Object.entries(JSON.parse(read('data/word-study/alignment/kjv/'+filename)))){
      const context={translationId:'kjv',bookId,chapter:Number(chapter),verse:Number(verse),verseText};
      const {records}=await realm.OriginalLanguageWordStudyProvider.lookupVerse(context);
      const result=await realm.WordStudyAlignment.lookupChapter(context,records);
      assert.equal(result?.status,'available',bookId+' '+chapter+':'+verse);
      if(count===0){
        const changed=records.map((record,index)=>index===0 ? {...record,morphology:'changed'} : record);
        assert.equal(await realm.WordStudyAlignment.lookupChapter(context,changed),null);
      }
      count++;
    }
  }
  assert.equal(count,Object.values(report.books).reduce((total,book)=>total+book.accepted,0));
});
