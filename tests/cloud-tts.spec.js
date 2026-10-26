const {selectReaderOption,toggleReaderFullscreen}=require('./reader-navigation-test-helper');
const {test, expect} = require('@playwright/test');
const fs = require('fs');
const path = require('path');
const {startCspServer} = require('./csp-server');

test.beforeEach(async ({page}) => {
  page.cloudPageErrors = [];
  page.on('pageerror', error => page.cloudPageErrors.push(error.message));
});
test.afterEach(async ({page}) => { expect(page.cloudPageErrors).toEqual([]); });

async function install(page, options = {}){
  await page.addInitScript(options => {
    window.__audio = {sources:[], contexts:[], local:[], canceled:0, requests:[]};
    const originalTimer = window.setTimeout;
    if(options.fastTimeout) window.setTimeout = function(callback, duration, ...args){
      return originalTimer(callback, duration === 12000 ? 100 : duration, ...args);
    };
    if(!options.realAudio){
      const MockContext = class {
        constructor(){ this.state = 'suspended'; this.destination = {}; window.__audio.contexts.push(this); }
        resume(){ if(options.blocked) return Promise.reject(new Error('Audio blocked')); this.state = 'running'; return Promise.resolve(); }
        suspend(){ this.state = 'suspended'; return Promise.resolve(); }
        decodeAudioData(){ return options.decodeFailure ? Promise.reject(new Error('Bad audio')) : Promise.resolve({duration:1}); }
        createBufferSource(){
          const source = {onended:null, started:false, stopped:false, connect(){}, disconnect(){},
            start(){ this.started = true; this.savedEnd = this.onended; },
            stop(){ this.stopped = true; if(this.onended) this.onended(); },
            end(){ this.ended = true; if(this.onended) this.onended(); }};
          window.__audio.sources.push(source);
          return source;
        }
      };
      Object.defineProperty(window, 'AudioContext', {configurable:true, value:options.noAudio ? undefined : MockContext});
      Object.defineProperty(window, 'webkitAudioContext', {configurable:true, value:undefined});
    }
    Object.defineProperty(window, 'SpeechSynthesisUtterance', {configurable:true,
      value:options.noLocal ? undefined : function(text){ this.text = text; }});
    Object.defineProperty(window, 'speechSynthesis', {configurable:true, value:options.noLocal ? undefined : {
      getVoices(){ return options.emptyVoices ? [] : [
        {name:'Microsoft David', voiceURI:'david', lang:'en-US', localService:true},
        {name:'Microsoft Zira', voiceURI:'zira', lang:'en-US', localService:true}]; },
      addEventListener(){}, speak(utterance){ window.__audio.local.push(utterance); if(utterance.onstart) utterance.onstart(); },
      pause(){}, resume(){}, cancel(){ window.__audio.canceled++; }
    }});
    window.addEventListener('DOMContentLoaded', () => initializeBibleExperience());
  }, options);
}
async function mockEndpoint(page, status = 200, contentType = 'audio/mpeg'){
  const requests = [];
  await page.route('**/api/tts', async route => {
    requests.push(route.request().postDataJSON());
    await route.fulfill({status, contentType, body:status === 200 ? 'mock MP3 bytes' : '{"error":"Unavailable"}'});
  });
  return requests;
}
async function open(page, query = '?cloud-tts=1', origin = ''){
  await page.goto(origin + '/' + query);
  await expect(page.locator('#readerContent .reader-verse').first()).toBeVisible();
}
async function countSources(page, count){
  await expect.poll(() => page.evaluate(() => window.__audio.sources.filter(source => source.started).length)).toBe(count);
}
async function end(page){ await page.evaluate(() => window.__audio.sources.at(-1).end()); }
async function more(page){
  if(await page.locator('#readerMoreTrigger').getAttribute('aria-expanded') === 'false') await page.locator('#readerMoreTrigger').click();
}

for(const query of ['?cloud-tts=0']){
  test(`normal speech is unchanged at ${query || 'normal URL'}`, async ({page}) => {
    await install(page); const requests = await mockEndpoint(page);
    await open(page, query);
    await page.locator('#readAloudPlay').click();
    expect(await page.evaluate(() => window.__audio.local.length)).toBe(1);
    expect(await page.evaluate(() => window.__audio.contexts.length)).toBe(0);
    expect(requests).toEqual([]);
  });
}

test('cloud mode requests one exact verse and preserves continuous callbacks, highlighting and accessible Stop', async ({page}) => {
  await install(page); const requests = await mockEndpoint(page); await open(page);
  await page.locator('#readAloudPlay').click(); await countSources(page, 1);
  expect(requests[0]).toEqual({text:await page.evaluate(() => BibleData.getVerse(currentTranslation, currentBook, currentChapter, 1).text), voice:'male', rate:1});
  await expect(page.locator('#readAloudPlay')).toHaveAttribute('aria-label', 'Stop reading aloud');
  await expect(page.locator('#readerContent .reader-verse').first()).toHaveClass(/spoken/);
  expect(await page.evaluate(() => window.__audio.local.length)).toBe(0);
  await end(page); await countSources(page, 2);
  expect(requests[1].text).toBe(await page.evaluate(() => BibleData.getVerse(currentTranslation, currentBook, currentChapter, 2).text));
  expect(await page.evaluate(() => getPlaybackResumeCursor().verse)).toBe(2);
  await page.locator('#readAloudPlay').click();
  await expect(page.locator('#readAloudPlay')).toHaveAttribute('aria-label', 'Play reading aloud');
  expect(await page.evaluate(() => window.__audio.sources.at(-1).stopped)).toBe(true);
  await page.evaluate(() => window.__audio.sources.at(-1).savedEnd());
  expect(requests).toHaveLength(2);
  expect(await page.evaluate(() => BibleSpeech.getState())).toBe('idle');
});

test('cloud Female and speed changes apply to the next verse without canceling the current audio', async ({page}) => {
  await install(page); const requests = await mockEndpoint(page); await open(page); await more(page);
  await page.locator('#readAloudPlay').click(); await countSources(page, 1);
  await page.locator('#readAloudVoice').selectOption('female');
  await page.locator('#readAloudSpeed').selectOption('1.5');
  expect(await page.evaluate(() => window.__audio.sources[0].stopped)).toBe(false);
  await end(page); await countSources(page, 2);
  expect(requests[1]).toMatchObject({voice:'female', rate:1.5});
  expect(await page.evaluate(() => localStorage.getItem('god4.speech.voice'))).toBe('female');
});

for(const [label, options, status, mime] of [
  ['HTTP/provider failure', {}, 502, 'application/json'],
  ['unavailable endpoint', {}, 404, 'text/html'],
  ['non-200 success status', {}, 201, 'audio/mpeg'],
  ['unsupported provider rate', {}, 422, 'application/json'],
  ['synthesis rate limit', {}, 429, 'application/json'],
  ['incorrect MIME', {}, 200, 'text/html'],
  ['decode failure', {decodeFailure:true}, 200, 'audio/mpeg'],
  ['autoplay denied', {blocked:true}, 200, 'audio/mpeg'],
  ['unsupported Web Audio', {noAudio:true}, 200, 'audio/mpeg']
]){
  test(`${label} falls back to local speech without breaking the Reader`, async ({page}) => {
    await install(page, options); await mockEndpoint(page, status, mime); await open(page); await more(page);
    await page.locator('#readAloudVoice').selectOption('female');
    await page.locator('#readAloudPlay').click();
    await expect.poll(() => page.evaluate(() => window.__audio.local.length)).toBe(1);
    expect(await page.evaluate(() => ({voice:window.__audio.local[0].voice.name, rate:window.__audio.local[0].rate})))
      .toEqual({voice:'Microsoft Zira', rate:1});
    await page.evaluate(() => window.__audio.local[0].onend());
    await expect.poll(() => page.evaluate(() => BibleSpeech.getState())).toBe('playing');
    await page.locator('#readAloudPlay').click();
  });
}

test('offline state bypasses cloud; network loss falls back and reconnect can use cloud again', async ({page, context}) => {
  await install(page); const requests = await mockEndpoint(page); await open(page);
  await context.setOffline(true);
  await page.locator('#readAloudPlay').click();
  expect(await page.evaluate(() => window.__audio.local.length)).toBe(1);
  expect(requests).toEqual([]);
  await context.setOffline(false);
  await page.evaluate(() => window.__audio.local[0].onend()); await countSources(page, 1);
  expect(requests).toHaveLength(1);
});

test('network errors and timeout use local fallback; stopped requests never speak later', async ({page}) => {
  await install(page, {fastTimeout:true});
  await page.route('**/api/tts', route => route.abort('failed'));
  await open(page); await page.locator('#readAloudPlay').click();
  await expect.poll(() => page.evaluate(() => window.__audio.local.length)).toBe(1);
  await page.locator('#readAloudPlay').click();
  await page.unroute('**/api/tts');
  let release;
  const held = new Promise(resolve => { release = resolve; });
  let requestCount = 0;
  await page.route('**/api/tts', async route => { requestCount++; await held; await route.fulfill({contentType:'audio/mpeg', body:'bytes'}).catch(() => {}); });
  await page.locator('#readAloudPlay').click();
  await expect.poll(() => page.evaluate(() => window.__audio.local.length)).toBe(2);
  await page.locator('#readAloudPlay').click();
  await page.locator('#readAloudPlay').click();
  await expect.poll(() => requestCount).toBe(2);
  await page.locator('#readAloudPlay').click();
  release();
  await page.evaluate(() => new Promise(resolve => setTimeout(resolve, 150)));
  expect(await page.evaluate(() => ({state:BibleSpeech.getState(), local:window.__audio.local.length, sources:window.__audio.sources.length})))
    .toEqual({state:'idle', local:2, sources:0});
});

test('pause/resume and Repeat preserve the continuation cursor and reject canceled audio callbacks', async ({page}) => {
  await install(page); const requests = await mockEndpoint(page); await open(page);
  await page.locator('#readAloudPlay').click(); await countSources(page, 1);
  await page.evaluate(() => BibleSpeech.pauseResume());
  expect(await page.evaluate(() => window.__audio.contexts[0].state)).toBe('suspended');
  await page.locator('#readAloudPlay').click();
  expect(await page.evaluate(() => window.__audio.contexts[0].state)).toBe('running');
  expect(requests).toHaveLength(1);
  await end(page); await countSources(page, 2);
  await page.evaluate(() => BibleSpeech.repeatVerse(1)); await countSources(page, 3);
  await page.evaluate(() => window.__audio.sources[1].savedEnd());
  expect(requests).toHaveLength(3);
  await end(page); await countSources(page, 4);
  expect(requests[3].text).toBe(await page.evaluate(() => BibleData.getVerse(currentTranslation, currentBook, currentChapter, 3).text));
});

test('pause while waiting for audio defers spoken callbacks until resume', async ({page}) => {
  await install(page);
  let release;
  const held = new Promise(resolve => { release = resolve; });
  await page.route('**/api/tts', async route => { await held; await route.fulfill({contentType:'audio/mpeg', body:'bytes'}); });
  await open(page); await page.locator('#readAloudPlay').click();
  await page.evaluate(() => BibleSpeech.pauseResume());
  release(); await countSources(page, 1);
  expect(await page.evaluate(() => window.__audio.contexts[0].state)).toBe('suspended');
  expect(await page.evaluate(() => BibleSpeech.getState())).toBe('paused');
  await page.locator('#readAloudPlay').click();
  await expect(page.locator('#readAloudStatus')).toHaveText(/Playing Natural|Using .*device voice/);
  expect(await page.evaluate(() => window.__audio.contexts[0].state)).toBe('running');
});

test('fallback during pause keeps the sequence paused until a voice Resume command', async ({page}) => {
  await install(page);
  let release;
  const held = new Promise(resolve => { release = resolve; });
  await page.route('**/api/tts', async route => { await held; await route.fulfill({status:503, contentType:'application/json', body:'{}'}); });
  await open(page); await page.locator('#readAloudPlay').click();
  await page.evaluate(() => handleVoiceCommand('pause'));
  release();
  await expect.poll(() => page.evaluate(() => window.__audio.local.length)).toBe(1);
  expect(await page.evaluate(() => BibleSpeech.getState())).toBe('paused');
  await page.evaluate(() => handleVoiceCommand('resume'));
  expect(await page.evaluate(() => BibleSpeech.getState())).toBe('playing');
  await page.evaluate(() => handleVoiceCommand('stop'));
  expect(await page.evaluate(() => BibleSpeech.getState())).toBe('idle');
});

for(const rate of ['2.25', '2.5']){
  test(`Reader ${rate} remains available through local fallback with its exact speed`, async ({page}) => {
    await install(page); const requests = await mockEndpoint(page, 422, 'application/json'); await open(page); await more(page);
    await page.locator('#readAloudSpeed').selectOption(rate);
    await page.locator('#readAloudPlay').click();
    await expect.poll(() => page.evaluate(() => window.__audio.local.length)).toBe(1);
    expect(requests).toEqual([]);
    await expect(page.locator('#readAloudStatus')).toContainText('unavailable at this speed');
    expect(await page.evaluate(() => window.__audio.local[0].rate)).toBe(Number(rate));
    expect(await page.locator('#readAloudSpeed').inputValue()).toBe(rate);
  });
}

test('cloud failure without local speech ends safely while Scripture remains usable', async ({page}) => {
  await install(page, {noLocal:true}); await mockEndpoint(page, 503, 'application/json'); await open(page);
  await page.locator('#readAloudPlay').click();
  await expect.poll(() => page.evaluate(() => BibleSpeech.getState())).toBe('idle');
  await page.locator('#readerContent [data-word-study-term]').first().click();
  await expect(page.locator('#wordStudyPanel')).toBeVisible();
});

test('cloud works without a local voice inventory or SpeechSynthesis', async ({page}) => {
  await install(page, {noLocal:true}); const requests = await mockEndpoint(page); await open(page); await more(page);
  await expect(page.locator('#readAloudVoice option')).toHaveText(['Natural Male', 'Natural Female']);
  await page.locator('#readAloudVoice').selectOption('female');
  await page.locator('#readAloudPlay').click(); await countSources(page, 1);
  expect(requests[0].voice).toBe('female');
});

test('chapter and book continuation share Reader navigation and manual navigation cancels old audio', async ({page}) => {
  await install(page); const requests = await mockEndpoint(page); await open(page); await more(page);
  await selectReaderOption(page.locator('#bookSelect'),'matthew'); await selectReaderOption(page.locator('#chapterSelect'),'28');
  await selectReaderOption(page.locator('#verseSelect'),'20');
  await page.locator('#readAloudPlay').click(); await countSources(page, 1);
  await end(page); await countSources(page, 2);
  await expect(page.locator('#readerContent h2')).toHaveText('Mark 1');
  expect(requests[1].text).toBe(await page.evaluate(() => BibleData.getVerse('web', 'mark', 1, 1).text));
  await selectReaderOption(page.locator('#chapterSelect'),'2');
  expect(await page.evaluate(() => window.__audio.sources[1].stopped)).toBe(true);
  expect(await page.evaluate(() => BibleSpeech.getState())).toBe('idle');
});

test('cloud Journey crosses the assigned chapters and stops at the exact daily boundary', async ({page}) => {
  await install(page); const requests = await mockEndpoint(page); await open(page);
  await page.getByRole('button', {name:'Plan', exact:true}).click();
  await page.locator('#planDays [data-plan-day="5"]').click(); await more(page);
  await selectReaderOption(page.locator('#verseSelect'),'38');
  await page.locator('#readAloudPlay').click(); await countSources(page, 1);
  await end(page); await countSources(page, 2);
  await expect(page.locator('#readerContent h2')).toHaveText('Matthew 10');
  await page.locator('#readAloudPlay').click();
  await selectReaderOption(page.locator('#verseSelect'),'42');
  await page.locator('#readAloudPlay').click(); await countSources(page, 3);
  expect(requests[2].text).toBe(await page.evaluate(() => BibleData.getVerse('web', 'matthew', 10, 42).text));
  await end(page);
  await expect(page.locator('#view-plan')).toHaveClass(/active/);
  await expect(page.locator('#journeyStatus')).toHaveText('Daily reading complete. Returning to Plan.');
  expect(requests).toHaveLength(3);
  expect(await page.evaluate(() => BibleSpeech.getState())).toBe('idle');
});

for(const width of [320, 375, 480]){
  test(`cloud fullscreen, Scripture, Word Study and keyboard controls fit ${width}px`, async ({page}) => {
    await page.setViewportSize({width, height:800}); await install(page); await mockEndpoint(page); await open(page);
    for(const fullscreen of [false, true]){
      if(fullscreen) await toggleReaderFullscreen(page);
      const before = await page.locator('#readerContent .reader-verse').allTextContents();
      const play = page.locator('#readAloudPlay'); await play.focus(); await play.press('Enter');
      await countSources(page, fullscreen ? 2 : 1);
      await expect(play).toBeFocused();
      await expect(page.locator('#readerContent .verse-speak, #readerContent [data-verse-speech]')).toHaveCount(0);
      expect(await page.locator('#readerContent').ariaSnapshot()).not.toMatch(/read.*verse.*aloud/i);
      expect(await page.locator('#readerContent .reader-verse').allTextContents()).toEqual(before);
      expect(await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth)).toBe(true);
      await play.press('Enter');
      expect(await page.evaluate(()=>BibleSpeech.getState())).toBe('paused');
      await page.locator('#readerMoreTrigger').click();
      await page.locator('.reader-compact-stop').click();
      expect(await page.evaluate(()=>BibleSpeech.getState())).toBe('idle');
      await page.locator('#readerMoreTrigger').click();
      const token = page.locator('#readerContent [data-word-study-term]').first(); await token.focus(); await token.press('Enter');
      await expect(page.locator('#wordStudyPanel')).toBeVisible(); await page.keyboard.press('Escape');
      await expect(token).toBeFocused();
    }
  });
}

function wavClip(){
  const length = 1600, bytes = Buffer.alloc(44 + length * 2);
  bytes.write('RIFF'); bytes.writeUInt32LE(bytes.length - 8, 4); bytes.write('WAVEfmt ', 8);
  bytes.writeUInt32LE(16, 16); bytes.writeUInt16LE(1, 20); bytes.writeUInt16LE(1, 22);
  bytes.writeUInt32LE(16000, 24); bytes.writeUInt32LE(32000, 28); bytes.writeUInt16LE(2, 32); bytes.writeUInt16LE(16, 34);
  bytes.write('data', 36); bytes.writeUInt32LE(length * 2, 40);
  return bytes;
}
test('real Web Audio playback uses same-origin fetch under unchanged enforcing CSP', async ({page}) => {
  const server = await startCspServer();
  try{
    await install(page, {realAudio:true});
    await page.addInitScript(() => { window.__violations = []; document.addEventListener('securitypolicyviolation', e => window.__violations.push(e.effectiveDirective)); });
    await page.route('https://fonts.googleapis.com/**', route => route.fulfill({contentType:'text/css', body:''}));
    // A generated PCM test clip exercises native decoding/playback without external audio or API quota.
    await page.route('**/api/tts', route => route.fulfill({contentType:'audio/mpeg', body:wavClip()}));
    await open(page, '?cloud-tts=1', server.origin);
    await page.locator('#readAloudPlay').click();
    await expect.poll(() => page.evaluate(() => getPlaybackResumeCursor()?.verse)).toBeGreaterThan(1);
    await page.locator('#readAloudPlay').click();
    expect(await page.evaluate(() => window.__audio.local.length)).toBe(0);
    expect(await page.evaluate(() => window.__violations)).toEqual([]);
    expect(await page.locator('audio').count()).toBe(0);
    const headers = fs.readFileSync(path.join(__dirname, '../_headers'), 'utf8');
    expect(headers).toContain("media-src 'none'");
    expect(headers).not.toContain('texttospeech.googleapis.com');
  }finally{
    // Close the browser's connections (including PWA installation) before its private server.
    await page.context().close();
    await server.close();
  }
});

test('controlled PWA cloud POST bypasses the shell and never stores audio in browser caches', async ({page}) => {
  await install(page);
  await open(page);
  await page.evaluate(() => navigator.serviceWorker.ready);
  await page.reload();
  await expect.poll(() => page.evaluate(() => Boolean(navigator.serviceWorker.controller))).toBe(true);
  // The local static server has no Function; its genuine network 404 must cause local fallback.
  let status;
  page.on('response', response => { if(new URL(response.url()).pathname === '/api/tts') status = response.status(); });
  await page.locator('#readAloudPlay').click();
  await expect.poll(() => page.evaluate(() => window.__audio.local.length)).toBe(1);
  expect(status).toBe(404);
  expect(await page.evaluate(async () => {
    const urls = []; for(const key of await caches.keys()) urls.push(...(await (await caches.open(key)).keys()).map(r => new URL(r.url).pathname));
    return urls.some(url => url.startsWith('/api/tts') || url.startsWith('/__god4/tts/'));
  })).toBe(false);
});


test('premium profiles are eager product choices and ordinary URLs synthesize only after Play',async({page})=>{
  await install(page);const requests=await mockEndpoint(page);await open(page,'');
  expect(requests).toEqual([]);await expect(page.locator('#readAloudVoice option')).toHaveText(['Natural Male','Natural Female']);
  const profiles=await page.evaluate(()=>BibleSpeech.getVoiceProfiles());expect(profiles.map(p=>[p.id,p.providerVoiceId])).toEqual([['male','en-US-Neural2-D'],['female','en-US-Neural2-F']]);
  await more(page);await page.locator('#readAloudVoice').selectOption('female');await page.locator('#readAloudPlay').press('Enter');await countSources(page,1);
  expect(requests[0].voice).toBe('female');await expect(page.locator('#readAloudStatus')).toHaveText('Playing Natural Female.');
  expect(await page.evaluate(()=>BibleSpeech.getResolvedVoiceInfo())).toMatchObject({preference:'female',profileId:'female',provider:'cloud',voiceName:'en-US-Neural2-F',fallbackReason:null});
  await expect(page.locator('#readAloudPlay')).toBeFocused();await page.locator('#readAloudPlay').press(' ');expect(await page.evaluate(()=>BibleSpeech.getState())).toBe('idle');
});

test('pending profile change applies next and fallback keeps the original request profile',async({page})=>{
  await install(page);let release;const barrier=new Promise(r=>release=r),requests=[];
  await page.route('**/api/tts',async r=>{requests.push(r.request().postDataJSON());if(requests.length===1){await barrier;await r.fulfill({status:503,contentType:'application/json',body:'{}'})}else await r.fulfill({contentType:'audio/mpeg',body:'bytes'})});
  await open(page);await more(page);await page.locator('#readAloudPlay').click();await expect.poll(()=>requests.length).toBe(1);
  await expect(page.locator('#readAloudStatus')).toHaveText('Preparing Natural Male…');expect(await page.evaluate(()=>BibleSpeech.getState())).toBe('preparing');
  await page.locator('#readAloudVoice').selectOption('female');release();await expect.poll(()=>page.evaluate(()=>__audio.local.length)).toBe(1);
  expect(await page.evaluate(()=>BibleSpeech.getResolvedVoiceInfo())).toMatchObject({preference:'female',profileId:'male',provider:'native',voiceName:'Microsoft David'});
  await page.evaluate(()=>__audio.local[0].onend());await countSources(page,1);expect(requests[1].voice).toBe('female');await expect(page.locator('#readAloudStatus')).toHaveText('Playing Natural Female.');
});

for(const operation of ['prepare','suspend'])test('obsolete '+operation+' rejection cannot cancel newer cloud playback',async({page})=>{
  await install(page);let release;const barrier=new Promise(r=>release=r);await page.route('**/api/tts',async r=>{await barrier;await r.fulfill({contentType:'audio/mpeg',body:'bytes'}).catch(()=>{})});await open(page);
  await page.evaluate(operation=>{BibleCloudTTS.prepare();const c=__audio.contexts[0];const method=operation==='prepare'?'resume':'suspend',original=c[method].bind(c);c[method]=()=>new Promise((_,reject)=>window.rejectOldAudio=reject);if(operation==='prepare')BibleCloudTTS.prepare();else BibleCloudTTS.pause();c[method]=original;},operation);
  await page.locator('#readAloudPlay').click();await expect(page.locator('#readAloudStatus')).toHaveText('Preparing Natural Male…');
  await page.evaluate(async()=>{rejectOldAudio(new Error('old operation'));await Promise.resolve();await Promise.resolve()});
  expect(await page.evaluate(()=>__audio.local.length)).toBe(0);expect(await page.evaluate(()=>BibleSpeech.getState())).toBe('preparing');release();await countSources(page,1);
});

test('Stop during decode prevents sources, highlights and late focus changes',async({page})=>{
  await install(page);await mockEndpoint(page);await open(page);await page.evaluate(()=>{BibleCloudTTS.prepare();__audio.contexts[0].decodeAudioData=()=>new Promise(resolve=>window.releaseDecode=()=>resolve({duration:1}))});
  await page.locator('#readAloudPlay').click();await expect.poll(()=>page.evaluate(()=>typeof releaseDecode)).toBe('function');await page.locator('#readAloudPlay').click();await page.locator('#searchInput').focus();
  await page.evaluate(async()=>{releaseDecode();await Promise.resolve();await Promise.resolve()});expect(await page.evaluate(()=>__audio.sources.length)).toBe(0);expect(await page.evaluate(()=>BibleSpeech.getState())).toBe('idle');await expect(page.locator('#searchInput')).toBeFocused();await expect(page.locator('#readAloudStatus')).toContainText('Stopped.');
});

for(const action of ['Stop','Compare','translation'])test(action+' cancels cloud preparation without stale playback',async({page})=>{
  await install(page);let release;const barrier=new Promise(r=>release=r);await page.route('**/api/tts',async r=>{await barrier;await r.fulfill({contentType:'audio/mpeg',body:'bytes'}).catch(()=>{})});await open(page);await page.locator('#readAloudPlay').click();await expect(page.locator('#readAloudStatus')).toHaveText('Preparing Natural Male…');
  if(action==='Stop')await page.locator('#readAloudPlay').press('Enter');else if(action==='Compare')await page.getByRole('button',{name:'Compare',exact:true}).click();else await page.evaluate(()=>changeTranslation('asv'));
  release();await page.evaluate(async()=>{await new Promise(r=>setTimeout(r,80))});expect(await page.evaluate(()=>__audio.sources.length)).toBe(0);expect(await page.evaluate(()=>BibleSpeech.getState())).toBe('idle');
});

for(const plan of [false,true])test('earlier Repeat during final verse preserves '+(plan?'Plan boundary':'next chapter'),async({page})=>{
  await install(page);const requests=await mockEndpoint(page);await open(page);await selectReaderOption(page.locator('#verseSelect'),'51');
  if(plan)await page.evaluate(()=>{activePlanReadingSession={planPart:1,day:1,readings:[{bookId:'john',startChapter:1,endChapter:1}],start:{bookId:'john',chapter:1,verse:1},end:{bookId:'john',chapter:1,verse:51}}});
  await page.locator('#readAloudPlay').click();await countSources(page,1);await page.evaluate(()=>BibleSpeech.repeatVerse(1));await countSources(page,2);await end(page);
  if(plan){await expect(page.locator('#view-plan')).toHaveClass(/active/);expect(requests).toHaveLength(2);expect(await page.evaluate(()=>BibleSpeech.getState())).toBe('idle')}
  else{await countSources(page,3);await expect(page.locator('#readerContent h2')).toHaveText('John 2');expect(requests[2].text).toBe(await page.evaluate(()=>BibleData.getVerse('web','john',2,1).text))}
});

test('explicit Play authorizes audio before delayed Bible readiness, and Stop cancels replay',async({page})=>{
  await install(page);const requests=await mockEndpoint(page);let release;const barrier=new Promise(r=>release=r);await page.route('**/js/bible/web.js?*',async r=>{await barrier;await r.continue()});
  await page.goto('/',{waitUntil:'domcontentloaded'});await page.locator('#readAloudPlay').press('Enter');expect(await page.evaluate(()=>__audio.contexts.length)).toBe(1);await expect(page.locator('#readAloudStatus')).toHaveText('Preparing Natural Male…');await page.locator('#readAloudPlay').press('Enter');release();await page.evaluate(()=>initializeBibleExperience());expect(requests).toEqual([]);expect(await page.evaluate(()=>BibleSpeech.getState())).toBe('idle');
});

test('first Play survives delayed Bible readiness without a second gesture',async({page})=>{
  await install(page);const requests=await mockEndpoint(page);let release;const barrier=new Promise(r=>release=r);await page.route('**/js/bible/web.js?*',async r=>{await barrier;await r.continue()});
  await page.goto('/',{waitUntil:'domcontentloaded'});await page.locator('#readAloudPlay').click();expect(await page.evaluate(()=>__audio.contexts.length)).toBe(1);release();await countSources(page,1);expect(requests).toHaveLength(1);
});

test('consecutive cloud verses do not repeat provider announcements',async({page})=>{
  await install(page);await mockEndpoint(page);await open(page);await page.locator('#readAloudPlay').click();await countSources(page,1);
  await page.evaluate(()=>{window.statusChanges=[];new MutationObserver(()=>statusChanges.push(document.getElementById('readAloudStatus').textContent)).observe(document.getElementById('readAloudStatus'),{childList:true})});await end(page);await countSources(page,2);expect(await page.evaluate(()=>statusChanges)).toEqual([]);
});

for(const rate of ['0.5','1','2'])test('premium provider supports rate '+rate,async({page})=>{await install(page);const requests=await mockEndpoint(page);await open(page);await more(page);await page.locator('#readAloudSpeed').selectOption(rate);await page.locator('#readAloudPlay').click();await countSources(page,1);expect(requests[0].rate).toBe(Number(rate));expect(await page.evaluate(()=>BibleSpeech.getResolvedVoiceInfo().provider)).toBe('cloud')});
