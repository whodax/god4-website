/* Register the offline shell after the current page has finished loading. */
(function initializePwa(){
  if(!('serviceWorker' in navigator)) return;

  var status = document.getElementById('pwaStatus');
  var message = document.getElementById('pwaStatusMessage');
  var updateButton = document.getElementById('pwaUpdateButton');
  var waitingWorker = null;
  var updateAccepted = false;

  function showStatus(text, canUpdate){
    if(!status || !message || !updateButton) return;
    message.textContent = text;
    updateButton.hidden = !canUpdate;
    status.hidden = false;
  }

  function hideOfflineStatus(){
    if(!status || waitingWorker) return;
    status.hidden = true;
    if(message) message.textContent = '';
  }

  function showWaiting(worker){
    waitingWorker = worker;
    showStatus('A GOD4.us update is ready.', true);
  }

  function watchRegistration(registration){
    if(registration.waiting && navigator.serviceWorker.controller) showWaiting(registration.waiting);
    registration.addEventListener('updatefound', function(){
      var installing = registration.installing;
      if(!installing) return;
      installing.addEventListener('statechange', function(){
        if(installing.state === 'installed' && navigator.serviceWorker.controller) showWaiting(installing);
      });
    });
  }

  function register(){
    navigator.serviceWorker.register('/sw.js', {scope: '/', updateViaCache: 'none'})
      .then(watchRegistration)
      .catch(function(){ /* The site remains fully usable without its optional offline shell. */ });
  }

  if(updateButton) updateButton.addEventListener('click', function(){
    if(!waitingWorker) return;
    updateAccepted = true;
    updateButton.disabled = true;
    waitingWorker.postMessage({type: 'ACTIVATE_UPDATE'});
  });

  navigator.serviceWorker.addEventListener('controllerchange', function(){
    if(updateAccepted) window.location.reload();
  });
  window.addEventListener('offline', function(){
    showStatus('You are offline. This page and saved local content remain available.', false);
  });
  window.addEventListener('online', hideOfflineStatus);
  if(!navigator.onLine) showStatus('You are offline. This page and saved local content remain available.', false);

  window.addEventListener('load', function(){
    var startPwa = register;
    if('requestIdleCallback' in window) window.requestIdleCallback(startPwa, {timeout: 2000});
    else window.setTimeout(startPwa, 0);
  }, {once: true});
}());
