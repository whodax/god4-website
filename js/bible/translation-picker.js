async function applyReaderTranslation(translationId, options){
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
  if(options && (!options.isCurrent() || !loaded || !validSpokenPassage(translationId,options.target) || !document.getElementById('bookSelect') || !document.getElementById('chapterSelect'))) return false;
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
  if(options){
    document.getElementById('readerTranslationStatus').textContent='';
    populateBooks();
    var target=options.target;
    var selected=navigateToSpokenBook(target.bookId,target.chapter,target.verse);
    options.committedIntent=readerPlaybackIntent;
    if(typeof syncCompareDefaultTranslation === 'function') syncCompareDefaultTranslation();
    if(typeof syncCompareFromReader === 'function') syncCompareFromReader();
    return selected;
  }
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

// Advance only after an explicit Reader choice; never cascade from background
// synchronization, translation changes, Search, Compare, or Save verse.
function advanceReaderNavigationChoice(select, selectedValue, openNext){
  var nextId = select.id === 'bookSelect' ? 'chapterSelect' : select.id === 'chapterSelect' ? 'verseSelect' : null;
  if(!nextId) return;
  var previousFocus = document.activeElement;
  var translation = currentTranslation;
  requestAnimationFrame(function(){
    var reader = document.getElementById('view-reader');
    var options = document.getElementById('readerSecondaryControls');
    if(document.activeElement !== previousFocus || currentTranslation !== translation || select.value !== selectedValue ||
       !reader || !reader.classList.contains('active') || !options || options.hidden || document.querySelector('dialog[open]')) return;
    if(select.id === 'bookSelect' && currentBook !== selectedValue) return;
    if(select.id === 'chapterSelect' && (currentChapter !== Number(selectedValue) || currentBook !== document.getElementById('bookSelect').value)) return;
    var next = document.getElementById(nextId);
    if(next && !next.disabled && next.options.length) openNext(next);
  });
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

var ThemedSelectPicker = window.ThemedSelectPicker || (function(){
  var dialog, choices, search, title, active, origin, snapshot, pressed;
  var bindings = new WeakMap();
  var waitingForBlur = new WeakSet();
  function clearPressed(){
    if(pressed) pressed.removeAttribute('data-pressed');
    pressed = null;
  }
  function close(){
    clearPressed();
    if(dialog && dialog.open) dialog.close();
    if(origin){
      origin.setAttribute('aria-expanded','false');
      var target = origin;
      if(!target.isConnected && active && active.dataset.compareIndex !== undefined){
        target = document.querySelector('[data-themed-select="compare-edition-'+active.dataset.compareIndex+'"]');
      }
      if(target && target.isConnected && target.getClientRects().length) target.focus({preventScroll:true});
    }
  }
  function signature(select){
    var context = select.closest('#view-compare') ? ['compareBook','compareChapter','compareVerse'].map(function(id){return document.getElementById(id).value;}) : /^readAloud/.test(select.id) ? [] : [currentTranslation,currentBook,currentChapter,translationChangeRequest];
    return JSON.stringify([context,select.value,select.disabled,Array.from(select.options).map(function(option){return [option.value,option.textContent,option.disabled];})]);
  }
  function render(){
    choices.replaceChildren();
    Array.from(active.options).filter(function(option){return !(active.id==='verseSelect' && !option.value) && option.textContent.toLocaleLowerCase().includes(search.value.toLocaleLowerCase());}).forEach(function(option){
      var button = document.createElement('button');
      button.type = 'button'; button.textContent = option.textContent;
      button.dataset.optionValue = option.value; button.disabled = option.disabled;
      button.setAttribute('aria-pressed',String(option.value === active.value));
      if(!option.value && dialog.dataset.numeric === 'true') button.className = 'picker-whole';
      choices.appendChild(button);
    });
    dialog.querySelector('[role="status"]').textContent = choices.children.length ? '' : 'No matching choices.';
  }
  function create(){
    dialog = document.createElement('dialog');
    dialog.id = 'themedSelectPicker';
    dialog.className = 'reader-translation-picker themed-select-picker';
    dialog.setAttribute('aria-labelledby','themedSelectTitle');
    dialog.innerHTML = '<div class="reader-translation-heading"><h2 id="themedSelectTitle"></h2><button type="button" aria-label="Close selection picker">Close</button></div><label for="themedSelectSearch">Find a choice</label><input id="themedSelectSearch" class="picker-search" type="search" autocomplete="off"><p role="status" aria-live="polite"></p><div class="reader-translation-options picker-options" role="group"></div>';
    title = dialog.querySelector('h2'); choices = dialog.querySelector('[role="group"]'); search = dialog.querySelector('input');
    dialog.querySelector('button').addEventListener('click',close);
    dialog.addEventListener('cancel',function(event){event.preventDefault();close();});
    search.addEventListener('input',render);
    dialog.addEventListener('keydown',function(event){
      event.stopPropagation();
      var buttons = Array.from(choices.querySelectorAll('button:not([disabled])'));
      var index = buttons.indexOf(document.activeElement), next;
      if(index >= 0){
        if(event.key === 'ArrowDown' || event.key === 'ArrowRight') next = (index+1)%buttons.length;
        if(event.key === 'ArrowUp' || event.key === 'ArrowLeft') next = (index+buttons.length-1)%buttons.length;
        if(event.key === 'Home') next = 0;
        if(event.key === 'End') next = buttons.length-1;
      }
      if(next !== undefined){event.preventDefault();buttons[next].focus();buttons[next].scrollIntoView({block:'nearest'});}
      if(event.key === 'Tab'){
        var controls = Array.from(dialog.querySelectorAll('button:not([disabled]),input:not([hidden])'));
        var first = controls[0], last = controls[controls.length-1];
        if(event.shiftKey && document.activeElement === first || !event.shiftKey && document.activeElement === last){event.preventDefault();(event.shiftKey ? last : first).focus();}
      }
    });
    choices.addEventListener('pointerdown',function(event){clearPressed();pressed = event.target.closest('button');if(pressed) pressed.dataset.pressed = 'true';});
    dialog.addEventListener('pointerup',clearPressed,true);
    dialog.addEventListener('pointercancel',clearPressed,true);
    choices.addEventListener('scroll',clearPressed);
    choices.addEventListener('click',function(event){
      var button = event.target.closest('[data-option-value]');
      if(!button || button.disabled) return;
      if(!active.isConnected || signature(active) !== snapshot){close();return;}
      var select = active, changed = select.value !== button.dataset.optionValue;
      close(); select.value = button.dataset.optionValue;
      if(changed) select.dispatchEvent(new Event('change',{bubbles:true}));
      sync(select);
      advanceReaderNavigationChoice(select, select.value, open);
    });
  }
  function sync(select){
    var binding = bindings.get(select);
    if(!binding) return;
    var option = select.options[select.selectedIndex];
    binding.textContent = option ? option.textContent : 'Unavailable';
    binding.disabled = select.disabled || !select.options.length;
    binding.setAttribute('aria-label',label(select)+': '+binding.textContent);
  }
  function label(select){
    var labels = {compareBook:'Book',compareChapter:'Chapter',compareVerse:'Verse',readerTranslation:'Bible translation',bookSelect:'Book',chapterSelect:'Chapter',verseSelect:'Verse',readAloudVoice:'Voice',readAloudSpeed:'Speed'};
    return labels[select.id] || select.getAttribute('aria-label') || 'Choose';
  }
  function open(select){
    if(select.disabled || !select.options.length || document.querySelector('dialog[open]')) return;
    if(!dialog) create();
    active = select; origin = bindings.get(select) || select; snapshot = signature(select);
    var numeric = /^(compareChapter|compareVerse|chapterSelect|verseSelect)$/.test(select.id);
    dialog.dataset.numeric = String(numeric);
    title.textContent = label(select); search.value = '';
    search.hidden = numeric; dialog.querySelector('label').hidden = numeric;
    choices.setAttribute('aria-label',label(select)+' choices');
    var parent = select.closest('#view-reader') || document.body;
    if(dialog.parentElement !== parent) parent.appendChild(dialog);
    render(); dialog.showModal(); origin.setAttribute('aria-expanded','true');
    origin.setAttribute('aria-haspopup','dialog');origin.setAttribute('aria-controls','themedSelectPicker');
    var selected = choices.querySelector('[aria-pressed="true"]:not([disabled])') || choices.querySelector('button:not([disabled])');
    if(selected){selected.focus({preventScroll:true});selected.scrollIntoView({block:'nearest'});}
  }
  function bind(select){
    if(!select || typeof HTMLDialogElement === 'undefined' || !HTMLDialogElement.prototype.showModal) return;
    if(bindings.has(select)){sync(select);return;}
    if(document.activeElement === select){
      if(!waitingForBlur.has(select)){
        waitingForBlur.add(select);
        select.addEventListener('blur',function(){waitingForBlur.delete(select);bind(select);},{once:true});
      }
      return;
    }
    var trigger = document.createElement('button');
    trigger.type = 'button'; trigger.className = 'themed-select-trigger';
    trigger.dataset.themedSelect = select.id || 'compare-edition-'+select.dataset.compareIndex;
    trigger.setAttribute('aria-haspopup','dialog'); trigger.setAttribute('aria-controls','themedSelectPicker');trigger.setAttribute('aria-expanded','false');
    select.after(trigger); select.hidden = true;
    bindings.set(select,trigger);
    trigger.addEventListener('click',function(){open(select);});
    sync(select);
  }
  document.addEventListener('change',function(event){if(bindings.has(event.target)) sync(event.target);});
  return {bind:bind,open:open,sync:sync};
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
      var label=emptyVerse ? 'Verse' : labels[control.select.id]+': '+(option ? option.textContent : 'Unavailable');
      if(control.select.id==='readAloudVoice'){
        var female=control.select.value==='female', voice=female?'Female':'Male';
        if(control.button.dataset.readingVoice!==control.select.value){
          control.button.dataset.readingVoice=control.select.value;
          control.button.innerHTML='<svg viewBox="0 0 24 24" aria-hidden="true" focusable="false" fill="none" stroke="currentColor" stroke-width="1.6" stroke-linejoin="round"><circle cx="12" cy="5" r="3"/><path d="'+(female?'M9 11h6l4 9h-6v3h-2v-3H5z':'M8 11h8v11h-3v-6h-2v6H8z')+'"/></svg>';
        }
        label='Select reading voice, '+voice;
      } else if(control.button.textContent!==label) control.button.textContent=label;
      if(control.button.getAttribute('aria-label')!==(emptyVerse ? 'Verse, no verse selected' : label)) control.button.setAttribute('aria-label',emptyVerse ? 'Verse, no verse selected' : label);
      control.button.disabled=control.select.disabled || !control.select.options.length;
    });
    if(dialog && dialog.open) choices.querySelectorAll('[data-option-value]').forEach(function(option){
      option.setAttribute('aria-pressed',String(option.dataset.optionValue===activeSelect.value));
    });
    ReaderCompactControls.sync();
    ReaderReadingControls.sync();
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
      } else {
        advanceReaderNavigationChoice(select, select.value, function(next){
          var control=controls.find(function(item){return item.select===next;});
          if(control && !control.button.hidden) pick(next,control.button);
        });
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
    dialog.dataset.numeric=String(/^(chapterSelect|verseSelect)$/.test(select.id));
    passage=JSON.stringify([currentTranslation,currentBook,currentChapter,translationChangeRequest]);
    heading.textContent=numberedOnly?'Choose a verse to save':select.id==='readAloudVoice'?'Select Reading Voice':labels[select.id];choices.setAttribute('aria-label',labels[select.id]+' choices');
    choices.replaceChildren();
    Array.from(select.options).forEach(function(option){
      if(select.id==='verseSelect' && !option.value) return;
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
        select.addEventListener('blur',function(){if(media.matches && !(dialog && dialog.open) && !select.hasAttribute('data-reader-reparenting')) adapt();});
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
    ReaderCompactControls.initialize();
    ReaderReadingControls.initialize();
    sync();
  }
  return {initialize:initialize,sync:sync,save:save};
})();

// Reparent the existing controls; their IDs, state and event handlers stay intact.
// Comment anchors restore the exact desktop DOM without duplicate controls.
var ReaderCompactControls = window.ReaderCompactControls || (function(){
  var initialized=false, media, toolbar, panel, moves=[], stop, waitingForBlur=new WeakSet();
  function sync(){
    if(!initialized || !media.matches) return;
    var state=typeof BibleSpeech==='undefined' ? 'idle' : BibleSpeech.getState();
    var play=document.getElementById('readAloudPlay');
    var label=state==='playing' ? 'Pause reading aloud' : state==='paused' ? 'Resume reading aloud' : state==='preparing' ? 'Stop reading aloud' : 'Play reading aloud';
    if(play.getAttribute('aria-label')!==label) play.setAttribute('aria-label',label);
    if(play.dataset.playbackState!==state) play.dataset.playbackState=state;
    stop.disabled=state==='idle';
  }
  function initialize(){
    // A still-open shell-52 document retains its own layout until normal reload.
    if(initialized || !document.getElementById('readerVoiceCommands') || typeof HTMLDialogElement==='undefined' || !HTMLDialogElement.prototype.showModal) return;
    var active=document.activeElement;
    if(active && active.tagName==='SELECT' && active.closest('#view-reader .reader-toolbar')){
      if(!waitingForBlur.has(active)){
        waitingForBlur.add(active);
        active.addEventListener('blur',function(){waitingForBlur.delete(active);Promise.resolve().then(initialize);},{once:true});
      }
      return;
    }
    initialized=true;
    toolbar=document.querySelector('#view-reader .reader-toolbar');
    panel=document.getElementById('readerSecondaryControls');
    media=matchMedia('(max-width:620px)');
    var navigation=document.createElement('div');navigation.className='reader-compact-tabs';
    navigation.setAttribute('role','group');navigation.setAttribute('aria-label','Study Desk navigation');
    ['view-reader','view-compare','view-plan','offlineBiblesDialog'].forEach(function(id,index){
      var target=document.querySelector('.bs-nav [aria-controls="'+id+'"]');
      var button=document.createElement('button');button.type='button';button.textContent=['Reader','Compare','Plan','Offline'][index];
      button.setAttribute('aria-controls',id);
      if(index===3){button.setAttribute('aria-haspopup','dialog');button.setAttribute('aria-label','Offline Bibles');target.setAttribute('aria-label','Offline Bibles');}
      else button.setAttribute('aria-pressed',String(index===0));
      button.addEventListener('click',function(){
        if(index===0) return;
        if(document.getElementById('view-reader').classList.contains('reader-fullscreen')) toggleFullscreen();
        target.click();
        if(index!==3) target.focus({preventScroll:true});
      });
      navigation.appendChild(button);
      if(index===3){
        var update=function(){button.setAttribute('aria-expanded',target.getAttribute('aria-expanded') || 'false');};
        new MutationObserver(update).observe(target,{attributes:true,attributeFilter:['aria-expanded']});update();
      }
    });
    toolbar.prepend(navigation);
    var more=document.getElementById('readerMoreTrigger');
    function describeOptions(){
      if(media.matches) more.setAttribute('aria-label',more.getAttribute('aria-expanded')==='true' ? 'Hide Options' : 'Show Options');
      else more.removeAttribute('aria-label');
    }
    new MutationObserver(describeOptions).observe(more,{attributes:true,attributeFilter:['aria-expanded']});
    toolbar.addEventListener('keydown',function(event){
      if(media.matches && event.key==='Escape' && !event.defaultPrevented && more.getAttribute('aria-expanded')==='true' && !document.querySelector('dialog[open]')){
        event.preventDefault();setReaderOptionsOpen(false);
      }
    });
    var row=document.createElement('div');
    row.className='reader-compact-playback';row.setAttribute('role','group');row.setAttribute('aria-label','Reading controls');
    toolbar.insertBefore(row,panel);
    function move(element,parent,after){
      var anchor=document.createComment('Reader desktop position');
      element.before(anchor);moves.push({element:element,anchor:anchor,parent:parent,after:after});
    }
    move(document.getElementById('readerTranslation'),row);
    var translation=document.getElementById('readerTranslationTrigger');
    if(translation) move(translation,row);
    move(document.querySelector('[data-reader-action="previous-verse"]'),row);
    move(document.getElementById('readAloudPlay'),row);
    move(document.querySelector('[data-reader-action="next-verse"]'),row);
    ['readAloudVoice','readAloudSpeed'].forEach(function(id){
      move(document.getElementById(id).closest('.reader-speech-field'),row);
    });
    move(document.getElementById('readerVoiceCommands'),toolbar,more);
    move(document.getElementById('fullscreenBtn'),panel);
    stop=document.createElement('button');stop.type='button';stop.className='reader-compact-stop';stop.textContent='Stop reading aloud';
    stop.addEventListener('click',function(){stopReader();});panel.appendChild(stop);
    document.getElementById('readAloudPlay').addEventListener('click',function(event){
      if(!media.matches || typeof BibleSpeech==='undefined') return;
      var state=BibleSpeech.getState();
      if(state==='playing' || state==='paused'){
        event.preventDefault();event.stopImmediatePropagation();pauseResumeReadAloud();sync();
      }
    },true);
    function adapt(){
      // A focused element is retained during reparenting without scrolling it.
      var focus=document.activeElement;
      var native=focus && focus.tagName==='SELECT' && toolbar.contains(focus);
      if(native) focus.setAttribute('data-reader-reparenting','');
      moves.forEach(function(item){
        if(media.matches){if(item.after) item.after.after(item.element);else item.parent.appendChild(item.element);}
        else item.anchor.after(item.element);
      });
      toolbar.classList.toggle('reader-compact-mobile',media.matches);
      document.getElementById('bibleApp').classList.toggle('reader-compact-layout',media.matches);
      ['voiceStatusTop','readAloudStatus'].forEach(function(id){document.getElementById(id).classList.toggle('sr-only',media.matches);});
      row.hidden=!media.matches;
      navigation.hidden=!media.matches;stop.hidden=!media.matches;
      describeOptions();
      if(!media.matches && typeof BibleSpeech!=='undefined') BibleSpeech.updateControls();
      sync();
      if(focus && focus.getClientRects().length && document.activeElement!==focus) focus.focus({preventScroll:true});
      else if(focus && focus.id==='readerVoiceCommands' && !media.matches && panel.hidden) more.focus({preventScroll:true});
      if(native) focus.removeAttribute('data-reader-reparenting');
      if(typeof refreshReaderStickyOffsets==='function' && refreshReaderStickyOffsets) refreshReaderStickyOffsets();
    }
    media.addEventListener('change',adapt);adapt();
  }
  return {initialize:initialize,sync:sync};
})();

var ReaderReadingControls = window.ReaderReadingControls || (function(){
  var initialized=false, view, toolbar, recovery, media, sheetStyle, frame=0;
  var concealed=false, keyboard=false, interacting=false, assistive=false, revealed=false, readingGesture=false;
  var previousState='idle', context='', lastY=0, distance=0, direction=0, intent=0;
  var priorInert=false, priorAria=null, playbackSeen=false;
  function surface(){return view.classList.contains('reader-fullscreen') ? view : window;}
  function position(){return surface()===window ? window.scrollY : view.scrollTop;}
  function speechState(){return typeof BibleSpeech==='undefined' ? 'idle' : BibleSpeech.getState();}
  function scope(){
    var bounds=view.getBoundingClientRect();
    return media.matches && view.classList.contains('active') && bounds.bottom>0 && bounds.top<innerHeight ? surface()===window ? 'page' : 'fullscreen' : 'off';
  }
  function guarded(){
    var focused=document.activeElement, selection=window.getSelection();
    return interacting || assistive || toolbar.contains(focused) && (keyboard || !readingGesture && (focused.matches(':focus-visible') || focused.id!=='readAloudPlay')) ||
      document.querySelector('dialog[open],#tray.is-open') || selection && !selection.isCollapsed;
  }
  function recoveryHeight(){
    if(!sheetStyle || recovery.hidden) return;
    sheetStyle.setProperty('--reader-recovery-height',recovery.getBoundingClientRect().height+'px');
    if(toolbar.classList.contains('reader-compact-mobile') && !view.classList.contains('reader-fullscreen')){
      var tabs=readerStickyNavigation(), nav=document.querySelector('nav');
      var bottom=Math.max(nav ? nav.getBoundingClientRect().bottom : 0,tabs ? tabs.getBoundingClientRect().bottom : 0);
      sheetStyle.setProperty('--reader-recovery-top',(bottom+4)+'px');
    }
  }
  function focusControls(){
    var play=document.getElementById('readAloudPlay');
    (play.disabled || typeof BibleSpeech==='undefined' ? document.getElementById('readerMoreTrigger') : play).focus({preventScroll:true});
  }
  function conceal(value){
    if(concealed===value) return;
    concealed=value;
    if(value){
      priorInert=toolbar.inert;priorAria=toolbar.getAttribute('aria-hidden');
      recovery.hidden=false;recovery.setAttribute('aria-expanded','false');recoveryHeight();
      if(toolbar.contains(document.activeElement)) recovery.focus({preventScroll:true});
      toolbar.inert=true;toolbar.setAttribute('aria-hidden','true');
      view.classList.add('reader-controls-hidden');
    }else{
      view.classList.remove('reader-controls-hidden');toolbar.inert=priorInert;
      if(priorAria===null) toolbar.removeAttribute('aria-hidden');else toolbar.setAttribute('aria-hidden',priorAria);
      if(document.activeElement===recovery) focusControls();
      recovery.hidden=true;recovery.setAttribute('aria-expanded','true');
    }
  }
  function sync(){
    if(!initialized) return;
    var nextContext=scope(), state=speechState();
    if(nextContext!==context){
      context=nextContext;intent=0;distance=0;direction=0;lastY=position();revealed=false;conceal(false);
    }
    if(state==='idle' || state==='paused'){
      if(previousState!==state || state==='idle' && playbackSeen){revealed=false;conceal(false);}
    }
    playbackSeen=state!=='idle';
    previousState=state;
    if(context==='off'){conceal(false);return;}
    if(guarded()){
      if(document.querySelector('dialog[open],#tray.is-open') || toolbar.contains(document.activeElement)) conceal(false);
      return;
    }
    if(state==='playing' && !revealed) conceal(true);
    recoveryHeight();
  }
  function queue(){
    if(!initialized) return;
    if(speechState()!=='idle') playbackSeen=true;
    if(frame) return;
    frame=requestAnimationFrame(function(){frame=0;sync();});
  }
  function restore(){revealed=true;conceal(false);focusControls();}
  function gesture(event){
    if(!event.target.closest('#readerContent') || event.ctrlKey || event.touches && event.touches.length>1) return;
    intent=performance.now();readingGesture=true;
  }
  function scrolled(event){
    if(event.target!==document && event.target!==view) return;
    queue();
    var next=position(), delta=next-lastY;lastY=next;
    if(scope()==='off' || !intent || performance.now()-intent>1500 || !delta) return;
    var nextDirection=Math.sign(delta);
    distance=nextDirection===direction ? distance+Math.abs(delta) : Math.abs(delta);direction=nextDirection;
    if(distance<48 || guarded()) return;
    if(delta>0){revealed=false;conceal(true);}
    else if(speechState()!=='playing'){revealed=true;conceal(false);}
    distance=0;
  }
  function initialize(){
    if(initialized || !('inert' in HTMLElement.prototype)) return;
    initialized=true;view=document.getElementById('view-reader');toolbar=view.querySelector('.reader-toolbar');
    media=matchMedia('(max-width:620px) and (pointer:coarse)');toolbar.id=toolbar.id || 'readerControlStack';
    recovery=document.createElement('button');recovery.type='button';recovery.className='reader-show-controls';
    recovery.textContent='Show Controls';recovery.setAttribute('aria-label','Show Reader controls');
    recovery.setAttribute('aria-controls',toolbar.id);recovery.setAttribute('aria-expanded','true');recovery.hidden=true;
    view.prepend(recovery);recovery.addEventListener('click',restore);
    var tap=null;
    recovery.addEventListener('touchstart',function(event){
      var touch=event.touches[0];tap=event.touches.length===1 ? {id:touch.identifier,x:touch.clientX,y:touch.clientY} : null;
    },{passive:true});
    recovery.addEventListener('touchmove',function(event){
      var touch=event.touches[0];
      if(!tap || event.touches.length!==1 || touch.identifier!==tap.id || Math.hypot(touch.clientX-tap.x,touch.clientY-tap.y)>10) tap=null;
    },{passive:true});
    recovery.addEventListener('touchcancel',function(){tap=null;},{passive:true});
    recovery.addEventListener('touchend',function(event){
      var touch=event.changedTouches[0];
      if(tap && touch && touch.identifier===tap.id && Math.hypot(touch.clientX-tap.x,touch.clientY-tap.y)<=10){event.preventDefault();restore();}
      tap=null;
    },{passive:false});
    var sheet=Array.from(document.styleSheets).find(function(candidate){return candidate.href && /\/css\/companion\.css(?:\?|$)/.test(candidate.href);});
    if(sheet) sheetStyle=sheet.cssRules[sheet.insertRule('#view-reader { --reader-recovery-height:44px; }',sheet.cssRules.length)].style;
    if(typeof ResizeObserver!=='undefined') new ResizeObserver(recoveryHeight).observe(recovery);
    media.addEventListener('change',queue);
    document.addEventListener('pointerdown',function(event){
      keyboard=false;assistive=false;readingGesture=false;interacting=toolbar.contains(event.target);intent=0;distance=0;lastY=position();
    },true);
    ['pointerup','pointercancel'].forEach(function(type){document.addEventListener(type,function(){interacting=false;queue();},true);});
    window.addEventListener('keydown',function(event){
      keyboard=true;intent=0;readingGesture=false;
      if(concealed && event.key==='Escape' && (document.activeElement===recovery || document.activeElement===document.body)){
        event.preventDefault();event.stopPropagation();restore();
      }
    },true);
    document.addEventListener('click',function(event){if(toolbar.contains(event.target) && event.detail===0){assistive=true;queue();}},true);
    document.addEventListener('focusin',function(){if(!toolbar.contains(document.activeElement)) assistive=false;queue();});
    document.addEventListener('selectionchange',queue);
    view.addEventListener('touchmove',gesture,{passive:true});view.addEventListener('wheel',gesture,{passive:true});
    document.addEventListener('scroll',scrolled,{passive:true,capture:true});
    document.addEventListener('scrollend',function(){intent=0;distance=0;},{passive:true,capture:true});
    var observer=new MutationObserver(queue);
    observer.observe(view,{attributes:true,attributeFilter:['class']});
    observer.observe(document.body,{subtree:true,attributes:true,attributeFilter:['open']});
    observer.observe(document.getElementById('tray'),{attributes:true,attributeFilter:['class']});
    sync();
  }
  return {initialize:initialize,sync:queue};
})();

// Temporary local diagnostics: fragment opt-in, one final result, no persistence.
var ReaderVoiceDiagnostics=(function(){
  var panel,fields={},expiry,enabled=false,tracing=false,captured=false;
  function clear(){
    clearTimeout(expiry);expiry=null;tracing=false;captured=false;
    Object.keys(fields).forEach(function(key){fields[key].textContent='—';});
  }
  function hidden(){if(document.hidden) clear();}
  function status(message){
    if(!enabled || !tracing || document.hidden) return;
    fields.outcome.textContent=message+'\nSelected: '+currentTranslation+' / '+currentBook+' '+currentChapter+(currentVerse===null?'':':'+currentVerse);
  }
  function initialize(){
    if(enabled || location.hash!=='#voice-debug') return;
    var view=document.getElementById('view-reader');if(!view) return;
    enabled=true;panel=document.createElement('section');panel.id='readerVoiceDebug';
    panel.setAttribute('aria-labelledby','readerVoiceDebugHeading');
    var heading=document.createElement('h3');heading.id='readerVoiceDebugHeading';heading.textContent='Local Voice Commands diagnostics';panel.appendChild(heading);
    var note=document.createElement('p');note.textContent='Diagnostic build voice-trace-1 (base 9b54d3f). Text stays on this page only and clears after 60 seconds, on the next command, or when this page is hidden. Speech recognition still uses your browser’s normal service.';panel.appendChild(note);
    var list=document.createElement('dl');
    [['raw','Exact final transcript (JSON escaped)'],['alternatives','Alternatives returned by the browser'],['normalized','Normalized transcript'],['decision','Command classification / parser decision'],['outcome','Handler status / selected passage']].forEach(function(row){
      var label=document.createElement('dt');label.textContent=row[1];var value=document.createElement('dd');value.dataset.voiceDebug=row[0];fields[row[0]]=value;list.append(label,value);
    });panel.appendChild(list);
    var clearButton=document.createElement('button');clearButton.type='button';clearButton.textContent='Clear diagnostic text';clearButton.addEventListener('click',clear);
    var close=document.createElement('button');close.type='button';close.textContent='Disable diagnostics';
    close.addEventListener('click',function(){
      clear();enabled=false;panel.remove();panel=null;fields={};
      document.removeEventListener('visibilitychange',hidden);window.removeEventListener('pagehide',clear);
      if(location.hash==='#voice-debug') history.replaceState(history.state,'',location.pathname+location.search);
      var mic=document.querySelector('[data-voice-command-button]');if(mic) mic.focus({preventScroll:true});
    });panel.append(clearButton,close);
    view.insertBefore(panel,document.getElementById('readerContent'));
    document.addEventListener('visibilitychange',hidden);window.addEventListener('pagehide',clear);
    clear();tracing=true;status('Ready. Tap Voice Commands and say one command.');
  }
  function start(recognition){
    if(!enabled) return;
    clear();tracing=true;status('Reader bridge voice-trace-1 reached. Waiting for a final result.');
    try { recognition.maxAlternatives=3; } catch(error) { /* Optional diagnostic hint, never required for listening. */ }
  }
  function final(result){
    if(!enabled || document.hidden) return;
    clear();tracing=true;captured=true;fields.raw.textContent=JSON.stringify(result[0].transcript);
    var alternatives=[];for(var i=0;i<Math.min(result.length,3);i++) alternatives.push((i+1)+': '+JSON.stringify(result[i].transcript));
    fields.alternatives.textContent=alternatives.join('\n');
    fields.normalized.textContent=JSON.stringify(normalizeSpokenNavigation(result[0].transcript));
    status('Accepted final result. Waiting for microphone release before dispatch.');
    expiry=setTimeout(clear,60000);
  }
  function dispatch(transcript,simple){
    if(!enabled || !captured || document.hidden) return;
    var plan=simple?null:parseSpokenNavigation(transcript);
    fields.decision.textContent=(fields.raw.textContent===JSON.stringify(transcript)?'Exact final reached handler. ':'Handler called without a captured final. ')+(simple?'Playback command.':!plan?'No translation/reference match.':plan.error||JSON.stringify(plan));
    status('Command handler reached.');
  }
  return {initialize:initialize,start:start,final:final,dispatch:dispatch,status:status};
})();
ReaderVoiceDiagnostics.initialize();
