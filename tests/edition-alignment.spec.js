'use strict';
const {test,expect}=require('@playwright/test');
test.use({serviceWorkers:'allow'});

async function navigate(page,context){
  await page.evaluate(async({translation,book,chapter,verse})=>{
    await initializeBibleExperience();await changeTranslation(translation);await navigateReaderToPassage(book,chapter,verse);
  },context);
}
const wbs={translation:'webster',book:'matthew',chapter:1,verse:4};
const dra={translation:'dra',book:'john',chapter:1,verse:1};
const neh={translation:'kjv',book:'nehemiah',chapter:10,verse:2};
const word=(page,v,term)=>page.locator('#readerContent [data-verse-number="'+v+'"] [data-word-study-term="'+term+'"]').first();
const status=page=>page.locator('#wordStudyAlignmentStatus');

test('WBS uses explicit edition alignment and its shared witnesses after full offline reload',async({page,context})=>{
  const requests=[];
  page.on('request',r=>{if(r.url().includes('/data/word-study/alignment/'))requests.push(new URL(r.url()).pathname);});
  await page.goto('/');
  await page.evaluate(()=>navigator.serviceWorker.ready.then(()=>true));
  if(!await page.evaluate(()=>!!navigator.serviceWorker.controller))await page.reload();
  await page.evaluate(async()=>{if(!(await BibleTranslationLoader.retain('webster')).ok)throw new Error('WBS retention failed');});
  await navigate(page,wbs);
  expect(requests).toEqual([]);
  const verify=async()=>{
    await word(page,4,'begat').press('Enter');
    await expect(status(page)).toContainText('WBS · exact wording and witness from CrossWire KJV');
    await expect(page.locator('#wordStudyDefinition')).toHaveText('Became the father of the person named next in this genealogy.');
    await expect(page.locator('#wordStudyOriginalTokens [data-aligned="true"]')).toHaveText('εγεννησεν');
    await page.keyboard.press('Escape');
    await expect(word(page,4,'begat')).toBeFocused();
  };
  await verify();
  await context.setOffline(true);
  await page.reload();
  await navigate(page,wbs);
  await verify();
});

test('Douay-Rheims uses a labeled Greek witness and KJV retains its separate Hebrew path',async({page})=>{
  await page.goto('/');
  await navigate(page,dra);
  await word(page,1,'word').press('Enter');
  await expect(status(page)).toContainText('Douay-Rheims · exact wording and witness from CrossWire KJV (Greek witness)');
  await expect(page.locator('#wordStudyDefinition')).toContainText('the one who was with God');
  await page.keyboard.press('Escape');
  await navigate(page,neh);
  await word(page,2,'seraiah').press('Enter');
  await expect(status(page)).toContainText('KJV · exact wording and witness from verified WEB');
  await expect(page.locator('#wordStudyOriginalTokens')).toHaveAttribute('dir','rtl');
});

test.describe('network witness rejection',()=>{
  test.use({serviceWorkers:'block'});
  test('a corrupt shared witness leaves WBS unaligned instead of accepting a wrong Greek token',async({page})=>{
    await page.route('**/data/word-study/alignment/kjv/matthew/1.json',async route=>{
      const res=await route.fetch(),row=await res.json();
      row[4][1][0][2]='WRONG';
      await route.fulfill({response:res,json:row});
    });
    await page.goto('/');
    await navigate(page,wbs);
    await word(page,4,'begat').press('Enter');
    await expect(page.locator('#wordStudyOriginalTokens button').first()).toBeVisible();
    await expect(status(page)).toContainText('Exact word alignment is unavailable');
    await expect(page.locator('#wordStudyOriginalTokens [data-aligned="true"]')).toHaveCount(0);
  });
});

test('repeated Webster phrases highlight only the original tokens for the selected occurrence',async({page})=>{
  await page.goto('/');
  await navigate(page,{...wbs,book:'john',verse:1});
  const verse=page.locator('#readerContent [data-verse-number="1"]');
  const occurrences=verse.locator('[data-word-study-term="word"]');
  const aligned=page.locator('#wordStudyOriginalTokens [data-aligned="true"]');
  for(const [occurrence,indices] of [[0,['3','4']],[1,['6','7']]]){
    const trigger=occurrences.nth(occurrence);
    await trigger.press('Enter');
    await expect(status(page)).toContainText('WBS');
    await expect(aligned).toHaveCount(2);
    expect(await aligned.evaluateAll(buttons=>buttons.map(button=>button.dataset.originalLanguageTokenIndex))).toEqual(indices);
    await expect(verse.locator('[data-aligned="true"]')).toHaveText(['the','Word']);
    await page.keyboard.press('Escape');
    await expect(trigger).toBeFocused();
  }
});
