'use strict';
const {test,expect}=require('@playwright/test');
test.use({serviceWorkers:'allow'});
let go=async(page,translation,book,chapter,verse)=>{
  await page.evaluate(async ref=>{
    await initializeBibleExperience();
    await changeTranslation(ref.translation);
    await navigateReaderToPassage(ref.book,ref.chapter,ref.verse);
  },{translation,book,chapter,verse});
};
const word=(page,verse,term)=>page.locator('#readerContent [data-verse-number="'+verse+'"] [data-word-study-term="'+term+'"]').first();
const aligned=page=>page.locator('#wordStudyOriginalTokens [data-aligned="true"]');
const status=page=>page.locator('#wordStudyAlignmentStatus');

test('WEB Moab retains its exact Hebrew alignment after an offline reload with no startup alignment fetch',async({page,context})=>{
  const requests=[];
  page.on('request',r=>{if(r.url().includes('/data/word-study/alignment/')) requests.push(r.url());});
  await page.goto('/');
  await page.evaluate(()=>navigator.serviceWorker.ready.then(()=>true));
  if(!await page.evaluate(()=>!!navigator.serviceWorker.controller)) await page.reload();
  await page.evaluate(async()=>{if(!(await BibleTranslationLoader.retain('web')).ok)throw Error('Cannot retain WEB');});
  await go(page,'web','numbers',21,20);
  expect(requests).toEqual([]);
  const verify=async()=>{
    const trigger=word(page,20,'moab');
    await trigger.press('Enter');
    await expect(status(page)).toContainText('unfoldingWord Hebrew names');
    await expect(aligned(page)).toHaveCount(1);
    await expect(page.locator('#wordStudyDefinition')).toContainText('territory east of the Dead Sea');
    await expect(page.locator('#wordStudyOriginalTokens')).toHaveAttribute('dir','rtl');
    await page.keyboard.press('Escape');
    await expect(trigger).toBeFocused();
  };
  await verify();
  await context.setOffline(true);
  await page.reload();
  await go(page,'web','numbers',21,20);
  await verify();
});

test('KJV and DRA contextual definitions preserve distinct labeled Hebrew alignments',async({page})=>{
  await page.goto('/');
  await go(page,'kjv','1-samuel',23,1);
  await word(page,1,'philistines').press('Enter');
  await expect(status(page)).toContainText('KJV / CrossWire');
  await expect(page.locator('#wordStudyDefinition')).toContainText('attacking Keilah');
  await expect(aligned(page)).toHaveCount(1);
  await page.keyboard.press('Escape');
  await go(page,'dra','judges',14,7);
  await word(page,7,'spoke').press('Enter');
  await expect(status(page)).toContainText('Douay-Rheims / Clear.Bible');
  await expect(page.locator('#wordStudyDefinition')).toContainText('Talked with the woman');
  await expect(aligned(page)).toHaveCount(1);
});

test('a marked Webster verse aligns adjacent Greek while retaining the unlinked supplied words',async({page})=>{
  await page.goto('/');
  await go(page,'webster','matthew',9,19);
  await word(page,19,'jesus').press('Enter');
  await expect(status(page)).toContainText('positions outside supplied words');
  await expect(aligned(page)).toHaveCount(2);
  await page.keyboard.press('Escape');
  await word(page,19,'did').press('Enter');
  await expect(page.locator('#wordStudyOriginalTokens button').first()).toBeVisible();
  await expect(aligned(page)).toHaveCount(0);
});

test('Scrivener Greek stays KJV-specific and retains multiword alignment offline',async({page,context})=>{
  await page.goto('/');
  await page.evaluate(()=>navigator.serviceWorker.ready.then(()=>true));
  if(!await page.evaluate(()=>!!navigator.serviceWorker.controller)) await page.reload();
  await page.evaluate(async()=>{if(!(await BibleTranslationLoader.retain('kjv')).ok)throw Error('Cannot retain KJV');});
  await go(page,'kjv','matthew',3,8);
  const verify=async()=>{
    const trigger=word(page,8,'repentance');
    await trigger.press('Enter');
    await expect(status(page)).toContainText('Scrivener 1894 Textus Receptus');
    await expect(page.locator('#wordStudyOriginalIntro')).toContainText('Scrivener 1894');
    await expect(aligned(page)).toHaveCount(2);
    await page.keyboard.press('Escape');
    await expect(trigger).toBeFocused();
  };
  await verify();
  await go(page,'web','matthew',3,8);
  await word(page,8,'repentance').press('Enter');
  await expect(page.locator('#wordStudyOriginalTokens button').first()).toBeVisible();
  await expect(page.locator('#wordStudyOriginalIntro')).not.toContainText('Scrivener');
  await page.keyboard.press('Escape');
  await context.setOffline(true);
  await page.reload();
  await go(page,'kjv','matthew',3,8);
  await verify();
});
