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

    // Prefer the reviewed Webster sense for the capitalized biblical name.
    var godSense = normalizeDictionaryTerm(entry.word) === 'god' && context.bookId && Number.isInteger(context.chapter) &&
      Number.isInteger(context.verse) && /^God(?:['’]s)?$/.test(context.displayWord) ?
      definitions.findIndex(function(definition){
        return definition.partOfSpeech === 'noun' && definition.text.startsWith('The Supreme Being;');
      }) : -1;
    var selection = godSense >= 0 ? {selectedIndex:godSense, confidence:1, reasons:['reviewed-scripture-sense'], ambiguous:false} :
      typeof WordStudySenseSelector === 'undefined' ? {
      selectedIndex:0, confidence:0, reasons:['selector-unavailable'], ambiguous:definitions.length > 1
    } : WordStudySenseSelector.select(definitions, Object.assign({}, context, {matchedHeadword:entry.word}));
    var selectedDefinition = definitions[selection.selectedIndex];

    var relatedWords = godSense < 0 && Array.isArray(entry.relatedWords)
      ? entry.relatedWords
          .filter(function(word){
            return typeof word === 'string' && word.trim();
          })
          .slice(0, 12)
      : [];

    return {
      status: 'available',
      word: context.displayWord,
      definition: selectedDefinition.text,
      partOfSpeech: selectedDefinition.partOfSpeech,
      definitions: definitions,
      senseSelection: selection,
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

  function scriptureDefinition(term, context){
    if(!context.bookId || !Number.isInteger(context.chapter) || !Number.isInteger(context.verse)) return null;
    var headword = term.replace(/'s$/, '');
    if(headword === 'moses' && /^Moses(?:['’]s?)?$/.test(context.displayWord)){
      return {partOfSpeech:'proper noun', definition:'The man God called to lead the Israelites out of Egypt.', source:'Exodus 3:7–10'};
    }
    if(headword === 'lord'){
      var book = typeof BibleCanon === 'undefined' ? null : BibleCanon.book(context.bookId);
      if(book && book.testament === 'old' && /^LORD(?:['’][sS])?$/.test(context.displayWord)){
        return {partOfSpeech:'proper noun', definition:'In the Old Testament, LORD in all capitals usually represents YHWH (Yahweh), the personal name of God.', source:'Scripture usage'};
      }
      return {partOfSpeech:'noun', definition:'A title expressing authority or respect, used for God, Jesus, or a human ruler or master.', source:'Scripture usage'};
    }
    return null;
  }

  function verseRuleMatches(rules, term, context){
    var selected = [];
    var text = context.verseText;
    var hasOffset = Number.isInteger(context.englishStart) && context.englishStart >= 0;
    for(var token of text.matchAll(/[A-Za-z0-9]+(?:['’\-][A-Za-z0-9]+)*/g)){
      if(normalizeDictionaryTerm(token[0]) !== term ||
        (hasOffset ? token.index !== context.englishStart : token[0] !== context.displayWord)) continue;
      var marked = (text.slice(0, token.index) + 'xqzstudytoken' + text.slice(token.index + token[0].length))
        .toLowerCase().replace(/’/g, "'").replace(/\s+/g, ' ');
      var matches = new Set(rules.filter(function(rule){
        return new RegExp(rule[1].replace(/@/g, 'xqzstudytoken')).test(marked);
      }).map(function(rule){ return rule[0]; }));
      selected.push(matches.size === 1 ? matches.values().next().value : -1);
    }
    return selected.length && selected.every(function(index){ return index === selected[0]; }) ? selected[0] : -1;
  }

  function commonDefinition(catalog, term, context){
    var entry = catalog && Object.hasOwn(catalog.entries, term) && catalog.entries[term];
    if(!entry || !Array.isArray(entry.meanings) || !entry.meanings.length) return null;
    var meanings = entry.meanings;
    var choice = meanings.length === 1 ? 0 : -1;
    var matchedContext = false;
    if(term === 'god' || term === "god's"){
      choice = /^(?:God|GOD)(?:['’][sS])?$/.test(context.displayWord) ? 0 : 1;
      matchedContext = true;
    }else if(term === "lord's"){
      var book = typeof BibleCanon === 'undefined' ? null : BibleCanon.book(context.bookId);
      choice = book && book.testament === 'old' && /^LORD['’][sS]$/.test(context.displayWord) ? 1 : 0;
      matchedContext = true;
    }else if(entry.rules){
      choice = verseRuleMatches(entry.rules, term, context);
      matchedContext = choice >= 0;
    }
    var meaning = choice >= 0 ? meanings[choice] : meanings.join(' ');
    return {
      definition:meaning,
      partOfSpeech:term === 'god' || term === 'king' ? 'noun' : term === 'moses' ? 'proper noun' : '',
      source:choice < 0 ? 'Common Bible meanings · Context uncertain' :
        matchedContext ? 'Bible usage · Matched to this verse' : 'Common Bible usage'
    };
  }

  function lookupDictionary(term, context){
    /*
     * Exact Webster entries take precedence over inflection fallbacks.
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

  function lookup(context){
    var term = normalizeDictionaryTerm(context.lookupTerm);
    if(!term) return Promise.resolve(unavailable(context, 'not-found'));
    var scripture = scriptureDefinition(term, context);
    var result = {status:'available', word:context.displayWord, relatedWords:[]};
    if(context.translationId !== 'web' || !context.bookId || typeof context.verseText !== 'string' || term === 'lord'){
      return scripture ? Promise.resolve(Object.assign(result, scripture)) : lookupDictionary(term, context);
    }
    return loadShard('web-common-words').then(function(catalog){
      var usage = commonDefinition(catalog, term, context) || scripture;
      return usage ? Object.assign(result, usage) : lookupDictionary(term, context);
    });
  }

  return {
    getShardName: getShardName,
    getShardNames: getShardNames,
    getInflectionCandidates: getInflectionCandidates,
    lookup: lookup
  };
}());
