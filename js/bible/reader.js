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
let readerTabPosition = null;
let refreshReaderStickyOffsets = null;
let voiceRecognition = null;
let readerPlaybackIntent = 0;
let readerPlaybackPending = false;
let voiceCommandsListening = false;
let voiceRecognitionActive = false;
let voiceCommandsStopping = false;
let voiceRecognitionBlocked = false;
let voiceRestartTimer = null;
let voiceResultHandled = false;
let voiceHandledResults = new Set();
let voiceRestartAttempts = 0;
let voicePermissionChecked = false;
let voiceCommandsInteracted = false;
let voiceReleaseAction = null;
let voiceReleaseTimer = null;
let voiceTurnWasPlaying = false;
let voiceTurnError = '';
let voiceReleaseFailed = false;
let voiceNavigationRequest = 0;
let voiceNavigationTask = null;

function getReaderControls(){
  return document.querySelectorAll('[data-reader-controls]');
}

function isRenderableVerseText(text){
  return typeof text === 'string' && text.trim().length > 0;
}

// Walk original coordinates rather than filtering/reindexing the source array.
function getActiveReaderPlaybackSnapshot(){
  if(typeof BibleSpeech === 'undefined') return null;
  var playback = BibleSpeech.getPlaybackSnapshot();
  return playback.status === 'playing' || playback.status === 'preparing' ? playback : null;
}

function getAdjacentReaderVerseNumber(direction){
  var chapter = typeof BibleData === 'undefined' ? null : BibleData.getChapter(currentTranslation, currentBook, currentChapter);
  if(!chapter || (direction !== 1 && direction !== -1)) return null;
  var playback = getActiveReaderPlaybackSnapshot();
  var verse = playback && Number.isInteger(playback.currentVerse) ? playback.currentVerse : currentVerse;
  if(direction === -1 && !Number.isInteger(verse)) return null;
  var number = Number.isInteger(verse) ? verse + direction : 1;
  for(; number >= 1 && number <= chapter.verses.length; number += direction){
    if(isRenderableVerseText(chapter.verses[number - 1])) return number;
  }
  return null;
}

// Optional local tracing must never become a prerequisite for Voice Commands.
function traceReaderVoice(event,value,extra){
  if(window.ReaderVoiceDiagnostics) try { ReaderVoiceDiagnostics[event](value,extra); } catch(error) { /* Diagnostics cannot interrupt a command. */ }
}

function setVoiceStatus(message){
  traceReaderVoice('status',message);
  document.querySelectorAll('.voice-status').forEach(function(status){ if(status.textContent!==message) status.textContent = message; });
}

function getReaderDisplayedVerse(){
  var spoken = document.querySelector('#readerContent .verse-spoken');
  var verse = spoken ? Number(spoken.getAttribute('data-verse-number')) : currentVerse;
  return Number.isInteger(verse) && document.querySelector('#readerContent [data-verse-number="' + verse + '"]') ? verse : null;
}

function updateReaderReferenceDisplay(){
  var passage = document.getElementById('readerContent');
  var heading = passage && passage.querySelector('h2');
  if(!heading) return;
  var book = heading.getAttribute('data-book-id');
  var chapter = Number(heading.getAttribute('data-chapter'));
  var verse = getReaderDisplayedVerse();
  var reference = heading.getAttribute('data-book-name') + ' ' + chapter;
  if(book === currentBook && chapter === currentChapter && verse !== null) reference += ':' + verse;
  var label = document.getElementById('readerReferenceText');
  var launcher = document.getElementById('scripturePickerTrigger');
  if(label && label.textContent !== reference) label.textContent = reference;
  if(launcher) launcher.setAttribute('aria-label', 'Choose Scripture, ' + reference);
  if(typeof ScripturePicker !== 'undefined') ScripturePicker.sync();
}

function updateReaderControls(){
  if(window.ReaderOptions) ReaderOptions.sync();
  updateReaderReferenceDisplay();
  var chapterCount = typeof BibleData === 'undefined' ? 0 : BibleData.getChapterCount(currentTranslation, currentBook);
  document.querySelectorAll('[data-reader-action="previous"]').forEach(function(button){
    button.disabled = currentChapter <= 1 && !adjacentCatholicBook(-1);
  });
  document.querySelectorAll('[data-reader-action="next"]').forEach(function(button){
    var atPlanEnd=typeof activePlanReadingSession!=='undefined' && activePlanReadingSession &&
      activePlanReadingSession.end.bookId===currentBook && activePlanReadingSession.end.chapter===currentChapter;
    button.disabled = !chapterCount || (currentChapter >= chapterCount && !atPlanEnd && !adjacentCatholicBook(1));
  });
  document.querySelectorAll('[data-reader-action="previous-verse"]').forEach(function(button){
    button.disabled = getAdjacentReaderVerseNumber(-1) === null;
  });
  document.querySelectorAll('[data-reader-action="next-verse"]').forEach(function(button){
    button.disabled = getAdjacentReaderVerseNumber(1) === null;
  });
}

function setVoiceButtonState(isListening){
  var closing = isAndroidVoiceCommands() && voiceCommandsStopping && voiceRecognitionActive;
  document.querySelectorAll('[data-voice-command-button]').forEach(function(button){
    button.setAttribute('aria-pressed', isListening || closing ? 'true' : 'false');
    button.setAttribute('aria-busy', closing ? 'true' : 'false');
    button.title = closing ? 'Closing microphone; tap to cancel the pending command' : isListening ? 'Stop listening for voice commands' : 'Start voice commands';
    if(isAndroidVoiceCommands()) button.setAttribute('aria-label',closing ? 'Voice Commands, closing microphone; tap to cancel pending playback' : isListening ? 'Voice Commands, listening; tap to stop' : 'Voice Commands, pause reading to speak a command');
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

function stopSpeechForManualNavigation(preserveChapter){
  cancelReaderVoicePlayback();
  readerPlaybackIntent++;
  readerPlaybackPending = false;
  clearSpokenVerseHighlight();
  if(typeof BibleSpeech === 'undefined') return;
  if(BibleSpeech.getState() !== 'idle') BibleSpeech.stop(preserveChapter===true);
  BibleSpeech.setStatusMessage('');
}

function playReader(explicitVerse, pauseAfterFirst, restartSequence){
  if(typeof BibleSpeech === 'undefined') return;
  if(BibleSpeech.getState() === 'paused' && !restartSequence){
    BibleSpeech.pauseResume();
    return;
  }
  if((BibleSpeech.getState() === 'playing' || BibleSpeech.getState() === 'preparing') && !restartSequence && !readerPlaybackPending) return;
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
  if(typeof BibleSpeech !== 'undefined' && (BibleSpeech.getState() === 'playing' || BibleSpeech.getState() === 'preparing')) BibleSpeech.pauseResume();
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
    return BibleCanon.matches(candidate.id,candidate.name,requestedBook,false);
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

function readerPlanReturnHeight(){
  var row = document.querySelector('#view-reader.active .reader-plan-return:not([hidden])');
  return row ? row.getBoundingClientRect().height : 0;
}

function readerStickyNavigation(){
  return Array.from(document.querySelectorAll('#bibleApp .bs-header, #bibleApp .bs-nav')).find(function(el){
    return getComputedStyle(el).position === 'sticky';
  });
}

function readerVisibleTop(){
  var view = document.getElementById('view-reader');
  var toolbar = view && view.classList.contains('active') && view.querySelector('.reader-show-controls:not([hidden]),.reader-toolbar:not([inert])');
  if(view && view.classList.contains('reader-fullscreen')){
    return (toolbar ? toolbar.getBoundingClientRect().bottom : 0) + readerPlanReturnHeight();
  }
  var top = 0;
  var siteNav = document.querySelector('nav');
  if(siteNav && getComputedStyle(siteNav).position === 'sticky'){
    var navRect = siteNav.getBoundingClientRect();
    if(navRect.top <= 0 && navRect.bottom > 0) top = navRect.bottom;
  }
  var tabs = readerStickyNavigation();
  if(tabs){
    var tabsTop = parseFloat(getComputedStyle(tabs).top);
    if(Number.isFinite(tabsTop)) top = Math.max(top, tabsTop + tabs.getBoundingClientRect().height);
  }
  if(toolbar && /sticky|fixed/.test(getComputedStyle(toolbar).position)){
    var stickyTop = parseFloat(getComputedStyle(toolbar).top);
    if(Number.isFinite(stickyTop)) top = Math.max(top, stickyTop + toolbar.getBoundingClientRect().height);
  }
  return top + readerPlanReturnHeight();
}

function scrollReaderTargetIntoView(target, behavior){
  if(!target || !target.getClientRects().length) return;
  if(window.matchMedia('(prefers-reduced-motion: reduce)').matches) behavior = 'instant';
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

function scrollReaderStartIntoView(){
  var view = document.getElementById('view-reader');
  var start = document.querySelector('#readerContent h2');
  if(!view || !view.classList.contains('active') || !start || !start.getClientRects().length) return;
  var surface = view.classList.contains('reader-fullscreen') ? view : window;
  var positionedScroll = null;
  function position(){
    if(!start.isConnected || !view.classList.contains('active') || currentVerse ||
      surface !== (view.classList.contains('reader-fullscreen') ? view : window)) return;
    if(positionedScroll!==null && view.querySelector('.reader-compact-mobile') &&
      (surface===window ? window.scrollY : surface.scrollTop)!==positionedScroll) return;
    var offset = start.getBoundingClientRect().top - (readerVisibleTop() - readerPlanReturnHeight() + 16);
    surface.scrollBy({top:offset, behavior:'instant'});
    positionedScroll=surface===window ? window.scrollY : surface.scrollTop;
  }
  position();
  requestAnimationFrame(function(){
    position();
    // Compact navigation can settle after the sticky stack's ResizeObserver.
    // Reuse position's passage/selection/surface guards for the following frame.
    if(view.querySelector('.reader-compact-mobile')) requestAnimationFrame(position);
  });
}

function initializeReaderStickyOffsets(){
  var view = document.getElementById('view-reader');
  var siteNav = document.querySelector('nav');
  var toolbar = view && view.querySelector('.reader-toolbar');
  var studyHeader = view && view.querySelector('.word-study-header');
  if(!view || !siteNav || !toolbar) return;
  var sheet = Array.from(document.styleSheets).find(function(candidate){
    return candidate.href && /\/css\/companion\.css(?:\?|$)/.test(candidate.href);
  });
  if(!sheet) return;
  var ruleIndex = sheet.insertRule('#bibleApp { --reader-nav-bottom:105px; --reader-tabs-height:0px; --reader-toolbar-height:53px; --reader-stack-tail:0px; }', sheet.cssRules.length);
  var style = sheet.cssRules[ruleIndex].style;
  function update(){
    style.setProperty('--reader-nav-bottom', siteNav.getBoundingClientRect().bottom + 'px');
    var stickyTabs = readerStickyNavigation();
    var toolbarHeight = toolbar.getBoundingClientRect().height;
    style.setProperty('--reader-tabs-height', (stickyTabs ? stickyTabs.getBoundingClientRect().height : 0) + 'px');
    style.setProperty('--reader-toolbar-height', toolbarHeight + 'px');
    style.setProperty('--reader-plan-return-height', readerPlanReturnHeight() + 'px');
    style.setProperty('--word-study-header-height', (studyHeader ? studyHeader.getBoundingClientRect().height : 0) + 'px');
    // Fullscreen sticky insets include the scroll container's existing padding.
    style.setProperty('--reader-scroll-padding', getComputedStyle(view).paddingTop);
    var tail = 0;
    if(stickyTabs && view.classList.contains('active') && !view.classList.contains('reader-fullscreen')){
      // Match the toolbar's bottom containment inset so both sticky rows leave together.
      tail = toolbarHeight + (parseFloat(getComputedStyle(toolbar).marginBottom) || 0) +
        (parseFloat(getComputedStyle(view).paddingBottom) || 0);
    }
    style.setProperty('--reader-stack-tail', tail + 'px');
  }
  refreshReaderStickyOffsets = update;
  update();
  if(typeof ResizeObserver !== 'undefined'){
    var observer = new ResizeObserver(update);
    observer.observe(siteNav);
    observer.observe(toolbar);
    document.querySelectorAll('#bibleApp .bs-header, #bibleApp .bs-nav').forEach(function(el){ observer.observe(el); });
    if(studyHeader) observer.observe(studyHeader);
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

function clearSpokenVerseHighlight(keepSpeechOwnership){
  cancelSpokenFollow();
  currentSpokenVerse = null;
  var passage = document.getElementById('readerContent');
  if(passage) passage.classList.toggle('speech-owns-highlight', keepSpeechOwnership === true);
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

function applySpokenVerseHighlight(verseNumber, location){
  if(location && (location.translationId && location.translationId !== currentTranslation || location.bookId && location.bookId !== currentBook || location.chapter && location.chapter !== currentChapter)) return;
  var verse = Number(verseNumber);
  clearSpokenVerseHighlight();
  if(!Number.isInteger(verse) || verse < 1) return;
  var target = document.querySelector('#readerContent [data-verse-number="' + verse + '"]');
  if(!target) return;
  currentSpokenVerse = verse;
  document.getElementById('readerContent').classList.add('speech-owns-highlight');
  document.querySelectorAll('#readerContent [data-verse-number="' + verse + '"]').forEach(function(element){
    element.classList.add('verse-spoken');
  });
}

function handleSpokenVerseStart(verseNumber, location){
  applySpokenVerseHighlight(verseNumber, location);
  rememberSpokenVerse(verseNumber, location);
  updateReaderControls();
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
  applySpokenVerseHighlight(verseNumber, location);
  rememberSpokenVerse(verseNumber, location, false);
  updateReaderControls();
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
  chapter.verses.forEach(function(text, index){
    if(!isRenderableVerseText(text)) return;
    var option = document.createElement('option');
    option.value = String(index + 1);
    option.textContent = String(index + 1);
    select.appendChild(option);
  });
}

function setReaderVerse(verseNumber, shouldFocus, preserveChapter){
  var verse = BibleData.getVerse(currentTranslation, currentBook, currentChapter, Number(verseNumber));
  if(verse && !isRenderableVerseText(verse.text)){
    // An existing but empty source coordinate is not a reading destination.
    selectReaderVerse('');
    return false;
  }
  if(!verse || !applyReaderVerseSelection(verse.verse, shouldFocus)) return false;
  stopSpeechForManualNavigation(preserveChapter);
  currentVerse = verse.verse;
  readerSelectionPending = true;
  playbackSequenceTranslation = currentTranslation;
  replacePlaybackResumeCursor({translationId:currentTranslation, bookId:currentBook, chapter:currentChapter, verse:currentVerse});
  saveReaderPosition();
  updateReaderControls();
  return true;
}

function selectReaderVerse(verseNumber, preserveChapter){
  if(verseNumber === '' || verseNumber === null || verseNumber === undefined){
    stopSpeechForManualNavigation();
    clearReaderVerseSelection();
    playbackSequenceTranslation = currentTranslation;
    replacePlaybackResumeCursor({translationId:currentTranslation, bookId:currentBook, chapter:currentChapter, verse:1});
    saveReaderPosition();
    updateReaderControls();
    return true;
  }
  return setReaderVerse(verseNumber, true, preserveChapter);
}

function navigateToSpokenBook(bookText, chapterNumber, verseNumber, preserveChapter){
  if(typeof BibleData === 'undefined') return false;
  var book = findReaderBook(bookText);
  if(!book) return false;
  var chapter = chapterNumber === undefined ? 1 : Number(chapterNumber);
  if(!Number.isInteger(chapter) || chapter < 1 || chapter > BibleData.getChapterCount(currentTranslation, book.id)) return false;
  if(verseNumber !== undefined){
    var verse = BibleData.getVerse(currentTranslation,book.id,chapter,verseNumber);
    if(!verse || !isRenderableVerseText(verse.text)) return false;
  }
  var bookSelect = document.getElementById('bookSelect');
  var chapterSelect = document.getElementById('chapterSelect');
  if(!bookSelect || !chapterSelect) return false;
  bookSelect.value = book.id;
  populateChapters();
  chapterSelect.value = String(chapter);
  currentVerse = null;
  loadPassage(verseNumber === undefined, preserveChapter);
  if(verseNumber !== undefined && !selectReaderVerse(verseNumber, preserveChapter)) return false;
  return true;
}

function parseSpokenReferenceNumber(value){
  var words = String(value || '').trim().replace(/-/g,' ').split(/\s+/);
  if(words.length === 1 && /^\d+$/.test(words[0])) return Number(words[0]);
  var units = {one:1, two:2, three:3, four:4, five:5, six:6, seven:7, eight:8, nine:9,
    ten:10, eleven:11, twelve:12, thirteen:13, fourteen:14, fifteen:15, sixteen:16,
    seventeen:17, eighteen:18, nineteen:19};
  var tens = {twenty:20, thirty:30, forty:40, fifty:50, sixty:60, seventy:70, eighty:80, ninety:90};
  if(words[1]==='hundred' && units[words[0]] && units[words[0]]<10){
    var rest=words.slice(2);if(rest[0]==='and'){rest.shift();if(!rest.length) return null;}
    var tail=rest.length ? parseSpokenReferenceNumber(rest.join(' ')) : 0;
    return tail!==null && tail<100 ? units[words[0]]*100+tail : null;
  }
  if(words.length === 1) return units[words[0]] || tens[words[0]] || null;
  if(words.length === 2 && tens[words[0]] && units[words[1]] && units[words[1]] < 10){
    return tens[words[0]] + units[words[1]];
  }
  return null;
}

// Curated aliases use the existing nine-translation registry; no fuzzy matching.
var spokenTranslationAliases={
  web:['webp','double u e b','double you e b','double you ee bee'],
  asv:['a ess vee'],
  kjv:['authorized','authorized king james version','king james authorized version','kay jay vee'],
  ylt:['young','young literal','young s literal','why el tee'],
  dby:['darbys','j n darby','john nelson darby','dee bee why'],
  webster:['websters','noah webster','double u b s','double you bee ess'],
  rv:['english revised','are vee'],
  gnv:['geneva 1599','gee en vee'],
  dra:['catholic','douay catholic','douay rheims american edition','dra catholic','d r a catholic','douay reims','douay reims catholic','douai rheims','douai rheims catholic','dewey rheims','dewey rheims catholic','dewey reams','dewey reams catholic','do way rheims','do way rheims catholic','do a rings','do a reigns','do we reems','dee are ay']
};
function normalizeSpokenNavigation(value){
  return normalizeVoiceCommand(value).normalize('NFKC').toLowerCase().replace(/[’‘ʼ'`´]/g,'')
    .replace(/[-\u2010-\u2015\u2212]+/g,function(mark,index,text){
      return /\d\s*$/.test(text.slice(0,index)) && /^\s*\d/.test(text.slice(index+mark.length)) ? '-' : ' ';
    }).replace(/:(?!\s*\d)/g,' ').replace(/[^\p{L}\p{N}:-]+/gu,' ').trim();
}
function getSpokenTranslationAliases(){
  var aliases=[],seen=new Set();
  BibleData.listTranslations().filter(function(t){return !!spokenTranslationAliases[t.id];}).forEach(function(t){
    var title=normalizeSpokenNavigation(t.name),plain=title.replace(/\s+\d{4}$/,''),words=plain.split(' ');
    var bases=[title,plain,plain.replace(/\s+(?:bible|version|translation|edition)$/,''),words[0],words.slice(0,2).join(' '),t.abbreviation,t.id,t.abbreviation.split('').join(' ')].concat(spokenTranslationAliases[t.id]);
    bases=bases.concat(bases.map(function(base){return normalizeSpokenNavigation(base).replace(/\s+(?:bible|version|translation|edition)$/,'');}));
    bases.forEach(function(base){
      base=normalizeSpokenNavigation(base);
      ['', ' bible',' version',' translation',' edition'].forEach(function(suffix){
        var name=base+suffix,key=t.id+':'+name;
        if(base && !seen.has(key)){seen.add(key);aliases.push({id:t.id,name:name});}
      });
    });
  });
  return aliases;
}
function matchSpokenTranslation(text){
  var matches=getSpokenTranslationAliases().filter(function(a){return text===a.name || text.indexOf(a.name+' ')===0 || text.indexOf(a.name+':')===0;});
  if(!matches.length) return null;
  var length=Math.max.apply(null,matches.map(function(a){return a.name.length;}));
  matches=matches.filter(function(a){return a.name.length===length;});
  var ids=Array.from(new Set(matches.map(function(a){return a.id;})));
  // A longer explicit title disambiguates shared short names. Never let catalog
  // aliases reinterpret a Scripture book or a reserved playback command.
  var reserved=/^(?:play|read|pause|resume|continue|stop|repeat|next|previous|back|chapter|verse)$/;
  var book=reserved.test(matches[0].name) || BibleCanon.books.some(function(b){return BibleCanon.names(b.id,b.name).some(function(n){return normalizeSpokenNavigation(n)===matches[0].name;});});
  if(ids.length!==1 || book) return {error:'Ambiguous translation name. Say its full title or abbreviation.'};
  return matches[0];
}
function parseSpokenNavigation(command){
  var text=normalizeSpokenNavigation(command), original=text;
  var play=/^(play|read)\s+/.test(text) || /\s+(play|read)$/.test(text);
  text=text.replace(/^(?:play|read|open|go to)\s+/,'').replace(/^the\s+/,'');
  var switchAction=/^(?:switch(?: (?:bible|version|translation))? to|change(?: (?:bible|version|translation))? to|select|use)\s+/.test(text);
  text=text.replace(/^(?:switch(?: (?:bible|version|translation))? to|change(?: (?:bible|version|translation))? to|select|use)\s+/,'').replace(/^the\s+/,'');
  var translation=matchSpokenTranslation(text);
  if(translation && translation.error) return translation;
  if(translation) text=text.slice(translation.name.length).trim().replace(/^:\s*/,'').replace(/^(?:and|then)\s+/,'');
  else if(/^(?:english|standard|protestant|bible|version|translation|edition)(?: (?:bible|version|translation|edition))*$/.test(text)) return {error:'Ambiguous translation name. Say its full title or abbreviation.'};
  else if(switchAction) return {error:'Translation not available. Choose one of the nine translations.'};
  play=play || /^(play|read)\s+/.test(text);
  text=text.replace(/^(?:play|read|open|go to)\s+/,'').replace(/\s+(?:play|read)$/,'').trim();
  if(!text && translation) return {translationId:translation.id,play:play};
  var contextual=/^(verse|chapter)\s+(.+)$/.exec(text), bookId=currentBook, remainder=text;
  if(!contextual){
    text=text.replace(/^(first|one|1st)\s+/,'1 ').replace(/^(second|two|2nd)\s+/,'2 ').replace(/^(third|three|3rd)\s+/,'3 ');
    var names=[];
    BibleCanon.books.forEach(function(book){BibleCanon.names(book.id,book.name).forEach(function(name){names.push({id:book.id,name:normalizeSpokenNavigation(name)});});});
    names.sort(function(a,b){return b.name.length-a.name.length;});
    var found=names.find(function(b){return text===b.name || text.indexOf(b.name+' ')===0 || text.indexOf(b.name)===0 && /^\d/.test(text.slice(b.name.length));});
    if(!found) return translation || /^(?:play|read|open|go to)\s/.test(original) || /\d/.test(text) ? {error:'Book, chapter, or verse not found.'} : null;
    bookId=found.id;remainder=text.slice(found.name.length).trim();
  }
  var choices=[];
  function add(chapter,verse){if(Number.isInteger(chapter) && chapter>0 && (verse===undefined || Number.isInteger(verse) && verse>0)) choices.push({bookId:bookId,chapter:chapter,verse:verse});}
  var explicit=/^(?:chapter\s+)?(.+?)\s+verse\s+(.+)$/.exec(remainder) || /^(.+?)\s*:\s*(.+)$/.exec(remainder), bare;
  if(contextual && contextual[1]==='verse') add(currentChapter,parseSpokenReferenceNumber(contextual[2]));
  else if(explicit) add(parseSpokenReferenceNumber(explicit[1]),parseSpokenReferenceNumber(explicit[2]));
  else if(/^chapter\s+/.test(remainder)) add(parseSpokenReferenceNumber(remainder.slice(8)));
  else if(!remainder) add(1);
  else {
    bare=parseSpokenReferenceNumber(remainder);add(bare);
    var words=remainder.split(' ');
    for(var i=1;i<words.length;i++) add(parseSpokenReferenceNumber(words.slice(0,i).join(' ')),parseSpokenReferenceNumber(words.slice(i).join(' ')));
  }
  if(!choices.length) return {error:'Book, chapter, or verse not found.'};
  return {translationId:translation && translation.id,choices:choices,play:play,bare:bare};
}
function validSpokenPassage(id,target){
  var chapter=BibleData.getChapter(id,target.bookId,target.chapter);
  if(!chapter || !chapter.verses.some(isRenderableVerseText)) return false;
  if(target.verse===undefined) return true;
  var verse=BibleData.getVerse(id,target.bookId,target.chapter,target.verse);
  return !!verse && isRenderableVerseText(verse.text);
}
function handleSpokenReferenceCommand(command, resumeReading, requestId){
  var plan=parseSpokenNavigation(command);
  if(!plan) return false;
  if(plan.error){setVoiceStatus(plan.error);return true;}
  var id=plan.translationId || currentTranslation, intent=readerPlaybackIntent;
  var paused=typeof BibleSpeech!=='undefined' && BibleSpeech.getState()==='paused';
  var snapshot=typeof BibleSpeech!=='undefined' ? BibleSpeech.getPlaybackSnapshot() : {};
  var original={bookId:currentBook,chapter:currentChapter,verse:currentVerse===null?undefined:currentVerse};
  var previousTranslation=currentTranslation;
  function current(){return requestId===voiceNavigationRequest && intent===readerPlaybackIntent;}
  function resolve(){
    if(!current()) return false;
    if(!plan.choices && id!==previousTranslation && !BibleCanon.comparable(previousTranslation,id,original.bookId)){
      setVoiceStatus('Different numbering traditions. Say the translation, book, chapter and verse explicitly.');return false;
    }
    var choices=plan.choices || [original];
    if(plan.bare && choices.length && BibleData.getChapterCount(id,choices[0].bookId)===1) choices=[{bookId:choices[0].bookId,chapter:1,verse:plan.bare}];
    var targets=choices.filter(function(t){return validSpokenPassage(id,t);});
    targets=targets.filter(function(t,i){return targets.findIndex(function(other){return other.chapter===t.chapter && other.verse===t.verse;})===i;});
    if(targets.length!==1){setVoiceStatus(targets.length ? 'Ambiguous reference. Say chapter and verse explicitly.' : 'Book, chapter, or verse not found.');return false;}
    var target=targets[0], start=(!plan.choices && snapshot.currentVerse) || target.verse || 1;
    if((resumeReading || paused) && !validSpokenPassage(id,{bookId:target.bookId,chapter:target.chapter,verse:start})){
      setVoiceStatus('That verse is unavailable in this translation.');return false;
    }
    var preserve=id===currentTranslation && target.bookId===currentBook && target.chapter===currentChapter && (resumeReading || paused);
    function finish(ok){
      if(!ok || requestId!==voiceNavigationRequest) return false;
      if(resumeReading || plan.play) playReader(start,false,true);
      else if(paused) readCurrentChapterAloud(start,false,currentTranslation,true);
      var name=(BibleData.listTranslations().find(function(t){return t.id===id;}) || {}).abbreviation;
      setVoiceStatus(name+' selected. '+(BibleData.getChapter(id,target.bookId,target.chapter) || {}).bookName+' '+target.chapter+(target.verse===undefined?'':':'+target.verse)+'.');
      return true;
    }
    if(id===currentTranslation) return finish(navigateToSpokenBook(target.bookId,target.chapter,target.verse,preserve));
    var options={target:target,isCurrent:current};
    var change=changeTranslation(id,options);intent=readerPlaybackIntent;
    return change.then(function(ok){if(options.committedIntent!==readerPlaybackIntent) return false;return finish(ok);});
  }
  if(id===currentTranslation && BibleData.isTranslationLoaded(id)){resolve();return true;}
  setVoiceStatus('Loading translation…');
  voiceNavigationTask=Promise.resolve(BibleTranslationLoader.ensure(id)).then(function(loaded){
    if(!current()) return false;
    if(!loaded){setVoiceStatus('Translation unavailable. Current passage kept; download it for offline use.');return false;}
    return resolve();
  }).catch(function(){if(current()) setVoiceStatus('Translation unavailable. Current passage kept.');return false;});
  return true;
}

function normalizeVoiceCommand(transcript){
  return String(transcript || '').toLowerCase().trim().replace(/[.!?]+$/, '').trim().replace(/\s+/g, ' ');
}

function handleVoiceCommand(transcript, resumeAfterTurn){
  var command = normalizeVoiceCommand(transcript);
  var requestId=++voiceNavigationRequest;
  var resumeReading=resumeAfterTurn===true || !!getActiveReaderPlaybackSnapshot();
  setVoiceStatus('Command recognized.');
  var simple=/^(?:repeat(?: verse| last verse)?|play(?: the passage)?|read(?: the passage)?|pause|resume|continue|stop|next verse|previous verse|back verse|next chapter|next|go to next chapter|previous chapter|previous|back|go to previous chapter)$/.test(command);
  traceReaderVoice('dispatch',transcript,simple);
  if(!simple && handleSpokenReferenceCommand(command,resumeReading,requestId)) return;
  if(/^(?:next chapter|next|go to next chapter|previous chapter|previous|back|go to previous chapter)$/.test(command)){
    var before=currentBook+':'+currentChapter;
    var keepPaused=typeof BibleSpeech!=='undefined' && BibleSpeech.getState()==='paused' && !resumeReading;
    var move=/^(next|go to next)/.test(command) ? nextChapter() : prevChapter();
    var committed=readerPlaybackIntent;
    function moved(){
      if(requestId!==voiceNavigationRequest || committed!==readerPlaybackIntent || !document.getElementById('view-reader').classList.contains('active')) return;
      if(before!==currentBook+':'+currentChapter){if(resumeReading) playReader();else if(keepPaused) readCurrentChapterAloud(1,false,currentTranslation,true);}
      else setVoiceStatus('No chapter in that direction in this edition.');
    }
    if(move && typeof move.then==='function') move.then(moved);else moved();
    return;
  }
  if(resumeAfterTurn && !/^(pause|stop)$/.test(command) && typeof BibleSpeech!=='undefined' && BibleSpeech.getState()==='paused') resumeReader();
  if(/^(repeat|repeat verse|repeat last verse)$/.test(command)) repeatLastSpokenVerse();
  else if(/^play( the passage)?$/.test(command)) playReader();
  else if(/^read( the passage)?$/.test(command)) playReader();
  else if(command === 'pause') pauseReader();
  else if(command === 'resume') resumeReader();
  else if(command === 'continue') continueReader();
  else if(command === 'stop') stopReader();
  else if(command === 'next verse') nextReaderVerse();
  else if(/^(previous verse|back verse)$/.test(command)) previousReaderVerse();
  else setVoiceStatus('Command not recognized. Say a translation name, Scripture reference, Play, Pause or Stop.');
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
  if(showReadyStatus) setVoiceStatus('Voice Commands stopped.');
}

function isInterimPlaybackCommand(transcript){
  var command = normalizeVoiceCommand(transcript);
  return /^(pause|stop|play|resume|continue|repeat|repeat verse|repeat last verse)$/.test(command);
}

function isAndroidVoiceCommands(){
  return /Android/i.test(window.navigator && window.navigator.userAgent || '');
}

function cancelReaderVoicePlayback(){
  voiceReleaseAction = null;
  voiceTurnWasPlaying = false;
}

// Android capture and narration take explicit turns. Only onend confirms release;
// neither a timeout nor a per-verse callback may reopen capture or start audio.
function releaseReaderMicrophone(action){
  if(voiceCommandsStopping && voiceReleaseFailed){
    cancelReaderVoicePlayback();
    setVoiceStatus(voiceTurnError);
    return;
  }
  voiceReleaseAction = action;
  voiceCommandsListening = false;
  if(!voiceRecognitionActive) return;
  if(voiceCommandsStopping) return;
  voiceReleaseFailed = false;
  voiceCommandsStopping = true;
  clearVoiceCommandTimers();
  setVoiceButtonState(false);
  setVoiceStatus('Closing microphone before continuing.');
  voiceReleaseTimer = setTimeout(function(){
    voiceReleaseTimer = null;
    voiceReleaseFailed = true;
    cancelReaderVoicePlayback();
    voiceTurnError = 'Microphone has not closed. Tap Voice Commands to stop it, then try Play again.';
    setVoiceStatus(voiceTurnError);
  },5000);
  try {
    if(typeof voiceRecognition.abort === 'function') voiceRecognition.abort();
    else voiceRecognition.stop();
  } catch(error){
    cancelReaderVoicePlayback();
    voiceReleaseFailed = true;
    voiceTurnError = 'Microphone could not close. Stop Voice Commands before trying Play again.';
    setVoiceStatus(voiceTurnError);
  }
}

function deferReaderSpeechUntilMicrophoneReleased(action){
  if(!isAndroidVoiceCommands() || !voiceRecognitionActive) return false;
  releaseReaderMicrophone(action);
  return true;
}

function completeAndroidVoiceTurn(recognition){
  if(voiceRecognition !== recognition) return;
  clearTimeout(voiceReleaseTimer);
  voiceReleaseTimer = null;
  var action = voiceReleaseAction;
  var releaseFailed = voiceReleaseFailed;
  voiceReleaseFailed = false;
  cancelReaderVoicePlayback();
  voiceRecognition = null;
  finishVoiceCommands(false);
  if(action){setVoiceStatus('Microphone off.');action();}
  else setVoiceStatus(releaseFailed ? 'Microphone is now off. Pending command canceled; tap Play to continue.' : voiceTurnError || 'Microphone off. Tap Voice Commands for another command or Play to read.');
}

function createVoiceRecognition(){
  var Recognition = getVoiceRecognition();
  if(!Recognition || voiceRecognition) return voiceRecognition;
  var recognition = voiceRecognition = new Recognition();
  voiceRecognition.continuous = !isAndroidVoiceCommands();
  voiceRecognition.interimResults = !isAndroidVoiceCommands();
  voiceRecognition.lang = 'en-US';
  traceReaderVoice('start',voiceRecognition);
  voiceRecognition.onstart = function(){
    if(isAndroidVoiceCommands() && (voiceRecognition !== recognition || !voiceCommandsListening || voiceCommandsStopping)) return;
    voiceRecognitionActive = true;
    voiceRestartAttempts = 0;
    if(voiceCommandsListening) setVoiceStatus('Listening for a command...');
  };
  voiceRecognition.onresult = function(event){
    if(isAndroidVoiceCommands() && voiceRecognition !== recognition) return;
    if(!voiceCommandsListening || !voiceRecognitionActive || !event.results) return;
    var resultIndex = Number.isInteger(event.resultIndex) ? event.resultIndex : 0;
    for(var index = resultIndex; index < event.results.length; index++){
      var result = event.results[index];
      if(voiceHandledResults.has(index)) continue;
      if(!result || !result[0] || !result[0].transcript) continue;
      var interim = result.isFinal === false;
      if(isAndroidVoiceCommands()){
        if(result.isFinal !== true || !normalizeVoiceCommand(result[0].transcript)) continue;
        traceReaderVoice('final',result);
        var transcript = result[0].transcript;
        var resume = voiceTurnWasPlaying && !/^(pause|stop)$/.test(normalizeVoiceCommand(transcript));
        releaseReaderMicrophone(function(){
          handleVoiceCommand(transcript,resume);
        });
        return;
      }
      if(interim && !isInterimPlaybackCommand(result[0].transcript)) continue;
      if(result.isFinal === true) traceReaderVoice('final',result);
      voiceResultHandled = true;
      voiceHandledResults.add(index);
      handleVoiceCommand(result[0].transcript);
    }
  };
  voiceRecognition.onerror = function(event){
    if(isAndroidVoiceCommands() && voiceRecognition !== recognition) return;
    var intentionalStop = voiceCommandsStopping || !voiceCommandsListening;
    if(intentionalStop && event.error === 'aborted') return;
    if(isAndroidVoiceCommands()){
      cancelReaderVoicePlayback();
      releaseReaderMicrophone(null);
      voiceTurnError = getVoiceRecognitionErrorMessage(event.error)+(typeof BibleSpeech !== 'undefined' && BibleSpeech.getState()==='paused' ? ' Reading is paused; tap Play to continue.' : ' Tap Voice Commands to try again.');
      setVoiceStatus(voiceTurnError);
      return;
    }
    if(event.error === 'no-speech'){
      voiceResultHandled=false;
      setVoiceStatus('No speech detected. Activate Voice Commands to listen again.');
      finishVoiceCommands(false);
      return;
    }
    voiceRecognitionActive = false;
    voiceRecognitionBlocked = event.error === 'not-allowed' || event.error === 'service-not-allowed' || event.error === 'audio-capture';
    setVoiceStatus(getVoiceRecognitionErrorMessage(event.error));
    finishVoiceCommands(false);
  };
  voiceRecognition.onend = function(){
    if(isAndroidVoiceCommands()){
      completeAndroidVoiceTurn(recognition);
      return;
    }
    if(!voiceRecognitionActive && !voiceCommandsStopping) return;
    voiceRecognitionActive = false;
    var handledResult = voiceResultHandled;
    voiceResultHandled = true;
    if(voiceCommandsStopping || !voiceCommandsListening){
      voiceCommandsStopping = false;
      return;
    }
    // Some services end after a command despite continuous=true. Never restart an empty capture.
    if(handledResult) scheduleVoiceRecognitionRestart(0);
    else {
      finishVoiceCommands(false);
      setVoiceStatus('Voice Commands ended. Activate Voice Commands to listen again.');
    }
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
    voiceHandledResults.clear();
    recognition.start();
  } catch(error){
    voiceRecognitionActive = false;
    if(!isAndroidVoiceCommands() && error && error.name === 'InvalidStateError' && voiceRestartAttempts < 3){
      voiceRestartAttempts++;
      scheduleVoiceRecognitionRestart(100);
      return;
    }
    setVoiceStatus('Voice command error: ' + (error && error.message ? error.message : 'Unable to start recognition.'));
    finishVoiceCommands(false);
    if(isAndroidVoiceCommands()) voiceRecognition = null;
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
  if(isAndroidVoiceCommands()){
    if(voiceRecognitionActive) return;
    voiceNavigationRequest++;
    voiceTurnError = '';
    voiceTurnWasPlaying = typeof BibleSpeech !== 'undefined' && ['playing','preparing'].includes(BibleSpeech.getState());
    if(readerPlaybackPending) stopReadAloud();
    else if(voiceTurnWasPlaying) BibleSpeech.pauseForVoiceCommand();
  }
  clearVoiceCommandTimers();
  voiceRecognitionBlocked = false;
  voiceCommandsStopping = false;
  voiceCommandsListening = true;
  setVoiceButtonState(true);
  startVoiceRecognition();
}

function disableVoiceCommands(){
  if(isAndroidVoiceCommands()){
    cancelReaderVoicePlayback();
    if(voiceCommandsStopping){
      try { if(voiceRecognition && voiceRecognition.abort) voiceRecognition.abort(); } catch(error) { /* onend still owns release. */ }
    } else releaseReaderMicrophone(null);
    return;
  }
  clearVoiceCommandTimers();
  voiceCommandsListening = false;
  voiceCommandsStopping = true;
  setVoiceButtonState(false);
  setVoiceStatus('Voice Commands stopped.');
  if(voiceRecognitionActive && voiceRecognition && typeof voiceRecognition.stop === 'function'){
    voiceRecognition.stop();
  } else {
    voiceRecognitionActive = false;
    voiceCommandsStopping = false;
  }
}

function toggleVoiceCommands(){
  voiceCommandsInteracted = true;
  if(voiceCommandsListening || isAndroidVoiceCommands() && voiceRecognitionActive) disableVoiceCommands();
  else enableVoiceCommands();
}

function initializeVoiceCommands(){
  if(isAndroidVoiceCommands()) setVoiceButtonState(voiceCommandsListening);
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
    if(permission.state === 'granted' && !voiceCommandsInteracted && !isAndroidVoiceCommands()) enableVoiceCommands();
    else if(permission.state === 'denied'){
      voiceRecognitionBlocked = true;
      setVoiceStatus(getVoiceRecognitionErrorMessage('not-allowed'));
    }
    permission.onchange = function(){
      if(permission.state === 'granted' && voiceCommandsListening) startVoiceRecognition();
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

function renderStudyWordTokens(text, translationId){
  var html = String(text).split(/([A-Za-z0-9]+(?:['\u2019-][A-Za-z0-9]+)*)/g).map(function(token){
    if(!/^[A-Za-z0-9]/.test(token)) return escapeHtml(token);
    var lookupTerm = WordStudyLoader.normalizeLookupTerm(token);
    return '<span class="word-study-token" role="button" tabindex="0" aria-label="Study word ' + escapeHtml(token) + '" data-word-study-display="' + escapeHtml(token) + '" data-word-study-term="' + escapeHtml(lookupTerm) + '">' + escapeHtml(token) + '</span>';
  }).join('');
  return translationId === 'kjv' ? html.replace(/\[((?:\[[^[\]]*\]|[^[\]])+)\]/g, '<i>$1</i>') : html;
}

function readerTabReference(){
  return JSON.stringify([currentTranslation, currentBook, currentChapter, currentVerse]);
}

function rememberReaderTabPosition(leaving){
  var reader = document.getElementById('view-reader');
  if(!reader || !reader.classList.contains('active')) return;
  var reference = readerTabReference();
  var fullscreen = reader.classList.contains('reader-fullscreen');
  var top = readerVisibleTop();
  var verses = Array.from(document.querySelectorAll('#readerContent [data-verse-number]'));
  var anchor = verses.find(function(verse){
    var rect = verse.getBoundingClientRect();
    return rect.bottom > top + 16 && rect.top < window.innerHeight;
  });
  if(!anchor && !leaving) return;
  readerTabPosition = {
    reference:reference, fullscreen:fullscreen,
    top:fullscreen ? reader.scrollTop : window.scrollY,
    verse:anchor ? anchor.getAttribute('data-verse-number') : null,
    offset:anchor ? anchor.getBoundingClientRect().top - top : null
  };
}

function restoreReaderTabPosition(preserveAnchor){
  if(!readerTabPosition) return;
  var reader = document.getElementById('view-reader');
  if(readerTabPosition.reference !== readerTabReference()){
    if(currentVerse) applyReaderVerseSelection(currentVerse, true);
    else scrollReaderStartIntoView();
    rememberReaderTabPosition(true);
    return;
  }
  // Tab returns honor selection; fullscreen transitions preserve the visible anchor.
  if(currentVerse && !preserveAnchor){
    // Switching away can clamp the document. Restore the compact Reader's saved
    // offset before deciding whether its selected verse needs further movement.
    if(reader.querySelector('.reader-compact-mobile') && reader.classList.contains('reader-fullscreen')===readerTabPosition.fullscreen){
      (readerTabPosition.fullscreen ? reader : window).scrollTo({top:readerTabPosition.top,behavior:'instant'});
    }
    scrollReaderTargetIntoView(document.querySelector('#readerContent [data-verse-number="' + currentVerse + '"]'), 'instant');
    return;
  }
  var fullscreen = reader.classList.contains('reader-fullscreen');
  if(!preserveAnchor && fullscreen !== readerTabPosition.fullscreen) return;
  var surface = fullscreen ? reader : window;
  var anchor = readerTabPosition.verse && document.querySelector('#readerContent [data-verse-number="' + readerTabPosition.verse + '"]');
  if(anchor){
    var offset = anchor.getBoundingClientRect().top - readerVisibleTop() - (preserveAnchor ? Math.max(16, readerTabPosition.offset) : readerTabPosition.offset);
    if(Math.abs(offset) >= 1) surface.scrollBy({top:offset, behavior:'instant'});
  } else if(!preserveAnchor) surface.scrollTo({top:readerTabPosition.top, behavior:'instant'});
}

function switchView(view, btn, positionOnReturn){
  var target = document.getElementById('view-' + view);
  if(!target || !btn) return;
  if(view!=='plan' && typeof invalidatePendingPlanNavigation==='function') invalidatePendingPlanNavigation();
  if(view==='plan' && typeof activePlanReadingSession!=='undefined' && activePlanReadingSession){
    returnToPlanFromSession(false);
    return;
  }
  var readerView = document.getElementById('view-reader');
  var readerWasActive = Boolean(readerView && readerView.classList.contains('active'));
  if(readerWasActive && view !== 'reader'){
    rememberReaderTabPosition(true);
    if(typeof WordStudyLoader !== 'undefined') WordStudyLoader.invalidate(true);
  }
  document.querySelectorAll('.bs-view').forEach(function(v){ v.classList.remove('active'); });
  if(view!=='reader' && typeof clearPlanReadingSession==='function') clearPlanReadingSession();
  if(view==='plan' && typeof prepareJourneyPlanView==='function') prepareJourneyPlanView();
  if(view !== 'reader') stopSpeechForManualNavigation();

  target.classList.add('active');
  document.querySelectorAll('.bs-btn').forEach(function(b){ b.classList.remove('active'); });
  document.querySelectorAll('.bs-btn[aria-pressed]').forEach(function(b){ b.setAttribute('aria-pressed', 'false'); });
  btn.classList.add('active');
  btn.setAttribute('aria-pressed', 'true');
  // The active view changes the stack's trailing reserve; apply it before positioning.
  if(refreshReaderStickyOffsets) refreshReaderStickyOffsets();
  if(typeof CompareLoader !== 'undefined'){
    if(view === 'compare') CompareLoader.activate();
    else CompareLoader.leave();
  }
  if(view === 'reader' && !readerWasActive && positionOnReturn !== false) restoreReaderTabPosition();
  if(view !== 'reader'){
    var tabs = readerStickyNavigation();
    if(tabs){
      var tabsTop = parseFloat(getComputedStyle(tabs).top);
      var tabsRect = tabs.getBoundingClientRect();
      // A short loading view can clamp the document past the sticky row's container.
      if(Number.isFinite(tabsTop) && (tabsRect.top < tabsTop - 1 || tabsRect.bottom > window.innerHeight)){
        window.scrollBy({top:tabsRect.top - tabsTop, behavior:'instant'});
      }
    }
  }
  if(view === 'plan'){
    var heading = document.getElementById('planHeading');
    var offset = heading ? heading.getBoundingClientRect().top - readerVisibleTop() : 0;
    if(offset) window.scrollBy({top:Math.floor(offset), behavior:'instant'});
  }
}

function populateBooks(){
  var bookSelect = document.getElementById('bookSelect');
  if(!bookSelect || typeof BibleData === 'undefined') return;
  bookSelect.innerHTML = '';
  var books = BibleData.listBooks(currentTranslation);
  books.forEach(function(book){
    var option = document.createElement('option');
    option.value = book.id;
    option.textContent = BibleCanon.bookLabel(book.id, book.name);
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
  ReaderTranslationLoader.sync();
}

var readerTranslationTask = null;
function changeTranslation(translationId, options){
  if(typeof ScripturePicker !== 'undefined') ScripturePicker.invalidate();
  if(typeof BibleData === 'undefined' || !BibleData.listTranslations().some(function(translation){ return translation.id === translationId; })) return Promise.resolve(false);
  if(typeof invalidatePendingPlanNavigation==='function') invalidatePendingPlanNavigation();
  stopSpeechForManualNavigation();
  var intent=readerPlaybackIntent;
  if(typeof WordStudyLoader !== 'undefined') WordStudyLoader.invalidate();
  var task = ReaderTranslationLoader.ensure().then(function(){
    if(options && (intent!==readerPlaybackIntent || !options.isCurrent())) return false;
    return applyReaderTranslation(translationId,options);
  },function(){
    if(options && (intent!==readerPlaybackIntent || !options.isCurrent())) return false;
    document.getElementById('readerTranslation').value = currentTranslation;
    document.getElementById('readerTranslationStatus').textContent = 'Translation controls unavailable. Please try again.';
    return false;
  });
  readerTranslationTask = task;
  function finished(){
    if(readerTranslationTask === task) readerTranslationTask = null;
    ReaderTranslationLoader.sync();
  }
  task.then(finished,finished);
  return task;
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
  loadPassage(true);
}

function renderPassage(bookKey, chapterNum){
  var data = BibleData.getChapter(currentTranslation, bookKey, chapterNum);
  if(!data) return;
  var bookName = escapeHtml(data.bookName);
  var html = '<h2 data-book-id="' + escapeHtml(bookKey) + '" data-book-name="' + bookName + '" data-chapter="' + escapeHtml(chapterNum) + '">' + bookName + ' ' + escapeHtml(chapterNum) + '</h2>';
  var webSubtitle = currentTranslation === 'web' && data.subtitle === 'World English Bible Protestant Edition';
  if(data.subtitle) html += '<div class="subtitle' + (webSubtitle ? ' reader-web-edition-label' : '') + '">' + escapeHtml(data.subtitle) + '</div>';
  html += '<div class="reader-plan-return" hidden></div>';
  var canonLabel = BibleCanon.passageLabel(currentTranslation, bookKey, chapterNum);
  var webCaption = currentTranslation === 'web' && data.title === 'World English Bible' && !canonLabel;
  html += '<div class="reader-chapter-caption' + (webCaption ? ' reader-web-edition-label' : '') + '">' + escapeHtml(data.title) + (canonLabel ? ' — ' + escapeHtml(canonLabel) : '') + '</div>';
  if(currentTranslation === 'kjv') html += '<p class="sr-only">KJV italics: supplied words, not emphasis.</p>';
  for(var i = 0; i < data.verses.length; i++){
    if(!isRenderableVerseText(data.verses[i])) continue;
    html += '<span class="reader-verse" data-translation-id="' + escapeHtml(currentTranslation) + '" data-book-id="' + escapeHtml(bookKey) + '" data-book-name="' + bookName + '" data-chapter="' + escapeHtml(chapterNum) + '" data-verse-number="' + escapeHtml(i+1) + '" data-verse-text="' + escapeHtml(data.verses[i]) + '"><button type="button" class="vnum" aria-label="Highlight verse ' + escapeHtml(i+1) + '">' + escapeHtml(i+1) + '</button>' + renderStudyWordTokens(data.verses[i], currentTranslation) + '</span> ';
  }
  var container = document.getElementById('readerContent');
  if(typeof WordStudyLoader !== 'undefined') WordStudyLoader.invalidate();
  if(container){
    // Reuse the native control so passage updates retain its listener and focus.
    var backToPlan = document.getElementById('readerBackToPlan');
    var restorePlanFocus = backToPlan && document.activeElement === backToPlan;
    container.innerHTML = html;
    if(backToPlan){
      var returnRow = container.querySelector('.reader-plan-return');
      returnRow.appendChild(backToPlan);
      returnRow.hidden = backToPlan.hidden;
      if(restorePlanFocus) backToPlan.focus({preventScroll:true});
    }
  }
  populateVerses();
  if(Number.isInteger(currentVerse) && !isRenderableVerseText(data.verses[currentVerse - 1])) clearReaderVerseSelection();
  updateReaderReferenceDisplay();
}

function loadPassage(positionAfterRender, preserveChapter){
  if(positionAfterRender && typeof ScripturePicker !== 'undefined') ScripturePicker.invalidate();
  if(positionAfterRender && typeof invalidatePendingPlanNavigation==='function') invalidatePendingPlanNavigation();
  // Manual navigation opts in; startup/reload rendering leaves native restoration alone.
  var bookSelect = document.getElementById('bookSelect');
  var chapterSelect = document.getElementById('chapterSelect');
  if(!bookSelect || !chapterSelect || typeof BibleData === 'undefined') return;
  if(!readerPlaybackPending || typeof bibleExperienceReady === 'undefined' || bibleExperienceReady) stopSpeechForManualNavigation(preserveChapter);
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
  renderPassage(currentBook, currentChapter);
  replacePlaybackResumeCursor({
    translationId:currentTranslation, bookId:currentBook, chapter:currentChapter,
    verse:Number.isInteger(currentVerse) && BibleData.getVerse(currentTranslation, currentBook, currentChapter, currentVerse) ? currentVerse : 1
  });
  if(!currentVerse || !applyReaderVerseSelection(currentVerse, false)) clearReaderVerseSelection();
  saveReaderPosition();
  updateReaderControls();
  if(positionAfterRender === true){
    if(currentVerse) scrollReaderTargetIntoView(document.querySelector('#readerContent [data-verse-number="' + currentVerse + '"]'), 'instant');
    else scrollReaderStartIntoView();
  }
}

function readCurrentChapterAloud(startVerse, pauseAfterFirst, translationId, startPaused){
  if(typeof BibleSpeech === 'undefined') return;
  var fixedTranslation = translationId || currentTranslation;
  var chapter = BibleData.getChapter(fixedTranslation, currentBook, currentChapter);
  if(!chapter) return;
  BibleSpeech.playChapter(chapter, startVerse, pauseAfterFirst, {
    translationId:fixedTranslation,
    startPaused:Boolean(startPaused),
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
  readerPlaybackIntent++;
  readerPlaybackPending = false;
  if(typeof BibleSpeech !== 'undefined') BibleSpeech.stop();
}

function adjacentCatholicBook(direction){
  if(currentTranslation!=='dra') return null;
  var books=BibleData.listBooks(currentTranslation);
  var index=books.findIndex(function(b){return b.id===currentBook;})+direction;
  return books[index] || null;
}
function prevChapter(){
  if(currentChapter===1 && adjacentCatholicBook(-1)){
    var previous=adjacentCatholicBook(-1);
    return navigateReaderToPassage(previous.id,BibleData.getChapterCount(currentTranslation,previous.id));
  }
  if(currentChapter > 1){
    document.getElementById('chapterSelect').value = currentChapter - 1;
    currentVerse = null;
    loadPassage(true);
  }
}
function nextChapter(){
  if(typeof activePlanReadingSession!=='undefined' && activePlanReadingSession &&
    activePlanReadingSession.end.bookId===currentBook && activePlanReadingSession.end.chapter===currentChapter){
    returnToPlanFromSession(true);
    return;
  }
  if(currentChapter === BibleData.getChapterCount(currentTranslation,currentBook) && adjacentCatholicBook(1)){
    return navigateReaderToPassage(adjacentCatholicBook(1).id,1);
  }
  if(currentChapter < BibleData.getChapterCount(currentTranslation, currentBook)){
    document.getElementById('chapterSelect').value = currentChapter + 1;
    currentVerse = null;
    loadPassage(true);
  }
}

function navigateAdjacentReaderVerse(direction){
  var playback = getActiveReaderPlaybackSnapshot();
  var verse = getAdjacentReaderVerseNumber(direction);
  if(verse === null || !setReaderVerse(verse, false, Boolean(playback)) || !playback) return;
  // Selection cancels the old session before its replacement starts. Speech's
  // session/attempt guards reject late start, end, error and cloud callbacks.
  if(playback.isChapter) playReader(verse, false, true);
  else readVerseAloud(verse);
}

function previousReaderVerse(){
  navigateAdjacentReaderVerse(-1);
}

function nextReaderVerse(){
  navigateAdjacentReaderVerse(1);
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
  rememberReaderTabPosition(true);
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
  if(refreshReaderStickyOffsets) refreshReaderStickyOffsets();
  restoreReaderTabPosition(true);
  if(entering) button.focus({preventScroll:true});
  else {
    var returnFocus=fullscreenReturnFocus && fullscreenReturnFocus.isConnected ? fullscreenReturnFocus : button;
    if(!returnFocus.getClientRects().length) returnFocus=document.getElementById('readerMoreTrigger');
    returnFocus.focus({preventScroll:true});
    fullscreenReturnFocus = null;
  }
}

document.addEventListener('keydown', function(event){
  var shell = document.getElementById('view-reader');
  if(!shell || !shell.classList.contains('reader-fullscreen')) return;
  var picker = document.getElementById('scripturePicker');
  if(picker && picker.open) return;
  if(ReaderTranslationLoader.isOpen()) return;
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
  if(typeof invalidatePendingPlanNavigation==='function') invalidatePendingPlanNavigation();
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
  if(typeof ScripturePicker !== 'undefined') ScripturePicker.invalidate();
  if(typeof invalidatePendingPlanNavigation==='function') invalidatePendingPlanNavigation();
  var requestedVerse = Number.isInteger(verse) && verse > 0 ? verse : null;
  if(typeof BibleData === 'undefined' || !BibleData.getChapter(currentTranslation, bookId, chapter) ||
    (requestedVerse !== null && !BibleData.getVerse(currentTranslation, bookId, chapter, requestedVerse))) return Promise.resolve(false);
  return runWithBibleExperience(function(){
    var readerButton = document.querySelector('.bs-btn[aria-controls="view-reader"]');
    if(!readerButton) return false;
    if(!document.getElementById('view-reader').classList.contains('active')) switchView('reader', readerButton, false);
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
    loadPassage(requestedVerse === null);
    if(requestedVerse === null) return true;
    var target = document.querySelector('#readerContent [data-verse-number="' + requestedVerse + '"]');
    if(!target || target.getAttribute('data-book-id') !== bookId || Number(target.getAttribute('data-chapter')) !== chapter) return false;
    if(!applyReaderVerseSelection(requestedVerse, true)) return false;
    saveReaderPosition();
    return true;
  }).then(function(loaded){
    return loaded && requestedVerse === null
      ? new Promise(requestAnimationFrame).then(function(){ return true; })
      : loaded;
  }).catch(function(){ return false; });
}
function initializeReaderControls(){
initializeReaderStickyOffsets();
window.addEventListener('scroll', function(){ rememberReaderTabPosition(false); }, {passive:true});
var readerView = document.getElementById('view-reader');
if(readerView) readerView.addEventListener('scroll', function(){ rememberReaderTabPosition(false); }, {passive:true});
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
['chapterSelect', 'change', function(){ runWithBibleExperience(function(){ loadPassage(true); }); }],
['verseSelect', 'change', function(event){ runWithBibleExperience(function(){ selectReaderVerse(event.target.value); }); }],
['readAloudPlay', 'click', function(){
if(typeof BibleSpeech === 'undefined') return;
if(readerPlaybackPending || BibleSpeech.getState() === 'playing' || BibleSpeech.getState() === 'preparing'){ stopReadAloud(); return; }
// Audio authorization must happen in this gesture, before Bible acquisition.
BibleSpeech.prepare();
if(typeof bibleExperienceReady !== 'undefined' && bibleExperienceReady){ playReader(); return; }
var intent = ++readerPlaybackIntent;
readerPlaybackPending = true;
BibleSpeech.beginPreparation();
runWithBibleExperience(function(){
if(intent !== readerPlaybackIntent) return false;
// Clear Speech's empty preparation state before establishing a real sequence.
BibleSpeech.stop();
playReader(undefined,false,true);
readerPlaybackPending = false;
}).then(function(loaded){
if(intent !== readerPlaybackIntent) return;
if(!loaded){ readerPlaybackPending = false; BibleSpeech.failPreparation(); }
});
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
button.addEventListener('click', function(){
if(typeof BibleSpeech !== 'undefined'){
  if(!isAndroidVoiceCommands()) BibleSpeech.prepare();
  else if(!voiceRecognitionActive && BibleSpeech.getState()==='idle'){
    // Unlock cloud audio in the intentional gesture, then suspend it before capture.
    BibleSpeech.prepare();
    if(typeof BibleCloudTTS !== 'undefined') BibleCloudTTS.pause();
  }
}
runWithBibleExperience(toggleVoiceCommands);
});
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
});
});
}
function closeReaderMore(){
setReaderOptionsOpen(false);
}
function readerOptionsError(){
document.getElementById('readerSaveStatus').textContent='Native controls remain available. Reopen Options to retry saving.';
}
function setReaderOptionsOpen(open){
var moreTrigger = document.getElementById('readerMoreTrigger');
var secondaryControls = document.getElementById('readerSecondaryControls');
if(!moreTrigger || !secondaryControls) return;
secondaryControls.hidden = !open;
moreTrigger.setAttribute('aria-expanded', open ? 'true' : 'false');
moreTrigger.textContent = open ? 'Hide Options' : 'Options';
if(open) ReaderTranslationLoader.ensure().catch(readerOptionsError);
else moreTrigger.focus({preventScroll:true});
}

if(typeof BibleSpeech !== 'undefined' && typeof BibleSpeech.setPlaybackListener === 'function'){
BibleSpeech.setPlaybackListener({
// Preparation clears the previous verse without exposing the selected verse.
// Only actual playback claims the next; Stop/end restores selection highlighting.
onVerseStart: function(){ clearSpokenVerseHighlight(true); },
onVerseSpoken: handleSpokenVerseStart,
onVerseRepeat: handleRepeatedVerse,
onVerseComplete: completePlaybackVerse,
onEnd: function(){
clearSpokenVerseHighlight();
updateReaderControls();
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
setReaderOptionsOpen(moreTrigger.getAttribute('aria-expanded') !== 'true');
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
var ReaderTranslationLoader = (function(){
var request;
function ensure(){
if(!request) request = new Promise(function(resolve,reject){
var script = document.createElement('script');
var timeout = setTimeout(fail,10000);
function fail(){
clearTimeout(timeout);
script.onload = script.onerror = null;
script.remove();
request = null;
reject(new Error('Translation controls unavailable'));
}
script.src = '/js/bible/translation-picker.js';
script.onload = function(){
try {
if(typeof applyReaderTranslation !== 'function') throw new Error('Missing translation runtime');
ReaderTranslationPicker.initialize();
ReaderOptions.initialize();
clearTimeout(timeout);
resolve();
} catch(error){ fail(); }
};
script.onerror = fail;
document.head.appendChild(script);
});
return request;
}
function sync(){ if(window.ReaderTranslationPicker) ReaderTranslationPicker.sync(); }
function isOpen(){ return !!window.ReaderTranslationPicker && ReaderTranslationPicker.isOpen(); }
function prepare(){
if(bibleExperienceReady && typeof HTMLDialogElement !== 'undefined' && HTMLDialogElement.prototype.showModal &&
matchMedia('(max-width:620px)').matches) ensure().catch(function(){});
}
function initialize(){
matchMedia('(max-width:620px)').addEventListener('change',prepare);
document.querySelectorAll('#view-reader select').forEach(function(select){
function open(event){
if(event.type==='keydown' && !['Enter',' ','ArrowDown','ArrowUp','Home','End','F4'].includes(event.key)) return;
if(typeof HTMLDialogElement==='undefined' || !HTMLDialogElement.prototype.showModal) return;
if(select.dataset.nativeFallback) return;
event.preventDefault();
ensure().then(function(){if(document.activeElement===select) ThemedSelectPicker.open(select);}).catch(function(){select.dataset.nativeFallback='true';select.focus();});
}
function activate(event){select.focus({preventScroll:true});open(event);}
select.addEventListener('pointerdown',activate);
select.addEventListener('keydown',open);
select.addEventListener('click',activate);
});
}
return {ensure:ensure,sync:sync,isOpen:isOpen,prepare:prepare,initialize:initialize};
})();
if(document.readyState === 'loading') window.addEventListener('DOMContentLoaded', function(){ initializeReaderControls(); initializeVoiceCommands(); ReaderTranslationLoader.initialize(); }, { once: true });
else { initializeReaderControls(); initializeVoiceCommands(); ReaderTranslationLoader.initialize(); }

// Fragment opt-in is local to this document and never sent with HTTP requests.
if(location.hash==='#voice-debug') ReaderTranslationLoader.ensure().catch(function(){setVoiceStatus('Local voice diagnostics unavailable. Voice Commands still works.');});
