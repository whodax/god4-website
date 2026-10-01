const {test, expect} = require('@playwright/test');
const {createHash, webcrypto} = require('crypto');
const protocolModule = require('../js/pwa/translation-cache-protocol.js');

function cacheUrl(key) {
  return typeof key === 'string' ? key : key.url;
}

class MemoryCache {
  constructor(storage, name) {
    this.storage = storage;
    this.name = name;
    this.entries = new Map();
  }

  async match(key) {
    const response = this.entries.get(cacheUrl(key));
    return response ? response.clone() : undefined;
  }

  async put(key, response) {
    const url = cacheUrl(key);
    if(this.storage.shouldFailPut(this.name, url)) throw new Error('simulated cache write failure');
    this.entries.set(url, response.clone());
  }

  async delete(key) {
    const url = cacheUrl(key);
    if(this.storage.shouldFailDelete(this.name, url)) throw new Error('simulated cache delete failure');
    return this.entries.delete(url);
  }

  async keys() {
    return [...this.entries.keys()].map(url => new Request(url));
  }
}

class MemoryCacheStorage {
  constructor() {
    this.caches = new Map();
    this.putFailure = null;
    this.deleteFailure = null;
  }

  async open(name) {
    if(!this.caches.has(name)) this.caches.set(name, new MemoryCache(this, name));
    return this.caches.get(name);
  }

  async keys() {
    return [...this.caches.keys()];
  }

  async delete(name) {
    return this.caches.delete(name);
  }

  failNextPut(name, keyPart) {
    this.putFailure = {name, keyPart:keyPart || ''};
  }

  shouldFailPut(name, key) {
    if(!this.putFailure || this.putFailure.name !== name ||
      (this.putFailure.keyPart && !key.includes(this.putFailure.keyPart))) return false;
    this.putFailure = null;
    return true;
  }

  failNextDelete(name, keyPart) {
    this.deleteFailure = {name, keyPart:keyPart || ''};
  }

  shouldFailDelete(name, key) {
    if(!this.deleteFailure || this.deleteFailure.name !== name ||
      (this.deleteFailure.keyPart && !key.includes(this.deleteFailure.keyPart))) return false;
    this.deleteFailure = null;
    return true;
  }
}

function arrayBufferFor(text) {
  const bytes = Buffer.from(text);
  return bytes.buffer.slice(bytes.byteOffset, bytes.byteOffset + bytes.byteLength);
}

function fixture(fetchImplementation) {
  const body = 'const fixtureTranslation = true;\n';
  const digest = createHash('sha256').update(body).digest('base64');
  const revision = '0123456789abcdef';
  const manifest = {
    web: {
      id:'web',
      path:'/js/bible/web.js',
      revision,
      integrity:'sha256-' + digest,
      bytes:Buffer.byteLength(body),
      structure:{
        bookCount:1,
        chapterCount:1,
        verseCount:1,
        books:[['john', 1, 1]]
      }
    }
  };
  const storage = new MemoryCacheStorage();
  let fetchCount = 0;
  let currentFetch = fetchImplementation || (() => Promise.resolve(validResponse(body)));

  function validResponse(value) {
    return new Response(value === undefined ? body : value, {
      status:200,
      headers:{'content-type':'application/javascript; charset=utf-8'}
    });
  }

  const protocol = protocolModule.create({
    manifest,
    caches:storage,
    fetch:request => {
      fetchCount++;
      return currentFetch(request);
    },
    crypto:webcrypto,
    origin:'https://example.test',
    Request,
    Response
  });

  return {
    body,
    revision,
    manifest,
    storage,
    protocol,
    validResponse,
    fetchCount:() => fetchCount,
    setFetch:implementation => { currentFetch = implementation; }
  };
}

function activeMetadata(state, revision) {
  const entry = state.manifest.web;
  return {
    id:entry.id,
    revision:revision || entry.revision,
    path:entry.path,
    integrity:entry.integrity,
    bytes:entry.bytes,
    structure:entry.structure
  };
}

async function seedActive(state, revision) {
  const ready = await state.storage.open(protocolModule.cacheNames.ready);
  await ready.put(state.protocol.readyKey('web', revision), state.validResponse());
  await ready.put(state.protocol.activeKey('web'), new Response(JSON.stringify(
    activeMetadata(state, revision)
  ), {status:200, headers:{'content-type':'application/json'}}));
}

test('worker protocol rejects unapproved IDs and revisions without fetching or opening caches', async () => {
  const state = fixture();

  await expect(state.protocol.acquire('not-approved', state.revision)).resolves.toMatchObject({
    ok:false, error:'not-approved'
  });
  await expect(state.protocol.acquire('web', 'aaaaaaaaaaaaaaaa')).resolves.toMatchObject({
    ok:false, error:'not-approved'
  });
  await expect(state.protocol.promote('not-approved', state.revision)).resolves.toMatchObject({
    ok:false, error:'not-approved'
  });

  expect(state.fetchCount()).toBe(0);
  expect(await state.storage.keys()).toEqual([]);
});

test('acquisition constructs the exact approved same-origin GET without authorization', async () => {
  let captured;
  const state = fixture(request => {
    captured = request;
    return Promise.resolve(state.validResponse());
  });

  await expect(state.protocol.acquire('web', state.revision)).resolves.toMatchObject({ok:true});
  const url = new URL(captured.url);
  expect(url.origin).toBe('https://example.test');
  expect(url.pathname).toBe('/js/bible/web.js');
  expect(url.searchParams.get('god4-revision')).toBe(state.revision);
  expect([...url.searchParams.keys()]).toEqual(['god4-revision']);
  expect(captured.method).toBe('GET');
  expect(captured.headers.get('authorization')).toBeNull();
  expect(captured.credentials).toBe('same-origin');
  expect(captured.redirect).toBe('follow');
});

test('candidate verification rejects status, redirect, MIME, length, and integrity failures', async () => {
  const base = fixture();
  const redirectResponse = {
    ok:true,
    redirected:true,
    headers:new Headers({'content-type':'application/javascript'}),
    clone(){ return this; },
    arrayBuffer(){ return Promise.resolve(arrayBufferFor(base.body)); }
  };
  const sameLengthCorruption = 'x'.repeat(Buffer.byteLength(base.body));
  const cases = [
    {error:'http-status', response:new Response('unavailable', {status:503, headers:{'content-type':'application/javascript'}})},
    {error:'redirected', response:redirectResponse},
    {error:'mime', response:new Response(base.body, {status:200, headers:{'content-type':'text/plain'}})},
    {error:'length', response:new Response(base.body + 'x', {status:200, headers:{'content-type':'application/javascript'}})},
    {error:'integrity', response:new Response(sameLengthCorruption, {status:200, headers:{'content-type':'application/javascript'}})}
  ];

  for(const invalid of cases) {
    const state = fixture(() => Promise.resolve(invalid.response));
    const result = await state.protocol.acquire('web', state.revision);
    expect(result).toMatchObject({ok:false, error:invalid.error});
    expect(await state.storage.keys()).toEqual([]);
  }
});

test('verified candidate requires explicit promotion before it becomes active', async () => {
  const state = fixture();

  await expect(state.protocol.acquire('web', state.revision)).resolves.toMatchObject({
    ok:true, state:'candidate', cached:false
  });
  expect(await state.storage.keys()).toEqual([protocolModule.cacheNames.candidates]);
  await expect(state.protocol.status('web')).resolves.toMatchObject({activeRevision:null});

  const candidates = await state.storage.open(protocolModule.cacheNames.candidates);
  expect(await candidates.match(state.protocol.candidateKey('web', state.revision))).toBeTruthy();
  expect(await (await state.protocol.serveCandidate('web', state.revision)).text()).toBe(state.body);
  expect(await state.protocol.serveActive('web', state.revision)).toBeNull();

  await expect(state.protocol.promote('web', state.revision, {
    path:'/caller-controlled.js',
    integrity:'sha256-caller-controlled',
    bytes:1,
    structure:{bookCount:999, chapterCount:999, verseCount:999, books:[]}
  })).resolves.toMatchObject({
    ok:true, state:'ready', previousRevision:null, cleanupWarnings:[]
  });
  await expect(state.protocol.status('web')).resolves.toEqual({
    ok:true,
    id:'web',
    activeRevision:state.revision,
    active:activeMetadata(state)
  });

  expect(await candidates.match(state.protocol.candidateKey('web', state.revision))).toBeFalsy();
  const ready = await state.storage.open(protocolModule.cacheNames.ready);
  expect(await ready.match(state.protocol.readyKey('web', state.revision))).toBeTruthy();
  expect(await (await state.protocol.serveActive('web', state.revision)).text()).toBe(state.body);
  expect(await state.protocol.serveActive('web', 'aaaaaaaaaaaaaaaa')).toBeNull();
  const storedMetadata = await (await ready.match(state.protocol.activeKey('web'))).json();
  expect(storedMetadata).toEqual(activeMetadata(state));
  expect(Object.keys(storedMetadata).sort()).toEqual([
    'bytes', 'id', 'integrity', 'path', 'revision', 'structure'
  ]);
});

test('malformed active structure is rejected safely', async () => {
  const state = fixture();
  const ready = await state.storage.open(protocolModule.cacheNames.ready);
  await ready.put(state.protocol.readyKey('web', state.revision), state.validResponse());
  const malformed = activeMetadata(state);
  malformed.structure = {bookCount:1, chapterCount:1, verseCount:1, books:[]};
  await ready.put(state.protocol.activeKey('web'), new Response(JSON.stringify(malformed), {
    status:200,
    headers:{'content-type':'application/json'}
  }));

  await expect(state.protocol.status('web')).resolves.toEqual({
    ok:true,
    id:'web',
    activeRevision:null,
    active:null
  });
  await expect(state.protocol.serveActive('web', state.revision)).resolves.toBeNull();
});

test('failed replacement preserves old ready data and successful promotion removes it last', async () => {
  const state = fixture();
  const oldRevision = 'aaaaaaaaaaaaaaaa';
  await seedActive(state, oldRevision);

  state.setFetch(() => Promise.resolve(new Response(state.body + 'x', {
    status:200,
    headers:{'content-type':'application/javascript'}
  })));
  await expect(state.protocol.acquire('web', state.revision)).resolves.toMatchObject({
    ok:false, error:'length'
  });
  await expect(state.protocol.status('web')).resolves.toMatchObject({activeRevision:oldRevision});

  const ready = await state.storage.open(protocolModule.cacheNames.ready);
  expect(await ready.match(state.protocol.readyKey('web', oldRevision))).toBeTruthy();

  state.setFetch(() => Promise.resolve(state.validResponse()));
  await expect(state.protocol.acquire('web', state.revision)).resolves.toMatchObject({ok:true});
  await expect(state.protocol.promote('web', state.revision)).resolves.toMatchObject({
    ok:true, previousRevision:oldRevision
  });
  await expect(state.protocol.status('web')).resolves.toMatchObject({activeRevision:state.revision});
  expect(await ready.match(state.protocol.readyKey('web', oldRevision))).toBeFalsy();
  expect(await ready.match(state.protocol.readyKey('web', state.revision))).toBeTruthy();
});

test('simultaneous acquisitions share one worker-level fetch', async () => {
  let release;
  const gate = new Promise(resolve => { release = resolve; });
  const state = fixture(async () => {
    await gate;
    return state.validResponse();
  });

  const first = state.protocol.acquire('web', state.revision);
  const second = state.protocol.acquire('web', state.revision);
  const third = state.protocol.acquire('web', state.revision);
  expect(first).toBe(second);
  expect(second).toBe(third);
  await expect.poll(state.fetchCount).toBe(1);

  release();
  await expect(Promise.all([first, second, third])).resolves.toEqual([
    expect.objectContaining({ok:true}),
    expect.objectContaining({ok:true}),
    expect.objectContaining({ok:true})
  ]);
  expect(state.fetchCount()).toBe(1);
});

test('candidate cache-write failure is retryable', async () => {
  const state = fixture();
  state.storage.failNextPut(protocolModule.cacheNames.candidates);

  await expect(state.protocol.acquire('web', state.revision)).resolves.toMatchObject({
    ok:false, error:'cache-write'
  });
  expect(state.fetchCount()).toBe(1);

  await expect(state.protocol.acquire('web', state.revision)).resolves.toMatchObject({
    ok:true, state:'candidate'
  });
  expect(state.fetchCount()).toBe(2);
});

test('post-commit cleanup failures keep the new active revision committed', async () => {
  for(const failure of [
    {cache:protocolModule.cacheNames.candidates, key:'candidate/', warning:'candidate-delete'},
    {cache:protocolModule.cacheNames.ready, key:'ready/web/aaaaaaaaaaaaaaaa', warning:'obsolete-ready-delete'}
  ]) {
    const state = fixture();
    const oldRevision = 'aaaaaaaaaaaaaaaa';
    await seedActive(state, oldRevision);
    await state.protocol.acquire('web', state.revision);

    state.storage.failNextDelete(failure.cache, failure.key);
    const result = await state.protocol.promote('web', state.revision);
    expect(result).toMatchObject({
      ok:true,
      state:'ready',
      previousRevision:oldRevision,
      cleanupWarnings:[failure.warning]
    });
    await expect(state.protocol.status('web')).resolves.toMatchObject({
      ok:true,
      activeRevision:state.revision,
      active:activeMetadata(state)
    });

    const ready = await state.storage.open(protocolModule.cacheNames.ready);
    expect(await ready.match(state.protocol.readyKey('web', state.revision))).toBeTruthy();
    const candidates = await state.storage.open(protocolModule.cacheNames.candidates);
    if(failure.warning === 'candidate-delete'){
      expect(await candidates.match(state.protocol.candidateKey('web', state.revision))).toBeTruthy();
      expect(await ready.match(state.protocol.readyKey('web', oldRevision))).toBeFalsy();
    } else {
      expect(await candidates.match(state.protocol.candidateKey('web', state.revision))).toBeFalsy();
      expect(await ready.match(state.protocol.readyKey('web', oldRevision))).toBeTruthy();
    }
  }
});

test('ready or active metadata write failure preserves the previous active revision', async () => {
  for(const failure of ['ready/', 'active/']) {
    const state = fixture();
    const oldRevision = 'aaaaaaaaaaaaaaaa';
    await seedActive(state, oldRevision);
    await state.protocol.acquire('web', state.revision);

    state.storage.failNextPut(protocolModule.cacheNames.ready, failure);
    const result = await state.protocol.promote('web', state.revision);
    expect(result.ok).toBe(false);
    expect(['ready-write', 'active-write']).toContain(result.error);
    await expect(state.protocol.status('web')).resolves.toMatchObject({activeRevision:oldRevision});

    const ready = await state.storage.open(protocolModule.cacheNames.ready);
    expect(await ready.match(state.protocol.readyKey('web', oldRevision))).toBeTruthy();
    const candidates = await state.storage.open(protocolModule.cacheNames.candidates);
    expect(await candidates.match(state.protocol.candidateKey('web', state.revision))).toBeTruthy();
  }
});
