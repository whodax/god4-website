/* ===== SCRIPTURE READ ALOUD ===== */
var BibleSpeech = (function createBibleSpeech(){
  var SPEEDS = [0.5, 0.75, 1, 1.25, 1.5, 1.75, 2, 2.25, 2.5];
  var SPEED_STORAGE_KEY = 'god4.speech.speed';
  var VOICE_STORAGE_KEY = 'god4.speech.voice';
  var state = 'idle';
  var verses = [];
  var verseIndex = 0;
  var session = 0;
  var speed = readSpeedPreference();
  var voiceName = readVoicePreference();

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
    var stored = Number(localStorage.getItem(SPEED_STORAGE_KEY));
    return SPEEDS.indexOf(stored) >= 0 ? stored : 1;
  }

  function readVoicePreference(){
    return localStorage.getItem(VOICE_STORAGE_KEY) || '';
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
      option.textContent = voice.name;
      select.appendChild(option);
    });
    select.value = available.some(function(voice){ return voice.name === voiceName; }) ? voiceName : '';
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

  function updateControls(){
    var controls = elements();
    var unavailable = !supported();
    if(controls.play) controls.play.disabled = unavailable || state === 'playing' || state === 'paused';
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
    updateControls();
  }

  function speakNext(activeSession){
    if(activeSession !== session || state !== 'playing') return;
    if(verseIndex >= verses.length){
      finish(activeSession);
      return;
    }
    var utterance = configureUtterance(new window.SpeechSynthesisUtterance(verses[verseIndex]));
    utterance.onend = function(){
      if(activeSession !== session) return;
      verseIndex++;
      speakNext(activeSession);
    };
    utterance.onerror = function(event){
      if(activeSession !== session || event.error === 'interrupted' || event.error === 'canceled') return;
      finish(activeSession);
    };
    window.speechSynthesis.speak(utterance);
  }

  function playChapter(chapter){
    if(!supported() || !chapter || !Array.isArray(chapter.verses)){
      updateControls();
      return;
    }
    window.speechSynthesis.cancel();
    session++;
    verses = chapter.verses.map(function(verse){ return String(verse).trim(); }).filter(Boolean);
    verseIndex = 0;
    state = verses.length ? 'playing' : 'idle';
    updateControls();
    speakNext(session);
  }

  function playVerse(text){
    if(!supported() || !String(text || '').trim()){
      updateControls();
      return;
    }
    window.speechSynthesis.cancel();
    session++;
    verses = [String(text).trim()];
    verseIndex = 0;
    state = 'playing';
    updateControls();
    speakNext(session);
  }

  function setSpeed(value){
    var nextSpeed = Number(value);
    if(SPEEDS.indexOf(nextSpeed) < 0) return;
    speed = nextSpeed;
    localStorage.setItem(SPEED_STORAGE_KEY, String(speed));
    updateControls();
  }

  function setVoice(name){
    var available = curatedVoices();
    if(name && !available.some(function(voice){ return voice.name === name; })) return;
    voiceName = name || '';
    localStorage.setItem(VOICE_STORAGE_KEY, voiceName);
    populateVoiceSelector();
  }

  function pauseResume(){
    if(!supported()) return;
    if(state === 'playing'){
      window.speechSynthesis.pause();
      state = 'paused';
    } else if(state === 'paused'){
      window.speechSynthesis.resume();
      state = 'playing';
    }
    updateControls();
  }

  function stop(){
    session++;
    if(supported()) window.speechSynthesis.cancel();
    state = 'idle';
    verses = [];
    verseIndex = 0;
    updateControls();
  }

  if(typeof window !== 'undefined' && window.speechSynthesis && typeof window.speechSynthesis.addEventListener === 'function'){
    window.speechSynthesis.addEventListener('voiceschanged', populateVoiceSelector);
  }
  updateControls();
  populateVoiceSelector();
  return {
    playChapter: playChapter,
    playVerse: playVerse,
    pauseResume: pauseResume,
    stop: stop,
    setSpeed: setSpeed,
    setVoice: setVoice,
    getSpeed: function(){ return speed; },
    getVoice: function(){ return selectedVoice(); },
    getSpeedOptions: function(){ return SPEEDS.slice(); },
    refreshVoices: populateVoiceSelector,
    updateControls: updateControls,
    getState: function(){ return state; }
  };
}());