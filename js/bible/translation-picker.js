async function applyReaderTranslation(translationId){
  var previousTranslation = currentTranslation;
  var previousBook = currentBook;
  var previousChapter = currentChapter, previousVerse = currentVerse;
  var previousBookName=(BibleData.listBooks(previousTranslation).find(function(b){return b.id===previousBook;}) || {}).name || previousBook;
  var translationSelect = document.getElementById('readerTranslation');
  var requestId = ++translationChangeRequest;
  var loaded = typeof BibleTranslationLoader !== 'undefined'
    ? await BibleTranslationLoader.ensure(translationId)
    : BibleData.isTranslationLoaded(translationId);
  if(requestId !== translationChangeRequest) return false;
  if(!loaded){
    if(translationSelect) translationSelect.value = previousTranslation;
    return false;
  }
  var bookSelect = document.getElementById('bookSelect');
  if(bookSelect && bookSelect.value) currentBook = bookSelect.value;
  currentTranslation = translationId;
  UserData.translation.save(currentTranslation);
  if(typeof refreshPlanReadingSessionTranslation==='function') refreshPlanReadingSessionTranslation();
  if(translationSelect) translationSelect.value = currentTranslation;
  var missingBook=!BibleData.getChapterCount(currentTranslation,previousBook);
  var differentNumbering=!BibleCanon.comparable(previousTranslation,currentTranslation,previousBook);
  if(differentNumbering){ currentChapter=1; currentVerse=null; }
  populateBooks();
  if(!bookSelect || !BibleData.getChapterCount(currentTranslation, currentBook)){
    currentBook = BibleData.listBooks(currentTranslation)[0].id;
    currentVerse = null;
    bookSelect.value = currentBook;
  } else {
    bookSelect.value = currentBook;
  }
  populateChapters();
  populateVerses();
  loadPassage(true);
  var status=document.getElementById('readerTranslationStatus');
  var catholicUnavailable = BibleCanon.canon(previousTranslation) === 'catholic' && BibleCanon.catholicOnly(previousBook, previousChapter, previousVerse) &&
    BibleCanon.canon(currentTranslation) !== 'catholic';
  if(status) status.textContent=(catholicUnavailable ? BibleCanon.catholicUnavailableMessage + ' ' : '') + (missingBook ? previousBookName+' is not available in this translation. Opened '+(BibleData.getChapter(currentTranslation,currentBook,currentChapter) || {}).bookName+' '+currentChapter+'.' : differentNumbering ? 'This edition uses a different numbering tradition. Opened chapter 1; no equivalent passage was inferred.' : '');
  if(typeof syncCompareDefaultTranslation === 'function') syncCompareDefaultTranslation();
  if(typeof syncCompareFromReader === 'function') syncCompareFromReader();
  return true;
}


var ReaderTranslationPicker = window.ReaderTranslationPicker || (function(){
  var select, trigger, dialog, options, status, media, pressedButton, revision = 0, busy = false;
  function clearPressed(){
    if(pressedButton) pressedButton.removeAttribute('data-pressed');
    pressedButton = null;
  }
  function sync(){
    if(!trigger) return;
    var selected = select.options[select.selectedIndex];
    trigger.textContent = selected ? selected.textContent.split(' — ')[0] + ' ▾' : 'Translation ▾';
    trigger.setAttribute('aria-label', 'Bible translation: ' + (selected ? selected.textContent : 'Choose translation'));
    options.querySelectorAll('[data-translation]').forEach(function(button){
      button.setAttribute('aria-pressed', String(button.dataset.translation === select.value));
    });
  }
  function close(){
    clearPressed();
    revision++;
    busy = false;
    options.removeAttribute('aria-busy');
    if(dialog.open) dialog.close();
    trigger.setAttribute('aria-expanded', 'false');
    (media.matches ? trigger : select).focus({preventScroll:true});
  }
  function open(){
    if(!media.matches || !select.options.length || dialog.open) return;
    options.replaceChildren();
    Array.from(select.options).forEach(function(option){
      var button = document.createElement('button');
      button.type = 'button';
      button.dataset.translation = option.value;
      var check = document.createElement('span');
      check.className = 'reader-translation-check';
      check.setAttribute('aria-hidden', 'true');
      check.textContent = '✓';
      button.append(check, document.createTextNode(option.textContent));
      options.appendChild(button);
    });
    sync();
    status.textContent = '';
    dialog.showModal();
    trigger.setAttribute('aria-expanded', 'true');
    var selected = options.querySelector('[aria-pressed="true"]') || options.firstElementChild;
    selected.focus({preventScroll:true});
    selected.scrollIntoView({block:'nearest'});
  }
  function initialize(){
    select = document.getElementById('readerTranslation');
    if(!select || trigger || typeof HTMLDialogElement === 'undefined' || !HTMLDialogElement.prototype.showModal) return;
    if(document.activeElement === select){ select.addEventListener('blur',initialize,{once:true}); return; }
    media = window.matchMedia('(max-width:620px)');
    trigger = document.createElement('button');
    trigger.id = 'readerTranslationTrigger';
    trigger.type = 'button';
    trigger.setAttribute('aria-haspopup', 'dialog');
    trigger.setAttribute('aria-controls', 'readerTranslationPicker');
    trigger.setAttribute('aria-expanded', 'false');
    select.after(trigger);
    dialog = document.createElement('dialog');
    dialog.id = 'readerTranslationPicker';
    dialog.className = 'reader-translation-picker';
    dialog.setAttribute('aria-labelledby', 'readerTranslationPickerTitle');
    dialog.innerHTML = '<div class="reader-translation-heading"><h2 id="readerTranslationPickerTitle">Bible translation</h2><button type="button" aria-label="Close Bible translation picker">Close</button></div><p role="status" aria-live="polite"></p><div class="reader-translation-options" role="group" aria-label="Available Bible translations"></div>';
    document.getElementById('view-reader').appendChild(dialog);
    options = dialog.querySelector('.reader-translation-options');
    status = dialog.querySelector('[role="status"]');
    trigger.addEventListener('click', open);
    dialog.querySelector('.reader-translation-heading button').addEventListener('click', close);
    dialog.addEventListener('cancel', function(event){ event.preventDefault(); close(); });
    dialog.addEventListener('pointerdown', function(event){
      clearPressed();
      var button = event.target.closest('button');
      if(event.isPrimary && event.button === 0 && button && dialog.contains(button)){
        pressedButton = button;
        button.setAttribute('data-pressed', 'true');
      }
    });
    dialog.addEventListener('pointerout', function(event){
      if(pressedButton && !pressedButton.contains(event.relatedTarget)) clearPressed();
    });
    document.addEventListener('pointerup', clearPressed, true);
    document.addEventListener('pointercancel', clearPressed, true);
    options.addEventListener('scroll', clearPressed);
    dialog.addEventListener('keydown', function(event){
      var buttons = Array.from(options.children);
      var index = buttons.indexOf(document.activeElement);
      var next;
      if(index >= 0){
        if(event.key === 'ArrowDown' || event.key === 'ArrowRight') next = (index + 1) % buttons.length;
        if(event.key === 'ArrowUp' || event.key === 'ArrowLeft') next = (index + buttons.length - 1) % buttons.length;
        if(event.key === 'Home') next = 0;
        if(event.key === 'End') next = buttons.length - 1;
      }
      if(next !== undefined){ event.preventDefault(); buttons[next].focus(); }
      if(event.key === 'Tab'){
        var first = dialog.querySelector('.reader-translation-heading button'), last = options.lastElementChild;
        if(event.shiftKey && document.activeElement === first){ event.preventDefault(); last.focus(); }
        else if(!event.shiftKey && document.activeElement === last){ event.preventDefault(); first.focus(); }
      }
    });
    options.addEventListener('click', async function(event){
      var button = event.target.closest('[data-translation]');
      if(!button || !options.contains(button) || busy) return;
      if(button.dataset.translation === select.value){ close(); return; }
      busy = true;
      var request = ++revision;
      options.setAttribute('aria-busy', 'true');
      status.textContent = 'Loading translation…';
      try {
        var loaded = await changeTranslation(button.dataset.translation);
        if(request !== revision || !dialog.open) return;
        if(loaded) close();
        else status.textContent = 'Translation unavailable. Please try again or choose another translation.';
      } catch(error){
        if(request === revision && dialog.open) status.textContent = 'Translation unavailable. Please try again or choose another translation.';
      } finally {
        if(request === revision) busy = false;
        if(!busy) options.removeAttribute('aria-busy');
        sync();
      }
    });
    function adapt(){
      var restore = document.activeElement === select || document.activeElement === trigger || dialog.open;
      select.hidden = media.matches;
      trigger.hidden = !media.matches;
      if(dialog.open) close();
      else if(restore) (media.matches ? trigger : select).focus({preventScroll:true});
      sync();
    }
    media.addEventListener('change', adapt);
    select.addEventListener('change', sync);
    adapt();
  }
  return {initialize:initialize, sync:sync, isOpen:function(){ return !!dialog && dialog.open; }};
})();
