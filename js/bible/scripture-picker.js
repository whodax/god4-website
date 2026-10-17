/* Quick navigation uses the same translation libraries and Reader path as Search. */
const ScripturePicker = (function(){
  var dialog, booksArea, detailArea, search, heading, back, status;
  var generation = 0, translation, book, chapter, step = 'books', returnFocus = true, browsing = false;
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
      '<p class="picker-status" role="status"></p><div class="picker-layout"><section class="picker-books" aria-labelledby="pickerBooksTitle"><h3 id="pickerBooksTitle">Books</h3><label for="pickerBookSearch">Find a book</label><input id="pickerBookSearch" type="search" autocomplete="off"><div class="picker-book-list"></div></section>' +
      '<section class="picker-detail" aria-labelledby="pickerDetailTitle"><button type="button" data-picker-action="back">Back to books</button><h3 id="pickerDetailTitle" tabindex="-1"></h3><div class="picker-options"></div></section></div>';
    document.getElementById('view-reader').appendChild(dialog);
    booksArea = dialog.querySelector('.picker-book-list');
    detailArea = dialog.querySelector('.picker-options');
    search = dialog.querySelector('input');
    heading = dialog.querySelector('#pickerDetailTitle');
    back = dialog.querySelector('[data-picker-action="back"]');
    status = dialog.querySelector('.picker-status');
    dialog.addEventListener('cancel', function(){ generation++; });
    dialog.addEventListener('close', function(){
      generation++;
      document.getElementById('scripturePickerTrigger').setAttribute('aria-expanded', 'false');
      if(returnFocus) document.getElementById('scripturePickerTrigger').focus({preventScroll:true});
    });
    search.addEventListener('input', function(){ browsing = true; renderBooks(); });
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
        browsing = true;
        step = step === 'verses' ? 'chapters' : 'books';
        renderDetail();
        if(step === 'books') focusBook();
        else focusDetail();
      } else if(action === 'book'){
        browsing = true;
        book = target.dataset.value;
        chapter = book === currentBook ? currentChapter : 1;
        step = 'chapters';
        renderBooks(); renderDetail(); focusDetail();
      } else if(action === 'chapter'){
        browsing = true;
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
      return BibleCanon.matches(item.id,item.name,search.value,true);
    }).forEach(function(item){
      booksArea.appendChild(button(BibleCanon.bookLabel(item.id, item.name), 'book', item.id, item.id === book));
    });
    if(!booksArea.children.length) booksArea.textContent = 'No matching books.';
  }
  function renderDetail(){
    dialog.dataset.step = step;
    detailArea.replaceChildren();
    var selectedBook = BibleData.listBooks(translation).find(function(item){ return item.id === book; });
    if(!selectedBook) return;
    heading.textContent = selectedBook.name + (step === 'verses' ? ' ' + chapter + ' — Verses' : ' — Chapters');
    var canonLabel = BibleCanon.passageLabel(translation, book, chapter);
    if(step === 'verses' && canonLabel) heading.textContent += ' — ' + canonLabel;
    back.hidden = step === 'books';
    back.dataset.level = step;
    back.textContent = step === 'verses' ? 'Back to chapters' : 'Back to books';
    if(step !== 'verses'){
      for(var number = 1; number <= BibleData.getChapterCount(translation, book); number++){
        var chapterButton = button(String(number), 'chapter', number, number === chapter);
        var chapterLabel = BibleCanon.passageLabel(translation, book, number);
        if(chapterLabel && !BibleCanon.isDeuterocanonical(book)){
          chapterButton.setAttribute('aria-label', 'Chapter ' + number + ' — ' + chapterLabel);
        }
        detailArea.appendChild(chapterButton);
      }
    } else {
      var data = BibleData.getChapter(translation, book, chapter);
      if(!data){ status.textContent = 'Scripture is unavailable.'; return; }
      var whole = button('Whole chapter', 'whole', undefined, book === currentBook && chapter === currentChapter && getReaderDisplayedVerse() === null);
      whole.className = 'picker-whole';
      detailArea.appendChild(whole);
      data.verses.forEach(function(text, index){
        // Match Reader's treatment of empty coordinates without renumbering.
        if(!isRenderableVerseText(text)) return;
        detailArea.appendChild(button(String(index + 1), 'verse', index + 1,
          book === currentBook && chapter === currentChapter && index + 1 === getReaderDisplayedVerse()));
      });
    }
  }
  function sync(){
    if(!dialog || !dialog.open || dialog.dataset.step === 'loading' || translation !== currentTranslation) return;
    if(!browsing && (book !== currentBook || chapter !== currentChapter)){
      book = currentBook; chapter = currentChapter;
      booksArea.querySelectorAll('[data-picker-action="book"]').forEach(function(node){ node.setAttribute('aria-current', node.dataset.value === book ? 'true' : 'false'); });
      var active = document.activeElement;
      var action = active && active.dataset.pickerAction, value = active && active.dataset.value;
      var detailFocused = detailArea.contains(active);
      renderDetail();
      if(detailFocused){
        var replacement = Array.from(detailArea.querySelectorAll('button')).find(function(node){ return node.dataset.pickerAction === action && node.dataset.value === value; });
        (replacement || heading).focus({preventScroll:true});
      }
    }
    var verse = getReaderDisplayedVerse();
    detailArea.querySelectorAll('[data-picker-action="verse"], [data-picker-action="whole"]').forEach(function(node){
      var selected = book === currentBook && chapter === currentChapter && (node.dataset.pickerAction === 'whole' ? verse === null : Number(node.dataset.value) === verse);
      node.setAttribute('aria-current', selected ? 'true' : 'false');
    });
  }
  async function open(){
    if(!dialog) create();
    if(dialog.open) return;
    returnFocus = true;
    dialog.dataset.step = 'loading';
    status.textContent = 'Preparing Scripture…';
    dialog.showModal();
    document.getElementById('scripturePickerTrigger').setAttribute('aria-expanded', 'true');
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
      book = currentBook; chapter = currentChapter; step = 'books'; browsing = false; search.value = '';
      status.textContent = BibleData.listTranslations().find(function(item){ return item.id === translation; }).description || '';
      renderBooks(); renderDetail(); focusBook();
      var selectedNumber = detailArea.querySelector('[aria-current="true"]');
      if(selectedNumber && selectedNumber.getClientRects().length) selectedNumber.scrollIntoView({block:'nearest', inline:'nearest'});
    } catch(error){
      if(request === generation) status.textContent = 'Scripture is unavailable. Close and try again.';
    }
  }
  document.getElementById('scripturePickerTrigger').addEventListener('click', open);
  return {invalidate:invalidate, sync:sync};
}());
