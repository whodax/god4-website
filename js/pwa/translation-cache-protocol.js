/* ===== SERVICE-WORKER BIBLE TRANSLATION CACHE PROTOCOL ===== */
(function exposeBibleTranslationCacheProtocol(root, factory){
  var api = factory();
  if(typeof module === 'object' && module.exports) module.exports = api;
  else root.BibleTranslationCacheProtocol = api;
}(typeof self !== 'undefined' ? self : globalThis, function createProtocolModule(){
  'use strict';

  var APPROVED_IDS = Object.freeze([
    'web', 'asv', 'kjv', 'ylt', 'dby', 'webster', 'rv', 'gnv'
  ]);
  var CANDIDATE_CACHE = 'god4-bible-candidates-v1';
  var READY_CACHE = 'god4-bible-ready-v1';
  var KEY_PREFIX = '/__god4/bible-cache/';

  function isRevision(value){
    return typeof value === 'string' && /^[a-f0-9]{16}$/.test(value);
  }

  function isApprovedMime(value){
    var mime = String(value || '').split(';', 1)[0].trim().toLowerCase();
    return mime === 'application/javascript' || mime === 'text/javascript';
  }

  function digestBase64(bytes){
    var alphabet = 'ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz0123456789+/';
    var output = '';
    for(var index = 0; index < bytes.length; index += 3){
      var first = bytes[index];
      var second = index + 1 < bytes.length ? bytes[index + 1] : 0;
      var third = index + 2 < bytes.length ? bytes[index + 2] : 0;
      var value = (first << 16) | (second << 8) | third;
      output += alphabet[(value >> 18) & 63];
      output += alphabet[(value >> 12) & 63];
      output += index + 1 < bytes.length ? alphabet[(value >> 6) & 63] : '=';
      output += index + 2 < bytes.length ? alphabet[value & 63] : '=';
    }
    return output;
  }

  function create(options){
    var manifest = options.manifest;
    var cacheStorage = options.caches;
    var fetchResponse = options.fetch;
    var cryptography = options.crypto;
    var origin = options.origin;
    var RequestConstructor = options.Request || Request;
    var ResponseConstructor = options.Response || Response;
    var inFlight = new Map();

    function approvedEntry(translationId, revision){
      if(APPROVED_IDS.indexOf(translationId) === -1) return null;
      var entry = manifest && manifest[translationId];
      if(!entry || entry.id !== translationId ||
        entry.path !== '/js/bible/' + translationId + '.js' ||
        entry.revision !== revision || !isRevision(entry.revision) ||
        !Number.isInteger(entry.bytes) || entry.bytes < 1 ||
        typeof entry.integrity !== 'string' ||
        !/^sha256-[A-Za-z0-9+/]+={0,2}$/.test(entry.integrity)) return null;
      return entry;
    }

    function cacheKey(kind, translationId, revision){
      var suffix = kind === 'active'
        ? 'active/' + translationId
        : kind + '/' + translationId + '/' + revision;
      return new URL(KEY_PREFIX + suffix, origin).href;
    }

    function candidateKey(translationId, revision){
      return cacheKey('candidate', translationId, revision);
    }

    function readyKey(translationId, revision){
      return cacheKey('ready', translationId, revision);
    }

    function activeKey(translationId){
      return cacheKey('active', translationId);
    }

    async function existingCache(name){
      var names = await cacheStorage.keys();
      return names.indexOf(name) === -1 ? null : cacheStorage.open(name);
    }

    async function verifyResponse(response, entry){
      if(!response || !response.ok) return {ok:false, error:'http-status'};
      if(response.redirected) return {ok:false, error:'redirected'};
      if(!isApprovedMime(response.headers && response.headers.get('content-type'))){
        return {ok:false, error:'mime'};
      }

      var body;
      try {
        body = await response.arrayBuffer();
      } catch(error){
        return {ok:false, error:'body'};
      }
      if(body.byteLength !== entry.bytes) return {ok:false, error:'length'};

      var digest;
      try {
        digest = await cryptography.subtle.digest('SHA-256', body);
      } catch(error){
        return {ok:false, error:'digest'};
      }
      var integrity = 'sha256-' + digestBase64(new Uint8Array(digest));
      if(integrity !== entry.integrity) return {ok:false, error:'integrity'};
      return {ok:true};
    }

    function approvedRequest(entry){
      var url = new URL(entry.path, origin);
      url.searchParams.set('god4-revision', entry.revision);
      return new RequestConstructor(url.href, {
        method: 'GET',
        credentials: 'same-origin',
        redirect: 'follow',
        cache: 'no-store',
        headers: {accept:'application/javascript'}
      });
    }

    async function acquireApproved(entry){
      var candidateCache = await existingCache(CANDIDATE_CACHE);
      if(candidateCache){
        var cached = await candidateCache.match(candidateKey(entry.id, entry.revision));
        if(cached){
          var cachedVerification = await verifyResponse(cached.clone(), entry);
          if(cachedVerification.ok){
            return {ok:true, id:entry.id, revision:entry.revision, state:'candidate', cached:true};
          }
          await candidateCache.delete(candidateKey(entry.id, entry.revision));
        }
      }

      var response;
      try {
        response = await fetchResponse(approvedRequest(entry));
      } catch(error){
        return {ok:false, id:entry.id, revision:entry.revision, error:'network'};
      }

      var verification = await verifyResponse(response.clone(), entry);
      if(!verification.ok){
        return {
          ok:false,
          id:entry.id,
          revision:entry.revision,
          error:verification.error
        };
      }

      try {
        candidateCache = candidateCache || await cacheStorage.open(CANDIDATE_CACHE);
        await candidateCache.put(candidateKey(entry.id, entry.revision), response);
      } catch(error){
        return {ok:false, id:entry.id, revision:entry.revision, error:'cache-write'};
      }

      return {ok:true, id:entry.id, revision:entry.revision, state:'candidate', cached:false};
    }

    function acquire(translationId, revision){
      var entry = approvedEntry(translationId, revision);
      if(!entry){
        return Promise.resolve({
          ok:false,
          id:translationId,
          revision:revision,
          error:'not-approved'
        });
      }

      var key = translationId + ':' + revision;
      if(inFlight.has(key)) return inFlight.get(key);
      var request = acquireApproved(entry).finally(function(){
        inFlight.delete(key);
      });
      inFlight.set(key, request);
      return request;
    }

    async function readActive(translationId){
      if(APPROVED_IDS.indexOf(translationId) === -1) return null;
      var readyCache = await existingCache(READY_CACHE);
      if(!readyCache) return null;

      var metadataResponse = await readyCache.match(activeKey(translationId));
      if(!metadataResponse) return null;

      var metadata;
      try {
        metadata = await metadataResponse.json();
      } catch(error){
        return null;
      }
      var metadataKeys = metadata && typeof metadata === 'object'
        ? Object.keys(metadata).sort()
        : [];
      if(metadataKeys.join(',') !== 'bytes,id,integrity,path,revision' ||
        metadata.id !== translationId ||
        metadata.path !== '/js/bible/' + translationId + '.js' ||
        !isRevision(metadata.revision) ||
        typeof metadata.integrity !== 'string' ||
        !/^sha256-[A-Za-z0-9+/]+={0,2}$/.test(metadata.integrity) ||
        !Number.isInteger(metadata.bytes) || metadata.bytes < 1) return null;

      var ready = await readyCache.match(readyKey(translationId, metadata.revision));
      return ready ? {
        id:metadata.id,
        revision:metadata.revision,
        path:metadata.path,
        integrity:metadata.integrity,
        bytes:metadata.bytes
      } : null;
    }

    async function status(translationId){
      var active = await readActive(translationId);
      return {
        ok:APPROVED_IDS.indexOf(translationId) !== -1,
        id:translationId,
        activeRevision:active ? active.revision : null,
        active:active
      };
    }

    async function promote(translationId, revision){
      var entry = approvedEntry(translationId, revision);
      if(!entry){
        return {ok:false, id:translationId, revision:revision, error:'not-approved'};
      }

      var candidateCache = await existingCache(CANDIDATE_CACHE);
      if(!candidateCache){
        return {ok:false, id:translationId, revision:revision, error:'candidate-missing'};
      }
      var key = candidateKey(translationId, revision);
      var candidate = await candidateCache.match(key);
      if(!candidate){
        return {ok:false, id:translationId, revision:revision, error:'candidate-missing'};
      }

      var verification = await verifyResponse(candidate.clone(), entry);
      if(!verification.ok){
        await candidateCache.delete(key);
        return {ok:false, id:translationId, revision:revision, error:'candidate-' + verification.error};
      }

      var previous = await readActive(translationId);
      var readyCache;
      var newReadyKey = readyKey(translationId, revision);
      try {
        readyCache = await cacheStorage.open(READY_CACHE);
        await readyCache.put(newReadyKey, candidate.clone());
      } catch(error){
        return {ok:false, id:translationId, revision:revision, error:'ready-write'};
      }

      try {
        var metadata = new ResponseConstructor(JSON.stringify({
          id:entry.id,
          revision:entry.revision,
          path:entry.path,
          integrity:entry.integrity,
          bytes:entry.bytes
        }), {
          status:200,
          headers:{'content-type':'application/json'}
        });
        await readyCache.put(activeKey(translationId), metadata);
      } catch(error){
        if(!previous || previous.revision !== revision){
          try { await readyCache.delete(newReadyKey); } catch(ignore){}
        }
        return {ok:false, id:translationId, revision:revision, error:'active-write'};
      }

      var cleanupWarnings = [];
      try {
        if(!await candidateCache.delete(key)) cleanupWarnings.push('candidate-delete');
      } catch(error){
        cleanupWarnings.push('candidate-delete');
      }
      if(previous && previous.revision !== revision){
        try {
          if(!await readyCache.delete(readyKey(translationId, previous.revision))){
            cleanupWarnings.push('obsolete-ready-delete');
          }
        } catch(error){
          cleanupWarnings.push('obsolete-ready-delete');
        }
      }
      return {
        ok:true,
        id:translationId,
        revision:revision,
        state:'ready',
        previousRevision:previous ? previous.revision : null,
        cleanupWarnings:cleanupWarnings
      };
    }

    return {
      acquire:acquire,
      promote:promote,
      status:status,
      candidateKey:candidateKey,
      readyKey:readyKey,
      activeKey:activeKey,
      cacheNames:{
        candidates:CANDIDATE_CACHE,
        ready:READY_CACHE
      }
    };
  }

  return {
    create:create,
    approvedIds:APPROVED_IDS,
    cacheNames:{
      candidates:CANDIDATE_CACHE,
      ready:READY_CACHE
    }
  };
}));
