/* ===== SCRIPTURE WORD STUDY STATIC DICTIONARY PROVIDER ===== */
var DictionaryWordStudyProvider = (function createDictionaryWordStudyProvider(){
  var shardRequests = Object.create(null);

  function getShardName(term){
    var normalized = WordStudyProvider.normalizeLookupTerm(term);
    return normalized.slice(0, 2);
  }

  function unavailable(context, reason){
    return { status: 'unavailable', word: context.displayWord, reason: reason };
  }

  function loadShard(shard){
    if(!shard) return Promise.resolve(null);
    if(!shardRequests[shard]){
      shardRequests[shard] = fetch('/data/word-study/' + encodeURIComponent(shard) + '.json').then(function(response){
        if(!response.ok) throw new Error('Shard unavailable');
        return response.json();
      }).then(function(data){
        if(!data || typeof data !== 'object' || !data.entries || typeof data.entries !== 'object') throw new Error('Malformed shard');
        return data;
      }).catch(function(){
        return null;
      });
    }
    return shardRequests[shard];
  }

  function normalizeEntry(entry, context){
    if(!entry || typeof entry !== 'object' || !Array.isArray(entry.definitions) || !entry.definitions.length) return unavailable(context, 'not-found');
    var definitions = entry.definitions.filter(function(definition){ return definition && typeof definition.text === 'string' && definition.text.trim(); }).map(function(definition){
      return { text: definition.text.trim(), partOfSpeech: typeof definition.partOfSpeech === 'string' ? definition.partOfSpeech.trim() : '' };
    });
    if(!definitions.length) return unavailable(context, 'malformed');
    var relatedWords = Array.isArray(entry.relatedWords) ? entry.relatedWords.filter(function(word){ return typeof word === 'string' && word.trim(); }).slice(0, 12) : [];
    return {
      status: 'available',
      word: context.displayWord,
      definition: definitions[0].text,
      partOfSpeech: definitions[0].partOfSpeech,
      definitions: definitions,
      relatedWords: relatedWords,
      source: 'Webster’s Unabridged Dictionary and Moby Thesaurus II'
    };
  }

  function lookup(context){
    var term = WordStudyProvider.normalizeLookupTerm(context.lookupTerm);
    return loadShard(getShardName(term)).then(function(data){
      return data ? normalizeEntry(data.entries[term], context) : unavailable(context, 'shard-unavailable');
    });
  }

  return { getShardName: getShardName, lookup: lookup };
}());