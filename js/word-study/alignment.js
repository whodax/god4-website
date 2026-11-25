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
    var source = '', offsets = new Map(), wordSet = new Set(words);
    var kjv = verse.getAttribute('data-translation-id') === 'kjv';
    function read(node){
      var supplied = kjv && node.nodeType === 1 && node.tagName === 'I';
      if(supplied) source += '[';
      var start = source.length;
      if(node.nodeType === 3) source += node.nodeValue;
      else Array.from(node.childNodes).forEach(read);
      if(wordSet.has(node)) offsets.set(node, {start:start, end:source.length});
      if(supplied) source += ']';
    }
    var children = Array.from(verse.childNodes), first = children.indexOf(number);
    if(first < 0) return [];
    children.slice(first + 1).forEach(read);
    if(source !== verse.getAttribute('data-verse-text') || words.some(function(word){
      var span = offsets.get(word);
      return !span || source.slice(span.start, span.end) !== word.textContent;
    })) return [];
    return words.map(function(word){
      var span = offsets.get(word);
      word.setAttribute('data-word-study-start', String(span.start));
      word.setAttribute('data-word-study-end', String(span.end));
      return word;
    });
  }
  var reviewedCatalog = [{
    status:'verified',
    translationId:'web',
    bookId:'genesis',
    chapter:1,
    verse:1,
    englishText:'In the beginning, God created the heavens and the earth.',
    originalTokens:['בְּ/רֵאשִׁ֖ית', 'בָּרָ֣א', 'אֱלֹהִ֑ים', 'אֵ֥ת', 'הַ/שָּׁמַ֖יִם', 'וְ/אֵ֥ת', 'הָ/אָֽרֶץ'].map(function(surface, tokenIndex){
      return {bookId:'genesis', chapter:1, verse:1, tokenIndex:tokenIndex, surface:surface};
    }),
    source:{
      title:'Genesis 1:1 Hebrew interlinear',
      reference:'https://biblehub.com/interlinear/genesis/1-1.htm',
      revision:'Interlinear consulted 2026-11-24',
      reviewedBy:'Codex, checked against the GOD4.us WEB verse and Genesis token shard'
    },
    groups:[
      {english:[{start:0, end:16}], original:[0]},
      {english:[{start:18, end:21}], original:[2]},
      {english:[{start:22, end:29}], original:[1]},
      {english:[{start:30, end:41}], original:[4]},
      {english:[{start:42, end:45}], original:[5]},
      {english:[{start:46, end:55}], original:[6]}
    ]
  },{
    status:'verified',
    translationId:'web',
    bookId:'john',
    chapter:1,
    verse:1,
    englishText:'In the beginning was the Word, and the Word was with God, and the Word was God.',
    originalTokens:['εν','αρχη','ην','ο','λογος','και','ο','λογος','ην','προς','τον','θεον','και','θεος','ην','ο','λογος'].map(function(surface, tokenIndex){
      return {bookId:'john', chapter:1, verse:1, tokenIndex:tokenIndex, surface:surface};
    }),
    source:{
      title:'John 1:1 Greek interlinear',
      reference:'https://biblehub.com/interlinear/john/1-1.htm',
      revision:'Interlinear consulted 2026-11-25',
      reviewedBy:'Codex, checked against the GOD4.us WEB verse and the Byzantine John token shard'
    },
    groups:[
      {english:[{start:0, end:2}], original:[0]},
      {english:[{start:7, end:16}], original:[1]},
      {english:[{start:17, end:20}], original:[2]},
      {english:[{start:21, end:24}], original:[3]},
      {english:[{start:25, end:29}], original:[4]},
      {english:[{start:31, end:34}], original:[5]},
      {english:[{start:35, end:38}], original:[6]},
      {english:[{start:39, end:43}], original:[7]},
      {english:[{start:44, end:47}], original:[8]},
      {english:[{start:48, end:52}], original:[9]},
      {english:[{start:53, end:56}], original:[11]},
      {english:[{start:58, end:61}], original:[12]},
      {english:[{start:62, end:65}], original:[15]},
      {english:[{start:66, end:70}], original:[16]},
      {english:[{start:71, end:74}], original:[14]},
      {english:[{start:75, end:78}], original:[13]}
    ]
  },{
    status:'verified',
    translationId:'web',
    bookId:'john',
    chapter:1,
    verse:3,
    englishText:'All things were made through him. Without him, nothing was made that has been made.',
    originalTokens:['παντα','δι','αυτου','εγενετο','και','χωρις','αυτου','εγενετο','ουδε','εν','ο','γεγονεν'].map(function(surface, tokenIndex){
      return {bookId:'john', chapter:1, verse:3, tokenIndex:tokenIndex, surface:surface};
    }),
    source:{
      title:'John 1:3 Greek interlinear',
      reference:'https://biblehub.com/interlinear/john/1-3.htm',
      revision:'Interlinear consulted 2026-11-25',
      reviewedBy:'Codex, checked against the GOD4.us WEB verse and the Byzantine John token shard'
    },
    groups:[
      {english:[{start:0, end:10}], original:[0]},
      {english:[{start:11, end:20}], original:[3]},
      {english:[{start:21, end:28}], original:[1]},
      {english:[{start:29, end:32}], original:[2]},
      {english:[{start:34, end:41}], original:[5]},
      {english:[{start:42, end:45}], original:[6]},
      {english:[{start:47, end:54}], original:[8,9]},
      {english:[{start:55, end:63}], original:[7]},
      {english:[{start:64, end:68}], original:[10]},
      {english:[{start:69, end:82}], original:[11]}
    ]
  },{
    status:'verified',
    translationId:'web',
    bookId:'exodus',
    chapter:10,
    verse:1,
    englishText:'The LORD said to Moses, “Go in to Pharaoh, for I have hardened his heart and the heart of his servants, that I may show these my signs among them;',
    originalTokens:[
      'וַ/יֹּ֤אמֶר', 'יְהוָה֙', 'אֶל', 'מֹשֶׁ֔ה', 'בֹּ֖א', 'אֶל', 'פַּרְעֹ֑ה', 'כִּֽי', 'אֲנִ֞י', 'הִכְבַּ֤דְתִּי',
      'אֶת', 'לִבּ/וֹ֙', 'וְ/אֶת', 'לֵ֣ב', 'עֲבָדָ֔י/ו', 'לְמַ֗עַן', 'שִׁתִ֛/י', 'אֹתֹתַ֥/י', 'אֵ֖לֶּה', 'בְּ/קִרְבּֽ/וֹ'
    ].map(function(surface, tokenIndex){
      return {bookId:'exodus', chapter:10, verse:1, tokenIndex:tokenIndex, surface:surface};
    }),
    source:{
      title:'Exodus 10:1 Hebrew interlinear',
      reference:'https://biblehub.com/interlinear/exodus/10-1.htm',
      revision:'Interlinear consulted 2026-11-24',
      reviewedBy:'Codex, checked against the GOD4.us WEB verse and Exodus token shard'
    },
    groups:[
      {english:[{start:4, end:8}], original:[1]},
      {english:[{start:17, end:22}], original:[3]}
    ]
  },{
    status:'verified',
    translationId:'web',
    bookId:'mark',
    chapter:2,
    verse:7,
    englishText:'“Why does this man speak blasphemies like that? Who can forgive sins but God alone?”',
    originalTokens:['τι','ουτος','ουτως','λαλει','βλασφημιας','τις','δυναται','αφιεναι','αμαρτιας','ει','μη','εις','ο','θεος'].map(function(surface, tokenIndex){
      return {bookId:'mark', chapter:2, verse:7, tokenIndex:tokenIndex, surface:surface};
    }),
    source:{
      title:'Mark 2:7 Greek interlinear',
      reference:'https://www.blueletterbible.org/tools/interlinear/tr/mar/2/7/',
      revision:'Interlinear consulted 2026-11-24',
      reviewedBy:'Codex, checked against the GOD4.us WEB verse and the Byzantine Mark token shard'
    },
    groups:[{english:[{start:73, end:76}], original:[13]}]
  }];
  return {createProvider:createProvider, matchingGroups:matchingGroups, wordSpans:wordSpans, lookup:createProvider(reviewedCatalog).lookup};
}));
