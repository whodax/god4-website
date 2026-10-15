const {test,expect}=require('@playwright/test');
async function open(page,{speech=false,cloud=false}={}){
  await page.addInitScript(({speech,cloud})=>{
    if(!speech)return;
    window.__referenceAudio={utterances:[],sources:[]};
    Object.defineProperty(window,'SpeechSynthesisUtterance',{configurable:true,value:function(text){this.text=text;}});
    Object.defineProperty(window,'speechSynthesis',{configurable:true,value:{getVoices(){return [{name:'Microsoft David',lang:'en-US',localService:true}];},addEventListener(){},speak(u){window.__referenceAudio.utterances.push(u);u.onstart?.();},pause(){},resume(){},cancel(){}}});
    class Context{
      constructor(){this.state='running';this.destination={};}resume(){return Promise.resolve();}suspend(){return Promise.resolve();}
      decodeAudioData(){return Promise.resolve({duration:1});}
      createBufferSource(){const source={connect(){},disconnect(){},start(){},stop(){},end(){this.onended?.();}};window.__referenceAudio.sources.push(source);return source;}
    }
    Object.defineProperty(window,'AudioContext',{configurable:true,value:cloud?Context:undefined});
    Object.defineProperty(window,'webkitAudioContext',{configurable:true,value:undefined});
  },{speech,cloud});
  if(cloud)await page.route('**/api/tts',route=>route.fulfill({contentType:'audio/mpeg',body:'audio'}));
  await page.goto('/');await page.evaluate(()=>initializeBibleExperience());
}
const reference=page=>page.locator('#readerContent h2');
test('single semantic heading switches immediately between chapter and selected verse',async({page})=>{
  await open(page);
  await expect(reference(page)).toHaveText('John 1');
  await page.locator('#chapterSelect').selectOption('3');await expect(reference(page)).toHaveText('John 3');
  await page.locator('#verseSelect').selectOption('16');
  await expect(page.getByRole('heading',{name:'John 3:16',exact:true})).toHaveCount(1);
  await expect(page.locator('#readerContent [data-verse-number="16"]')).toBeFocused();
  expect(await reference(page).evaluate(h=>({live:h.closest('[aria-live]')?.getAttribute('aria-live'),count:h.parentElement.querySelectorAll('h2').length}))).toEqual({live:undefined,count:1});
  const immediate=await page.evaluate(()=>{selectReaderVerse('17');return document.querySelector('#readerContent h2').textContent;});
  expect(immediate).toBe('John 3:17');
  await page.locator('#verseSelect').selectOption('');await expect(reference(page)).toHaveText('John 3');
  await page.locator('#bookSelect').selectOption('isaiah');await expect(reference(page)).toHaveText('Isaiah 3');
});
test('quick picker direct verse and Whole chapter share the existing heading',async({page})=>{
  await open(page);await page.locator('#scripturePickerTrigger').click();
  await page.locator('[data-picker-action="book"][data-value="isaiah"]').click();
  await page.locator('[data-picker-action="chapter"][data-value="53"]').click();
  await page.locator('[data-picker-action="verse"][data-value="5"]').click();await expect(reference(page)).toHaveText('Isaiah 53:5');
  await page.locator('#scripturePickerTrigger').click();await page.locator('[data-picker-action="book"][data-value="isaiah"]').click();
  await page.locator('[data-picker-action="chapter"][data-value="53"]').click();await page.getByRole('button',{name:'Whole chapter',exact:true}).click();
  await expect(reference(page)).toHaveText('Isaiah 53');
});
test('idle Previous/Next updates reference without stealing focus or starting speech',async({page})=>{
  await open(page,{speech:true});await page.evaluate(()=>navigateReaderToPassage('john',3,16));
  await page.locator('#readerMoreTrigger').click();
  for(const [direction,expected] of [['next',17],['previous',16]]){
    const button=page.locator(`[data-reader-action="${direction}-verse"]`);await button.click();
    await expect(reference(page)).toHaveText(`John 3:${expected}`);await expect(button).toBeFocused();
  }
  expect(await page.evaluate(()=>window.__referenceAudio.utterances.length)).toBe(0);
});
for(const cloud of [false,true])test(`reference follows ${cloud?'cloud':'native'} speech and active verse navigation, restores selection on Stop`,async({page})=>{
  await open(page,{speech:true,cloud});await page.evaluate(()=>navigateReaderToPassage('john',3,16));
  await page.locator('#readAloudPlay').click();await expect(reference(page)).toHaveText('John 3:16');
  await page.evaluate(cloud=>cloud?window.__referenceAudio.sources.at(-1).end():window.__referenceAudio.utterances.at(-1).onend(),cloud);
  await expect(reference(page)).toHaveText('John 3:17');await expect(page.locator('#verseSelect')).toHaveValue('16');
  await page.evaluate(()=>pauseReader());await expect(reference(page)).toHaveText('John 3:17');
  await page.evaluate(()=>resumeReader());
  await page.locator('#readerMoreTrigger').click();const next=page.locator('[data-reader-action="next-verse"]');await next.click();
  await expect(reference(page)).toHaveText('John 3:18');await expect(next).toBeFocused();
  await page.locator('[data-reader-action="previous-verse"]').click();await expect(reference(page)).toHaveText('John 3:17');
  await page.evaluate(()=>stopReader());await expect(reference(page)).toHaveText('John 3:17');
});
test('chapter speech follows current verse and restores chapter-only heading after Stop',async({page})=>{
  await open(page,{speech:true});await expect(reference(page)).toHaveText('John 1');
  await page.locator('#readAloudPlay').click();await expect(reference(page)).toHaveText('John 1:1');
  await page.evaluate(()=>window.__referenceAudio.utterances.at(-1).onend());await expect(reference(page)).toHaveText('John 1:2');
  await page.evaluate(()=>stopReader());await expect(reference(page)).toHaveText('John 1');
});
test('Repeat and stale playback callbacks cannot corrupt the reference',async({page})=>{
  await open(page,{speech:true});await page.evaluate(()=>navigateReaderToPassage('john',3,16));
  await page.locator('#readAloudPlay').click();await page.evaluate(()=>window.__referenceAudio.utterances.at(-1).onend());
  await expect(reference(page)).toHaveText('John 3:17');await page.evaluate(()=>repeatLastSpokenVerse());await expect(reference(page)).toHaveText('John 3:17');
  await page.evaluate(()=>window.__referenceAudio.utterances[0].onend());await expect(reference(page)).toHaveText('John 3:17');
  await page.evaluate(()=>stopReader());await expect(reference(page)).toHaveText('John 3:16');
});
test('automatic speech chapter transition updates book/chapter/verse together',async({page})=>{
  await open(page,{speech:true});await page.evaluate(()=>navigateReaderToPassage('john',3,36));
  await page.locator('#readAloudPlay').click();await expect(reference(page)).toHaveText('John 3:36');
  await page.evaluate(()=>window.__referenceAudio.utterances.at(-1).onend());await expect(reference(page)).toHaveText('John 4:1');
});
test('translation refresh, Search, and reload preserve valid selected references',async({page})=>{
  await open(page);await page.evaluate(()=>navigateSearchResult({bookId:'john',chapter:3,verse:16,translationId:'web'}));
  await expect(reference(page)).toHaveText('John 3:16');
  await page.locator('#readerTranslation').selectOption('kjv');await expect(reference(page)).toHaveText('John 3:16');
  await page.reload();await page.evaluate(()=>initializeBibleExperience());await expect(reference(page)).toHaveText('John 3:16');
  await page.locator('#verseSelect').selectOption('');await page.reload();await page.evaluate(()=>initializeBibleExperience());await expect(reference(page)).toHaveText('John 3');
});
test('translation with an empty target restores a chapter reference without a phantom verse',async({page})=>{
  await open(page);await page.evaluate(async()=>{await changeTranslation('kjv');await navigateReaderToPassage('romans',16,24);});
  await expect(reference(page)).toHaveText('Romans 16:24');await page.locator('#readerTranslation').selectOption('asv');await expect(reference(page)).toHaveText('Romans 16');
});
for(const width of [1280,390,320])for(const fullscreen of [false,true])test(`reference reflows and stays synchronized at ${width}px, fullscreen=${fullscreen}`,async({page})=>{
  await page.setViewportSize({width,height:800});await open(page,{speech:true});
  if(fullscreen)await page.locator('#fullscreenBtn').click();
  const expected=await page.evaluate(async()=>{
    const book=BibleData.listBooks(currentTranslation).sort((a,b)=>b.name.length-a.name.length)[0];
    await navigateReaderToPassage(book.id,1,1);return book.name+' 1:1';
  });
  await expect(reference(page)).toHaveText(expected);await page.locator('#readAloudPlay').click();
  await page.locator('#readerMoreTrigger').click();const next=page.locator('[data-reader-action="next-verse"]');await next.click();
  await expect(reference(page)).toHaveText(expected.replace(/:1$/,':2'));await expect(next).toBeFocused();
  expect(await reference(page).evaluate(h=>({page:document.documentElement.scrollWidth>innerWidth,heading:h.scrollWidth>h.clientWidth,reader:document.getElementById('view-reader').scrollWidth>document.getElementById('view-reader').clientWidth}))).toEqual({page:false,heading:false,reader:false});
  expect(await page.evaluate(()=>document.getElementById('view-reader').classList.contains('reader-fullscreen'))).toBe(fullscreen);
});
