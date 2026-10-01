/* ===== ON-DEMAND BIBLE TRANSLATION LOADER ===== */
var BibleTranslationLoader = (function createBibleTranslationLoader(){
  var requests = {};
  var retentions = {};

  function isLoaded(translationId, trustedStructure){
    return typeof BibleData !== 'undefined' &&
      BibleData.validateTranslation(translationId, trustedStructure);
  }

  function approvedEntry(translationId){
    var entry = typeof BibleTranslationManifest === 'undefined'
      ? null : BibleTranslationManifest[translationId];
    return entry && entry.id === translationId &&
      entry.path === '/js/bible/' + translationId + '.js' ? entry : null;
  }

  function workerMessage(type, translationId, revision){
    var controller = navigator.serviceWorker && navigator.serviceWorker.controller;
    if(!controller) return Promise.resolve(null);
    return new Promise(function(resolve){
      var channel = new MessageChannel();
      var timeout = window.setTimeout(function(){ resolve(null); }, 10000);
      channel.port1.onmessage = function(event){
        window.clearTimeout(timeout);
        resolve(event.data || null);
      };
      controller.postMessage({type:type, id:translationId, revision:revision}, [channel.port2]);
    });
  }

  function currentUrl(entry){
    return entry.path + '?god4-revision=' + entry.revision;
  }

  function activeUrl(entry){
    return '/__god4/bible-cache/active-script/' + entry.id + '/' + entry.revision + '.js';
  }

  function loadScript(translationId, source, integrity, trustedStructure){
    return new Promise(function(resolve){
      var script = document.createElement('script');

      function finish(loaded){
        if(!loaded) script.remove();
        resolve(loaded);
      }

      script.src = source;
      script.integrity = integrity;
      script.async = true;
      script.setAttribute('data-bible-translation', translationId);
      script.addEventListener('load', function(){
        finish(isLoaded(translationId, trustedStructure));
      }, {once:true});
      script.addEventListener('error', function(){ finish(false); }, {once:true});
      document.head.appendChild(script);
    });
  }

  function retainLoaded(translationId, entry){
    if(!navigator.serviceWorker || !navigator.serviceWorker.controller) return Promise.resolve(false);
    if(retentions[translationId]) return retentions[translationId];
    retentions[translationId] = workerMessage('BIBLE_TRANSLATION_STATUS', translationId, entry.revision)
      .then(function(status){
        if(status && status.activeRevision === entry.revision) return true;
        return workerMessage('BIBLE_TRANSLATION_ACQUIRE', translationId, entry.revision).then(function(acquired){
          if(!acquired || !acquired.ok) return false;
          return workerMessage('BIBLE_TRANSLATION_PROMOTE', translationId, entry.revision).then(function(promoted){
            return Boolean(promoted && promoted.ok);
          });
        });
      }).catch(function(){ return false; }).then(function(retained){
        delete retentions[translationId];
        return retained;
      });
    return retentions[translationId];
  }

  async function loadApproved(translationId, entry){
    if(!navigator.serviceWorker || !navigator.serviceWorker.controller){
      return loadScript(translationId, currentUrl(entry), entry.integrity);
    }

    var status = await workerMessage('BIBLE_TRANSLATION_STATUS', translationId, entry.revision);
    if(status && status.active && status.active.revision === entry.revision){
      return loadScript(translationId, activeUrl(status.active), status.active.integrity,
        status.active.structure);
    }

    var acquired = await workerMessage('BIBLE_TRANSLATION_ACQUIRE', translationId, entry.revision);
    if(acquired && acquired.ok){
      var loaded = await loadScript(translationId, currentUrl(entry), entry.integrity);
      if(loaded) await workerMessage('BIBLE_TRANSLATION_PROMOTE', translationId, entry.revision);
      return loaded;
    }

    if(status && status.active){
      return loadScript(translationId, activeUrl(status.active), status.active.integrity,
        status.active.structure);
    }
    return false;
  }

  function ensure(translationId){
    var entry = approvedEntry(translationId);
    if(!entry) return Promise.resolve(false);
    if(isLoaded(translationId)){
      retainLoaded(translationId, entry);
      return Promise.resolve(true);
    }
    if(requests[translationId]) return requests[translationId];

    requests[translationId] = loadApproved(translationId, entry).then(function(loaded){
      if(!loaded) delete requests[translationId];
      return loaded;
    }, function(){
      delete requests[translationId];
      return false;
    });
    return requests[translationId];
  }

  return { ensure: ensure, isLoaded: isLoaded };
}());
