/* ===== SCRIPTURE READ ALOUD ===== */
var BibleSpeech = (function createBibleSpeech(){
  var SPEEDS = [0.5, 0.75, 1, 1.25, 1.5, 1.75, 2, 2.25, 2.5];
  var VOICE_PROFILES = [
    {value:'auto', label:'Automatic', pitch:1},
    {value:'adult-male', label:'Adult Male', pitch:0.95},
    {value:'adult-female', label:'Adult Female', pitch:1.05},
    {value:'child-male', label:'Child Male', pitch:1.23},
    {value:'child-female', label:'Child Female', pitch:1.3}
  ];
  // Voice metadata has no dependable age or gender. These small name hints only
  // choose a likely base voice; pitch supplies the profile's audible character.
  var MALE_VOICE_HINT = /\b(?:male|aaron|alex|arthur|daniel|david|fred|george|guy|james|mark|oliver|ryan|tom)\b/i;
  var FEMALE_VOICE_HINT = /\b(?:female|allison|aria|ava|fiona|hazel|jenny|karen|moira|samantha|susan|tessa|victoria|zira)\b/i;
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
    return UserData.speechVoice.load() || 'auto';
  }

  function voices(){
    if(!supported() || typeof window.speechSynthesis.getVoices !== 'function') return [];
    return window.speechSynthesis.getVoices();
  }

  function curatedVoices(){
    var english = voices().filter(function(voice){ return /^en(?:-|_|$)/i.test(voice.lang); });
    var local = english.filter(function(voice){ return voice.localService; });
    var available = local.concat(english.filter(function(voice){ return !voice.localService; }));
    var selected = [];
    var genderPatterns = [FEMALE_VOICE_HINT, MALE_VOICE_HINT];
    genderPatterns.forEach(function(pattern){
      available.filter(function(voice){ return pattern.test(voice.name); }).slice(0, 3).forEach(function(voice){
        if(!selected.some(function(item){ return item.name === voice.name; })) selected.push(voice);
      });
    });
    available.forEach(function(voice){
      if(selected.length < 6 && !selected.some(function(item){ return item.name === voice.name; })) selected.push(voice);
    });
    return selected.slice(0, 6);
  }

  function populateVoiceSelector(){
    var select = elements().voice;
    if(!select) return;
    var available = curatedVoices();
    select.textContent = '';
    VOICE_PROFILES.forEach(function(profile){
      var option = document.createElement('option');
      option.value = profile.value;
      option.textContent = profile.label;
      select.appendChild(option);
    });
    var deviceGroup = document.createElement('optgroup');
    deviceGroup.label = 'Device voices';
    available.forEach(function(voice){
      var option = document.createElement('option');
      option.value = voice.name;
      option.textContent = formatVoiceDisplayName(voice.name);
      deviceGroup.appendChild(option);
    });
    if(!VOICE_PROFILES.some(function(profile){ return profile.value === voicePreference; }) &&
      !available.some(function(voice){ return voice.name === voicePreference; })){
      var savedVoice = voices().find(function(voice){ return voice.name === voicePreference; });
      var savedOption = document.createElement('option');
      savedOption.value = voicePreference;
      savedOption.textContent = formatVoiceDisplayName(voicePreference) + (savedVoice ? '' : ' (unavailable)');
      deviceGroup.appendChild(savedOption);
    }
    if(deviceGroup.children.length) select.appendChild(deviceGroup);
    select.value = voicePreference;
  }

  function formatVoiceDisplayName(name){
    return String(name || '').replace(/^Microsoft\s+/i, '').trim();
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
    return english.filter(function(voice, index){
      return english.findIndex(function(candidate){ return candidate.name === voice.name; }) === index;
    });
  }

  function profileBaseVoices(){
    var english = sortedEnglishVoices();
    var maleHints = english.filter(function(voice){ return MALE_VOICE_HINT.test(voice.name); });
    var femaleHints = english.filter(function(voice){ return FEMALE_VOICE_HINT.test(voice.name); });
    var femaleFirst = femaleHints[0];
    // Reserve a hinted voice for each adult family. Generic inventories use
    // separate sorted candidates, regardless of the order from getVoices().
    var adultMale = maleHints[0] || english.find(function(voice){
      return !femaleFirst || voice.name !== femaleFirst.name;
    }) || english[0] || null;
    var adultFemale = femaleHints.find(function(voice){
      return !adultMale || voice.name !== adultMale.name;
    }) || english.find(function(voice){
      return !adultMale || voice.name !== adultMale.name;
    }) || english[0] || null;
    function unused(voice){
      return (!adultMale || voice.name !== adultMale.name) &&
        (!adultFemale || voice.name !== adultFemale.name);
    }
    var childMale = maleHints.find(unused) || maleHints[0] || english.find(unused) || adultMale;
    var childFemale = femaleHints.find(function(voice){
      return unused(voice) && (!childMale || voice.name !== childMale.name);
    }) || femaleHints[0] || english.find(function(voice){
      return unused(voice) && (!childMale || voice.name !== childMale.name);
    }) || adultFemale;
    return {
      'adult-male':adultMale, 'adult-female':adultFemale,
      'child-male':childMale, 'child-female':childFemale
    };
  }

  function selectedVoice(){
    if(voicePreference === 'auto') return null;
    var profile = VOICE_PROFILES.find(function(item){ return item.value === voicePreference; });
    if(!profile) return voices().find(function(voice){ return voice.name === voicePreference; }) || null;
    return profileBaseVoices()[profile.value];
  }

  function getResolvedVoiceInfo(){
    var profile = VOICE_PROFILES.find(function(item){ return item.value === voicePreference; });
    var voice = selectedVoice();
    return {
      preference:voicePreference,
      voiceName:voice ? voice.name : null,
      lang:voice ? voice.lang : null,
      pitch:profile ? profile.pitch : 1
    };
  }

  function configureUtterance(utterance){
    utterance.rate = speed;
    var profile = VOICE_PROFILES.find(function(item){ return item.value === voicePreference; });
    utterance.pitch = profile ? profile.pitch : 1;
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
    var next = name || 'auto';
    if(!VOICE_PROFILES.some(function(profile){ return profile.value === next; }) &&
      !curatedVoices().some(function(voice){ return voice.name === next; }) && next !== voicePreference) return;
    voicePreference = next;
    UserData.speechVoice.save(voicePreference);
    populateVoiceSelector();
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
