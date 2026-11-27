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
  },{
    status:'verified',
    translationId:'kjv',
    bookId:'acts',
    chapter:8,
    verse:37,
    englishText:'And Philip said, If thou believest with all thine heart, thou mayest. And he answered and said, I believe that Jesus Christ is the Son of God.',
    originalTokens:['ειπεν','δε','ο','φιλιππος','ει','πιστευεις','εξ','ολης','της','καρδιας','εξεστιν','αποκριθεις','δε','ειπεν','πιστευω','τον','υιον','του','θεου','ειναι','τον','ιησουν','χριστον'].map(function(surface, tokenIndex){
      return {bookId:'acts', chapter:8, verse:37, tokenIndex:tokenIndex, surface:surface};
    }),
    source:{
      title:'Acts 8:37 Textus Receptus interlinear',
      reference:'https://www.textusreceptusbibles.com/Strongs/44008037/G3588',
      revision:'Interlinear consulted 2026-11-25',
      reviewedBy:'Codex, checked against the GOD4.us KJV verse and the Robinson Textus Receptus token shard'
    },
    groups:[
      {english:[{start:0, end:3}], original:[1]},
      {english:[{start:4, end:10}], original:[3]},
      {english:[{start:11, end:15}], original:[0]},
      {english:[{start:17, end:19}], original:[4]},
      {english:[{start:20, end:34}], original:[5]},
      {english:[{start:35, end:55}], original:[6,7,8,9]},
      {english:[{start:57, end:68}], original:[10]},
      {english:[{start:70, end:73}], original:[12]},
      {english:[{start:74, end:85}], original:[11]},
      {english:[{start:90, end:94}], original:[13]},
      {english:[{start:96, end:105}], original:[14]},
      {english:[{start:111, end:116}], original:[21]},
      {english:[{start:117, end:123}], original:[22]},
      {english:[{start:124, end:126}], original:[19]},
      {english:[{start:127, end:130}], original:[15]},
      {english:[{start:131, end:134}], original:[16]},
      {english:[{start:135, end:141}], original:[17,18]}
    ]
  }];
  var crosswireSource = {
    title:'CrossWire KJV with Greek word tags',
    reference:'https://gitlab.com/crosswire-bible-society/kjv',
    revision:'d490be7e34762deb2c76cb2c1306d4808e27890d',
    reviewedBy:'GOD4.us reproducible CrossWire alignment validation'
  };
  var webSource = {
    title:'WEB checked against ULT and the original-language witnesses',
    reference:'/data/word-study/alignment/web/NOTICE.md',
    revision:'ULT 91, UHB 3.0.0 and UGNT 0.34',
    reviewedBy:'GOD4.us reproducible WEB alignment validation'
  };
  var webExpanded = Object.assign({},webSource,{revision:'ULT 92, UHB 3.0.0 and UGNT 0.34'});
  var webBerean = Object.assign({},webSource,{
    title:'WEB checked against the Berean translation tables and the original-language witnesses',
    revision:'Berean Standard Bible third printing, UHB 3.0.0 and UGNT 0.34'
  });
  var webConsensus = Object.assign({},webSource,{
    title:'WEB phrase verified against ULT and Berean',
    revision:'ULT 92, Berean Standard Bible third printing, UHB 3.0.0 and UGNT 0.34'
  });
  var webClearHebrew = Object.assign({},webSource,{
    title:'WEB phrase verified against ULT and Clear.Bible Hebrew',
    revision:'ULT 92 and Clear.Bible c99bd0a WLCM–BSB manual alignment'
  });
  var webClearGreek = Object.assign({},webSource,{
    title:'WEB phrase verified against ULT and Clear.Bible Greek',
    revision:'ULT 92 and Clear.Bible c99bd0a SBLGNT–BSB manual alignment'
  });
  function hasReviewedVerse(context){
    return reviewedCatalog.some(function(entry){
      return ['translationId','bookId','chapter','verse'].every(function(field){ return entry[field] === context[field]; });
    });
  }
  var chapterRequests = new Map();
  var webIndexRequest, editionIndexRequest, corpusIndexRequest;
  var editionBase = '/data/word-study/alignment/editions/';
  var editionNames = {kjv:'KJV',web:'WEB',asv:'ASV',ylt:'YLT',dby:'DBY',webster:'WBS',rv:'RV',gnv:'GNV',dra:'Douay-Rheims'};
  var trBase = '/data/word-study/alignment/kjv-tr/';
  var trRevision = '33af6e9361f8db0afd353714d05c75f44e5555b9';
  var trSource = Object.assign({},crosswireSource,{
    title:"KJV CrossWire and Robinson's Textus Receptus",
    reference:'/data/word-study/alignment/kjv-tr/NOTICE.md',
    revision:trRevision
  });
  var trWitness = {base:trBase,revision:trRevision,source:trSource,
    label:"Textus Receptus, Maurice A. Robinson's parsed edition (" + trRevision + ')',
    token:/^[\u0370-\u03ff]+$/};
  var scrivenerWitness = {
    base:'/data/word-study/alignment/kjv-scrivener/',
    revision:'2bac2dae4a0961c84d6d544a40cbef8b8d8c4e32',
    label:'Scrivener 1894 Textus Receptus, parsed transcription',
    token:/^[\p{Script=Greek}\p{Mark}]+$/u,
    source:Object.assign({},crosswireSource,{
      title:'KJV CrossWire and Scrivener 1894 Textus Receptus',
      reference:'/data/word-study/alignment/kjv-scrivener/NOTICE.md',
      revision:'2bac2dae4a0961c84d6d544a40cbef8b8d8c4e32'
    })
  };
  var webBase = '/data/word-study/alignment/web/';
  function requestJson(url){
    var abort = new AbortController();
    var timer = setTimeout(function(){ abort.abort(); }, 3000);
    return fetch(url,{signal:abort.signal}).then(function(response){
      if(!response.ok) throw new Error('Alignment data unavailable');
      return response.json();
    }).finally(function(){ clearTimeout(timer); });
  }
  function loadChapter(url){
    if(!chapterRequests.has(url)){
      var request = requestJson(url).catch(function(){
        if(chapterRequests.get(url) === request) chapterRequests.delete(url);
        return null;
      });
      chapterRequests.set(url,request);
      if(chapterRequests.size > 16) chapterRequests.delete(chapterRequests.keys().next().value);
    }
    return chapterRequests.get(url);
  }
  function lookupChapter(context, records){
    var web = context.translationId === 'web';
    if((!web && context.translationId !== 'kjv') || typeof BibleCanon === 'undefined' || !records.length ||
      !Number.isInteger(context.chapter) || context.chapter < 1 || !/^[a-z0-9-]+$/.test(context.bookId)) return null;
    var book = BibleCanon.book(context.bookId);
    if(!book || (!web && book.testament !== 'new')) return null;
    var location = context.bookId + '/' + context.chapter + '.json';
    if(web && !webIndexRequest){
      webIndexRequest = requestJson(webBase + 'index.json').catch(function(){
        webIndexRequest = null;
        return null;
      });
    }
    var chapterData = web ? webIndexRequest.then(function(index){
      return Array.isArray(index?.[context.bookId]) && index[context.bookId].includes(context.chapter)
        ? loadChapter(webBase + location) : null;
    }) : loadChapter('/data/word-study/alignment/kjv/' + location);
    return chapterData.then(function(chapter){
      var row = chapter?.[context.verse];
      var source = !web ? crosswireSource : row?.[3] === 'clear-hebrew-dual' ? webClearHebrew :
        row?.[3] === 'clear-greek-dual' ? webClearGreek : row?.[3] === 'dual-phrase' ? webConsensus :
        row?.[3]?.startsWith('berean-') ? webBerean : row?.[3] ? webExpanded : webSource;
      return matchChapterRow(context,records,row,source);
    }).catch(function(){ return null; });
  }
  function matchChapterRow(context,records,row,source){
    if(!Array.isArray(row) || row[0] !== context.verseText || !Array.isArray(row[1]) ||
      row[1].length !== records.length || !Array.isArray(row[2])) return null;
    if(!records.every(function(record,index){
      var token = row[1][index];
      return record.bookId === context.bookId && record.chapter === context.chapter && record.verse === context.verse &&
        record.tokenIndex === index && Array.isArray(token) &&
        record.language === (token[3] || 'greek') && record.surface === token[0] &&
        record.strongsNumber === token[1] && record.morphology === token[2];
    })) return null;
    var groups = row[2].map(function(group){
      return {english:group[0].map(function(span){return {start:span[0],end:span[1]};}),original:group[1]};
    });
    var entry = {status:'verified',source:source,translationId:context.translationId,bookId:context.bookId,
      chapter:context.chapter,verse:context.verse,englishText:row[0],originalTokens:records,groups:groups};
    return valid(entry,context,records) ? {status:'available',groups:groups,source:source} : null;
  }
  function lookupEdition(context,records){
    var edition = context.translationId;
    if(!Object.hasOwn(editionNames,edition) || !records.length || !/^[a-z0-9-]+$/.test(context.bookId) ||
      !Number.isInteger(context.chapter) || context.chapter < 1 || !Number.isInteger(context.verse) || context.verse < 1 ||
      /[[\]{}<>]/.test(context.verseText)) return null;
    if(!editionIndexRequest){
      editionIndexRequest = requestJson(editionBase+'index.json').catch(function(){editionIndexRequest=null;return null;});
    }
    var timeout;
    var data = editionIndexRequest.then(async function(index){
      var list = index?.[edition]?.[context.bookId]?.[context.chapter];
      if(!Array.isArray(list) || !list.includes(context.verse)) return null;
      var location = context.bookId+'/'+context.chapter+'.json';
      var chapter = await loadChapter(editionBase+location);
      var plan = chapter?.[edition]?.[context.verse];
      if(!Array.isArray(plan) || !['web','kjv'].includes(plan[0]) || plan[0]===edition ||
        !['exact','typography','independent-phrase'].includes(plan[1])) return null;
      var original = await loadChapter('/data/word-study/alignment/'+plan[0]+'/'+location);
      var row = original?.[context.verse];
      if(!Array.isArray(row) || /[[\]{}<>]/.test(row[0])) return null;
      var mode = plan[1], basis = plan[0]==='web'?'verified WEB':'CrossWire KJV';
      var label = mode==='independent-phrase'?'confirmed local phrase from CrossWire KJV and verified WEB':
        (mode==='exact'?'exact wording and witness from ':'typography checked against ')+basis;
      var witness = edition==='dra' ? ' ('+({greek:'Greek',hebrew:'Hebrew',aramaic:'Aramaic'}[records[0].language] || 'original-language')+' witness)' : '';
      var source = {title:editionNames[edition]+' · '+label+witness,reference:editionBase+'NOTICE.md',
        revision:'Shell 83 edition plan',editionPlan:true,reviewedBy:'GOD4.us automated text, offset and original-token validation'};
      return matchChapterRow(context,records,mode==='exact'?row:[plan[2],row[1],plan[3]],source);
    }).catch(function(){return null;});
    return Promise.race([data,new Promise(function(resolve){timeout=setTimeout(function(){resolve(null);},3000);})])
      .finally(function(){clearTimeout(timeout);});
  }
  var corpusBase = '/data/word-study/alignment/corpus/';
  var corpusMethods = {
    'dual-hebrew':'Clear.Bible and unfoldingWord Hebrew alignment',
    'dual-greek':'Clear.Bible and unfoldingWord Greek alignment',
    'dual-names':'Clear.Bible and unfoldingWord Hebrew names',
    'dual-hebrew-and-names':'Clear.Bible and unfoldingWord Hebrew alignment and names',
    'crosswire-hebrew':'CrossWire KJV with Clear.Bible and unfoldingWord Hebrew positions',
    'crosswire-and-names':'CrossWire KJV, Clear.Bible and unfoldingWord Hebrew alignment and names',
    'crosswire-title':'CrossWire KJV verified Greek alignment',
    'crosswire-supplied':'CrossWire KJV positions outside supplied words'
  };
  function lookupCorpus(context,records){
    var edition=context.translationId;
    if(!Object.hasOwn(editionNames,edition) || !records.length || !/^[a-z0-9-]+$/.test(context.bookId) ||
      !Number.isInteger(context.chapter) || context.chapter < 1 || !Number.isInteger(context.verse) || context.verse < 1) return null;
    if(!corpusIndexRequest){
      corpusIndexRequest=requestJson(corpusBase+'index.json').catch(function(){corpusIndexRequest=null;return null;});
    }
    var timer;
    var data=corpusIndexRequest.then(async function(index){
      var list=index?.[edition]?.[context.bookId]?.[context.chapter];
      if(!Array.isArray(list) || !list.includes(context.verse)) return null;
      var chapter=await loadChapter(corpusBase+context.bookId+'/'+context.chapter+'.json');
      var row=chapter?.editions?.[edition]?.[context.verse];
      var tokens=chapter?.witnesses?.[context.verse];
      if(!Array.isArray(row) || !Object.hasOwn(corpusMethods,row[2]) || typeof row[0]!=='string') return null;
      var marked=[...row[0].matchAll(/\[[^\[\]{}<>]+\]/g)];
      if(/[[\]{}<>]/.test(row[0].replace(/\[[^\[\]{}<>]+\]/g,'')) || row[1].some(function(group){
        return group[0].some(function(span){
          return marked.some(function(word){return word.index<span[1]&&word.index+word[0].length>span[0];});
        });
      })) return null;
      var witness=({hebrew:'Hebrew',aramaic:'Aramaic',greek:'Greek'})[records[0].language];
      if(!witness) return null;
      var method=corpusMethods[row[2]];
      if(witness==='Aramaic') method=method.replace('Hebrew','Aramaic');
      var source={title:editionNames[edition]+' / '+method+' ('+witness+' witness)',
        reference:corpusBase+'NOTICE.md',revision:'Shell 84 corpus',corpusPlan:true,reviewedBy:'GOD4.us verified source agreement and exact word positions'};
      return matchChapterRow(context,records,[row[0],tokens,row[1]],source);
    }).catch(function(){return null;});
    return Promise.race([data,new Promise(function(resolve){timer=setTimeout(function(){resolve(null);},3000);})])
      .finally(function(){clearTimeout(timer);});
  }
  function matchKjvWitness(context, chapter, witness){
    if(!chapter || chapter.revision !== witness.revision || chapter.bookId !== context.bookId ||
      chapter.chapter !== context.chapter || !chapter.lexicon ||
      !Object.hasOwn(chapter.verses || {}, context.verse)) return null;
    var row = chapter.verses[context.verse];
    if(!Array.isArray(row) || row[0] !== context.verseText ||
      !Array.isArray(row[1]) || !Array.isArray(row[2])) return null;
    if(!row[1].every(function(token){
      return Array.isArray(token) && token.length === 3 && typeof token[0] === 'string' && witness.token.test(token[0]) &&
        typeof token[1] === 'string' && /^G[1-9]\d{0,4}$/.test(token[1]) &&
        typeof token[2] === 'string' && /^[A-Z][A-Z0-9-]+$/.test(token[2]);
    })) return null;
    var records = row[1].map(function(token, index){
      var fields = chapter.lexicon[token[1]];
      var lexical = function(i){ return typeof fields?.[i] === 'string' ? fields[i] : null; };
      return {status:'authoritative',language:'greek',source:witness.label,
        bookId:context.bookId,chapter:context.chapter,verse:context.verse,tokenIndex:index,
        surface:token[0],strongsNumber:token[1],morphology:token[2],lemma:lexical(0),
        transliteration:lexical(1),pronunciation:lexical(2),definition:lexical(3),partOfSpeech:null};
    });
    var groups = row[2].map(function(group){
      return {english:group[0].map(function(span){return {start:span[0],end:span[1]};}),original:group[1]};
    });
    var entry = {status:'verified',source:witness.source,translationId:'kjv',bookId:context.bookId,
      chapter:context.chapter,verse:context.verse,englishText:row[0],originalTokens:records,groups:groups};
    return valid(entry,context,records) ?
      {status:'available',records:records,alignment:{status:'available',groups:groups,source:witness.source}} : null;
  }
  function lookupKjvWitness(context,witness=trWitness){
    if(context.translationId !== 'kjv' || typeof BibleCanon === 'undefined' ||
      !/^[a-z0-9-]+$/.test(context.bookId) || BibleCanon.book(context.bookId)?.testament !== 'new' ||
      !Number.isInteger(context.chapter) || context.chapter < 1 ||
      !Number.isInteger(context.verse) || context.verse < 1) return null;
    if(!witness.indexRequest){
      witness.indexRequest = requestJson(witness.base + 'index.json').catch(function(){
        witness.indexRequest = null;
        return null;
      });
    }
    return witness.indexRequest.then(function(index){
      var verses = index?.[context.bookId]?.[context.chapter];
      return Array.isArray(verses) && verses.includes(context.verse) ?
        loadChapter(witness.base + context.bookId + '/' + context.chapter + '.json') : null;
    }).then(function(chapter){return matchKjvWitness(context,chapter,witness);}).catch(function(){return null;});
  }
  function lookupScrivenerWitness(context){
    return lookupKjvWitness(context,scrivenerWitness);
  }
  function contextualDefinition(study, records, alignment){
    if(alignment?.status !== 'available') return null;
    var term = study.displayWord;
    var text = study.verseText;
    var sense;
    var noun = /^N-/;
    var partOfSpeech='noun';
    if(term === 'Christ'){
      sense = ['G5547','The Anointed One, the Messiah.','Greek Christos'];
    }else if(alignment.source.corpusPlan){
      if(term === 'Moab' && study.bookId === 'numbers' && study.chapter === 21 && study.verse === 20){
        sense=['H4124','The territory east of the Dead Sea. This verse names it while describing Israel’s route.','Hebrew Moab'];
        noun=/^HNp$/;
      }else if(term === 'Moab' && study.bookId === '2-kings' && study.chapter === 3 && study.verse === 23){
        sense=['H4124','The Moabite people, called to take what they think is abandoned enemy property.','Hebrew Moab'];
        noun=/^HNp$/;
      }else if(term === 'Philistines' && study.bookId === '1-samuel' && study.chapter === 23 && study.verse === 1){
        sense=['H6430','The people attacking Keilah and taking grain from its threshing floors.','Hebrew Pelishtim'];
        noun=/^HNgmpa$/;
      }else if(term === 'spoke' && study.bookId === 'judges' && study.chapter === 14 && study.verse === 7){
        sense=['H1696','Talked with the woman. Samson went down to meet her and speak with her.','Hebrew dabar'];
        noun=/^HC\/Vpw3ms$/;
        partOfSpeech='verb';
      }
    }else if(alignment.source.editionPlan){
      if(term === 'Word' && study.bookId === 'john' && study.chapter === 1 && study.verse === 1){
        sense=['G3056','The title John uses here for the one who was with God and was God.','Greek logos'];
      }else if(term === 'begat' && study.bookId === 'matthew' && study.chapter === 1){
        sense=['G1080','Became the father of the person named next in this genealogy.','Greek gennaō'];
        noun=/^V-AAI-3S$/;
        partOfSpeech='verb';
      }else if(term === 'Seraiah' && study.bookId === 'nehemiah' && study.chapter === 10 && study.verse === 2){
        sense=['H8304','One of the people listed as sealing the covenant in this chapter.','Hebrew Seraiah'];
        noun=/^H(?:[^/]+\/)*Np$/;
      }
    }else if(alignment.source === trSource){
      if(term === 'inhabitants' && study.bookId === 'revelation' && study.chapter === 17 && study.verse === 2){
        sense=['G2730','People who live on the earth. In this vision they share in Babylon’s corruption.','Greek katoikeō'];
        noun=/^V-PAP-NPM$/;
      }else if(term === 'Bethabara' && study.bookId === 'john' && study.chapter === 1 && study.verse === 28){
        sense=['G962','The place beyond the Jordan where John was baptizing in this KJV verse.','Greek Bethabara'];
        noun=/^N-DSF$/;
      }else if(term === 'begat' && study.bookId === 'matthew' && study.chapter === 1 && study.verse === 6){
        sense=['G1080','Became the father of the person named next in this genealogy.','Greek gennaō'];
        noun=/^V-AAI-3S$/;
        partOfSpeech='verb';
      }
    }else if(alignment.source === webClearHebrew && study.translationId === 'web'){
      if(study.bookId === 'job' && study.chapter === 19 && study.verse === 12 && /encamp around my tent/.test(text)){
        noun=/^H(?:R\/)?N/;
        if(term === 'tent'){
          sense=['H168','A portable shelter. Job pictures troops surrounding his dwelling.','Hebrew ohel'];
        }else if(term === 'around'){
          sense=['H5439','Surrounding Job’s dwelling on all sides in his picture of a siege.','Hebrew saviv'];
          partOfSpeech='preposition';
        }
      }else if(term === 'around' && study.bookId === 'proverbs' && study.chapter === 6 && study.verse === 21 && /around your neck/.test(text)){
        sense=['H5921','Encircling the neck. The verse pictures keeping the teaching close, like something tied around the neck.','Hebrew al'];
        noun=/^HR$/;
        partOfSpeech='preposition';
      }
    }else if(alignment.source === webConsensus && study.translationId === 'web'){
      if(term === 'kindness' && study.bookId === 'galatians' && study.chapter === 5 && study.verse === 22 && /fruit of the Spirit/.test(text)){
        sense = ['G5544','Treating others with goodness and consideration, listed here as fruit of the Spirit.','Greek chrestotes'];
      }else if(term === 'prayer' && study.bookId === '1-timothy' && study.chapter === 4 && study.verse === 5 && /through the word of God and prayer/.test(text)){
        sense = ['G1783','An appeal to God, here connected with receiving food with thanksgiving.','Greek enteuxis'];
      }
    }else if(study.translationId === 'web' && [webSource,webExpanded,webBerean].includes(alignment.source)){
      if(term === 'Ephraim' && /\bEphraim will become a desolation\b/.test(text)){
        sense = ['H669','The tribe descended from Ephraim, the name Hosea uses here for the northern kingdom of Israel.','Hebrew Ephraim'];
        noun = /^H(?:[^/]+\/)*Np$/;
      }else if(term === 'Joshua' && /\bNun his son, and Joshua his son\b/.test(text)){
        sense = ['H3091','Joshua son of Nun, listed here among the descendants of Ephraim.','Hebrew Yehoshua'];
        noun = /^H(?:[^/]+\/)*Np$/;
      }else if(term === 'Lord' && /\bSon of Man is Lord of the Sabbath\b/.test(text)){
        sense = ['G2962','The one who has authority over the Sabbath.','Greek kyrios'];
      }else if(term === 'light' && /\bI am the light of the world\b/.test(text)){
        sense = ['G5457','Jesus describes himself as the one who gives people spiritual sight.','Greek phōs'];
      }else if(term === 'love' && /\bin brotherly affection, love\b/.test(text)){
        sense = ['G26','Care for others that goes beyond affection for those close to you.','Greek agapē'];
      }
    }
    if(!sense) return null;
    var linked = new Set(matchingGroups(alignment,{start:study.englishStart,end:study.englishEnd})
      .flatMap(function(group){ return group.original; }));
    if(!records.some(function(record){
      return linked.has(record.tokenIndex) && record.strongsNumber === sense[0] && noun.test(record.morphology);
    })) return null;
    return {partOfSpeech:partOfSpeech,definition:sense[1],source:'Scripture context · ' + sense[2] + ' (' + sense[0] + ')'};
  }
  return {createProvider:createProvider, matchingGroups:matchingGroups, wordSpans:wordSpans, lookupChapter:lookupChapter, lookupKjvWitness:lookupKjvWitness, lookupEdition:lookupEdition, lookupCorpus:lookupCorpus, lookupScrivenerWitness:lookupScrivenerWitness, hasReviewedVerse:hasReviewedVerse,
    contextualDefinition:contextualDefinition, lookup:createProvider(reviewedCatalog).lookup};
}));
