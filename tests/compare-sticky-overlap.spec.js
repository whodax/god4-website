const {test,expect}=require('@playwright/test');
async function geometry(page){
  return page.evaluate(()=>{
    const rect=selector=>{const r=document.querySelector(selector).getBoundingClientRect();return {top:r.top,bottom:r.bottom,height:r.height};};
    const site=rect('nav'),tabs=rect('.bs-nav');
    return {site,tabs,bottom:Math.max(site.bottom,tabs.bottom),summary:rect('#compareSummary'),controls:rect('.compare-selector-row'),
      header:rect('.compare-col-header'),verse:rect('.compare-text p'),grid:rect('#compareGrid')};
  });
}
async function tapTab(page,name){
  const r=await page.locator(`[aria-controls="view-${name}"]`).boundingBox();
  await page.touchscreen.tap(r.x+r.width/2,r.y+r.height/2);
  await expect(page.locator(`#view-${name}`)).toHaveClass(/active/);
}
for(const width of [390,320])test.describe(`${width}px Compare clearance`,()=>{
  test.use({viewport:{width,height:844},isMobile:true,hasTouch:true});
  test.beforeEach(async({page})=>{
    page.errors=[];page.on('pageerror',e=>page.errors.push(e.message));
    await page.emulateMedia({reducedMotion:'reduce'});await page.goto('/');
    await page.evaluate(async()=>{await initializeBibleExperience();await changeTranslation('web');await document.fonts.ready;});
  });
  test.afterEach(async({page})=>expect(page.errors).toEqual([]));
  for(const [book,chapter,verse] of [['genesis',24,45],['psalms',23,6],['john',1,30]])test(`${book} ${chapter}:${verse} Compare and Reader remain unobscured`,async({page},testInfo)=>{
    await page.evaluate(({book,chapter,verse})=>navigateReaderToPassage(book,chapter,verse),{book,chapter,verse});
    await tapTab(page,'compare');await expect(page.locator('.compare-text p')).toHaveCount(2);
    await page.evaluate(async()=>{await new Promise(requestAnimationFrame);await new Promise(requestAnimationFrame);});
    const cold=await geometry(page);
    console.log(JSON.stringify({width,book,phase:'cold',g:cold}));
    expect(cold.summary.top).toBeGreaterThanOrEqual(cold.bottom-1);
    expect(cold.header.top).toBeGreaterThanOrEqual(cold.bottom-1);
    expect(cold.verse.top).toBeGreaterThanOrEqual(cold.bottom-1);
    await tapTab(page,'reader');await tapTab(page,'compare');
    await page.evaluate(async()=>{await new Promise(requestAnimationFrame);await new Promise(requestAnimationFrame);});
    const g=await geometry(page);
    console.log(JSON.stringify({width,book,g,summaryObscured:Math.max(0,g.bottom-g.summary.top),verseObscured:Math.max(0,Math.min(g.verse.height,g.bottom-g.verse.top))}));
    await page.screenshot({path:testInfo.outputPath('compare.png')});
    expect(g.summary.top).toBeGreaterThanOrEqual(g.bottom-1);
    expect(g.header.top).toBeGreaterThanOrEqual(g.bottom-1);
    expect(g.verse.top).toBeGreaterThanOrEqual(g.bottom-1);
    expect(g.verse.bottom).toBeLessThanOrEqual(844);
    await tapTab(page,'reader');await expect(page.locator('#verseSelect')).toHaveValue(String(verse));
    const bounds=await page.locator(`#readerContent [data-verse-number="${verse}"]`).boundingBox();
    expect(bounds.y).toBeGreaterThanOrEqual(await page.evaluate(()=>readerVisibleTop()));
    expect(bounds.y+bounds.height).toBeLessThanOrEqual(844);
  });
  test('whole-chapter start and scrolled verse use the shared margin',async({page})=>{
    await page.evaluate(()=>navigateReaderToPassage('john',1));await tapTab(page,'compare');
    await expect(page.locator('.compare-text p')).toHaveCount(102);
    const g=await geometry(page);expect(g.summary.top).toBeGreaterThanOrEqual(g.bottom-1);
    const verse=page.locator('.compare-col').first().locator('.compare-text p').nth(29);
    await verse.evaluate(el=>el.scrollIntoView({block:'start',behavior:'instant'}));
    const top=await verse.evaluate(el=>el.getBoundingClientRect().top);
    expect(top).toBeGreaterThanOrEqual((await geometry(page)).bottom-1);
    expect(top).toBeLessThan(844);
  });
  test('multiple editions, column-header scrolling and keyboard focus clear tabs',async({page})=>{
    await page.evaluate(()=>navigateReaderToPassage('john',1,30));await tapTab(page,'compare');
    for(const count of [2,3,4]){
      await page.evaluate(count=>setCompareEditionCount(count),count);
      await expect(page.locator('.compare-col')).toHaveCount(count);
      await expect(page.locator('.compare-text p')).toHaveCount(count);
      const header=page.locator('.compare-col-header').last();
      await header.evaluate(el=>el.scrollIntoView({block:'start',behavior:'instant'}));
      expect((await header.boundingBox()).y).toBeGreaterThanOrEqual((await geometry(page)).bottom-1);
      await expect(header).toHaveCSS('position','static');
      const select=header.locator('select');await select.focus();await expect(select).toBeFocused();
      expect((await select.boundingBox()).y).toBeGreaterThanOrEqual((await geometry(page)).bottom-1);
      expect(await page.evaluate(()=>document.documentElement.scrollWidth<=innerWidth && document.getElementById('compareGrid').scrollWidth<=document.getElementById('compareGrid').clientWidth)).toBe(true);
    }
  });
  test('late Compare render cannot scroll the returned Reader',async({page})=>{
    await page.evaluate(async()=>{
      await navigateReaderToPassage('genesis',24,45);
      const ensure=BibleTranslationLoader.ensure.bind(BibleTranslationLoader);
      window.releaseCompare=[];
      BibleTranslationLoader.ensure=id=>new Promise(resolve=>releaseCompare.push(()=>ensure(id).then(resolve)));
    });
    await tapTab(page,'compare');await tapTab(page,'reader');
    const before=await page.evaluate(()=>scrollY);
    await page.evaluate(()=>releaseCompare.forEach(release=>release()));
    await expect(page.locator('.compare-col')).toHaveCount(2);
    expect(await page.evaluate(()=>scrollY)).toBe(before);
    await expect(page.locator('#view-reader')).toHaveClass(/active/);
    await expect(page.locator('#verseSelect')).toHaveValue('45');
  });
});
test('desktop Compare entry adds no application scroll or sticky columns',async({page})=>{
  await page.setViewportSize({width:1280,height:900});await page.goto('/');
  await page.evaluate(async()=>{
    await initializeBibleExperience();await navigateReaderToPassage('john',1,30);
    window.compareEntryScrolls=0;const original=window.scrollBy.bind(window);
    window.scrollBy=options=>{compareEntryScrolls++;original(options);};
    switchView('compare',document.querySelector('[aria-controls="view-compare"]'));
  });
  await expect(page.locator('.compare-col')).toHaveCount(2);
  expect(await page.evaluate(()=>compareEntryScrolls)).toBe(0);
  await expect(page.locator('.bs-nav')).toHaveCSS('position','static');
  await expect(page.locator('.compare-col-header').first()).toHaveCSS('position','static');
});
