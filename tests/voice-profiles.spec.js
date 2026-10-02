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
  expect(await latestUtterance(page)).toEqual({voice:'Microsoft Daniel', pitch:1.23, rate:1.5});
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

test('two generic Android-like English voices stay distinct through profile changes and reordered inventory', async ({page}) => {
  const generic = [
    {name:'Android English B', lang:'en-US', localService:true},
    {name:'Android English A', lang:'en-US', localService:true}
  ];
  await installSpeech(page, generic);
  await chooseVoice(page, 'adult-male');
  await page.locator('#readAloudSpeed').selectOption('1.25');
  expect(await page.evaluate(() => BibleSpeech.getResolvedVoiceInfo())).toEqual({
    preference:'adult-male', voiceName:'Android English A', lang:'en-US', pitch:0.95
  });
  await page.locator('#readAloudPlay').click();
  expect(await latestUtterance(page)).toEqual({voice:'Android English A', pitch:0.95, rate:1.25});
  const transitions = [
    ['adult-female', 'Android English B', 1.05],
    ['child-male', 'Android English A', 1.23],
    ['child-female', 'Android English B', 1.3],
    ['adult-male', 'Android English A', 0.95]
  ];
  for(const [profile, voiceName, pitch] of transitions){
    const before = await page.evaluate(() => window.__speech.utterances.length);
    await chooseVoice(page, profile);
    expect(await page.evaluate(() => window.__speech.utterances.length)).toBe(before);
    await page.evaluate(() => window.__speech.utterances.at(-1).onend());
    expect(await latestUtterance(page)).toEqual({voice:voiceName, pitch, rate:1.25});
  }
  await page.evaluate(() => {
    window.__speech.voices.reverse();
    window.__speech.listeners[0]();
  });
  expect(await page.evaluate(() => BibleSpeech.getResolvedVoiceInfo().voiceName)).toBe('Android English A');
  await page.reload();
  await expect(page.locator('#readAloudVoice')).toHaveValue('adult-male');
  expect(await page.evaluate(() => BibleSpeech.getResolvedVoiceInfo().voiceName)).toBe('Android English A');
});

test('one English voice is shared honestly while profile pitches and preference remain distinct', async ({page}) => {
  await installSpeech(page, [{name:'Only English', lang:'en-US', localService:true}]);
  for(const [profile, pitch] of [
    ['adult-male', 0.95], ['adult-female', 1.05], ['child-male', 1.23], ['child-female', 1.3]
  ]){
    await chooseVoice(page, profile);
    expect(await page.evaluate(() => BibleSpeech.getResolvedVoiceInfo())).toEqual({
      preference:profile, voiceName:'Only English', lang:'en-US', pitch
    });
    await page.locator('#readAloudPlay').click();
    expect(await latestUtterance(page)).toEqual({voice:'Only English', pitch, rate:1});
    await page.locator('#readAloudPlay').click();
  }
  await expect(page.locator('#readAloudVoice')).toHaveValue('child-female');
});

test('Apple and Google name hints use separate bases after delayed iOS-like voice loading', async ({page}) => {
  await installSpeech(page, []);
  await chooseVoice(page, 'adult-female');
  expect(await page.evaluate(() => BibleSpeech.getResolvedVoiceInfo().voiceName)).toBeNull();
  const named = [
    {name:'Google US English Female', lang:'en-US', localService:false},
    {name:'Aaron', lang:'en-US', localService:true},
    {name:'Tessa', lang:'en-ZA', localService:true},
    {name:'Google US English Male', lang:'en-US', localService:false}
  ];
  await page.evaluate(voices => {
    window.__speech.voices = voices;
    window.__speech.listeners[0]();
  }, named);
  await expect(page.locator('#readAloudVoice')).toHaveValue('adult-female');
  expect(await page.evaluate(() => BibleSpeech.getResolvedVoiceInfo().voiceName)).toBe('Tessa');
  await page.locator('#readAloudPlay').click();
  expect(await latestUtterance(page)).toMatchObject({voice:'Tessa', pitch:1.05});
  await chooseVoice(page, 'child-male');
  await page.evaluate(() => window.__speech.utterances.at(-1).onend());
  expect(await latestUtterance(page)).toMatchObject({voice:'Google US English Male', pitch:1.23});
});

test('four generic English voices give all four profiles distinct stable bases', async ({page}) => {
  await installSpeech(page, ['D', 'B', 'A', 'C'].map(name => ({
    name:'Android English ' + name, lang:'en-US', localService:true
  })));
  const mapping = [
    ['adult-male', 'Android English A'],
    ['adult-female', 'Android English B'],
    ['child-male', 'Android English C'],
    ['child-female', 'Android English D']
  ];
  for(const [profile, voiceName] of mapping){
    await chooseVoice(page, profile);
    expect(await page.evaluate(() => BibleSpeech.getResolvedVoiceInfo().voiceName)).toBe(voiceName);
  }
  await page.evaluate(() => { window.__speech.voices.reverse(); window.__speech.listeners[0](); });
  for(const [profile, voiceName] of mapping){
    await chooseVoice(page, profile);
    expect(await page.evaluate(() => BibleSpeech.getResolvedVoiceInfo().voiceName)).toBe(voiceName);
  }
});

test('separate male and female name hints can give child profiles distinct bases', async ({page}) => {
  await installSpeech(page, [
    {name:'Tessa', lang:'en-ZA', localService:true},
    {name:'Alex', lang:'en-US', localService:true},
    {name:'Samantha', lang:'en-US', localService:true},
    {name:'Aaron', lang:'en-US', localService:true}
  ]);
  for(const [profile, voiceName] of [
    ['adult-male', 'Aaron'], ['adult-female', 'Samantha'],
    ['child-male', 'Alex'], ['child-female', 'Tessa']
  ]){
    await chooseVoice(page, profile);
    expect(await page.evaluate(() => BibleSpeech.getResolvedVoiceInfo().voiceName)).toBe(voiceName);
  }
});
