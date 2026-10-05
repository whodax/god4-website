const {test, expect} = require('@playwright/test');

const phoneVoices = [
  {name:'Google U.S. English', lang:'en-US', localService:false, voiceURI:'google-us'},
  {name:'Mark English U.S.', lang:'en-US', localService:true, voiceURI:'mark'},
  {name:'Google UK English Female', lang:'en-GB', localService:false, voiceURI:'google-uk-female'},
  {name:'Zira English U.S.', lang:'en-US', localService:true, voiceURI:'zira'},
  {name:'David English U.S.', lang:'en-US', localService:true, voiceURI:'david'},
  {name:'Google UK English Male', lang:'en-GB', localService:false, voiceURI:'google-uk-male'}
];

async function installSpeech(page, initialVoices, savedVoice){
  await page.addInitScript(({voices, saved}) => {
    if(saved !== undefined) localStorage.setItem('god4.speech.voice', saved);
    window.__speech = {voices, utterances:[], listeners:[], cancels:0};
    window.SpeechSynthesisUtterance = function(text){ this.text = text; };
    Object.defineProperty(window, 'speechSynthesis', {configurable:true, value:{
      getVoices(){ return window.__speech.voices; },
      addEventListener(type, callback){ if(type === 'voiceschanged') window.__speech.listeners.push(callback); },
      speak(utterance){ window.__speech.utterances.push(utterance); },
      cancel(){ window.__speech.cancels++; }, pause(){}, resume(){}
    }});
    window.addEventListener('DOMContentLoaded', () => initializeBibleExperience());
  }, {voices:initialVoices, saved:savedVoice});
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
    return {voice:utterance.voice?.name || null, pitch:utterance.pitch, rate:utterance.rate};
  });
}

test('phone inventory exposes only Male and Female and uses exact David and Zira objects', async ({page}) => {
  await installSpeech(page, phoneVoices);
  await expect(page.locator('#readAloudVoice option')).toHaveText(['Male', 'Female']);
  await expect(page.locator('#readAloudVoice')).toHaveValue('male');
  await page.locator('#readAloudPlay').click();
  expect(await latestUtterance(page)).toEqual({voice:'David English U.S.', pitch:1, rate:1});
  expect(await page.evaluate(() => window.__speech.utterances[0].voice === window.__speech.voices[4])).toBe(true);
  await page.locator('#readAloudPlay').click();
  await chooseVoice(page, 'female');
  await page.locator('#readAloudSpeed').selectOption('1.5');
  await page.locator('#readAloudPlay').click();
  expect(await latestUtterance(page)).toEqual({voice:'Zira English U.S.', pitch:1, rate:1.5});
  expect(await page.evaluate(() => window.__speech.utterances.at(-1).voice === window.__speech.voices[3])).toBe(true);
});

for(const [first, second] of [['male','female'], ['female','male']]){
  test(`${first} to ${second} changes concrete voice after Stop and Play`, async ({page}) => {
    await installSpeech(page, phoneVoices);
    await chooseVoice(page, first);
    await page.locator('#readAloudPlay').click();
    await page.locator('#readAloudPlay').click();
    await chooseVoice(page, second);
    await page.locator('#readAloudPlay').click();
    expect(await page.evaluate(() => ({
      different:window.__speech.utterances[0].voice !== window.__speech.utterances[1].voice,
      stored:localStorage.getItem('god4.speech.voice')
    }))).toEqual({different:true, stored:second});
  });
}

test('changing during a spoken verse affects the next utterance', async ({page}) => {
  await installSpeech(page, phoneVoices);
  await page.locator('#readAloudPlay').click();
  await chooseVoice(page, 'female');
  expect(await page.evaluate(() => window.__speech.utterances.length)).toBe(1);
  await page.evaluate(() => window.__speech.utterances[0].onend());
  expect(await page.evaluate(() => ({
    first:window.__speech.utterances[0].voice.name,
    next:window.__speech.utterances[1].voice.name,
    stored:localStorage.getItem('god4.speech.voice')
  }))).toEqual({first:'David English U.S.', next:'Zira English U.S.', stored:'female'});
});

test('Female persists through Stop, next chapter, Repeat, fullscreen, verse speech, and reload', async ({page}) => {
  await installSpeech(page, phoneVoices);
  await chooseVoice(page, 'female');
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
  await page.locator('#readAloudPlay').click();
  await page.locator('#readAloudPlay').click();
  expect(await latestUtterance(page)).toMatchObject({voice:'Zira English U.S.', pitch:1});
  await page.evaluate(() => readVerseAloud(2));
  expect(await latestUtterance(page)).toMatchObject({voice:'Zira English U.S.', pitch:1});
  await page.locator('#fullscreenBtn').click();
  await page.reload();
  await expect(page.locator('#readAloudVoice')).toHaveValue('female');
  await page.locator('#readAloudPlay').click();
  await expect.poll(() => page.evaluate(() => window.__speech.utterances.length)).toBe(1);
  expect(await latestUtterance(page)).toMatchObject({voice:'Zira English U.S.', pitch:1});
});

test('delayed voiceschanged retains Female selection without duplicate choices', async ({page}) => {
  await installSpeech(page, [], 'female');
  await expect(page.locator('#readAloudVoice')).toBeDisabled();
  await page.evaluate(voices => {
    window.__speech.voices = voices;
    window.__speech.listeners[0]();
    window.__speech.listeners[0]();
  }, phoneVoices);
  await expect(page.locator('#readAloudVoice option')).toHaveText(['Male', 'Female']);
  await expect(page.locator('#readAloudVoice')).toHaveValue('female');
  await page.locator('#readAloudPlay').click();
  expect(await latestUtterance(page)).toMatchObject({voice:'Zira English U.S.', pitch:1});
});

test('unavailable preferred voices use distinct deterministic English fallbacks', async ({page}) => {
  await installSpeech(page, [
    {name:'Neutral B', lang:'en-US', localService:true, voiceURI:'b'},
    {name:'Neutral A', lang:'en-US', localService:true, voiceURI:'a'}
  ]);
  await expect(page.locator('#readAloudVoice option')).toHaveText(['Male', 'Female']);
  await page.locator('#readAloudPlay').click();
  expect(await latestUtterance(page)).toMatchObject({voice:'Neutral A'});
  await page.locator('#readAloudPlay').click();
  await chooseVoice(page, 'female');
  await page.locator('#readAloudPlay').click();
  expect(await latestUtterance(page)).toMatchObject({voice:'Neutral B'});
});

test('one English voice stays playable with one visible choice', async ({page}) => {
  await installSpeech(page, [{name:'Neutral A', lang:'en-US', localService:true, voiceURI:'a'}]);
  await expect(page.locator('#readAloudVoice option')).toHaveText(['Male']);
  await page.locator('#readAloudPlay').click();
  expect(await latestUtterance(page)).toMatchObject({voice:'Neutral A', pitch:1});
});

test('duplicate voiceURI aliases never create duplicate visible choices', async ({page}) => {
  await installSpeech(page, [
    {name:'Neutral A', lang:'en-US', localService:true, voiceURI:'shared'},
    {name:'Neutral Alias', lang:'en-US', localService:true, voiceURI:'shared'},
    {name:'Neutral B', lang:'en-US', localService:true, voiceURI:'separate'}
  ]);
  await expect(page.locator('#readAloudVoice option')).toHaveText(['Male', 'Female']);
});

test('old profiles and concrete names migrate safely, including silent Male 2', async ({page}) => {
  await installSpeech(page, phoneVoices);
  const migrations = [
    ['auto','male'], ['adult-male','male'], ['child-male','male'],
    ['adult-female','female'], ['child-female','female'],
    ['David English U.S.','male'], ['Male 1 — David','male'],
    ['Zira English U.S.','female'], ['Female — Zira','female'],
    ['Google UK English Male','male'], ['Male 2 — Google UK English Male','male'],
    ['Mark English U.S.','male'], ['Google UK English Female','female']
  ];
  for(const [oldValue, expected] of migrations){
    await page.evaluate(value => localStorage.setItem('god4.speech.voice', value), oldValue);
    await page.reload();
    await expect(page.locator('#readAloudVoice')).toHaveValue(expected);
    expect(await page.evaluate(() => localStorage.getItem('god4.speech.voice'))).toBe(expected);
  }
});
