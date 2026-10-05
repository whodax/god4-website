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
    return cloudSupported() ? {text:text} : configureUtterance(new window.SpeechSynthesisUtterance(text));
  }
  function speakUtterance(utterance){
    function speakLocal(){
      if(!localSupported()){ utterance.onerror(); return; }
      var local = cloudSupported() ? configureUtterance(new window.SpeechSynthesisUtterance(utterance.text)) : utterance;
      local.onstart = utterance.onstart;
      local.onend = utterance.onend;
      local.onerror = utterance.onerror;
      window.speechSynthesis.speak(local);
    }
    if(cloudSupported() && BibleCloudTTS.speak(utterance.text, voicePreference, speed, {
      onstart:utterance.onstart, onend:utterance.onend, onfallback:speakLocal
    })) return;
    speakLocal();
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

  function voiceChoices(){
    var available = distinctVoices();
    if(!available.length) return [];
    var david = available.find(function(voice){ return /\bDavid\b/i.test(voice.name); });
    var zira = available.find(function(voice){ return /\bZira\b/i.test(voice.name); });
    var male = david || available.find(function(voice){ return voice !== zira; }) || available[0];
    var female = zira || available.find(function(voice){ return voice !== male; }) || available[0];
    if(male === female){
      var onlyLabel = zira ? 'female' : david ? 'male' : voicePreference;
      return [{value:onlyLabel, voice:male}];
    }
    return [{value:'male', voice:male}, {value:'female', voice:female}];
  }

  function populateVoiceSelector(){
    var select = elements().voice;
    if(!select) return;
    var choices = voiceChoices();
    // Cloud profiles do not depend on the device's local voice inventory.
    if(cloudSupported()) choices = [{value:'male'}, {value:'female'}];
    select.textContent = '';
    if(!choices.length){
      var placeholder = document.createElement('option');
      placeholder.value = '';
      placeholder.textContent = voices().length ? 'No English voices available' : 'Loading voices…';
      select.appendChild(placeholder);
      select.disabled = true;
      return;
    }
    choices.forEach(function(choice){
      var option = document.createElement('option');
      option.value = choice.value;
      option.textContent = choice.value === 'male' ? 'Male' : 'Female';
      select.appendChild(option);
    });
    select.value = choices.some(function(choice){ return choice.value === voicePreference; }) ? voicePreference : choices[0].value;
    select.disabled = false;
  }

  function selectedVoice(){
    var choices = voiceChoices();
    var choice = choices.find(function(item){ return item.value === voicePreference; }) || choices[0];
    return choice ? choice.voice : null;
  }

  function getResolvedVoiceInfo(){
    var voice = selectedVoice();
    return {
      preference:voicePreference,
      voiceName:voice ? voice.name : null,
      lang:voice ? voice.lang : null,
      pitch:1
    };
  }

  function configureUtterance(utterance){
    utterance.rate = speed;
    utterance.pitch = 1;
    var voice = selectedVoice();
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
    if(controls.voice) controls.voice.disabled = unavailable || (!cloudSupported() && !distinctVoices().length);
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
    var utterance = createUtterance(activeVerse.text);
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
      finish(activeSession);
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
        pauseSpeech();
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
    if(cloudSupported() ? name !== 'male' && name !== 'female' : !voiceChoices().some(function(choice){ return choice.value === name; })) return;
    voicePreference = name;
    UserData.speechVoice.save(voicePreference);
    populateVoiceSelector();
  }

  function pauseResume(){
    if(!supported()) return;
    if(state === 'playing'){
      state = 'paused';
      pauseSpeech();
    } else if(state === 'paused'){
      state = 'playing';
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
