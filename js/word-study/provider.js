/* ===== SCRIPTURE WORD STUDY PROVIDER CONTRACT ===== */
var WordStudyProvider = (function createWordStudyProvider(){
  function normalizeLookupTerm(value){
    return String(value || '').toLowerCase().replace(/[‘’]/g, "'").replace(/[^a-z0-9']/g, '').replace(/^'+|'+$/g, '');
  }

  function unavailable(context){
    return {
      status: 'unavailable',
      word: context.displayWord,
      message: 'Definition not available yet.'
    };
  }

  var englishUsage = {
    "don't":'Do not. It makes the action or instruction negative.',
    "didn't":'Did not. It says that something did not happen in the past.',
    "doesn't":'Does not. It says that someone or something does not do the action.',
    "won't":'Will not. It says what someone will refuse to do or what will not happen.',
    "can't":'Cannot. It says that something is impossible or that someone is unable to do it.',
    "let's":'Let us. It introduces a suggestion or invitation to do something together.',
    "isn't":'Is not. It denies what is being said about someone or something.',
    "king's":'Belonging to or associated with a king, as in the king’s house.'
  };

  function lookup(context){
    var term=normalizeLookupTerm(String(context.displayWord || context.lookupTerm || '').replace(/[\u2018\u2019]/g, "'"));
    if(Object.hasOwn(englishUsage,term)){
      return Promise.resolve({status:'available',word:context.displayWord,definition:englishUsage[term],
        partOfSpeech:term==="king's"?'possessive':'contraction',source:'English usage'});
    }
    var dictionaryLookup = typeof DictionaryWordStudyProvider === 'undefined' ? Promise.resolve(unavailable(context)) : DictionaryWordStudyProvider.lookup(context);
    return dictionaryLookup.catch(function(){ return unavailable(context); }).then(function(result){
      if(result && result.status === 'available') return result;
      if(typeof LocalWordStudyProvider === 'undefined') return unavailable(context);
      return LocalWordStudyProvider.lookup(context).catch(function(){ return unavailable(context); }).then(function(localResult){
        return localResult && localResult.status === 'available' ? localResult : unavailable(context);
      });
    });
  }

  function lookupOriginalLanguage(context){
    if(typeof OriginalLanguageWordStudyProvider === 'undefined') return Promise.resolve(unavailable(context));
    return OriginalLanguageWordStudyProvider.lookup(context);
  }

  return {
    normalizeLookupTerm: normalizeLookupTerm,
    lookup: lookup,
    lookupOriginalLanguage: lookupOriginalLanguage
  };
}());
