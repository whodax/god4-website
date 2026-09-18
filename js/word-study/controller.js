/* ===== SCRIPTURE WORD STUDY CONTROLLER ===== */
var WordStudyController = (function createWordStudyController(){
  var activatingWord = null;
  var requestId = 0;
  var initialized = false;

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
    view.verse.textContent = context.verseText;
    view.definition.textContent = state === 'loading' ? 'Looking up this word...' : state === 'available' ? result.definition : result.message;
    view.related.textContent = state === 'available' && Array.isArray(result.relatedWords) && result.relatedWords.length ? 'Related words: ' + result.relatedWords.join(', ') : '';
    view.source.textContent = state === 'available' ? 'Public Domain Word Study' : '';
    view.status.textContent = state === 'loading' ? 'Looking up ' + context.displayWord + '.' : 'Studying ' + context.displayWord + ', ' + context.bookName + ' ' + context.chapter + ':' + context.verse + '.';
    var heading = document.getElementById('wordStudyHeading');
    if(heading) heading.focus();
  }

  function clearOriginalLanguage(){
    var view = elements();
    if(!view.original) return;
    view.original.hidden = true;
    view.originalTokens.textContent = '';
    view.originalDetails.textContent = '';
    view.originalDetails.hidden = true;
  }

  function displayLanguage(language){
    return language === 'hebrew' ? 'Hebrew' : language === 'greek' ? 'Greek' : language;
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
    view.originalTokens.querySelectorAll('button').forEach(function(button){ button.setAttribute('aria-pressed', button === selectedButton ? 'true' : 'false'); });
  }

  function renderOriginalLanguage(result){
    var view = elements();
    clearOriginalLanguage();
    if(!view.original || !result || result.status !== 'available' || !Array.isArray(result.records) || !result.records.length) return;
    view.original.hidden = false;
    view.originalTokens.setAttribute('dir', result.records.some(function(record){ return record.language === 'hebrew'; }) ? 'rtl' : 'ltr');
    result.records.forEach(function(record){
      var button = document.createElement('button');
      button.type = 'button';
      button.className = 'word-study-original-token';
      button.textContent = record.surface;
      button.setAttribute('aria-label', 'Original-language token ' + record.surface + ', ' + displayLanguage(record.language) + ', token ' + (record.tokenIndex + 1));
      button.setAttribute('aria-pressed', 'false');
      button.setAttribute('data-original-language-token-index', String(record.tokenIndex));
      button.setAttribute('lang', record.language === 'hebrew' ? 'he' : 'grc');
      button.__originalLanguageRecord = record;
      view.originalTokens.appendChild(button);
    });
  }

  function contextFromWord(word){
    var verse = word.closest('.reader-verse');
    if(!verse) return null;
    return {
      translationId: verse.getAttribute('data-translation-id'),
      bookId: verse.getAttribute('data-book-id'),
      bookName: verse.getAttribute('data-book-name'),
      chapter: Number(verse.getAttribute('data-chapter')),
      verse: Number(verse.getAttribute('data-verse-number')),
      verseText: verse.getAttribute('data-verse-text'),
      displayWord: word.getAttribute('data-word-study-display'),
      lookupTerm: word.getAttribute('data-word-study-term')
    };
  }

  function openFromWord(word){
    var context = contextFromWord(word);
    if(!context) return;
    activatingWord = word;
    var activeRequest = ++requestId;
    clearOriginalLanguage();
    setPanelState('loading', context, {});
    WordStudyProvider.lookup(context).then(function(result){
      if(activeRequest !== requestId) return;
      setPanelState(result.status, context, result);
    }).catch(function(){
      if(activeRequest !== requestId) return;
      setPanelState('unavailable', context, { message: 'Definition not available yet.' });
    });
    // English Reader words are not assumed to align one-to-one with original-language tokens.
    // This section remains verse-level until an authoritative alignment source exists.
    if(typeof OriginalLanguageWordStudyProvider !== 'undefined' && typeof OriginalLanguageWordStudyProvider.lookupVerse === 'function'){
      OriginalLanguageWordStudyProvider.lookupVerse(context).then(function(result){
        if(activeRequest === requestId) renderOriginalLanguage(result);
      }).catch(function(){
        if(activeRequest === requestId) clearOriginalLanguage();
      });
    }
  }

  function close(){
    var panel = elements().panel;
    if(!panel || panel.hidden) return;
    requestId++;
    panel.hidden = true;
    if(activatingWord && document.contains(activatingWord)) activatingWord.focus();
  }

  function initialize(){
    if(initialized) return;
    initialized = true;
    var reader = document.getElementById('readerContent');
    var panel = document.getElementById('wordStudyPanel');
    var closeButton = document.getElementById('wordStudyClose');
    if(reader){
      reader.addEventListener('click', function(event){
        var word = event.target.closest('[data-word-study-term]');
        if(word && reader.contains(word)) openFromWord(word);
      });
      reader.addEventListener('keydown', function(event){
        var word = event.target.closest('[data-word-study-term]');
        if(!word || !reader.contains(word)) return;
        if(event.key === 'Enter' || event.key === ' '){
          event.preventDefault();
          openFromWord(word);
        }
      });
    }
    if(closeButton) closeButton.addEventListener('click', close);
    var originalTokens = document.getElementById('wordStudyOriginalTokens');
    if(originalTokens) originalTokens.addEventListener('click', function(event){
      var button = event.target.closest('[data-original-language-token-index]');
      if(button && originalTokens.contains(button)) showOriginalDetails(button.__originalLanguageRecord, button);
    });
    if(panel) panel.addEventListener('keydown', function(event){
      if(event.key === 'Escape'){
        event.preventDefault();
        close();
      }
    });
  }

  return { initialize: initialize, close: close };
}());
