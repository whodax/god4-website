const {test,expect}=require('@playwright/test');
const {execFileSync}=require('node:child_process');
test.use({serviceWorkers:'block',hasTouch:true});
test.beforeEach(async({page})=>{page.pickerErrors=[];page.on('pageerror',error=>page.pickerErrors.push(error.message));});
test.afterEach(async({page})=>expect(page.pickerErrors).toEqual([]));
async function ready(page,width=1280,theme='light'){
  await page.setViewportSize({width,height:844});
  await page.emulateMedia({colorScheme:theme==='light'?'dark':'light',reducedMotion:'reduce'});
  await page.addInitScript(theme=>localStorage.setItem('god4.theme',theme),theme);
  await page.goto('/');await page.evaluate(()=>initializeBibleExperience());
  await page.evaluate(()=>document.fonts.ready);
}
const picker=page=>page.locator('#themedSelectPicker');
async function choose(page,id,value){
  await page.locator(`[data-themed-select="${id}"]`).click();
  await expect(picker(page)).toBeVisible();
  await picker(page).locator(`[data-option-value="${value}"]`).click();
  await expect(picker(page)).toBeHidden();
}
async function compare(page){
  await page.getByRole('button',{name:'Compare',exact:true}).click();
  await expect(page.locator('[data-themed-select="compareBook"]')).toBeVisible();
}
async function geometry(dialog){
  return dialog.evaluate(node=>{
    const grid=node.querySelector('.picker-options'),bounds=node.getBoundingClientRect();
    const buttons=Array.from(grid.querySelectorAll('button'));
    const last=buttons.at(-1).getBoundingClientRect(),first=buttons[0].getBoundingClientRect();
    return {height:bounds.height,bottom:bounds.bottom,top:bounds.top,overflow:node.scrollWidth>node.clientWidth,
      gridHeight:grid.clientHeight,gridScroll:grid.scrollHeight,unused:grid.getBoundingClientRect().bottom-last.bottom,
      content:last.bottom-first.top,small:buttons.some(button=>{const box=button.getBoundingClientRect();return box.width<44||box.height<44;})};
  });
}
for(const width of [320,360,390,430,768,1280])for(const theme of ['light','dark'])test(`${width}px ${theme}: compact Scripture choices, long lists, themes and focus`,async({page},info)=>{
  await ready(page,width,theme);await page.locator('#scripturePickerTrigger').click();
  const dialog=page.locator('#scripturePicker');
  await expect(dialog).toHaveCSS('background-color',theme==='light'?'rgb(247, 241, 222)':'rgb(36, 50, 72)');
  const measurements=[];
  for(const [book,count] of [['obadiah',1],['john',21],['genesis',50],['revelation',22],['psalms',150]]){
    if(width<=620 && await dialog.getAttribute('data-step')!=='books')await dialog.getByRole('button',{name:'Back to books',exact:true}).click();
    await dialog.locator(`[data-picker-action="book"][data-value="${book}"]`).click();
    await expect(dialog.locator('[data-picker-action="chapter"]')).toHaveCount(count);
    const measured=await geometry(dialog);measurements.push({book,...measured});
    if((width===1280 || width===320) && ['obadiah','john','psalms'].includes(book))await page.screenshot({path:info.outputPath(book+'.png')});
    expect(measured.overflow).toBe(false);expect(measured.small).toBe(false);
    expect(measured.top).toBeGreaterThanOrEqual(0);expect(measured.bottom).toBeLessThanOrEqual(844);
    if(count<=22){expect(measured.unused).toBeLessThanOrEqual(5);if(width>620)expect(measured.height).toBeLessThan(420);}
  }
  await dialog.locator('[data-picker-action="chapter"][data-value="119"]').click();
  await expect(dialog.locator('[data-picker-action="verse"]')).toHaveCount(176);
  await dialog.locator('[data-picker-action="verse"]').first().focus();await page.keyboard.press('End');
  await expect(dialog.locator('[data-picker-action="verse"][data-value="176"]')).toBeFocused();
  await expect(dialog.locator('[data-picker-action="verse"][data-value="176"]')).toBeInViewport();
  await page.screenshot({path:info.outputPath('psalm-119.png')});
  await page.keyboard.press('Escape');await expect(page.locator('#scripturePickerTrigger')).toBeFocused();
  console.log('Scripture geometry',width,theme,JSON.stringify(measurements));
  expect(await page.evaluate(()=>document.documentElement.scrollWidth<=innerWidth)).toBe(true);
});
for(const theme of ['light','dark'])for(const count of [2,3,4])test(`${theme} Compare ${count} columns: themed reference, numeric grids and independent editions`,async({page},info)=>{
  await ready(page,390,theme);await compare(page);
  await page.locator(`[data-compare-count="${count}"]`).click();
  await expect(page.locator('#compareGrid [data-themed-select]')).toHaveCount(count);
  await page.locator('[data-themed-select="compareBook"]').click();
  await expect(picker(page)).toHaveAccessibleName('Book');
  await picker(page).getByRole('searchbox').fill('John');
  await picker(page).locator('[data-option-value="john"]').click();
  await choose(page,'compareChapter','3');await choose(page,'compareVerse','16');
  await expect(page.locator('#compareSummary')).toHaveText('Comparing John 3:16');
  await page.locator('[data-themed-select="compareChapter"]').click();
  const numeric=await geometry(picker(page));expect(numeric.unused).toBeLessThanOrEqual(5);expect(numeric.overflow).toBe(false);
  await page.keyboard.press('Escape');await expect(page.locator('[data-themed-select="compareChapter"]')).toBeFocused();
  await choose(page,'compare-edition-0','dra');
  await expect(page.locator('[data-compare-index="0"]')).toHaveValue('dra');
  expect(new Set(await page.locator('[data-compare-index]').evaluateAll(nodes=>nodes.map(node=>node.value))).size).toBe(count);
  await choose(page,'compareVerse','');await expect(page.locator('#compareSummary')).toHaveText('Comparing John 3');
  await page.locator('[data-themed-select="compare-edition-0"]').click();
  await expect(picker(page).locator('[data-option-value]')).toHaveCount(9);
  await expect(picker(page)).toHaveCSS('background-color',theme==='light'?'rgb(247, 241, 222)':'rgb(36, 50, 72)');
  await page.screenshot({path:info.outputPath('compare-editions.png')});
  await page.keyboard.press('Escape');await expect(page.locator('[data-themed-select="compare-edition-0"]')).toBeFocused();
});
test('keyboard, theme change while modal open, stale choices and Catholic unavailable passages',async({page,context})=>{
  await ready(page);await compare(page);
  await choose(page,'compare-edition-0','dra');
  await expect(page.locator('#compareBook option[value="tobit"]')).toHaveCount(1);
  await choose(page,'compareBook','tobit');await expect(page.locator('.compare-unavailable')).not.toHaveCount(0);
  await expect(page.locator('.compare-col').first().locator('.vnum')).not.toHaveCount(0);
  const trigger=page.locator('[data-themed-select="compareChapter"]');await trigger.press('Enter');
  await page.keyboard.press('End');await expect(picker(page).locator('[data-option-value="14"]')).toBeFocused();
  await page.keyboard.press('Home');await expect(picker(page).locator('[data-option-value="1"]')).toBeFocused();
  await page.keyboard.press('ArrowRight');await expect(picker(page).locator('[data-option-value="2"]')).toBeFocused();
  const second=await context.newPage();await second.goto('/');await second.locator('[data-theme-toggle]').click();
  await expect(page.locator('html')).toHaveAttribute('data-theme','dark');
  await expect(picker(page)).toBeVisible();await expect(picker(page).locator('[data-option-value="2"]')).toBeFocused();
  await page.bringToFront();await page.keyboard.press('Space');await expect(page.locator('#compareChapter')).toHaveValue('2');
  await trigger.click();await page.evaluate(()=>{document.getElementById('compareBook').value='john';});
  await picker(page).locator('[data-option-value="3"]').click();await expect(page.locator('#compareChapter')).toHaveValue('2');
});
test('optional picker failure preserves native Compare controls and a retry enhances only once',async({page})=>{
  await page.route('**/js/bible/translation-picker.js',route=>route.abort());
  await ready(page);await page.getByRole('button',{name:'Compare',exact:true}).click();
  await expect(page.locator('#compareBook')).toBeVisible();await page.locator('#compareChapter').selectOption('3');
  await expect(page.locator('#compareSummary')).toHaveText('Comparing John 3');
  await page.unroute('**/js/bible/translation-picker.js');await page.getByRole('button',{name:'Compare',exact:true}).click();
  await expect(page.locator('[data-themed-select="compareBook"]')).toHaveCount(1);
  await page.evaluate(()=>loadCompare());await expect(page.locator('[data-themed-select="compareBook"]')).toHaveCount(1);
});
test('desktop Reader native-looking controls use themed dialogs without changing their values',async({page})=>{
  await ready(page);await page.locator('#readerTranslation').click();
  await expect(picker(page)).toHaveAccessibleName('Bible translation');await expect(picker(page).locator('[data-option-value]')).toHaveCount(9);
  await page.keyboard.press('Escape');await expect(page.locator('#readerTranslation')).toBeFocused();
  await page.locator('#searchInput').focus();await page.locator('#readerTranslation').dispatchEvent('click');
  await expect(picker(page)).toHaveAccessibleName('Bible translation');await page.keyboard.press('Escape');
  await page.locator('#readerTranslation').press('F4');await expect(picker(page)).toBeVisible();await page.keyboard.press('Escape');
  await page.locator('#readerMoreTrigger').click();await page.locator('#chapterSelect').press('ArrowDown');
  await expect(picker(page)).toHaveAccessibleName('Chapter');await page.keyboard.press('End');await page.keyboard.press('Enter');
  await expect(page.locator('#readerContent h2')).toHaveText('John 21');
});
test('fullscreen mobile, enlarged text and current Reader picker choices remain reachable',async({page})=>{
  await ready(page,320,'dark');await page.locator('#fullscreenBtn').click();await page.locator('#readerMoreTrigger').click();
  await page.evaluate(()=>ReaderTranslationLoader.ensure());
  await page.addStyleTag({content:'html{font-size:200%}button,input{font-size:20px!important}'});
  await page.locator('[data-reader-select="chapterSelect"]').click();
  await expect(page.locator('#readerOptionsPicker')).toBeVisible();
  await page.locator('#readerOptionsPicker [data-option-value="21"]').click();
  await expect(page.locator('#readerContent h2')).toHaveText('John 21');
  await expect(page.locator('#view-reader')).toHaveClass(/reader-fullscreen/);
  expect(await page.evaluate(()=>document.documentElement.scrollWidth<=innerWidth)).toBe(true);
});
test('baseline versus corrected desktop short-book geometry is measured',async({page})=>{
  const old=execFileSync('git',['show','c1eaa417616cfea271e61b35990112f780d196b3:css/companion.css'],{encoding:'utf8'});
  await page.route('**/css/companion.css',route=>route.fulfill({contentType:'text/css',body:old}));
  await ready(page);await page.locator('#scripturePickerTrigger').click();
  await page.locator('[data-picker-action="book"][data-value="obadiah"]').click();
  const before=await geometry(page.locator('#scripturePicker'));
  await page.unroute('**/css/companion.css');await page.reload();await page.evaluate(()=>initializeBibleExperience());await page.locator('#scripturePickerTrigger').click();
  await page.locator('[data-picker-action="book"][data-value="obadiah"]').click();
  const after=await geometry(page.locator('#scripturePicker'));
  console.log('Obadiah before/after',JSON.stringify({before,after}));expect(after.height).toBeLessThan(before.height);expect(after.unused).toBeLessThanOrEqual(5);
});
test('delayed optional enhancement does not hide a focused native control and binds once after blur',async({page})=>{
  let release;const barrier=new Promise(resolve=>release=resolve);
  await page.route('**/js/bible/translation-picker.js',async route=>{await barrier;await route.continue();});
  await ready(page);await page.getByRole('button',{name:'Compare',exact:true}).click();
  const native=page.locator('#compareBook');await expect(native).toBeVisible();await native.focus();
  release();await page.waitForFunction(()=>Boolean(window.ThemedSelectPicker));
  await expect(native).toBeVisible();await expect(native).toBeFocused();
  await page.getByRole('button',{name:'Compare',exact:true}).focus();
  await expect(page.locator('[data-themed-select="compareBook"]')).toHaveCount(1);
  await page.evaluate(()=>{ThemedSelectPicker.bind(document.getElementById('compareBook'));ThemedSelectPicker.bind(document.getElementById('compareBook'));});
  await expect(page.locator('[data-themed-select="compareBook"]')).toHaveCount(1);
});
test('rapid edition changes ignore delayed obsolete translation renders',async({page})=>{
  let release;const barrier=new Promise(resolve=>release=resolve);
  await page.route('**/js/bible/dra.js?*',async route=>{await barrier;await route.continue();});
  await ready(page);await compare(page);await choose(page,'compare-edition-0','dra');
  await choose(page,'compare-edition-0','kjv');
  await expect(page.locator('[data-themed-select="compare-edition-0"]')).toHaveText('KJV - King James Version');
  await expect(page.locator('.compare-col').first().locator('.vnum')).toHaveCount(51);
  release();await page.waitForFunction(()=>BibleData.isTranslationLoaded('dra'));
  await expect(page.locator('[data-compare-index="0"]')).toHaveValue('kjv');
  await expect(page.locator('#compareSummary')).toHaveText('Comparing John 1');
});
test('themed dialog traps both Tab directions, filters accessibly and clears canceled touch state',async({page})=>{
  await ready(page,320,'dark');await compare(page);
  await page.locator('[data-themed-select="compareBook"]').tap();
  const dialog=picker(page),close=dialog.getByRole('button',{name:'Close selection picker'});
  await close.focus();await page.keyboard.press('Shift+Tab');
  await expect(dialog.locator('[data-option-value]').last()).toBeFocused();
  await page.keyboard.press('Tab');await expect(close).toBeFocused();
  await dialog.getByRole('searchbox').fill('no matching book');await expect(dialog.locator('[role="status"]')).toHaveText('No matching choices.');
  await dialog.getByRole('searchbox').fill('John');
  const option=dialog.locator('[data-option-value="john"]');
  await option.dispatchEvent('pointerdown',{pointerType:'touch'});await expect(option).toHaveAttribute('data-pressed','true');
  await option.dispatchEvent('pointercancel',{pointerType:'touch'});await expect(option).not.toHaveAttribute('data-pressed');
  await option.tap();await expect(page.locator('[data-themed-select="compareBook"]')).toBeFocused();
});
