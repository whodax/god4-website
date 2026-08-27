/* ===== SCRIPTURE COMPANION STATE & FUNCTIONS ===== */
let currentBook = 'john';
let currentChapter = 1;
const TRANSLATION_STORAGE_KEY = 'god4.translation';
let currentTranslation = localStorage.getItem(TRANSLATION_STORAGE_KEY) || 'web';
let voiceRecognition = null;
let voiceCommandsListening = false;
let voiceCommandsStopping = false;
let voiceCommandTimer = null;
let voiceCommandStatusTimer = null;
let voiceCommandResultReceived = false;

function getReaderControls(){
  return document.querySelectorAll('[data-reader-controls]');
}

function setVoiceStatus(message){
  document.querySelectorAll('.voice-status').forEach(function(status){ status.textContent = message; });
}

function updateReaderControls(){
  var chapterCount = typeof BibleData === 'undefined' ? 0 : BibleData.getChapterCount(currentTranslation, currentBook);
  document.querySelectorAll('[data-reader-action="previous"]').forEach(function(button){
    button.disabled = currentChapter <= 1;
  });
  document.querySelectorAll('[data-reader-action="next"]').forEach(function(button){
    button.disabled = !chapterCount || currentChapter >= chapterCount;
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

function focusReaderVerse(verseNumber){
  var verse = Number(verseNumber);
  var target = document.querySelector('#readerContent [data-verse-number="' + verse + '"]');
  if(!target) return false;
  document.querySelectorAll('#readerContent [data-verse-number]').forEach(function(element){
    element.classList.toggle('verse-focused', element === target);
  });
  target.setAttribute('tabindex', '-1');
  target.focus({ preventScroll: true });
  target.scrollIntoView({ behavior: 'smooth', block: 'center' });
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

function selectReaderVerse(verseNumber){
  var verse = BibleData.getVerse(currentTranslation, currentBook, currentChapter, Number(verseNumber));
  if(!verse || !focusReaderVerse(verse.verse)) return;
  document.getElementById('verseSelect').value = String(verse.verse);
  return true;
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
  currentBook = book.id;
  populateChapters();
  chapterSelect.value = String(chapter);
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
  else if(/^(next chapter|next|go to next chapter)$/.test(command)) nextChapter();
  else if(/^(previous chapter|previous|go to previous chapter)$/.test(command)) prevChapter();
  else if(handleSpokenReferenceCommand(command)) return;
  else setVoiceStatus('Unrecognized command: ' + transcript);
}

function clearVoiceCommandTimers(){
  if(voiceCommandTimer){
    clearTimeout(voiceCommandTimer);
    voiceCommandTimer = null;
  }
  if(voiceCommandStatusTimer){
    clearTimeout(voiceCommandStatusTimer);
    voiceCommandStatusTimer = null;
  }
}

function finishVoiceCommands(showReadyStatus){
  clearVoiceCommandTimers();
  voiceCommandsListening = false;
  voiceCommandsStopping = false;
  setVoiceButtonState(false);
  if(showReadyStatus) setVoiceStatus('Ready for a voice command.');
}

function toggleVoiceCommands(){
  var Recognition = getVoiceRecognition();
  if(!Recognition){
    setVoiceStatus('Voice commands are not supported in this browser. Read Aloud is still available.');
    return;
  }
  if(voiceCommandsListening){
    voiceCommandsStopping = true;
    if(voiceRecognition && typeof voiceRecognition.stop === 'function'){
      voiceRecognition.stop();
    } else {
      finishVoiceCommands(true);
    }
    return;
  }
  if(!voiceRecognition){
    voiceRecognition = new Recognition();
    voiceRecognition.continuous = false;
    voiceRecognition.interimResults = false;
    voiceRecognition.lang = 'en-US';
    voiceRecognition.onresult = function(event){
      var resultIndex = Number.isInteger(event.resultIndex) ? event.resultIndex : event.results.length - 1;
      var result = event.results && event.results[resultIndex];
      if(!result || result.isFinal === false || !result[0] || !result[0].transcript) return;
      voiceCommandResultReceived = true;
      handleVoiceCommand(result[0].transcript);
      finishVoiceCommands(false);
      voiceCommandStatusTimer = setTimeout(function(){ setVoiceStatus('Ready for a voice command.'); }, 1200);
    };
    voiceRecognition.onerror = function(event){
      var intentionalStop = event.error === 'aborted' || voiceCommandsStopping;
      if(!intentionalStop) setVoiceStatus(getVoiceRecognitionErrorMessage(event.error));
      finishVoiceCommands(intentionalStop);
      if(!intentionalStop) voiceCommandStatusTimer = setTimeout(function(){ setVoiceStatus('Ready for a voice command.'); }, 1200);
    };
    voiceRecognition.onend = function(){
      if(voiceCommandsStopping){
        finishVoiceCommands(true);
        return;
      }
      if(voiceCommandResultReceived) return;
    };
  }
  if(voiceCommandsListening) return;
  voiceCommandsStopping = false;
  voiceCommandResultReceived = false;
  voiceCommandsListening = true;
  setVoiceButtonState(true);
  setVoiceStatus('Listening for a command...');
  voiceCommandTimer = setTimeout(function(){
    if(!voiceCommandsListening) return;
    finishVoiceCommands(true);
  }, 6000);
  try {
    voiceRecognition.start();
  } catch(error){
    if(error && error.name !== 'InvalidStateError'){
      setVoiceStatus('Voice command error: ' + error.message);
      finishVoiceCommands(false);
      voiceCommandStatusTimer = setTimeout(function(){ setVoiceStatus('Ready for a voice command.'); }, 1200);
    } else {
      finishVoiceCommands(true);
    }
  }
}

function escapeHtml(value){
  return String(value).replace(/[&<>"']/g, function(character){
    return {'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[character];
  });
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
  BibleData.listBooks(currentTranslation).forEach(function(book){
    var option = document.createElement('option');
    option.value = book.id;
    option.textContent = book.name;
    bookSelect.appendChild(option);
  });
  if(Array.from(bookSelect.options).some(function(option){ return option.value === currentBook; })) bookSelect.value = currentBook;
}

function populateTranslations(){
  var translationSelect = document.getElementById('readerTranslation');
  if(!translationSelect || typeof BibleData === 'undefined') return;
  var translations = BibleData.listTranslations();
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
    localStorage.setItem(TRANSLATION_STORAGE_KEY, currentTranslation);
  }
}

function changeTranslation(translationId){
  if(typeof BibleData === 'undefined' || !BibleData.listTranslations().some(function(translation){ return translation.id === translationId; })) return;
  var bookSelect = document.getElementById('bookSelect');
  if(bookSelect && bookSelect.value) currentBook = bookSelect.value;
  currentTranslation = translationId;
  localStorage.setItem(TRANSLATION_STORAGE_KEY, currentTranslation);
  var translationSelect = document.getElementById('readerTranslation');
  if(translationSelect) translationSelect.value = currentTranslation;
  populateBooks();
  if(!bookSelect || !BibleData.getChapterCount(currentTranslation, currentBook)){
    currentBook = BibleData.listBooks(currentTranslation)[0].id;
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
  sel.innerHTML = '';
  for(var i = 1; i <= BibleData.getChapterCount(currentTranslation, book); i++){
    sel.innerHTML += '<option>' + i + '</option>';
  }
}

function renderPassage(bookKey, chapterNum, containerId){
  var data = BibleData.getChapter(currentTranslation, bookKey, chapterNum);
  if(!data) return;
  var bookName = escapeHtml(data.bookName);
  var html = '<h2>' + bookName + ' ' + escapeHtml(chapterNum) + '</h2>';
  if(data.subtitle) html += '<div class="subtitle">' + escapeHtml(data.subtitle) + '</div>';
  html += '<div style="text-align:center;color:var(--ink-soft);font-size:14px;margin-bottom:20px;font-style:italic;">' + escapeHtml(data.title) + '</div>';
  for(var i = 0; i < data.verses.length; i++){
    html += '<span class="reader-verse" data-verse-number="' + escapeHtml(i+1) + '"><button type="button" class="vnum" aria-label="Highlight verse ' + escapeHtml(i+1) + '" onclick="highlightVerse(this)">' + escapeHtml(i+1) + '</button>' + escapeHtml(data.verses[i]) + ' <button type="button" class="verse-speak" data-verse-speech="' + escapeHtml(i+1) + '" aria-label="Read verse ' + escapeHtml(i+1) + ' aloud" onclick="readVerseAloud(' + escapeHtml(i+1) + ')">Read aloud</button></span> ';
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
  currentBook = bookSelect.value;
  currentChapter = parseInt(chapterSelect.value, 10);
  if(!BibleData.getChapter(currentTranslation, currentBook, currentChapter)) return;
  renderPassage(currentBook, currentChapter, 'readerContent');
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

function highlightVerse(el){
  el.classList.toggle('highlighted');
}

function toggleFullscreen(){
  var overlay = document.getElementById('fsOverlay');
  var fullscreenButton = document.getElementById('fullscreenBtn');
  if(!overlay) return;
  overlay.classList.toggle('active');
  var isActive = overlay.classList.contains('active');
  overlay.setAttribute('aria-hidden', isActive ? 'false' : 'true');
  if(fullscreenButton) fullscreenButton.setAttribute('aria-pressed', isActive ? 'true' : 'false');
}
