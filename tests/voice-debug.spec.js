const {test, expect} = require('@playwright/test');
const {startCspServer} = require('./csp-server');

const voices = [
  {name:'Microsoft David', voiceURI:'david', lang:'en-US', localService:true, default:true},
  {name:'Microsoft Zira', voiceURI:'zira', lang:'en-US', localService:true, default:false},
  {name:'French Voice', voiceURI:'french', lang:'fr-FR', localService:false, default:false}
];

async function open(page, inventory = voices, query = '?voice-debug=1', supported = true, origin = ''){
  await page.addInitScript(({inventory, supported}) => {
    localStorage.setItem('god4.speech.voice', 'female');
    window.__speech = {voices:inventory, spoken:[], listeners:[], cancels:0, paused:0};
    Object.defineProperty(window, 'SpeechSynthesisUtterance', {configurable:true,
      value:supported ? function(text){ this.text = text; } : undefined});
    Object.defineProperty(window, 'speechSynthesis', {configurable:true, value:supported ? {
      getVoices(){ return window.__speech.voices; },
      addEventListener(type, listener){ if(type === 'voiceschanged') window.__speech.listeners.push(listener); },
      speak(utterance){ window.__speech.spoken.push(utterance); },
      cancel(){ window.__speech.cancels++; }, pause(){ window.__speech.paused++; }, resume(){}
    } : undefined});
    window.addEventListener('DOMContentLoaded', () => initializeBibleExperience());
  }, {inventory, supported});
  await page.goto(origin + '/' + query);
  await expect(page.locator('#readerContent .reader-verse').first()).toBeVisible();
}

async function field(page, name){
  return page.locator('#voiceDebugSummary dt').filter({hasText:new RegExp('^' + name.replace(/[.*+?^${}()|[\]\\]/g, '\\$&') + '$')})
    .evaluate(node => node.nextElementSibling.textContent);
}

for(const query of ['', '?voice-debug=0', '?voice-debug=true', '?other=1']){
  test(`diagnostic panel and tests are absent for ${query || 'normal URL'}`, async ({page}) => {
    await open(page, voices, query);
    await expect(page.locator('#voiceDebugPanel')).toHaveCount(0);
    await expect(page.getByRole('button', {name:'Test Male', exact:true})).toHaveCount(0);
    await expect(page.getByRole('button', {name:'Test Female', exact:true})).toHaveCount(0);
    expect(await page.evaluate(() => BibleSpeech.testVoiceProfile('male'))).toBe(false);
    expect(await page.evaluate(() => window.__speech.spoken.length)).toBe(0);
  });
}

test('debug mode shows user agent, profiles and every English or foreign voice with all fields', async ({page}) => {
  await open(page);
  await expect(page.getByRole('region', {name:'Voice diagnostics'})).toBeVisible();
  expect(await field(page, 'Browser user agent')).toBe(await page.evaluate(() => navigator.userAgent));
  expect(await field(page, 'speechSynthesis supported')).toBe('yes');
  expect(await field(page, 'Total getVoices() count')).toBe('3');
  expect(await field(page, 'English voice count')).toBe('2');
  expect(await field(page, 'Current semantic preference')).toBe('female');
  expect(await field(page, 'sharedFallback')).toBe('false');
  expect(await field(page, 'Resolved Male')).toBe('name: Microsoft David\nvoiceURI: david\nlang: en-US\nlocalService: true\ndefault: true');
  expect(await field(page, 'Resolved Female')).toBe('name: Microsoft Zira\nvoiceURI: zira\nlang: en-US\nlocalService: true\ndefault: false');
  const rows = page.locator('#voiceDebugInventory li');
  await expect(rows).toHaveCount(3);
  for(let i = 0; i < voices.length; i++){
    expect(await rows.nth(i).locator('dd').allTextContents()).toEqual([
      String(i), voices[i].name, voices[i].voiceURI, voices[i].lang,
      String(voices[i].localService), String(voices[i].default)
    ]);
  }
});

test('empty inventory has accurate diagnostics and uses the browser default', async ({page}) => {
  await open(page, []);
  expect(await field(page, 'Total getVoices() count')).toBe('0');
  expect(await field(page, 'English voice count')).toBe('0');
  expect(await field(page, 'Resolved Male')).toContain('No resolved voice');
  await expect(page.locator('#voiceDebugInventory')).toContainText('No voices returned yet.');
  await page.getByRole('button', {name:'Test Male', exact:true}).click();
  expect(await page.evaluate(() => ({text:window.__speech.spoken[0].text, voice:window.__speech.spoken[0].voice || null})))
    .toEqual({text:'This is the male voice.', voice:null});
});

test('diagnostic controls work under the enforcing CSP without violations', async ({page}) => {
  const server = await startCspServer();
  try{
    await page.addInitScript(() => {
      window.__violations = [];
      document.addEventListener('securitypolicyviolation', event => {
        window.__violations.push({directive:event.effectiveDirective, uri:event.blockedURI});
      });
    });
    await page.route('https://fonts.googleapis.com/**', route => route.fulfill({status:200, contentType:'text/css', body:''}));
    await open(page, voices, '?voice-debug=1', true, server.origin);
    await page.getByRole('button', {name:'Refresh voices', exact:true}).click();
    await page.getByRole('button', {name:'Test Male', exact:true}).click();
    await page.getByRole('button', {name:'Test Female', exact:true}).click();
    expect(await page.evaluate(() => window.__violations)).toEqual([]);
    expect(await page.evaluate(() => window.__speech.spoken.map(u => u.voice.voiceURI))).toEqual(['david', 'zira']);
    expect(await page.locator('#voiceDebugPanel [onclick], #voiceDebugPanel script').count()).toBe(0);
  }finally{
    await server.close();
  }
});

test('unsupported speech disables debug tests', async ({page}) => {
  await open(page, [], '?voice-debug=1', false);
  expect(await field(page, 'speechSynthesis supported')).toBe('no');
  await expect(page.getByRole('button', {name:'Test Male', exact:true})).toBeDisabled();
  await expect(page.getByRole('button', {name:'Test Female', exact:true})).toBeDisabled();
});

test('one voice shows shared fallback and both tests use that exact native object', async ({page}) => {
  await open(page, [voices[1]]);
  expect(await field(page, 'Total getVoices() count')).toBe('1');
  expect(await field(page, 'sharedFallback')).toBe('true');
  await page.getByRole('button', {name:'Test Male', exact:true}).click();
  await page.getByRole('button', {name:'Test Female', exact:true}).click();
  expect(await page.evaluate(() => window.__speech.spoken.every(u => u.voice === window.__speech.voices[0]))).toBe(true);
});

test('test phrases use cached Reader profiles without changing preference, speed or playback cursor', async ({page}) => {
  await open(page);
  const before = await page.evaluate(() => ({saved:localStorage.getItem('god4.speech.voice'),
    preference:BibleSpeech.getResolvedVoiceInfo().preference, playback:BibleSpeech.getPlaybackSnapshot(),
    position:localStorage.getItem('god4.reader.position'), cursor:getPlaybackResumeCursor()}));
  await page.getByRole('button', {name:'Test Male', exact:true}).click();
  await page.getByRole('button', {name:'Test Female', exact:true}).click();
  expect(await page.evaluate(() => window.__speech.spoken.map(u => ({text:u.text, voice:u.voice.voiceURI, rate:u.rate, pitch:u.pitch}))))
    .toEqual([{text:'This is the male voice.', voice:'david', rate:1, pitch:1},
      {text:'This is the female voice.', voice:'zira', rate:1, pitch:1}]);
  expect(await page.evaluate(() => window.__speech.spoken[0].voice === window.__speech.voices[0] &&
    window.__speech.spoken[1].voice === BibleSpeech.getVoice())).toBe(true);
  expect(await page.evaluate(() => ({saved:localStorage.getItem('god4.speech.voice'),
    preference:BibleSpeech.getResolvedVoiceInfo().preference, playback:BibleSpeech.getPlaybackSnapshot(),
    position:localStorage.getItem('god4.reader.position'), cursor:getPlaybackResumeCursor()}))).toEqual(before);
  expect(await page.evaluate(() => window.__speech.cancels)).toBe(0);
});

test('Refresh voices and voiceschanged update mappings and the full inventory', async ({page}) => {
  await open(page, []);
  await page.evaluate(inventory => { window.__speech.voices = inventory; }, [voices[1]]);
  await page.getByRole('button', {name:'Refresh voices', exact:true}).click();
  expect(await field(page, 'sharedFallback')).toBe('true');
  await page.evaluate(inventory => {
    window.__speech.voices = inventory;
    window.__speech.listeners.forEach(listener => listener());
  }, voices);
  expect(await field(page, 'Total getVoices() count')).toBe('3');
  expect(await field(page, 'sharedFallback')).toBe('false');
  expect(await field(page, 'Resolved Male')).toContain('Microsoft David');
  await page.locator('#readerMoreTrigger').click();
  await page.locator('#readAloudVoice').selectOption('male');
  expect(await field(page, 'Current semantic preference')).toBe('male');
});

test('diagnostic tests cannot interrupt playing or paused Reader speech and fullscreen keeps one panel', async ({page}) => {
  await open(page);
  await page.locator('#readAloudPlay').click();
  await expect(page.getByRole('button', {name:'Test Male', exact:true})).toBeDisabled();
  await page.evaluate(() => BibleSpeech.pauseResume());
  await expect(page.getByRole('button', {name:'Test Female', exact:true})).toBeDisabled();
  expect(await page.evaluate(() => BibleSpeech.testVoiceProfile('male'))).toBe(false);
  await page.getByRole('button', {name:'Refresh voices', exact:true}).click();
  expect(await page.evaluate(() => ({state:BibleSpeech.getState(), spoken:window.__speech.spoken.length})))
    .toEqual({state:'paused', spoken:1});
  await page.evaluate(() => BibleSpeech.stop());
  await expect(page.getByRole('button', {name:'Test Male', exact:true})).toBeEnabled();
  await page.locator('#fullscreenBtn').click();
  await expect(page.locator('#voiceDebugPanel')).toHaveCount(1);
  await page.locator('#readerContent [data-word-study-term]').first().click();
  await expect(page.locator('#wordStudyPanel')).toBeVisible();
});

test('debug panel fits 320px with long native names and keyboard activation', async ({page}) => {
  await page.setViewportSize({width:320, height:800});
  await open(page, [{...voices[0], name:'LongVoice'.repeat(40), voiceURI:'uri:'.repeat(80)}]);
  for(const fullscreen of [false, true]){
    if(fullscreen) await page.locator('#fullscreenBtn').click();
    const button = page.getByRole('button', {name:'Test Male', exact:true});
    await button.focus();
    await button.press('Enter');
    expect(await page.locator('#voiceDebugPanel').evaluate(panel => {
      return panel.scrollWidth <= panel.clientWidth && document.documentElement.scrollWidth <= innerWidth &&
        [...panel.querySelectorAll('*')].every(el => [...el.getClientRects()].every(r => r.left >= -1 && r.right <= innerWidth + 1));
    })).toBe(true);
  }
  expect(await page.evaluate(() => window.__speech.spoken.length)).toBe(2);
});
