const {test,expect}=require('@playwright/test');
const fs=require('node:fs'),path=require('node:path');
for(const translationId of ['dra','web','kjv'])for(const [bookId,chapter,verse,lang] of [['isaiah',1,1,'he'],['isaiah',53,5,'he'],['john',1,1,'grc']]){
 test(translationId+' canonical study '+bookId+' '+chapter+':'+verse,async({page})=>{
  await page.goto('/');
  await page.evaluate(async c=>{await initializeBibleExperience();await changeTranslation(c.translationId);await navigateReaderToPassage(c.bookId,c.chapter,c.verse);},{translationId,bookId,chapter,verse});
  const row=page.locator('#readerContent [data-verse-number="'+verse+'"]');
  await expect(row).toHaveAttribute('data-book-id',bookId);
  if(translationId==='dra'&&bookId==='isaiah'&&chapter===1)await expect(row).toContainText('Isaias');
  const text=await row.getAttribute('data-verse-text');
  const word=row.locator('[data-word-study-term]').first();await word.press('Enter');
  const expected=JSON.parse(fs.readFileSync(path.join(__dirname,'../data/word-study/original-language',bookId,chapter+'.json'))).records.filter(r=>r.verse===verse);
  const tokens=page.locator('#wordStudyOriginalTokens button');
  await expect(tokens).toHaveText(expected.map(r=>r.surface));
  await expect(tokens.first()).toHaveAttribute('lang',lang);
  expect(await tokens.evaluateAll(es=>es.map(e=>e.__originalLanguageRecord))).toEqual(expected);
  await expect(page.locator('#wordStudyVerse')).toHaveText(text);
  // Display labels and English text must not participate in authoritative lookup.
  for(const bookName of bookId==='isaiah'?['Isaiah','Isaias']:['John']){
   const result=await page.evaluate(c=>OriginalLanguageWordStudyProvider.lookupVerse(c),{translationId,bookId,chapter,verse,bookName,verseText:'Unrelated display text'});
   expect(result.records).toEqual(expected);
  }
  await tokens.first().press('Enter');await expect(page.locator('#wordStudyOriginalDetails')).toBeVisible();
  await page.keyboard.press('Escape');await expect(word).toBeFocused();
 });
}
for(const [bookId,chapter,verse] of [['tobit',1,1],['judith',1,1],['sirach',1,1],['esther',10,4],['daniel',3,24],['daniel',13,1]]){
 test('DRA Catholic-only study unavailable '+bookId+' '+chapter+':'+verse,async({page})=>{
  await page.goto('/');await page.evaluate(async c=>{await initializeBibleExperience();await changeTranslation('dra');await navigateReaderToPassage(c.bookId,c.chapter,c.verse);},{bookId,chapter,verse});
  await page.locator('#readerContent [data-verse-number="'+verse+'"] [data-word-study-term]').first().press('Enter');
  await expect(page.locator('#wordStudyHeading')).toBeFocused();
  await page.evaluate(()=>WordStudyLoader.ensure());
  expect(await page.evaluate(c=>OriginalLanguageWordStudyProvider.lookupVerse(c),{translationId:'dra',bookId,chapter,verse})).toEqual({status:'unavailable',records:[]});
  await expect(page.locator('#wordStudyOriginalLanguage')).toBeHidden();
  await expect(page.locator('#wordStudyOriginalTokens button')).toHaveCount(0);
 });
}
