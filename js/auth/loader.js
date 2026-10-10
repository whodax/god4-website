/* Same-origin auth dependencies. Storage is only a conservative readiness hint. */
var God4AuthLoader = (function(){
  if(window.God4AuthLoader) return window.God4AuthLoader;
  var pending = null;
  var state = {status:'idle', auth:null};
  var listeners = new Set();
  var dependencies = [
    {src:'/js/vendor/supabase-js-2.117.0.min.js', valid:function(){ return window.supabase && typeof window.supabase.createClient === 'function'; }},
    {src:'/js/auth/supabase-provider.js', valid:function(){ return window.SupabaseAuthProvider && typeof window.SupabaseAuthProvider.create === 'function'; }},
    {src:'/js/auth/auth.js', valid:function(){ return window.God4Auth && typeof window.God4Auth.initialize === 'function' && typeof window.God4Auth.subscribe === 'function' && typeof window.God4Auth.getState === 'function'; }}
  ];

  function publish(status, auth){
    state = {status:status, auth:auth || null};
    listeners.forEach(function(listener){ try { listener(state); } catch(error){ /* Isolate UI subscribers. */ } });
  }
  function subscribe(listener){
    listeners.add(listener);
    try { listener(state); } catch(error){ /* A subscriber cannot break startup. */ }
    return function(){ listeners.delete(listener); };
  }
  function load(dependency){
    if(dependency.valid()) return Promise.resolve();
    return new Promise(function(resolve,reject){
      var script = document.createElement('script');
      script.src = dependency.src;
      function failed(){
        script.remove();
        reject(new Error('Account scripts could not be loaded.'));
      }
      script.onerror = failed;
      script.onload = function(){
        script.onload = script.onerror = null;
        if(!dependency.valid()){ failed(); return; }
        resolve();
      };
      document.head.appendChild(script);
    });
  }
  function ensure(){
    if(pending) return pending;
    // Assign before notifying subscribers, so reentrant callers share this promise.
    pending = Promise.resolve().then(async function(){
      for(var dependency of dependencies) await load(dependency);
      var auth = window.God4Auth;
      await auth.initialize();
      publish('ready',auth);
      return auth;
    }).catch(function(error){
      pending = null;
      publish('error');
      throw error;
    });
    publish('loading');
    return pending;
  }
  function background(){ ensure().catch(function(){ /* Existing unavailable UI offers retry on activation. */ }); }
  var config = typeof God4AuthConfig === 'undefined' ? null : God4AuthConfig;
  var key = config && config.enabled === true ? config.authStorageKey : null;
  if(key){
    var mayExist = true;
    try { mayExist = window.localStorage.getItem(key) !== null; } catch(error){ /* Fail safe to SDK restoration. */ }
    window.addEventListener('storage',function(event){
      if(event.key === key && event.newValue !== null) background();
    });
    if(mayExist) background();
  }
  // Preserve SDK URL detection on credential-bearing normal-page visits too.
  var query = new URLSearchParams(window.location.search);
  var fragment = new URLSearchParams(window.location.hash.slice(1));
  if(query.has('code') || query.has('token_hash') || fragment.has('access_token') || fragment.has('refresh_token')) background();
  return {ensure:ensure, subscribe:subscribe};
})();
