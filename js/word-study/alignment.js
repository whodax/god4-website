(function(root, factory){
  if(typeof module === 'object' && module.exports) module.exports = factory();
  else root.WordStudyAlignment = factory();
}(typeof globalThis !== 'undefined' ? globalThis : this, function(){
  'use strict';
  function matchingGroups(alignment, selection){
    if(!alignment || alignment.status !== 'available') return [];
    return alignment.groups.filter(function(group){
      return Number.isInteger(selection.tokenIndex) ? group.original.includes(selection.tokenIndex) :
        group.english.some(function(span){ return selection.start < span.end && selection.end > span.start; });
    });
  }
  function valid(entry, context, records){
    if(!context || typeof context.verseText !== 'string' || !Array.isArray(records)) return false;
    if(!['translationId','bookId'].every(function(field){ return typeof context[field] === 'string' && context[field].trim(); }) ||
      !['chapter','verse'].every(function(field){ return Number.isInteger(context[field]) && context[field] > 0; })) return false;
    if(!entry || entry.status !== 'verified' || !entry.source ||
      !['title','reference','revision','reviewedBy'].every(function(field){ return typeof entry.source[field] === 'string' && entry.source[field].trim(); })) return false;
    if(!['translationId','bookId','chapter','verse'].every(function(field){ return entry[field] === context[field]; }) ||
      entry.englishText !== context.verseText || !Array.isArray(entry.originalTokens) || !records.length || entry.originalTokens.length !== records.length) return false;
    if(!records.every(function(record, index){
      var expected = entry.originalTokens[index];
      return record.status === 'authoritative' && expected && ['bookId','chapter','verse','tokenIndex','surface'].every(function(field){ return expected[field] === record[field]; });
    })) return false;
    var indexes = new Set(records.map(function(record){ return record.tokenIndex; }));
    if(indexes.size !== records.length || !records.every(function(record){ return Number.isInteger(record.tokenIndex) && record.tokenIndex >= 0; })) return false;
    return Array.isArray(entry.groups) && entry.groups.length > 0 && entry.groups.every(function(group){
      return group && Array.isArray(group.original) && group.original.length > 0 &&
        group.original.every(function(index){ return Number.isInteger(index) && indexes.has(index); }) &&
        Array.isArray(group.english) && group.english.length > 0 && group.english.every(function(span){
          if(!span || !Number.isInteger(span.start) || !Number.isInteger(span.end) || span.start < 0 || span.end <= span.start || span.end > entry.englishText.length) return false;
          var text = entry.englishText;
          var splitsPair = function(offset){ return offset > 0 && /[\uD800-\uDBFF]/.test(text[offset - 1]) && /[\uDC00-\uDFFF]/.test(text[offset] || ''); };
          return !splitsPair(span.start) && !splitsPair(span.end) && text.slice(span.start, span.end).trim().length > 0;
        });
    });
  }
  function createProvider(catalog){
    var entries = JSON.parse(JSON.stringify(Array.isArray(catalog) ? catalog : []));
    return {lookup:function(context, records){
      var matches = entries.filter(function(entry){ return valid(entry, context, records); });
      if(matches.length !== 1) return {status:'unavailable', groups:[]};
      return {status:'available', groups:matches[0].groups, source:matches[0].source};
    }};
  }
  function wordSpans(verse){
    var number = verse && verse.querySelector('.vnum');
    if(!number) return [];
    var words = Array.from(verse.querySelectorAll('[data-word-study-term]'));
    words.forEach(function(word){ word.removeAttribute('data-word-study-start'); word.removeAttribute('data-word-study-end'); });
    var range = document.createRange();
    range.setStartAfter(number);
    range.setEnd(verse, verse.childNodes.length);
    if(range.toString() !== verse.getAttribute('data-verse-text')) return [];
    return words.map(function(word){
      var prefix = range.cloneRange();
      prefix.setEndBefore(word);
      var start = prefix.toString().length;
      word.setAttribute('data-word-study-start', String(start));
      word.setAttribute('data-word-study-end', String(start + word.textContent.length));
      return word;
    });
  }
  var reviewedCatalog = [];
  return {createProvider:createProvider, matchingGroups:matchingGroups, wordSpans:wordSpans, lookup:createProvider(reviewedCatalog).lookup};
}));
