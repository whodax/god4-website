const {toggleReaderFullscreen}=require('./reader-navigation-test-helper');
const {test,expect}=require('@playwright/test');

test.use({hasTouch:true});

async function open(page,width,fullscreen){
  await page.setViewportSize({width,height:740});
  await page.addInitScript(()=>{window.IntersectionObserver=class{observe(){}unobserve(){}disconnect(){}};});
  await page.goto('/');await page.evaluate(async()=>{await initializeBibleExperience();await ReaderTranslationLoader.ensure();await document.fonts.ready;scrollReaderStartIntoView();});
  await expect.poll(()=>page.evaluate(()=>Math.abs(document.querySelector('#readerContent h2').getBoundingClientRect().top-readerVisibleTop()-16))).toBeLessThan(2);
  if(fullscreen)await toggleReaderFullscreen(page);
  await page.locator('#readerMoreTrigger').tap();await page.evaluate(()=>ReaderTranslationLoader.ensure());
  await page.evaluate(()=>document.fonts.ready);
}

async function geometry(page){
  return page.evaluate(()=>{
    const selectors=[
      ['[data-reader-select="bookSelect"]','[data-reader-select="chapterSelect"]','[data-reader-select="verseSelect"]'],
      ['#readerSaveVerse','#fullscreenBtn'],
      ['.reader-compact-stop']
    ];
    const rect=element=>{
      const bounds=element.getBoundingClientRect();
      return {top:bounds.top,bottom:bounds.bottom,left:bounds.left,right:bounds.right,width:bounds.width,height:bounds.height,client:element.clientWidth,scroll:element.scrollWidth,clientHeight:element.clientHeight,scrollHeight:element.scrollHeight};
    };
    return {panel:rect(document.getElementById('readerSecondaryControls')),rows:selectors.map(row=>row.map(selector=>rect(document.querySelector('#readerSecondaryControls '+selector)))),viewport:innerHeight,pageOverflow:document.documentElement.scrollWidth>innerWidth};
  });
}

function assertRows(measurement,width){
  expect(measurement.pageOverflow).toBe(false);
  for(const [index,row] of measurement.rows.entries()){
    expect(Math.max(...row.map(bounds=>bounds.top))-Math.min(...row.map(bounds=>bounds.top))).toBeLessThanOrEqual(1);
    for(const [column,bounds] of row.entries()){
      expect(bounds.height).toBeGreaterThanOrEqual(44);expect(bounds.width).toBeGreaterThanOrEqual(44);
      expect(bounds.scroll).toBeLessThanOrEqual(bounds.client+1);
      expect(bounds.scrollHeight).toBeLessThanOrEqual(bounds.clientHeight+1);
      expect(bounds.left).toBeGreaterThanOrEqual(0);expect(bounds.right).toBeLessThanOrEqual(width);
      if(column)expect(bounds.left).toBeGreaterThanOrEqual(row[column-1].right);
      if(index)expect(bounds.top).toBeGreaterThanOrEqual(Math.max(...measurement.rows[index-1].map(previous=>previous.bottom)));
    }
  }
}

for(const width of [320,360,390,430])for(const fullscreen of [false,true]){
  test(`${width}px fullscreen=${fullscreen}: compact Options retain detailed navigation, saving and fullscreen leave Scripture visible`,async({page},testInfo)=>{
    await open(page,width,fullscreen);
    const measured=await geometry(page);console.log(JSON.stringify({width,fullscreen,...measured}));
    await page.screenshot({path:testInfo.outputPath('expanded-options.png')});
    assertRows(measured,width);
    expect(measured.panel.height).toBeLessThanOrEqual(250);
    await expect(page.locator('#readerSaveStatus')).toHaveClass(/sr-only/);
    expect((await page.locator('#readerSaveStatus').boundingBox()).height).toBeLessThanOrEqual(1);
    expect(await page.locator('#readerContent').evaluate((content,bottom)=>Array.from(content.querySelectorAll('.reader-verse')).some(verse=>Array.from(verse.getClientRects()).some(bounds=>{
      if(bounds.top<bottom || bounds.bottom>innerHeight || !bounds.width)return false;
      return content.contains(document.elementFromPoint(bounds.left+bounds.width/2,bounds.top+bounds.height/2));
    })),measured.panel.bottom)).toBe(true);
    await expect(page.getByRole('group',{name:'Reading controls',exact:true})).toHaveCount(1);
    await expect(page.locator('.reader-toolbar > #readerVoiceCommands')).toBeVisible();
    await expect(page.locator('[data-voice-command-button]')).toHaveCount(1);
    for(const row of ['bookSelect','chapterSelect','verseSelect','readAloudVoice','readAloudSpeed']){
      const launcher=page.locator(`[data-reader-select="${row}"]`);
      await launcher.tap();await expect(page.locator('#readerOptionsPicker')).toBeVisible();
      await page.getByRole('button',{name:'Close Reader selection'}).tap();await expect(launcher).toBeFocused();
    }
    await page.locator('#readerSaveVerse').tap();
    await page.locator('#readerOptionsPicker [data-option-value="2"]').tap();
    await page.locator('#readerSaveVerse').tap();
    await expect(page.locator('#readerSaveVerse')).toHaveText('Saved ✓');
    await expect(page.locator('#readerSaveStatus')).toHaveText('John 1:2 (WEB) saved.');
    await expect(page.locator('#readerSaveStatus')).toHaveAttribute('aria-live','polite');
    const saved=await geometry(page);assertRows(saved,width);expect(saved.panel.height).toBeLessThanOrEqual(measured.panel.height);
    await page.locator('#readerMoreTrigger').tap();
    await expect(page.locator('#readerMoreTrigger')).toHaveText('Options');
    await expect(page.locator('#readerMoreTrigger')).toBeFocused();
    if(fullscreen)await toggleReaderFullscreen(page);
    await page.locator('.saved-pill').tap();
    await page.locator('.saved-verse-remove').filter({hasText:'Remove'}).tap();
    await expect(page.locator('#savedCount')).toHaveText('0');
    expect(await page.evaluate(()=>UserData.savedVerses.load())).toEqual([]);
    if(fullscreen)await toggleReaderFullscreen(page);
    await page.locator('#readerMoreTrigger').tap();
    await expect(page.locator('#readerSaveVerse')).toHaveText('Save verse');
    await expect(page.locator('#readerSaveVerse')).toHaveAttribute('aria-pressed','false');
    await page.locator('#readerMoreTrigger').tap();
    await page.locator('#readerContent [data-verse-number="30"]').scrollIntoViewIfNeeded();
    const before=await page.evaluate(()=>({page:scrollY,reader:document.getElementById('view-reader').scrollTop}));
    await page.locator('#readerMoreTrigger').tap();await page.locator('#readerMoreTrigger').tap();
    const after=await page.evaluate(()=>({page:scrollY,reader:document.getElementById('view-reader').scrollTop}));
    expect(after).toEqual(before);
    const verse=await page.locator('#readerContent [data-verse-number="30"]').boundingBox();
    expect(verse.y+verse.height).toBeGreaterThan(0);expect(verse.y).toBeLessThan(740);
  });

  test(`${width}px fullscreen=${fullscreen}: enlarged control text wraps without hidden controls`,async({page})=>{
    await open(page,width,fullscreen);
    await page.evaluate(()=>navigateReaderToPassage('song-of-solomon',1));
    await expect(page.locator('[data-reader-select="bookSelect"]')).toHaveAccessibleName('Book: Song of Solomon');
    await page.addStyleTag({content:'#readerSecondaryControls button,#readerSecondaryControls select{font-size:20px!important;}#readerSecondaryControls .reader-speech-field,#readerSecondaryControls label:not(.sr-only){font-size:16px!important;}'});
    expect(await page.locator('#readerSaveVerse').evaluate(element=>getComputedStyle(element).fontSize)).toBe('20px');
    await expect.poll(()=>page.locator('#readerSecondaryControls button,#readerSecondaryControls select').evaluateAll(controls=>controls.filter(control=>control.getClientRects().length).every(control=>getComputedStyle(control).fontSize==='20px'))).toBe(true);
    const enlarged=await geometry(page);console.log(JSON.stringify({width,fullscreen,enlarged}));assertRows(enlarged,width);
    for(const selector of ['[data-reader-select="bookSelect"]','[data-reader-select="chapterSelect"]','[data-reader-select="verseSelect"]','#readerSaveVerse','[data-voice-command-button]','[data-reader-select="readAloudVoice"]','[data-reader-select="readAloudSpeed"]']){
      const element=page.locator('#view-reader '+selector);await element.scrollIntoViewIfNeeded();
      expect(await element.evaluate(control=>{const bounds=control.getBoundingClientRect();return control.contains(document.elementFromPoint(bounds.left+bounds.width/2,bounds.top+bounds.height/2));})).toBe(true);
    }
    await page.locator('[data-reader-select="bookSelect"]').tap();
    await page.keyboard.press('End');await expect(page.locator('#readerOptionsPicker [data-option-value="revelation"]')).toBeFocused();
    await page.keyboard.press('Escape');await expect(page.locator('[data-reader-select="bookSelect"]')).toBeFocused();
    await page.keyboard.press('Escape');await expect(page.locator('#readerMoreTrigger')).toBeFocused();
  });
}
