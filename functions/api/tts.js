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
// Validate bounded Layer III framing before caching. Browser decoding remains the final audio check.
function validMp3(audio){
  let offset = 0, frames = 0;
  if(audio.length >= 10 && audio[0] === 73 && audio[1] === 68 && audio[2] === 51){
    if(audio.slice(6, 10).some(byte => byte & 128)) return false;
    const tagSize = (audio[6] << 21) | (audio[7] << 14) | (audio[8] << 7) | audio[9];
    offset = 10 + tagSize + (audio[3] === 4 && (audio[5] & 16) ? 10 : 0);
  }
  while(offset < audio.length){
    // Optional ID3v1 metadata after the final audio frame.
    if(frames && audio.length - offset === 128 && audio[offset] === 84 && audio[offset + 1] === 65 && audio[offset + 2] === 71) return true;
    if(offset + 4 > audio.length || audio[offset] !== 255 || (audio[offset + 1] & 224) !== 224) return false;
    const version = (audio[offset + 1] >> 3) & 3;
    const layer = (audio[offset + 1] >> 1) & 3;
    const bitrateIndex = audio[offset + 2] >> 4;
    const sampleIndex = (audio[offset + 2] >> 2) & 3;
    if(version === 1 || layer !== 1 || bitrateIndex === 0 || bitrateIndex === 15 || sampleIndex === 3) return false;
    const bitrates = version === 3 ? [0,32,40,48,56,64,80,96,112,128,160,192,224,256,320] : [0,8,16,24,32,40,48,56,64,80,96,112,128,144,160];
    const sampleRate = [44100,48000,32000][sampleIndex] / (version === 3 ? 1 : version === 2 ? 2 : 4);
    const frameSize = Math.floor((version === 3 ? 144 : 72) * bitrates[bitrateIndex] * 1000 / sampleRate) + ((audio[offset + 2] >> 1) & 1);
    if(offset + frameSize > audio.length) return false;
    offset += frameSize;
    frames++;
  }
  return frames > 0;
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
  const requestFetch = runtime.fetch;
  const webCrypto = runtime.crypto || globalThis.crypto;
  const cacheStorage = runtime.caches || globalThis.caches;
  const now = runtime.now || Date.now;
  const Controller = runtime.AbortController || globalThis.AbortController;
  const CacheRequest = runtime.Request || globalThis.Request;
  const FormParams = runtime.URLSearchParams || globalThis.URLSearchParams;
  const scheduleTimer = runtime.setTimeout || ((callback, delay) => setTimeout(callback, delay));
  const cancelTimer = runtime.clearTimeout || (timer => clearTimeout(timer));
  let tokenState = null;

  function buildRequest(build){
    try{ return build(); }
    catch(failure){ throw new Error('Cloud speech is unavailable.'); }
  }
  async function timedFetch(url, options){
    let controller;
    let timer;
    try{
      controller = new Controller();
      timer = scheduleTimer(() => controller.abort(), 8000);
    }catch(failure){ throw new Error('Cloud speech is unavailable.'); }
    try{
      const fetchOptions = buildRequest(() => ({...options, redirect:'manual', signal:controller.signal}));
      let response;
      try{ response = await (requestFetch ? requestFetch(url, fetchOptions) : globalThis.fetch(url, fetchOptions)); }
      catch(failure){ throw new Error('Cloud speech is unavailable.'); }
      if(!response.ok) throw new Error('Cloud speech is unavailable.');
      // Keep the timeout through body consumption, not just response headers.
      return await response.json();
    }finally{
      // Cleanup must never replace a provider result or the original failure.
      try{ cancelTimer(timer); }catch(failure){}
    }
  }
  async function accessToken(account, secret){
    if(tokenState && tokenState.secret === secret && tokenState.expires > now()) return tokenState.value;
    // Only completed token data is reused. In-flight I/O belongs to its request.
    const issued = Math.floor(now() / 1000);
    const {header, claims} = buildRequest(() => ({
      header:base64url(encoder.encode(JSON.stringify({alg:'RS256', typ:'JWT'}))),
      claims:base64url(encoder.encode(JSON.stringify({
        iss:account.client_email, scope:'https://www.googleapis.com/auth/cloud-platform',
        aud:TOKEN_URL, iat:issued, exp:issued + 3600
      })))
    }));
    let bytes;
    try{
      const pem = account.private_key.replace(/-----BEGIN PRIVATE KEY-----|-----END PRIVATE KEY-----|\s/g, '');
      bytes = Uint8Array.from(atob(pem), character => character.charCodeAt(0));
    }catch(failure){ throw new Error('Cloud speech is unavailable.'); }
    let key;
    try{
      key = await webCrypto.subtle.importKey('pkcs8', bytes,
        {name:'RSASSA-PKCS1-v1_5', hash:'SHA-256'}, false, ['sign']);
    }catch(failure){ throw new Error('Cloud speech is unavailable.'); }
    const signingInput = buildRequest(() => encoder.encode(header + '.' + claims));
    let signature;
    try{ signature = await webCrypto.subtle.sign('RSASSA-PKCS1-v1_5', key, signingInput); }
    catch(failure){ throw new Error('Cloud speech is unavailable.'); }
    const oauthOptions = buildRequest(() => {
      const assertion = header + '.' + claims + '.' + base64url(new Uint8Array(signature));
      return {method:'POST', headers:{'Content-Type':'application/x-www-form-urlencoded'},
        body:new FormParams({grant_type:'urn:ietf:params:oauth:grant-type:jwt-bearer', assertion}).toString()};
    });
    const token = await timedFetch(TOKEN_URL, oauthOptions);
    if(!token || typeof token.access_token !== 'string' || !token.access_token ||
        !Number.isFinite(token.expires_in) || token.expires_in < 120) throw new Error('Cloud speech is unavailable.');
    tokenState = {secret, value:token.access_token, expires:now() + (Math.min(token.expires_in, 3600) - 60) * 1000};
    return token.access_token;
  }

  return async function handle(context){
    const {request, env} = context;
    if(request.method !== 'POST') return error(405, 'Use POST.', {Allow:'POST'});
    const origin = new URL(request.url).origin;
    const suppliedOrigin = request.headers.get('Origin');
    const site = request.headers.get('Sec-Fetch-Site');
    if(suppliedOrigin !== origin || (site !== null && site !== 'same-origin')){
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
      if(!account || account.type !== 'service_account' || ['client_email', 'private_key', 'project_id'].some(field => typeof account[field] !== 'string' || !account[field].trim())){
        throw new Error('Invalid account');
      }
    }catch(failure){ return error(503, 'Cloud speech is unavailable.'); }

    try{
      const digestInput = encoder.encode(JSON.stringify([
        CONFIG_VERSION, account.project_id, body.text, body.voice, VOICES[body.voice], body.rate
      ]));
      let digest;
      try{ digest = await webCrypto.subtle.digest('SHA-256', digestInput); }
      catch(failure){ throw new Error('Cloud speech is unavailable.'); }
      const hash = Array.from(new Uint8Array(digest), byte => byte.toString(16).padStart(2, '0')).join('');
      const cacheKey = buildRequest(() => new CacheRequest(origin + '/__god4/tts/' + hash, {method:'GET'}));
      let cache;
      let cached;
      try{ cache = cacheStorage && await cacheStorage.open('god4-neural2-tts-v1'); cached = cache && await cache.match(cacheKey); }
      catch(failure){ /* Edge cache is optional; never make speech depend on it. */ }
      if(cached){
        try{
          const audio = new Uint8Array(await cached.arrayBuffer());
          if(cached.status === 200 && cached.headers.get('Content-Type') === 'audio/mpeg' && validMp3(audio)){
            const response = new Response(audio, cached);
            response.headers.set('Cache-Control', 'no-store');
            return response;
          }
        }catch(failure){ /* Invalid/unreadable cached audio is a miss and can be replaced. */ }
      }
      // Only uncached synthesis consumes a token. Never substitute a shared/global IP key.
      const clientIp = request.headers.get('CF-Connecting-IP');
      if(!clientIp || clientIp.length > 45 || !/^[0-9a-f:.]+$/i.test(clientIp) || !/[.:]/.test(clientIp)){
        return error(503, 'Cloud speech is unavailable.');
      }
      let limitResponse;
      try{
        limitResponse = await env.TTS_RATE_LIMITER.fetch('https://tts-rate-limit.internal/check', {
          method:'POST', headers:{'Content-Type':'application/json'},
          body:JSON.stringify({key:clientIp}), redirect:'manual'
        });
      }catch(failure){ return error(503, 'Cloud speech is unavailable.'); }
      if(limitResponse.status === 429){
        return error(429, 'Cloud speech is temporarily unavailable.', {'Retry-After':'10'});
      }
      if(limitResponse.status !== 204) return error(503, 'Cloud speech is unavailable.');
      const token = await accessToken(account, env.GOOGLE_TTS_SERVICE_ACCOUNT);
      const synthesisOptions = buildRequest(() => ({method:'POST', headers:{
        Authorization:'Bearer ' + token, 'Content-Type':'application/json', 'x-goog-user-project':account.project_id
      }, body:JSON.stringify({input:{text:body.text}, voice:{languageCode:'en-US', name:VOICES[body.voice]},
        audioConfig:{audioEncoding:'MP3', speakingRate:body.rate, pitch:0}})}));
      const result = await timedFetch(SYNTHESIS_URL, synthesisOptions);
      if(!result || typeof result.audioContent !== 'string' || !result.audioContent || result.audioContent.length > 8000000){
        throw new Error('Cloud speech is unavailable.');
      }
      let decoded;
      try{ decoded = atob(result.audioContent); }
      catch(failure){ throw new Error('Cloud speech is unavailable.'); }
      const audio = Uint8Array.from(decoded, character => character.charCodeAt(0));
      if(!validMp3(audio)) throw new Error('Cloud speech is unavailable.');
      const response = new Response(audio, {headers:{
        'Content-Type':'audio/mpeg', 'Cache-Control':'no-store', 'X-Content-Type-Options':'nosniff'
      }});
      if(cache){
        const stored = response.clone();
        stored.headers.set('Cache-Control', 'public, max-age=2592000, immutable');
        try{ context.waitUntil(cache.put(cacheKey, stored).catch(() => {})); }
        catch(failure){ /* A cache-write setup failure must not break successful speech. */ }
      }
      return response;
    }catch(failure){
      return error(502, 'Cloud speech is unavailable.');
    }
  };
}

export const onRequest = createTtsHandler();
