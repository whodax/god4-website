(function(){
  if(new URLSearchParams(location.search).get('narration-debug') !== '1') return;
  const entries = [];
  const version = 'shell57-diag-2';
  let nextUtterance = 0;
  const synth = window.speechSynthesis;
  const voiceInfo = voice => voice && ({
    name:voice.name, id:voice.voiceURI, lang:voice.lang, local:voice.localService, default:voice.default
  });
  const queue = () => synth && ({speaking:synth.speaking, pending:synth.pending, paused:synth.paused});
  function record(event, data){
    entries.push({ms:Math.round(performance.now()),event,data,nativeQueue:queue()});
    if(entries.length > 250) entries.shift();
  }
  window.narrationDiagnostic = record;

  function inventory(){
    record('voice-inventory', {online:navigator.onLine, voices:Array.from(synth?.getVoices?.() || [], voiceInfo)});
  }
  function worker(){
    const controller = navigator.serviceWorker?.controller;
    record('worker-controller', controller ? {state:controller.state} : null);
    if(!controller) return;
    const channel = new MessageChannel();
    channel.port1.onmessage = ({data}) => {
      record('active-shell', data);
      channel.port1.close();
    };
    controller.postMessage({type:'NARRATION_DIAGNOSTIC_SHELL'}, [channel.port2]);
  }
  record('diagnostic', {version, online:navigator.onLine, native:Boolean(synth)});
  inventory();
  worker();
  synth?.addEventListener('voiceschanged',inventory);
  navigator.serviceWorker?.addEventListener('controllerchange',worker);
  ['online','offline'].forEach(type=>addEventListener(type,inventory));

  if(synth) for(const method of ['speak','cancel','pause','resume']){
    const original = synth[method];
    if(typeof original !== 'function') continue;
    try{
      synth[method] = function(utterance){
        const id = method === 'speak' ? ++nextUtterance : null;
        if(id && utterance?.addEventListener){
          for(const type of ['start','boundary','end','error','pause','resume']){
            utterance.addEventListener(type,event=>{
              record('native-'+type,{id,kind:event.name,index:event.charIndex,elapsed:event.elapsedTime,error:event.error,queue:queue()});
            });
          }
        }
        record('native-'+method, {id,queue:queue(),voice:voiceInfo(utterance?.voice),length:utterance?.text?.length,lang:utterance?.lang});
        try{
          const result = original.apply(this,arguments);
          record('native-'+method+'-returned',{id,queue:queue()});
          return result;
        }catch(error){
          record('native-'+method+'-threw',{id,name:error.name});
          throw error;
        }
      };
    }catch(error){ record('native-probe-unavailable',{method,name:error.name}); }
  }

  document.addEventListener('pointerdown',event=>{
    if(!event.target.closest('.reader-toolbar,.reader-show-controls')) return;
    const play = document.getElementById('readAloudPlay');
    const recovery = document.querySelector('.reader-show-controls');
    const hit = event.target.closest('#readAloudPlay,.reader-compact-stop,.reader-show-controls');
    record('reader-pointer', {
      control:hit?.id ? 'play' : hit?.matches('.reader-compact-stop') ? 'stop' : hit ? 'show-controls' : 'other',
      playDisabled:play?.disabled, toolbarInert:play?.closest('.reader-toolbar')?.inert,
      recoveryVisible:Boolean(recovery?.getClientRects().length)
    });
  },true);
  document.addEventListener('click',event=>{
    const target = event.target.closest('#readAloudPlay,.reader-compact-stop');
    if(!target) return;
    const control = target.id ? 'play' : 'stop';
    record('tap',{control,label:target.getAttribute('aria-label') || 'Stop reading aloud',trusted:event.isTrusted,online:navigator.onLine,state:window.BibleSpeech?.getState()});
    queueMicrotask(()=>record('tap-after-dispatch',{control,prevented:event.defaultPrevented,state:window.BibleSpeech?.getState(),queue:queue()}));
  },true);
  document.addEventListener('change',event=>{
    if(event.target.id === 'readAloudVoice') record('voice-selected',event.target.value);
  },true);

  const button = document.createElement('button');
  button.type = 'button';
  button.className = 'narration-diagnostic-trigger';
  button.textContent = 'Narration log';
  const dialog = document.createElement('dialog');
  dialog.className = 'narration-diagnostic-dialog';
  dialog.setAttribute('aria-label','Android narration diagnostic');
  const note = document.createElement('p');
  note.textContent = 'This log stays on this page until you copy it. It includes installed voice identifiers and verse coordinates, with no verse text or saved data.';
  const output = document.createElement('textarea');
  output.readOnly = true;
  output.setAttribute('aria-label','Narration diagnostic log');
  const refresh = document.createElement('button');
  refresh.type = 'button';
  refresh.textContent = 'Refresh log';
  function show(){
    output.value = entries.map(entry=>JSON.stringify(entry)).join('\n');
  }
  refresh.addEventListener('click',show);
  const copy = document.createElement('button');
  copy.type = 'button';
  copy.textContent = 'Copy Diagnostic Report';
  const copyStatus = document.createElement('p');
  copyStatus.setAttribute('role','status');
  copy.addEventListener('click',async()=>{
    show();
    try{
      await navigator.clipboard.writeText(output.value);
      copyStatus.textContent = 'Diagnostic report copied.';
    }catch{
      output.focus();
      output.select();
      if(document.execCommand('copy')){
        copyStatus.textContent = 'Diagnostic report copied.';
      }else{
        copyStatus.textContent = 'Report selected. Touch and hold the text, then choose Copy.';
      }
    }
  });
  const close = document.createElement('button');
  close.type = 'button';
  close.textContent = 'Close';
  close.addEventListener('click',()=>dialog.close());
  const steps = document.createElement('p');
  steps.textContent = 'To test Stop, open Reader Options and tap Stop reading aloud. The main control pauses while playing. After Stop, tap Play reading aloud.';
  dialog.append(note,steps,output,refresh,copy,close,copyStatus);
  button.addEventListener('click',()=>{show();dialog.showModal();});
  document.body.append(button,dialog);
}());
