/* Pure English sense selection. No corpus changes, network, POS tagger, or original-language alignment. */
var WordStudySenseSelector = (function createWordStudySenseSelector(){
  var minimumMargin = 1.5;
  var minimumEvidence = 1.5;
  var stopWords = new Set(('a an the and or but if as at by for from in into of on to with without ' +
    'is are was were be been being am it its this that these those he she they we you i ' +
    'his her their our your him them us who whom which what when where how ' +
    'not no so then than there here all any some each both also very do does did ' +
    'have has had will would shall should may might can could unto upon').split(' '));

  function tokens(text){ return String(text || '').match(/[A-Za-z]+(?:'[A-Za-z]+)?/g) || []; }
  function root(token){
    var value = token.toLowerCase().replace(/'s$/, '');
    // Feature-only suffix folding; dictionary headword/inflection lookup is never changed.
    var folded = value.replace(/(?:ing|ed|er|or|s)$/, '');
    return folded.length >= 4 || (/s$/.test(value) && folded.length >= 3) ? folded : value;
  }
  function coreText(text){
    // Score the opening definition, not accumulated quotations/compound examples.
    var unquoted = text.replace(/"[^"]*"|\u201c[^\u201d]*\u201d/g, ' ');
    // Webster's explicitly introduced examples are not definition evidence.
    // Keep ordinary uses of "as" within the definition; only trim marked clauses.
    var meaning = unquoted.split(/[;:]\s*(?:as\b|e\.g\.|for example\b)/i)[0];
    var sentence = meaning.match(/^.*?(?:[.!?](?=\s+[A-Z])|$)/);
    return (sentence ? sentence[0] : unquoted).slice(0, 420);
  }
  function select(definitions, context){
    if(!Array.isArray(definitions) || !definitions.length){
      return {selectedIndex:-1, confidence:0, reasons:['no-candidates'], ambiguous:false};
    }
    context = context || {};
    var excluded = new Set(tokens(context.lookupTerm || context.displayWord).concat(tokens(context.matchedHeadword)).map(root));
    var verseTokens = tokens(context.verseText);
    var surrounding = new Set(verseTokens.filter(function(token){
      return token.length >= 3 && !stopWords.has(token.toLowerCase()) && !excluded.has(root(token));
    }).map(root));
    // A generic named-person/title/place construction, not a rule for a particular headword/book.
    var namedRole = verseTokens.some(function(token, index){
      return excluded.has(root(token)) && index > 0 && index + 2 < verseTokens.length &&
        /^[A-Z][a-z]/.test(verseTokens[index - 1]) && verseTokens[index + 1].toLowerCase() === 'of' &&
        /^[A-Z][a-z]/.test(verseTokens[index + 2]);
    });
    var capitalized = /^[A-Z][a-z]/.test(context.displayWord || '') && verseTokens.some(function(token, index){
      return index > 0 && excluded.has(root(token));
    });
    var ranked = definitions.map(function(definition, index){
      var text = definition && typeof definition.text === 'string' ? definition.text : '';
      var core = coreText(text);
      var score = 0, evidence = 0, reasons = [];
      var artifact = !/[A-Za-z]/.test(text) || /^(?:pl\.|sing\.|n\.|v\.(?:\s*[it]\.)?|a\.|adv\.)\s*$/i.test(text.trim());
      if(artifact){ score -= 6; reasons.push('definition-artifact:-6'); }
      if(/^\s*[,;:)\]]/.test(text)){ score -= 3; reasons.push('continuation-fragment:-3'); }
      var obsolete = /\[\s*(?:obs\.?|archaic)\s*\]|\bobs\.|\b(?:obsolete|archaic)\b/i.test(text);
      if(obsolete){
        score -= 1.5; reasons.push('obsolete-label:-1.5');
      }
      var compound = text.length > 1000 && /--|\([A-Za-z]+\.\)/.test(text);
      if(compound){ score -= 0.75; reasons.push('compound-blob:-0.75'); }
      var words = new Set(tokens(core).filter(function(token){
        return token.length >= 3 && !stopWords.has(token.toLowerCase()) && !excluded.has(root(token));
      }).map(root));
      var overlap = 0;
      surrounding.forEach(function(word){ if(words.has(word)) overlap++; });
      var overlapScore = Math.min(2, overlap) * 1.25;
      if(overlapScore){ score += overlapScore; evidence += overlapScore; reasons.push('context-overlap:+' + overlapScore); }
      // Only explicit human-role language in the opening definition supports this relation.
      var roleEvidence = namedRole && /\b(?:person|individual|someone|ruler|sovereign|monarch|prince|officer|leader|owner|teacher|captain|messenger|inhabitant)\b/i.test(core) &&
        (!definition.partOfSpeech || definition.partOfSpeech === 'noun');
      if(roleEvidence){
        score += 3; evidence += 3; reasons.push('named-role-context:+3');
      }
      var titleEvidence = capitalized && definition && definition.partOfSpeech === 'noun' && /\b[A-Z][a-z]+\s+[A-Z][a-z]+\b/.test(core);
      if(titleEvidence){
        score += 0.25; evidence += 0.25; reasons.push('capitalization:+0.25');
      }
      var pos = definition && definition.partOfSpeech;
      var meaningfulPos = /^(?:noun|verb|adjective|adverb|pronoun|preposition|conjunction|interjection)$/.test(pos) ? pos : '';
      return {index:index, score:score, evidence:evidence, reasons:reasons, artifact:artifact, compound:compound,
        obsolete:obsolete, roleEvidence:roleEvidence, titleEvidence:!!titleEvidence, pos:meaningfulPos};
    }).sort(function(left, right){ return right.score - left.score || left.index - right.index; });
    var top = ranked[0];
    var margin = ranked.length > 1 ? top.score - ranked[1].score : Infinity;
    var original = ranked.find(function(candidate){ return candidate.index === 0; });
    // Shared words can describe an unrelated sense. Require an existing,
    // independent signal before they may displace the original candidate.
    var corroborated = top.roleEvidence || top.titleEvidence || original.artifact ||
      (original.obsolete && top.evidence > 0);
    // Do not infer English grammar. Only an explicit role construction or a
    // capitalized noun title replacing an obsolete sense supports a POS change.
    var posChange = original.pos && top.pos && original.pos !== top.pos;
    var posSupported = !posChange || original.artifact || top.roleEvidence ||
      (original.obsolete && top.titleEvidence);
    var promotionSupported = top.index === 0 || (corroborated && posSupported);
    var clear = margin >= minimumMargin && !top.artifact && !top.compound &&
      (top.evidence >= minimumEvidence || original.artifact || ranked.length === 1) && promotionSupported;
    var selected = clear ? top : original;
    // A grammar marker is not a usable definition; choose the earliest best substantive candidate.
    if(original.artifact && !top.artifact) selected = top;
    var ambiguous = !clear;
    var reasons = selected.reasons.slice();
    if(top.index !== 0 && !corroborated) reasons.push('promotion-without-corroboration');
    if(top.index !== 0 && !posSupported) reasons.push('unsupported-part-of-speech-change');
    if(selected.index !== 0 && corroborated) reasons.push('promotion-corroborated');
    if(ambiguous){ reasons.push('insufficient-margin-or-evidence', 'ambiguity-exposed'); }
    if(selected.index === 0) reasons.push('original-order-preserved');
    return {selectedIndex:selected.index, confidence:ambiguous ? 0 : Math.min(1, margin / 3),
      reasons:reasons, ambiguous:ambiguous};
  }
  return {select:select};
}());
