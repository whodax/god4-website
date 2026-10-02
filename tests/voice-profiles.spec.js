const {test, expect} = require('@playwright/test');

const mixedVoices = [
  {name:'Google US English', lang:'en-US', localService:false},
  {name:'Microsoft Daniel', lang:'en-GB', localService:true},
  {name:'Microsoft Mark', lang:'en-US', localService:true},
  {name:'Microsoft Zira', lang:'en-US', localService:true}
];

async function installSpeech(page, initialVoices){
  await page.addInitScript(voices => {
    window.__speech = {voices, utterances:[], listeners:[], cancels:0};
    window.SpeechSynthesisUtterance = function(text){ this.text = text; };
    Object.defineProperty(window, 'speechSynthesis', {configurable:true, value:{
      getVoices(){ return window.__speech.voices; },
      addEventListener(type, callback){ if(type === 'voiceschanged') window.__speech.listeners.push(callback); },
      speak(utterance){ window.__speech.utterances.push(utterance); },
      cancel(){ window.__speech.cancels++; },
      pause(){}, resume(){}
    }});
    window.addEventListener('DOMContentLoaded', () => initializeBibleExperience());
  }, initialVoices);
  await page.goto('/');
}

async function chooseVoice(page, value){
  if(await page.locator('#readerMoreTrigger').getAttribute('aria-expanded') === 'false'){
    await page.locator('#readerMoreTrigger').click();
  }
  await page.locator('#readAloudVoice').selectOption(value);
}

async function latestUtterance(page){
  return page.evaluate(() => {
    const utterance = window.__speech.utterances.at(-1);
    return {voice:utterance.voice && utterance.voice.name || null, pitch:utterance.pitch, rate:utterance.rate};
  });
}

test('profiles choose best available English voices and keep Speed authoritative', async ({page}) => {
  await installSpeech(page, mixedVoices);
  await expect(page.locator('#readAloudVoice option').first()).toHaveText('Automatic');
  await expect(page.locator('#readAloudVoice optgroup')).toHaveAttribute('label', 'Device voices');
  await chooseVoice(page, 'adult-male');
  await page.locator('#readAloudSpeed').selectOption('1.5');
  await page.locator('#readAloudPlay').click();
  expect(await latestUtterance(page)).toEqual({voice:'Microsoft Mark', pitch:0.95, rate:1.5});
  await chooseVoice(page, 'adult-female');
  expect(await page.evaluate(() => window.__speech.utterances.length)).toBe(1);
  await page.evaluate(() => window.__speech.utterances[0].onend());
  expect(await latestUtterance(page)).toEqual({voice:'Microsoft Zira', pitch:1.05, rate:1.5});
  await page.locator('#readAloudPlay').click();
  await page.locator('#readAloudPlay').click();
  expect(await latestUtterance(page)).toEqual({voice:'Microsoft Zira', pitch:1.05, rate:1.5});
  await page.locator('#readAloudPlay').click();
  await chooseVoice(page, 'child-male');
  await page.locator('#readAloudPlay').click();
  expect(await latestUtterance(page)).toEqual({voice:'Microsoft Mark', pitch:1.23, rate:1.5});
  await page.locator('#readAloudPlay').click();
  await chooseVoice(page, 'child-female');
  await page.locator('#readAloudPlay').click();
  expect(await latestUtterance(page)).toEqual({voice:'Microsoft Zira', pitch:1.3, rate:1.5});
  await page.locator('#readAloudPlay').click();
  await chooseVoice(page, 'auto');
  await page.locator('#readAloudPlay').click();
  expect(await latestUtterance(page)).toEqual({voice:null, pitch:1, rate:1.5});
});

test('voiceschanged preserves a selected profile and applies voices arriving later at 320px', async ({page}) => {
  await installSpeech(page, []);
  await page.setViewportSize({width:320, height:700});
  await chooseVoice(page, 'child-female');
  await expect(page.locator('#readAloudVoice')).toHaveValue('child-female');
  expect(await page.evaluate(() => window.__speech.listeners.length)).toBe(1);
  await page.evaluate(voices => {
    window.__speech.voices = voices;
    window.__speech.listeners[0]();
    window.__speech.listeners[0]();
  }, mixedVoices);
  await expect(page.locator('#readAloudVoice')).toHaveValue('child-female');
  await expect(page.locator('#readAloudVoice option[value="child-female"]')).toHaveCount(1);
  await expect(page.locator('#readAloudVoice option[value="Microsoft Zira"]')).toHaveCount(1);
  const overflow = await page.evaluate(() => [...document.querySelectorAll('#view-reader *')].some(element => {
    const bounds = element.getBoundingClientRect();
    return bounds.left < -1 || bounds.right > innerWidth + 1;
  }));
  expect(overflow).toBe(false);
  await page.locator('#readAloudPlay').click();
  expect(await latestUtterance(page)).toEqual({voice:'Microsoft Zira', pitch:1.3, rate:1});
});

test('missing preferred or English voice falls back without rewriting the profile', async ({page}) => {
  await installSpeech(page, [
    {name:'Neutral UK', lang:'en-GB', localService:false},
    {name:'Neutral US', lang:'en-US', localService:true}
  ]);
  await chooseVoice(page, 'adult-male');
  await page.locator('#readAloudPlay').click();
  expect(await latestUtterance(page)).toEqual({voice:'Neutral US', pitch:0.95, rate:1});
  await page.locator('#readAloudPlay').click();
  await page.evaluate(() => { window.__speech.voices = [{name:'French Voice', lang:'fr-FR', localService:true}]; window.__speech.listeners[0](); });
  await expect(page.locator('#readAloudVoice')).toHaveValue('adult-male');
  await page.locator('#readAloudPlay').click();
  expect(await latestUtterance(page)).toEqual({voice:null, pitch:0.95, rate:1});
  expect(await page.evaluate(() => localStorage.getItem('god4.speech.voice'))).toBe('adult-male');
});

test('Adult Male persists through Stop, resume, chapter transition, and reload', async ({page}) => {
  await installSpeech(page, mixedVoices);
  await chooseVoice(page, 'adult-male');
  const finalVerse = await page.evaluate(() => BibleData.getChapter('web', 'john', 1).verses.length);
  await page.locator('#verseSelect').selectOption(String(finalVerse));
  await page.locator('#readAloudPlay').click();
  expect(await latestUtterance(page)).toMatchObject({voice:'Microsoft Mark', pitch:0.95});
  await page.locator('#readAloudPlay').click();
  await page.locator('#readAloudPlay').click();
  expect(await latestUtterance(page)).toMatchObject({voice:'Microsoft Mark', pitch:0.95});
  await page.evaluate(() => window.__speech.utterances.at(-1).onend());
  expect(await latestUtterance(page)).toMatchObject({voice:'Microsoft Mark', pitch:0.95});
  await page.reload();
  await expect(page.locator('#readAloudVoice')).toHaveValue('adult-male');
  await page.locator('#readAloudPlay').click();
  await expect.poll(() => page.evaluate(() => window.__speech.utterances.length)).toBe(1);
  expect(await latestUtterance(page)).toMatchObject({voice:'Microsoft Mark', pitch:0.95});
});

test('Child Female persists through verse speech, Repeat, fullscreen, and reload', async ({page}) => {
  await installSpeech(page, mixedVoices);
  await chooseVoice(page, 'child-female');
  await page.locator('#readAloudPlay').click();
  expect(await latestUtterance(page)).toMatchObject({voice:'Microsoft Zira', pitch:1.3});
  await page.evaluate(() => window.__speech.utterances.at(-1).onstart());
  expect(await page.evaluate(() => BibleSpeech.repeatVerse(1))).toBe(true);
  expect(await latestUtterance(page)).toMatchObject({voice:'Microsoft Zira', pitch:1.3});
  await page.locator('#fullscreenBtn').click();
  await page.locator('#readerContent [data-verse-speech="2"]').click();
  expect(await latestUtterance(page)).toMatchObject({voice:'Microsoft Zira', pitch:1.3});
  await page.locator('#fullscreenBtn').click();
  await page.reload();
  await expect(page.locator('#readAloudVoice')).toHaveValue('child-female');
  await page.locator('#readAloudPlay').click();
  await expect.poll(() => page.evaluate(() => window.__speech.utterances.length)).toBe(1);
  expect(await latestUtterance(page)).toMatchObject({voice:'Microsoft Zira', pitch:1.3});
});

test('exact device voice remains selectable without profile pitch', async ({page}) => {
  await installSpeech(page, mixedVoices);
  await chooseVoice(page, 'Microsoft Daniel');
  await page.locator('#readAloudPlay').click();
  expect(await latestUtterance(page)).toEqual({voice:'Microsoft Daniel', pitch:1, rate:1});
  await page.reload();
  await expect(page.locator('#readAloudVoice')).toHaveValue('Microsoft Daniel');
});
