const {test,expect} = require('@playwright/test');
const fs = require('node:fs');
const vm = require('node:vm');
const generator = require('../tools/generate-translation-manifest');
const libraries = Object.fromEntries(generator.translations.map(d => [d.id,vm.runInNewContext(fs.readFileSync('.'+d.path,'utf8')+';'+d.variable)]));
async function open(page,id,book='romans',chapter=16){
  await page.goto('/');
  await page.evaluate(async ({id,book,chapter}) => {
    await initializeBibleExperience(); await changeTranslation(id);
    currentBook=book; currentChapter=chapter; currentVerse=null;
    document.getElementById('bookSelect').value=book; populateChapters();
    document.getElementById('chapterSelect').value=String(chapter); loadPassage();
  },{id,book,chapter});
}
test.beforeEach(async ({page}) => {
  page.runtimeErrors=[];
  page.on('pageerror',error => page.runtimeErrors.push(error.message));
  page.on('console',message => {if(message.type()==='error') page.runtimeErrors.push(message.text());});
});
test.afterEach(async ({page}) => expect(page.runtimeErrors).toEqual([]));

for(const id of ['web','asv','rv','kjv','ylt','dby','webster','gnv']) test(`${id} Romans 16 renders/selects only original nonempty coordinates`,async ({page}) => {
  await open(page,id);
  const verses=libraries[id].romans[16].verses;
  const expected=Array.from(verses,(text,index) => ({number:index+1,text})).filter(v => v.text.trim());
  await expect(page.locator('#readerContent h2')).toHaveText('Romans 16');
  expect(await page.locator('#readerContent .reader-verse').evaluateAll(elements => elements.map(e => ({number:Number(e.dataset.verseNumber),text:e.dataset.verseText})))).toEqual(expected);
  expect(await page.locator('#verseSelect option').evaluateAll(options => options.map(o => o.value))).toEqual(['',...expected.map(v => String(v.number))]);
  expect(await page.evaluate(({id}) => BibleData.getChapter(id,'romans',16).verses,{id})).toEqual(Array.from(verses));
  for(const number of [24,25,26,27]){
    const text=verses[number-1],renderable=typeof text==='string' && text.trim().length>0;
    const marker=page.locator(`#readerContent [data-verse-number="${number}"]`);
    await expect(marker).toHaveCount(renderable?1:0);
    await expect(page.locator(`#verseSelect option[value="${number}"]`)).toHaveCount(renderable?1:0);
    if(renderable){
      await expect(marker).toHaveAttribute('data-verse-text',text);
      await page.locator('#verseSelect').selectOption(String(number));
      await expect(marker).toHaveClass(/verse-focused/);
      await expect(marker).toBeFocused();
    } else {
      await expect(page.locator('#readerContent').getByRole('button',{name:`Highlight verse ${number}`,exact:true})).toHaveCount(0);
      expect(await page.locator('#readerContent').ariaSnapshot()).not.toContain(`Highlight verse ${number}`);
      await expect(marker.locator('[data-word-study-term]')).toHaveCount(0);
    }
  }
});

for(const action of ['setReaderVerse','selectReaderVerse','navigateReaderToPassage']) test(`${action} rejects WEB empty 16:25 and clears selection without redirecting`,async ({page}) => {
  await open(page,'web');
  await page.locator('#verseSelect').selectOption('24');
  const result=await page.evaluate(async action => {
    const ok=action==='navigateReaderToPassage'?await navigateReaderToPassage('romans',16,25):window[action](25);
    return {ok,book:currentBook,chapter:currentChapter,verse:currentVerse,pending:readerSelectionPending,saved:UserData.readerPosition.load(),cursor:getPlaybackResumeCursor()};
  },action);
  expect(result).toEqual({ok:false,book:'romans',chapter:16,verse:null,pending:false,saved:{bookId:'romans',chapter:16},cursor:{translationId:'web',bookId:'romans',chapter:16,verse:1}});
  await expect(page.locator('#verseSelect')).toHaveValue('');
  await expect(page.locator('#readerContent .verse-focused')).toHaveCount(0);
  await expect(page.locator('#readerContent [data-verse-number="25"]')).toHaveCount(0);
  await expect(page.locator('#readerContent h2')).toHaveText('Romans 16');
});

test('stale selector request for an empty coordinate clears the selection',async ({page}) => {
  await open(page,'web'); await page.locator('#verseSelect').selectOption('24');
  await page.evaluate(() => {
    const select=document.getElementById('verseSelect');
    select.add(new Option('25','25')); select.value='25'; select.dispatchEvent(new Event('change',{bubbles:true}));
    populateVerses();
  });
  expect(await page.evaluate(() => currentVerse)).toBe(null);
  await expect(page.locator('#verseSelect')).toHaveValue('');
  await expect(page.locator('#verseSelect option[value="25"]')).toHaveCount(0);
  await expect(page.locator('#readerContent .verse-focused')).toHaveCount(0);
});

test('restored WEB Romans 16:25 state keeps the chapter and clears the saved verse',async ({page}) => {
  await page.addInitScript(() => {
    if(sessionStorage.getItem('empty-position-seeded')) return;
    localStorage.setItem('god4.reader.position',JSON.stringify({bookId:'romans',chapter:16,verse:25}));
    localStorage.setItem('god4.translation','web'); sessionStorage.setItem('empty-position-seeded','1');
  });
  await page.goto('/'); await page.evaluate(() => initializeBibleExperience());
  expect(await page.evaluate(() => ({book:currentBook,chapter:currentChapter,verse:currentVerse,saved:UserData.readerPosition.load()}))).toEqual({book:'romans',chapter:16,verse:null,saved:{bookId:'romans',chapter:16}});
  expect(await page.evaluate(() => getPlaybackResumeCursor())).toEqual({translationId:'web',bookId:'romans',chapter:16,verse:1});
  await expect(page.locator('#verseSelect')).toHaveValue('');
  await expect(page.locator('#readerContent h2')).toHaveText('Romans 16');
  await page.reload(); await page.evaluate(() => initializeBibleExperience());
  expect(await page.evaluate(() => currentVerse)).toBe(null);
});

for(const id of ['asv','rv']) test(`${id} previous/next traverses 23 ↔ 25 without offering empty 24`,async ({page}) => {
  await open(page,id); await page.locator('#verseSelect').selectOption('23');
  await page.evaluate(() => nextReaderVerse());
  await expect(page.locator('#verseSelect')).toHaveValue('25');
  await page.evaluate(() => previousReaderVerse());
  await expect(page.locator('#verseSelect')).toHaveValue('23');
});
test('WEB last readable verse 24 disables next and leaves the chapter unchanged',async ({page}) => {
  await open(page,'web'); await page.locator('#verseSelect').selectOption('24');
  for(const button of await page.locator('[data-reader-action="next-verse"]').all()) await expect(button).toBeDisabled();
  await page.evaluate(() => nextReaderVerse());
  expect(await page.evaluate(() => ({chapter:currentChapter,verse:currentVerse}))).toEqual({chapter:16,verse:24});
});

test('synthetic whitespace slots disappear while surrounding text and later coordinates remain intact',async ({page}) => {
  await open(page,'web');
  await page.evaluate(() => {
    webLibrary.romans[16].verses=['  First verse.  ','\t\n\u00a0',null,undefined,'Last verse.'];
    renderPassage('romans',16); updateReaderControls();
  });
  expect(await page.locator('#readerContent .reader-verse').evaluateAll(elements => elements.map(e => [e.dataset.verseNumber,e.dataset.verseText]))).toEqual([['1','  First verse.  '],['5','Last verse.']]);
  expect(await page.locator('#verseSelect option').evaluateAll(options => options.map(o => o.value))).toEqual(['','1','5']);
  await page.locator('#verseSelect').selectOption('1'); await page.evaluate(() => nextReaderVerse());
  await expect(page.locator('#verseSelect')).toHaveValue('5');
});
test('translation switch clears KJV selected 24 when ASV 24 has no text',async ({page}) => {
  await open(page,'kjv'); await page.locator('#verseSelect').selectOption('24');
  await page.evaluate(() => changeTranslation('asv'));
  expect(await page.evaluate(() => currentVerse)).toBe(null);
  await expect(page.locator('#verseSelect')).toHaveValue('');
  await expect(page.locator('#readerContent [data-verse-number="25"]')).toHaveCount(1);
});
test('all-empty chapter keeps heading but creates no buttons, word targets or destinations',async ({page}) => {
  await open(page,'web');
  await page.evaluate(() => {webLibrary.romans[16].verses=['',' \t']; renderPassage('romans',16); updateReaderControls();});
  await expect(page.locator('#readerContent h2')).toHaveText('Romans 16');
  await expect(page.locator('#readerContent .reader-verse, #readerContent button, #readerContent [data-word-study-term]')).toHaveCount(0);
  await expect(page.locator('#verseSelect option')).toHaveCount(1);
  for(const button of await page.locator('[data-reader-action="next-verse"], [data-reader-action="previous-verse"]').all()) await expect(button).toBeDisabled();
});

test('retained WEB renders without empty placeholders using cached Reader 23 offline',async ({page,context}) => {
  await open(page,'web');
  await page.evaluate(() => navigator.serviceWorker.ready.then(() => true));
  if(!await page.evaluate(() => Boolean(navigator.serviceWorker.controller))) await page.reload();
  await page.evaluate(() => initializeBibleExperience());
  expect(await page.evaluate(() => BibleTranslationLoader.retain('web'))).toMatchObject({ok:true,state:'current'});
  const reader=await page.evaluate(async () => {
    const shell=await caches.open('god4-shell-compact-reader-23');
    return (await shell.match('/js/bible/reader.js')).text();
  });
  expect(reader).toContain('function isRenderableVerseText(text)');
  expect(reader).toContain('function scrollReaderStartIntoView()');
  await context.setOffline(true); await page.reload();
  await page.evaluate(() => initializeBibleExperience());
  await expect(page.locator('#readerContent h2')).toHaveText('Romans 16');
  await expect(page.locator('#readerContent [data-verse-number="24"]')).toHaveCount(1);
  await expect(page.locator('#readerContent [data-verse-number="25"]')).toHaveCount(0);
  await expect(page.locator('#verseSelect option[value="25"]')).toHaveCount(0);
  expect(await page.evaluate(() => BibleData.getVerse('web','romans',16,25).text)).toBe('');
  expect(await page.evaluate(() => navigateReaderToPassage('psalms',23))).toBe(true);
  const geometry=await page.evaluate(() => ({top:document.querySelector('#readerContent h2').getBoundingClientRect().top,
    boundary:readerVisibleTop()+16}));
  expect(Math.abs(geometry.top-geometry.boundary)).toBeLessThan(2);
});
