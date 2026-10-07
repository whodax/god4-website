const {test, expect} = require('@playwright/test');
const fs = require('fs');
const path = require('path');
const {generateKeyPairSync, verify, webcrypto} = require('crypto');
const source = fs.readFileSync(path.join(__dirname, '../functions/api/tts.js'), 'utf8');
// Synthetic MPEG-1 Layer III frames; no external audio, credentials or provider quota.
const mp3 = Buffer.alloc(417 * 2);
for(const offset of [0, 417]) mp3.set([0xff, 0xfb, 0x90, 0xc4], offset);
let createTtsHandler;
let account;
let publicKey;
test.beforeAll(async () => {
  ({createTtsHandler} = await import('data:text/javascript;base64,' + Buffer.from(source).toString('base64')));
  const pair = generateKeyPairSync('rsa', {modulusLength:2048});
  publicKey = pair.publicKey;
  account = {type:'service_account', project_id:'mock-project', client_email:'mock@mock-project.iam.gserviceaccount.com',
    private_key:pair.privateKey.export({type:'pkcs8', format:'pem'})};
});

function harness(options = {}){
  const calls = [], tasks = [], stored = new Map(), limiterCalls = [];
  const limiter = {async fetch(url, request){
    limiterCalls.push({url, request, googleCalls:calls.length});
    if(options.limiterThrows) throw new Error('private limiter details');
    return new Response(null, {status:options.limiterStatus || 204});
  }};
  let clock = 1800000000000;
  const crypto = {subtle:Object.fromEntries(['digest', 'importKey', 'sign'].map(method => [method, (...args) => {
    if(options.cryptoFailure === method) return Promise.reject(new Error('sensitive-crypto-exception-sentinel'));
    return webcrypto.subtle[method](...args);
  }]))};
  let controllers = 0, timers = 0;
  const runtime = {
    AbortController:class extends AbortController {
      constructor(){
        if(++controllers === options.controllerFailure) throw new Error('sensitive-runtime-exception-sentinel');
        super();
      }
    },
    setTimeout(callback, delay){
      if(++timers === options.timerFailure) throw new Error('sensitive-runtime-exception-sentinel');
      return setTimeout(callback, delay);
    },
    clearTimeout(timer){
      clearTimeout(timer);
      if(options.cleanupFailure) throw new Error('sensitive-runtime-exception-sentinel');
    },
    Request:class extends Request {
      constructor(...args){
        if(options.requestFailure) throw new Error('sensitive-runtime-exception-sentinel');
        super(...args);
      }
    },
    URLSearchParams:class extends URLSearchParams {
      constructor(...args){
        if(options.formFailure) throw new Error('sensitive-runtime-exception-sentinel');
        super(...args);
      }
    }
  };
  const handlerRuntime = {...runtime, crypto, now:() => {
    if(options.unknownFailure) throw new Error('sensitive-exception-sentinel');
    return clock;
  }, caches:{open:async () => {
    if(options.cacheFailure) throw new Error('No cache');
    return {match:async key => stored.get(key.url)?.clone(), put:(key, response) => {
      if(options.putFailure) return Promise.reject(new Error('Cache full'));
      if(options.syncPutFailure) throw new Error('Cache setup failed');
      stored.set(key.url, response.clone());
      return Promise.resolve();
    }};
  }}, fetch:async (url, request) => {
    calls.push({url, request});
    expect(request.redirect).toBe('manual');
    const redirectStage = url === 'https://oauth2.googleapis.com/token' ? 'oauth' : 'synthesis';
    if(options.redirectStage === redirectStage) return new Response('private-redirect-body-sentinel', {
      status:options.redirectStatus, headers:{Location:'https://redirect-target.test/private-location-sentinel'}
    });
    const fetchStage = url === 'https://oauth2.googleapis.com/token' ? 'oauth' : 'synthesis';
    if(options.fetchFailure === fetchStage) throw new Error('sensitive-runtime-exception-sentinel');
    if(options.timeout) return new Promise((resolve, reject) => request.signal.addEventListener('abort', () => reject(new Error('Timed out'))));
    if(url === 'https://oauth2.googleapis.com/token'){
      const form = new URLSearchParams(request.body);
      expect(form.get('grant_type')).toBe('urn:ietf:params:oauth:grant-type:jwt-bearer');
      const jwt = form.get('assertion').split('.');
      expect(JSON.parse(Buffer.from(jwt[0], 'base64url'))).toEqual({alg:'RS256', typ:'JWT'});
      const claims = JSON.parse(Buffer.from(jwt[1], 'base64url'));
      expect(claims).toMatchObject({iss:account.client_email, aud:url, scope:'https://www.googleapis.com/auth/cloud-platform'});
      expect(claims.exp - claims.iat).toBe(3600);
      expect(verify('sha256', Buffer.from(jwt[0] + '.' + jwt[1]), publicKey, Buffer.from(jwt[2], 'base64url'))).toBe(true);
      if(options.tokenInvalidJson) return new Response('{invalid-json-secret-sentinel', {status:200});
      if(Object.prototype.hasOwnProperty.call(options, 'tokenResponse')) return Response.json(options.tokenResponse);
      return options.authFailure ? Response.json({error:'sensitive provider failure'}, {status:options.authStatus || 401}) :
        Response.json({access_token:'mock-short-lived-token', expires_in:3600});
    }
    expect(url).toBe('https://texttospeech.googleapis.com/v1/text:synthesize');
    expect(request.headers.Authorization).toBe('Bearer mock-short-lived-token');
    expect(request.headers['x-goog-user-project']).toBe('mock-project');
    return options.providerFailure ? Response.json({error:'private Google details'}, {status:options.providerStatus || 503}) :
      Response.json(options.malformedSynthesis ? null : options.missingAudio ? {} : {audioContent:options.badAudio ? '!!!' : (options.audioBytes || mp3).toString('base64')});
  }};
  const injectedFetch = handlerRuntime.fetch;
  if(options.globalFetch) delete handlerRuntime.fetch;
  const handler = createTtsHandler(handlerRuntime);
  async function run(body = {text:'In the beginning.', voice:'male', rate:1}, overrides = {}){
    const env = overrides.env || {CLOUD_TTS_ENABLED:'1', GOOGLE_TTS_SERVICE_ACCOUNT:JSON.stringify(
      options.badPem ? {...account, private_key:'-----BEGIN PRIVATE KEY-----\n!!!\n-----END PRIVATE KEY-----'} : account)};
    if(!options.missingLimiter) env.TTS_RATE_LIMITER = limiter;
    const headers = new Headers({'Content-Type':'application/json', Origin:'https://god4.test',
      'CF-Connecting-IP':'192.0.2.1', ...overrides.headers});
    if(overrides.noOrigin) headers.delete('Origin');
    if(overrides.noIp) headers.delete('CF-Connecting-IP');
    const request = new Request('https://god4.test/api/tts' + (overrides.query || ''), {method:overrides.method || 'POST',
      headers,
      ...(overrides.method === 'GET' || overrides.method === 'HEAD' ? {} : {body:overrides.raw ?? JSON.stringify(body)})});
    const response = await handler({request, env, waitUntil:promise => tasks.push(promise)});
    await Promise.all(tasks);
    return response;
  }
  return {run, calls, stored, limiterCalls, fetch:injectedFetch, advance:ms => {clock += ms;}};
}

test('production fetch is not read at initialization and is resolved directly for each subrequest', async () => {
  const original = Object.getOwnPropertyDescriptor(globalThis, 'fetch');
  let initializationReads = 0;
  try{
    Object.defineProperty(globalThis, 'fetch', {configurable:true, get(){
      initializationReads++;
      return () => { throw new Error('stale-fetch-sentinel'); };
    }});
    const h = harness({globalFetch:true});
    expect(initializationReads).toBe(0);
    let oauthCalls = 0, synthesisCalls = 0;
    Object.defineProperty(globalThis, 'fetch', {configurable:true, writable:true, value:function(...args){
      expect(this === globalThis).toBe(true);
      oauthCalls++;
      globalThis.fetch = function(...nextArgs){
        expect(this === globalThis).toBe(true);
        synthesisCalls++;
        return h.fetch(...nextArgs);
      };
      return h.fetch(...args);
    }});
    const response = await h.run();
    expect(response.status).toBe(200);
    expect(Buffer.from(await response.arrayBuffer()).equals(mp3)).toBe(true);
    expect(oauthCalls).toBe(1);
    expect(synthesisCalls).toBe(1);
    expect(h.calls).toHaveLength(2);
  }finally{ Object.defineProperty(globalThis, 'fetch', original); }
});

test('injected fetch remains independent of the production global fetch', async () => {
  const original = globalThis.fetch;
  try{
    const h = harness();
    globalThis.fetch = () => { throw new Error('global-fetch-must-not-run-sentinel'); };
    expect((await h.run()).status).toBe(200);
    expect(h.calls).toHaveLength(2);
  }finally{ globalThis.fetch = original; }
});

for(const stage of ['oauth', 'synthesis']){
  for(const status of [301, 302, 303, 307, 308]){
    test(`${stage} ${status} is not followed and exposes only the generic error`, async () => {
      const h = harness({redirectStage:stage, redirectStatus:status});
      const response = await h.run(undefined, {});
      expect(response.status).toBe(502);
      expect(response.headers.get('Cache-Control')).toBe('no-store');
      expect(response.headers.has('Location')).toBe(false);
      expect(await response.json()).toEqual({error:'Cloud speech is unavailable.'});
      expect(h.calls).toHaveLength(stage === 'oauth' ? 1 : 2);
      expect(h.calls.every(call => call.request.redirect === 'manual')).toBe(true);
      expect(h.calls.some(call => call.url.includes('redirect-target.test'))).toBe(false);
      expect(h.stored.size).toBe(0);
      const generic = await harness({redirectStage:stage, redirectStatus:status}).run();
      expect(generic.status).toBe(502);
      expect(await generic.json()).toEqual({error:'Cloud speech is unavailable.'});
      expect(generic.headers.has('Location')).toBe(false);
    });
  }
}

for(const [label, options] of [
  ['OAuth fetch rejection', {fetchFailure:'oauth'}],
  ['synthesis fetch rejection', {fetchFailure:'synthesis'}],
  ['OAuth AbortController failure', {controllerFailure:1}],
  ['synthesis AbortController failure', {controllerFailure:2}],
  ['OAuth timer setup failure', {timerFailure:1}],
  ['synthesis timer setup failure', {timerFailure:2}],
  ['cache Request construction failure', {requestFailure:true}],
  ['OAuth form construction failure', {formFailure:true}],
  ['fetch rejection with failed cleanup', {fetchFailure:'oauth', cleanupFailure:true}],
  ['OAuth HTTP failure with failed cleanup', {authFailure:true, authStatus:401, cleanupFailure:true}],
  ['digest failure', {cryptoFailure:'digest'}],
  ['malformed PEM/base64', {badPem:true}],
  ['importKey failure', {cryptoFailure:'importKey'}],
  ['sign failure', {cryptoFailure:'sign'}],
  ['OAuth 400', {authFailure:true, authStatus:400}],
  ['OAuth 401', {authFailure:true, authStatus:401}],
  ['OAuth missing token fields', {tokenResponse:{}}],
  ['OAuth null JSON', {tokenResponse:null}],
  ['OAuth empty token', {tokenResponse:{access_token:'', expires_in:3600}}],
  ['OAuth invalid token type', {tokenResponse:{access_token:123, expires_in:3600}}],
  ['OAuth invalid expiry shape', {tokenResponse:{access_token:'mock-short-lived-token', expires_in:'3600'}}],
  ['OAuth insufficient expiry', {tokenResponse:{access_token:'mock-short-lived-token', expires_in:60}}],
  ['OAuth malformed JSON', {tokenInvalidJson:true}],
  ['synthesis 400', {providerFailure:true, providerStatus:400}],
  ['synthesis 403', {providerFailure:true, providerStatus:403}],
  ['missing audioContent', {missingAudio:true}],
  ['malformed audioContent', {badAudio:true}],
  ['unknown exception', {unknownFailure:true}]
]){
  test(`provider/runtime failure is generic and uncached: ${label}`, async () => {
    const h = harness(options);
    const response = await h.run();
    expect(response.status).toBe(502);
    expect(response.headers.get('Cache-Control')).toBe('no-store');
    expect(response.headers.get('X-Content-Type-Options')).toBe('nosniff');
    expect(await response.json()).toEqual({error:'Cloud speech is unavailable.'});
    expect(h.stored.size).toBe(0);
  });
}

test('timer cleanup failure does not break successful synthesis', async () => {
  const response = await harness({cleanupFailure:true}).run();
  expect(response.status).toBe(200);
  expect(Buffer.from(await response.arrayBuffer()).equals(mp3)).toBe(true);
});

for(const query of ['?config-debug=1', '?provider-debug=1', '?config-debug=1&provider-debug=1']){
  test(`removed debug query has no privileged behavior: ${query}`, async () => {
    const h = harness({authFailure:true});
    const get = await h.run(undefined, {method:'GET', query});
    expect(get.status).toBe(405);
    expect(await get.json()).toEqual({error:'Use POST.'});
    expect(h.calls).toHaveLength(0);
    const post = await h.run(undefined, {query});
    expect(post.status).toBe(502);
    expect(await post.json()).toEqual({error:'Cloud speech is unavailable.'});
  });
}

test('production source has no dormant diagnostic branches or logging', () => {
  expect(/config-debug|provider-debug|ProviderFailure|console\./.test(source)).toBe(false);
});

for(const [voice, mapped] of [['male', 'en-US-Neural2-D'], ['female', 'en-US-Neural2-F']]){
  test(`${voice} maps exclusively to ${mapped} with signed OAuth and decoded audio bytes`, async () => {
    const h = harness();
    const response = await h.run({text:'<speak>Literal plain text</speak>', voice, rate:1.25});
    expect(response.status).toBe(200);
    expect(response.headers.get('Content-Type')).toBe('audio/mpeg');
    expect(response.headers.get('Cache-Control')).toBe('no-store');
    expect(Buffer.from(await response.arrayBuffer()).equals(mp3)).toBe(true);
    expect(JSON.parse(h.calls[1].request.body)).toEqual({input:{text:'<speak>Literal plain text</speak>'},
      voice:{languageCode:'en-US', name:mapped}, audioConfig:{audioEncoding:'MP3', speakingRate:1.25, pitch:0}});
    expect([...h.stored.values()][0].headers.get('Cache-Control')).toBe('public, max-age=2592000, immutable');
  });
}

test('identical requests hit the edge cache; text, profile and speed never collide', async () => {
  const h = harness();
  await h.run();
  const originalKey = [...h.stored.keys()][0];
  const hit = await h.run();
  expect(hit.status).toBe(200);
  expect(hit.headers.get('Cache-Control')).toBe('no-store');
  expect([...h.stored.keys()]).toEqual([originalKey]);
  expect(h.calls).toHaveLength(2);
  expect(h.limiterCalls).toHaveLength(1);
  for(const body of [{text:'Different text.', voice:'male', rate:1},
    {text:'In the beginning.', voice:'female', rate:1}, {text:'In the beginning.', voice:'male', rate:1.5}]) await h.run(body);
  expect(h.stored.size).toBe(4);
  expect(h.calls.filter(call => call.url.includes('oauth2'))).toHaveLength(1);
  h.advance(3600000);
  await h.run({text:'After token expiration.', voice:'male', rate:1});
  expect(h.calls.filter(call => call.url.includes('oauth2'))).toHaveLength(2);
  for(const key of h.stored.keys()){
    expect(new URL(key).pathname).toMatch(/^\/__god4\/tts\/[a-f0-9]{64}$/);
    expect(['In the beginning.', 'Different text.', account.private_key, account.client_email, account.project_id]
      .some(value => key.includes(value))).toBe(false);
  }
});

test('invalid cached audio is a miss and is replaced by valid synthesis', async () => {
  const h = harness();
  await h.run();
  const key = [...h.stored.keys()][0];
  h.stored.set(key, new Response('invalid audio', {headers:{'Content-Type':'audio/mpeg'}}));
  const response = await h.run();
  expect(response.status).toBe(200);
  expect(Buffer.from(await response.arrayBuffer()).equals(mp3)).toBe(true);
  expect(h.calls).toHaveLength(3);
  expect(Buffer.from(await h.stored.get(key).clone().arrayBuffer()).equals(mp3)).toBe(true);
});

for(const [label, bytes] of [
  ['empty audio', Buffer.alloc(0)], ['non-MP3 audio', Buffer.from('not audio')],
  ['truncated MP3', mp3.subarray(0, 100)], ['truncated final frame', mp3.subarray(0, 500)],
  ['ID3 without frames', Buffer.from([73,68,51,4,0,0,0,0,0,0])]
]){
  test(`${label} returns generic 502, is never cached and remains retryable`, async () => {
    const options = {audioBytes:bytes};
    const h = harness(options);
    const failed = await h.run();
    expect(failed.status).toBe(502);
    expect(await failed.json()).toEqual({error:'Cloud speech is unavailable.'});
    expect(h.stored.size).toBe(0);
    options.audioBytes = mp3;
    expect((await h.run()).status).toBe(200);
    expect(h.stored.size).toBe(1);
  });
}

test('MP3 frames with bounded ID3 metadata are accepted', async () => {
  const tagged = Buffer.concat([Buffer.from([73,68,51,4,0,0,0,0,0,0]), mp3]);
  expect((await harness({audioBytes:tagged}).run()).status).toBe(200);
});

test('24kHz MPEG-2 Layer III frames and trailing ID3v1 metadata are accepted', async () => {
  const mpeg2 = Buffer.alloc(192 * 77);
  for(let offset = 0; offset < mpeg2.length; offset += 192) mpeg2.set([0xff, 0xf3, 0x84, 0xc4], offset);
  const tag = Buffer.alloc(128); tag.write('TAG');
  expect((await harness({audioBytes:Buffer.concat([mpeg2, tag])}).run()).status).toBe(200);
});

test('service-account material is not present in Wrangler or tracked secret files', () => {
  const {execFileSync} = require('child_process');
  const root = path.join(__dirname, '..');
  expect(execFileSync('git', ['ls-files', '--', '.env*', '.dev.vars*'], {cwd:root, encoding:'utf8'}).trim()).toBe('');
  const config = fs.readFileSync(path.join(root, 'wrangler.toml'), 'utf8');
  expect(/^\s*GOOGLE_TTS_SERVICE_ACCOUNT\s*=/m.test(config)).toBe(false);
  expect(config.includes('BEGIN PRIVATE KEY')).toBe(false);
});

test('malformed synthesis JSON is generic, uncached and retryable', async () => {
  const options = {malformedSynthesis:true};
  const h = harness(options);
  expect((await h.run()).status).toBe(502);
  expect(h.stored.size).toBe(0);
  options.malformedSynthesis = false;
  expect((await h.run()).status).toBe(200);
});

test('exact browser Origin is required and Sec-Fetch-Site permits only same-origin', async () => {
  const h = harness();
  for(const overrides of [{noOrigin:true}, {headers:{Origin:''}}, {headers:{Origin:'null'}},
    {headers:{Origin:'https://god4.test/'}}, {headers:{Origin:'http://god4.test'}},
    ...['cross-site', 'same-site', 'none', ''].map(site => ({headers:{'Sec-Fetch-Site':site}}))]){
    const response = await h.run(undefined, overrides);
    expect(response.status).toBe(403);
    expect(response.headers.has('Access-Control-Allow-Origin')).toBe(false);
  }
  expect(h.calls).toHaveLength(0);
  expect(h.limiterCalls).toHaveLength(0);
  expect((await h.run(undefined, {headers:{'Sec-Fetch-Site':'same-origin'}})).status).toBe(200);
  expect((await h.run()).status).toBe(200);
});

test('public failures never return credential material or provider metadata', async () => {
  for(const options of [{authFailure:true}, {providerFailure:true}, {cryptoFailure:'sign'}, {badAudio:true}, {unknownFailure:true}]){
    const response = await harness(options).run();
    expect(response.status).toBe(502);
    expect(await response.json()).toEqual({error:'Cloud speech is unavailable.'});
    expect(response.headers.has('Location')).toBe(false);
    expect(response.headers.get('Cache-Control')).toBe('no-store');
  }
});

for(const [label, body, status] of [
  ['arbitrary voice', {text:'Verse', voice:'en-US-Neural2-D', rate:1}, 400],
  ['prototype voice', {text:'Verse', voice:'__proto__', rate:1}, 400],
  ['empty text', {text:'  ', voice:'male', rate:1}, 400],
  ['oversized text', {text:'a'.repeat(4001), voice:'male', rate:1}, 413],
  ['UTF-8 byte limit', {text:'é'.repeat(2001), voice:'male', rate:1}, 413],
  ['invalid rate', {text:'Verse', voice:'male', rate:1.1}, 400],
  ['string rate', {text:'Verse', voice:'male', rate:'1'}, 400],
  ['missing rate', {text:'Verse', voice:'male'}, 400],
  ['below range', {text:'Verse', voice:'male', rate:0.25}, 400],
  ['above range', {text:'Verse', voice:'male', rate:3}, 400],
  ['Reader 2.25 local fallback', {text:'Verse', voice:'male', rate:2.25}, 422],
  ['Reader 2.5 local fallback', {text:'Verse', voice:'male', rate:2.5}, 422],
  ['client SSML option', {text:'Verse', voice:'male', rate:1, ssml:'<speak>Verse</speak>'}, 400],
  ['client language', {text:'Verse', voice:'male', rate:1, lang:'en-GB'}, 400],
  ['array request', [], 400], ['null request', null, 400]
]){
  test(`rejects ${label} without contacting Google`, async () => {
    const h = harness();
    expect((await h.run(body)).status).toBe(status);
    expect(h.calls).toHaveLength(0);
    expect(h.stored.size).toBe(0);
    expect(h.limiterCalls).toHaveLength(0);
  });
}

test('HTTP method, media type, JSON size and cross-origin checks run before provider access', async () => {
  const h = harness();
  for(const method of ['GET', 'HEAD', 'PUT', 'OPTIONS']){
    const response = await h.run(undefined, {method});
    expect(response.status).toBe(405); expect(response.headers.get('Allow')).toBe('POST');
  }
  expect((await h.run(undefined, {headers:{'Content-Type':'text/plain'}})).status).toBe(415);
  expect((await h.run(undefined, {headers:{Origin:'https://other.test'}})).status).toBe(403);
  expect((await h.run(undefined, {headers:{'Sec-Fetch-Site':'same-site'}})).status).toBe(403);
  expect((await h.run(undefined, {raw:'{bad'})).status).toBe(400);
  expect((await h.run(undefined, {raw:' '.repeat(32769)})).status).toBe(413);
  expect(h.calls).toHaveLength(0);
});

test('disabled or missing/malformed credentials are safe even with cached audio', async () => {
  const h = harness();
  await h.run();
  for(const env of [{}, {CLOUD_TTS_ENABLED:'0', GOOGLE_TTS_SERVICE_ACCOUNT:JSON.stringify(account)},
    {CLOUD_TTS_ENABLED:'1', GOOGLE_TTS_SERVICE_ACCOUNT:'bad JSON'},
    {CLOUD_TTS_ENABLED:'1', GOOGLE_TTS_SERVICE_ACCOUNT:'{}'}]){
    const response = await h.run(undefined, {env});
    expect(response.status).toBe(503);
    expect(await response.json()).toEqual({error:'Cloud speech is unavailable.'});
  }
  expect(h.calls).toHaveLength(2);
});

for(const failure of ['authFailure', 'providerFailure', 'badAudio', 'timeout']){
  test(`${failure} returns a sanitized uncached error`, async () => {
    const h = harness({[failure]:true});
    const response = await h.run();
    expect(response.status).toBe(502);
    expect(response.headers.get('Cache-Control')).toBe('no-store');
    expect(await response.json()).toEqual({error:'Cloud speech is unavailable.'});
    expect(h.stored.size).toBe(0);
  });
}
for(const failure of ['cacheFailure', 'putFailure', 'syncPutFailure']){
  test(`${failure} does not break synthesis`, async () => {
    expect((await harness({[failure]:true}).run()).status).toBe(200);
  });
}

test('uncached synthesis invokes the private limiter exactly once before any Google request', async () => {
  const h = harness();
  expect((await h.run()).status).toBe(200);
  expect(h.limiterCalls).toHaveLength(1);
  const call = h.limiterCalls[0];
  expect(call.googleCalls).toBe(0);
  expect(call.url).toBe('https://tts-rate-limit.internal/check');
  expect(call.request).toEqual({method:'POST', headers:{'Content-Type':'application/json'},
    body:JSON.stringify({key:'192.0.2.1'}), redirect:'manual'});
  expect(h.calls).toHaveLength(2);
});

test('denied synthesis is generic 429, retryable and never contacts Google or caches audio', async () => {
  const h = harness({limiterStatus:429});
  for(let attempt = 0; attempt < 2; attempt++){
    const response = await h.run();
    expect(response.status).toBe(429);
    expect(response.headers.get('Content-Type')).toContain('application/json');
    expect(response.headers.get('Cache-Control')).toBe('no-store');
    expect(response.headers.get('Retry-After')).toBe('10');
    expect(await response.json()).toEqual({error:'Cloud speech is temporarily unavailable.'});
  }
  expect(h.limiterCalls).toHaveLength(2);
  expect(h.calls).toHaveLength(0);
  expect(h.stored.size).toBe(0);
});

for(const [label, options] of [
  ['missing service binding', {missingLimiter:true}], ['binding exception', {limiterThrows:true}],
  ['internal failure', {limiterStatus:503}], ['unexpected success', {limiterStatus:200}],
  ['redirect', {limiterStatus:302}]
]){
  test(`limiter ${label} fails closed with generic 503 before Google`, async () => {
    const h = harness(options);
    const response = await h.run();
    expect(response.status).toBe(503);
    expect(response.headers.get('Cache-Control')).toBe('no-store');
    expect(await response.json()).toEqual({error:'Cloud speech is unavailable.'});
    expect(h.calls).toHaveLength(0);
    expect(h.stored.size).toBe(0);
  });
}

test('missing trusted edge IP fails closed and custom/forwarded headers cannot substitute', async () => {
  const h = harness();
  for(const overrides of [{noIp:true}, {noIp:true, headers:{'X-Client-IP':'192.0.2.3',
    'X-Forwarded-For':'192.0.2.4'}}, {headers:{'CF-Connecting-IP':''}},
    {headers:{'CF-Connecting-IP':'not-an-ip'}}]){
    const response = await h.run(undefined, overrides);
    expect(response.status).toBe(503);
    expect(await response.json()).toEqual({error:'Cloud speech is unavailable.'});
  }
  expect(h.limiterCalls).toHaveLength(0);
  expect(h.calls).toHaveLength(0);
});

test('edge-derived IPs are distinct keys and no verse, token or credential is sent to the limiter', async () => {
  const h = harness({limiterStatus:429});
  for(const ip of ['192.0.2.1','192.0.2.2','2001:db8::1']){
    await h.run(undefined, {headers:{'CF-Connecting-IP':ip, 'X-Client-IP':'203.0.113.1'}});
  }
  expect(h.limiterCalls.map(call => JSON.parse(call.request.body))).toEqual([
    {key:'192.0.2.1'}, {key:'192.0.2.2'}, {key:'2001:db8::1'}
  ]);
});

test('validated cache hit bypasses the limiter even without IP; invalid cached MP3 must obtain permission', async () => {
  const h = harness();
  await h.run();
  const hit = await h.run(undefined, {noIp:true});
  expect(hit.status).toBe(200);
  expect(hit.headers.get('Cache-Control')).toBe('no-store');
  expect(h.limiterCalls).toHaveLength(1);
  expect(h.calls).toHaveLength(2);
  h.stored.set([...h.stored.keys()][0], new Response('invalid audio', {headers:{'Content-Type':'audio/mpeg'}}));
  const response = await h.run(undefined, {noIp:true});
  expect(response.status).toBe(503);
  expect(h.limiterCalls).toHaveLength(1);
  expect(h.calls).toHaveLength(2);
});

test('malformed JSON and disabled backend return before limiter evaluation', async () => {
  const h = harness();
  expect((await h.run(undefined, {raw:'{broken'})).status).toBe(400);
  expect((await h.run(undefined, {env:{CLOUD_TTS_ENABLED:'0',
    GOOGLE_TTS_SERVICE_ACCOUNT:JSON.stringify(account)}})).status).toBe(503);
  expect(h.limiterCalls).toHaveLength(0);
  expect(h.calls).toHaveLength(0);
});

test('Pages configuration preserves preview/production flags and binds only the private Worker', () => {
  const config = fs.readFileSync(path.join(__dirname, '../wrangler.toml'), 'utf8').replace(/\r\n/g, '\n');
  expect(config).toMatch(/\[env.preview.vars\]\s+CLOUD_TTS_ENABLED = "1"/);
  expect(config).toMatch(/\[env.production.vars\]\s+CLOUD_TTS_ENABLED = "0"/);
  for(const name of ['preview','production']){
    expect(config).toContain(`[[env.${name}.services]]\nbinding = "TTS_RATE_LIMITER"\nservice = "god4-tts-rate-limit"`);
  }
  expect(config).not.toContain('[[ratelimits]]');
});
