/* ===== SCRIPTURE WORD STUDY CONTROLLER ===== */
var WordStudyController = (function createWordStudyController(){
  var activatingWord = null;
  var requestId = 0;
  var initialized = false;
  var alignmentAttempted = false;
  var fallbackAlignmentApi = {lookup:function(){ return {status:'unavailable',groups:[]}; }, matchingGroups:function(){ return []; }, wordSpans:function(){ return []; }};
  var readyAlignmentApi = fallbackAlignmentApi;
  var alignmentApi = fallbackAlignmentApi;
  var activeContext = null;
  var activeAlignment = {status:'unavailable', groups:[]};
  var updateVerseInset = function(){};

  function elements(){
    return {
      panel: document.getElementById('wordStudyPanel'),
      word: document.getElementById('wordStudyWord'),
      reference: document.getElementById('wordStudyReference'),
      partOfSpeech: document.getElementById('wordStudyPartOfSpeech'),
      verse: document.getElementById('wordStudyVerse'),
      definition: document.getElementById('wordStudyDefinition'),
      related: document.getElementById('wordStudyRelated'),
      source: document.getElementById('wordStudySource'),
      original: document.getElementById('wordStudyOriginalLanguage'),
      originalTokens: document.getElementById('wordStudyOriginalTokens'),
      originalDetails: document.getElementById('wordStudyOriginalDetails'),
      status: document.getElementById('wordStudyStatus'),
      close: document.getElementById('wordStudyClose')
    };
  }

  function setPanelState(state, context, result){
    var view = elements();
    if(!view.panel) return;
    view.panel.hidden = false;
    view.panel.setAttribute('data-word-study-state', state);
    view.word.textContent = context.displayWord;
    view.reference.textContent = context.bookName + ' ' + context.chapter + ':' + context.verse;
    view.partOfSpeech.textContent = state === 'available' && result.partOfSpeech ? result.partOfSpeech : '';
    if(view.verse.textContent !== context.verseText) view.verse.textContent = context.verseText;
    view.definition.textContent = state === 'loading' ? 'Looking up this word...' : state === 'available' ? result.definition : result.message;
    view.related.textContent = state === 'available' && Array.isArray(result.relatedWords) && result.relatedWords.length ? 'Related words: ' + result.relatedWords.join(', ') : '';
    view.source.textContent = state === 'available' ? 'Public Domain Word Study' : '';
    view.status.textContent = state === 'loading' ? 'Looking up ' + context.displayWord + '.' : 'Studying ' + context.displayWord + ', ' + context.bookName + ' ' + context.chapter + ':' + context.verse + '.';
    var heading = document.getElementById('wordStudyHeading');
    if(heading && document.activeElement === activatingWord) heading.focus();
  }

  function clearOriginalLanguage(){
    var view = elements();
    if(!view.original) return;
    view.original.hidden = true;
    document.getElementById('wordStudyOriginalIntro').hidden = true;
    document.getElementById('wordStudyAlignmentStatus').textContent = 'Exact word alignment is unavailable. Original-language entries, when available, describe the whole verse.';
    view.originalTokens.textContent = '';
    view.originalDetails.textContent = '';
    view.originalDetails.hidden = true;
  }

  function displayLanguage(language){
    return language === 'hebrew' ? 'Hebrew' : language === 'aramaic' ? 'Aramaic' : language === 'greek' ? 'Greek' : language;
  }

  function highlightAlignment(selection){
    var view = elements();
    var groups = alignmentApi.matchingGroups(activeAlignment, selection);
    var spans = groups.flatMap(function(group){ return group.english; });
    function aligned(start, end){ return spans.some(function(span){ return start < span.end && end > span.start; }); }
    view.verse.querySelectorAll('[data-english-start]').forEach(function(element){
      var linked = aligned(Number(element.dataset.englishStart), Number(element.dataset.englishEnd));
      element.setAttribute('data-aligned', String(linked));
      if(element.getAttribute('role') === 'button') element.setAttribute('aria-pressed', String(linked));
    });
    var readerVerse = activatingWord && activatingWord.closest('.reader-verse');
    if(readerVerse) readerVerse.querySelectorAll('[data-word-study-start]').forEach(function(element){
      element.setAttribute('data-aligned', String(aligned(Number(element.getAttribute('data-word-study-start')), Number(element.getAttribute('data-word-study-end')))));
    });
    view.originalTokens.querySelectorAll('button').forEach(function(button){
      var linked = groups.some(function(group){ return group.original.includes(Number(button.getAttribute('data-original-language-token-index'))); });
      button.setAttribute('data-aligned', String(linked));
      if(linked) button.setAttribute('aria-description', 'Aligned with the highlighted English phrase.');
      else button.removeAttribute('aria-description');
    });
    document.getElementById('wordStudyAlignmentStatus').textContent = groups.length ?
      'Verified phrase alignment: ' + activeAlignment.source.title + '.' :
      'Exact word alignment is unavailable for this selection. Original-language entries, when available, describe the whole verse.';
    updateVerseInset();
  }

  function renderEnglishVerse(){
    var view = elements();
    var text = activeContext.verseText;
    var boundaries = new Set([0, text.length]);
    activeAlignment.groups.forEach(function(group){ group.english.forEach(function(span){ boundaries.add(span.start); boundaries.add(span.end); }); });
    var selection = {start:activeContext.englishStart, end:activeContext.englishEnd};
    if(Number.isInteger(selection.start) && selection.start >= 0 && selection.end > selection.start && selection.end <= text.length){ boundaries.add(selection.start); boundaries.add(selection.end); }
    var offsets = Array.from(boundaries).sort(function(left, right){ return left - right; });
    view.verse.textContent = '';
    offsets.slice(0, -1).forEach(function(start, index){
      var end = offsets[index + 1];
      var span = document.createElement('span');
      span.textContent = text.slice(start, end);
      span.dataset.englishStart = String(start);
      span.dataset.englishEnd = String(end);
      if(start < selection.end && end > selection.start) span.setAttribute('data-selected', 'true');
      if(span.textContent.trim() && alignmentApi.matchingGroups(activeAlignment, {start:start, end:end}).length){
        span.setAttribute('role', 'button');
        span.tabIndex = 0;
        span.setAttribute('aria-label', 'Identify aligned phrase ' + span.textContent.trim());
        span.setAttribute('aria-describedby', 'wordStudyAlignmentStatus');
      }
      view.verse.appendChild(span);
    });
    highlightAlignment(selection);
  }

  function showOriginalDetails(record, selectedButton){
    var view = elements();
    var fields = [
      ['surface', 'Surface'],
      ['language', 'Language'],
      ['lemma', 'Lemma'],
      ['transliteration', 'Transliteration'],
      ['pronunciation', 'Pronunciation'],
      ['strongsNumber', "Strong's number"],
      ['partOfSpeech', 'Part of speech'],
      ['morphology', 'Morphology'],
      ['definition', 'Lexical definition']
    ];
    view.originalDetails.textContent = '';
    fields.forEach(function(field){
      var value = field[0] === 'language' ? displayLanguage(record[field[0]]) : record[field[0]];
      if(value === null || value === undefined || value === '') return;
      var label = document.createElement('dt');
      var detail = document.createElement('dd');
      label.textContent = field[1];
      detail.textContent = value;
      view.originalDetails.appendChild(label);
      view.originalDetails.appendChild(detail);
    });
    view.originalDetails.hidden = false;
    highlightAlignment({tokenIndex:record.tokenIndex});
    view.originalTokens.querySelectorAll('button').forEach(function(button){ button.setAttribute('aria-pressed', button === selectedButton ? 'true' : 'false'); });
    keepStudyFocusVisible(selectedButton);
  }

  function keepStudyFocusVisible(selectedButton){
    var view = elements();
    var reader = document.getElementById('view-reader');
    var surface = reader.classList.contains('reader-fullscreen') ? reader : window;
    var revision = requestId;
    updateVerseInset();
    // Greek/Hebrew fonts can rewrap the token rows after their initial layout.
    var fontsReady = document.fonts ? document.fonts.ready : Promise.resolve();
    fontsReady.then(function(){
      requestAnimationFrame(function(){
        if(revision !== requestId || view.panel.hidden || !selectedButton.isConnected ||
          document.activeElement !== selectedButton) return;
        if(typeof refreshReaderStickyOffsets === 'function') refreshReaderStickyOffsets();
        updateVerseInset();
        var token = selectedButton.getBoundingClientRect();
        var context = document.getElementById('wordStudyContext');
        var header = document.querySelector('.word-study-header');
        var closing = selectedButton === view.close;
        var clearanceInset = closing ? 5 : 8;
        var top = Math.max(!closing && getComputedStyle(context).position === 'sticky' ? context.getBoundingClientRect().bottom : 0,
          !closing && getComputedStyle(header).position === 'sticky' ? header.getBoundingClientRect().bottom : 0, readerVisibleTop()) + clearanceInset;
        var bottom = window.innerHeight - clearanceInset;
        var clearance = token.top < top ? token.top - top : token.bottom > bottom ? token.bottom - bottom : 0;
        if(clearance) surface.scrollBy({top:clearance,behavior:'instant'});
      });
    });
  }

  function renderOriginalLanguage(result){
    var view = elements();
    clearOriginalLanguage();
    if(!view.original || !result || result.status !== 'available' || !Array.isArray(result.records) || !result.records.length) return;
    view.original.hidden = false;
    document.getElementById('wordStudyOriginalIntro').hidden = false;
    updateVerseInset();
    view.originalTokens.setAttribute('dir', result.records.some(function(record){ return record.language === 'hebrew' || record.language === 'aramaic'; }) ? 'rtl' : 'ltr');
    result.records.forEach(function(record){
      var button = document.createElement('button');
      button.type = 'button';
      button.className = 'word-study-original-token';
      button.textContent = record.surface;
      button.setAttribute('aria-label', 'Original-language token ' + record.surface + ', ' + displayLanguage(record.language) + ', token ' + (record.tokenIndex + 1));
      button.setAttribute('aria-pressed', 'false');
      button.setAttribute('aria-describedby', 'wordStudyAlignmentStatus');
      button.setAttribute('data-original-language-token-index', String(record.tokenIndex));
      button.setAttribute('lang', record.language === 'hebrew' ? 'he' : record.language === 'aramaic' ? 'arc' : 'grc');
      button.__originalLanguageRecord = record;
      view.originalTokens.appendChild(button);
    });
    activeAlignment = activeContext.alignmentTextVerified ? alignmentApi.lookup(activeContext, result.records) : {status:'unavailable',groups:[]};
    renderEnglishVerse();
  }

  function openFromWord(word, context, isCurrent){
    if(!word || !word.isConnected || !context || (isCurrent && !isCurrent())) return;
    alignmentApi = readyAlignmentApi;
    var englishWords = alignmentApi.wordSpans(word.closest('.reader-verse'));
    context = Object.assign({}, context, {alignmentTextVerified:englishWords.includes(word), englishStart:Number(word.getAttribute('data-word-study-start')), englishEnd:Number(word.getAttribute('data-word-study-end'))});
    activatingWord = word;
    activeContext = context;
    activeAlignment = {status:'unavailable', groups:[]};
    var activeRequest = ++requestId;
    clearOriginalLanguage();
    setPanelState('loading', context, {});
    renderEnglishVerse();
    WordStudyProvider.lookup(context).then(function(result){
      if(activeRequest !== requestId || !word.isConnected || (isCurrent && !isCurrent())) return;
      setPanelState(result.status, context, result);
    }).catch(function(){
      if(activeRequest !== requestId || !word.isConnected || (isCurrent && !isCurrent())) return;
      setPanelState('unavailable', context, { message: 'Definition not available yet.' });
    });
    if(typeof OriginalLanguageWordStudyProvider !== 'undefined' && typeof OriginalLanguageWordStudyProvider.lookupVerse === 'function'){
      OriginalLanguageWordStudyProvider.lookupVerse(context).then(function(result){
        if(activeRequest === requestId && word.isConnected && (!isCurrent || isCurrent())) renderOriginalLanguage(result);
      }).catch(function(){
        if(activeRequest === requestId && word.isConnected && (!isCurrent || isCurrent())) clearOriginalLanguage();
      });
    }
  }

  function invalidate(){
    requestId++;
    var readerVerse = activatingWord && activatingWord.closest('.reader-verse');
    if(readerVerse) readerVerse.querySelectorAll('[data-aligned]').forEach(function(element){ element.removeAttribute('data-aligned'); });
    activeContext = null;
    activeAlignment = {status:'unavailable', groups:[]};
    activatingWord = null;
    var panel = elements().panel;
    if(panel) panel.hidden = true;
    clearOriginalLanguage();
  }

  function close(){
    var panel = elements().panel;
    if(!panel || panel.hidden) return;
    var word = activatingWord;
    invalidate();
    if(word && document.contains(word)) word.focus();
  }

  function loadAlignment(){
    if(alignmentAttempted) return;
    alignmentAttempted = true;
    function available(){
      return window.WordStudyAlignment && ['lookup','matchingGroups','wordSpans'].every(function(name){ return typeof window.WordStudyAlignment[name] === 'function'; });
    }
    if(available()){ readyAlignmentApi = window.WordStudyAlignment; return; }
    var script = document.createElement('script');
    var settled = false;
    var timeout = setTimeout(function(){ finish(false); }, 3000);
    function finish(loaded){
      if(settled) return;
      settled = true;
      clearTimeout(timeout);
      script.onload = script.onerror = null;
      if(loaded && available()) readyAlignmentApi = window.WordStudyAlignment;
      else script.remove();
    }
    script.src = '/js/word-study/alignment.js';
    script.onerror = function(){ finish(false); };
    script.onload = function(){ finish(true); };
    try { document.head.appendChild(script); } catch(error){ finish(false); }
  }

  function initialize(){
    loadAlignment();
    if(initialized) return;
    initialized = true;
    var verse = document.getElementById('wordStudyVerse');
    var context = document.getElementById('wordStudyContext');
    var sheet = Array.from(document.styleSheets).find(function(candidate){
      return candidate.href && /\/css\/companion\.css(?:\?|$)/.test(candidate.href);
    });
    if(verse && sheet && typeof ResizeObserver !== 'undefined'){
      var inset = sheet.cssRules[sheet.insertRule('#wordStudyPanel {}', sheet.cssRules.length)].style;
      updateVerseInset = function(){
        var header = document.querySelector('.word-study-header').getBoundingClientRect().height;
        var available = window.innerHeight - readerVisibleTop();
        var targetHeight = window.matchMedia('(any-pointer:coarse)').matches ? 44 : 32;
        var headerUnpinned = header + targetHeight + 16 > available;
        var panel = document.getElementById('wordStudyPanel');
        panel.classList.toggle('word-study-header-unpinned', headerUnpinned);
        inset.setProperty('--word-study-context-height', '0px');
      };
      updateVerseInset();
      var observer = new ResizeObserver(updateVerseInset);
      observer.observe(context);
      observer.observe(document.querySelector('.word-study-header'));
      window.addEventListener('resize', updateVerseInset);
      if(document.fonts) document.fonts.ready.then(updateVerseInset);
    }
    function selectEnglish(event){
      var selected = event.target.closest('[data-english-start][role="button"]');
      if(!selected || !verse.contains(selected)) return;
      if(event.type === 'keydown' && event.key !== 'Enter' && event.key !== ' ') return;
      event.preventDefault();
      highlightAlignment({start:Number(selected.dataset.englishStart), end:Number(selected.dataset.englishEnd)});
    }
    verse.addEventListener('click', selectEnglish);
    verse.addEventListener('keydown', selectEnglish);
    var originalTokens = document.getElementById('wordStudyOriginalTokens');
    if(originalTokens) originalTokens.addEventListener('focusin', function(event){
      var button = event.target.closest('[data-original-language-token-index]');
      if(button && originalTokens.contains(button)) keepStudyFocusVisible(button);
    });
    var closeButton = elements().close;
    if(closeButton) closeButton.addEventListener('focus', function(){ keepStudyFocusVisible(closeButton); });
    if(originalTokens) originalTokens.addEventListener('click', function(event){
      var button = event.target.closest('[data-original-language-token-index]');
      if(button && originalTokens.contains(button)) showOriginalDetails(button.__originalLanguageRecord, button);
    });
  }

  return { initialize: initialize, openFromWord: openFromWord, close: close, invalidate: invalidate };
}());
