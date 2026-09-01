/* ===== SCRIPTURE WORD STUDY PROVIDER CONTRACT ===== */
var WordStudyProvider = (function createWordStudyProvider(){
  function normalizeLookupTerm(value){
    return String(value || '').toLowerCase().replace(/[^a-z0-9']/g, '').replace(/^'+|'+$/g, '');
  }

  function unavailable(context){
    return {
      status: 'unavailable',
      word: context.displayWord,
      message: 'Definition not available yet.'
    };
  }

  function lookup(context){
    var dictionaryLookup = typeof DictionaryWordStudyProvider === 'undefined' ? Promise.resolve(unavailable(context)) : DictionaryWordStudyProvider.lookup(context);
    return dictionaryLookup.catch(function(){ return unavailable(context); }).then(function(result){
      if(result && result.status === 'available') return result;
      if(typeof LocalWordStudyProvider === 'undefined') return unavailable(context);
      return LocalWordStudyProvider.lookup(context).catch(function(){ return unavailable(context); }).then(function(localResult){
        return localResult && localResult.status === 'available' ? localResult : unavailable(context);
      });
    });
  }

  return {
    normalizeLookupTerm: normalizeLookupTerm,
    lookup: lookup
  };
}());