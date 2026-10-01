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

  function isTrustedStructure(value){
    if(!value || typeof value !== 'object' || Array.isArray(value)) return false;
    if(Object.keys(value).sort().join(',') !== 'bookCount,books,chapterCount,verseCount' ||
      !Number.isInteger(value.bookCount) || value.bookCount < 1 ||
      !Number.isInteger(value.chapterCount) || value.chapterCount < 1 ||
      !Number.isInteger(value.verseCount) || value.verseCount < 1 ||
      !Array.isArray(value.books) || value.books.length !== value.bookCount) return false;
    var bookIds = {};
    var chapterCount = 0;
    var verseCount = 0;
    var valid = value.books.every(function(book){
      if(!Array.isArray(book) || book.length !== 3 ||
        typeof book[0] !== 'string' || !/^[a-z0-9-]+$/.test(book[0]) ||
        !Number.isInteger(book[1]) || book[1] < 1 ||
        !Number.isInteger(book[2]) || book[2] < 0) return false;
      if(bookIds[book[0]]) return false;
      bookIds[book[0]] = true;
      chapterCount += book[1];
      verseCount += book[2];
      return true;
    });
    return valid && chapterCount === value.chapterCount && verseCount === value.verseCount;
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

    function approvedCurrentEntry(translationId){
      if(APPROVED_IDS.indexOf(translationId) === -1) return null;
      var entry = manifest && manifest[translationId];
      if(!entry || entry.id !== translationId ||
        entry.path !== '/js/bible/' + translationId + '.js' ||
        !isRevision(entry.revision) ||
        !Number.isInteger(entry.bytes) || entry.bytes < 1 ||
        typeof entry.integrity !== 'string' ||
        !/^sha256-[A-Za-z0-9+/]+={0,2}$/.test(entry.integrity) ||
        !isTrustedStructure(entry.structure)) return null;
      return entry;
    }

    function approvedEntry(translationId, revision){
      var entry = approvedCurrentEntry(translationId);
      return entry && entry.revision === revision ? entry : null;
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

    function activeScriptPath(translationId, revision){
      return KEY_PREFIX + 'active-script/' + translationId + '/' + revision + '.js';
    }

    function parsePayloadKey(key, kind){
      var url;
      try {
        url = new URL(typeof key === 'string' ? key : key.url, origin);
      } catch(error){
        return null;
      }
      if(url.origin !== origin || url.search || url.hash) return null;
      var match = /^\/__god4\/bible-cache\/(candidate|ready)\/([a-z]+)\/([a-f0-9]{16})$/.exec(
        url.pathname
      );
      if(!match || match[1] !== kind || APPROVED_IDS.indexOf(match[2]) === -1) return null;
      return {kind:match[1], id:match[2], revision:match[3]};
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
      if(metadataKeys.join(',') !== 'bytes,id,integrity,path,revision,structure' ||
        metadata.id !== translationId ||
        metadata.path !== '/js/bible/' + translationId + '.js' ||
        !isRevision(metadata.revision) ||
        typeof metadata.integrity !== 'string' ||
        !/^sha256-[A-Za-z0-9+/]+={0,2}$/.test(metadata.integrity) ||
        !Number.isInteger(metadata.bytes) || metadata.bytes < 1 ||
        !isTrustedStructure(metadata.structure)) return null;

      var ready = await readyCache.match(readyKey(translationId, metadata.revision));
      return ready ? {
        id:metadata.id,
        revision:metadata.revision,
        path:metadata.path,
        integrity:metadata.integrity,
        bytes:metadata.bytes,
        structure:metadata.structure
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

    async function list(){
      var items = await Promise.all(APPROVED_IDS.map(async function(translationId){
        var entry = approvedCurrentEntry(translationId);
        var active = await readActive(translationId);
        return {
          id:translationId,
          currentRevision:entry ? entry.revision : null,
          currentBytes:entry ? entry.bytes : null,
          active:active,
          state:!active ? 'not-retained' :
            (entry && active.revision === entry.revision ? 'current' : 'update-available')
        };
      }));
      return {ok:true, items:items};
    }

    async function removeEntries(cache, kind, translationId, warning, cleanupWarnings){
      if(!cache) return;
      var keys;
      try {
        keys = await cache.keys();
      } catch(error){
        cleanupWarnings.push(warning);
        return;
      }
      for(var index = 0; index < keys.length; index++){
        var parsed = parsePayloadKey(keys[index], kind);
        if(!parsed || parsed.id !== translationId) continue;
        try {
          if(!await cache.delete(keys[index]) && cleanupWarnings.indexOf(warning) === -1){
            cleanupWarnings.push(warning);
          }
        } catch(error){
          if(cleanupWarnings.indexOf(warning) === -1) cleanupWarnings.push(warning);
        }
      }
    }

    async function remove(translationId){
      if(APPROVED_IDS.indexOf(translationId) === -1){
        return {ok:false, id:translationId, error:'not-approved'};
      }

      var readyCache = await existingCache(READY_CACHE);
      var candidateCache = await existingCache(CANDIDATE_CACHE);
      if(!readyCache && !candidateCache){
        return {
          ok:true,
          id:translationId,
          state:'not-retained',
          removedRevision:null,
          cleanupWarnings:[]
        };
      }

      var active = await readActive(translationId);
      if(readyCache){
        var pointer = await readyCache.match(activeKey(translationId));
        if(pointer){
          try {
            if(!await readyCache.delete(activeKey(translationId))){
              return {ok:false, id:translationId, error:'active-delete'};
            }
          } catch(error){
            return {ok:false, id:translationId, error:'active-delete'};
          }
        }
      }

      var cleanupWarnings = [];
      await removeEntries(candidateCache, 'candidate', translationId,
        'candidate-delete', cleanupWarnings);
      await removeEntries(readyCache, 'ready', translationId,
        'ready-delete', cleanupWarnings);
      return {
        ok:true,
        id:translationId,
        state:'not-retained',
        removedRevision:active ? active.revision : null,
        cleanupWarnings:cleanupWarnings
      };
    }

    async function serveCandidate(translationId, revision){
      var entry = approvedEntry(translationId, revision);
      if(!entry) return null;
      var candidateCache = await existingCache(CANDIDATE_CACHE);
      if(!candidateCache) return null;
      var response = await candidateCache.match(candidateKey(translationId, revision));
      if(!response) return null;
      var verification = await verifyResponse(response.clone(), entry);
      return verification.ok ? response : null;
    }

    async function serveActive(translationId, revision){
      var active = await readActive(translationId);
      if(!active || active.revision !== revision) return null;
      var readyCache = await existingCache(READY_CACHE);
      if(!readyCache) return null;
      var response = await readyCache.match(readyKey(translationId, revision));
      if(!response) return null;
      var verification = await verifyResponse(response.clone(), active);
      return verification.ok ? response : null;
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
          bytes:entry.bytes,
          structure:entry.structure
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
      list:list,
      remove:remove,
      serveCandidate:serveCandidate,
      serveActive:serveActive,
      candidateKey:candidateKey,
      readyKey:readyKey,
      activeKey:activeKey,
      activeScriptPath:activeScriptPath,
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
