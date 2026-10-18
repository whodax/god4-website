/* Word Study readiness only; lookups remain in the existing runtime. */
var WordStudyLoader = (function(){
  if(window.WordStudyLoader) return window.WordStudyLoader;
  var pending = null, activation = null, generation = 0, initialized = false;
  var dependencies = [
    ['provider', 'WordStudyProvider', ['lookup','lookupOriginalLanguage','normalizeLookupTerm']],
    ['original-language-provider', 'OriginalLanguageWordStudyProvider', ['lookup','lookupVerse','resolveOriginalLanguageReference']],
    ['local-provider', 'LocalWordStudyProvider', ['lookup']],
    ['sense-selector', 'WordStudySenseSelector', ['select']],
    ['dictionary-provider', 'DictionaryWordStudyProvider', ['lookup','getShardNames','getInflectionCandidates']],
    ['controller', 'WordStudyController', ['initialize','openFromWord','invalidate','close']]
  ];
  // Equivalent to the standalone provider contract; shared with it after readiness.
  function normalizeLookupTerm(value){
    return String(value || '').toLowerCase().replace(/[^a-z0-9']/g, '').replace(/^'+|'+$/g, '');
  }
  function valid(dependency){
    var api = window[dependency[1]];
    return api && dependency[2].every(function(name){ return typeof api[name] === 'function'; });
  }
  function load(dependency){
    if(valid(dependency)) return Promise.resolve();
    return new Promise(function(resolve, reject){
      var script = document.createElement('script');
      script.src = '/js/word-study/' + dependency[0] + '.js';
      function failed(){ script.remove(); reject(new Error('Word Study scripts could not be loaded.')); }
      script.onerror = failed;
      script.onload = function(){
        script.onload = script.onerror = null;
        if(!valid(dependency)){ failed(); return; }
        resolve();
      };
      document.head.appendChild(script);
    });
  }
  function ensure(){
    if(!pending){
      pending = Promise.resolve().then(async function(){
        for(var dependency of dependencies) await load(dependency);
        // Keep page tokenization and provider lookup on one canonical function.
        WordStudyProvider.normalizeLookupTerm = normalizeLookupTerm;
        WordStudyController.initialize();
        return WordStudyController;
      }).catch(function(error){ pending = null; throw error; });
    }
    return pending;
  }
  function contextFromWord(word){
    var reader = document.getElementById('readerContent');
    var verse = word && word.closest('.reader-verse');
    if(!reader || !verse || !reader.contains(word)) return null;
    return Object.freeze({
      translationId:verse.getAttribute('data-translation-id'), bookId:verse.getAttribute('data-book-id'),
      bookName:verse.getAttribute('data-book-name'), chapter:Number(verse.getAttribute('data-chapter')),
      verse:Number(verse.getAttribute('data-verse-number')), verseText:verse.getAttribute('data-verse-text'),
      displayWord:word.getAttribute('data-word-study-display'),
      lookupTerm:normalizeLookupTerm(word.getAttribute('data-word-study-term'))
    });
  }
  function current(item){
    return activation === item && item.generation === generation && item.word.isConnected &&
      JSON.stringify(contextFromWord(item.word)) === JSON.stringify(item.context) &&
      (typeof currentTranslation === 'undefined' || currentTranslation === item.context.translationId) &&
      (typeof currentBook === 'undefined' || currentBook === item.context.bookId) &&
      (typeof currentChapter === 'undefined' || currentChapter === item.context.chapter);
  }
  function runtimeState(item, failed){
    if(!current(item)) return;
    var panel = document.getElementById('wordStudyPanel');
    panel.hidden = false;
    panel.setAttribute('data-word-study-state', failed ? 'unavailable' : 'loading');
    document.getElementById('wordStudyWord').textContent = item.context.displayWord;
    document.getElementById('wordStudyReference').textContent = item.context.bookName + ' ' + item.context.chapter + ':' + item.context.verse;
    document.getElementById('wordStudyVerse').textContent = item.context.verseText;
    ['wordStudyPartOfSpeech','wordStudyRelated','wordStudySource','wordStudyOriginalTokens','wordStudyOriginalDetails'].forEach(function(id){ document.getElementById(id).textContent = ''; });
    document.getElementById('wordStudyOriginalLanguage').hidden = true;
    document.getElementById('wordStudyOriginalDetails').hidden = true;
    var message = failed ? 'Word Study could not be loaded. Activate a word to try again.' : 'Loading Word Study for ' + item.context.displayWord + '.';
    document.getElementById('wordStudyDefinition').textContent = message;
    document.getElementById('wordStudyStatus').textContent = message;
    if(!failed){
      panel.scrollIntoView({block:'start',behavior:'instant'});
      document.getElementById('wordStudyHeading').focus({preventScroll:true});
    }
  }
  function activate(word){
    var context = contextFromWord(word);
    if(!context) return;
    if(window.WordStudyController && typeof WordStudyController.invalidate === 'function') WordStudyController.invalidate();
    var item = {word:word, context:context, generation:++generation, loading:true};
    activation = item;
    // Readiness is asynchronous even when dependencies are already present.
    runtimeState(item, false);
    ensure().then(function(controller){
      if(!current(item) || !document.getElementById('view-reader').classList.contains('active')){
        if(activation === item) invalidate();
        return;
      }
      item.loading = false;
      controller.openFromWord(word, context, function(){ return current(item); });
    }).catch(function(){
      if(!current(item)){ if(activation === item) invalidate(); return; }
      runtimeState(item, true);
    });
  }
  function invalidate(onlyPending){
    if(onlyPending && (!activation || !activation.loading)) return;
    generation++;
    activation = null;
    if(window.WordStudyController && typeof WordStudyController.invalidate === 'function') WordStudyController.invalidate();
    var panel = document.getElementById('wordStudyPanel');
    if(panel) panel.hidden = true;
  }
  function close(){
    var panel = document.getElementById('wordStudyPanel');
    if(!panel || panel.hidden) return;
    var word = activation && activation.word;
    invalidate();
    if(word && word.isConnected) word.focus();
  }
  function initialize(){
    if(initialized) return;
    initialized = true;
    var reader = document.getElementById('readerContent');
    if(reader){
      reader.addEventListener('click', function(event){
        var word = event.target.closest('[data-word-study-term]');
        if(word && reader.contains(word)) activate(word);
      });
      reader.addEventListener('keydown', function(event){
        var word = event.target.closest('[data-word-study-term]');
        if(word && reader.contains(word) && (event.key === 'Enter' || event.key === ' ')){
          event.preventDefault(); activate(word);
        }
      });
    }
    var closeButton = document.getElementById('wordStudyClose');
    if(closeButton) closeButton.addEventListener('click', close);
    var panel = document.getElementById('wordStudyPanel');
    if(panel) panel.addEventListener('keydown', function(event){
      if(event.key === 'Escape'){ event.preventDefault(); close(); }
    });
  }
  if(document.readyState === 'loading') document.addEventListener('DOMContentLoaded', initialize, {once:true});
  else initialize();
  return {ensure:ensure, initialize:initialize, invalidate:invalidate, normalizeLookupTerm:normalizeLookupTerm};
})();
