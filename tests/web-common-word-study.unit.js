'use strict';
const {test} = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const vm = require('node:vm');
const {loadBibleLibrary, tokenizeVerseText, normalizeDictionaryTerm} = require('../tools/audit-word-study-coverage');
const catalog = require('../data/word-study/web-common-words.json');
const root = path.resolve(__dirname, '..');

function provider({modernAvailable = true} = {}){
  const requests = [];
  const realm = vm.createContext({
    fetch:async url => {
      requests.push(url);
      const file = path.join(root,url.slice(1));
      return {ok:(modernAvailable || !url.includes('/modern/')) && fs.existsSync(file),
        json:async () => JSON.parse(fs.readFileSync(file,'utf8'))};
    }
  });
  for(const script of ['provider','sense-selector','dictionary-provider']){
    vm.runInContext(fs.readFileSync(path.join(root,'js/word-study',script+'.js'),'utf8'),realm);
  }
  return {lookup:realm.DictionaryWordStudyProvider.lookup, requests};
}

test('the WEB catalog serves all 500 most frequent normalized Reader words',async () => {
  const counts = new Map();
  const examples = new Map();
  const bible = loadBibleLibrary('web.js','webLibrary');
  for(const [bookId,book] of Object.entries(bible)) for(const [chapter,content] of Object.entries(book)){
    if(!Array.isArray(content.verses)) continue;
    content.verses.forEach((verseText,index) => {
      for(const displayWord of tokenizeVerseText(verseText)){
        const lookupTerm = normalizeDictionaryTerm(displayWord);
        if(!lookupTerm) continue;
        counts.set(lookupTerm,(counts.get(lookupTerm)||0)+1);
        if(!examples.has(lookupTerm)) examples.set(lookupTerm,
          {translationId:'web',bookId,chapter:Number(chapter),verse:index+1,verseText,displayWord,lookupTerm});
      }
    });
  }
  const ranked = [...counts].sort(([a,x],[b,y]) => y-x || (a<b?-1:1)).slice(0,500);
  assert.deepEqual(Object.entries(catalog.entries).map(([word,entry]) => [word,entry.count]),ranked);
  const {lookup,requests} = provider();
  for(const [word] of ranked){
    const entry = catalog.entries[word];
    assert.ok(entry.meanings.length && entry.meanings.every(text => text.length >= 4),word);
    for(const [index,pattern] of entry.rules || []){
      assert.ok(entry.meanings[index] && pattern.includes('@'),word);
      assert.doesNotThrow(() => new RegExp(pattern),word);
    }
    const result = await lookup(examples.get(word));
    assert.equal(result.status,'available',word);
    assert.ok(result.definition && !result.source.startsWith('Webster'),word);
    assert.equal(result.relatedWords.length,0,word);
  }
  assert.deepEqual(requests,['/data/word-study/web-common-words.json']);
});

test('the Reader resolves all audited curly contractions without changing Scripture',async () => {
  const realm = vm.createContext({window:{},document:{readyState:'loading',addEventListener(){}}});
  vm.runInContext(fs.readFileSync(path.join(root,'js/word-study/loader.js'),'utf8'),realm);
  const normalize = realm.WordStudyLoader.normalizeLookupTerm;
  const affected = {"don't":1369,"didn't":863,"doesn't":326,"isn't":166};
  const counted = Object.fromEntries(Object.keys(affected).map(term=>[term,0]));
  const bible = loadBibleLibrary('web.js','webLibrary');
  const {lookup} = provider();
  for(const [bookId,book] of Object.entries(bible)) for(const [chapter,content] of Object.entries(book)){
    if(!Array.isArray(content.verses)) continue;
    for(const [index,verseText] of content.verses.entries()) for(const displayWord of tokenizeVerseText(verseText)){
      const lookupTerm=normalize(displayWord);
      if(!displayWord.includes('’') || !Object.hasOwn(affected,lookupTerm)) continue;
      const result=await lookup({translationId:'web',bookId,chapter:Number(chapter),verse:index+1,verseText,displayWord,lookupTerm});
      assert.equal(result.status,'available',bookId+' '+chapter+':'+(index+1));
      assert.equal(result.word,displayWord);
      counted[lookupTerm]++;
    }
  }
  assert.deepEqual(counted,affected);
});

test('different occurrences of a common word use the selected sense when the word offset is known',async () => {
  const {lookup} = provider();
  const verseText = 'He placed his right hand on the child and did what was right.';
  const context = {translationId:'web',bookId:'mark',chapter:2,verse:7,displayWord:'right',lookupTerm:'right',verseText};
  const direction = await lookup({...context,englishStart:verseText.indexOf('right')});
  const justice = await lookup({...context,englishStart:verseText.lastIndexOf('right')});
  assert.equal(direction.definition,'The side opposite left.');
  assert.equal(justice.definition,'Correct, just, or proper.');
  assert.match(direction.source,/Matched to this verse/);
  const noOffset = await lookup(context);
  assert.match(noOffset.source,/Context uncertain/);
  assert.match(noOffset.definition,/Correct.*side opposite left/);
});

test('a genuinely ambiguous choice stays labeled and word lookup outside WEB uses the modern dictionary',async () => {
  const {lookup} = provider();
  const context = {translationId:'web',bookId:'john',chapter:1,verse:10,displayWord:'world',lookupTerm:'world',
    verseText:'He was in the world, and the world was made through him, and the world didn’t recognize him.'};
  const result = await lookup(context);
  assert.match(result.source,/Context uncertain/);
  assert.match(result.definition,/earth.*human society/);
  const general = await lookup({...context,translationId:'kjv'});
  assert.match(general.source,/Open English Wordnet/);
});

test('created uses the creation sense in the verse and a verb entry elsewhere',async () => {
  const {lookup} = provider();
  const context = {translationId:'web',bookId:'genesis',chapter:1,verse:1,displayWord:'created',lookupTerm:'created',
    verseText:'In the beginning, God created the heavens and the earth.'};
  const creation = await lookup(context);
  assert.match(creation.definition,/Made or brought into existence/);
  const general = await lookup({...context,chapter:5,verse:2,verseText:'He created them male and female.'});
  assert.match(general.source,/Open English Wordnet/);
  assert.doesNotMatch(general.definition,/riding master/);
  assert.match(general.definition,/bring into existence/);
  const historical = await provider({modernAvailable:false}).lookup({...context,chapter:5,verse:2});
  assert.equal(historical.partOfSpeech,'verb');
  assert.doesNotMatch(historical.definition,/riding master/);
});

test('reviewed phrases distinguish uses in the published WEB verses',async () => {
  const {lookup} = provider();
  const bible = loadBibleLibrary('web.js','webLibrary');
  for(const [bookId,chapter,verse,displayWord,meaning] of [
    ['mark',2,7,'God','The Supreme Being.'],
    ['genesis',1,3,'light','What gives brightness or makes things visible.'],
    ['matthew',11,30,'light','Not heavy or burdensome.'],
    ['proverbs',1,7,'fear','Reverence or awe, especially in expressions about fearing God.'],
    ['exodus',25,22,'ark','The sacred chest called the ark of the covenant.'],
    ['john',1,14,'Word','In the opening of John, the Word refers to Jesus Christ, whom John says became flesh.'],
    ['john',4,6,'well','A source or shaft from which water is drawn.'],
    ['matthew',26,39,'Father','A title for God that describes his relationship to his people or to Jesus.']
  ]){
    const verseText = bible[bookId][chapter].verses[verse-1];
    const result = await lookup({translationId:'web',bookId,chapter,verse,displayWord,verseText,
      lookupTerm:normalizeDictionaryTerm(displayWord),englishStart:verseText.indexOf(displayWord)});
    assert.equal(result.definition,meaning,`${bookId} ${chapter}:${verse} ${displayWord}`);
    assert.match(result.source,/Matched to this verse/);
  }
});
