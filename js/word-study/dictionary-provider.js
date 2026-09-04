/* ===== SCRIPTURE WORD STUDY STATIC DICTIONARY PROVIDER ===== */
var DictionaryWordStudyProvider = (function createDictionaryWordStudyProvider(){
  var shardRequests = Object.create(null);

  function getShardName(term){
    var normalized = WordStudyProvider.normalizeLookupTerm(term);
    return normalized.slice(0, 2);
  }

  function getShardNames(term){
    var normalized = WordStudyProvider.normalizeLookupTerm(term);
    var parent = normalized.slice(0, 2);
    var child = normalized.slice(0, 3);
    var grandchild = normalized.slice(0, 4);
    return [parent, child, grandchild].filter(function(shard, index, shards){ return shard && shards.indexOf(shard) === index; });
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
    var shards = getShardNames(term);
    function lookupShard(index){
      if(index >= shards.length) return unavailable(context, 'shard-unavailable');
      return loadShard(shards[index]).then(function(data){
        if(data && data.entries[term]) return normalizeEntry(data.entries[term], context);
        return lookupShard(index + 1);
      });
    }
    return lookupShard(0);
  }

  return { getShardName: getShardName, getShardNames: getShardNames, lookup: lookup };
}());