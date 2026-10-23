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

async function readerDialog(page,id){
  const mobile=await page.locator(`[data-reader-select="${id}"]`).isVisible();
  const trigger=page.locator(mobile ? `[data-reader-select="${id}"]` : '#'+id);
  await trigger.focus();await trigger.press('Enter');
  return {trigger,dialog:page.locator(mobile?'#readerOptionsPicker':'#themedSelectPicker')};
}
async function chooseReader(page,id,value){
  const {dialog}=await readerDialog(page,id);
  await dialog.locator(`[data-option-value="${value}"]`).click();
  await expect(page.locator('#'+id)).toHaveValue(value);
  // This test exercises independent choices; close the newly cascaded picker.
  const next=id==='bookSelect'?'Chapter':id==='chapterSelect'?'Verse':null;
  if(next){
    await expect(dialog).toHaveAccessibleName(next);
    await page.keyboard.press('Escape');
    await expect(dialog).not.toBeVisible();
  }
}
async function chapterOnly(page){
  await expect(page.locator('#verseSelect')).toHaveValue('');
  await expect(page.locator('#readerReferenceText')).toHaveText('John 1');
  await expect(page.locator('#readerContent .reader-verse')).toHaveCount(51);
  await expect(page.locator('#readerContent .verse-focused')).toHaveCount(0);
  expect(await page.evaluate(()=>({verse:currentVerse,start:getSelectedPlaybackCursor().verse}))).toEqual({verse:null,start:1});
  await expect.poll(()=>page.evaluate(()=>Math.abs(document.querySelector('#readerContent h2').getBoundingClientRect().top-(readerVisibleTop()+16)))).toBeLessThan(2);
}

for(const width of [320,360,390,430,1280])for(const theme of ['light','dark'])test(`${width}px ${theme}: Reader numbered-only choices preserve chapter state and other Whole Chapter pickers`,async({page},info)=>{
  const errors=[];page.on('pageerror',error=>errors.push(error.message));
  await page.setViewportSize({width,height:844});
  await page.emulateMedia({colorScheme:theme==='light'?'dark':'light',reducedMotion:'reduce'});
  await page.addInitScript(theme=>localStorage.setItem('god4.theme',theme),theme);
  await page.goto('/');await page.evaluate(()=>initializeBibleExperience());await page.evaluate(()=>document.fonts.ready);
  await page.locator('#readerMoreTrigger').click();await page.evaluate(()=>ReaderTranslationLoader.ensure());
  for(const fullscreen of [false,true]){
    if(fullscreen)await page.locator('#fullscreenBtn').click();
    await chooseReader(page,'bookSelect','genesis');await chooseReader(page,'bookSelect','john');
    await chooseReader(page,'chapterSelect','2');await chooseReader(page,'chapterSelect','1');
    await chapterOnly(page);
    if(width<=620){
      await expect(page.locator('[data-reader-select="verseSelect"]')).toHaveText('Verse');
      await expect(page.locator('[data-reader-select="verseSelect"]')).toHaveAccessibleName('Verse, no verse selected');
    }
    const {trigger,dialog}=await readerDialog(page,'verseSelect');
    await expect(dialog.locator('[data-option-value="1"]')).toBeFocused();
    await expect(dialog.locator('[data-option-value=""]')).toHaveCount(0);
    expect(await dialog.locator('[data-option-value]').evaluateAll(nodes=>nodes.map(node=>node.innerText.trim()))).toEqual(Array.from({length:51},(_,index)=>String(index+1)));
    await expect(dialog.locator('[data-option-value="1"]')).toHaveAccessibleName('1');
    expect(await dialog.locator('[data-option-value]').evaluateAll(nodes=>nodes.every(node=>{const bounds=node.getBoundingClientRect();return bounds.width>=44 && bounds.height>=44;}))).toBe(true);
    await expect(dialog).toHaveCSS('background-color',theme==='light'?'rgb(247, 241, 222)':'rgb(36, 50, 72)');
    expect(await page.evaluate(()=>currentVerse)).toBeNull();
    if(!fullscreen)await page.screenshot({path:info.outputPath('numbered-verses.png')});
    await page.keyboard.press('End');await expect(dialog.locator('[data-option-value="51"]')).toBeFocused();
    await expect(dialog.locator('[data-option-value="51"]')).toBeInViewport();
    await page.keyboard.press('Escape');await expect(trigger).toBeFocused();
    const before=await page.evaluate(()=>document.querySelector('#view-reader').classList.contains('reader-fullscreen')?document.querySelector('#view-reader').scrollTop:scrollY);
    await readerDialog(page,'verseSelect');await page.keyboard.press('Escape');
    const after=await page.evaluate(()=>document.querySelector('#view-reader').classList.contains('reader-fullscreen')?document.querySelector('#view-reader').scrollTop:scrollY);
    expect(Math.abs(after-before)).toBeLessThanOrEqual(1);
    for(const verse of ['1','21','1']){
      await chooseReader(page,'verseSelect',verse);
      await expect(page.locator('#readerReferenceText')).toHaveText('John 1:'+verse);
      await expect(page.locator('#readerContent .verse-focused')).toHaveAttribute('data-verse-number',verse);
      await expect.poll(()=>page.locator('#readerContent .verse-focused').evaluate(node=>node.getBoundingClientRect().top>=readerVisibleTop()-1 && node.getBoundingClientRect().top<innerHeight)).toBe(true);
      const selected=await readerDialog(page,'verseSelect');
      await expect(selected.dialog.locator(`[data-option-value="${verse}"]`)).toHaveAttribute('aria-pressed','true');
      await expect(selected.dialog.locator(`[data-option-value="${verse}"]`)).toBeFocused();
      await page.keyboard.press('Escape');await expect(selected.trigger).toBeFocused();
    }
    await chooseReader(page,'chapterSelect','2');await chooseReader(page,'chapterSelect','1');await chapterOnly(page);
  }
  await page.locator('#fullscreenBtn').click();
  await page.locator('#readerSaveVerse').click();
  const dialog=page.locator('#readerOptionsPicker');
  await expect(dialog).toHaveAccessibleName('Choose a verse to save');await expect(dialog.locator('[data-option-value=""]')).toHaveCount(0);
  expect(await page.evaluate(()=>UserData.savedVerses.load())).toEqual([]);
  await dialog.locator('[data-option-value="2"]').tap();await expect(page.locator('#verseSelect')).toHaveValue('2');
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

for(const width of [320,1280])for(const theme of ['light','dark'])test(`${width}px ${theme}: failed custom runtime preserves native Verse and chapter fallback`,async({page})=>{
  await page.setViewportSize({width,height:844});
  await page.addInitScript(theme=>localStorage.setItem('god4.theme',theme),theme);
  await page.route('**/js/bible/translation-picker.js',route=>route.abort());
  await page.goto('/');await page.evaluate(()=>initializeBibleExperience());
  // Match the stable-font precondition used by the primary Reader geometry tests.
  // A late font swap can reflow the sticky toolbar after the scroll is measured.
  await page.evaluate(()=>document.fonts.ready);
  await page.locator('#readerMoreTrigger').click();
  await expect(page.locator('#readerSaveStatus')).toContainText('Native controls');
  const verse=page.locator('#verseSelect');await expect(verse).toBeVisible();await expect(verse).toHaveValue('');
  await expect(verse.locator('option[value=""]')).toHaveText('Verse');
  for(const value of ['1','21','1']){
    await verse.selectOption(value);await expect(page.locator('#readerReferenceText')).toHaveText('John 1:'+value);
    await expect(page.locator('#readerContent .verse-focused')).toHaveAttribute('data-verse-number',value);
  }
  // Capture the scroll request without reading layout before the Reader's
  // own positioning code; early geometry reads can mask a layout race.
  await page.evaluate(()=>{
    const trace=[];
    window.__nativeFallbackScrollTrace=trace;
    // Only record call identity; measuring geometry here can mask the race.
    const positionChapterStart=window.scrollReaderStartIntoView;
    window.scrollReaderStartIntoView=function(){
      trace.push({phase:'start-position-called',chapter:document.getElementById('chapterSelect').value,at:performance.now()});
      const result=positionChapterStart.apply(this,arguments);
      trace.push({phase:'start-position-returned',chapter:document.getElementById('chapterSelect').value,at:performance.now()});
      return result;
    };
    const scrollBy=window.scrollBy;
    window.scrollBy=function(options){
      if(options && typeof options==='object')
        trace.push({phase:'scroll-request',top:options.top,behavior:options.behavior,at:performance.now()});
      return scrollBy.apply(this,arguments);
    };
    window.addEventListener('scroll',function(){
      trace.push({phase:'scroll-event',y:scrollY,at:performance.now()});
    },{passive:true});
  });
  await page.locator('#chapterSelect').selectOption('2');
  await page.evaluate(()=>__nativeFallbackScrollTrace.push({phase:'chapter-2-selected',at:performance.now()}));
  await page.locator('#chapterSelect').selectOption('1');
  await page.evaluate(()=>__nativeFallbackScrollTrace.push({phase:'chapter-1-selected',at:performance.now()}));
  try {
    await chapterOnly(page);
  } catch(error){
    // Diagnostic evidence only: retain the original <2px assertion and rethrow.
    const snapshot=await page.evaluate(()=>{
      const heading=document.querySelector('#readerContent h2');
      const toolbar=document.querySelector('#view-reader .reader-toolbar');
      const tabs=document.querySelector('#bibleApp .bs-nav');
      const nav=document.querySelector('nav');
      const box=node=>node?{top:node.getBoundingClientRect().top,bottom:node.getBoundingClientRect().bottom,height:node.getBoundingClientRect().height}:null;
      return {heading:box(heading),boundary:readerVisibleTop()+16,scrollY,
        fonts:document.fonts.status,fontLinkMedia:document.getElementById('googleFontsStylesheet')?.media,
        nav:box(nav),tabs:box(tabs),toolbar:box(toolbar),
        visibleTop:readerVisibleTop(),readerPlanReturnHeight:readerPlanReturnHeight()};
    });
    console.log('NATIVE_FALLBACK_CHAPTER_SCROLL',JSON.stringify({...snapshot,
      trace:await page.evaluate(()=>window.__nativeFallbackScrollTrace || [])}));
    throw error;
  }
});
