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
  const handler = createTtsHandler({crypto:webcrypto, now:() => clock, caches:{open:async () => {
    if(options.cacheFailure) throw new Error('No cache');
    return {match:async key => stored.get(key.url)?.clone(), put:async (key, response) => {
      if(options.putFailure) throw new Error('Cache full');
      stored.set(key.url, response.clone());
    }};
  }}, fetch:async (url, request) => {
    calls.push({url, request});
    expect(request.redirect).toBe('error');
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
      return options.authFailure ? Response.json({error:'sensitive provider failure'}, {status:401}) :
        Response.json({access_token:'mock-short-lived-token', expires_in:3600});
    }
    expect(url).toBe('https://texttospeech.googleapis.com/v1/text:synthesize');
    expect(request.headers.Authorization).toBe('Bearer mock-short-lived-token');
    expect(request.headers['x-goog-user-project']).toBe('mock-project');
    return options.providerFailure ? Response.json({error:'private Google details'}, {status:503}) :
      Response.json({audioContent:options.badAudio ? '!!!' : Buffer.from('mock MP3 bytes').toString('base64')});
  }});
  async function run(body = {text:'In the beginning.', voice:'male', rate:1}, overrides = {}){
    const env = overrides.env || {CLOUD_TTS_ENABLED:'1', GOOGLE_TTS_SERVICE_ACCOUNT:JSON.stringify(account)};
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
