/* ===== SCRIPTURE COMPANION STATE & FUNCTIONS ===== */
const initialReaderPosition = UserData.readerPosition.load();
let currentBook = initialReaderPosition.bookId;
let currentChapter = initialReaderPosition.chapter;
let currentVerse = initialReaderPosition.verse || null;
let currentTranslation = UserData.translation.load();
let voiceRecognition = null;
let voiceCommandsListening = false;
let voiceRecognitionActive = false;
let voiceCommandsStopping = false;
let voiceRecognitionBlocked = false;
let voiceRestartTimer = null;
let voicePermissionChecked = false;

function getReaderControls(){
  return document.querySelectorAll('[data-reader-controls]');
}

function setVoiceStatus(message){
  document.querySelectorAll('.voice-status').forEach(function(status){ status.textContent = message; });
}

function updateReaderControls(){
  var chapterCount = typeof BibleData === 'undefined' ? 0 : BibleData.getChapterCount(currentTranslation, currentBook);
  var chapter = typeof BibleData === 'undefined' ? null : BibleData.getChapter(currentTranslation, currentBook, currentChapter);
  var verseCount = chapter ? chapter.verses.length : 0;
  document.querySelectorAll('[data-reader-action="previous"]').forEach(function(button){
    button.disabled = currentChapter <= 1;
  });
  document.querySelectorAll('[data-reader-action="next"]').forEach(function(button){
    button.disabled = !chapterCount || currentChapter >= chapterCount;
  });
  document.querySelectorAll('[data-reader-action="previous-verse"]').forEach(function(button){
    button.disabled = !Number.isInteger(currentVerse) || currentVerse <= 1;
  });
  document.querySelectorAll('[data-reader-action="next-verse"]').forEach(function(button){
    button.disabled = !verseCount || (Number.isInteger(currentVerse) && currentVerse >= verseCount);
  });
}

function setVoiceButtonState(isListening){
  document.querySelectorAll('[data-voice-command-button]').forEach(function(button){
    button.setAttribute('aria-pressed', isListening ? 'true' : 'false');
    button.title = isListening ? 'Stop listening for voice commands' : 'Start voice commands';
  });
}

function getReaderText(){
  var passage = document.getElementById('readerContent');
  return passage ? passage.innerText : '';
}

function playReader(){
  readCurrentChapterAloud();
}

function pauseReader(){
  pauseResumeReadAloud();
}

function resumeReader(){
  pauseResumeReadAloud();
}

function stopReader(){
  stopReadAloud();
}

function getVoiceRecognition(){
  return window.SpeechRecognition || window.webkitSpeechRecognition;
}

function getVoiceRecognitionErrorMessage(error){
  var messages = {
    'not-allowed': 'Microphone access is blocked. Allow microphone access in your browser to use Voice Commands.',
    'service-not-allowed': 'Voice recognition is blocked by the browser or operating system.',
    'audio-capture': 'No microphone was detected. Check your microphone and try again.',
    'no-speech': 'No speech was detected. Try again.',
    'network': 'Voice recognition could not connect. Check your internet connection or try again.'
  };
  return messages[error] || 'Voice command error: ' + error;
}

function normalizeBookName(value){
  var normalized = String(value || '').toLowerCase().replace(/[^a-z0-9]+/g, ' ').trim();
  return normalized.replace(/^first\s+/, '1 ').replace(/^second\s+/, '2 ').replace(/^third\s+/, '3 ');
}

function findReaderBook(bookText){
  var requestedBook = normalizeBookName(bookText);
  return BibleData.listBooks(currentTranslation).sort(function(first, second){
    return normalizeBookName(second.name).length - normalizeBookName(first.name).length;
  }).find(function(candidate){
    return normalizeBookName(candidate.name) === requestedBook || normalizeBookName(candidate.id) === requestedBook;
  });
}

function getReaderPosition(){
  var position = {bookId: currentBook, chapter: currentChapter};
  if(Number.isInteger(currentVerse) && currentVerse > 0) position.verse = currentVerse;
  return position;
}

function saveReaderPosition(){
  return UserData.readerPosition.save(getReaderPosition());
}

function clearReaderVerseSelection(){
  currentVerse = null;
  var select = document.getElementById('verseSelect');
  if(select) select.value = '';
  document.querySelectorAll('#readerContent [data-verse-number], #fsContent [data-verse-number]').forEach(function(element){
    element.classList.remove('verse-focused');
  });
}

function applyReaderVerseSelection(verseNumber, shouldFocus){
  var verse = Number(verseNumber);
  var target = document.querySelector('#readerContent [data-verse-number="' + verse + '"]');
  if(!target) return false;
  document.querySelectorAll('#readerContent [data-verse-number], #fsContent [data-verse-number]').forEach(function(element){
    element.classList.toggle('verse-focused', Number(element.getAttribute('data-verse-number')) === verse);
  });
  var select = document.getElementById('verseSelect');
  if(select) select.value = String(verse);
  if(shouldFocus){
    target.setAttribute('tabindex', '-1');
    target.focus({ preventScroll: true });
    target.scrollIntoView({ behavior: 'smooth', block: 'center' });
  }
  return true;
}

function populateVerses(){
  var select = document.getElementById('verseSelect');
  if(!select || typeof BibleData === 'undefined') return;
  var chapter = BibleData.getChapter(currentTranslation, currentBook, currentChapter);
  select.innerHTML = '<option value="">Verse</option>';
  if(!chapter) return;
  chapter.verses.forEach(function(_, index){
    var option = document.createElement('option');
    option.value = String(index + 1);
    option.textContent = String(index + 1);
    select.appendChild(option);
  });
}

function setReaderVerse(verseNumber, shouldFocus){
  var verse = BibleData.getVerse(currentTranslation, currentBook, currentChapter, Number(verseNumber));
  if(!verse || !applyReaderVerseSelection(verse.verse, shouldFocus)) return false;
  currentVerse = verse.verse;
  saveReaderPosition();
  updateReaderControls();
  return true;
}

function selectReaderVerse(verseNumber){
  if(verseNumber === '' || verseNumber === null || verseNumber === undefined){
    clearReaderVerseSelection();
    saveReaderPosition();
    updateReaderControls();
    return true;
  }
  return setReaderVerse(verseNumber, true);
}

function navigateToSpokenBook(bookText, chapterNumber, verseNumber){
  if(typeof BibleData === 'undefined') return false;
  var book = findReaderBook(bookText);
  if(!book) return false;
  var chapter = chapterNumber ? Number(chapterNumber) : 1;
  if(!Number.isInteger(chapter) || chapter < 1 || chapter > BibleData.getChapterCount(currentTranslation, book.id)) return false;
  var bookSelect = document.getElementById('bookSelect');
  var chapterSelect = document.getElementById('chapterSelect');
  if(!bookSelect || !chapterSelect) return false;
  bookSelect.value = book.id;
  populateChapters();
  chapterSelect.value = String(chapter);
  currentVerse = null;
  loadPassage();
  if(verseNumber !== undefined && !selectReaderVerse(verseNumber)) return false;
  return true;
}

function handleSpokenReferenceCommand(command){
  var actionMatch = /^(play|read|open|go to)\s+(.+)$/.exec(command);
  var action = actionMatch ? actionMatch[1] : '';
  var reference = normalizeBookName(actionMatch ? actionMatch[2] : command);
  var books = typeof BibleData === 'undefined' ? [] : BibleData.listBooks(currentTranslation).sort(function(first, second){
    return normalizeBookName(second.name).length - normalizeBookName(first.name).length;
  });
  var book = books.find(function(candidate){
    var name = normalizeBookName(candidate.name);
    return reference === name || reference.indexOf(name + ' ') === 0;
  });
  if(!book){
    if(actionMatch || /\d/.test(reference)) setVoiceStatus('Book, chapter, or verse not found.');
    return Boolean(actionMatch || /\d/.test(reference));
  }
  var remainder = reference.slice(normalizeBookName(book.name).length).trim();
  var match = /^(?:chapter\s+)?(\d+)(?:\s*:\s*|\s+verse\s+|\s+)(\d+)$/.exec(remainder);
  var chapterOnly = /^(?:chapter\s+)?(\d+)$/.exec(remainder);
  if(remainder && !match && !chapterOnly){
    setVoiceStatus('Book or chapter not found.');
    return true;
  }
  var chapterNumber = match ? match[1] : chapterOnly ? chapterOnly[1] : undefined;
  var verseNumber = match ? match[2] : undefined;
  if(!navigateToSpokenBook(book.name, chapterNumber, verseNumber)){
    setVoiceStatus('Book, chapter, or verse not found.');
    return true;
  }
  if(action === 'play' || action === 'read'){
    if(verseNumber){
      var verse = BibleData.getVerse(currentTranslation, currentBook, currentChapter, Number(verseNumber));
      BibleSpeech.playVerse(verse.text);
    } else readCurrentChapterAloud();
  }
  return true;
}

function handleVoiceCommand(transcript){
  var command = transcript.toLowerCase().trim().replace(/[.!?]+$/, '');
  setVoiceStatus('Command recognized: ' + transcript);
  if(/^(play|read)( the passage)?$/.test(command)) playReader();
  else if(command === 'pause') pauseReader();
  else if(command === 'resume') resumeReader();
  else if(command === 'stop') stopReader();
  else if(command === 'next verse') nextReaderVerse();
  else if(/^(previous verse|back verse)$/.test(command)) previousReaderVerse();
  else if(/^(next chapter|next|go to next chapter)$/.test(command)) nextChapter();
  else if(/^(previous chapter|previous|back|go to previous chapter)$/.test(command)) prevChapter();
  else if(handleSpokenReferenceCommand(command)) return;
  else setVoiceStatus('Unrecognized command: ' + transcript);
}

function clearVoiceCommandTimers(){
  if(voiceRestartTimer){
    clearTimeout(voiceRestartTimer);
    voiceRestartTimer = null;
  }
}

function finishVoiceCommands(showReadyStatus){
  clearVoiceCommandTimers();
  voiceCommandsListening = false;
  voiceRecognitionActive = false;
  voiceCommandsStopping = false;
  setVoiceButtonState(false);
  if(showReadyStatus) setVoiceStatus('Ready for a voice command.');
}

function createVoiceRecognition(){
  var Recognition = getVoiceRecognition();
  if(!Recognition || voiceRecognition) return voiceRecognition;
  voiceRecognition = new Recognition();
  voiceRecognition.continuous = false;
  voiceRecognition.interimResults = false;
  voiceRecognition.lang = 'en-US';
  voiceRecognition.onstart = function(){
    voiceRecognitionActive = true;
    if(voiceCommandsListening) setVoiceStatus('Listening for a command...');
  };
  voiceRecognition.onresult = function(event){
    var resultIndex = Number.isInteger(event.resultIndex) ? event.resultIndex : event.results.length - 1;
    var result = event.results && event.results[resultIndex];
    if(!result || result.isFinal === false || !result[0] || !result[0].transcript) return;
    handleVoiceCommand(result[0].transcript);
  };
  voiceRecognition.onerror = function(event){
    voiceRecognitionActive = false;
    var intentionalStop = voiceCommandsStopping || !voiceCommandsListening;
    if(intentionalStop && event.error === 'aborted') return;
    if(event.error === 'no-speech'){
      setVoiceStatus(getVoiceRecognitionErrorMessage(event.error));
      return;
    }
    voiceRecognitionBlocked = event.error === 'not-allowed' || event.error === 'service-not-allowed' || event.error === 'audio-capture';
    setVoiceStatus(getVoiceRecognitionErrorMessage(event.error));
    finishVoiceCommands(false);
  };
  voiceRecognition.onend = function(){
    voiceRecognitionActive = false;
    if(voiceCommandsStopping || !voiceCommandsListening){
      voiceCommandsStopping = false;
      return;
    }
    scheduleVoiceRecognitionRestart();
  };
  return voiceRecognition;
}

function startVoiceRecognition(){
  if(!voiceCommandsListening || voiceRecognitionBlocked || voiceRecognitionActive || voiceRestartTimer) return;
  var recognition = createVoiceRecognition();
  if(!recognition) return;
  voiceCommandsStopping = false;
  voiceRecognitionActive = true;
  setVoiceStatus('Listening for a command...');
  try {
    recognition.start();
  } catch(error){
    if(error && error.name === 'InvalidStateError') return;
    voiceRecognitionActive = false;
    setVoiceStatus('Voice command error: ' + (error && error.message ? error.message : 'Unable to start recognition.'));
    finishVoiceCommands(false);
  }
}

function scheduleVoiceRecognitionRestart(){
  if(!voiceCommandsListening || voiceRecognitionBlocked || voiceRestartTimer) return;
  voiceRestartTimer = setTimeout(function(){
    voiceRestartTimer = null;
    startVoiceRecognition();
  }, 250);
}

function enableVoiceCommands(){
  if(!getVoiceRecognition()){
    setVoiceStatus('Voice commands are not supported in this browser. Read Aloud is still available.');
    return;
  }
  clearVoiceCommandTimers();
  voiceRecognitionBlocked = false;
  voiceCommandsStopping = false;
  voiceCommandsListening = true;
  setVoiceButtonState(true);
  startVoiceRecognition();
}

function disableVoiceCommands(){
  clearVoiceCommandTimers();
  voiceCommandsListening = false;
  voiceCommandsStopping = true;
  setVoiceButtonState(false);
  setVoiceStatus('Ready for a voice command.');
  if(voiceRecognitionActive && voiceRecognition && typeof voiceRecognition.stop === 'function'){
    voiceRecognition.stop();
  } else {
    voiceRecognitionActive = false;
    voiceCommandsStopping = false;
  }
}

function toggleVoiceCommands(){
  if(voiceCommandsListening) disableVoiceCommands();
  else enableVoiceCommands();
}

function initializeVoiceCommands(){
  if(voicePermissionChecked) return;
  voicePermissionChecked = true;
  if(!getVoiceRecognition() || !navigator.permissions || typeof navigator.permissions.query !== 'function') return;
  var permissionRequest;
  try {
    permissionRequest = navigator.permissions.query({name:'microphone'});
  } catch(error){
    return;
  }
  Promise.resolve(permissionRequest).then(function(permission){
    if(!permission) return;
    if(permission.state === 'granted') enableVoiceCommands();
    else if(permission.state === 'denied'){
      voiceRecognitionBlocked = true;
      setVoiceStatus(getVoiceRecognitionErrorMessage('not-allowed'));
    }
    permission.onchange = function(){
      if(permission.state === 'granted' && !voiceCommandsListening) enableVoiceCommands();
      else if(permission.state === 'denied' && voiceCommandsListening){
        voiceRecognitionBlocked = true;
        disableVoiceCommands();
        setVoiceStatus(getVoiceRecognitionErrorMessage('not-allowed'));
      }
    };
  }).catch(function(){
    // Permission probing is optional. The button remains the explicit fallback.
  });
}

function escapeHtml(value){
  return String(value).replace(/[&<>"']/g, function(character){
    return {'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[character];
  });
}

function renderStudyWordTokens(text){
  return String(text).split(/([A-Za-z0-9]+(?:['\u2019-][A-Za-z0-9]+)*)/g).map(function(token){
    if(!/^[A-Za-z0-9]/.test(token)) return escapeHtml(token);
    var lookupTerm = typeof WordStudyProvider === 'undefined' ? token.toLowerCase() : WordStudyProvider.normalizeLookupTerm(token);
    return '<span class="word-study-token" role="button" tabindex="0" aria-label="Study word ' + escapeHtml(token) + '" data-word-study-display="' + escapeHtml(token) + '" data-word-study-term="' + escapeHtml(lookupTerm) + '">' + escapeHtml(token) + '</span>';
  }).join('');
}

function switchView(view, btn){
  document.querySelectorAll('.bs-view').forEach(function(v){ v.classList.remove('active'); });
  var target = document.getElementById('view-' + view);
  if(!target || !btn) return;
  if(view === 'compare'){
    if(typeof initializeCompareReference === 'function') initializeCompareReference();
    if(typeof loadCompare === 'function') loadCompare();
  }
  target.classList.add('active');
  document.querySelectorAll('.bs-btn').forEach(function(b){ b.classList.remove('active'); });
  document.querySelectorAll('.bs-btn[aria-pressed]').forEach(function(b){ b.setAttribute('aria-pressed', 'false'); });
  btn.classList.add('active');
  btn.setAttribute('aria-pressed', 'true');
}

function populateBooks(){
  var bookSelect = document.getElementById('bookSelect');
  if(!bookSelect || typeof BibleData === 'undefined') return;
  bookSelect.innerHTML = '';
  var books = BibleData.listBooks(currentTranslation);
  books.forEach(function(book){
    var option = document.createElement('option');
    option.value = book.id;
    option.textContent = book.name;
    bookSelect.appendChild(option);
  });
  if(!books.some(function(book){ return book.id === currentBook; })){
    var defaultBook = books.find(function(book){ return book.id === 'john'; }) || books[0];
    currentBook = defaultBook ? defaultBook.id : 'john';
    currentChapter = 1;
    currentVerse = null;
  }
  bookSelect.value = currentBook;
}

function populateTranslations(){
  var translationSelect = document.getElementById('readerTranslation');
  if(!translationSelect || typeof BibleData === 'undefined') return;
  var translations = BibleData.listTranslations().filter(function(translation){ return translation.id !== 'demo-local'; });
  translationSelect.innerHTML = '';
  translations.forEach(function(translation){
    var option = document.createElement('option');
    option.value = translation.id;
    option.textContent = translation.abbreviation + ' — ' + translation.name;
    translationSelect.appendChild(option);
  });
  var selectedIndex = translations.findIndex(function(translation){ return translation.id === currentTranslation; });
  if(selectedIndex < 0) selectedIndex = translations.length ? 0 : -1;
  if(selectedIndex >= 0){
    currentTranslation = translations[selectedIndex].id;
    translationSelect.selectedIndex = selectedIndex;
    UserData.translation.save(currentTranslation);
  }
}

function changeTranslation(translationId){
  if(typeof BibleData === 'undefined' || !BibleData.listTranslations().some(function(translation){ return translation.id === translationId; })) return;
  var bookSelect = document.getElementById('bookSelect');
  if(bookSelect && bookSelect.value) currentBook = bookSelect.value;
  currentTranslation = translationId;
  UserData.translation.save(currentTranslation);
  var translationSelect = document.getElementById('readerTranslation');
  if(translationSelect) translationSelect.value = currentTranslation;
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
  loadPassage();
}

function populateChapters(){
  var bookSelect = document.getElementById('bookSelect');
  var sel = document.getElementById('chapterSelect');
  if(!bookSelect || !sel || typeof BibleData === 'undefined') return;
  var book = bookSelect.value;
  var chapterCount = BibleData.getChapterCount(currentTranslation, book);
  if(!Number.isInteger(currentChapter) || currentChapter < 1 || currentChapter > chapterCount){
    currentChapter = 1;
    currentVerse = null;
  }
  sel.innerHTML = '';
  for(var i = 1; i <= chapterCount; i++){
    sel.innerHTML += '<option>' + i + '</option>';
  }
  sel.value = String(currentChapter);
}

function changeReaderBook(){
  var bookSelect = document.getElementById('bookSelect');
  if(!bookSelect) return;
  currentVerse = null;
  populateChapters();
  loadPassage();
}

function renderPassage(bookKey, chapterNum, containerId){
  var data = BibleData.getChapter(currentTranslation, bookKey, chapterNum);
  if(!data) return;
  var bookName = escapeHtml(data.bookName);
  var html = '<h2>' + bookName + ' ' + escapeHtml(chapterNum) + '</h2>';
  if(data.subtitle) html += '<div class="subtitle">' + escapeHtml(data.subtitle) + '</div>';
  html += '<div style="text-align:center;color:var(--ink-soft);font-size:14px;margin-bottom:20px;font-style:italic;">' + escapeHtml(data.title) + '</div>';
  for(var i = 0; i < data.verses.length; i++){
    html += '<span class="reader-verse" data-translation-id="' + escapeHtml(currentTranslation) + '" data-book-id="' + escapeHtml(bookKey) + '" data-book-name="' + bookName + '" data-chapter="' + escapeHtml(chapterNum) + '" data-verse-number="' + escapeHtml(i+1) + '" data-verse-text="' + escapeHtml(data.verses[i]) + '"><button type="button" class="vnum" aria-label="Highlight verse ' + escapeHtml(i+1) + '" onclick="highlightVerse(this)">' + escapeHtml(i+1) + '</button>' + renderStudyWordTokens(data.verses[i]) + ' <button type="button" class="verse-speak" data-verse-speech="' + escapeHtml(i+1) + '" aria-label="Read verse ' + escapeHtml(i+1) + ' aloud" onclick="readVerseAloud(' + escapeHtml(i+1) + ')">Read aloud</button></span> ';
  }
  var container = document.getElementById(containerId);
  var fsTitle = document.getElementById('fsTitle');
  var fsContent = document.getElementById('fsContent');
  if(container) container.innerHTML = html;
  if(fsTitle) fsTitle.textContent = bookName + ' ' + chapterNum;
  if(fsContent) fsContent.innerHTML = html;
  populateVerses();
}

function loadPassage(){
  var bookSelect = document.getElementById('bookSelect');
  var chapterSelect = document.getElementById('chapterSelect');
  if(!bookSelect || !chapterSelect || typeof BibleData === 'undefined') return;
  if(typeof BibleSpeech !== 'undefined') BibleSpeech.stop();
  var nextBook = bookSelect.value;
  var nextChapter = parseInt(chapterSelect.value, 10);
  if(nextBook !== currentBook || nextChapter !== currentChapter) currentVerse = null;
  currentBook = nextBook;
  currentChapter = nextChapter;
  if(!BibleData.getChapter(currentTranslation, currentBook, currentChapter)) return;
  renderPassage(currentBook, currentChapter, 'readerContent');
  if(currentVerse && BibleData.getVerse(currentTranslation, currentBook, currentChapter, currentVerse)){
    applyReaderVerseSelection(currentVerse, false);
  } else {
    clearReaderVerseSelection();
  }
  saveReaderPosition();
  updateReaderControls();
}

function readCurrentChapterAloud(){
  if(typeof BibleSpeech === 'undefined') return;
  var chapter = BibleData.getChapter(currentTranslation, currentBook, currentChapter);
  BibleSpeech.playChapter(chapter);
}

function readVerseAloud(verseNumber){
  if(typeof BibleSpeech === 'undefined' || typeof BibleData === 'undefined') return;
  var verse = BibleData.getVerse(currentTranslation, currentBook, currentChapter, verseNumber);
  if(verse) BibleSpeech.playVerse(verse.text);
}

function pauseResumeReadAloud(){
  if(typeof BibleSpeech !== 'undefined') BibleSpeech.pauseResume();
}

function stopReadAloud(){
  if(typeof BibleSpeech !== 'undefined') BibleSpeech.stop();
}

function prevChapter(){
  if(currentChapter > 1){
    currentChapter--;
    document.getElementById('chapterSelect').value = currentChapter;
    populateVerses();
    loadPassage();
  }
}
function nextChapter(){
  if(currentChapter < BibleData.getChapterCount(currentTranslation, currentBook)){
    currentChapter++;
    document.getElementById('chapterSelect').value = currentChapter;
    populateVerses();
    loadPassage();
  }
}

function previousReaderVerse(){
  if(!Number.isInteger(currentVerse) || currentVerse <= 1) return;
  setReaderVerse(currentVerse - 1, false);
}

function nextReaderVerse(){
  var chapter = BibleData.getChapter(currentTranslation, currentBook, currentChapter);
  if(!chapter) return;
  var next = Number.isInteger(currentVerse) ? currentVerse + 1 : 1;
  if(next > chapter.verses.length) return;
  setReaderVerse(next, false);
}

function highlightVerse(el){
  el.classList.toggle('highlighted');
  var verseElement = el.closest('[data-verse-number]');
  var verseNumber = verseElement ? Number(verseElement.getAttribute('data-verse-number')) : NaN;
  if(!Number.isInteger(verseNumber) || verseNumber < 1) return;
  if(el.classList.contains('highlighted')){
    currentVerse = verseNumber;
    applyReaderVerseSelection(currentVerse, false);
  } else if(currentVerse === verseNumber){
    clearReaderVerseSelection();
  }
  saveReaderPosition();
  updateReaderControls();
}

function toggleFullscreen(){
  var overlay = document.getElementById('fsOverlay');
  var fullscreenButton = document.getElementById('fullscreenBtn');
  var verseNavigation = document.getElementById('readerVerseNavigation');
  var readerContent = document.getElementById('readerContent');
  var fullscreenContent = document.getElementById('fsContent');
  if(!overlay) return;
  overlay.classList.toggle('active');
  var isActive = overlay.classList.contains('active');
  overlay.setAttribute('aria-hidden', isActive ? 'false' : 'true');
  if(fullscreenButton) fullscreenButton.setAttribute('aria-pressed', isActive ? 'true' : 'false');
  if(isActive){
    if(verseNavigation && fullscreenContent) overlay.insertBefore(verseNavigation, fullscreenContent);
    var closeButton = overlay.querySelector('.fs-close');
    if(closeButton) closeButton.focus();
  } else {
    if(verseNavigation && readerContent && readerContent.parentNode) readerContent.parentNode.insertBefore(verseNavigation, readerContent);
    if(fullscreenButton) fullscreenButton.focus();
  }
}

document.addEventListener('keydown', function(event){
  var overlay = document.getElementById('fsOverlay');
  if(!overlay || !overlay.classList.contains('active')) return;
  if(event.key === 'Escape'){
    event.preventDefault();
    toggleFullscreen();
  } else if(event.key === 'Tab'){
    var focusable = Array.from(overlay.querySelectorAll('button:not([disabled]), [href], input:not([disabled]), select:not([disabled]), textarea:not([disabled]), [tabindex]:not([tabindex="-1"])'));
    if(!focusable.length) return;
    var first = focusable[0];
    var last = focusable[focusable.length - 1];
    if(event.shiftKey && document.activeElement === first){
      event.preventDefault();
      last.focus();
    } else if(!event.shiftKey && document.activeElement === last){
      event.preventDefault();
      first.focus();
    }
  }
});

if(typeof WordStudyController !== 'undefined') WordStudyController.initialize();
if(document.readyState === 'loading') window.addEventListener('DOMContentLoaded', initializeVoiceCommands, { once: true });
else initializeVoiceCommands();
