/* ===== SCRIPTURE READ ALOUD ===== */
var BibleSpeech = (function createBibleSpeech(){
  var SPEEDS = [0.5, 0.75, 1, 1.25, 1.5, 1.75, 2, 2.25, 2.5];
  var state = 'idle';
  var PROFILES = Object.freeze({
    male:Object.freeze({id:'male', displayName:'Natural Male', gender:'male', locale:'en-US', provider:'google-neural2', providerVoiceId:'en-US-Neural2-D', fallbackGender:'male', defaultRate:1}),
    female:Object.freeze({id:'female', displayName:'Natural Female', gender:'female', locale:'en-US', provider:'google-neural2', providerVoiceId:'en-US-Neural2-F', fallbackGender:'female', defaultRate:1})
  });
  var actualPlayback = null;
  var lastResult = null;
  var utteranceStarted = false;
  var playbackAttempt = 0;
  var announcementKey = '';
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

  function localSupported(){
    return typeof window !== 'undefined' && typeof window.speechSynthesis !== 'undefined' && typeof window.SpeechSynthesisUtterance !== 'undefined';
  }
  function cloudSupported(){
    return typeof BibleCloudTTS !== 'undefined' && BibleCloudTTS.available();
  }
  function supported(){ return localSupported() || cloudSupported(); }
  function cancelSpeech(){
    if(cloudSupported()) BibleCloudTTS.cancel();
    if(localSupported()) window.speechSynthesis.cancel();
  }
  function pauseSpeech(){
    if(cloudSupported()) BibleCloudTTS.pause();
    if(localSupported()) window.speechSynthesis.pause();
  }
  function resumeSpeech(){
    if(cloudSupported()) BibleCloudTTS.resume();
    if(localSupported()) window.speechSynthesis.resume();
  }
  function prepareCloudSpeech(){ if(cloudSupported()) BibleCloudTTS.prepare(); }
  function createUtterance(text){
    var utterance = cloudSupported() ? {text:text} : new window.SpeechSynthesisUtterance(text);
    utterance.profileId = voicePreference;
    utterance.playbackRate = speed;
    return utterance;
  }
  function speakUtterance(utterance){
    var attempt = ++playbackAttempt, activeSession = session;
    var profile = PROFILES[utterance.profileId], rate = utterance.playbackRate;
    var onstart = utterance.onstart;
    utteranceStarted = false;
    if(state !== 'paused') state = 'preparing';
    if(!announcementKey || actualPlayback && actualPlayback.profileId !== profile.id) statusMessage = 'Preparing ' + profile.displayName + '…';
    updateControls();
    function current(){ return activeSession === session && attempt === playbackAttempt; }
    function started(){
      if(!current()) return;
      utteranceStarted = true;
      if(state !== 'paused') state = 'playing';
      var key = profile.id + ':' + actualPlayback.provider + ':' + (actualPlayback.fallbackReason || '');
      if(key !== announcementKey){
        announcementKey = key;
        statusMessage = actualPlayback.provider === 'cloud' ? 'Playing ' + profile.displayName + '.' :
          profile.displayName + ' unavailable' + (actualPlayback.fallbackReason === 'rate' ? ' at this speed' : '') + '. Using ' +
          (actualPlayback.genderVerified ? 'a same-gender device voice.' : 'a device voice; gender unverified.');
      }
      updateControls();
      onstart();
    }
    function speakLocal(reason){
      if(!current()) return;
      var voice = selectedVoice(profile.id);
      // An empty inventory can still have a device default. Never knowingly choose the opposite gender.
      if(!localSupported() || !voice && voices().length){ actualPlayback = {profileId:profile.id,provider:null,voiceName:null,genderVerified:false,fallbackReason:'native-unavailable'}; utterance.onerror(); return; }
      actualPlayback = {profileId:profile.id, provider:'native', voiceName:voice ? voice.name : null,
        locale:voice ? voice.lang : 'en', genderVerified:voice ? nativeGender(voice) === profile.gender : false, fallbackReason:reason};
      var local = configureUtterance(new window.SpeechSynthesisUtterance(utterance.text),profile.id,rate);
      local.onstart = started;
      local.onend = utterance.onend;
      local.onerror = utterance.onerror;
      // Surface fallback even when the native engine never starts, including while paused.
      var fallbackKey = profile.id + ':native:' + reason;
      if(fallbackKey !== announcementKey){
        announcementKey = fallbackKey;
        statusMessage = profile.displayName + ' unavailable' + (reason === 'rate' ? ' at this speed' : '') + '. Using ' +
          (actualPlayback.genderVerified ? 'a same-gender device voice.' : 'a device voice; gender unverified.');
        updateControls();
      }
      window.speechSynthesis.speak(local);
    }
    if(cloudSupported() && navigator.onLine !== false && rate <= 2){
      actualPlayback = {profileId:profile.id, provider:'cloud', voiceName:profile.providerVoiceId,
        locale:profile.locale, genderVerified:true, fallbackReason:null};
      if(BibleCloudTTS.speak(utterance.text, profile.id, rate, {
        onstart:started, onend:utterance.onend, onfallback:function(){ speakLocal('cloud-unavailable'); }
      })) return;
    }
    speakLocal(navigator.onLine === false ? 'offline' : rate > 2 ? 'rate' : 'cloud-unavailable');
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
    if(!localSupported() || typeof window.speechSynthesis.getVoices !== 'function') return [];
    return window.speechSynthesis.getVoices();
  }

  function compareVoiceText(left, right){
    var first = String(left || '').toLowerCase();
    var second = String(right || '').toLowerCase();
    return first < second ? -1 : first > second ? 1 : 0;
  }

  function sortedEnglishVoices(){
    var english = voices().filter(function(voice){ return /^en(?:-|_|$)/i.test(voice.lang); });
    english.sort(function(left, right){
      var localDifference = Number(Boolean(right.localService)) - Number(Boolean(left.localService));
      if(localDifference) return localDifference;
      var localeDifference = Number(/^en[-_]US$/i.test(right.lang)) - Number(/^en[-_]US$/i.test(left.lang));
      if(localeDifference) return localeDifference;
      return compareVoiceText(left.name, right.name) || compareVoiceText(left.lang, right.lang);
    });
    return english;
  }

  function knownVoiceGroup(name){
    if(/\bDavid\b/i.test(name)) return 'david';
    if(/\bZira\b|Google UK English Female/i.test(name)) return 'zira';
    if(/Google UK English Male|\bMark\b|Google U\.?S\.? English/i.test(name)) return 'uk-male';
    return null;
  }

  function isCanonicalVoice(voice, group){
    if(group === 'david') return /\bDavid\b/i.test(voice.name);
    if(group === 'uk-male') return /Google UK English Male/i.test(voice.name);
    if(group === 'zira') return /\bZira\b/i.test(voice.name);
    return false;
  }

  function distinctVoices(){
    var groups = new Map();
    sortedEnglishVoices().forEach(function(voice){
      if(/^(?:Automatic|Adult Male|Adult Female|Child Male|Child Female)$/i.test(voice.name)) return;
      if(/Google UK English Male/i.test(voice.name)) return;
      // These aliases were heard as the same base voice on the target phone.
      // A matching voiceURI also collapses aliases on other devices.
      var group = knownVoiceGroup(voice.name) ||
        (voice.voiceURI ? 'uri:' + voice.voiceURI : 'name:' + voice.name.toLowerCase());
      var current = groups.get(group);
      if(!current || (!isCanonicalVoice(current, group) && isCanonicalVoice(voice, group))) groups.set(group, voice);
    });
    var ordered = ['david', 'zira', 'uk-male'].filter(function(group){ return groups.has(group); })
      .map(function(group){ return groups.get(group); });
    groups.forEach(function(voice, group){ if(['david', 'zira', 'uk-male'].indexOf(group) < 0) ordered.push(voice); });
    var usedNames = new Set();
    var usedUris = new Set();
    return ordered.filter(function(voice){
      if(usedNames.has(voice.name) || (voice.voiceURI && usedUris.has(voice.voiceURI))) return false;
      usedNames.add(voice.name);
      if(voice.voiceURI) usedUris.add(voice.voiceURI);
      return true;
    });
  }

  function nativeGender(voice){
    var name = voice.name;
    if(/\b(?:Zira|Samantha)\b|\bFemale\b/i.test(name)) return 'female';
    if(/\b(?:David|Mark)\b|\bMale\b/i.test(name)) return 'male';
    return null;
  }
  function selectedVoice(profileId){
    var gender = profileId || voicePreference;
    var available = distinctVoices().filter(function(voice){ return navigator.onLine !== false || voice.localService; });
    return available.find(function(voice){ return voice.localService && nativeGender(voice) === gender; }) ||
      available.find(function(voice){ return nativeGender(voice) === gender; }) ||
      available.find(function(voice){ return nativeGender(voice) === null; }) || null;
  }
  function populateVoiceSelector(){
    var select = elements().voice;
    if(!select) return;
    select.textContent = '';
    ['male','female'].forEach(function(id){
      var option = document.createElement('option');
      option.value = id;
      option.textContent = PROFILES[id].displayName;
      select.appendChild(option);
    });
    select.value = voicePreference;
    select.disabled = !supported();
  }
  function getVoiceProfiles(){
    return ['male','female'].map(function(id){ return Object.assign({},PROFILES[id],{
      availability:{cloud:cloudSupported() && navigator.onLine !== false, native:localSupported() && Boolean(selectedVoice(id))}
    }); });
  }
  function getResolvedVoiceInfo(){
    var voice = selectedVoice();
    return Object.assign({preference:voicePreference, voiceName:voice ? voice.name : null,
      lang:voice ? voice.lang : null, pitch:1, result:lastResult},actualPlayback || {},{preference:voicePreference});
  }
  function configureUtterance(utterance,profileId,rate){
    utterance.rate = rate === undefined ? speed : rate;
    utterance.pitch = 1;
    var voice = selectedVoice(profileId);
    if(voice) utterance.voice = voice;
    return utterance;
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
    if(state === 'playing' || state === 'preparing') statusMessage = String(message || '');
    else completionMessage = String(message || '');
    updateControls();
  }
  function updateControls(){
    var controls = elements();
    var unavailable = !supported();
    var active = state === 'playing' || state === 'preparing';
    if(controls.play){
      controls.play.disabled = unavailable;
      controls.play.textContent = active ? 'Stop' : 'Play';
      controls.play.setAttribute('aria-label', active ? 'Stop reading aloud' : 'Play reading aloud');
    }
    if(controls.status){
      var message = unavailable ? 'Read aloud is unavailable in this browser.' : active ? statusMessage || 'Preparing ' + PROFILES[voicePreference].displayName + '…' : state === 'paused' ? 'Reading aloud paused.' : completionMessage || 'Ready to read aloud.';
      if(controls.status.textContent !== message) controls.status.textContent = message;
    }
    if(controls.speed) controls.speed.value = String(speed);
    if(controls.voice) controls.voice.disabled = unavailable;
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
    if(activeSession !== session || state === 'paused' || state === 'idle') return;
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
    var utterance = createUtterance(activeVerse.text);
    var ended = false;
    utterance.onstart = function(){
      if(activeSession !== session || ended) return;
      updateControls();
      notifyVerseSpoken(activeVerse.verseNumber, location);
    };
    utterance.onend = function(){
      if(activeSession !== session || ended) return;
      ended = true;
      if(state === 'preparing') state = 'playing';
      verseIndex++;
      notifyVerseComplete(location);
      if(pauseAfterCurrent){
        pauseAfterCurrent = false;
        state = 'paused';
        pendingNext = true;
        pauseSpeech();
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
      lastResult = 'failed';
      finish(activeSession, 'Playback unavailable.');
    };
    notifyVerseStart(activeVerse.verseNumber, location);
    speakUtterance(utterance);
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
    cancelSpeech();
    if(wasPaused) resumeSpeech();
    prepareCloudSpeech();
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
    announcementKey = '';
    lastResult = null;
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
    cancelSpeech();
    if(wasPaused) resumeSpeech();
    prepareCloudSpeech();
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
    announcementKey = '';
    lastResult = null;
    state = 'playing';
    updateControls();
    speakNext(session);
  }
  function speakRepeat(activeSession, detour){
    if(activeSession !== session || repeatState !== detour) return;
    var activeVerse = verses[detour.repeatVerseIndex];
    var utterance = createUtterance(activeVerse.text);
    var ended = false;
    currentVerseIndex = detour.repeatVerseIndex;
    utterance.onstart = function(){
      if(activeSession === session && repeatState === detour && !ended){
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
        pauseSpeech();
        updateControls();
      } else if(verseIndex >= verses.length){
        continueAtChapterBoundary(activeSession, verses[verses.length - 1]);
      } else {
        state = 'playing';
        pendingNext = false;
        speakNext(activeSession);
      }
    };
    utterance.onerror = function(){
      if(activeSession !== session || repeatState !== detour || ended) return;
      ended = true;
      lastResult = 'failed';
      finish(activeSession, 'Playback unavailable.');
    };
    notifyVerseStart(activeVerse.verseNumber, {
      translationId:activeVerse.translationId || null, bookId:activeVerse.bookId || null,
      chapter:activeVerse.chapter || null, verse:activeVerse.verseNumber
    });
    speakUtterance(utterance);
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
    cancelSpeech();
    if(wasPaused) resumeSpeech();
    prepareCloudSpeech();
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
      isChapter: sequenceIsChapter,
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
    if(!Object.prototype.hasOwnProperty.call(PROFILES,name)) return;
    voicePreference = name;
    UserData.speechVoice.save(voicePreference);
    populateVoiceSelector();
  }

  function pauseResume(){
    if(!supported()) return;
    if(state === 'playing' || state === 'preparing'){
      state = 'paused';
      pauseSpeech();
    } else if(state === 'paused'){
      state = utteranceStarted || pendingNext ? 'playing' : 'preparing';
      if(repeatState) repeatState.wasPausedBeforeRepeat = false;
      pauseAfterCurrent = false;
      resumeSpeech();
      if(pendingNext){
        pendingNext = false;
        speakNext(session);
      }
    }
    updateControls();
  }

  function beginPreparation(){
    session++;
    cancelSpeech();
    state = 'preparing';
    actualPlayback = null;
    lastResult = null;
    statusMessage = 'Preparing ' + PROFILES[voicePreference].displayName + '…';
    updateControls();
  }
  function failPreparation(){ lastResult = 'failed'; finish(session,'Playback unavailable.'); }
  function stop(){
    session++;
    cancelSpeech();
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
    window.speechSynthesis.addEventListener('voiceschanged', populateVoiceSelector);
  }
  updateControls();
  populateVoiceSelector();
  return {
    prepare: prepareCloudSpeech,
    beginPreparation: beginPreparation,
    failPreparation: failPreparation,
    getVoiceProfiles: getVoiceProfiles,
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
    getSpeedOptions: function(){ return SPEEDS.slice(); },
    refreshVoices: populateVoiceSelector,
    updateControls: updateControls,
    getState: function(){ return state; }
  };
}());
