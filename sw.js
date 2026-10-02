/* GOD4.us Phase 2D-B offline shell and translation management UI. */
importScripts('/js/bible/translation-manifest.js', '/js/pwa/translation-cache-protocol.js');

const CACHE_PREFIX = 'god4-shell-';
const SHELL_CACHE = CACHE_PREFIX + 'compact-reader-4';
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
  '/js/word-study/provider.js',
  '/js/word-study/original-language-provider.js',
  '/js/word-study/local-provider.js',
  '/js/word-study/dictionary-provider.js',
  '/js/word-study/controller.js',
  '/js/bible/reader.js',
  '/js/bible/compare.js',
  '/js/bible/plans.js',
  '/js/app.js',
  '/js/auth/config.js',
  '/js/vendor/supabase-js-2.117.0.min.js',
  '/js/auth/supabase-provider.js',
  '/js/auth/auth.js',
  '/js/auth/account-ui.js?v=20260924-1',
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
  var cached = await caches.match(request);
  return cached || fetch(request);
}

async function navigationResponse(request, cacheHome){
  try {
    return await fetch(request);
  } catch(error){
    if(cacheHome){
      var home = await caches.match(HOME_URL);
      if(home) return home;
    }
    return caches.match(OFFLINE_URL);
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
  event.waitUntil(caches.keys().then(function(keys){
    return Promise.all(keys.filter(function(key){
      return key.startsWith(CACHE_PREFIX) && key !== SHELL_CACHE;
    }).map(function(key){ return caches.delete(key); }));
  }));
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
  if(isPrivateOrCloudflareRequest(request, url)) return;
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
