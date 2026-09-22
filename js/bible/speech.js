/* ===== SCRIPTURE READ ALOUD ===== */
var BibleSpeech = (function createBibleSpeech(){
  var SPEEDS = [0.5, 0.75, 1, 1.25, 1.5, 1.75, 2, 2.25, 2.5];
  var state = 'idle';
  var verses = [];
  var verseIndex = 0;
  var pendingNext = false;
  var pauseAfterCurrent = false;
  var sequenceIsChapter = false;
  var session = 0;
  var speed = readSpeedPreference();
  var voiceName = readVoicePreference();
  var playbackListener = null;

  function supported(){
    return typeof window !== 'undefined' && typeof window.speechSynthesis !== 'undefined' && typeof window.SpeechSynthesisUtterance !== 'undefined';
  }

  function elements(){
    return {
      play: document.getElementById('readAloudPlay'),
      pause: document.getElementById('readAloudPause'),
      stop: document.getElementById('readAloudStop'),
      status: document.getElementById('readAloudStatus'),
      voice: document.getElementById('readAloudVoice'),
      speed: document.getElementById('readAloudSpeed')
    };
  }

  function readSpeedPreference(){
    return UserData.speechSpeed.load();
  }

  function readVoicePreference(){
    return UserData.speechVoice.load();
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
    var genderPatterns = [
      /female|woman|girl|samantha|karen|victoria|zira|hazel|susan|ava|allison|moira|fiona/i,
      /male|man|boy|daniel|david|alex|fred|george|james|tom|arthur|oliver/i
    ];
    genderPatterns.forEach(function(pattern){
      available.filter(function(voice){ return pattern.test(voice.name); }).slice(0, 3).forEach(function(voice){
        if(selected.indexOf(voice) < 0) selected.push(voice);
      });
    });
    available.forEach(function(voice){
      if(selected.length < 6 && selected.indexOf(voice) < 0) selected.push(voice);
    });
    return selected.slice(0, 6);
  }

  function populateVoiceSelector(){
    var select = elements().voice;
    if(!select) return;
    var available = curatedVoices();
    select.innerHTML = '<option value="">Automatic</option>';
    available.forEach(function(voice){
      var option = document.createElement('option');
      option.value = voice.name;
      option.textContent = formatVoiceDisplayName(voice.name);
      select.appendChild(option);
    });
    select.value = available.some(function(voice){ return voice.name === voiceName; }) ? voiceName : '';
  }

  function formatVoiceDisplayName(name){
    return String(name || '').replace(/^Microsoft\s+/i, '').trim();
  }

  function selectedVoice(){
    return voices().find(function(voice){ return voice.name === voiceName; }) || null;
  }

  function configureUtterance(utterance){
    utterance.rate = speed;
    var voice = selectedVoice();
    if(voice) utterance.voice = voice;
    return utterance;
  }

  function setPlaybackListener(listener){
    playbackListener = listener && typeof listener === 'object' ? listener : null;
  }

  function notifyVerseStart(verseNumber){
    if(!playbackListener || typeof playbackListener.onVerseStart !== 'function') return;
    playbackListener.onVerseStart(verseNumber);
  }

  function notifyVerseSpoken(verseNumber){
    if(!playbackListener || typeof playbackListener.onVerseSpoken !== 'function') return;
    playbackListener.onVerseSpoken(verseNumber);
  }

  function notifyPlaybackEnd(){
    if(!playbackListener || typeof playbackListener.onEnd !== 'function') return;
    playbackListener.onEnd();
  }
  function updateControls(){
    var controls = elements();
    var unavailable = !supported();
    if(controls.play) controls.play.disabled = unavailable || state === 'playing';
    if(controls.pause){
      controls.pause.disabled = unavailable || (state !== 'playing' && state !== 'paused');
      controls.pause.textContent = state === 'paused' ? 'Resume' : 'Pause';
      controls.pause.setAttribute('aria-label', state === 'paused' ? 'Resume reading aloud' : 'Pause reading aloud');
    }
    if(controls.stop) controls.stop.disabled = unavailable || (state !== 'playing' && state !== 'paused');
    if(controls.status){
      controls.status.textContent = unavailable ? 'Read aloud is unavailable in this browser.' : state === 'playing' ? 'Reading aloud.' : state === 'paused' ? 'Reading aloud paused.' : 'Ready to read aloud.';
    }
    if(controls.speed) controls.speed.value = String(speed);
    if(controls.voice) controls.voice.disabled = unavailable;
  }

  function finish(activeSession){
    if(activeSession !== session) return;
    state = 'idle';
    verses = [];
    verseIndex = 0;
    pendingNext = false;
    pauseAfterCurrent = false;
    sequenceIsChapter = false;
    updateControls();
    notifyPlaybackEnd();
  }
  function speakNext(activeSession){
    if(activeSession !== session || state !== 'playing') return;
    if(verseIndex >= verses.length){
      finish(activeSession);
      return;
    }
    var activeVerse = verses[verseIndex];
    var utterance = configureUtterance(new window.SpeechSynthesisUtterance(activeVerse.text));
    var ended = false;
    utterance.onstart = function(){
      if(activeSession !== session) return;
      notifyVerseSpoken(activeVerse.verseNumber);
    };
    utterance.onend = function(){
      if(activeSession !== session || ended) return;
      ended = true;
      verseIndex++;
      if(pauseAfterCurrent){
        pauseAfterCurrent = false;
        if(verseIndex >= verses.length){
          finish(activeSession);
          return;
        }
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
      speakNext(activeSession);
    };
    utterance.onerror = function(){
      if(activeSession !== session) return;
      finish(activeSession);
    };
    notifyVerseStart(activeVerse.verseNumber);
    window.speechSynthesis.speak(utterance);
  }
  function playChapter(chapter, startVerse, pauseAfterFirst){
    if(!supported() || !chapter || !Array.isArray(chapter.verses)){
      updateControls();
      return;
    }
    var wasPaused = state === 'paused';
    session++;
    window.speechSynthesis.cancel();
    if(wasPaused) window.speechSynthesis.resume();
    verses = chapter.verses.map(function(verse, index){
      return {text:String(verse).trim(), verseNumber:index + 1};
    }).filter(function(verse){ return Boolean(verse.text); });
    var startIndex = verses.findIndex(function(verse){ return verse.verseNumber === startVerse; });
    verseIndex = startIndex < 0 ? 0 : startIndex;
    pendingNext = false;
    pauseAfterCurrent = Boolean(pauseAfterFirst);
    sequenceIsChapter = true;
    state = verses.length ? 'playing' : 'idle';
    updateControls();
    if(verses.length) speakNext(session);
    else notifyPlaybackEnd();
  }
  function playVerse(text, verseNumber){
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
      verseNumber:Number.isInteger(Number(verseNumber)) && Number(verseNumber) > 0 ? Number(verseNumber) : null
    }];
    verseIndex = 0;
    pendingNext = false;
    pauseAfterCurrent = false;
    sequenceIsChapter = false;
    state = 'playing';
    updateControls();
    speakNext(session);
  }
  function repeatVerse(verseNumber){
    if(!supported() || !sequenceIsChapter || state === 'idle') return false;
    var repeatIndex = verses.findIndex(function(verse){ return verse.verseNumber === verseNumber; });
    if(repeatIndex < 0) return false;
    var wasPaused = state === 'paused';
    session++;
    window.speechSynthesis.cancel();
    if(wasPaused) window.speechSynthesis.resume();
    verseIndex = repeatIndex;
    pendingNext = false;
    pauseAfterCurrent = wasPaused;
    state = 'playing';
    updateControls();
    speakNext(session);
    return true;
  }
  function setSpeed(value){
    var nextSpeed = Number(value);
    if(SPEEDS.indexOf(nextSpeed) < 0) return;
    speed = nextSpeed;
    UserData.speechSpeed.save(speed);
    updateControls();
  }

  function setVoice(name){
    var available = curatedVoices();
    if(name && !available.some(function(voice){ return voice.name === name; })) return;
    voiceName = name || '';
    UserData.speechVoice.save(voiceName);
    populateVoiceSelector();
  }

  function pauseResume(){
    if(!supported()) return;
    if(state === 'playing'){
      state = 'paused';
      window.speechSynthesis.pause();
    } else if(state === 'paused'){
      state = 'playing';
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
    pauseResume: pauseResume,
    stop: stop,
    setSpeed: setSpeed,
    setVoice: setVoice,
    setPlaybackListener: setPlaybackListener,
    getSpeed: function(){ return speed; },
    getVoice: function(){ return selectedVoice(); },
    getSpeedOptions: function(){ return SPEEDS.slice(); },
    refreshVoices: populateVoiceSelector,
    updateControls: updateControls,
    getState: function(){ return state; }
  };
}());