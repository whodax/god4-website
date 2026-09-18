/* ===== SCRIPTURE WORD STUDY STATIC DICTIONARY PROVIDER ===== */
var DictionaryWordStudyProvider = (function createDictionaryWordStudyProvider(){
  var shardRequests = Object.create(null);

  var reservedShardNames = new Set([
    'con','prn','aux','nul',
    'com1','com2','com3','com4','com5','com6','com7','com8','com9',
    'lpt1','lpt2','lpt3','lpt4','lpt5','lpt6','lpt7','lpt8','lpt9'
  ]);

  /*
   * Keep this list deliberately small.
   *
   * These are common irregular lexical inflections for which ordinary
   * suffix rules cannot reliably recover the dictionary headword.
   *
   * Highly grammatical auxiliary forms such as "was" -> "be" are
   * intentionally excluded so Word Study does not turn common function
   * words into surprising dictionary matches.
   */
  var irregularHeadwords = {
    children: 'child',
    men: 'man',
    women: 'woman',
    feet: 'foot',
    teeth: 'tooth',
    geese: 'goose',
    mice: 'mouse'
  };

  function normalizeShardName(shard){
    var normalized = String(shard || '').toLowerCase();

    if(!normalized || normalized.endsWith('_')){
      return normalized;
    }

    return reservedShardNames.has(normalized)
      ? normalized + '_'
      : normalized;
  }

  /*
   * Normalize typographic apostrophes before applying the shared lookup
   * normalization. This lets possessives copied directly from Bible text
   * behave the same whether they contain ' or ’.
   */
  function normalizeDictionaryTerm(value){
    return WordStudyProvider.normalizeLookupTerm(
      String(value || '').replace(/[\u2018\u2019]/g, "'")
    );
  }

  function getShardName(term){
    var normalized = normalizeDictionaryTerm(term);

    return normalizeShardName(normalized.slice(0, 2));
  }

  function getShardNames(term){
    var normalized = normalizeDictionaryTerm(term);
    var parent = normalized.slice(0, 2);
    var child = normalized.slice(0, 3);
    var grandchild = normalized.slice(0, 4);

    return [parent, child, grandchild]
      .map(normalizeShardName)
      .filter(function(shard, index, shards){
        return shard && shards.indexOf(shard) === index;
      });
  }

  function unavailable(context, reason){
    return {
      status: 'unavailable',
      word: context.displayWord,
      reason: reason
    };
  }

  function loadShard(shard){
    if(!shard){
      return Promise.resolve(null);
    }

    if(!shardRequests[shard]){
      shardRequests[shard] = fetch(
        '/data/word-study/' + encodeURIComponent(shard) + '.json'
      ).then(function(response){
        if(!response.ok){
          throw new Error('Shard unavailable');
        }

        return response.json();
      }).then(function(data){
        if(
          !data ||
          typeof data !== 'object' ||
          !data.entries ||
          typeof data.entries !== 'object'
        ){
          throw new Error('Malformed shard');
        }

        return data;
      }).catch(function(){
        return null;
      });
    }

    return shardRequests[shard];
  }

  function normalizeEntry(entry, context){
    if(
      !entry ||
      typeof entry !== 'object' ||
      !Array.isArray(entry.definitions) ||
      !entry.definitions.length
    ){
      return unavailable(context, 'not-found');
    }

    var definitions = entry.definitions
      .filter(function(definition){
        return definition &&
          typeof definition.text === 'string' &&
          definition.text.trim();
      })
      .map(function(definition){
        return {
          text: definition.text.trim(),
          partOfSpeech:
            typeof definition.partOfSpeech === 'string'
              ? definition.partOfSpeech.trim()
              : ''
        };
      });

    if(!definitions.length){
      return unavailable(context, 'malformed');
    }

    var relatedWords = Array.isArray(entry.relatedWords)
      ? entry.relatedWords
          .filter(function(word){
            return typeof word === 'string' && word.trim();
          })
          .slice(0, 12)
      : [];

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

  function pushCandidate(candidates, candidate, original){
    candidate = normalizeDictionaryTerm(candidate);

    if(
      !candidate ||
      candidate === original ||
      candidate.length < 2 ||
      candidates.indexOf(candidate) !== -1
    ){
      return;
    }

    candidates.push(candidate);
  }

  /*
   * Generate conservative dictionary-headword candidates.
   *
   * This is not a general-purpose stemmer. Candidates are only suggestions.
   * lookupExact() must subsequently prove that a candidate exists in the
   * actual Webster dataset before GOD4.us uses it.
   */
  function addInflectionCandidates(term, candidates, original){
    var irregular = irregularHeadwords[term];

    if(irregular){
      pushCandidate(candidates, irregular, original);
    }

    /*
     * Plurals ending in -ies:
     *   cities -> city
     *   bodies -> body
     */
    if(term.length > 4 && /ies$/.test(term)){
      pushCandidate(candidates, term.slice(0, -3) + 'y', original);
    }

    /*
     * Plurals ending in -ves can represent either -f or -fe:
     *   wolves -> wolf
     *   wives  -> wife
     *
     * Both candidates are checked against the real dictionary.
     */
    if(term.length > 4 && /ves$/.test(term)){
      pushCandidate(candidates, term.slice(0, -3) + 'f', original);
      pushCandidate(candidates, term.slice(0, -3) + 'fe', original);
    }

    /*
     * Past tense ending in -ied:
     *   buried  -> bury
     *   studied -> study
     */
    if(term.length > 4 && /ied$/.test(term)){
      pushCandidate(candidates, term.slice(0, -3) + 'y', original);
    }

    /*
     * Past tense ending in -ed.
     *
     * Handle doubled consonants first:
     *   stopped -> stop
     *
     * Then try restoration of a final e:
     *   loved  -> love
     *   hoped  -> hope
     *   singed -> singe
     *
     * Finally try the ordinary -ed removal:
     *   walked -> walk
     */
    if(term.length > 4 && /ed$/.test(term)){
      var pastStem = term.slice(0, -2);
      pushCandidate(candidates, pastStem, original);

      if(
        pastStem.length > 2 &&
        pastStem.charAt(pastStem.length - 1) ===
          pastStem.charAt(pastStem.length - 2) &&
        !/[aeiou]/.test(pastStem.charAt(pastStem.length - 1))
      ){
        pushCandidate(
          candidates,
          pastStem.slice(0, -1),
          original
        );
      }

      pushCandidate(candidates, term.slice(0, -1), original);
    }

    /*
     * Present participles ending in -ing.
     *
     * Doubled consonants:
     *   running -> run
     *
     * Ordinary forms:
     *   walking -> walk
     *
     * Dropped final e:
     *   coming -> come
     *   making -> make
     *
     * Very short raw stems such as "us" from "using" are deliberately
     * avoided because they are especially likely to be unrelated words.
     */
    if(term.length > 5 && /ing$/.test(term)){
      var participleStem = term.slice(0, -3);

      if(
        participleStem.length > 2 &&
        participleStem.charAt(participleStem.length - 1) ===
          participleStem.charAt(participleStem.length - 2) &&
        !/[aeiou]/.test(
          participleStem.charAt(participleStem.length - 1)
        )
      ){
        pushCandidate(
          candidates,
          participleStem.slice(0, -1),
          original
        );
      }

      if(participleStem.length >= 4){
        pushCandidate(candidates, participleStem, original);
      }

      pushCandidate(
        candidates,
        participleStem + 'e',
        original
      );
    }

    /*
     * General plural fallback.
     *
     * Trying removal of only the final s first correctly handles forms such
     * as "loves" -> "love". If that fails, -es is tried for forms such as
     * "boxes" -> "box".
     */
    if(
      term.length > 3 &&
      /s$/.test(term) &&
      !/ss$/.test(term)
    ){
      pushCandidate(candidates, term.slice(0, -1), original);
    }

    if(term.length > 4 && /es$/.test(term)){
      pushCandidate(candidates, term.slice(0, -2), original);
    }
  }

  function getInflectionCandidates(value){
    var original = normalizeDictionaryTerm(value);
    var candidates = [];

    if(!original){
      return candidates;
    }

    /*
     * ASCII and typographic apostrophes have already been normalized.
     *
     * Examples:
     *   king's     -> king
     *   children's -> children -> child
     */
    if(original.length > 2 && /'s$/.test(original)){
      var possessiveBase = original.slice(0, -2);

      pushCandidate(candidates, possessiveBase, original);
      addInflectionCandidates(
        possessiveBase,
        candidates,
        original
      );
    }

    addInflectionCandidates(original, candidates, original);

    return candidates;
  }

  /*
   * Look for one exact dictionary key.
   *
   * Adaptive sharding means the word may live in its two-, three-, or
   * four-character shard. loadShard() retains the existing request cache.
   */
  function lookupExact(term, context){
    var shards = getShardNames(term);

    function lookupShard(index){
      if(index >= shards.length){
        return Promise.resolve(null);
      }

      return loadShard(shards[index]).then(function(data){
        if(data && data.entries[term]){
          return normalizeEntry(data.entries[term], context);
        }

        return lookupShard(index + 1);
      });
    }

    return lookupShard(0);
  }

  function lookup(context){
    var term = normalizeDictionaryTerm(context.lookupTerm);

    if(!term){
      return Promise.resolve(unavailable(context, 'not-found'));
    }

    /*
     * Exact Webster entries always win.
     */
    return lookupExact(term, context).then(function(exactResult){
      if(exactResult && exactResult.status === 'available'){
        return exactResult;
      }

      var candidates = getInflectionCandidates(context.lookupTerm);

      function lookupCandidate(index){
        if(index >= candidates.length){
          return unavailable(context, 'not-found');
        }

        return lookupExact(
          candidates[index],
          context
        ).then(function(candidateResult){
          if(
            candidateResult &&
            candidateResult.status === 'available'
          ){
            return candidateResult;
          }

          return lookupCandidate(index + 1);
        });
      }

      return lookupCandidate(0);
    });
  }

  return {
    getShardName: getShardName,
    getShardNames: getShardNames,
    getInflectionCandidates: getInflectionCandidates,
    lookup: lookup
  };
}());