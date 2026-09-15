/* ===== SCRIPTURE WORD STUDY ORIGINAL-LANGUAGE PROVIDER ===== */
var OriginalLanguageWordStudyProvider = (function createOriginalLanguageWordStudyProvider(){
  var staticDataBasePath = 'data/word-study/original-language/';
  var staticShardRequests = {};
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
      source: 'No static original-language record found',
      bookId: context.bookId || null,
      chapter: Number.isInteger(context.chapter) ? context.chapter : null,
      verse: Number.isInteger(context.verse) ? context.verse : null,
      tokenIndex: Number.isInteger(context.tokenIndex) ? context.tokenIndex : null,
      surface: null,
      message: 'Original-language data not available yet.'
    };
  }

  function isLocationContext(context){
    return context && typeof context.bookId === 'string' && Number.isInteger(context.chapter) && context.chapter > 0 && Number.isInteger(context.verse) && context.verse > 0 && Number.isInteger(context.tokenIndex) && context.tokenIndex >= 0;
  }

  function isVerseContext(context){
    return context && typeof context.bookId === 'string' && Number.isInteger(context.chapter) && context.chapter > 0 && Number.isInteger(context.verse) && context.verse > 0;
  }

  function isStaticRecord(record){
    var optionalText = function(value){ return value === null || typeof value === 'string'; };
    return record && typeof record === 'object' && (record.strongsNumber === null || typeof record.strongsNumber === 'string') && typeof record.status === 'string' && typeof record.language === 'string' && optionalText(record.lemma) && optionalText(record.transliteration) && optionalText(record.pronunciation) && optionalText(record.partOfSpeech) && optionalText(record.definition) && typeof record.morphology === 'string' && typeof record.source === 'string' && typeof record.bookId === 'string' && Number.isInteger(record.chapter) && Number.isInteger(record.verse) && Number.isInteger(record.tokenIndex) && typeof record.surface === 'string';
  }

  function loadStaticShard(context){
    if(!isVerseContext(context) || typeof fetch !== 'function') return Promise.resolve(null);
    var bookId = context.bookId.toLowerCase();
    if(!/^[a-z0-9-]+$/.test(bookId)) return Promise.resolve(null);
    var url = staticDataBasePath + encodeURIComponent(bookId) + '/' + context.chapter + '.json';
    if(!staticShardRequests[url]){
      staticShardRequests[url] = fetch(url).then(function(response){
        if(!response.ok) throw new Error('Static original-language shard unavailable');
        return response.json();
      }).then(function(data){
        if(!data || !Array.isArray(data.records)) return [];
        return data.records.filter(isStaticRecord);
      }).catch(function(){ return null; });
    }
    return staticShardRequests[url];
  }

  function staticLookup(context){
    return loadStaticShard(context).then(function(records){
      if(!records) return null;
      return records.find(function(record){
        return record.bookId === context.bookId.toLowerCase() && record.chapter === context.chapter && record.verse === context.verse && record.tokenIndex === context.tokenIndex;
      }) || null;
    });
  }

  function lookupVerse(context){
    if(!context || typeof context.bookId !== 'string' || !Number.isInteger(context.chapter) || context.chapter < 1 || !Number.isInteger(context.verse) || context.verse < 1){
      return Promise.resolve({ status: 'unavailable', records: [] });
    }
    return loadStaticShard(context).then(function(records){
      if(!records) return { status: 'unavailable', records: [] };
      return {
        status: 'available',
        records: records.filter(function(record){
          return record.bookId === context.bookId.toLowerCase() && record.chapter === context.chapter && record.verse === context.verse;
        }).sort(function(left, right){ return left.tokenIndex - right.tokenIndex; })
      };
    });
  }

  function fixtureLookup(context){
    var term = typeof WordStudyProvider !== 'undefined' ? WordStudyProvider.normalizeLookupTerm(context.lookupTerm) : String(context.lookupTerm || '').toLowerCase();
    var entry = fixtureEntries[term];
    return entry ? {
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
      source: entry.source,
      bookId: null,
      chapter: null,
      verse: null,
      tokenIndex: null,
      surface: null
    } : null;
  }

  function lookup(context){
    context = context || {};
    return staticLookup(context).then(function(record){
      if(record) return Object.assign({ word: context.displayWord }, record);
      if(isLocationContext(context)) return unavailable(context);
      return fixtureLookup(context) || unavailable(context);
    });
  }

  return { lookup: lookup, lookupVerse: lookupVerse };
}());