/* Quick navigation uses the same translation libraries and Reader path as Search. */
const ScripturePicker = (function(){
  var dialog, booksArea, detailArea, search, heading, back, status;
  var generation = 0, translation, book, chapter, step = 'books', returnFocus = true;
  function button(label, action, value, selected){
    var node = document.createElement('button');
    node.type = 'button';
    node.textContent = label;
    node.dataset.pickerAction = action;
    if(value !== undefined) node.dataset.value = value;
    if(selected !== undefined) node.setAttribute('aria-current', selected ? 'true' : 'false');
    return node;
  }
  function invalidate(restoreFocus){
    returnFocus = restoreFocus === true;
    generation++;
    if(dialog && dialog.open) dialog.close();
  }
  function isCurrent(request, translationRequest, requestedTranslation){
    if(request !== generation) return false;
    if(translationRequest !== translationChangeRequest || requestedTranslation !== currentTranslation){
      invalidate(true);
      return false;
    }
    return true;
  }
  function create(){
    dialog = document.createElement('dialog');
    dialog.id = 'scripturePicker';
    dialog.className = 'scripture-picker';
    dialog.setAttribute('aria-labelledby', 'scripturePickerTitle');
    dialog.innerHTML = '<div class="picker-header"><h2 id="scripturePickerTitle">Choose Scripture</h2><button type="button" data-picker-action="close" aria-label="Close Scripture picker">Close</button></div>' +
      '<p class="picker-status" role="status"></p><div class="picker-layout"><section class="picker-books" aria-label="Books"><label for="pickerBookSearch">Find a book</label><input id="pickerBookSearch" type="search" autocomplete="off"><div class="picker-book-list"></div></section>' +
      '<section class="picker-detail" aria-labelledby="pickerDetailTitle"><button type="button" data-picker-action="back">Back to books</button><h3 id="pickerDetailTitle" tabindex="-1"></h3><div class="picker-options"></div></section></div>';
    document.getElementById('view-reader').appendChild(dialog);
    booksArea = dialog.querySelector('.picker-book-list');
    detailArea = dialog.querySelector('.picker-options');
    search = dialog.querySelector('input');
    heading = dialog.querySelector('h3');
    back = dialog.querySelector('[data-picker-action="back"]');
    status = dialog.querySelector('.picker-status');
    dialog.addEventListener('cancel', function(){ generation++; });
    dialog.addEventListener('close', function(){
      generation++;
      if(returnFocus) document.getElementById('scripturePickerTrigger').focus({preventScroll:true});
    });
    search.addEventListener('input', renderBooks);
    dialog.addEventListener('keydown', function(event){
      if(event.key !== 'Tab') return;
      var controls = Array.from(dialog.querySelectorAll('button:not([disabled]), input:not([disabled])')).filter(function(node){ return node.getClientRects().length; });
      var first = controls[0], last = controls[controls.length - 1];
      if(event.shiftKey && document.activeElement === first || !event.shiftKey && document.activeElement === last){
        event.preventDefault();
        (event.shiftKey ? last : first).focus();
      }
    });
    dialog.addEventListener('click', function(event){
      var target = event.target.closest('[data-picker-action]');
      if(!target) return;
      var action = target.dataset.pickerAction;
      if(action === 'close'){ invalidate(true); return; }
      if(action === 'back'){
        step = step === 'verses' ? 'chapters' : 'books';
        renderDetail();
        if(step === 'books') focusBook();
        else focusDetail();
      } else if(action === 'book'){
        book = target.dataset.value;
        chapter = book === currentBook ? currentChapter : 1;
        step = 'chapters';
        renderBooks(); renderDetail(); focusDetail();
      } else if(action === 'chapter'){
        chapter = Number(target.dataset.value);
        step = 'verses'; renderDetail(); focusDetail();
      } else if(action === 'verse' || action === 'whole'){
        if(translation !== currentTranslation || !BibleData.getChapter(translation, book, chapter)){
          status.textContent = 'Scripture is unavailable. Close and try again.'; return;
        }
        var selectedBook = book, selectedChapter = chapter;
        var verse = action === 'verse' ? Number(target.dataset.value) : undefined;
        // Close synchronously before shared navigation moves focus into the Reader.
        invalidate(verse === undefined);
        navigateReaderToPassage(selectedBook, selectedChapter, verse).then(function(loaded){
          if(!loaded) return;
          if(verse === undefined) document.getElementById('scripturePickerTrigger').focus({preventScroll:true});
        });
      }
    });
  }
  function focusBook(){
    var current = booksArea.querySelector('[aria-current="true"]');
    (current || search).focus({preventScroll:true});
    if(current) current.scrollIntoView({block:'nearest', inline:'nearest'});
  }
  function focusDetail(){
    var current = detailArea.querySelector('[aria-current="true"]');
    (current || detailArea.querySelector('button') || heading).focus({preventScroll:true});
    if(current) current.scrollIntoView({block:'nearest', inline:'nearest'});
  }
  function renderBooks(){
    booksArea.replaceChildren();
    BibleData.listBooks(translation).filter(function(item){
      return item.name.toLowerCase().includes(search.value.trim().toLowerCase());
    }).forEach(function(item){
      booksArea.appendChild(button(item.name, 'book', item.id, item.id === book));
    });
    if(!booksArea.children.length) booksArea.textContent = 'No matching books.';
  }
  function renderDetail(){
    dialog.dataset.step = step;
    detailArea.replaceChildren();
    var selectedBook = BibleData.listBooks(translation).find(function(item){ return item.id === book; });
    if(!selectedBook) return;
    heading.textContent = selectedBook.name + (step === 'verses' ? ' ' + chapter + ' — Verses' : ' — Chapters');
    back.textContent = step === 'verses' ? 'Back to chapters' : 'Back to books';
    if(step !== 'verses'){
      for(var number = 1; number <= BibleData.getChapterCount(translation, book); number++){
        detailArea.appendChild(button(String(number), 'chapter', number, book === currentBook && number === currentChapter));
      }
    } else {
      var data = BibleData.getChapter(translation, book, chapter);
      if(!data){ status.textContent = 'Scripture is unavailable.'; return; }
      var whole = button('Whole chapter', 'whole');
      whole.className = 'picker-whole';
      detailArea.appendChild(whole);
      data.verses.forEach(function(text, index){
        // Match Reader's treatment of empty coordinates without renumbering.
        if(!isRenderableVerseText(text)) return;
        detailArea.appendChild(button(String(index + 1), 'verse', index + 1,
          book === currentBook && chapter === currentChapter && index + 1 === currentVerse));
      });
    }
  }
  async function open(){
    if(!dialog) create();
    if(dialog.open) return;
    returnFocus = true;
    dialog.dataset.step = 'loading';
    status.textContent = 'Preparing Scripture…';
    dialog.showModal();
    var request = ++generation;
    var translationRequest = translationChangeRequest;
    translation = currentTranslation;
    var requestedTranslation = translation;
    try {
      if(readerTranslationTask) await readerTranslationTask;
      if(!isCurrent(request, translationRequest, requestedTranslation)) return;
      var loaded = typeof BibleTranslationLoader === 'undefined' ? BibleData.isTranslationLoaded(translation) : await BibleTranslationLoader.ensure(translation);
      if(!isCurrent(request, translationRequest, requestedTranslation)) return;
      if(!loaded){ status.textContent = 'Scripture is unavailable. Retain this translation in Offline Bibles or reconnect and try again.'; return; }
      if(!await initializeBibleExperience()) { status.textContent = 'Scripture is unavailable.'; return; }
      if(!isCurrent(request, translationRequest, requestedTranslation)) return;
      book = currentBook; chapter = currentChapter; step = 'books'; search.value = '';
      status.textContent = '';
      renderBooks(); renderDetail(); focusBook();
    } catch(error){
      if(request === generation) status.textContent = 'Scripture is unavailable. Close and try again.';
    }
  }
  document.getElementById('scripturePickerTrigger').addEventListener('click', open);
  return {invalidate:invalidate};
}());
