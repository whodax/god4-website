const {test, expect} = require('@playwright/test');
const fs = require('fs');
const path = require('path');
const {generateKeyPairSync, verify, webcrypto} = require('crypto');
const source = fs.readFileSync(path.join(__dirname, '../functions/api/tts.js'), 'utf8');
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
  const calls = [], tasks = [], stored = new Map();
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
  const handler = createTtsHandler({...runtime, crypto, now:() => {
    if(options.unknownFailure) throw new Error('sensitive-exception-sentinel');
    return clock;
  }, caches:{open:async () => {
    if(options.cacheFailure) throw new Error('No cache');
    return {match:async key => stored.get(key.url)?.clone(), put:async (key, response) => {
      if(options.putFailure) throw new Error('Cache full');
      stored.set(key.url, response.clone());
    }};
  }}, fetch:async (url, request) => {
    calls.push({url, request});
    expect(request.redirect).toBe('error');
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
      Response.json(options.missingAudio ? {} : {audioContent:options.badAudio ? '!!!' : Buffer.from('mock MP3 bytes').toString('base64')});
  }});
  async function run(body = {text:'In the beginning.', voice:'male', rate:1}, overrides = {}){
    const env = overrides.env || {CLOUD_TTS_ENABLED:'1', GOOGLE_TTS_SERVICE_ACCOUNT:JSON.stringify(
      options.badPem ? {...account, private_key:'-----BEGIN PRIVATE KEY-----\n!!!\n-----END PRIVATE KEY-----'} : account)};
    const request = new Request('https://god4.test/api/tts' + (overrides.query || ''), {method:overrides.method || 'POST',
      headers:{'Content-Type':'application/json', Origin:'https://god4.test', ...overrides.headers},
      ...(overrides.method === 'GET' || overrides.method === 'HEAD' ? {} : {body:overrides.raw ?? JSON.stringify(body)})});
    const response = await handler({request, env, waitUntil:promise => tasks.push(promise)});
    await Promise.all(tasks);
    return response;
  }
  return {run, calls, stored, advance:ms => {clock += ms;}};
}

const absentConfig = {
  cloudTtsEnabledPresent:false, cloudTtsEnabledExact:false,
  serviceAccountPresent:false, serviceAccountJsonValid:false, serviceAccountTypeValid:false,
  clientEmailPresent:false, privateKeyPresent:false, projectIdPresent:false
};

for(const [label, options, expected] of [
  ['OAuth fetch rejection', {fetchFailure:'oauth'}, {stage:'oauth-fetch', status:null}],
  ['synthesis fetch rejection', {fetchFailure:'synthesis'}, {stage:'synthesis-fetch', status:null}],
  ['OAuth AbortController failure', {controllerFailure:1}, {stage:'timer', status:null}],
  ['synthesis AbortController failure', {controllerFailure:2}, {stage:'timer', status:null}],
  ['OAuth timer setup failure', {timerFailure:1}, {stage:'timer', status:null}],
  ['synthesis timer setup failure', {timerFailure:2}, {stage:'timer', status:null}],
  ['cache Request construction failure', {requestFailure:true}, {stage:'request-build', status:null}],
  ['OAuth form construction failure', {formFailure:true}, {stage:'request-build', status:null}],
  ['fetch rejection with failed cleanup', {fetchFailure:'oauth', cleanupFailure:true}, {stage:'oauth-fetch', status:null}],
  ['OAuth HTTP failure with failed cleanup', {authFailure:true, authStatus:401, cleanupFailure:true}, {stage:'oauth', status:401}],
  ['digest failure', {cryptoFailure:'digest'}, {stage:'digest', status:null}],
  ['malformed PEM/base64', {badPem:true}, {stage:'private-key-decode', status:null}],
  ['importKey failure', {cryptoFailure:'importKey'}, {stage:'private-key-import', status:null}],
  ['sign failure', {cryptoFailure:'sign'}, {stage:'jwt-sign', status:null}],
  ['OAuth 400', {authFailure:true, authStatus:400}, {stage:'oauth', status:400}],
  ['OAuth 401', {authFailure:true, authStatus:401}, {stage:'oauth', status:401}],
  ['OAuth missing token fields', {tokenResponse:{}}, {stage:'oauth-response', status:200}],
  ['OAuth null JSON', {tokenResponse:null}, {stage:'oauth-response', status:200}],
  ['OAuth empty token', {tokenResponse:{access_token:'', expires_in:3600}}, {stage:'oauth-response', status:200}],
  ['OAuth invalid token type', {tokenResponse:{access_token:123, expires_in:3600}}, {stage:'oauth-response', status:200}],
  ['OAuth invalid expiry shape', {tokenResponse:{access_token:'mock-short-lived-token', expires_in:'3600'}}, {stage:'oauth-response', status:200}],
  ['OAuth insufficient expiry', {tokenResponse:{access_token:'mock-short-lived-token', expires_in:60}}, {stage:'oauth-response', status:200}],
  ['OAuth malformed JSON', {tokenInvalidJson:true}, {stage:'oauth-response', status:200}],
  ['synthesis 400', {providerFailure:true, providerStatus:400}, {stage:'synthesis', status:400}],
  ['synthesis 403', {providerFailure:true, providerStatus:403}, {stage:'synthesis', status:403}],
  ['missing audioContent', {missingAudio:true}, {stage:'audio-decode', status:200}],
  ['malformed audioContent', {badAudio:true}, {stage:'audio-decode', status:200}],
  ['unknown exception', {unknownFailure:true}, {stage:'unknown', status:null}]
]){
  test(`provider diagnostic reports only safe stage/status for ${label}`, async () => {
    const h = harness(options);
    const response = await h.run(undefined, {query:'?provider-debug=1'});
    expect(response.status).toBe(502);
    expect(response.headers.get('Cache-Control')).toBe('no-store');
    expect(response.headers.get('X-Content-Type-Options')).toBe('nosniff');
    const raw = await response.text();
    expect(JSON.parse(raw)).toEqual(expected);
    for(const value of ['sensitive provider failure', 'private Google details', 'sensitive-exception-sentinel',
      'sensitive-crypto-exception-sentinel', 'sensitive-runtime-exception-sentinel', 'invalid-json-secret-sentinel', 'BEGIN PRIVATE KEY',
      'mock-short-lived-token', account.client_email, account.project_id, account.private_key, 'assertion', 'access_token']){
      expect(raw.includes(value)).toBe(false);
    }
    expect(h.stored.size).toBe(0);
  });
  test(`normal POST retains generic 502 for ${label}`, async () => {
    const response = await harness(options).run();
    expect(response.status).toBe(502);
    expect(await response.json()).toEqual({error:'Cloud speech is unavailable.'});
  });
}

test('timer cleanup failure cannot turn successful synthesis into a diagnostic error', async () => {
  const response = await harness({cleanupFailure:true}).run(undefined, {query:'?provider-debug=1'});
  expect(response.status).toBe(200);
  expect(response.headers.get('Content-Type')).toBe('audio/mpeg');
  expect(await response.text()).toBe('mock MP3 bytes');
});

test('provider diagnostic requires the exact flag and keeps successful TTS and GET config behavior', async () => {
  for(const query of ['?provider-debug=0', '?provider-debug=true']){
    const response = await harness({authFailure:true}).run(undefined, {query});
    expect(await response.json()).toEqual({error:'Cloud speech is unavailable.'});
  }
  const h = harness();
  const response = await h.run(undefined, {query:'?provider-debug=1'});
  expect(response.status).toBe(200);
  expect(response.headers.get('Content-Type')).toBe('audio/mpeg');
  expect(await response.text()).toBe('mock MP3 bytes');
  expect(h.calls).toHaveLength(2);
  const config = await h.run(undefined, {method:'GET', query:'?config-debug=1&provider-debug=1', env:{}});
  expect(await config.json()).toEqual(absentConfig);
  const get = await h.run(undefined, {method:'GET', query:'?provider-debug=1'});
  expect(get.status).toBe(405);
  expect(await get.json()).toEqual({error:'Use POST.'});
  expect(h.calls).toHaveLength(2);
});
for(const [label, env, expected] of [
  ['both bindings absent', {}, absentConfig],
  ['enabled binding has wrong value', {CLOUD_TTS_ENABLED:'wrong-value-sentinel'},
    {...absentConfig, cloudTtsEnabledPresent:true}],
  ['enabled binding is empty', {CLOUD_TTS_ENABLED:''}, {...absentConfig, cloudTtsEnabledPresent:true}],
  ['malformed service-account JSON', {CLOUD_TTS_ENABLED:'1', GOOGLE_TTS_SERVICE_ACCOUNT:'malformed-secret-sentinel'},
    {...absentConfig, cloudTtsEnabledPresent:true, cloudTtsEnabledExact:true, serviceAccountPresent:true}],
  ['valid JSON with wrong type', {GOOGLE_TTS_SERVICE_ACCOUNT:'{"type":"wrong-type"}'},
    {...absentConfig, serviceAccountPresent:true, serviceAccountJsonValid:true}],
  ['valid null JSON', {GOOGLE_TTS_SERVICE_ACCOUNT:'null'},
    {...absentConfig, serviceAccountPresent:true, serviceAccountJsonValid:true}],
  ['missing private key', {CLOUD_TTS_ENABLED:'1', GOOGLE_TTS_SERVICE_ACCOUNT:JSON.stringify({
    type:'service_account', client_email:'email-sentinel', project_id:'project-sentinel'
  })}, {cloudTtsEnabledPresent:true, cloudTtsEnabledExact:true, serviceAccountPresent:true,
    serviceAccountJsonValid:true, serviceAccountTypeValid:true, clientEmailPresent:true, privateKeyPresent:false, projectIdPresent:true}],
  ['valid service-account JSON', {CLOUD_TTS_ENABLED:'1', GOOGLE_TTS_SERVICE_ACCOUNT:JSON.stringify({
    type:'service_account', client_email:'email-sentinel', private_key:'key-sentinel', project_id:'project-sentinel'
  })}, {cloudTtsEnabledPresent:true, cloudTtsEnabledExact:true, serviceAccountPresent:true,
    serviceAccountJsonValid:true, serviceAccountTypeValid:true, clientEmailPresent:true, privateKeyPresent:true, projectIdPresent:true}]
]){
  test(`config diagnostic reports only booleans for ${label}`, async () => {
    const h = harness();
    const response = await h.run(undefined, {method:'GET', query:'?config-debug=1', env});
    expect(response.status).toBe(200);
    expect(response.headers.get('Cache-Control')).toBe('no-store');
    expect(response.headers.get('X-Content-Type-Options')).toBe('nosniff');
    expect(response.headers.get('Content-Type')).toContain('application/json');
    expect(await response.json()).toEqual(expected);
    expect(h.calls).toHaveLength(0);
    expect(h.stored.size).toBe(0);
  });
}

test('config diagnostic cannot serialize any credential contents or identifying metadata', async () => {
  const h = harness();
  const response = await h.run(undefined, {method:'GET', query:'?config-debug=1', env:{
    CLOUD_TTS_ENABLED:'enabled-sentinel-not-one', GOOGLE_TTS_SERVICE_ACCOUNT:JSON.stringify(account)
  }});
  const raw = await response.text();
  const data = JSON.parse(raw);
  expect(Object.keys(data).sort()).toEqual(Object.keys(absentConfig).sort());
  expect(Object.values(data).every(value => typeof value === 'boolean')).toBe(true);
  for(const value of ['enabled-sentinel-not-one', account.client_email, account.project_id, account.private_key,
    'BEGIN PRIVATE KEY', 'client_email', 'private_key', 'project_id', 'mock-short-lived-token']){
    expect(raw.includes(value)).toBe(false);
  }
  expect(h.calls).toHaveLength(0);
});

test('only exact GET diagnostic query is enabled; POST with that query still synthesizes', async () => {
  const h = harness();
  for(const query of ['', '?config-debug=0', '?config-debug=true', '?other=1']){
    const response = await h.run(undefined, {method:'GET', query});
    expect(response.status).toBe(405);
    expect(response.headers.get('Allow')).toBe('POST');
    expect(await response.json()).toEqual({error:'Use POST.'});
  }
  expect((await h.run(undefined, {method:'HEAD', query:'?config-debug=1'})).status).toBe(405);
  expect(h.calls).toHaveLength(0);
  const response = await h.run(undefined, {query:'?config-debug=1'});
  expect(response.status).toBe(200);
  expect(response.headers.get('Content-Type')).toBe('audio/mpeg');
  expect(h.calls).toHaveLength(2);
});

for(const [voice, mapped] of [['male', 'en-US-Neural2-D'], ['female', 'en-US-Neural2-F']]){
  test(`${voice} maps exclusively to ${mapped} with signed OAuth and decoded audio bytes`, async () => {
    const h = harness();
    const response = await h.run({text:'<speak>Literal plain text</speak>', voice, rate:1.25});
    expect(response.status).toBe(200);
    expect(response.headers.get('Content-Type')).toBe('audio/mpeg');
    expect(response.headers.get('Cache-Control')).toBe('no-store');
    expect(await response.text()).toBe('mock MP3 bytes');
    expect(JSON.parse(h.calls[1].request.body)).toEqual({input:{text:'<speak>Literal plain text</speak>'},
      voice:{languageCode:'en-US', name:mapped}, audioConfig:{audioEncoding:'MP3', speakingRate:1.25, pitch:0}});
    expect([...h.stored.values()][0].headers.get('Cache-Control')).toBe('public, max-age=86400, immutable');
  });
}

test('identical requests hit the edge cache; text, profile and speed never collide', async () => {
  const h = harness();
  await h.run(); await h.run();
  expect(h.calls).toHaveLength(2);
  for(const body of [{text:'Different text.', voice:'male', rate:1},
    {text:'In the beginning.', voice:'female', rate:1}, {text:'In the beginning.', voice:'male', rate:1.5}]) await h.run(body);
  expect(h.stored.size).toBe(4);
  expect(h.calls.filter(call => call.url.includes('oauth2'))).toHaveLength(1);
  h.advance(3600000);
  await h.run({text:'After token expiration.', voice:'male', rate:1});
  expect(h.calls.filter(call => call.url.includes('oauth2'))).toHaveLength(2);
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
for(const failure of ['cacheFailure', 'putFailure']){
  test(`${failure} does not break synthesis`, async () => {
    expect((await harness({[failure]:true}).run()).status).toBe(200);
  });
}
