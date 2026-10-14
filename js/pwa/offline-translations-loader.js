/* Immediate modal activation; the management runtime stays shell-precached. */
var OfflineBiblesLoader = (function(){
  'use strict';
  var pending = null, generation = 0;
  var trigger = document.getElementById('offlineBiblesTrigger');
  var dialog = document.getElementById('offlineBiblesDialog');
  var title = document.getElementById('offlineBiblesTitle');
  var close = document.getElementById('offlineBiblesClose');
  var status = document.getElementById('offlineBiblesStatus');
  function runtime(){
    var api = window.OfflineBiblesRuntime;
    return api && api.version === 1 && typeof api.initialize === 'function' &&
      typeof api.openFromTrigger === 'function' ? api : null;
  }
  function ensure(){
    if(!pending){
      pending = Promise.resolve().then(function(){
        if(runtime()) return runtime();
        return new Promise(function(resolve, reject){
          var script = document.createElement('script');
          script.src = '/js/pwa/offline-translations.js';
          function finish(error){
            script.onload = script.onerror = null;
            if(error){ script.remove(); reject(new Error('Offline Bibles unavailable')); }
            else resolve(runtime());
          }
          script.onerror = function(){ finish(true); };
          script.onload = function(){ finish(!runtime()); };
          document.head.appendChild(script);
        });
      }).then(function(api){
        if(api.initialize() !== true) throw new Error('Offline Bibles unavailable');
        return api;
      }).catch(function(error){ pending = null; throw error; });
    }
    return pending;
  }
  function dismiss(){
    generation++;
    if(dialog.open) dialog.close();
  }
  if(trigger && dialog && title && close && status){
    trigger.addEventListener('click', function(){
      if(dialog.open) return;
      var intent = ++generation;
      dialog.setAttribute('aria-busy', 'true');
      status.textContent = 'Loading offline Bible controls.';
      dialog.showModal();
      trigger.setAttribute('aria-expanded', 'true');
      title.focus();
      ensure().then(function(api){
        if(intent !== generation || !dialog.open) return;
        dialog.setAttribute('aria-busy', 'false');
        api.openFromTrigger();
      }).catch(function(){
        if(intent !== generation || !dialog.open) return;
        dialog.setAttribute('aria-busy', 'false');
        status.textContent = 'Offline Bible controls could not be loaded. Close and activate Offline Bibles to try again.';
      });
    });
    close.addEventListener('click', dismiss);
    dialog.addEventListener('cancel', function(event){ event.preventDefault(); dismiss(); });
    dialog.addEventListener('close', function(){
      // A queued close event must not dismiss a newer activation.
      if(dialog.open) return;
      generation++;
      dialog.setAttribute('aria-busy', 'false');
      trigger.setAttribute('aria-expanded', 'false');
      trigger.focus();
    });
  }
  return {ensure:ensure};
}());
