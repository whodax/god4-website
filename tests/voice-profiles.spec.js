const {test, expect} = require('@playwright/test');

const phoneVoices = [
  {name:'Google U.S. English', lang:'en-US', localService:false, voiceURI:'google-us'},
  {name:'Mark English U.S.', lang:'en-US', localService:true, voiceURI:'mark'},
  {name:'Google UK English Female', lang:'en-GB', localService:false, voiceURI:'google-uk-female'},
  {name:'Zira English U.S.', lang:'en-US', localService:true, voiceURI:'zira'},
  {name:'David English U.S.', lang:'en-US', localService:true, voiceURI:'david'},
  {name:'Google UK English Male', lang:'en-GB', localService:false, voiceURI:'google-uk-male'}
];

async function installSpeech(page, initialVoices){
  await page.addInitScript(voices => {
    window.__speech = {voices, utterances:[], listeners:[], cancels:0};
    window.SpeechSynthesisUtterance = function(text){ this.text = text; };
    Object.defineProperty(window, 'speechSynthesis', {configurable:true, value:{
      getVoices(){ return window.__speech.voices; },
      addEventListener(type, callback){ if(type === 'voiceschanged') window.__speech.listeners.push(callback); },
      speak(utterance){ window.__speech.utterances.push(utterance); },
      cancel(){ window.__speech.cancels++; }, pause(){}, resume(){}
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

test('the phone inventory shows only David, Google UK Male, and Zira as concrete choices', async ({page}) => {
  await installSpeech(page, phoneVoices);
  const options = page.locator('#readAloudVoice option');
  await expect(options).toHaveText(['Male 1 — David', 'Male 2 — Google UK English Male', 'Female — Zira']);
  await expect(page.locator('#readAloudVoice optgroup')).toHaveCount(0);
  await expect(page.locator('#readAloudVoice')).toHaveValue('David English U.S.');
  for(const name of ['David English U.S.', 'Google UK English Male', 'Zira English U.S.']){
    await chooseVoice(page, name);
    await page.locator('#readAloudSpeed').selectOption('1.5');
    await page.locator('#readAloudPlay').click();
    expect(await latestUtterance(page)).toEqual({voice:name, pitch:1, rate:1.5});
    await page.locator('#readAloudPlay').click();
  }
});

test('changing concrete voice affects the next verse without restarting the current one', async ({page}) => {
  await installSpeech(page, phoneVoices);
  await page.locator('#readAloudPlay').click();
  expect(await latestUtterance(page)).toMatchObject({voice:'David English U.S.', pitch:1});
  await chooseVoice(page, 'Google UK English Male');
  expect(await page.evaluate(() => window.__speech.utterances.length)).toBe(1);
  await page.evaluate(() => window.__speech.utterances.at(-1).onend());
  expect(await latestUtterance(page)).toMatchObject({voice:'Google UK English Male', pitch:1});
  await chooseVoice(page, 'Zira English U.S.');
  await page.evaluate(() => window.__speech.utterances.at(-1).onend());
  expect(await latestUtterance(page)).toMatchObject({voice:'Zira English U.S.', pitch:1});
});

test('selected concrete voice persists through Stop, chapter continuation, Repeat, fullscreen, verse speech, and reload', async ({page}) => {
  await installSpeech(page, phoneVoices);
  await chooseVoice(page, 'Zira English U.S.');
  const lastVerse = await page.evaluate(() => BibleData.getChapter('web', 'john', 1).verses.length);
  await page.locator('#verseSelect').selectOption(String(lastVerse));
  await page.locator('#readAloudPlay').click();
  await page.locator('#readAloudPlay').click();
  await page.locator('#readAloudPlay').click();
  expect(await latestUtterance(page)).toMatchObject({voice:'Zira English U.S.', pitch:1});
  await page.evaluate(() => window.__speech.utterances.at(-1).onend());
  expect(await latestUtterance(page)).toMatchObject({voice:'Zira English U.S.', pitch:1});
  expect(await page.evaluate(() => BibleSpeech.repeatVerse(1))).toBe(true);
  expect(await latestUtterance(page)).toMatchObject({voice:'Zira English U.S.', pitch:1});
  await page.locator('#fullscreenBtn').click();
  await page.locator('#readerContent [data-verse-speech="2"]').click();
  expect(await latestUtterance(page)).toMatchObject({voice:'Zira English U.S.', pitch:1});
  await page.locator('#fullscreenBtn').click();
  await page.reload();
  await expect(page.locator('#readAloudVoice')).toHaveValue('Zira English U.S.');
  await page.locator('#readAloudPlay').click();
  await expect.poll(() => page.evaluate(() => window.__speech.utterances.length)).toBe(1);
  expect(await latestUtterance(page)).toMatchObject({voice:'Zira English U.S.', pitch:1});
});

test('delayed voiceschanged retains a saved concrete voice and does not duplicate options', async ({page}) => {
  await installSpeech(page, []);
  await page.evaluate(() => localStorage.setItem('god4.speech.voice', 'Zira English U.S.'));
  await page.reload();
  await page.setViewportSize({width:320, height:700});
  await expect(page.locator('#readAloudVoice')).toBeDisabled();
  await expect(page.locator('#readAloudVoice option')).toHaveText(['Loading voices…']);
  expect(await page.evaluate(() => window.__speech.listeners.length)).toBe(1);
  await page.evaluate(voices => {
    window.__speech.voices = voices;
    window.__speech.listeners[0]();
    window.__speech.listeners[0]();
  }, phoneVoices);
  await expect(page.locator('#readAloudVoice')).toHaveValue('Zira English U.S.');
  await expect(page.locator('#readAloudVoice option')).toHaveCount(3);
  const overflow = await page.evaluate(() => [...document.querySelectorAll('#view-reader *')].some(element => {
    const bounds = element.getBoundingClientRect();
    return bounds.left < -1 || bounds.right > innerWidth + 1;
  }));
  expect(overflow).toBe(false);
  await page.locator('#readAloudPlay').click();
  expect(await latestUtterance(page)).toMatchObject({voice:'Zira English U.S.', pitch:1});
});

test('one or two English voices produce only one or two concrete choices', async ({page}) => {
  const generic = [
    {name:'Neutral B', lang:'en-US', localService:true, voiceURI:'b'},
    {name:'Neutral A', lang:'en-US', localService:true, voiceURI:'a'}
  ];
  await installSpeech(page, generic);
  await expect(page.locator('#readAloudVoice option')).toHaveText(['Neutral A', 'Neutral B']);
  await chooseVoice(page, 'Neutral B');
  await page.evaluate(() => { window.__speech.voices.reverse(); window.__speech.listeners[0](); });
  await expect(page.locator('#readAloudVoice')).toHaveValue('Neutral B');
  await page.evaluate(() => { window.__speech.voices = [window.__speech.voices[0]]; window.__speech.listeners[0](); });
  await expect(page.locator('#readAloudVoice option')).toHaveCount(1);
  await page.locator('#readAloudPlay').click();
  expect(await latestUtterance(page)).toMatchObject({voice:'Neutral A', pitch:1});
  await page.locator('#readAloudPlay').click();
  await page.evaluate(() => { window.__speech.voices = [{name:'French', lang:'fr-FR'}]; window.__speech.listeners[0](); });
  await expect(page.locator('#readAloudVoice')).toBeDisabled();
  await expect(page.locator('#readAloudVoice option')).toHaveText(['No English voices available']);
});

test('shared voiceURI suppresses another alias while a genuinely separate voice remains', async ({page}) => {
  await installSpeech(page, [
    {name:'Neutral A', lang:'en-US', localService:true, voiceURI:'shared'},
    {name:'Neutral Alias', lang:'en-US', localService:true, voiceURI:'shared'},
    {name:'Neutral B', lang:'en-US', localService:true, voiceURI:'separate'}
  ]);
  await expect(page.locator('#readAloudVoice option')).toHaveText(['Neutral A', 'Neutral B']);
});

test('old profile and duplicate device preferences migrate to concrete available voices', async ({page}) => {
  await installSpeech(page, phoneVoices);
  const migrations = [
    ['auto', 'David English U.S.'], ['adult-male', 'David English U.S.'],
    ['child-male', 'Google UK English Male'], ['adult-female', 'Zira English U.S.'],
    ['child-female', 'Zira English U.S.'], ['Mark English U.S.', 'Google UK English Male'],
    ['Google UK English Female', 'Zira English U.S.']
  ];
  for(const [oldValue, expected] of migrations){
    await page.evaluate(value => localStorage.setItem('god4.speech.voice', value), oldValue);
    await page.reload();
    await expect(page.locator('#readAloudVoice')).toHaveValue(expected);
    expect(await page.evaluate(() => localStorage.getItem('god4.speech.voice'))).toBe(expected);
  }
});
