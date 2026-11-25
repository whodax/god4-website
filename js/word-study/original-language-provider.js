/* ===== SCRIPTURE WORD STUDY ORIGINAL-LANGUAGE PROVIDER ===== */
var OriginalLanguageWordStudyProvider = (function createOriginalLanguageWordStudyProvider(){
  var staticDataBasePath = 'data/word-study/original-language/';
  var staticShardRequests = {};
  // Reader verses whose boundaries don't match an individual source verse.
  var unavailableVerses = {
    dra: {
      exodus:['38:25','38:26','38:27','39:17','39:18','39:19','39:26','39:27','39:33','39:34','39:37','39:38','39:39','39:40','40:13'],
      leviticus:['15:19','15:20','26:45'],
      numbers:['11:34','15:11','15:12','15:13','15:14','15:15','15:17','15:18','20:28','20:29','27:3','27:7','27:8'],
      matthew:['17:14'], mark:['4:40']
    },
    gnv: {luke:['15:31']}
  };
  // Each row contains Reader chapter, first and last verse, then the
  // corresponding canonical chapter and first verse.
  var alternateReferences = {
    web: {matthew:[[23,13,13,23,14],[23,14,14,23,13]]},
    dra: {
      exodus:[[39,20,25,39,22],[39,28,32,39,29],[39,35,36,39,36],[40,14,36,40,16]],
      leviticus:[[15,21,23,15,20]],
      numbers:[[13,1,1,12,16],[13,2,34,13,1],[15,16,16,15,17],[20,30,30,20,29],
        [27,4,6,27,5],[30,1,1,29,40],[30,2,17,30,1]],
      matthew:[[5,4,4,5,5],[5,5,5,5,4],[17,15,26,17,16]],
      mark:[[8,39,39,9,1],[9,1,49,9,2]]
    },
    gnv: {numbers:[[13,1,1,12,16],[13,2,34,13,1],[30,1,1,29,40],[30,2,17,30,1]]}
  };
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

  function resolveOriginalLanguageReference(context){
    var reference = { bookId: context.bookId, chapter: context.chapter, verse: context.verse };
    var bookId = String(context.bookId || '').toLowerCase();
    var ranges = alternateReferences[context.translationId]?.[bookId] || [];
    var range = ranges.find(function(item){ return context.chapter === item[0] && context.verse >= item[1] && context.verse <= item[2]; });
    if(range){
      reference.chapter = range[3];
      reference.verse = range[4] + context.verse - range[1];
    }
    // WEB keeps this doxology at 14:24–26; the reviewed Greek shards use KJV coordinates.
    if(context.translationId === 'web' && typeof context.bookId === 'string' && context.bookId.toLowerCase() === 'romans' && context.chapter === 14 && Number.isInteger(context.verse) && context.verse >= 24 && context.verse <= 26){
      reference.chapter = 16;
      reference.verse = context.verse + 1;
    }
    return reference;
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
        if(!data) return null;
        if(Array.isArray(data.records)) return data.records.filter(isStaticRecord);
        return Array.isArray(data.verses) && Array.isArray(data.excludedEditions) &&
          data.lexicon && typeof data.source === 'string' ? data : null;
      }).catch(function(){ return null; });
    }
    return staticShardRequests[url];
  }

  // The compact chapter files also record edition-specific numbering exclusions.
  function hasSupportedReference(context){
    var bookId = String(context.bookId || '').toLowerCase();
    var exceptions = unavailableVerses[context.translationId]?.[bookId] || [];
    if(exceptions.includes(context.chapter + ':' + context.verse)) return false;
    if(context.translationId !== 'dra') return true;
    if(['tobit','judith','wisdom','sirach','baruch','1-maccabees','2-maccabees','esther','daniel','psalms'].includes(bookId)) return false;
    var excluded = {genesis:[49,50], isaiah:[45,46], john:[6]};
    return !(excluded[bookId] || []).includes(context.chapter);
  }

  function readVerse(shard, reference, translationId){
    if(!shard) return [];
    var bookId = reference.bookId.toLowerCase();
    if(Array.isArray(shard)) return shard.filter(function(record){
      return record.bookId === bookId && record.chapter === reference.chapter && record.verse === reference.verse;
    }).sort(function(left, right){ return left.tokenIndex - right.tokenIndex; });
    var tokens = shard.verses[reference.verse - 1];
    if(shard.excludedEditions.includes(translationId) || !Array.isArray(tokens)) return [];
    if(!tokens.every(function(token){
      return Array.isArray(token) && typeof token[0] === 'string' && token[0] &&
        (token[1] === null || typeof token[1] === 'string' && /^[HG]\d{1,5}$/.test(token[1])) &&
        typeof token[2] === 'string' && token[2];
    })) return [];
    return tokens.map(function(token, tokenIndex){
      var strongsNumber = token[1], morphology = token[2];
      var lexical = shard.lexicon[strongsNumber] || [];
      var language = strongsNumber && strongsNumber.startsWith('G') ? 'greek' : morphology.startsWith('A') ? 'aramaic' : 'hebrew';
      return {status:'authoritative',strongsNumber:strongsNumber,language:language,lemma:lexical[0] || token[3] || null,
        transliteration:lexical[1] || null,pronunciation:lexical[2] || null,partOfSpeech:null,definition:lexical[3] || null,
        morphology:morphology,source:shard.source,bookId:bookId,chapter:reference.chapter,verse:reference.verse,
        tokenIndex:tokenIndex,surface:token[0]};
    });
  }

  function staticLookup(context){
    return lookupVerse(context).then(function(result){
      return result.records.find(function(record){ return record.tokenIndex === context.tokenIndex; }) || null;
    });
  }

  function lookupVerse(context){
    if(context && !hasSupportedReference(context)) return Promise.resolve({status:'unavailable',records:[]});
    if(!context || typeof context.bookId !== 'string' || !Number.isInteger(context.chapter) || context.chapter < 1 || !Number.isInteger(context.verse) || context.verse < 1){
      return Promise.resolve({ status: 'unavailable', records: [] });
    }
    var reference = resolveOriginalLanguageReference(context);
    return loadStaticShard(reference).then(function(shard){
      var verseRecords = readVerse(shard,reference,context.translationId);
      return { status: verseRecords.length ? 'available' : 'unavailable', records: verseRecords };
    });
  }

  function fixtureLookup(context){
    var term = typeof WordStudyProvider !== 'undefined' ? WordStudyProvider.normalizeLookupTerm(context.lookupTerm) : String(context.lookupTerm || '').toLowerCase();
    var entry = Object.prototype.hasOwnProperty.call(fixtureEntries, term) ? fixtureEntries[term] : null;
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

  return { lookup: lookup, lookupVerse: lookupVerse, resolveOriginalLanguageReference: resolveOriginalLanguageReference };
}());
