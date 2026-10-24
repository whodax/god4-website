const {test,expect}=require('@playwright/test');

// Real Reader controls: opening a Book choice must lead to Chapter, then Verse.
// Search/Compare and the separate Choose Scripture modal remain independent.
test.use({serviceWorkers:'block',hasTouch:true});

for(const width of [320,390,1280])for(const theme of ['light','dark'])
for(const fullscreen of [false,true])
test(`${width}px ${theme} fullscreen=${fullscreen}: Reader Book → Chapter → Verse opens automatically, without saving`,async({page})=>{
  const errors=[];page.on('pageerror',error=>errors.push(error.message));
  await page.setViewportSize({width,height:844});
  await page.emulateMedia({colorScheme:theme==='light'?'dark':'light',reducedMotion:'reduce'});
  await page.addInitScript(theme=>localStorage.setItem('god4.theme',theme),theme);
  await page.goto('/');await page.evaluate(()=>initializeBibleExperience());
  await page.locator('#readerMoreTrigger').click();
  await page.evaluate(()=>ReaderTranslationLoader.ensure());
  if(fullscreen)await page.locator('#fullscreenBtn').click();

  const mobile=width<=620, dialog=page.locator(mobile?'#readerOptionsPicker':'#themedSelectPicker');
  const launcher=id=>page.locator(mobile?`[data-reader-select="${id}"]`:'#'+id);
  async function open(id){
    const control=launcher(id);
    if(mobile)await control.tap();
    else {await control.focus();await control.press('Enter');}
  }
  async function choose(value,keyboard=false){
    const choice=dialog.locator(`[data-option-value="${value}"]`);
    await choice.scrollIntoViewIfNeeded();
    if(keyboard){await choice.focus();await choice.press('Enter');}
    else if(mobile)await choice.tap();
    else await choice.click();
  }

  await open('bookSelect');
  await expect(dialog).toHaveAccessibleName('Book');
  await choose('genesis',true);
  await expect(dialog).toHaveAccessibleName('Chapter');
  await expect(dialog.locator('[data-option-value="50"]')).toHaveCount(1);
  await expect(page.locator('#bookSelect')).toHaveValue('genesis');
  await expect(page.locator('#readerContent h2')).toHaveText('Genesis 1');
  await choose('2');
  await expect(dialog).toHaveAccessibleName('Verse');
  await expect(page.locator('#chapterSelect')).toHaveValue('2');
  await expect(page.locator('#verseSelect')).toHaveValue('');
  await expect(dialog.locator('[data-option-value=""]')).toHaveCount(0);
  await expect(dialog.locator('[data-option-value="1"]')).toBeFocused();
  await choose('3');
  await expect(dialog).not.toBeVisible();
  await expect(page.locator('#readerContent h2')).toHaveText('Genesis 2');
  await expect(page.locator('#readerContent .verse-focused')).toHaveAttribute('data-verse-number','3');
  await expect(page.locator('#readerReferenceText')).toHaveText('Genesis 2:3');
  expect(await page.evaluate(()=>UserData.savedVerses.load())).toEqual([]);

  // Selecting already-current values still continues; Escape cancels the next step.
  await open('bookSelect');
  await choose('genesis');
  await expect(dialog).toHaveAccessibleName('Chapter');
  await choose('2');
  await expect(dialog).toHaveAccessibleName('Verse');
  await page.keyboard.press('Escape');
  await expect(dialog).not.toBeVisible();
  await expect(launcher('verseSelect')).toBeFocused();
  expect(await page.evaluate(()=>UserData.savedVerses.load())).toEqual([]);

  // Changing the book then cancelling Chapter must NOT open Verse.
  await open('bookSelect');
  await choose('john');
  await expect(dialog).toHaveAccessibleName('Chapter');
  await page.keyboard.press('Escape');
  await expect(dialog).not.toBeVisible();
  await expect(launcher('chapterSelect')).toBeFocused();
  await expect(page.locator('#readerContent h2')).toHaveText('John 2');
  await expect(page.locator('#readerContent .verse-focused')).toHaveCount(0);
  await expect(page.locator('#savedCount')).toHaveText('0');
  expect(errors).toEqual([]);
});
