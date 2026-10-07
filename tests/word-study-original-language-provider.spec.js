const {test, expect} = require('@playwright/test');
const fs = require('fs');
const path = require('path');
const vm = require('node:vm');

function isolatedProvider(){
  const networkCalls = [];
  const realm = vm.createContext({fetch(url){
    networkCalls.push(url);
    throw new Error('Fixture lookup must not fetch');
  }});
  for(const file of ['provider.js', 'original-language-provider.js']){
    vm.runInContext(fs.readFileSync(path.join(__dirname, '../js/word-study', file), 'utf8'), realm);
  }
  return {realm, networkCalls};
}

function unavailable(word){
  return {status:'unavailable', word, strongsNumber:null, language:null, lemma:null,
    transliteration:null, pronunciation:null, partOfSpeech:null, definition:null,
    morphology:null, source:'No static original-language record found', bookId:null,
    chapter:null, verse:null, tokenIndex:null, surface:null,
    message:'Original-language data not available yet.'};
}

for(const word of ['constructor', 'toString', 'valueOf', '__proto__', 'notaword']){
  test(`Word Study original-language ${word} is normalized unavailable without network`, async () => {
    const {realm, networkCalls} = isolatedProvider();
    const context = {lookupTerm:word, displayWord:word};
    for(const provider of [realm.OriginalLanguageWordStudyProvider.lookup, realm.WordStudyProvider.lookupOriginalLanguage]){
      const pending = provider(context);
      expect(pending).toBeInstanceOf(vm.runInContext('Promise', realm));
      expect(await pending).toEqual(unavailable(word));
    }
    expect(networkCalls).toEqual([]);
  });
}

for(const [word, strongsNumber, language] of [
  ['beginning','DEMO-H0001','demo-hebrew'], ['god','DEMO-H0002','demo-hebrew'],
  ['word','DEMO-G0001','demo-greek']
]){
  test(`Word Study original-language ${word} retains its complete demo contract without network`, async () => {
    const {realm, networkCalls} = isolatedProvider();
    const context = {lookupTerm:word, displayWord:word};
    const result = await realm.WordStudyProvider.lookupOriginalLanguage(context);
    expect(result).toEqual(await realm.OriginalLanguageWordStudyProvider.lookup(context));
    expect(result).toMatchObject({status:'available', word, strongsNumber, language,
      lemma:'demo-' + word, transliteration:'demo-' + word, partOfSpeech:'noun',
      definition:'Demo fixture entry for architecture testing only.', morphology:'demo morphology',
      source:'Phase C1 demo fixture (not a production lexical record)',
      bookId:null, chapter:null, verse:null, tokenIndex:null, surface:null});
    expect(typeof result.pronunciation).toBe('string');
    expect(result.pronunciation.length).toBeGreaterThan(0);
    expect(Object.keys(result).sort()).toEqual(Object.keys(unavailable(word)).filter(key => key !== 'message').sort());
    expect(networkCalls).toEqual([]);
  });
}

test('Word Study original-language ignores inherited fixture-shaped entries rather than special-casing names', async () => {
  const {realm, networkCalls} = isolatedProvider();
  // Pollution is confined to this disposable VM; no browser or host prototype is modified.
  vm.runInContext(`Object.prototype.notaword = {
    strongsNumber:'DEMO-INHERITED', language:'demo-hebrew', lemma:'inherited',
    transliteration:'inherited', pronunciation:'inherited', partOfSpeech:'noun',
    definition:'Not an own provider entry', morphology:'demo', source:'inherited'
  };`, realm);
  expect(await realm.WordStudyProvider.lookupOriginalLanguage({lookupTerm:'notaword', displayWord:'notaword'}))
    .toEqual(unavailable('notaword'));
  expect(networkCalls).toEqual([]);
});
