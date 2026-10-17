const {test,expect}=require('@playwright/test');
const fs=require('node:fs'),path=require('node:path');
const directory=path.join(__dirname,'../data/word-study/original-language/isaiah');
const expectedVerse=(ch,v)=>JSON.parse(fs.readFileSync(path.join(directory,ch+'.json'))).records.filter(r=>r.verse===v);
async function openVerse(page,chapter,verse){
  await page.goto('/');
  await page.evaluate(async ({chapter})=>{
    await initializeBibleExperience();await BibleTranslationLoader.ensure('kjv');
    currentTranslation='kjv';currentBook='isaiah';currentChapter=chapter;renderPassage('isaiah',chapter);
  },{chapter});
  const word=page.locator(`#readerContent [data-verse-number="${verse}"] [data-word-study-term]`).first();
  await word.focus();await word.press('Enter');
  await expect(page.locator('#wordStudyHeading')).toBeFocused();
  await expect(page.locator('#wordStudyOriginalLanguage')).toBeVisible();
  return word;
}
for(const [chapter,verse] of [[1,1],[6,1],[7,14],[9,6],[11,3],[40,31],[53,5],[63,19],[64,1]]){
  test(`Isaiah ${chapter}:${verse} lazily discovers the complete reviewed Hebrew verse and restores focus`,async({page})=>{
    const shards=[],errors=[];page.on('pageerror',error=>errors.push(error.message));
    page.on('request',request=>{if(request.url().includes('/original-language/isaiah/'))shards.push(new URL(request.url()).pathname);});
    const word=await openVerse(page,chapter,verse),rows=expectedVerse(chapter,verse);
    await expect(page.locator('#wordStudyReference')).toHaveText(`Isaiah ${chapter}:${verse}`);
    const tokens=page.locator('#wordStudyOriginalTokens .word-study-original-token');
    await expect(tokens).toHaveText(rows.map(r=>r.surface));
    await expect(page.locator('#wordStudyOriginalTokens')).toHaveAttribute('dir','rtl');
    await expect(tokens.first()).toHaveAttribute('lang','he');
    expect(shards).toEqual([`/data/word-study/original-language/isaiah/${chapter}.json`]);
    const actual=await tokens.evaluateAll(elements=>elements.map(e=>e.__originalLanguageRecord));expect(actual).toEqual(rows);
    const english=await page.locator('#wordStudyDefinition').textContent(),index=rows.findIndex(r=>r.strongsNumber);
    await tokens.nth(index).press('Enter');
    for(const key of ['strongsNumber','lemma','transliteration','pronunciation','morphology','definition'])await expect(page.locator('#wordStudyOriginalDetails')).toContainText(rows[index][key]);
    await expect(page.locator('#wordStudyDefinition')).toHaveText(english);
    await tokens.nth(index).press('Escape');await expect(page.locator('#wordStudyPanel')).toBeHidden();await expect(word).toBeFocused();
    expect(errors).toEqual([]);
  });
}
test('Isaiah 63:19 and 64:1 expose the reviewed 9/7 token split with separate chapter requests',async({page})=>{
  await page.goto('/');await page.evaluate(()=>WordStudyLoader.ensure());
  const results=await page.evaluate(async()=>Promise.all([63,64].map(chapter=>OriginalLanguageWordStudyProvider.lookupVerse({bookId:'isaiah',chapter,verse:chapter===63?19:1}))));
  expect(results.map(r=>r.records.length)).toEqual([9,7]);
  expect(results[0].records.at(-1).surface).toBe('עֲלֵי/הֶ֑ם');expect(results[1].records[0].surface).toBe('לוּא');
  expect(results[1].records.map(r=>r.tokenIndex)).toEqual([0,1,2,3,4,5,6]);
  expect(results.map(r=>r.records)).toEqual([expectedVerse(63,19),expectedVerse(64,1)]);
});
test('Isaiah publication loads no shards before study and caches repeated requests per chapter',async({page})=>{
  const shards=[];page.on('request',r=>{if(r.url().includes('/original-language/isaiah/'))shards.push(r.url());});
  await page.goto('/');await page.evaluate(async()=>{await initializeBibleExperience();currentBook='isaiah';currentChapter=53;renderPassage('isaiah',53);});
  expect(shards).toEqual([]);
  await page.evaluate(async()=>{await WordStudyLoader.ensure();await Promise.all([5,6,5].map(verse=>OriginalLanguageWordStudyProvider.lookupVerse({bookId:'isaiah',chapter:53,verse})));});
  expect(shards).toHaveLength(1);expect(shards[0]).toMatch(/isaiah\/53\.json$/);
});
