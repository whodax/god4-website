/* ===== SCRIPTURE WORD STUDY ORIGINAL-LANGUAGE PROVIDER ===== */
var OriginalLanguageWordStudyProvider = (function createOriginalLanguageWordStudyProvider(){
  var fixtureEntries = {
    beginning: {
      strongsNumber: 'DEMO-H0001',
      language: 'demo-hebrew',
      lemma: 'demo-beginning',
      transliteration: 'demo-beginning',
      pronunciation: 'DEH-moh bih-GIN-ing',
      partOfSpeech: 'noun',
      definition: 'Demo fixture entry for architecture testing only.',
      morphology: 'demo morphology',
      source: 'Phase C1 demo fixture (not a production lexical record)'
    },
    god: {
      strongsNumber: 'DEMO-H0002',
      language: 'demo-hebrew',
      lemma: 'demo-god',
      transliteration: 'demo-god',
      pronunciation: 'DEH-moh god',
      partOfSpeech: 'noun',
      definition: 'Demo fixture entry for architecture testing only.',
      morphology: 'demo morphology',
      source: 'Phase C1 demo fixture (not a production lexical record)'
    },
    word: {
      strongsNumber: 'DEMO-G0001',
      language: 'demo-greek',
      lemma: 'demo-word',
      transliteration: 'demo-word',
      pronunciation: 'DEH-moh word',
      partOfSpeech: 'noun',
      definition: 'Demo fixture entry for architecture testing only.',
      morphology: 'demo morphology',
      source: 'Phase C1 demo fixture (not a production lexical record)'
    }
  };

  function unavailable(context){
    return {
      status: 'unavailable',
      word: context.displayWord,
      strongsNumber: null,
      language: null,
      lemma: null,
      transliteration: null,
      pronunciation: null,
      partOfSpeech: null,
      definition: null,
      morphology: null,
      source: 'Phase C1 demo fixture (not a production lexical data source)',
      message: 'Original-language data not available yet.'
    };
  }

  function lookup(context){
    var term = WordStudyProvider.normalizeLookupTerm(context.lookupTerm);
    var entry = fixtureEntries[term];
    return Promise.resolve(entry ? {
      status: 'available',
      word: context.displayWord,
      strongsNumber: entry.strongsNumber,
      language: entry.language,
      lemma: entry.lemma,
      transliteration: entry.transliteration,
      pronunciation: entry.pronunciation,
      partOfSpeech: entry.partOfSpeech,
      definition: entry.definition,
      morphology: entry.morphology,
      source: entry.source
    } : unavailable(context));
  }

  return { lookup: lookup };
}());