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
    window.__speech = {voices, utterances:[], listeners:[], cancels:0, reads:0};
    window.SpeechSynthesisUtterance = function(text){ this.text = text; };
    Object.defineProperty(window, 'speechSynthesis', {configurable:true, value:{
      getVoices(){ window.__speech.reads++; return window.__speech.voices; },
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

test('Windows inventory exposes only Male and Female and uses exact David and Zira objects', async ({page}) => {
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
  await expect(page.locator('#readAloudVoice option')).toHaveText(['Male', 'Female']);
  await expect(page.locator('#readAloudVoice')).toBeEnabled();
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

test('one English voice keeps both semantic choices playable', async ({page}) => {
  await installSpeech(page, [{name:'Neutral A', lang:'en-US', localService:true, voiceURI:'a'}]);
  await expect(page.locator('#readAloudVoice option')).toHaveText(['Male', 'Female']);
  await page.locator('#readAloudPlay').click();
  expect(await latestUtterance(page)).toMatchObject({voice:'Neutral A', pitch:1});
  await page.locator('#readAloudPlay').click();
  await chooseVoice(page, 'female');
  await page.locator('#readAloudPlay').click();
  expect(await latestUtterance(page)).toMatchObject({voice:'Neutral A', pitch:1});
  expect(await page.evaluate(() => BibleSpeech.getResolvedVoiceInfo())).toMatchObject({
    preference:'female', sharedFallback:true,
    male:{name:'Neutral A', voiceURI:'a', lang:'en-US'},
    female:{name:'Neutral A', voiceURI:'a', lang:'en-US'}
  });
});

const mobileVoices = [
  {name:'Samantha', lang:'en-US', localService:true, voiceURI:'apple-samantha'},
  {name:'Alex', lang:'en-US', localService:true, voiceURI:'apple-alex'},
  {name:'Daniel', lang:'en-GB', localService:true, voiceURI:'apple-daniel'},
  {name:'Google UK English Female', lang:'en-GB', localService:false, voiceURI:'google-female'},
  {name:'Google UK English Male', lang:'en-GB', localService:false, voiceURI:'google-male'}
];

async function resolvedProfiles(page){
  return page.evaluate(() => BibleSpeech.getResolvedVoiceInfo());
}

async function changeInventory(page, voices){
  await page.evaluate(voices => {
    window.__speech.voices = voices;
    window.__speech.listeners.forEach(listener => listener());
  }, voices);
}

test('phone native English profiles stay distinct across switching, verses, and shuffled inventories', async ({page}) => {
  await installSpeech(page, mobileVoices);
  const expected = {male:{name:'Alex', voiceURI:'apple-alex', lang:'en-US'},
    female:{name:'Samantha', voiceURI:'apple-samantha', lang:'en-US'}, sharedFallback:false};
  expect(await resolvedProfiles(page)).toMatchObject(expected);
  for(const preference of ['male', 'female', 'male', 'female']){
    await chooseVoice(page, preference);
    await page.locator('#readAloudPlay').click();
    const reads = await page.evaluate(() => window.__speech.reads);
    await page.evaluate(() => {
      for(let i = 0; i < 3; i++) window.__speech.utterances.at(-1).onend();
    });
    expect(await page.evaluate(() => window.__speech.reads)).toBe(reads);
    expect(await page.evaluate(() => window.__speech.utterances.slice(-4).map(u => u.voice.voiceURI)))
      .toEqual(Array(4).fill(expected[preference].voiceURI));
    expect(await page.evaluate(() => localStorage.getItem('god4.speech.voice'))).toBe(preference);
    await page.locator('#readAloudPlay').click();
    await changeInventory(page, [...mobileVoices].reverse());
    expect(await resolvedProfiles(page)).toMatchObject(expected);
  }
});

test('tablet initial singleton upgrades on voiceschanged without interrupting the current verse', async ({page}) => {
  await installSpeech(page, [{name:'Neutral Tablet', lang:'en-US', localService:true, voiceURI:'tablet'}], 'female');
  await expect(page.locator('#readAloudVoice option')).toHaveText(['Male', 'Female']);
  await expect(page.locator('#readAloudVoice')).toBeEnabled();
  expect(await resolvedProfiles(page)).toMatchObject({preference:'female', sharedFallback:true});
  await page.locator('#readAloudPlay').click();
  const cancels = await page.evaluate(() => window.__speech.cancels);
  await changeInventory(page, phoneVoices);
  expect(await resolvedProfiles(page)).toMatchObject({preference:'female',
    male:{name:'David English U.S.'}, female:{name:'Zira English U.S.'}, sharedFallback:false});
  expect(await page.evaluate(() => ({cancels:window.__speech.cancels, count:window.__speech.utterances.length,
    current:window.__speech.utterances[0].voice.name, state:BibleSpeech.getState()})))
    .toEqual({cancels, count:1, current:'Neutral Tablet', state:'playing'});
  await expect(page.locator('#readAloudVoice')).toHaveValue('female');
  await page.evaluate(() => window.__speech.utterances[0].onend());
  expect(await latestUtterance(page)).toMatchObject({voice:'Zira English U.S.'});
});

test('empty phone inventory remains selectable and speaks with browser default until voices arrive', async ({page}) => {
  // The shell must also preserve semantic options before the speech module loads.
  const shell = await (await page.request.get('/')).text();
  expect(shell.match(/<select id="readAloudVoice">([\s\S]*?)<\/select>/)[1])
    .toMatch(/value="male">Male<\/option>[\s\S]*value="female">Female<\/option>/);
  await installSpeech(page, []);
  await expect(page.locator('#readAloudVoice option')).toHaveText(['Male', 'Female']);
  await chooseVoice(page, 'female');
  await page.locator('#readAloudPlay').click();
  expect(await latestUtterance(page)).toMatchObject({voice:null});
  expect(await resolvedProfiles(page)).toMatchObject({preference:'female', male:null, female:null, sharedFallback:false});
  const cancels = await page.evaluate(() => window.__speech.cancels);
  await changeInventory(page, mobileVoices);
  expect(await page.evaluate(() => window.__speech.cancels)).toBe(cancels);
  await page.evaluate(() => window.__speech.utterances[0].onend());
  expect(await latestUtterance(page)).toMatchObject({voice:'Samantha'});
});

test('voice identities include URI, name, and language and remain cached until an inventory event', async ({page}) => {
  const inventory = [
    {name:'Neutral', lang:'en-US', localService:true, voiceURI:'uri-b'},
    {name:'Neutral', lang:'en-US', localService:true, voiceURI:'uri-a'},
    {name:'Neutral', lang:'en-GB', localService:true, voiceURI:'uri-a'}
  ];
  await installSpeech(page, inventory);
  const expected = {male:{name:'Neutral', voiceURI:'uri-a', lang:'en-US'},
    female:{name:'Neutral', voiceURI:'uri-b', lang:'en-US'}, englishVoiceCount:3};
  expect(await resolvedProfiles(page)).toMatchObject(expected);
  await page.locator('#readAloudPlay').click();
  await page.evaluate(() => { window.__speech.voices = []; window.__speech.utterances.at(-1).onend(); });
  expect(await resolvedProfiles(page)).toMatchObject(expected);
  expect(await page.evaluate(() => window.__speech.utterances.at(-1).voice === window.__speech.utterances[0].voice)).toBe(true);
  await changeInventory(page, inventory.reverse());
  expect(await resolvedProfiles(page)).toMatchObject(expected);
});

test('Google English male and female voices remain available without Windows voices', async ({page}) => {
  await installSpeech(page, mobileVoices.slice(3));
  expect(await resolvedProfiles(page)).toMatchObject({male:{name:'Google UK English Male'}, female:{name:'Google UK English Female'}});
  await page.locator('#readAloudPlay').click();
  expect(await latestUtterance(page)).toMatchObject({voice:'Google UK English Male'});
});

test('Android gender-marked English names beat generic fallbacks and foreign voices', async ({page}) => {
  await installSpeech(page, [
    {name:'Android en-us-x-sfg#female_1-local', lang:'en-US', localService:true, voiceURI:'android-female'},
    {name:'Android en-us-x-sfg#male_1-local', lang:'en-US', localService:true, voiceURI:'android-male'},
    {name:'A Default', lang:'en-US', localService:true, voiceURI:'default'},
    {name:'David', lang:'fr-FR', localService:true, voiceURI:'foreign'}
  ]);
  expect(await resolvedProfiles(page)).toMatchObject({male:{voiceURI:'android-male'}, female:{voiceURI:'android-female'}});
});

for(const name of ['Microsoft Zira', 'Microsoft David']){
  test(`singleton ${name} cannot hide either semantic choice or change a saved Female preference`, async ({page}) => {
    await installSpeech(page, [{name, lang:'en-US', voiceURI:name, localService:true}], 'female');
    await expect(page.locator('#readAloudVoice option')).toHaveText(['Male', 'Female']);
    await expect(page.locator('#readAloudVoice')).toHaveValue('female');
    await expect(page.locator('#readAloudVoice')).toBeEnabled();
    expect(await resolvedProfiles(page)).toMatchObject({preference:'female', male:{name}, female:{name}, sharedFallback:true});
  });
}

test('known Female fallback retains Samantha while Male uses another available English voice', async ({page}) => {
  await installSpeech(page, [mobileVoices[0], {name:'Neutral', lang:'en-GB', localService:true, voiceURI:'neutral'}]);
  expect(await resolvedProfiles(page)).toMatchObject({male:{name:'Neutral'}, female:{name:'Samantha'}, sharedFallback:false});
});

test('Windows canonical en-US voices outrank same names in other locales and shuffle consistently', async ({page}) => {
  const inventory = [...phoneVoices,
    {name:'David', lang:'en-GB', localService:true, voiceURI:'david-gb'},
    {name:'Zira', lang:'en-GB', localService:true, voiceURI:'zira-gb'}];
  await installSpeech(page, inventory);
  for(const voices of [inventory, [...inventory].reverse(), [...inventory.slice(3), ...inventory.slice(0,3)]]){
    await changeInventory(page, voices);
    expect(await resolvedProfiles(page)).toMatchObject({male:{voiceURI:'david'}, female:{voiceURI:'zira'}});
  }
});

for(const width of [320, 375, 480]){
  test(`both profiles remain accessible in normal and fullscreen Reader at ${width}px`, async ({page}) => {
    await page.setViewportSize({width, height:800});
    await installSpeech(page, [mobileVoices[0]]);
    for(const fullscreen of [false, true]){
      if(fullscreen) await page.locator('#fullscreenBtn').click();
      await chooseVoice(page, 'male');
      await expect(page.getByRole('combobox', {name:'Voice:', exact:true})).toBeEnabled();
      await expect(page.locator('#readAloudVoice option')).toHaveText(['Male', 'Female']);
      const snapshot = await page.locator('#readerSecondaryControls').ariaSnapshot();
      expect(snapshot).toContain('Male');
      expect(snapshot).toContain('Female');
      expect(snapshot).not.toContain('Samantha');
      await chooseVoice(page, 'female');
      await page.locator('#readAloudPlay').click();
      expect(await latestUtterance(page)).toMatchObject({voice:'Samantha'});
      await page.locator('#readAloudPlay').click();
      expect(await page.locator('#readAloudVoice').evaluate(element => {
        const rect = element.getBoundingClientRect();
        return rect.left >= 0 && rect.right <= innerWidth && document.documentElement.scrollWidth <= innerWidth;
      })).toBe(true);
      await expect(page.locator('#readerContent [data-verse-speech], #readerContent .verse-speak')).toHaveCount(0);
      await page.locator('#readerMoreTrigger').click();
    }
  });
}

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
