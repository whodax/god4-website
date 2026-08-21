/* ===== SCRIPTURE COMPANION STATE & FUNCTIONS ===== */
let currentBook = 'john';
let currentChapter = 1;
let currentTranslation = 'demo-local';
let voiceRecognition = null;
let voiceCommandsListening = false;

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

function handleVoiceCommand(transcript){
  var command = transcript.toLowerCase().trim();
  setVoiceStatus('Recognized: ' + transcript);
  if(/^(play|read)( the passage)?$/.test(command)) playReader();
  else if(command === 'pause') pauseReader();
  else if(command === 'resume') resumeReader();
  else if(command === 'stop') stopReader();
  else if(command === 'next chapter') nextChapter();
  else if(command === 'previous chapter') prevChapter();
  else setVoiceStatus('Unrecognized command: ' + transcript);
}

function finishVoiceCommands(){
  voiceCommandsListening = false;
  setVoiceButtonState(false);
}

function toggleVoiceCommands(){
  var Recognition = getVoiceRecognition();
  if(!Recognition){
    setVoiceStatus('Voice commands are not supported in this browser');
    return;
  }
  if(voiceCommandsListening){
    voiceRecognition.stop();
    return;
  }
  if(!voiceRecognition){
    voiceRecognition = new Recognition();
    voiceRecognition.continuous = false;
    voiceRecognition.interimResults = false;
    voiceRecognition.lang = 'en-US';
    voiceRecognition.onresult = function(event){
      handleVoiceCommand(event.results[0][0].transcript);
    };
    voiceRecognition.onerror = function(event){
      var message = event.error === 'not-allowed' ? 'Microphone access is blocked. Allow microphone access in your browser to use Voice Commands.' : 'Voice command error: ' + event.error;
      setVoiceStatus(message);
      finishVoiceCommands();
    };
    voiceRecognition.onend = finishVoiceCommands;
  }
  voiceCommandsListening = true;
  setVoiceButtonState(true);
  setVoiceStatus('Listening...');
  voiceRecognition.start();
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
}

function populateTranslations(){
  var translationSelect = document.getElementById('readerTranslation');
  if(!translationSelect || typeof BibleData === 'undefined') return;
  translationSelect.innerHTML = '';
  BibleData.listTranslations().forEach(function(translation){
    var option = document.createElement('option');
    option.value = translation.id;
    option.textContent = translation.abbreviation + ' — ' + translation.name;
    translationSelect.appendChild(option);
  });
  translationSelect.value = currentTranslation;
}

function changeTranslation(translationId){
  if(typeof BibleData === 'undefined' || !BibleData.listTranslations().some(function(translation){ return translation.id === translationId; })) return;
  var bookSelect = document.getElementById('bookSelect');
  if(bookSelect && bookSelect.value) currentBook = bookSelect.value;
  currentTranslation = translationId;
  populateBooks();
  if(!bookSelect || !BibleData.getChapterCount(currentTranslation, currentBook)){
    currentBook = BibleData.listBooks(currentTranslation)[0].id;
    bookSelect.value = currentBook;
  } else {
    bookSelect.value = currentBook;
  }
  populateChapters();
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
    html += '<button type="button" class="vnum" aria-label="Highlight verse ' + escapeHtml(i+1) + '" onclick="highlightVerse(this)">' + escapeHtml(i+1) + '</button>' + escapeHtml(data.verses[i]) + ' <button type="button" class="verse-speak" data-verse-speech="' + escapeHtml(i+1) + '" aria-label="Read verse ' + escapeHtml(i+1) + ' aloud" onclick="readVerseAloud(' + escapeHtml(i+1) + ')">Read aloud</button> ';
  }
  var container = document.getElementById(containerId);
  var fsTitle = document.getElementById('fsTitle');
  var fsContent = document.getElementById('fsContent');
  if(container) container.innerHTML = html;
  if(fsTitle) fsTitle.textContent = bookName + ' ' + chapterNum;
  if(fsContent) fsContent.innerHTML = html;
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
    loadPassage();
  }
}
function nextChapter(){
  if(currentChapter < BibleData.getChapterCount(currentTranslation, currentBook)){
    currentChapter++;
    document.getElementById('chapterSelect').value = currentChapter;
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
