/* Accessible controls for explicitly managed offline Bible translations. */
var OfflineBiblesRuntime = (function(){
  'use strict';
  if(window.OfflineBiblesRuntime) return window.OfflineBiblesRuntime;

  var translationIds = ['web', 'asv', 'kjv', 'ylt', 'dby', 'webster', 'rv', 'gnv'];
  var allowedStates = ['not-retained', 'current', 'update-available'];
  var trigger, dialog, title, closeButton, list, bibleStorage, siteStorage, status;
  var translations, initialized = false, dialogGeneration = 0;
  var items = null;
  var busy = {};
  var unsupported = false;
  var refreshVersion = 0;

  function announce(message){
    status.textContent = message || '';
  }

  function workerMessage(type, translationId){
    var controller = navigator.serviceWorker && navigator.serviceWorker.controller;
    if(!controller) return Promise.resolve(null);
    return new Promise(function(resolve){
      var channel = new MessageChannel();
      var timeout = window.setTimeout(function(){
        channel.port1.close();
        resolve(null);
      }, 3000);
      channel.port1.onmessage = function(event){
        window.clearTimeout(timeout);
        channel.port1.close();
        resolve(event.data || null);
      };
      controller.postMessage({type:type, id:translationId}, [channel.port2]);
    });
  }

  function validList(response){
    if(!response || response.ok !== true || !Array.isArray(response.items) ||
      response.items.length !== translationIds.length) return null;
    for(var index = 0; index < translationIds.length; index++){
      var item = response.items[index];
      if(!item || item.id !== translationIds[index] ||
        allowedStates.indexOf(item.state) === -1 ||
        typeof item.currentRevision !== 'string' ||
        !Number.isInteger(item.currentBytes) || item.currentBytes < 1 ||
        (item.active !== null && (!item.active || item.active.id !== item.id ||
          !Number.isInteger(item.active.bytes) || item.active.bytes < 1))) return null;
    }
    return response.items;
  }

  function formatBytes(bytes){
    var gibibyte = 1024 * 1024 * 1024;
    var mebibyte = 1024 * 1024;
    if(bytes >= gibibyte) return (bytes / gibibyte).toFixed(1) + ' GiB';
    return (bytes / mebibyte).toFixed(1) + ' MiB';
  }

  function updateBibleStorage(){
    var bytes = (items || []).reduce(function(total, item){
      return total + (item.active ? item.active.bytes : 0);
    }, 0);
    bibleStorage.textContent = 'Offline Bibles: ' + (bytes / (1024 * 1024)).toFixed(1) + ' MiB';
  }

  async function updateSiteStorage(version){
    if(!navigator.storage || typeof navigator.storage.estimate !== 'function'){
      if(version === refreshVersion) siteStorage.textContent = 'Browser storage estimate unavailable.';
      return;
    }
    try {
      var estimate = await navigator.storage.estimate();
      if(version !== refreshVersion) return;
      if(!estimate || !Number.isFinite(estimate.usage) || !Number.isFinite(estimate.quota)){
        siteStorage.textContent = 'Browser storage estimate unavailable.';
        return;
      }
      siteStorage.textContent = 'Site storage: ' + formatBytes(estimate.usage) +
        ' of ' + formatBytes(estimate.quota);
    } catch(error){
      if(version === refreshVersion) siteStorage.textContent = 'Browser storage estimate unavailable.';
    }
  }

  function rowState(translationId){
    return items && items.find(function(item){ return item.id === translationId; });
  }

  function actionDetails(translation, item){
    if(!item) return {label:'Unavailable', status:unsupported ? 'Available after app update' : 'Checking availability', disabled:true};
    if(item.state === 'current') return {
      label:'Remove',
      status:'Available offline',
      accessible:'Remove ' + translation.name + ' from offline storage',
      disabled:false
    };
    if(item.state === 'update-available') return {
      label:'Update',
      status:'Update available',
      accessible:'Update ' + translation.name + ' for offline reading',
      disabled:!navigator.onLine
    };
    return {
      label:'Download',
      status:'Not downloaded',
      accessible:'Download ' + translation.name + ' for offline reading',
      disabled:!navigator.onLine
    };
  }

  function render(){
    var focusedRow = list.contains(document.activeElement) &&
      document.activeElement.closest('[data-translation-id]');
    var focusedId = focusedRow && focusedRow.getAttribute('data-translation-id');
    var replacement = null;
    list.textContent = '';
    translations.forEach(function(translation){
      var item = rowState(translation.id);
      var details = actionDetails(translation, item);
      var operation = busy[translation.id];
      var row = document.createElement('div');
      var text = document.createElement('div');
      var name = document.createElement('h3');
      var rowStatus = document.createElement('p');
      var action = document.createElement('button');
      row.className = 'offline-bibles-row';
      row.setAttribute('data-translation-id', translation.id);
      row.setAttribute('aria-busy', operation ? 'true' : 'false');
      name.className = 'offline-bibles-name';
      name.textContent = translation.name;
      rowStatus.className = 'offline-bibles-row-status';
      rowStatus.textContent = operation ? operation + '.' : details.status;
      text.appendChild(name);
      text.appendChild(rowStatus);
      action.className = 'offline-bibles-action';
      action.type = 'button';
      if(translation.id === focusedId) replacement = action;
      action.textContent = details.label;
      action.disabled = Boolean(operation || details.disabled);
      action.setAttribute('aria-label', details.accessible || (details.label + ' ' + translation.name));
      action.addEventListener('click', function(){ manageTranslation(translation.id); });
      row.appendChild(text);
      row.appendChild(action);
      list.appendChild(row);
    });
    if(focusedId && dialog.open){
      (replacement && !replacement.disabled ? replacement : closeButton).focus({preventScroll:true});
    }
  }

  async function refreshList(){
    var version = ++refreshVersion;
    var session = dialogGeneration;
    var response = await workerMessage('BIBLE_TRANSLATION_LIST');
    if(version !== refreshVersion || session !== dialogGeneration || !dialog.open) return false;
    var nextItems = validList(response);
    if(!nextItems){
      items = null;
      unsupported = true;
      updateBibleStorage();
      siteStorage.textContent = 'Browser storage estimate unavailable.';
      render();
      announce('Offline Bible controls will be available after the app update is applied.');
      return false;
    }
    items = nextItems;
    unsupported = false;
    updateBibleStorage();
    render();
    updateSiteStorage(version);
    if(status.textContent === 'Checking offline Bible availability.'){
      announce(navigator.onLine ? '' : 'You are offline. Downloads and updates require a connection.');
    }
    return true;
  }

  function failureMessage(result, removing){
    if(removing) return 'That offline Bible could not be removed. Please try again.';
    var error = result && result.error ? result.error : '';
    if(!navigator.onLine || error === 'network' || error === 'acquire-failed'){
      return 'A connection is required to download this Bible.';
    }
    if(error === 'service-worker-unavailable' || error === 'status-unavailable'){
      return 'Offline Bible controls are unavailable right now. Please try again.';
    }
    if(/quota|storage-quota/.test(error)){
      return "There isn't enough browser storage to save this Bible. Free some space and try again.";
    }
    if(/cache-write|ready-write|active-write|promotion-failed/.test(error)){
      return 'That Bible could not be saved. Check browser storage and try again.';
    }
    if(/validation|integrity|digest|length|mime/.test(error)){
      return 'That Bible could not be verified. Please try again.';
    }
    return 'That Bible could not be downloaded. Please try again.';
  }

  async function manageTranslation(translationId){
    var item = rowState(translationId);
    var translation = translations.find(function(value){ return value.id === translationId; });
    if(!item || !translation || busy[translationId]) return;
    var removing = item.state === 'current';
    if(!removing && !navigator.onLine){
      announce('A connection is required to download this Bible.');
      return;
    }

    var session = dialogGeneration;
    busy[translationId] = removing ? 'Removing' :
      (item.state === 'update-available' ? 'Updating' : 'Downloading');
    render();
    var result = removing ?
      await workerMessage('BIBLE_TRANSLATION_REMOVE', translationId) :
      await BibleTranslationLoader.retain(translationId);
    delete busy[translationId];
    if(!dialog.open) return;
    var refreshed = await refreshList();
    if(!refreshed || session !== dialogGeneration || !dialog.open) return;
    if(result && result.ok){
      if(removing){
        announce(translation.name + ' was removed from offline storage. ' +
          'The current reading session may continue; future offline visits will require another download.');
      } else {
        announce(translation.name + ' is available offline.');
      }
    } else {
      announce(failureMessage(result, removing));
    }
  }

  function focusableControls(){
    return Array.from(dialog.querySelectorAll('button:not([disabled]), [tabindex]:not([tabindex="-1"])'))
      .filter(function(element){ return element.getClientRects().length > 0; });
  }

  function openDialog(){
    dialogGeneration++;
    items = null;
    unsupported = false;
    announce('Checking offline Bible availability.');
    render();
    refreshList();
  }

  function initialize(){
    if(initialized) return true;
    trigger = document.getElementById('offlineBiblesTrigger');
    dialog = document.getElementById('offlineBiblesDialog');
    title = document.getElementById('offlineBiblesTitle');
    closeButton = document.getElementById('offlineBiblesClose');
    list = document.getElementById('offlineBiblesList');
    bibleStorage = document.getElementById('offlineBiblesStorage');
    siteStorage = document.getElementById('offlineSiteStorage');
    status = document.getElementById('offlineBiblesStatus');
    if(!trigger || !dialog || !title || !closeButton || !list || !bibleStorage ||
      !siteStorage || !status || typeof BibleData === 'undefined' ||
      typeof BibleTranslationLoader === 'undefined') return false;

    translations = BibleData.listTranslations().filter(function(translation){
      return translationIds.indexOf(translation.id) !== -1;
    }).sort(function(first, second){
      return translationIds.indexOf(first.id) - translationIds.indexOf(second.id);
    });
    dialog.addEventListener('close', function(){
      if(dialog.open) return;
      dialogGeneration++;
      refreshVersion++;
    });
    dialog.addEventListener('keydown', function(event){
      if(event.key !== 'Tab') return;
      var controls = focusableControls();
      if(!controls.length) return;
      var first = controls[0];
      var last = controls[controls.length - 1];
      if(event.shiftKey && (document.activeElement === first || !controls.includes(document.activeElement))){
        event.preventDefault();
        last.focus();
      } else if(!event.shiftKey && (document.activeElement === last || !controls.includes(document.activeElement))){
        event.preventDefault();
        first.focus();
      }
    });
    window.addEventListener('offline', function(){
      render();
      if(dialog.open) announce('You are offline. Downloads and updates require a connection.');
    });
    window.addEventListener('online', function(){
      render();
      if(dialog.open) announce('Connection restored. Downloads and updates are available.');
    });
    initialized = true;
    return true;
  }
  return {version:1, initialize:initialize, openFromTrigger:openDialog};
}());
