/* ===== SCRIPTURE READ ALOUD ===== */
var BibleSpeech = (function createBibleSpeech(){
  var SPEEDS = [0.5, 0.75, 1, 1.25, 1.5, 1.75, 2, 2.25, 2.5];
  var state = 'idle';
  var verses = [];
  var verseIndex = 0;
  var pendingNext = false;
  var pauseAfterCurrent = false;
  var sequenceIsChapter = false;
  var repeatState = null;
  var currentVerseIndex = -1;
  var session = 0;
  var continueAfterChapter = null;
  var completionMessage = '';
  var statusMessage = '';
  var speed = readSpeedPreference();
  var voicePreference = readVoicePreference();
  var playbackListener = null;

  function supported(){
    return typeof window !== 'undefined' && typeof window.speechSynthesis !== 'undefined' && typeof window.SpeechSynthesisUtterance !== 'undefined';
  }

  function elements(){
    return {
      play: document.getElementById('readAloudPlay'),
      status: document.getElementById('readAloudStatus'),
      voice: document.getElementById('readAloudVoice'),
      speed: document.getElementById('readAloudSpeed')
    };
  }

  function readSpeedPreference(){
    return UserData.speechSpeed.load();
  }

  function readVoicePreference(){
    var saved = UserData.speechVoice.load();
    // Older profiles and device names now map to the two supported choices.
    // In particular, the former Male 2 selection must never reopen its silent voice.
    var preference = saved === 'female' || /^(?:adult-female|child-female)$/i.test(saved) ||
      /\b(?:Zira|Samantha)\b|Google UK English Female/i.test(saved) ? 'female' : 'male';
    if(saved !== preference) UserData.speechVoice.save(preference);
    return preference;
  }

  function voices(){
    if(!supported() || typeof window.speechSynthesis.getVoices !== 'function') return [];
    return window.speechSynthesis.getVoices();
  }

  // Profiles are semantic UI choices, independent of the current device inventory.
  var voiceInventory = new Map();
  var resolvedVoiceKeys = {male:null, female:null};

  function voiceKey(voice){
    return JSON.stringify([voice.voiceURI || '', voice.name || '', voice.lang || '']);
  }

  function isUSEnglish(voice){
    return /^en[-_]US$/i.test(voice.lang);
  }

  function compareVoiceText(left, right){
    var first = String(left || '');
    var second = String(right || '');
    var foldedFirst = first.toLowerCase();
    var foldedSecond = second.toLowerCase();
    return foldedFirst < foldedSecond ? -1 : foldedFirst > foldedSecond ? 1 :
      first < second ? -1 : first > second ? 1 : 0;
  }

  function compareVoices(left, right){
    return Number(isUSEnglish(right)) - Number(isUSEnglish(left)) ||
      Number(Boolean(right.localService)) - Number(Boolean(left.localService)) ||
      compareVoiceText(left.name, right.name) || compareVoiceText(left.lang, right.lang) ||
      compareVoiceText(left.voiceURI, right.voiceURI);
  }

  function profileRank(voice, profile){
    var name = voice.name || '';
    var us = isUSEnglish(voice);
    // The API has no gender field: recognize established names, then use English fallbacks.
    if(profile === 'male'){
      if(us && /\bDavid\b/i.test(name)) return 0;
      var knownMale = /\b(?:David|Mark|Alex|Daniel|Oliver|Thomas|James|Fred|Aaron|Rishi|Gordon|Arthur)\b/i.test(name) ||
        /(?:^|[^a-z])male(?:[^a-z]|$)/i.test(name);
      if(us && knownMale) return 1;
      if(knownMale) return 2;
      return us ? 3 : 4;
    }
    if(us && /\bZira\b/i.test(name)) return 0;
    if(/\bSamantha\b/i.test(name)) return 1;
    var femaleMarker = /(?:^|[^a-z])female(?:[^a-z]|$)/i.test(name);
    if(/\b(?:Karen|Moira|Tessa|Fiona|Victoria|Veena|Nicky)\b/i.test(name) ||
        femaleMarker && /Google|Apple|Android|^en[-_]/i.test(name)) return 2;
    if(us && (/\b(?:Zira|Susan|Allison|Ava|Salli|Joanna|Jenny|Aria|Michelle)\b/i.test(name) || femaleMarker)) return 3;
    return us ? 4 : 5;
  }

  function resolveVoiceProfiles(){
    var available = voices().filter(function(voice){ return /^en(?:-|_|$)/i.test(voice.lang); });
    available.sort(compareVoices);
    voiceInventory = new Map();
    available.forEach(function(voice){
      var key = voiceKey(voice);
      if(!voiceInventory.has(key)) voiceInventory.set(key, voice);
    });
    available = Array.from(voiceInventory.values());
    function preferred(profile, excluded){
      return available.filter(function(voice){ return voiceKey(voice) !== excluded; })
        .sort(function(left, right){ return profileRank(left, profile) - profileRank(right, profile) || compareVoices(left, right); })[0] || null;
    }
    var male = preferred('male');
    var female = preferred('female');
    if(male && female && voiceKey(male) === voiceKey(female) && available.length > 1){
      // Keep a recognized Female (e.g. Samantha) when Male only found a generic fallback.
      if(profileRank(female, 'female') < profileRank(male, 'male')) male = preferred('male', voiceKey(female));
      else female = preferred('female', voiceKey(male));
    }
    resolvedVoiceKeys = {male:male ? voiceKey(male) : null, female:female ? voiceKey(female) : null};
  }

  function populateVoiceSelector(){
    var select = elements().voice;
    if(!select) return;
    select.textContent = '';
    ['male', 'female'].forEach(function(profile){
      var option = document.createElement('option');
      option.value = profile;
      option.textContent = profile === 'male' ? 'Male' : 'Female';
      select.appendChild(option);
    });
    select.value = voicePreference;
    select.disabled = !supported();
  }

  function refreshVoices(){
    // Only refresh at initialization/voiceschanged, never between individual verses.
    // Updating future bindings does not cancel or mutate an utterance already speaking.
    resolveVoiceProfiles();
    populateVoiceSelector();
    updateControls();
  }

  function selectedVoice(){
    return voiceInventory.get(resolvedVoiceKeys[voicePreference]) || null;
  }

  function getResolvedVoiceInfo(){
    function info(profile){
      var voice = voiceInventory.get(resolvedVoiceKeys[profile]);
      return voice ? {name:voice.name, voiceURI:voice.voiceURI || '', lang:voice.lang,
        localService:Boolean(voice.localService), default:Boolean(voice.default)} : null;
    }
    var voice = selectedVoice();
    return {
      preference:voicePreference,
      voiceName:voice ? voice.name : null,
      voiceURI:voice ? voice.voiceURI || '' : null,
      lang:voice ? voice.lang : null,
      pitch:1,
      male:info('male'),
      female:info('female'),
      sharedFallback:Boolean(resolvedVoiceKeys.male && resolvedVoiceKeys.male === resolvedVoiceKeys.female),
      englishVoiceCount:voiceInventory.size
    };
  }

  function configureUtterance(utterance, profile){
    utterance.rate = speed;
    utterance.pitch = 1;
    var voice = profile ? voiceInventory.get(resolvedVoiceKeys[profile]) : selectedVoice();
    if(voice) utterance.voice = voice;
    return utterance;
  }

  function voiceDebugEnabled(){
    return new URLSearchParams(window.location.search).get('voice-debug') === '1';
  }

  function notifyVoiceDebug(){
    if(voiceDebugEnabled()) document.dispatchEvent(new Event('bible-speech-debug-update'));
  }

  function getVoiceDiagnostics(){
    var inventory = [];
    var error = '';
    try { inventory = voices(); }
    catch(failure){ error = String(failure.message || failure); }
    return {
      supported:supported(),
      inventory:inventory.map(function(voice, index){
        return {index:index, name:voice.name, voiceURI:voice.voiceURI || '', lang:voice.lang,
          localService:Boolean(voice.localService), default:Boolean(voice.default)};
      }),
      englishVoiceCount:inventory.filter(function(voice){ return /^en(?:-|_|$)/i.test(voice.lang); }).length,
      resolved:getResolvedVoiceInfo(),
      error:error
    };
  }

  function testVoiceProfile(profile){
    // Diagnostics must not interrupt playing/paused Reader or Journey speech.
    if(!voiceDebugEnabled() || !supported() || state !== 'idle' ||
        (profile !== 'male' && profile !== 'female')) return false;
    window.speechSynthesis.speak(configureUtterance(new window.SpeechSynthesisUtterance(
      profile === 'male' ? 'This is the male voice.' : 'This is the female voice.'), profile));
    return true;
  }

  function setPlaybackListener(listener){
    playbackListener = listener && typeof listener === 'object' ? listener : null;
  }

  function notifyVerseStart(verseNumber, location){
    if(!playbackListener || typeof playbackListener.onVerseStart !== 'function') return;
    playbackListener.onVerseStart(verseNumber, location || null);
  }

  function notifyVerseSpoken(verseNumber, location){
    if(!playbackListener || typeof playbackListener.onVerseSpoken !== 'function') return;
    playbackListener.onVerseSpoken(verseNumber, location || null);
  }
  function notifyVerseRepeat(verseNumber, location){
    if(!playbackListener || typeof playbackListener.onVerseRepeat !== 'function') return;
    playbackListener.onVerseRepeat(verseNumber, location || null);
  }

  function notifyVerseComplete(location){
    if(!playbackListener || typeof playbackListener.onVerseComplete !== 'function') return;
    playbackListener.onVerseComplete(location || null);
  }

  function notifyPlaybackEnd(){
    if(!playbackListener || typeof playbackListener.onEnd !== 'function') return;
    playbackListener.onEnd();
  }
  function setStatusMessage(message){
    if(state === 'playing') statusMessage = String(message || '');
    else completionMessage = String(message || '');
    updateControls();
  }
  function updateControls(){
    var controls = elements();
    var unavailable = !supported();
    if(controls.play){
      controls.play.disabled = unavailable;
      controls.play.textContent = state === 'playing' ? 'Stop' : 'Play';
      controls.play.setAttribute('aria-label', state === 'playing' ? 'Stop reading aloud' : 'Play reading aloud');
    }
    if(controls.status){
      controls.status.textContent = unavailable ? 'Read aloud is unavailable in this browser.' : state === 'playing' ? statusMessage || 'Reading aloud.' : state === 'paused' ? 'Reading aloud paused.' : completionMessage || 'Ready to read aloud.';
    }
    if(controls.speed) controls.speed.value = String(speed);
    if(controls.voice) controls.voice.disabled = unavailable;
    notifyVoiceDebug();
  }

  function finish(activeSession, message){
    if(activeSession !== session) return;
    state = 'idle';
    verses = [];
    verseIndex = 0;
    pendingNext = false;
    pauseAfterCurrent = false;
    sequenceIsChapter = false;
    repeatState = null;
    currentVerseIndex = -1;
    continueAfterChapter = null;
    completionMessage = message || '';
    updateControls();
    notifyPlaybackEnd();
  }
  function continueAtChapterBoundary(activeSession, activeVerse){
    if(activeSession !== session) return;
    if(!continueAfterChapter){ finish(activeSession); return; }
    var continuation = continueAfterChapter({
      translationId:activeVerse.translationId || null,
      bookId:activeVerse.bookId || null,
      chapter:activeVerse.chapter || null,
      verse:activeVerse.verseNumber
    });
    if(continuation && continuation.chapter){
      setChapter(continuation.chapter, continuation.translationId);
      speakNext(activeSession);
    } else {
      finish(activeSession, continuation && continuation.message);
    }
  }
  function speakNext(activeSession){
    if(activeSession !== session || state !== 'playing') return;
    if(verseIndex >= verses.length){
      if(verses.length) continueAtChapterBoundary(activeSession, verses[verses.length - 1]);
      else finish(activeSession);
      return;
    }
    currentVerseIndex = verseIndex;
    var activeVerse = verses[verseIndex];
    var location = {
      translationId:activeVerse.translationId || null,
      bookId:activeVerse.bookId || null,
      chapter:activeVerse.chapter || null,
      verse:activeVerse.verseNumber
    };
    var utterance = configureUtterance(new window.SpeechSynthesisUtterance(activeVerse.text));
    var ended = false;
    utterance.onstart = function(){
      if(activeSession !== session || ended) return;
      statusMessage = '';
      updateControls();
      notifyVerseSpoken(activeVerse.verseNumber, location);
    };
    utterance.onend = function(){
      if(activeSession !== session || ended) return;
      ended = true;
      verseIndex++;
      notifyVerseComplete(location);
      if(pauseAfterCurrent){
        pauseAfterCurrent = false;
        state = 'paused';
        pendingNext = true;
        window.speechSynthesis.pause();
        updateControls();
        return;
      }
      if(state === 'paused'){
        pendingNext = true;
        return;
      }
      if(verseIndex >= verses.length){
        continueAtChapterBoundary(activeSession, activeVerse);
        return;
      }
      speakNext(activeSession);
    };
    utterance.onerror = function(){
      if(activeSession !== session || ended) return;
      ended = true;
      finish(activeSession);
    };
    notifyVerseStart(activeVerse.verseNumber, location);
    window.speechSynthesis.speak(utterance);
  }
  function setChapter(chapter, translationId){
    verses = chapter.verses.map(function(verse, index){
      return {
        text:String(verse).trim(), verseNumber:index + 1,
        translationId:translationId || chapter.translationId || null,
        bookId:chapter.bookId || null, chapter:chapter.chapter || null
      };
    }).filter(function(verse){ return Boolean(verse.text); });
    verseIndex = 0;
    currentVerseIndex = -1;
  }
  function playChapter(chapter, startVerse, pauseAfterFirst, options){
    if(!supported() || !chapter || !Array.isArray(chapter.verses)){
      updateControls();
      return;
    }
    var wasPaused = state === 'paused';
    session++;
    window.speechSynthesis.cancel();
    if(wasPaused) window.speechSynthesis.resume();
    setChapter(chapter, options && options.translationId);
    var startIndex = verses.findIndex(function(verse){ return verse.verseNumber >= startVerse; });
    verseIndex = startIndex < 0 ? verses.length : startIndex;
    pendingNext = false;
    pauseAfterCurrent = Boolean(pauseAfterFirst);
    repeatState = null;
    currentVerseIndex = -1;
    sequenceIsChapter = true;
    continueAfterChapter = options && typeof options.continueAfterChapter === 'function' ? options.continueAfterChapter : null;
    completionMessage = '';
    statusMessage = '';
    state = verses.length ? 'playing' : 'idle';
    updateControls();
    if(verses.length) speakNext(session);
    else notifyPlaybackEnd();
  }
  function playVerse(text, verseNumber, location){
    if(!supported() || !String(text || '').trim()){
      updateControls();
      return;
    }
    var wasPaused = state === 'paused';
    session++;
    window.speechSynthesis.cancel();
    if(wasPaused) window.speechSynthesis.resume();
    verses = [{
      text:String(text).trim(),
      verseNumber:Number.isInteger(Number(verseNumber)) && Number(verseNumber) > 0 ? Number(verseNumber) : null,
      translationId:location && location.translationId || null,
      bookId:location && location.bookId || null,
      chapter:location && location.chapter || null
    }];
    verseIndex = 0;
    pendingNext = false;
    pauseAfterCurrent = false;
    repeatState = null;
    currentVerseIndex = -1;
    sequenceIsChapter = false;
    continueAfterChapter = null;
    completionMessage = '';
    statusMessage = '';
    state = 'playing';
    updateControls();
    speakNext(session);
  }
  function speakRepeat(activeSession, detour){
    if(activeSession !== session || repeatState !== detour) return;
    var activeVerse = verses[detour.repeatVerseIndex];
    var utterance = configureUtterance(new window.SpeechSynthesisUtterance(activeVerse.text));
    var ended = false;
    currentVerseIndex = detour.repeatVerseIndex;
    utterance.onstart = function(){
      if(activeSession === session && repeatState === detour && !ended){
        statusMessage = '';
        updateControls();
        notifyVerseRepeat(activeVerse.verseNumber, {
          translationId:activeVerse.translationId || null, bookId:activeVerse.bookId || null,
          chapter:activeVerse.chapter || null, verse:activeVerse.verseNumber
        });
      }
    };
    utterance.onend = function(){
      if(activeSession !== session || repeatState !== detour || ended) return;
      ended = true;
      repeatState = null;
      verseIndex = detour.continuationVerseIndex;
      if(detour.wasPausedBeforeRepeat || state === 'paused'){
        state = 'paused';
        pendingNext = true;
        window.speechSynthesis.pause();
        updateControls();
      } else if(verseIndex >= verses.length){
        continueAtChapterBoundary(activeSession, activeVerse);
      } else {
        state = 'playing';
        pendingNext = false;
        speakNext(activeSession);
      }
    };
    utterance.onerror = function(){
      if(activeSession === session && repeatState === detour) finish(activeSession);
    };
    notifyVerseStart(activeVerse.verseNumber, {
      translationId:activeVerse.translationId || null, bookId:activeVerse.bookId || null,
      chapter:activeVerse.chapter || null, verse:activeVerse.verseNumber
    });
    window.speechSynthesis.speak(utterance);
  }
  function repeatVerse(verseNumber){
    if(!supported() || !sequenceIsChapter || state === 'idle') return false;
    var repeatIndex = verses.findIndex(function(verse){ return verse.verseNumber === verseNumber; });
    if(repeatIndex < 0) return false;
    var wasPaused = state === 'paused' || Boolean(repeatState && repeatState.wasPausedBeforeRepeat);
    var continuationVerseIndex = repeatState
      ? repeatState.continuationVerseIndex
      : pendingNext
        ? verseIndex
        : Math.max(verseIndex, currentVerseIndex + 1);
    session++;
    window.speechSynthesis.cancel();
    if(wasPaused) window.speechSynthesis.resume();
    var detour = {
      repeatVerseIndex: repeatIndex,
      continuationVerseIndex: continuationVerseIndex,
      wasPausedBeforeRepeat: wasPaused
    };
    repeatState = detour;
    pendingNext = false;
    pauseAfterCurrent = false;
    state = 'playing';
    updateControls();
    speakRepeat(session, detour);
    return true;
  }
  function getPlaybackSnapshot(){
    var nextIndex = repeatState ? repeatState.continuationVerseIndex : pendingNext ? verseIndex : verseIndex + 1;
    return {
      status: state,
      currentVerse: currentVerseIndex >= 0 && verses[currentVerseIndex] ? verses[currentVerseIndex].verseNumber : null,
      nextVerse: state !== 'idle' && verses[nextIndex] ? verses[nextIndex].verseNumber : null,
      repeatActive: Boolean(repeatState),
      repeatVerse: repeatState ? verses[repeatState.repeatVerseIndex].verseNumber : null,
      repeatNextVerse: repeatState && verses[repeatState.continuationVerseIndex] ? verses[repeatState.continuationVerseIndex].verseNumber : null,
      wasPausedBeforeRepeat: repeatState ? repeatState.wasPausedBeforeRepeat : null,
      pendingNextWhilePaused: pendingNext
    };
  }
  function setSpeed(value){
    var nextSpeed = Number(value);
    if(SPEEDS.indexOf(nextSpeed) < 0) return;
    speed = nextSpeed;
    UserData.speechSpeed.save(speed);
    updateControls();
  }

  function setVoice(name){
    if(name !== 'male' && name !== 'female') return;
    voicePreference = name;
    UserData.speechVoice.save(voicePreference);
    populateVoiceSelector();
    notifyVoiceDebug();
  }

  function pauseResume(){
    if(!supported()) return;
    if(state === 'playing'){
      state = 'paused';
      window.speechSynthesis.pause();
    } else if(state === 'paused'){
      state = 'playing';
      if(repeatState) repeatState.wasPausedBeforeRepeat = false;
      pauseAfterCurrent = false;
      window.speechSynthesis.resume();
      if(pendingNext){
        pendingNext = false;
        speakNext(session);
      }
    }
    updateControls();
  }

  function stop(){
    session++;
    if(supported()) window.speechSynthesis.cancel();
    state = 'idle';
    verses = [];
    verseIndex = 0;
    pendingNext = false;
    pauseAfterCurrent = false;
    sequenceIsChapter = false;
    repeatState = null;
    currentVerseIndex = -1;
    continueAfterChapter = null;
    completionMessage = 'Stopped. Press Play to continue reading.';
    statusMessage = '';
    updateControls();
    notifyPlaybackEnd();
  }
  if(typeof window !== 'undefined' && window.speechSynthesis && typeof window.speechSynthesis.addEventListener === 'function'){
    window.speechSynthesis.addEventListener('voiceschanged', refreshVoices);
  }
  refreshVoices();
  return {
    playChapter: playChapter,
    playVerse: playVerse,
    repeatVerse: repeatVerse,
    getPlaybackSnapshot: getPlaybackSnapshot,
    pauseResume: pauseResume,
    stop: stop,
    setSpeed: setSpeed,
    setVoice: setVoice,
    setPlaybackListener: setPlaybackListener,
    setStatusMessage: setStatusMessage,
    getSpeed: function(){ return speed; },
    getVoice: function(){ return selectedVoice(); },
    getResolvedVoiceInfo: getResolvedVoiceInfo,
    getVoiceDiagnostics: getVoiceDiagnostics,
    testVoiceProfile: testVoiceProfile,
    getSpeedOptions: function(){ return SPEEDS.slice(); },
    refreshVoices: refreshVoices,
    updateControls: updateControls,
    getState: function(){ return state; }
  };
}());
