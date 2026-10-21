const {test,expect}=require('@playwright/test');
test.use({serviceWorkers:'block',hasTouch:true});

async function wholeRow(dialog,whole,numbered){
  await whole.scrollIntoViewIfNeeded();
  const measured=await whole.evaluate(button=>{
    const grid=button.parentElement,style=getComputedStyle(grid),box=grid.getBoundingClientRect(),bounds=button.getBoundingClientRect();
    const text=Array.from(button.childNodes).find(node=>node.nodeType===Node.TEXT_NODE && node.textContent.trim());
    const range=document.createRange();range.selectNodeContents(text);
    return {width:bounds.width,height:bounds.height,left:bounds.left,right:bounds.right,
      expectedLeft:box.left+parseFloat(style.paddingLeft)+parseFloat(style.borderLeftWidth),
      expectedRight:box.right-parseFloat(style.paddingRight)-parseFloat(style.borderRightWidth),
      lines:range.getClientRects().length,textWidth:range.getBoundingClientRect().width,
      nextRow:Array.from(grid.querySelectorAll('button')).filter(node=>node!==button).every(node=>node.getBoundingClientRect().top>=bounds.bottom),
      overflow:dialogOverflow(button.closest('dialog'))};
    function dialogOverflow(node){return node.scrollWidth>node.clientWidth;}
  });
  expect(Math.abs(measured.left-measured.expectedLeft)).toBeLessThanOrEqual(1);
  expect(Math.abs(measured.right-measured.expectedRight)).toBeLessThanOrEqual(1);
  expect(measured.height).toBeGreaterThanOrEqual(44);
  expect(measured.lines).toBe(1);expect(measured.textWidth).toBeLessThanOrEqual(measured.width);
  expect(measured.nextRow).toBe(true);expect(measured.overflow).toBe(false);
  expect((await numbered.first().boundingBox()).width).toBeGreaterThanOrEqual(44);
  await expect(dialog).toBeVisible();return measured;
}

for(const width of [320,360,390,430])for(const theme of ['light','dark'])test(`${width}px ${theme}: Whole Chapter spans Reader, Compare and Scripture grids`,async({page},info)=>{
  const errors=[];page.on('pageerror',error=>errors.push(error.message));
  await page.setViewportSize({width,height:844});
  await page.emulateMedia({colorScheme:theme==='light'?'dark':'light',reducedMotion:'reduce'});
  await page.addInitScript(theme=>localStorage.setItem('god4.theme',theme),theme);
  await page.goto('/');await page.evaluate(()=>initializeBibleExperience());await page.evaluate(()=>document.fonts.ready);
  await page.locator('#readerMoreTrigger').click();await page.evaluate(()=>ReaderTranslationLoader.ensure());
  const trigger=page.locator('[data-reader-select="verseSelect"]'),dialog=page.locator('#readerOptionsPicker');
  const whole=dialog.locator('[data-option-value=""]'),second=dialog.locator('[data-option-value="2"]');
  for(const fullscreen of [false,true]){
    if(fullscreen)await page.locator('#fullscreenBtn').click();
    await trigger.click();await page.keyboard.press('Home');
    await expect(whole).toBeFocused();
    console.log('Whole Chapter geometry',width,theme,fullscreen,await wholeRow(dialog,whole,second));
    await expect(dialog).toHaveCSS('background-color',theme==='light'?'rgb(247, 241, 222)':'rgb(36, 50, 72)');
    if(!fullscreen)await page.screenshot({path:info.outputPath('whole-chapter.png')});
    await second.tap();await expect(page.locator('#verseSelect')).toHaveValue('2');await expect(trigger).toBeFocused();
    await trigger.click();await expect(second).toHaveAttribute('aria-pressed','true');
    await page.keyboard.press('Home');await page.keyboard.press('Enter');
    await expect(page.locator('#verseSelect')).toHaveValue('');await expect(trigger).toBeFocused();
    await trigger.click();await expect(whole).toHaveAttribute('aria-pressed','true');
    await page.keyboard.press('End');await expect(dialog.locator('[data-option-value="51"]')).toBeFocused();
    await expect(dialog.locator('[data-option-value="51"]')).toBeInViewport();
    await page.keyboard.press('Escape');await expect(trigger).toBeFocused();
  }
  await page.locator('#fullscreenBtn').click();
  await page.locator('#readerSaveVerse').click();
  await expect(dialog).toHaveAccessibleName('Choose a verse to save');await expect(whole).toHaveCount(0);
  expect(await page.evaluate(()=>UserData.savedVerses.load())).toEqual([]);
  await second.tap();await expect(page.locator('#verseSelect')).toHaveValue('2');
  expect(await page.evaluate(()=>UserData.savedVerses.load())).toEqual([]);
  await page.locator('#readerSaveVerse').click();await expect(page.locator('#readerSaveVerse')).toHaveText('Saved ✓');
  expect(await page.evaluate(()=>UserData.savedVerses.load()[0].location.verse)).toBe(2);
  await page.locator('#scripturePickerTrigger').click();const scripture=page.locator('#scripturePicker');
  await scripture.locator('[data-picker-action="book"][data-value="john"]').click();
  await scripture.locator('[data-picker-action="chapter"][data-value="1"]').click();
  const scriptureWhole=scripture.locator('.picker-whole');
  await wholeRow(scripture,scriptureWhole,scripture.locator('[data-picker-action="verse"]'));
  await scriptureWhole.tap();await expect(page.locator('#verseSelect')).toHaveValue('');
  await page.getByRole('button',{name:'Compare',exact:true}).click();
  await page.locator('[data-themed-select="compareVerse"]').click();const compare=page.locator('#themedSelectPicker');
  await wholeRow(compare,compare.locator('[data-option-value=""]'),compare.locator('[data-option-value="1"]'));
  await compare.locator('[data-option-value="1"]').tap();await expect(page.locator('#compareVerse')).toHaveValue('1');
  await page.locator('[data-themed-select="compareVerse"]').click();await compare.locator('[data-option-value=""]').tap();
  await expect(page.locator('#compareVerse')).toHaveValue('');
  expect(await page.evaluate(()=>document.documentElement.scrollWidth<=innerWidth)).toBe(true);expect(errors).toEqual([]);
});
