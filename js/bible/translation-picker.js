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
  return {initialize:initialize, sync:sync, isOpen:function(){ return !!document.querySelector('#view-reader .reader-translation-picker[open]'); }};
})();

var ReaderOptions = window.ReaderOptions || (function(){
  var initialized=false, media, feedback, dialog, choices, heading, activeSelect, returnTarget, pressed, passage, confirmed;
  var saveBatch=new Set();
  var controls=[];
  var labels={bookSelect:'Book',chapterSelect:'Chapter',verseSelect:'Verse',readAloudVoice:'Voice',readAloudSpeed:'Speed'};
  function describe(location){
    if(!location || !location.verse) return null;
    var verse=BibleData.getVerse(location.translationId,location.bookId,location.chapter,location.verse);
    var chapter=BibleData.getChapter(location.translationId,location.bookId,location.chapter);
    var translation=BibleData.listTranslations().find(function(item){return item.id===location.translationId;});
    var existing=saved.find(function(item){var position=item.location;return position && position.translationId===location.translationId && position.bookId===location.bookId && position.chapter===location.chapter && position.verse===location.verse;});
    return verse && verse.text.trim() && chapter && translation ? {
      ref:chapter.bookName+' '+location.chapter+':'+location.verse+' ('+translation.abbreviation+')',savedRef:existing && existing.ref,text:verse.text,location:location
    } : null;
  }
  function current(){
    return describe({translationId:currentTranslation,bookId:currentBook,chapter:currentChapter,verse:getReaderDisplayedVerse()});
  }
  function sync(){
    if(!initialized) return;
    if(confirmed && isSaved(confirmed.key)!==confirmed.stored){
      confirmed.stored=isSaved(confirmed.key);
      feedback.textContent=confirmed.ref+(confirmed.stored?' saved.':' removed from Saved.');
    }
    var entry=current(), button=document.getElementById('readerSaveVerse');
    var stored=entry && isSaved(entry.savedRef || entry.ref);
    button.disabled=false;
    var text=entry ? stored ? 'Saved ✓' : 'Save verse' : 'Choose verse to save';
    if(button.textContent!==text) button.textContent=text;
    button.setAttribute('aria-pressed',stored?'true':'false');
    button.setAttribute('aria-disabled',stored?'true':'false');
    button.setAttribute('aria-label',entry ? stored ? entry.ref+' saved. Manage saved verses in Saved.' : 'Save '+entry.ref : 'Choose a verse to save');
    if(!entry){
      button.setAttribute('aria-haspopup','dialog');button.setAttribute('aria-controls','readerOptionsPicker');
    } else {
      button.removeAttribute('aria-haspopup');button.removeAttribute('aria-controls');button.removeAttribute('aria-expanded');
    }
    controls.forEach(function(control){
      var option=control.select.options[control.select.selectedIndex];
      var emptyVerse=control.select.id==='verseSelect' && !(option && option.value);
      var label=labels[control.select.id]+': '+(emptyVerse ? 'None' : option ? option.textContent : 'Unavailable');
      if(control.button.textContent!==label) control.button.textContent=label;
      control.button.setAttribute('aria-label',emptyVerse ? 'Verse: Whole chapter (no selected verse)' : label);
      control.button.disabled=control.select.disabled || !control.select.options.length;
    });
    if(dialog && dialog.open) choices.querySelectorAll('[data-option-value]').forEach(function(option){
      option.setAttribute('aria-pressed',String(option.dataset.optionValue===activeSelect.value));
    });
  }
  function clearPressed(){
    if(pressed) pressed.removeAttribute('data-pressed');
    pressed=null;
  }
  function close(){
    clearPressed();
    if(dialog.open) dialog.close();
    controls.forEach(function(control){control.button.setAttribute('aria-expanded','false');});
    if(returnTarget) returnTarget.setAttribute('aria-expanded','false');
    var target=returnTarget && returnTarget.getClientRects().length ? returnTarget : activeSelect;
    if(!target || !target.getClientRects().length) target=document.getElementById('readerMoreTrigger');
    target.focus({preventScroll:true});
  }
  function createDialog(){
    dialog=document.createElement('dialog');
    dialog.id='readerOptionsPicker';
    dialog.className='reader-translation-picker reader-options-picker';
    dialog.setAttribute('aria-labelledby','readerOptionsPickerTitle');
    dialog.innerHTML='<div class="reader-translation-heading"><h2 id="readerOptionsPickerTitle"></h2><button type="button" aria-label="Close Reader selection">Close</button></div><div class="reader-translation-options" role="group"></div>';
    document.getElementById('view-reader').appendChild(dialog);
    heading=dialog.querySelector('h2');choices=dialog.querySelector('[role="group"]');
    dialog.querySelector('button').addEventListener('click',close);
    dialog.addEventListener('cancel',function(event){event.preventDefault();close();});
    dialog.addEventListener('keydown',function(event){
      event.stopPropagation();
      var buttons=Array.from(choices.querySelectorAll('button:not([disabled])'));
      var index=buttons.indexOf(document.activeElement), next;
      if(index>=0){
        if(event.key==='ArrowDown' || event.key==='ArrowRight') next=(index+1)%buttons.length;
        if(event.key==='ArrowUp' || event.key==='ArrowLeft') next=(index+buttons.length-1)%buttons.length;
        if(event.key==='Home') next=0;
        if(event.key==='End') next=buttons.length-1;
      }
      if(next!==undefined){event.preventDefault();buttons[next].focus();buttons[next].scrollIntoView({block:'nearest'});}
      if(event.key==='Tab'){
        var first=dialog.querySelector('button'), last=buttons[buttons.length-1] || first;
        if(event.shiftKey && document.activeElement===first){event.preventDefault();last.focus();}
        else if(!event.shiftKey && document.activeElement===last){event.preventDefault();first.focus();}
      }
    });
    choices.addEventListener('pointerdown',function(event){
      clearPressed();pressed=event.target.closest('[data-option-value]');
      if(pressed) pressed.setAttribute('data-pressed','true');
    });
    dialog.addEventListener('pointerup',clearPressed,true);
    dialog.addEventListener('pointercancel',clearPressed,true);
    choices.addEventListener('scroll',clearPressed);
    choices.addEventListener('click',function(event){
      var option=event.target.closest('[data-option-value]');
      if(!option || option.disabled) return;
      var select=activeSelect, changed=select.value!==option.dataset.optionValue;
      var valid=Array.from(select.options).some(function(item){return item.value===option.dataset.optionValue && !item.disabled;});
      if(!valid || !/^readAloud(Voice|Speed)$/.test(select.id) && passage!==JSON.stringify([currentTranslation,currentBook,currentChapter,translationChangeRequest])){
        close();feedback.textContent='The Reader changed. Reopen this control to choose from the current passage.';return;
      }
      var choosingForSave=returnTarget===document.getElementById('readerSaveVerse');
      close();
      select.value=option.dataset.optionValue;
      if(changed) select.dispatchEvent(new Event('change',{bubbles:true}));
      sync();
      if(returnTarget && returnTarget.getClientRects().length) returnTarget.focus({preventScroll:true});
      if(choosingForSave){
        var entry=current();
        feedback.textContent=entry ? 'Selected '+entry.ref+'. Activate Save verse to save it.' : 'Choose a numbered verse to save.';
      }
    });
  }
  function pick(select,target,numberedOnly){
    if(typeof HTMLDialogElement==='undefined' || !HTMLDialogElement.prototype.showModal){
      select.hidden=false;select.focus();feedback.textContent='Choose a verse using the Verse control, then select Save verse.';return;
    }
    if(!dialog) createDialog();
    if(dialog.open) return;
    activeSelect=select;returnTarget=target;
    passage=JSON.stringify([currentTranslation,currentBook,currentChapter,translationChangeRequest]);
    heading.textContent=numberedOnly?'Choose a verse to save':labels[select.id];choices.setAttribute('aria-label',labels[select.id]+' choices');
    choices.replaceChildren();
    Array.from(select.options).forEach(function(option){
      if(numberedOnly && !option.value) return;
      var button=document.createElement('button');
      button.type='button';button.dataset.optionValue=option.value;button.disabled=option.disabled;
      var check=document.createElement('span');check.className='reader-translation-check';
      check.setAttribute('aria-hidden','true');check.textContent='✓';
      button.append(check,document.createTextNode(option.value ? option.textContent : 'Whole chapter (no selected verse)'));
      button.setAttribute('aria-pressed',String(option.value===select.value));
      choices.appendChild(button);
    });
    dialog.showModal();
    target.setAttribute('aria-expanded','true');
    var selected=choices.querySelector('[aria-pressed="true"]:not([disabled])') || choices.querySelector('button:not([disabled])');
    if(selected){selected.focus({preventScroll:true});selected.scrollIntoView({block:'nearest'});}
  }
  function adapt(){
    var restore=controls.find(function(control){return document.activeElement===control.button || dialog && dialog.open && returnTarget===control.button;});
    if(dialog && dialog.open) close();
    controls.forEach(function(control){
      var custom=media.matches && document.activeElement!==control.select;
      control.select.hidden=custom;control.button.hidden=!custom;
      Array.from(control.select.labels).forEach(function(label){label.hidden=custom;});
    });
    if(restore && restore.button.hidden) restore.select.focus({preventScroll:true});
    sync();
  }
  function save(snapshot){
    var location={translationId:snapshot[0],bookId:snapshot[1],chapter:snapshot[2],verse:snapshot[3]};
    var entry=describe(location);
    if(!entry){
      feedback.textContent='Choose a numbered verse, then select Save verse. Nothing has been saved.';
      if(document.getElementById('readerSecondaryControls').hidden || document.activeElement!==snapshot[4]) return;
      pick(document.getElementById('verseSelect'),document.getElementById('readerSaveVerse'),true);return;
    }
    if(saveBatch.has(entry.ref)) return;
    if(isSaved(entry.savedRef || entry.ref)){sync();feedback.textContent=entry.ref+' is already saved. Manage saved verses in Saved.';return;}
    saveBatch.add(entry.ref);Promise.resolve().then(function(){saveBatch.clear();});
    confirmed=null;
    var persisted=toggleFav(entry.savedRef || entry.ref,entry.text,null,entry.location);
    var stored=isSaved(entry.savedRef || entry.ref);
    sync();
    confirmed={ref:entry.ref,key:entry.savedRef || entry.ref,stored:stored};
    feedback.textContent=entry.ref+(stored?' saved.':' removed from Saved.')+(persisted?'':' This change is for this visit only; device storage is unavailable.');
  }
  function initialize(){
    if(initialized) return;
    initialized=true;
    feedback=document.getElementById('readerSaveStatus');
    media=matchMedia('(max-width:620px)');
    if(typeof HTMLDialogElement!=='undefined' && HTMLDialogElement.prototype.showModal){
      createDialog();
      Object.keys(labels).forEach(function(id){
        var select=document.getElementById(id), button=document.createElement('button');
        button.type='button';button.className='reader-option-trigger';button.dataset.readerSelect=id;
        button.setAttribute('aria-haspopup','dialog');button.setAttribute('aria-controls','readerOptionsPicker');button.setAttribute('aria-expanded','false');
        select.after(button);controls.push({select:select,button:button});
        button.addEventListener('click',function(){pick(select,button);});
        select.addEventListener('change',sync);
        select.addEventListener('blur',function(){if(media.matches && !(dialog && dialog.open)) adapt();});
      });
      media.addEventListener('change',adapt);
      adapt();
    }
    window.addEventListener('storage',function(event){
      if(event.key!==null && event.key!=='god4.savedVerses') return;
      saved=savedVersesStorage.load();document.getElementById('savedCount').textContent=saved.length;
      renderTray();renderLeaf();sync();
    });
    saved=savedVersesStorage.load();document.getElementById('savedCount').textContent=saved.length;
    renderTray();
    sync();
  }
  return {initialize:initialize,sync:sync,save:save};
})();
