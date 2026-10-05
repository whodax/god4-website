// Pages-only OAuth and synthesis. No credentials or provider details reach clients.
const VOICES = {male:'en-US-Neural2-D', female:'en-US-Neural2-F'};
const RATES = [0.5, 0.75, 1, 1.25, 1.5, 1.75, 2, 2.25, 2.5];
const TOKEN_URL = 'https://oauth2.googleapis.com/token';
const SYNTHESIS_URL = 'https://texttospeech.googleapis.com/v1/text:synthesize';
const encoder = new TextEncoder();
const MAX_TEXT_BYTES = 4000;
const MAX_BODY_BYTES = 32768;
const CONFIG_VERSION = 'neural2-v1-mp3-pitch0-1';

function error(status, message, headers = {}){
  return Response.json({error:message}, {status, headers:{
    'Cache-Control':'no-store', 'X-Content-Type-Options':'nosniff', ...headers
  }});
}
function base64url(bytes){
  return btoa(String.fromCharCode(...bytes)).replace(/\+/g, '-').replace(/\//g, '_').replace(/=+$/, '');
}
async function readBody(request){
  const reader = request.body && request.body.getReader();
  if(!reader) return '';
  const chunks = [];
  let length = 0;
  try{
    while(true){
      const {value, done} = await reader.read();
      if(done) break;
      length += value.byteLength;
      if(length > MAX_BODY_BYTES){ await reader.cancel(); throw new RangeError('Body too large'); }
      chunks.push(value);
    }
  }finally{ reader.releaseLock(); }
  const bytes = new Uint8Array(length);
  let offset = 0;
  for(const chunk of chunks){ bytes.set(chunk, offset); offset += chunk.length; }
  return new TextDecoder('utf-8', {fatal:true}).decode(bytes);
}

// Dependency injection lets automated tests use real JWT crypto with mocked Google/Cache APIs.
export function createTtsHandler(runtime = {}){
  const requestFetch = runtime.fetch || globalThis.fetch;
  const webCrypto = runtime.crypto || globalThis.crypto;
  const cacheStorage = runtime.caches || globalThis.caches;
  const now = runtime.now || Date.now;
  let tokenState = null;

  async function timedFetch(url, options){
    const controller = new AbortController();
    const timer = setTimeout(() => controller.abort(), 8000);
    try{
      const response = await requestFetch(url, {...options, redirect:'error', signal:controller.signal});
      if(!response.ok) throw new Error('Provider unavailable');
      // Keep the timeout through body consumption, not just response headers.
      return await response.json();
    }finally{ clearTimeout(timer); }
  }
  async function accessToken(account, secret){
    if(tokenState && tokenState.secret === secret && tokenState.expires > now()) return tokenState.value;
    // Only completed token data is reused. In-flight I/O belongs to its request.
    const issued = Math.floor(now() / 1000);
    const header = base64url(encoder.encode(JSON.stringify({alg:'RS256', typ:'JWT'})));
    const claims = base64url(encoder.encode(JSON.stringify({
      iss:account.client_email, scope:'https://www.googleapis.com/auth/cloud-platform',
      aud:TOKEN_URL, iat:issued, exp:issued + 3600
    })));
    const pem = account.private_key.replace(/-----BEGIN PRIVATE KEY-----|-----END PRIVATE KEY-----|\s/g, '');
    const bytes = Uint8Array.from(atob(pem), character => character.charCodeAt(0));
    const key = await webCrypto.subtle.importKey('pkcs8', bytes,
      {name:'RSASSA-PKCS1-v1_5', hash:'SHA-256'}, false, ['sign']);
    const signature = await webCrypto.subtle.sign('RSASSA-PKCS1-v1_5', key, encoder.encode(header + '.' + claims));
    const assertion = header + '.' + claims + '.' + base64url(new Uint8Array(signature));
    const token = await timedFetch(TOKEN_URL, {method:'POST', headers:{'Content-Type':'application/x-www-form-urlencoded'},
      body:new URLSearchParams({grant_type:'urn:ietf:params:oauth:grant-type:jwt-bearer', assertion}).toString()});
    if(typeof token.access_token !== 'string' || !token.access_token ||
        !Number.isFinite(token.expires_in) || token.expires_in < 120) throw new Error('Invalid token');
    tokenState = {secret, value:token.access_token, expires:now() + (Math.min(token.expires_in, 3600) - 60) * 1000};
    return token.access_token;
  }

  return async function handle(context){
    const {request, env} = context;
    if(request.method === 'GET' && new URL(request.url).searchParams.get('config-debug') === '1'){
      const bindings = env || {};
      const present = value => value !== undefined && value !== null;
      let account = null;
      let jsonValid = false;
      try{
        account = JSON.parse(bindings.GOOGLE_TTS_SERVICE_ACCOUNT);
        jsonValid = true;
      }catch(failure){ /* Report only a boolean; never return parsing errors or input. */ }
      return Response.json({
        cloudTtsEnabledPresent:present(bindings.CLOUD_TTS_ENABLED),
        cloudTtsEnabledExact:bindings.CLOUD_TTS_ENABLED === '1',
        serviceAccountPresent:present(bindings.GOOGLE_TTS_SERVICE_ACCOUNT),
        serviceAccountJsonValid:jsonValid,
        serviceAccountTypeValid:Boolean(account && account.type === 'service_account'),
        clientEmailPresent:Boolean(account && account.client_email),
        privateKeyPresent:Boolean(account && account.private_key),
        projectIdPresent:Boolean(account && account.project_id)
      }, {headers:{'Cache-Control':'no-store', 'X-Content-Type-Options':'nosniff'}});
    }
    if(request.method !== 'POST') return error(405, 'Use POST.', {Allow:'POST'});
    const origin = new URL(request.url).origin;
    const suppliedOrigin = request.headers.get('Origin');
    const site = request.headers.get('Sec-Fetch-Site');
    if((suppliedOrigin && suppliedOrigin !== origin) || (site && site !== 'same-origin' && site !== 'none')){
      return error(403, 'Same-origin requests only.');
    }
    if(!/^application\/json(?:\s*;|$)/i.test(request.headers.get('Content-Type') || '')){
      return error(415, 'Use application/json.');
    }
    if(Number(request.headers.get('Content-Length')) > MAX_BODY_BYTES) return error(413, 'Request too large.');
    let body;
    try{ body = JSON.parse(await readBody(request)); }
    catch(failure){ return error(failure instanceof RangeError ? 413 : 400, 'Invalid JSON request.'); }
    if(!body || typeof body !== 'object' || Array.isArray(body) ||
        Object.keys(body).some(key => !['text', 'voice', 'rate'].includes(key))){
      return error(400, 'Only text, voice and rate are permitted.');
    }
    if(typeof body.text !== 'string' || !body.text.trim()) return error(400, 'Text is required.');
    if(encoder.encode(body.text).length > MAX_TEXT_BYTES) return error(413, 'Text too large.');
    if(body.voice !== 'male' && body.voice !== 'female') return error(400, 'Invalid voice.');
    if(typeof body.rate !== 'number' || !RATES.includes(body.rate)) return error(400, 'Invalid rate.');
    // Google v1 supports at most 2.0. Preserve higher Reader speeds through local fallback.
    if(body.rate > 2) return error(422, 'Use local speech for this rate.');
    if(!env || env.CLOUD_TTS_ENABLED !== '1' || !env.GOOGLE_TTS_SERVICE_ACCOUNT){
      return error(503, 'Cloud speech is unavailable.');
    }
    let account;
    try{
      account = JSON.parse(env.GOOGLE_TTS_SERVICE_ACCOUNT);
      if(account.type !== 'service_account' || !account.client_email || !account.private_key || !account.project_id){
        throw new Error('Invalid account');
      }
    }catch(failure){ return error(503, 'Cloud speech is unavailable.'); }

    try{
      const digest = await webCrypto.subtle.digest('SHA-256', encoder.encode(JSON.stringify([
        CONFIG_VERSION, account.project_id, body.text, body.voice, VOICES[body.voice], body.rate
      ])));
      const hash = Array.from(new Uint8Array(digest), byte => byte.toString(16).padStart(2, '0')).join('');
      const cacheKey = new Request(origin + '/__god4/tts/' + hash, {method:'GET'});
      let cache;
      let cached;
      try{ cache = cacheStorage && await cacheStorage.open('god4-neural2-tts-v1'); cached = cache && await cache.match(cacheKey); }
      catch(failure){ /* Edge cache is optional; never make speech depend on it. */ }
      if(cached){
        const response = new Response(cached.body, cached);
        response.headers.set('Cache-Control', 'no-store');
        return response;
      }
      const token = await accessToken(account, env.GOOGLE_TTS_SERVICE_ACCOUNT);
      const result = await timedFetch(SYNTHESIS_URL, {method:'POST', headers:{
        Authorization:'Bearer ' + token, 'Content-Type':'application/json', 'x-goog-user-project':account.project_id
      }, body:JSON.stringify({input:{text:body.text}, voice:{languageCode:'en-US', name:VOICES[body.voice]},
        audioConfig:{audioEncoding:'MP3', speakingRate:body.rate, pitch:0}})});
      if(typeof result.audioContent !== 'string' || !result.audioContent || result.audioContent.length > 8000000){
        throw new Error('Invalid audio');
      }
      const audio = Uint8Array.from(atob(result.audioContent), character => character.charCodeAt(0));
      const response = new Response(audio, {headers:{
        'Content-Type':'audio/mpeg', 'Cache-Control':'no-store', 'X-Content-Type-Options':'nosniff'
      }});
      if(cache){
        const stored = response.clone();
        stored.headers.set('Cache-Control', 'public, max-age=86400, immutable');
        context.waitUntil(cache.put(cacheKey, stored).catch(() => {}));
      }
      return response;
    }catch(failure){ return error(502, 'Cloud speech is unavailable.'); }
  };
}

export const onRequest = createTtsHandler();
