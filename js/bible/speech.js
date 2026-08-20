/* ===== SCRIPTURE READ ALOUD ===== */
var BibleSpeech = (function createBibleSpeech(){
  var state = 'idle';
  var verses = [];
  var verseIndex = 0;
  var session = 0;

  function supported(){
    return typeof window !== 'undefined' && typeof window.speechSynthesis !== 'undefined' && typeof window.SpeechSynthesisUtterance !== 'undefined';
  }

  function elements(){
    return {
      play: document.getElementById('readAloudPlay'),
      pause: document.getElementById('readAloudPause'),
      stop: document.getElementById('readAloudStop'),
      status: document.getElementById('readAloudStatus')
    };
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
    var utterance = new window.SpeechSynthesisUtterance(verses[verseIndex]);
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

  updateControls();
  return {
    playChapter: playChapter,
    pauseResume: pauseResume,
    stop: stop,
    updateControls: updateControls,
    getState: function(){ return state; }
  };
}());