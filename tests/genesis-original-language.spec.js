const {test,expect} = require('@playwright/test');
const repair = require('../tools/repair-genesis-references');
const fixture = repair.readSource();
test.beforeEach(async ({page})=>{
  page.errors=[];
  page.on('pageerror',error=>page.errors.push(error.message));
  page.on('console',message=>{if(message.type()==='error')page.errors.push(message.text());});
});
test.afterEach(async ({page})=>expect(page.errors).toEqual([]));
for(const [translation,ch,v,sourceCh,sourceVerse,count,first] of [
  ['kjv',31,54,31,54,12,'וַ/יִּזְבַּ֨ח'],['kjv',31,55,32,1,12,'וַ/יַּשְׁכֵּ֨ם'],
  ['kjv',32,1,32,2,7,'וְ/יַעֲקֹ֖ב'],['kjv',32,31,32,32,11,'וַ/יִּֽזְרַֽח'],
  ['kjv',32,32,32,33,23,'עַל'],['kjv',33,1,33,1,21,'וַ/יִּשָּׂ֨א'],
  ['web',31,55,32,1,12,'וַ/יַּשְׁכֵּ֨ם'],['web',32,1,32,2,7,'וְ/יַעֲקֹ֖ב']
])test(`${translation} Genesis ${ch}:${v} displays the complete canonical Hebrew token set`,async({page})=>{
  const requests=[];
  page.on('request',request=>{if(request.url().includes('/original-language/genesis/'))requests.push(new URL(request.url()).pathname);});
  await page.goto('/');
  expect(await page.evaluate(async({translation,ch,v})=>{
    await initializeBibleExperience();await changeTranslation(translation);
    return navigateReaderToPassage('genesis',ch,v);
  },{translation,ch,v})).toBe(true);
  const expected=fixture.records.filter(r=>r.chapter===sourceCh&&r.verse===sourceVerse).map(r=>({...r,chapter:ch,verse:v}));
  const english=await page.locator(`#readerContent [data-verse-number="${v}"]`).getAttribute('data-verse-text');
  if(ch===31&&v===55)expect(english).toMatch(/Laban/);
  if(ch===32&&v===1)expect(english).toMatch(/Jacob.*angels/i);
  if(ch===32&&v===32)expect(english).toMatch(/sinew/i);
  await page.locator(`#readerContent [data-verse-number="${v}"] [data-word-study-term]`).first().click();
  const section=page.locator('#wordStudyOriginalLanguage');
  await expect(section).toBeVisible();
  const tokens=section.locator('.word-study-original-token');
  await expect(tokens).toHaveCount(count);await expect(tokens.first()).toHaveText(first);
  await expect(tokens).toHaveText(expected.map(r=>r.surface));
  expect(await tokens.evaluateAll(elements=>elements.map(e=>e.__originalLanguageRecord))).toEqual(expected);
  await expect(tokens.first()).toHaveAttribute('lang','he');
  await expect(page.locator('#wordStudyOriginalTokens')).toHaveAttribute('dir','rtl');
  await expect(page.locator('#wordStudyReference')).toHaveText(`Genesis ${ch}:${v}`);
  expect(requests).toEqual([`/data/word-study/original-language/genesis/${ch}.json`]);
});
test('Genesis 32 has no Reader or original-language coordinate 33',async({page})=>{
  await page.goto('/');
  await page.evaluate(async()=>{await initializeBibleExperience();await changeTranslation('kjv');await navigateReaderToPassage('genesis',32,32);});
  await expect(page.locator('#verseSelect option[value="33"]')).toHaveCount(0);
  await expect(page.locator('#readerContent [data-verse-number="33"]')).toHaveCount(0);
  expect(await page.evaluate(()=>navigateReaderToPassage('genesis',32,33))).toBe(false);
  const result=await page.evaluate(()=>OriginalLanguageWordStudyProvider.lookupVerse({translationId:'kjv',bookId:'genesis',chapter:32,verse:33}));
  expect(result.records).toEqual([]);
  await expect(page.locator('#readerContent h2')).toHaveText('Genesis 32');
});
