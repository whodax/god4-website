/* Opt-in, one-verse cloud transport. Web Audio keeps the existing strict CSP intact. */
var BibleCloudTTS = (function createCloudSpeech(){
  var enabled = new URLSearchParams(window.location.search).get('cloud-tts') === '1';
  var AudioContextClass = window.AudioContext || window.webkitAudioContext;
  var context = null;
  var active = null;
  var generation = 0;

  function available(){ return enabled && Boolean(AudioContextClass && window.fetch && window.AbortController); }
  function cancel(){
    generation++;
    var previous = active;
    active = null;
    if(!previous) return;
    clearTimeout(previous.timer);
    previous.controller.abort();
    if(previous.source){
      previous.source.onended = null;
      try{ previous.source.stop(); }catch(failure){}
      previous.source.disconnect();
    }
  }
  function fallback(attempt){
    if(active !== attempt) return;
    var callback = attempt.callbacks.onfallback;
    cancel();
    callback();
  }
  function prepare(){
    if(!available()) return;
    try{
      if(!context) context = new AudioContextClass();
      // Invoke resume within the Play gesture, before the asynchronous network request.
      context.resume().catch(function(){ if(active) fallback(active); });
    }catch(failure){ context = null; }
  }
  function started(attempt){
    if(active !== attempt || !attempt.sourceStarted || attempt.paused || attempt.started || context.state !== 'running') return;
    attempt.started = true;
    clearTimeout(attempt.timer);
    attempt.callbacks.onstart();
  }
  function speak(text, voice, rate, callbacks){
    if(!available() || navigator.onLine === false || !context) return false;
    cancel();
    var attempt = {id:generation, controller:new AbortController(), source:null, callbacks:callbacks, paused:false, started:false};
    active = attempt;
    attempt.timer = setTimeout(function(){ fallback(attempt); }, 12000);
    (async function(){
      try{
        var response = await fetch('/api/tts', {method:'POST', credentials:'same-origin', cache:'no-store',
          headers:{'Content-Type':'application/json'}, body:JSON.stringify({text:text, voice:voice, rate:rate}), signal:attempt.controller.signal});
        if(response.status !== 200 || !/^audio\/mpeg(?:;|$)/i.test(response.headers.get('Content-Type') || '')) throw new Error('Cloud audio unavailable');
        var bytes = await response.arrayBuffer();
        if(!bytes.byteLength) throw new Error('Empty audio');
        var buffer = await context.decodeAudioData(bytes);
        if(active !== attempt || attempt.id !== generation) return;
        var source = context.createBufferSource();
        attempt.source = source;
        source.buffer = buffer;
        source.connect(context.destination);
        source.onended = function(){
          if(active !== attempt) return;
          active = null;
          clearTimeout(attempt.timer);
          source.disconnect();
          callbacks.onend();
        };
        if(!attempt.paused){
          await context.resume();
          if(active !== attempt) return;
          if(!attempt.paused && context.state !== 'running') throw new Error('Audio unavailable');
        }
        source.start();
        attempt.sourceStarted = true;
        if(attempt.paused) clearTimeout(attempt.timer);
        started(attempt);
      }catch(failure){ fallback(attempt); }
    }());
    return true;
  }
  function pause(){
    if(active) active.paused = true;
    if(context) context.suspend().catch(function(){ if(active) fallback(active); });
  }
  function resume(){
    if(active) active.paused = false;
    if(active && active.sourceStarted && !active.started){
      var attempt = active;
      attempt.timer = setTimeout(function(){ fallback(attempt); }, 12000);
    }
    if(context) context.resume().then(function(){ if(active) started(active); })
      .catch(function(){ if(active) fallback(active); });
  }
  return {available:available, prepare:prepare, speak:speak, pause:pause, resume:resume, cancel:cancel};
}());
