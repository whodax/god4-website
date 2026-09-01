/* ===== SCRIPTURE WORD STUDY LOCAL PROVIDER ===== */
var LocalWordStudyProvider = (function createLocalWordStudyProvider(){
  var entries = {
    beginning: {
      definition: 'The first part, point, or origin of something.',
      relatedWords: ['origin', 'start', 'first']
    },
    light: {
      definition: 'Brightness that makes things visible; a source of illumination.',
      relatedWords: ['brightness', 'illumination', 'radiance']
    },
    love: {
      definition: 'A deep and active care for the good of another.',
      relatedWords: ['care', 'devotion', 'affection']
    },
    faith: {
      definition: 'Trust or confidence placed in someone or something.',
      relatedWords: ['trust', 'belief', 'confidence']
    },
    grace: {
      definition: 'Kindness or favor freely given.',
      relatedWords: ['favor', 'kindness', 'mercy']
    }
  };

  function lookup(context){
    var term = WordStudyProvider.normalizeLookupTerm(context.lookupTerm);
    var entry = entries[term];
    return Promise.resolve(entry ? {
      status: 'available',
      word: context.displayWord,
      definition: entry.definition,
      relatedWords: entry.relatedWords.slice(),
      source: 'Local study notes'
    } : {
      status: 'unavailable',
      word: context.displayWord,
      message: 'Definition not available yet.'
    });
  }

  return { lookup: lookup };
}());