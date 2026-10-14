/* GOD4.us Phase 2D-B offline shell and translation management UI. */
importScripts('/js/bible/translation-manifest.js', '/js/pwa/translation-cache-protocol.js');

const CACHE_PREFIX = 'god4-shell-';
const SHELL_CACHE = CACHE_PREFIX + 'compact-reader-30';
const PREVIOUS_SHELL_CACHE = CACHE_PREFIX + 'compact-reader-24';
const VENDOR_PATH = '/js/vendor/supabase-js-2.117.0.min.js';
const VENDOR_CACHE_PREFIX = 'god4-auth-vendor-';
const VENDOR_CACHE = VENDOR_CACHE_PREFIX + 'supabase-js-2.117.0';
// Pinned file digest, normalized for Git/Windows CRLF differences only.
const VENDOR_SHA256 = 'ab5167c585f548f70be748c659554008db55053fd9de4f9c9b01e6f38642cf80';
var vendorRequest = null;
const HOME_URL = '/';
const OFFLINE_URL = '/offline';
const TRANSLATION_PATHS = new Set([
  '/js/bible/web.js', '/js/bible/asv.js', '/js/bible/kjv.js', '/js/bible/ylt.js',
  '/js/bible/dby.js', '/js/bible/webster.js', '/js/bible/rv.js', '/js/bible/gnv.js'
]);
const SHELL_ASSETS = [
  HOME_URL,
  OFFLINE_URL,
  '/manifest.webmanifest',
  '/images/icons/icon-192.png',
  '/images/icons/icon-512.png',
  '/images/icons/icon-maskable-512.png',
  '/images/icons/apple-touch-icon.png',
  '/css/variables.css',
  '/css/reset.css',
  '/css/base.css',
  '/css/layout.css',
  '/css/components.css',
  '/css/companion.css',
  '/css/account.css?v=20260924-1',
  '/js/bible/library.js',
  '/js/bible/translation-manifest.js',
  '/js/bible/data.js',
  '/js/bible/translation-loader.js',
  '/js/storage/local-provider.js',
  '/js/storage/user-data.js',
  '/js/bible/speech.js',
  '/js/bible/cloud-tts.js',
  '/js/word-study/loader.js',
  '/js/word-study/provider.js',
  '/js/word-study/original-language-provider.js',
  '/js/word-study/local-provider.js',
  '/js/word-study/sense-selector.js',
  '/js/word-study/dictionary-provider.js',
  '/js/word-study/controller.js',
  '/js/bible/reader.js',
  '/js/bible/compare-loader.js',
  '/js/bible/compare.js',
  '/js/bible/reading-journey.js',
  '/js/bible/plans.js',
  '/js/app.js',
  '/js/auth/config.js',
  '/js/auth/loader.js',
  '/js/auth/supabase-provider.js',
  '/js/auth/auth.js',
  '/js/auth/account-ui.js?v=20260924-1',
  '/js/pwa/offline-translations-loader.js',
  '/js/pwa/offline-translations.js',
  '/js/pwa/register.js'
];
const SHELL_KEYS = new Set(SHELL_ASSETS);
const bibleCacheProtocol = BibleTranslationCacheProtocol.create({
  manifest:BibleTranslationManifest,
  caches:caches,
  fetch:function(request){ return fetch(request); },
  crypto:crypto,
  origin:self.location.origin,
  Request:Request,
  Response:Response
});

function requestKey(url){
  return url.pathname + url.search;
}

function isAuthenticationCallback(url){
  return url.origin === self.location.origin &&
    (url.pathname === '/auth/callback' || url.pathname.startsWith('/auth/callback/'));
}

function isPrivateOrCloudflareRequest(request, url){
  if(request.headers.has('authorization')) return true;
  if(url.hostname.endsWith('.supabase.co')) return true;
  if(url.hostname === 'static.cloudflareinsights.com') return true;
  return url.origin === self.location.origin && url.pathname.startsWith('/cdn-cgi/');
}

async function cacheFirst(request){
  var cached = await (await caches.open(SHELL_CACHE)).match(request);
  return cached || fetch(request);
}

async function validVendor(response){
  if(!response || response.status !== 200 || response.redirected) return false;
  var mime = (response.headers.get('content-type') || '').split(';')[0].trim().toLowerCase();
  if(mime !== 'application/javascript' && mime !== 'text/javascript') return false;
  if(response.url){
    var url = new URL(response.url);
    if(url.origin !== self.location.origin || url.pathname !== VENDOR_PATH || url.search) return false;
  }
  try {
    var body = await response.clone().arrayBuffer();
    if(body.byteLength < 200000) return false;
    var normalized = new TextDecoder('utf-8', {fatal:true}).decode(body).replace(/\r\n/g, '\n');
    var digest = await crypto.subtle.digest('SHA-256', new TextEncoder().encode(normalized));
    var hex = Array.from(new Uint8Array(digest), function(byte){ return byte.toString(16).padStart(2, '0'); }).join('');
    return hex === VENDOR_SHA256;
  } catch(error){ return false; }
}

async function cachedVendor(){
  var names = await caches.keys();
  if(names.indexOf(VENDOR_CACHE) >= 0){
    var cache = await caches.open(VENDOR_CACHE);
    var response = await cache.match(VENDOR_PATH);
    if(await validVendor(response)) return response;
    if(response) await cache.delete(VENDOR_PATH);
  }
  return null;
}

async function previousVendor(){
  if((await caches.keys()).indexOf(PREVIOUS_SHELL_CACHE) < 0) return null;
  var response = await (await caches.open(PREVIOUS_SHELL_CACHE)).match(VENDOR_PATH);
  return await validVendor(response) ? response : null;
}

async function storeVendor(response){
  await (await caches.open(VENDOR_CACHE)).put(VENDOR_PATH, response.clone());
}

async function vendorResponse(request){
  if(!vendorRequest){
    vendorRequest = (async function(){
      try {
        var cached = await cachedVendor();
        if(cached) return cached;
      } catch(error){ /* Cache failures must not prevent online Account use. */ }
      try {
        var previous = await previousVendor();
        if(previous){
          try {
            await storeVendor(previous);
            await caches.delete(PREVIOUS_SHELL_CACHE);
          } catch(error){ /* Keep the old copy for offline use and a later promotion retry. */ }
          return previous;
        }
      } catch(error){ /* Network remains available if migration cannot be inspected. */ }
      var response = await fetch(request);
      if(await validVendor(response)){
        try { await storeVendor(response); } catch(error){ /* A successful response remains usable without persistence. */ }
      }
      return response;
    })().finally(function(){ vendorRequest = null; });
  }
  return (await vendorRequest).clone();
}

async function migrateVendor(){
  try {
    if(await cachedVendor()) return true;
    var previous = await previousVendor();
    if(previous) await storeVendor(previous);
    return true;
  } catch(error){
    // Activate normally, but retain cache 24 until its vendor can be promoted.
    return false;
  }
}

async function navigationResponse(request, cacheHome){
  try {
    return await fetch(request);
  } catch(error){
    if(cacheHome){
      var home = await (await caches.open(SHELL_CACHE)).match(HOME_URL);
      if(home) return home;
    }
    return (await caches.open(SHELL_CACHE)).match(OFFLINE_URL);
  }
}

function handleBibleProtocolMessage(event, operation){
  var port = event.ports && event.ports[0];
  var work = operation.catch(function(){
    return {ok:false, error:'protocol-failure'};
  }).then(function(result){
    if(port) port.postMessage(result);
  });
  event.waitUntil(work);
}

self.addEventListener('install', function(event){
  event.waitUntil(caches.open(SHELL_CACHE).then(function(cache){
    return cache.addAll(SHELL_ASSETS);
  }));
});

self.addEventListener('activate', function(event){
  event.waitUntil((async function(){
    var migrated = await migrateVendor();
    try {
      var keys = await caches.keys();
      await Promise.all(keys.filter(function(key){
        if(key.startsWith(VENDOR_CACHE_PREFIX)) return key !== VENDOR_CACHE;
        return key.startsWith(CACHE_PREFIX) && key !== SHELL_CACHE &&
          (key !== PREVIOUS_SHELL_CACHE || migrated);
      }).map(function(key){ return caches.delete(key).catch(function(){ return false; }); }));
    } catch(error){ /* Cleanup failures do not block activation or current-shell reads. */ }
  })());
});

self.addEventListener('message', function(event){
  var data = event.data || {};
  if(data.type === 'ACTIVATE_UPDATE'){
    self.skipWaiting();
    return;
  }
  if(data.type === 'BIBLE_TRANSLATION_ACQUIRE'){
    handleBibleProtocolMessage(event, bibleCacheProtocol.acquire(data.id, data.revision));
    return;
  }
  if(data.type === 'BIBLE_TRANSLATION_PROMOTE'){
    handleBibleProtocolMessage(event, bibleCacheProtocol.promote(data.id, data.revision));
    return;
  }
  if(data.type === 'BIBLE_TRANSLATION_STATUS'){
    handleBibleProtocolMessage(event, bibleCacheProtocol.status(data.id));
    return;
  }
  if(data.type === 'BIBLE_TRANSLATION_LIST'){
    handleBibleProtocolMessage(event, bibleCacheProtocol.list());
    return;
  }
  if(data.type === 'BIBLE_TRANSLATION_REMOVE'){
    handleBibleProtocolMessage(event, bibleCacheProtocol.remove(data.id));
  }
});

self.addEventListener('fetch', function(event){
  var request = event.request;
  if(request.method !== 'GET') return;

  var url = new URL(request.url);
  // Cloud speech always reaches the Function, including navigations/invalid GETs.
  if(url.origin === self.location.origin && url.pathname === '/api/tts') return;
  if(isPrivateOrCloudflareRequest(request, url)) return;
  if(url.origin === self.location.origin && url.pathname === VENDOR_PATH && !url.search){
    event.respondWith(vendorResponse(request));
    return;
  }
  if(url.origin === self.location.origin){
    var activeMatch = /^\/__god4\/bible-cache\/active-script\/([a-z]+)\/([a-f0-9]{16})\.js$/.exec(url.pathname);
    if(activeMatch && !url.search){
      event.respondWith(bibleCacheProtocol.serveActive(activeMatch[1], activeMatch[2]).then(function(response){
        return response || new Response('Not found', {status:404, headers:{'content-type':'text/plain'}});
      }));
      return;
    }
    if(TRANSLATION_PATHS.has(url.pathname)){
      var revision = url.searchParams.get('god4-revision');
      var translationId = url.pathname.slice('/js/bible/'.length, -3);
      if(revision && Array.from(url.searchParams.keys()).length === 1){
        event.respondWith(bibleCacheProtocol.serveCandidate(translationId, revision).then(function(response){
          return response || fetch(request);
        }));
      }
      return;
    }
  }

  if(isAuthenticationCallback(url)){
    if(request.mode === 'navigate') event.respondWith(navigationResponse(request, false));
    return;
  }

  if(request.mode === 'navigate' && url.origin === self.location.origin){
    var isHome = url.pathname === '/' || url.pathname === '/index.html';
    event.respondWith(navigationResponse(request, isHome));
    return;
  }

  if(url.origin === self.location.origin && SHELL_KEYS.has(requestKey(url))){
    event.respondWith(cacheFirst(request));
  }
});
