'use strict';
const {test,expect}=require('@playwright/test');
test.use({serviceWorkers:'allow'});

async function navigate(page,edition,book,chapter,verse){
  await page.evaluate(async({edition,book,chapter,verse})=>{
    await initializeBibleExperience();await changeTranslation(edition);await navigateReaderToPassage(book,chapter,verse);
  },{edition,book,chapter,verse});
}
const word=(page,verse,term)=>page.locator('#readerContent [data-verse-number="'+verse+'"] [data-word-study-term="'+term+'"]').first();
const aligned=page=>page.locator('#wordStudyOriginalTokens [data-aligned="true"]');
const status=page=>page.locator('#wordStudyAlignmentStatus');

test('Shell 85 Philemon Greek and passage definition survive a full offline reload',async({page,context})=>{
  await page.setViewportSize({width:390,height:844});
  const paths=[];
  page.on('request',r=>{if(r.url().includes('/data/word-study/alignment/')) paths.push(new URL(r.url()).pathname);});
  await page.goto('/');
  await page.evaluate(()=>navigator.serviceWorker.ready.then(()=>true));
  if(!await page.evaluate(()=>!!navigator.serviceWorker.controller)) await page.reload();
  await page.evaluate(async()=>{if(!(await BibleTranslationLoader.retain('kjv')).ok)throw Error('KJV could not be retained');});
  const verify=async()=>{
    await navigate(page,'kjv','philemon',1,12);
    const target=word(page,12,'bowels');
    await target.press('Enter');
    await expect(status(page)).toContainText('Scrivener 1894 Textus Receptus');
    await expect(aligned(page)).toHaveText('σπλάγχνα');
    await expect(page.locator('#wordStudyDefinition')).toContainText('My own heart');
    await page.keyboard.press('Escape');
    await expect(target).toBeFocused();
  };
  await navigate(page,'kjv','philemon',1,12);
  expect(paths).toEqual([]);
  await verify();
  expect(paths).toContain('/data/word-study/alignment/extensions/philemon/1.json');
  await context.setOffline(true);
  try{await page.reload();await verify();}finally{await context.setOffline(false);}
});

test('Shell 85 Philemon aligns the future tense without absorbing also or leaking into WEB',async({page})=>{
  await page.goto('/');
  await navigate(page,'kjv','philemon',1,21);
  await word(page,21,'wilt').press('Enter');
  await expect(status(page)).toContainText('verified Greek person and tense');
  await expect(aligned(page)).toHaveCount(1);
  await expect(aligned(page)).toHaveAttribute('data-original-language-token-index','12');
  const verse=page.locator('#readerContent [data-verse-number="21"]');
  await expect(verse.locator('[data-aligned="true"]')).toHaveText(['thou','wilt']);
  await page.keyboard.press('Escape');
  await word(page,21,'do').press('Enter');
  await expect(status(page)).toContainText('CrossWire KJV with Greek word tags');
  await page.keyboard.press('Escape');
  await navigate(page,'web','philemon',1,12);
  await word(page,12,'heart').press('Enter');
  await expect(page.locator('#wordStudyOriginalTokens button').first()).toBeVisible();
  await expect(page.locator('#wordStudyOriginalIntro')).not.toContainText('Scrivener');
});

test('Shell 85 distinguishes both occurrences of king’s in KJV Acts 12:20',async({page})=>{
  await page.goto('/');
  await navigate(page,'kjv','acts',12,20);
  const terms=page.locator('#readerContent [data-verse-number="20"] [data-word-study-term="king\'s"]');
  await expect(terms).toHaveCount(2);
  await terms.nth(0).press('Enter');
  await expect(page.locator('#wordStudyDefinition')).toContainText('Blastus served');
  const first=await aligned(page).evaluateAll(tokens=>tokens.map(row=>row.dataset.originalLanguageTokenIndex));
  expect(first).toHaveLength(2);
  await page.keyboard.press('Escape');
  await terms.nth(1).press('Enter');
  await expect(page.locator('#wordStudyDefinition')).toContainText('depended on his territory');
  const second=await aligned(page).evaluateAll(tokens=>tokens.map(row=>row.dataset.originalLanguageTokenIndex));
  expect(second).toHaveLength(2);
  expect(second.some(index=>first.includes(index))).toBe(false);
  await expect(page.locator('#wordStudySource')).toContainText('Scripture context');
});

test('Shell 85 Ephesians keeps the manuscript label and withholds a cross-verse phrase',async({page})=>{
  await page.goto('/');
  await navigate(page,'kjv','ephesians',6,17);
  await word(page,17,'helmet').press('Enter');
  await expect(status(page)).toContainText('Scrivener 1894 Textus Receptus');
  await expect(aligned(page)).toHaveCount(2);
  await page.keyboard.press('Escape');
  await navigate(page,'kjv','ephesians',1,10);
  await word(page,10,'him').press('Enter');
  await expect(page.locator('#wordStudyOriginalTokens button').first()).toBeVisible();
  await expect(status(page)).toContainText('Exact word alignment is unavailable');
});
