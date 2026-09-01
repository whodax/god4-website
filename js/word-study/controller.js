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
    view.related.textContent = state === 'available' && result.relatedWords.length ? 'Related words: ' + result.relatedWords.join(', ') : '';
    view.source.textContent = state === 'available' ? 'Public Domain Word Study' : '';
    view.status.textContent = state === 'loading' ? 'Looking up ' + context.displayWord + '.' : 'Studying ' + context.displayWord + ', ' + context.bookName + ' ' + context.chapter + ':' + context.verse + '.';
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
    setPanelState('loading', context, {});
    WordStudyProvider.lookup(context).then(function(result){
      if(activeRequest !== requestId) return;
      setPanelState(result.status, context, result);
      var heading = document.getElementById('wordStudyHeading');
      if(heading) heading.focus();
    }).catch(function(){
      if(activeRequest !== requestId) return;
      setPanelState('unavailable', context, { message: 'Definition not available yet.' });
    });
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
    if(panel) panel.addEventListener('keydown', function(event){
      if(event.key === 'Escape'){
        event.preventDefault();
        close();
      }
    });
  }

  return { initialize: initialize, close: close };
}());