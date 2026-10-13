/* Compare readiness and activation only; rendering stays in compare.js. */
var CompareLoader = (function(){
  if(window.CompareLoader) return window.CompareLoader;
  var pending = null, intent = null, edition = null, initialized = false, activated = false;
  function runtime(){
    var api = window.CompareRuntime;
    return api && api.version === 1 && ['initialize','activate','load','syncDefault','syncReader','initializeReference','scrollStart'].every(function(name){ return typeof api[name] === 'function'; }) ? api : null;
  }
  function ensure(){
    if(!pending){
      pending = Promise.resolve().then(function(){
        if(runtime()) return;
        return new Promise(function(resolve,reject){
          var script = document.createElement('script');
          script.src = '/js/bible/compare.js';
          function fail(){ script.remove(); reject(new Error('Compare could not be loaded.')); }
          script.onerror = fail;
          script.onload = function(){
            script.onload = script.onerror = null;
            if(!runtime()){ fail(); return; }
            resolve();
          };
          document.head.appendChild(script);
        });
      }).then(function(){ var api = runtime(); api.initialize(); return api; })
        .catch(function(error){ pending = null; throw error; });
    }
    return pending;
  }
  function status(message,busy){
    var live = document.getElementById('compareRuntimeStatus');
    if(live) live.textContent = message;
    var view = document.getElementById('view-compare');
    if(view) view.setAttribute('aria-busy',busy ? 'true' : 'false');
    if(message && view && view.classList.contains('active')) document.getElementById('compareSummary').textContent = message;
  }
  async function readerReady(){
    // Wait for the committed translation, including a replacement started while waiting.
    while(typeof readerTranslationTask !== 'undefined' && readerTranslationTask) await readerTranslationTask;
    if(typeof initializeBibleExperience === 'function') await initializeBibleExperience();
    while(typeof readerTranslationTask !== 'undefined' && readerTranslationTask) await readerTranslationTask;
  }
  function request(count,position,kind){
    if(count !== null){
      if([2,3,4].indexOf(count) === -1 || count > BibleData.listTranslations().filter(function(t){ return t.provider !== 'demo-library'; }).length) return Promise.resolve();
      edition = count;
    }
    if(activated && runtime()) return runtime().activate(count,position,kind === 'tab');
    var item = {count:edition,position:position === true,kind:kind,handoff:kind === 'tab' || !activated};
    intent = item;
    status('Loading Compare.',true);
    return ensure().then(async function(api){
      if(intent !== item) return;
      await readerReady();
      if(intent !== item) return;
      intent = null;
      edition = null;
      status('',false);
      activated = true;
      return api.activate(item.count,item.position,item.handoff);
    }).catch(function(){
      if(intent !== item) return;
      intent = null;
      status('Compare could not be loaded. Activate Compare or an edition button to try again.',false);
    });
  }
  function leave(){
    // Only readiness replay is canceled. Existing data loads may safely render hidden columns.
    if(!intent) return;
    intent = null;
    status('',false);
  }
  function initialize(){
    if(initialized) return;
    initialized = true;
    var controls = document.querySelector('.compare-edition-control');
    if(!controls) return;
    var live = document.createElement('span');
    live.id = 'compareRuntimeStatus';
    live.className = 'sr-only';
    live.setAttribute('role','status');
    live.setAttribute('aria-live','polite');
    live.setAttribute('aria-atomic','true');
    controls.parentElement.appendChild(live);
    controls.addEventListener('click',function(event){
      var button = event.target.closest('[data-compare-count]');
      if(button && controls.contains(button) && !button.disabled) request(Number(button.getAttribute('data-compare-count')),false,'edition');
    });
  }
  if(document.readyState === 'loading') document.addEventListener('DOMContentLoaded',initialize,{once:true});
  else initialize();
  return {ensure:ensure,initialize:initialize,activate:function(){ return request(null,true,'tab'); },
    render:function(position){ return request(null,position,'render'); },
    setEdition:function(count){ request(count,false,'edition'); },leave:leave};
})();
// Existing external commands keep their return contracts before readiness.
// Runtime initialization reads current Reader state rather than storing startup snapshots.
function setCompareEditionCount(count){ CompareLoader.setEdition(count); }
async function loadCompare(position){ await CompareLoader.render(position); }
function initializeCompareReference(){}
function syncCompareDefaultTranslation(){}
function scrollCompareStartIntoView(){}
function syncCompareFromReader(){
  var view = document.getElementById('view-compare');
  if(view && view.classList.contains('active')) CompareLoader.render(false);
}
