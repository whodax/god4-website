/* ===== SCRIPTURE COMPANION STATE & FUNCTIONS ===== */
const initialReaderPosition = UserData.readerPosition.load();
let currentBook = initialReaderPosition.bookId;
let currentChapter = initialReaderPosition.chapter;
let currentVerse = initialReaderPosition.verse || null;
let readerSelectionPending = Boolean(currentVerse);
let playbackResumeCursor = null;
let playbackSequenceTranslation = null;
let currentSpokenVerse = null;
let spokenFollowScrollTarget = null;
let lastSpokenVerse = null;
let currentTranslation = UserData.translation.load();
let translationChangeRequest = 0;
let voiceRecognition = null;
let voiceCommandsListening = false;
let voiceRecognitionActive = false;
let voiceCommandsStopping = false;
let voiceRecognitionBlocked = false;
let voiceRestartTimer = null;
let voiceResultHandled = false;
let voiceRestartAttempts = 0;
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
    var atPlanEnd=typeof activePlanReadingSession!=='undefined' && activePlanReadingSession &&
      activePlanReadingSession.end.bookId===currentBook && activePlanReadingSession.end.chapter===currentChapter;
    button.disabled = !chapterCount || (currentChapter >= chapterCount && !atPlanEnd);
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

function getReaderPlayStartVerse(explicitVerse){
  if(Number.isInteger(explicitVerse) && BibleData.getVerse(currentTranslation, currentBook, currentChapter, explicitVerse)) return explicitVerse;
  if(readerSelectionPending && Number.isInteger(currentVerse) && BibleData.getVerse(currentTranslation, currentBook, currentChapter, currentVerse)) return currentVerse;
  return getLastSpokenVerseForCurrentPassage() || (Number.isInteger(currentVerse) && BibleData.getVerse(currentTranslation, currentBook, currentChapter, currentVerse) ? currentVerse : 1);
}

function validPlaybackCursor(cursor){
  return Boolean(cursor && cursor.translationId === currentTranslation &&
    findSpeakablePlaybackLocation(cursor, true));
}

function getSelectedPlaybackCursor(explicitVerse){
  var verse = Number.isInteger(explicitVerse) ? explicitVerse :
    Number.isInteger(currentVerse) ? currentVerse : 1;
  return findSpeakablePlaybackLocation({
    translationId:currentTranslation, bookId:currentBook, chapter:currentChapter, verse:verse
  }, true);
}

function getPlaybackResumeCursor(){
  return playbackResumeCursor ? Object.assign({}, playbackResumeCursor) : null;
}

function replacePlaybackResumeCursor(cursor){
  playbackResumeCursor = cursor ? Object.assign({}, cursor) : null;
}

function stopSpeechForManualNavigation(){
  if(typeof BibleSpeech === 'undefined') return;
  if(BibleSpeech.getState() !== 'idle') BibleSpeech.stop();
  BibleSpeech.setStatusMessage('Ready to read aloud.');
}

function playReader(explicitVerse, pauseAfterFirst, restartSequence){
  if(typeof BibleSpeech === 'undefined') return;
  if(BibleSpeech.getState() === 'paused' && !restartSequence){
    BibleSpeech.pauseResume();
    return;
  }
  if(BibleSpeech.getState() === 'playing' && !restartSequence) return;
  var cursor = Number.isInteger(explicitVerse)
    ? getSelectedPlaybackCursor(explicitVerse)
    : validPlaybackCursor(playbackResumeCursor)
      ? findSpeakablePlaybackLocation(playbackResumeCursor, true)
      : getSelectedPlaybackCursor();
  if(!cursor) cursor = getSelectedPlaybackCursor();
  if(!cursor) return;
  replacePlaybackResumeCursor(cursor);
  playbackSequenceTranslation = cursor.translationId;
  if(cursor.bookId !== currentBook || cursor.chapter !== currentChapter){
    if(!renderAutomaticPlaybackChapter(cursor)) return;
  }
  readerSelectionPending = false;
  readCurrentChapterAloud(cursor.verse, pauseAfterFirst, playbackSequenceTranslation);
}

function pauseReader(){
  if(typeof BibleSpeech !== 'undefined' && BibleSpeech.getState() === 'playing') BibleSpeech.pauseResume();
}

function resumeReader(){
  if(typeof BibleSpeech === 'undefined') return;
  if(BibleSpeech.getState() === 'paused') BibleSpeech.pauseResume();
  else playReader();
}

function continueReader(){
  if(typeof BibleSpeech === 'undefined') return;
  if(BibleSpeech.getState() === 'paused') BibleSpeech.pauseResume();
  else playReader();
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
  readerSelectionPending = false;
  var select = document.getElementById('verseSelect');
  if(select) select.value = '';
  document.querySelectorAll('#readerContent [data-verse-number]').forEach(function(element){
    element.classList.remove('verse-focused');
  });
}

function applyReaderVerseSelection(verseNumber, shouldFocus){
  var verse = Number(verseNumber);
  var target = document.querySelector('#readerContent [data-verse-number="' + verse + '"]');
  if(!target) return false;
  document.querySelectorAll('#readerContent [data-verse-number]').forEach(function(element){
    element.classList.toggle('verse-focused', Number(element.getAttribute('data-verse-number')) === verse);
  });
  var select = document.getElementById('verseSelect');
  if(select) select.value = String(verse);
  if(shouldFocus){
    target.setAttribute('tabindex', '-1');
    target.focus({ preventScroll: true });
    scrollReaderTargetIntoView(target, 'smooth');
  }
  return true;
}

function readerVisibleTop(){
  var view = document.getElementById('view-reader');
  if(view && view.classList.contains('reader-fullscreen')){
    var fullscreenToolbar = view.querySelector('.reader-toolbar');
    return fullscreenToolbar ? fullscreenToolbar.getBoundingClientRect().bottom : 0;
  }
  var top = 0;
  var siteNav = document.querySelector('nav');
  if(siteNav && getComputedStyle(siteNav).position === 'sticky'){
    var navRect = siteNav.getBoundingClientRect();
    if(navRect.top <= 0 && navRect.bottom > 0) top = navRect.bottom;
  }
  var toolbar = document.querySelector('#view-reader.active .reader-toolbar');
  if(toolbar && getComputedStyle(toolbar).position === 'sticky'){
    var stickyTop = parseFloat(getComputedStyle(toolbar).top);
    if(Number.isFinite(stickyTop)) top = Math.max(top, stickyTop + toolbar.getBoundingClientRect().height);
  }
  return top;
}

function scrollReaderTargetIntoView(target, behavior){
  var top = readerVisibleTop();
  var bottom = window.innerHeight;
  var rect = target.getBoundingClientRect();
  var margin = 16;
  if(rect.top >= top + margin && rect.bottom <= bottom - margin) return;
  var usableHeight = bottom - top;
  if(usableHeight <= 0) return;
  var offset = rect.height > usableHeight - 2 * margin
    ? rect.top - (top + margin)
    : (rect.top + rect.bottom) / 2 - (top + bottom) / 2;
  var view = document.getElementById('view-reader');
  if(view && view.classList.contains('reader-fullscreen')) view.scrollBy({top:offset, behavior:behavior});
  else window.scrollBy({top:offset, behavior:behavior});
}

function initializeReaderStickyOffsets(){
  var view = document.getElementById('view-reader');
  var siteNav = document.querySelector('nav');
  var toolbar = view && view.querySelector('.reader-toolbar');
  if(!view || !siteNav || !toolbar) return;
  var sheet = Array.from(document.styleSheets).find(function(candidate){
    return candidate.href && /\/css\/companion\.css(?:\?|$)/.test(candidate.href);
  });
  if(!sheet) return;
  var ruleIndex = sheet.insertRule('#view-reader { --reader-nav-bottom:105px; --reader-toolbar-height:53px; }', sheet.cssRules.length);
  var style = sheet.cssRules[ruleIndex].style;
  function update(){
    style.setProperty('--reader-nav-bottom', siteNav.getBoundingClientRect().bottom + 'px');
    style.setProperty('--reader-toolbar-height', toolbar.getBoundingClientRect().height + 'px');
  }
  update();
  if(typeof ResizeObserver !== 'undefined'){
    var observer = new ResizeObserver(update);
    observer.observe(siteNav);
    observer.observe(toolbar);
  }
}

function cancelSpokenFollow(){
  if(!spokenFollowScrollTarget) return;
  var target = spokenFollowScrollTarget === 'fullscreen' ? document.getElementById('view-reader') : window;
  spokenFollowScrollTarget = null;
  if(!target) return;
  var top = target === window ? window.scrollY : target.scrollTop;
  target.scrollTo({top:top, behavior:'instant'});
}

function clearSpokenVerseHighlight(){
  cancelSpokenFollow();
  currentSpokenVerse = null;
  document.querySelectorAll('#readerContent .verse-spoken').forEach(function(element){
    element.classList.remove('verse-spoken');
  });
}

function followSpokenVerse(){
  var shell = document.getElementById('view-reader');
  var fullscreen = shell && shell.classList.contains('reader-fullscreen');
  var container = document.getElementById('readerContent');
  var activeVerse = container && container.querySelector('.verse-spoken');
  if(!activeVerse || !activeVerse.getClientRects().length) return;

  var top = 0;
  var bottom = window.innerHeight;
  if(fullscreen){
    top = readerVisibleTop();
  } else {
    top = readerVisibleTop();
  }

  var usableHeight = bottom - top;
  if(usableHeight <= 0) return;
  var margin = Math.min(48, Math.max(16, usableHeight * 0.08));
  var verseRect = activeVerse.getBoundingClientRect();
  if(verseRect.top >= top + margin && verseRect.bottom <= bottom - margin) return;

  var offset = verseRect.height > usableHeight - 2 * margin
    ? verseRect.top - (top + margin)
    : (verseRect.top + verseRect.bottom) / 2 - (top + bottom) / 2;
  var reducedMotion = window.matchMedia && window.matchMedia('(prefers-reduced-motion: reduce)').matches;
  var options = {top:offset, behavior:reducedMotion ? 'auto' : 'smooth'};
  spokenFollowScrollTarget = fullscreen ? 'fullscreen' : 'window';
  if(fullscreen) shell.scrollBy(options);
  else window.scrollBy(options);
}

function applySpokenVerseHighlight(verseNumber){
  var verse = Number(verseNumber);
  clearSpokenVerseHighlight();
  if(!Number.isInteger(verse) || verse < 1) return;
  currentSpokenVerse = verse;
  document.querySelectorAll('#readerContent [data-verse-number="' + verse + '"]').forEach(function(element){
    element.classList.add('verse-spoken');
  });
}

function handleSpokenVerseStart(verseNumber, location){
  rememberSpokenVerse(verseNumber, location);
  followSpokenVerse();
}

function rememberSpokenVerse(verseNumber, location, updateResumeCursor){
  var activeLocation = location || {translationId:currentTranslation, bookId:currentBook, chapter:currentChapter, verse:verseNumber};
  if(!Number.isInteger(verseNumber) || !isSpeakablePlaybackLocation({
    translationId:activeLocation.translationId || currentTranslation,
    bookId:activeLocation.bookId || currentBook,
    chapter:activeLocation.chapter || currentChapter,
    verse:verseNumber
  })) return;
  lastSpokenVerse = {bookId:activeLocation.bookId || currentBook, chapter:activeLocation.chapter || currentChapter, verse:verseNumber};
  if(updateResumeCursor !== false && (activeLocation.translationId === currentTranslation || !activeLocation.translationId)){
    replacePlaybackResumeCursor({
      translationId:activeLocation.translationId || currentTranslation,
      bookId:activeLocation.bookId || currentBook,
      chapter:activeLocation.chapter || currentChapter,
      verse:verseNumber
    });
  }
}

function isSpeakablePlaybackLocation(location){
  if(!location || !location.translationId || !location.bookId || !Number.isInteger(location.chapter) ||
      !Number.isInteger(location.verse) || location.chapter < 1 || location.verse < 1) return false;
  var chapter = BibleData.getChapter(location.translationId, location.bookId, location.chapter);
  return Boolean(chapter && typeof chapter.verses[location.verse - 1] === 'string' &&
    chapter.verses[location.verse - 1].trim());
}

function findSpeakablePlaybackLocation(location, includeLocation){
  if(!location || !location.translationId) return null;
  var books = BibleData.listBooks(location.translationId);
  var bookIndex = books.findIndex(function(book){ return book.id === location.bookId; });
  if(bookIndex < 0) return null;
  var firstChapter = Number.isInteger(location.chapter) && location.chapter > 0 ? location.chapter : 1;
  var firstVerse = Number.isInteger(location.verse) && location.verse > 0 ? location.verse : 1;
  for(var b = bookIndex; b < books.length; b++){
    var chapterCount = BibleData.getChapterCount(location.translationId, books[b].id);
    var chapterStart = b === bookIndex ? firstChapter : 1;
    for(var c = chapterStart; c <= chapterCount; c++){
      var chapter = BibleData.getChapter(location.translationId, books[b].id, c);
      if(!chapter) continue;
      var verseStart = b === bookIndex && c === firstChapter ? firstVerse + (includeLocation ? 0 : 1) : 1;
      for(var v = verseStart; v <= chapter.verses.length; v++){
        var text = chapter.verses[v - 1];
        if(typeof text === 'string' && text.trim()){
          return {translationId:location.translationId, bookId:books[b].id, chapter:c, verse:v};
        }
      }
    }
  }
  return null;
}

function getNextPlaybackLocation(location){
  if(!location || location.translationId !== playbackSequenceTranslation) return null;
  var next=findSpeakablePlaybackLocation(location, false);
  return typeof activePlanReadingSession!=='undefined' && activePlanReadingSession && next &&
    !planSessionContainsChapter(next.bookId,next.chapter) ? null : next;
}

function completePlaybackVerse(location){
  var next = getNextPlaybackLocation(location);
  replacePlaybackResumeCursor(next);
}

function renderAutomaticPlaybackChapter(location){
  if(!location || location.translationId !== playbackSequenceTranslation || currentTranslation !== playbackSequenceTranslation) return null;
  var chapter = BibleData.getChapter(location.translationId, location.bookId, location.chapter);
  if(!chapter || !chapter.verses.some(function(verse){ return typeof verse === 'string' && verse.trim(); })){
    replacePlaybackResumeCursor(null);
    return null;
  }
  var bookSelect = document.getElementById('bookSelect');
  var chapterSelect = document.getElementById('chapterSelect');
  if(!bookSelect || !chapterSelect || !Array.from(bookSelect.options).some(function(option){ return option.value === location.bookId; })){
    replacePlaybackResumeCursor(null);
    return null;
  }
  bookSelect.value = location.bookId;
  currentBook = location.bookId;
  currentChapter = location.chapter;
  currentVerse = null;
  readerSelectionPending = false;
  populateChapters();
  chapterSelect.value = String(location.chapter);
  populateVerses();
  renderPassage(currentBook, currentChapter);
  clearReaderVerseSelection();
  updateReaderControls();
  if(typeof BibleSpeech !== 'undefined') BibleSpeech.setStatusMessage('Continuing with ' + chapter.bookName + ' ' + location.chapter + '.');
  return {chapter:chapter, translationId:location.translationId};
}

function handleRepeatedVerse(verseNumber, location){
  rememberSpokenVerse(verseNumber, location, false);
  followSpokenVerse();
}

function getNextPlaybackChapter(location){
  var nextInBible=findSpeakablePlaybackLocation(location,false);
  if(typeof activePlanReadingSession!=='undefined' && activePlanReadingSession &&
    (location.bookId===activePlanReadingSession.end.bookId && location.chapter===activePlanReadingSession.end.chapter ||
      nextInBible && !planSessionContainsChapter(nextInBible.bookId,nextInBible.chapter))){
    planSpeechReturnPending=true;
    return {message:''};
  }
  var next = getNextPlaybackLocation(location);
  if(!next){
    var books = BibleData.listBooks(location.translationId);
    var lastBook = books.length ? books[books.length - 1].id : '';
    if(location.bookId === lastBook && location.bookId === 'revelation') return {message:'Read aloud complete.'};
    return {message:'Read aloud stopped because the next passage is unavailable in this translation.'};
  }
  return renderAutomaticPlaybackChapter(next) || {
    message:'Read aloud stopped because the next passage is unavailable in this translation.'
  };
}

function getLastSpokenVerseForCurrentPassage(){
  if(!lastSpokenVerse) return null;
  if(lastSpokenVerse.bookId !== currentBook || lastSpokenVerse.chapter !== currentChapter ||
      !BibleData.getVerse(currentTranslation, currentBook, currentChapter, lastSpokenVerse.verse)){
    lastSpokenVerse = null;
    return null;
  }
  return lastSpokenVerse.verse;
}

function repeatLastSpokenVerse(){
  var verseNumber = getLastSpokenVerseForCurrentPassage();
  if(!verseNumber || typeof BibleSpeech === 'undefined') return;
  if(BibleSpeech.repeatVerse(verseNumber)) return;
  playReader(verseNumber, BibleSpeech.getState() === 'paused', true);
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
  stopSpeechForManualNavigation();
  currentVerse = verse.verse;
  readerSelectionPending = true;
  playbackSequenceTranslation = currentTranslation;
  replacePlaybackResumeCursor({translationId:currentTranslation, bookId:currentBook, chapter:currentChapter, verse:currentVerse});
  saveReaderPosition();
  updateReaderControls();
  return true;
}

function selectReaderVerse(verseNumber){
  if(verseNumber === '' || verseNumber === null || verseNumber === undefined){
    stopSpeechForManualNavigation();
    clearReaderVerseSelection();
    playbackSequenceTranslation = currentTranslation;
    replacePlaybackResumeCursor({translationId:currentTranslation, bookId:currentBook, chapter:currentChapter, verse:1});
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

function parseSpokenReferenceNumber(value){
  var words = String(value || '').split(/\s+/);
  if(words.length === 1 && /^\d+$/.test(words[0])) return Number(words[0]);
  var units = {one:1, two:2, three:3, four:4, five:5, six:6, seven:7, eight:8, nine:9,
    ten:10, eleven:11, twelve:12, thirteen:13, fourteen:14, fifteen:15, sixteen:16,
    seventeen:17, eighteen:18, nineteen:19};
  var tens = {twenty:20, thirty:30, forty:40, fifty:50, sixty:60, seventy:70, eighty:80, ninety:90};
  if(words.length === 1) return units[words[0]] || tens[words[0]] || null;
  if(words.length === 2 && tens[words[0]] && units[words[1]] && units[words[1]] < 10){
    return tens[words[0]] + units[words[1]];
  }
  return null;
}

function handleSpokenReferenceCommand(command){
  var trailingPlay = /\s+(play|read)$/.exec(command);
  if(trailingPlay) command = command.slice(0, trailingPlay.index);
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
  var match = /^(?:chapter\s+)?(.+?)\s+verse\s+(.+)$/.exec(remainder) || /^(?:chapter\s+)?(\d+)\s+(\d+)$/.exec(remainder);
  var chapterOnly = match ? null : /^(?:chapter\s+)?(.+)$/.exec(remainder);
  var chapterNumber = match ? parseSpokenReferenceNumber(match[1]) : chapterOnly ? parseSpokenReferenceNumber(chapterOnly[1]) : undefined;
  var verseNumber = match ? parseSpokenReferenceNumber(match[2]) : undefined;
  if(remainder && (!chapterNumber || (match && !verseNumber))){
    setVoiceStatus('Book or chapter not found.');
    return true;
  }
  if(!navigateToSpokenBook(book.name, chapterNumber, verseNumber)){
    setVoiceStatus('Book, chapter, or verse not found.');
    return true;
  }
  if(action === 'play' || action === 'read' || trailingPlay) playReader(verseNumber || undefined);
  return true;
}

function handleVoiceCommand(transcript){
  var command = transcript.toLowerCase().trim().replace(/[.!?]+$/, '');
  setVoiceStatus('Command recognized: ' + transcript);
  if(/^(repeat|repeat verse|repeat last verse)$/.test(command)) repeatLastSpokenVerse();
  else if(/^play( the passage)?$/.test(command)) playReader();
  else if(/^read( the passage)?$/.test(command)) playReader();
  else if(command === 'pause') pauseReader();
  else if(command === 'resume') resumeReader();
  else if(command === 'continue') continueReader();
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

function isInterimPlaybackCommand(transcript){
  var command = String(transcript || '').toLowerCase().trim().replace(/[.!?]+$/, '').replace(/\s+/g, ' ');
  return /^(pause|stop|play|resume|continue|repeat|repeat verse|repeat last verse)$/.test(command);
}

function createVoiceRecognition(){
  var Recognition = getVoiceRecognition();
  if(!Recognition || voiceRecognition) return voiceRecognition;
  voiceRecognition = new Recognition();
  voiceRecognition.continuous = false;
  voiceRecognition.interimResults = true;
  voiceRecognition.lang = 'en-US';
  voiceRecognition.onstart = function(){
    voiceRecognitionActive = true;
    voiceRestartAttempts = 0;
    if(voiceCommandsListening) setVoiceStatus('Listening for a command...');
  };
  voiceRecognition.onresult = function(event){
    if(!voiceCommandsListening || !voiceRecognitionActive || voiceResultHandled || !event.results) return;
    var resultIndex = Number.isInteger(event.resultIndex) ? event.resultIndex : 0;
    for(var index = resultIndex; index < event.results.length; index++){
      var result = event.results[index];
      if(!result || !result[0] || !result[0].transcript) continue;
      var interim = result.isFinal === false;
      if(interim && !isInterimPlaybackCommand(result[0].transcript)) continue;
      voiceResultHandled = true;
      handleVoiceCommand(result[0].transcript);
      if(interim && typeof voiceRecognition.stop === 'function'){
        try { voiceRecognition.stop(); } catch(error) { /* Recognition may already be ending. */ }
      }
      return;
    }
  };
  voiceRecognition.onerror = function(event){
    var intentionalStop = voiceCommandsStopping || !voiceCommandsListening;
    if((intentionalStop || voiceResultHandled) && event.error === 'aborted') return;
    if(event.error === 'no-speech'){
      setVoiceStatus(getVoiceRecognitionErrorMessage(event.error));
      return;
    }
    voiceRecognitionActive = false;
    voiceRecognitionBlocked = event.error === 'not-allowed' || event.error === 'service-not-allowed' || event.error === 'audio-capture';
    setVoiceStatus(getVoiceRecognitionErrorMessage(event.error));
    finishVoiceCommands(false);
  };
  voiceRecognition.onend = function(){
    if(!voiceRecognitionActive && !voiceCommandsStopping) return;
    voiceRecognitionActive = false;
    var handledResult = voiceResultHandled;
    voiceResultHandled = true;
    if(voiceCommandsStopping || !voiceCommandsListening){
      voiceCommandsStopping = false;
      return;
    }
    scheduleVoiceRecognitionRestart(handledResult ? 0 : 250);
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
    voiceResultHandled = false;
    recognition.start();
  } catch(error){
    voiceRecognitionActive = false;
    if(error && error.name === 'InvalidStateError' && voiceRestartAttempts < 3){
      voiceRestartAttempts++;
      scheduleVoiceRecognitionRestart(100);
      return;
    }
    setVoiceStatus('Voice command error: ' + (error && error.message ? error.message : 'Unable to start recognition.'));
    finishVoiceCommands(false);
  }
}

function scheduleVoiceRecognitionRestart(delay){
  if(!voiceCommandsListening || voiceRecognitionBlocked || voiceRestartTimer) return;
  voiceRestartTimer = setTimeout(function(){
    voiceRestartTimer = null;
    startVoiceRecognition();
  }, delay === undefined ? 0 : delay);
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
  if(view!=='reader' && typeof clearPlanReadingSession==='function') clearPlanReadingSession();
  if(view==='plan' && typeof prepareJourneyPlanView==='function') prepareJourneyPlanView();
  if(view !== 'reader' && typeof BibleSpeech !== 'undefined' && BibleSpeech.getState() !== 'idle') BibleSpeech.stop();
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

async function changeTranslation(translationId){
  if(typeof BibleData === 'undefined' || !BibleData.listTranslations().some(function(translation){ return translation.id === translationId; })) return false;
  stopSpeechForManualNavigation();
  var previousTranslation = currentTranslation;
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
  if(typeof syncCompareDefaultTranslation === 'function') syncCompareDefaultTranslation();
  if(typeof syncCompareFromReader === 'function') syncCompareFromReader();
  return true;
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

function renderPassage(bookKey, chapterNum){
  var data = BibleData.getChapter(currentTranslation, bookKey, chapterNum);
  if(!data) return;
  var bookName = escapeHtml(data.bookName);
  var html = '<h2>' + bookName + ' ' + escapeHtml(chapterNum) + '</h2>';
  if(data.subtitle) html += '<div class="subtitle">' + escapeHtml(data.subtitle) + '</div>';
  html += '<div class="reader-chapter-caption">' + escapeHtml(data.title) + '</div>';
  for(var i = 0; i < data.verses.length; i++){
    html += '<span class="reader-verse" data-translation-id="' + escapeHtml(currentTranslation) + '" data-book-id="' + escapeHtml(bookKey) + '" data-book-name="' + bookName + '" data-chapter="' + escapeHtml(chapterNum) + '" data-verse-number="' + escapeHtml(i+1) + '" data-verse-text="' + escapeHtml(data.verses[i]) + '"><button type="button" class="vnum" aria-label="Highlight verse ' + escapeHtml(i+1) + '">' + escapeHtml(i+1) + '</button>' + renderStudyWordTokens(data.verses[i]) + ' <button type="button" class="verse-speak" data-verse-speech="' + escapeHtml(i+1) + '" aria-label="Read verse ' + escapeHtml(i+1) + ' aloud">Read aloud</button></span> ';
  }
  var container = document.getElementById('readerContent');
  if(container) container.innerHTML = html;
  populateVerses();
}

function loadPassage(){
  var bookSelect = document.getElementById('bookSelect');
  var chapterSelect = document.getElementById('chapterSelect');
  if(!bookSelect || !chapterSelect || typeof BibleData === 'undefined') return;
  stopSpeechForManualNavigation();
  var nextBook = bookSelect.value;
  var nextChapter = parseInt(chapterSelect.value, 10);
  if(lastSpokenVerse && (lastSpokenVerse.bookId !== nextBook || lastSpokenVerse.chapter !== nextChapter ||
      !BibleData.getVerse(currentTranslation, nextBook, nextChapter, lastSpokenVerse.verse))) lastSpokenVerse = null;
  if(typeof activePlanReadingSession!=='undefined' && activePlanReadingSession &&
    !planSessionContainsChapter(nextBook,nextChapter)) clearPlanReadingSession();
  if(nextBook !== currentBook || nextChapter !== currentChapter) currentVerse = null;
  currentBook = nextBook;
  currentChapter = nextChapter;
  if(!BibleData.getChapter(currentTranslation, currentBook, currentChapter)) return;
  playbackSequenceTranslation = currentTranslation;
  replacePlaybackResumeCursor({
    translationId:currentTranslation, bookId:currentBook, chapter:currentChapter,
    verse:Number.isInteger(currentVerse) && BibleData.getVerse(currentTranslation, currentBook, currentChapter, currentVerse) ? currentVerse : 1
  });
  renderPassage(currentBook, currentChapter);
  if(currentVerse && BibleData.getVerse(currentTranslation, currentBook, currentChapter, currentVerse)){
    applyReaderVerseSelection(currentVerse, false);
  } else {
    clearReaderVerseSelection();
  }
  saveReaderPosition();
  updateReaderControls();
}

function readCurrentChapterAloud(startVerse, pauseAfterFirst, translationId){
  if(typeof BibleSpeech === 'undefined') return;
  var fixedTranslation = translationId || currentTranslation;
  var chapter = BibleData.getChapter(fixedTranslation, currentBook, currentChapter);
  if(!chapter) return;
  BibleSpeech.playChapter(chapter, startVerse, pauseAfterFirst, {
    translationId:fixedTranslation,
    continueAfterChapter:getNextPlaybackChapter
  });
}

function readVerseAloud(verseNumber){
  if(typeof BibleSpeech === 'undefined' || typeof BibleData === 'undefined') return;
  var verse = BibleData.getVerse(currentTranslation, currentBook, currentChapter, verseNumber);
  if(verse){
    playbackSequenceTranslation = currentTranslation;
    replacePlaybackResumeCursor({translationId:currentTranslation, bookId:currentBook, chapter:currentChapter, verse:verse.verse});
    BibleSpeech.playVerse(verse.text, verse.verse, {translationId:currentTranslation, bookId:currentBook, chapter:currentChapter});
  }
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
  if(typeof activePlanReadingSession!=='undefined' && activePlanReadingSession &&
    activePlanReadingSession.end.bookId===currentBook && activePlanReadingSession.end.chapter===currentChapter){
    returnToPlanFromSession(true);
    return;
  }
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
  stopSpeechForManualNavigation();
  if(el.classList.contains('highlighted')){
    currentVerse = verseNumber;
    readerSelectionPending = true;
    replacePlaybackResumeCursor({translationId:currentTranslation, bookId:currentBook, chapter:currentChapter, verse:verseNumber});
    applyReaderVerseSelection(currentVerse, false);
  } else if(currentVerse === verseNumber){
    clearReaderVerseSelection();
    replacePlaybackResumeCursor({translationId:currentTranslation, bookId:currentBook, chapter:currentChapter, verse:1});
  }
  playbackSequenceTranslation = currentTranslation;
  saveReaderPosition();
  updateReaderControls();
}

var fullscreenBackgroundState = [];
var fullscreenReturnFocus = null;

function setFullscreenBackground(shell, active){
  if(!active){
    fullscreenBackgroundState.forEach(function(item){
      item.element.inert = item.inert;
      if(item.ariaHidden === null) item.element.removeAttribute('aria-hidden');
      else item.element.setAttribute('aria-hidden', item.ariaHidden);
    });
    fullscreenBackgroundState = [];
    return;
  }
  for(var current = shell; current && current !== document.body; current = current.parentElement){
    Array.from(current.parentElement.children).forEach(function(sibling){
      if(sibling === current) return;
      fullscreenBackgroundState.push({element:sibling, inert:sibling.inert, ariaHidden:sibling.getAttribute('aria-hidden')});
      sibling.inert = true;
      sibling.setAttribute('aria-hidden', 'true');
    });
  }
}

function toggleFullscreen(){
  var shell = document.getElementById('view-reader');
  var button = document.getElementById('fullscreenBtn');
  if(!shell || !button) return;
  cancelSpokenFollow();
  var entering = !shell.classList.contains('reader-fullscreen');
  if(entering){
    fullscreenReturnFocus = document.activeElement;
    shell.classList.add('reader-fullscreen');
    shell.setAttribute('role', 'dialog');
    shell.setAttribute('aria-modal', 'true');
    shell.setAttribute('aria-label', 'Fullscreen Reader');
    setFullscreenBackground(shell, true);
  } else {
    shell.classList.remove('reader-fullscreen');
    shell.removeAttribute('role');
    shell.removeAttribute('aria-modal');
    shell.removeAttribute('aria-label');
    setFullscreenBackground(shell, false);
  }
  button.setAttribute('aria-pressed', entering ? 'true' : 'false');
  button.setAttribute('aria-label', entering ? 'Exit Fullscreen' : 'Enter Fullscreen');
  button.textContent = entering ? 'Exit Fullscreen' : 'Fullscreen';
  if(entering) button.focus();
  else {
    (fullscreenReturnFocus && fullscreenReturnFocus.isConnected ? fullscreenReturnFocus : button).focus();
    fullscreenReturnFocus = null;
  }
}

document.addEventListener('keydown', function(event){
  var shell = document.getElementById('view-reader');
  if(!shell || !shell.classList.contains('reader-fullscreen')) return;
  if(event.key === 'Escape'){
    var more = document.getElementById('readerMoreTrigger');
    if(more && more.getAttribute('aria-expanded') === 'true'){
      event.preventDefault();
      event.stopPropagation();
      closeReaderMore();
      return;
    }
    var wordStudy = document.getElementById('wordStudyPanel');
    if(wordStudy && !wordStudy.hidden && wordStudy.contains(document.activeElement)) return;
    event.preventDefault();
    toggleFullscreen();
  } else if(event.key === 'Tab'){
    var focusable = Array.from(shell.querySelectorAll('button:not([disabled]), [href], input:not([disabled]), select:not([disabled]), textarea:not([disabled]), [tabindex]:not([tabindex="-1"])'))
      .filter(function(element){ return element.getClientRects().length && !element.closest('[inert]'); });
    if(!focusable.length) return;
    var first = focusable[0];
    var last = focusable[focusable.length - 1];
    if(!shell.contains(document.activeElement) || (event.shiftKey && document.activeElement === first) || (!event.shiftKey && document.activeElement === last)){
      event.preventDefault();
      (event.shiftKey ? last : first).focus();
    }
  }
}, true);

function runWithBibleExperience(action){
  if(typeof bibleExperienceReady !== 'undefined' && bibleExperienceReady){
    try { return Promise.resolve(action() !== false); }
    catch(error){ return Promise.resolve(false); }
  }
  var ready = typeof initializeBibleExperience === 'function'
    ? initializeBibleExperience()
    : Promise.resolve(true);
  return ready.then(function(loaded){
    if(!loaded) return false;
    return action() !== false;
  });
}

function navigateReaderToPassage(bookId, chapter, verse){
  var requestedVerse = Number.isInteger(verse) && verse > 0 ? verse : 1;
  if(typeof BibleData === 'undefined' || !BibleData.getChapter(currentTranslation, bookId, chapter) ||
    !BibleData.getVerse(currentTranslation, bookId, chapter, requestedVerse)) return Promise.resolve(false);
  return runWithBibleExperience(function(){
    var readerButton = document.querySelector('.bs-btn[aria-controls="view-reader"]');
    if(!readerButton) return false;
    if(!document.getElementById('view-reader').classList.contains('active')) switchView('reader', readerButton);
    var bookSelect = document.getElementById('bookSelect');
    var chapterSelect = document.getElementById('chapterSelect');
    if(!bookSelect || !chapterSelect || !Array.from(bookSelect.options).some(function(option){ return option.value === bookId; })) return false;
    currentBook = bookId;
    currentChapter = chapter;
    currentVerse = requestedVerse;
    readerSelectionPending = true;
    bookSelect.value = bookId;
    populateChapters();
    chapterSelect.value = String(chapter);
    loadPassage();
    var target = document.querySelector('#readerContent [data-verse-number="' + requestedVerse + '"]');
    if(!target || target.getAttribute('data-book-id') !== bookId || Number(target.getAttribute('data-chapter')) !== chapter) return false;
    if(!applyReaderVerseSelection(requestedVerse, true)) return false;
    saveReaderPosition();
    return true;
  }).catch(function(){ return false; });
}
function initializeReaderControls(){
  initializeReaderStickyOffsets();
  document.querySelectorAll('.bs-btn[aria-controls^="view-"]').forEach(function(button){
    button.addEventListener('click', function(){
      var view = button.getAttribute('aria-controls').slice(5);
      if(view === 'reader') runWithBibleExperience(function(){ switchView(view, button); });
      else switchView(view, button);
    });
  });
  [
    ['fullscreenBtn', 'click', function(){ runWithBibleExperience(toggleFullscreen); }],
    ['readerTranslation', 'change', function(event){ changeTranslation(event.target.value); }],
    ['bookSelect', 'change', function(){ runWithBibleExperience(changeReaderBook); }],
    ['chapterSelect', 'change', function(){ runWithBibleExperience(loadPassage); }],
    ['verseSelect', 'change', function(event){ runWithBibleExperience(function(){ selectReaderVerse(event.target.value); }); }],
    ['readAloudPlay', 'click', function(){
      if(typeof BibleSpeech !== 'undefined' && BibleSpeech.getState() === 'playing') stopReadAloud();
      else runWithBibleExperience(playReader);
    }],
    ['readAloudVoice', 'change', function(event){ BibleSpeech.setVoice(event.target.value); }],
    ['readAloudSpeed', 'change', function(event){ BibleSpeech.setSpeed(event.target.value); }]
  ].forEach(function(binding){
    var element = document.getElementById(binding[0]);
    if(element) element.addEventListener(binding[1], binding[2]);
  });
  document.querySelectorAll('[data-reader-action]').forEach(function(button){
    var action = button.getAttribute('data-reader-action');
    var handlers = {
      previous: prevChapter,
      next: nextChapter,
      'previous-verse': previousReaderVerse,
      'next-verse': nextReaderVerse
    };
    if(handlers[action]) button.addEventListener('click', function(){ runWithBibleExperience(handlers[action]); });
  });
  document.querySelectorAll('[data-voice-command-button]').forEach(function(button){
    button.addEventListener('click', function(){ runWithBibleExperience(toggleVoiceCommands); });
  });
  ['readerContent'].forEach(function(id){
    var container = document.getElementById(id);
    if(!container) return;
    container.addEventListener('click', function(event){
      var highlight = event.target.closest('.vnum');
      if(highlight && container.contains(highlight)){
        highlightVerse(highlight);
        return;
      }
      var speak = event.target.closest('.verse-speak');
      if(speak && container.contains(speak)) readVerseAloud(Number(speak.getAttribute('data-verse-speech')));
    });
  });
}
function closeReaderMore(){
  var moreTrigger = document.getElementById('readerMoreTrigger');
  var secondaryControls = document.getElementById('readerSecondaryControls');
  if(!moreTrigger || !secondaryControls) return;
  secondaryControls.hidden = true;
  moreTrigger.setAttribute('aria-expanded', 'false');
  moreTrigger.focus();
}

if(typeof BibleSpeech !== 'undefined' && typeof BibleSpeech.setPlaybackListener === 'function'){
  BibleSpeech.setPlaybackListener({
    onVerseStart: applySpokenVerseHighlight,
    onVerseSpoken: handleSpokenVerseStart,
    onVerseRepeat: handleRepeatedVerse,
    onVerseComplete: completePlaybackVerse,
    onEnd: function(){
      clearSpokenVerseHighlight();
      if(typeof planSpeechReturnPending!=='undefined' && planSpeechReturnPending){
        planSpeechReturnPending=false;
        returnToPlanFromSession(true);
      }
    }
  });
  var moreTrigger = document.getElementById('readerMoreTrigger');
  var secondaryControls = document.getElementById('readerSecondaryControls');
  if(moreTrigger && secondaryControls){
    moreTrigger.addEventListener('click', function(){
      var opening = moreTrigger.getAttribute('aria-expanded') !== 'true';
      if(!opening){ closeReaderMore(); return; }
      secondaryControls.hidden = false;
      moreTrigger.setAttribute('aria-expanded', 'true');
    });
    function closeReaderMoreOnEscape(event){
      if(event.key !== 'Escape' || moreTrigger.getAttribute('aria-expanded') !== 'true') return;
      event.preventDefault();
      closeReaderMore();
    }
    moreTrigger.addEventListener('keydown', closeReaderMoreOnEscape);
    secondaryControls.addEventListener('keydown', closeReaderMoreOnEscape);
  }
}
if(typeof WordStudyController !== 'undefined') WordStudyController.initialize();
if(document.readyState === 'loading') window.addEventListener('DOMContentLoaded', function(){ initializeReaderControls(); initializeVoiceCommands(); }, { once: true });
else { initializeReaderControls(); initializeVoiceCommands(); }
