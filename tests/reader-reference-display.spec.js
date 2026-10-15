const {test,expect}=require('@playwright/test');
const reference=page=>page.locator('#readerReferenceText');
async function open(page,{width=1280,speech=false}={}){
  await page.setViewportSize({width,height:800});
  if(speech)await page.addInitScript(()=>{
    window.__pickerSpeech=[];
    Object.defineProperty(window,'SpeechSynthesisUtterance',{configurable:true,value:function(text){this.text=text;}});
    Object.defineProperty(window,'AudioContext',{configurable:true,value:undefined});
    Object.defineProperty(window,'webkitAudioContext',{configurable:true,value:undefined});
    Object.defineProperty(window,'speechSynthesis',{configurable:true,value:{getVoices(){return [{name:'Microsoft David',lang:'en-US',localService:true}];},addEventListener(){},speak(u){window.__pickerSpeech.push(u);u.onstart?.();},pause(){},resume(){},cancel(){}}});
  });
  await page.goto('/');await page.evaluate(()=>initializeBibleExperience());
}
async function picker(page){await page.locator('#scripturePickerTrigger').click();await expect(page.locator('#scripturePicker')).toHaveAttribute('data-step','books');}
async function book(page,id){await page.locator(`[data-picker-action="book"][data-value="${id}"]`).click();}
async function chapter(page,n){await page.locator(`[data-picker-action="chapter"][data-value="${n}"]`).click();}
async function verse(page,n){await page.locator(`[data-picker-action="verse"][data-value="${n}"]`).click();}
test('one compact current-reference launcher replaces the primary dropdown row',async({page})=>{
  await open(page);await expect(reference(page)).toHaveText('John 1');
  await expect(page.locator('#scripturePickerTrigger')).toHaveAccessibleName('Choose Scripture, John 1');
  await expect(page.locator('.reader-toolbar > button, .reader-toolbar > select, .reader-toolbar > .reader-reference-navigation')).toHaveCount(5);
  for(const id of ['bookSelect','chapterSelect','verseSelect']){
    await expect(page.locator('#'+id)).toBeHidden();await expect(page.locator('#readerSecondaryControls #'+id)).toHaveCount(1);
  }
  await picker(page);await expect(page.getByRole('dialog',{name:'Choose Scripture',exact:true})).toBeVisible();
  await expect(page.locator('#scripturePickerTrigger')).toHaveAttribute('aria-expanded','true');
  await page.keyboard.press('Escape');await expect(page.locator('#scripturePickerTrigger')).toBeFocused();
  await expect(page.locator('#scripturePickerTrigger')).toHaveAttribute('aria-expanded','false');
});
test('desktop books/search left and large chapter/verse grids right navigate exactly',async({page})=>{
  await open(page);await picker(page);
  await expect(page.getByRole('heading',{name:'Books',exact:true})).toBeVisible();
  await expect(page.locator('.picker-book-list [aria-current="true"]')).toHaveText('John');
  await expect(page.locator('[data-picker-action="chapter"][aria-current="true"]')).toHaveText('1');
  const columns=await page.locator('#scripturePicker').evaluate(d=>{const b=d.querySelector('.picker-books').getBoundingClientRect(),c=d.querySelector('.picker-detail').getBoundingClientRect();return {left:b.left,right:b.right,detail:c.left,top:Math.abs(b.top-c.top),scroll:d.querySelector('.picker-book-list').scrollHeight>d.querySelector('.picker-book-list').clientHeight};});
  expect(columns.detail).toBeGreaterThan(columns.right);expect(columns.top).toBeLessThan(2);expect(columns.scroll).toBe(true);
  await page.getByRole('searchbox',{name:'Find a book'}).fill('isaiah');await expect(page.locator('.picker-book-list button')).toHaveCount(1);
  await book(page,'isaiah');await expect(page.locator('.picker-book-list [aria-current="true"]')).toHaveText('Isaiah');
  await expect(page.locator('[data-picker-action="chapter"]')).toHaveCount(66);
  expect(await page.locator('[data-picker-action="chapter"]').first().evaluate(b=>({w:b.getBoundingClientRect().width,h:b.getBoundingClientRect().height}))).toMatchObject({h:52});
  await chapter(page,53);await expect(page.locator('#pickerDetailTitle')).toHaveText('Isaiah 53 — Verses');
  await expect(page.locator('[data-picker-action="verse"]')).toHaveCount(12);
  await page.getByRole('button',{name:'Back to chapters',exact:true}).click();
  await expect(page.locator('[data-picker-action="chapter"][aria-current="true"]')).toHaveText('53');
  await chapter(page,53);await verse(page,5);
  await expect(reference(page)).toHaveText('Isaiah 53:5');await expect(page.locator('#readerContent h2')).toHaveText('Isaiah 53');
  await expect(page.locator('#readerContent [data-verse-number="5"]')).toBeFocused();
  await picker(page);await book(page,'isaiah');await chapter(page,53);
  await expect(page.locator('[data-picker-action="verse"][aria-current="true"]')).toHaveText('5');
  await page.getByRole('button',{name:'Whole chapter',exact:true}).click();await expect(reference(page)).toHaveText('Isaiah 53');
});
test('keyboard Enter, Space, Tab/Shift+Tab and Escape operate the same picker',async({page})=>{
  await open(page);await page.locator('#scripturePickerTrigger').focus();await page.keyboard.press('Enter');
  await expect(page.locator('[data-picker-action="book"][data-value="john"]')).toBeFocused();
  await page.locator('[data-picker-action="book"][data-value="john"]').press('Space');
  await page.locator('[data-picker-action="chapter"][data-value="3"]').press('Enter');
  await page.locator('[data-picker-action="close"]').focus();await page.keyboard.press('Shift+Tab');
  expect(await page.evaluate(()=>document.activeElement.closest('dialog')?.id)).toBe('scripturePicker');
  await page.keyboard.press('Tab');await expect(page.locator('[data-picker-action="close"]')).toBeFocused();
  await page.keyboard.press('Escape');await expect(page.locator('#scripturePickerTrigger')).toBeFocused();
  await page.keyboard.press('Space');await book(page,'john');await chapter(page,3);
  await page.locator('[data-picker-action="verse"][data-value="16"]').press('Space');await expect(reference(page)).toHaveText('John 3:16');
});
test('detailed selectors retain book/chapter/verse capability under More',async({page})=>{
  await open(page);await page.locator('#readerMoreTrigger').click();
  await page.locator('#bookSelect').selectOption('isaiah');await page.locator('#chapterSelect').selectOption('53');await page.locator('#verseSelect').selectOption('5');
  await expect(reference(page)).toHaveText('Isaiah 53:5');
  await page.locator('#readerMoreTrigger').click();await picker(page);
  await expect(page.locator('.picker-book-list [aria-current="true"]')).toHaveText('Isaiah');
  await expect(page.locator('[data-picker-action="chapter"][aria-current="true"]')).toHaveText('53');
});
for(const speech of [false,true])test(`Previous/Next update launcher/picker and preserve ${speech?'active speech':'idle state'}`,async({page})=>{
  await open(page,{speech:true});await page.evaluate(()=>navigateReaderToPassage('john',3,16));
  if(speech){await page.locator('#readAloudPlay').click();await page.evaluate(()=>window.__pickerSpeech.at(-1).onend());await expect(reference(page)).toHaveText('John 3:17');}
  await page.locator('#readerMoreTrigger').click();await page.locator('[data-reader-action="next-verse"]').click();
  await expect(reference(page)).toHaveText(speech?'John 3:18':'John 3:17');
  await page.locator('[data-reader-action="previous-verse"]').click();await expect(reference(page)).toHaveText(speech?'John 3:17':'John 3:16');
  expect(await page.evaluate(()=>BibleSpeech.getState())).toBe(speech?'playing':'idle');
  await page.locator('#readerMoreTrigger').click();await picker(page);await book(page,'john');await chapter(page,3);
  await expect(page.locator('[data-picker-action="verse"][aria-current="true"]')).toHaveText(speech?'17':'16');
});
test('speech progresses while picker is open without stealing focus or stale selected markers',async({page})=>{
  await open(page,{speech:true});await page.evaluate(()=>navigateReaderToPassage('john',3,16));await page.locator('#readAloudPlay').click();
  await picker(page);await book(page,'john');await chapter(page,3);await page.locator('#pickerBookSearch').focus();
  await page.evaluate(()=>window.__pickerSpeech.at(-1).onend());
  await expect(reference(page)).toHaveText('John 3:17');await expect(page.locator('[data-picker-action="verse"][aria-current="true"]')).toHaveText('17');
  await expect(page.locator('#pickerBookSearch')).toBeFocused();
  await page.evaluate(()=>pauseReader());await expect(page.locator('[data-picker-action="verse"][aria-current="true"]')).toHaveText('17');
  await page.evaluate(()=>resumeReader());await page.evaluate(()=>stopReader());
  await expect(reference(page)).toHaveText('John 3:16');await expect(page.locator('[data-picker-action="verse"][aria-current="true"]')).toHaveText('16');
});
test('speech chapter continuation synchronizes an untouched picker without moving book focus',async({page})=>{
  await open(page,{speech:true});await page.evaluate(()=>navigateReaderToPassage('john',3,36));await page.locator('#readAloudPlay').click();await picker(page);
  const focused=page.locator('[data-picker-action="book"][data-value="john"]');await expect(focused).toBeFocused();
  await page.evaluate(()=>window.__pickerSpeech.at(-1).onend());await expect(reference(page)).toHaveText('John 4:1');
  await expect(page.locator('[data-picker-action="chapter"][aria-current="true"]')).toHaveText('4');await expect(focused).toBeFocused();
});
test('translation, Search targeting and session reload restore the launcher and picker selection',async({page})=>{
  await open(page);await page.evaluate(()=>navigateSearchResult({bookId:'john',chapter:3,verse:16,translationId:'web'}));await expect(reference(page)).toHaveText('John 3:16');
  await picker(page);await page.evaluate(()=>changeTranslation('kjv'));await expect(page.locator('#scripturePicker')).toBeHidden();await expect(reference(page)).toHaveText('John 3:16');
  await page.reload();await page.evaluate(()=>initializeBibleExperience());await expect(reference(page)).toHaveText('John 3:16');
  await picker(page);await book(page,'john');await chapter(page,3);await expect(page.locator('[data-picker-action="verse"][aria-current="true"]')).toHaveText('16');
});
for(const width of [390,320])for(const fullscreen of [false,true])test(`stepped picker at ${width}px, fullscreen=${fullscreen}, fits and returns focus`,async({page})=>{
  await open(page,{width});if(fullscreen)await page.locator('#fullscreenBtn').click();await picker(page);
  await expect(page.locator('.picker-detail')).toBeHidden();await page.locator('#pickerBookSearch').fill('psalms');await book(page,'psalms');
  await expect(page.locator('.picker-books')).toBeHidden();await chapter(page,119);
  await expect(page.locator('[data-picker-action="verse"]')).toHaveCount(176);
  expect(await page.locator('#scripturePicker').evaluate(d=>({overflow:d.scrollWidth>d.clientWidth,small:[...d.querySelectorAll('.picker-options button')].some(b=>b.getBoundingClientRect().width<44||b.getBoundingClientRect().height<44)}))).toEqual({overflow:false,small:false});
  await page.getByRole('button',{name:'Back to chapters',exact:true}).click();await expect(page.locator('[data-picker-action="chapter"][aria-current="true"]')).toHaveText('119');
  await page.getByRole('button',{name:'Back to books',exact:true}).click();await expect(page.locator('.picker-books')).toBeVisible();
  await page.keyboard.press('Escape');await expect(page.locator('#scripturePickerTrigger')).toBeFocused();
  expect(await page.evaluate(()=>document.getElementById('view-reader').classList.contains('reader-fullscreen'))).toBe(fullscreen);
  await picker(page);await book(page,'john');await chapter(page,3);await verse(page,16);await expect(reference(page)).toHaveText('John 3:16');
  expect(await page.evaluate(()=>document.documentElement.scrollWidth<=innerWidth)).toBe(true);
});

test('opening a long chapter grid reveals the selected chapter without moving book focus',async({page})=>{
  await open(page);await page.evaluate(()=>navigateReaderToPassage('psalms',119,105));await picker(page);
  await expect(page.locator('[data-picker-action="book"][data-value="psalms"]')).toBeFocused();
  expect(await page.locator('[data-picker-action="chapter"][aria-current="true"]').evaluate(b=>{
    const rect=b.getBoundingClientRect(),grid=b.parentElement.getBoundingClientRect();
    return rect.top>=grid.top&&rect.bottom<=grid.bottom;
  })).toBe(true);
});
