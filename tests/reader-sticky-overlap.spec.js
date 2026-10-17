const {test,expect}=require('@playwright/test');
async function stack(page){
  return page.evaluate(()=>{
    const info=selector=>{const el=document.querySelector(selector),r=el.getBoundingClientRect(),s=getComputedStyle(el);return {top:r.top,bottom:r.bottom,height:r.height,paddingTop:s.paddingTop,paddingBottom:s.paddingBottom,border:s.borderBottomWidth,cssTop:s.top};};
    const site=info('nav'),tabs=info('#bibleApp .bs-nav'),toolbar=info('.reader-toolbar');
    return {site,tabs,toolbar,effectiveBottom:Math.max(site.bottom,tabs.bottom,toolbar.bottom),helper:readerVisibleTop(),tail:getComputedStyle(document.getElementById('bibleApp')).getPropertyValue('--reader-stack-tail')};
  });
}
for(const width of [390,320])test.describe(`${width}px sticky overlap`,()=>{
  test.use({viewport:{width,height:844},isMobile:true,hasTouch:true});
  test.beforeEach(async({page})=>{
    await page.emulateMedia({reducedMotion:'reduce'});await page.goto('/');
    await page.evaluate(async()=>{await initializeBibleExperience();await changeTranslation('web');await document.fonts.ready;});
  });
  for(const [book,chapter,verse] of [['genesis',24,45],['psalms',23,6],['john',1,30]]){
    test(`${book} ${chapter}:${verse} clears actual sticky rectangles before and after tab return`,async({page},testInfo)=>{
      await page.evaluate(({book,chapter,verse})=>navigateReaderToPassage(book,chapter,verse),{book,chapter,verse});
      for(const phase of ['selected','returned','ordinary-scroll','reader-end']){
        if(phase==='returned'){
          await page.locator('[aria-controls="view-compare"]').tap();await page.locator('[aria-controls="view-reader"]').tap();
        }
        if(phase==='ordinary-scroll') await page.evaluate(()=>window.scrollBy({top:90,behavior:'instant'}));
        if(phase==='reader-end') await page.evaluate(()=>window.scrollBy({top:document.getElementById('view-reader').getBoundingClientRect().bottom-document.querySelector('.bs-nav').getBoundingClientRect().bottom-30,behavior:'instant'}));
        await page.evaluate(async()=>{await new Promise(requestAnimationFrame);await new Promise(requestAnimationFrame);});
        const measured=await stack(page);
        const bounds=await page.locator(`#readerContent [data-verse-number="${verse}"]`).boundingBox();
        console.log(JSON.stringify({width,book,phase,measured,bounds}));
        await page.screenshot({path:testInfo.outputPath(`${phase}.png`)});
        // At the end of the Study Desk, the whole stack can leave beneath the site header.
        if(phase!=='reader-end') expect(measured.tabs.top).toBeGreaterThanOrEqual(measured.site.bottom-1);
        expect(measured.toolbar.top).toBeGreaterThanOrEqual(measured.tabs.bottom-1);
        if(phase==='selected'||phase==='returned'){
          await expect(page.locator('#verseSelect')).toHaveValue(String(verse));
          expect(bounds.y).toBeGreaterThanOrEqual(measured.effectiveBottom);
          expect(bounds.y+bounds.height).toBeLessThanOrEqual(844);
          if(phase==='selected') await expect(page.locator(`#readerContent [data-verse-number="${verse}"]`)).toBeFocused();
        }
      }
    });
  }
  test('long-to-short chapter starts below independently measured stack',async({page})=>{
    await page.evaluate(async()=>{await navigateReaderToPassage('genesis',24,67);await navigateReaderToPassage('psalms',23);});
    const measured=await stack(page),heading=await page.locator('#readerContent h2').boundingBox();
    expect(heading.y).toBeGreaterThanOrEqual(measured.effectiveBottom+15);
    expect(heading.y+heading.height).toBeLessThan(844);
    expect(measured.toolbar.top).toBeGreaterThanOrEqual(measured.tabs.bottom-1);
    await expect(page.locator('#verseSelect')).toHaveValue('');
  });
});
for(const width of [1024,1280,1440])test(`desktop ${width}px keeps the existing toolbar and Compare reachable`,async({page})=>{
  await page.setViewportSize({width,height:900});
  await page.emulateMedia({reducedMotion:'reduce'});await page.goto('/');
  await page.evaluate(async()=>{await initializeBibleExperience();await changeTranslation('web');await document.fonts.ready;await navigateReaderToPassage('genesis',24,45);});
  const toolbar=page.locator('.reader-toolbar'),header=page.locator('.bs-header');
  const compare=page.locator('[aria-controls="view-compare"]');
  const verse=page.locator('#readerContent [data-verse-number="45"]');
  const assertStack=async()=>{
    const measured=await stack(page),h=await header.boundingBox();
    expect(h.y).toBeCloseTo(measured.site.bottom,0);
    expect(measured.toolbar.top).toBeCloseTo(h.y+h.height,0);
    expect(measured.toolbar.bottom).toBeLessThan(900);
    expect(parseFloat(measured.tail)).toBeGreaterThan(0);
    await expect(compare).toBeInViewport();
    expect((await verse.boundingBox()).y).toBeGreaterThanOrEqual(measured.toolbar.bottom);
  };
  expect(await page.evaluate(()=>scrollY)).toBeGreaterThan(1000);
  await assertStack();
  // Raw pointer clicks cannot silently scroll an offscreen control into view.
  const clickVisible=async locator=>{const r=await locator.boundingBox();expect(r.y).toBeGreaterThanOrEqual(0);expect(r.y+r.height).toBeLessThan(900);await page.mouse.click(r.x+r.width/2,r.y+r.height/2);};
  const before=await page.evaluate(()=>scrollY);
  await clickVisible(page.locator('#readerMoreTrigger'));
  await expect(page.locator('#readerSecondaryControls')).toBeVisible();
  // Expanding the in-flow toolbar may adjust scroll anchoring, but never returns to the top.
  expect(await page.evaluate(()=>scrollY)).toBeGreaterThanOrEqual(before);
  await assertStack();
  await clickVisible(compare);
  await expect(page.locator('#view-compare')).toHaveClass(/active/);
  await expect(page.locator('.compare-text p')).toHaveCount(2);
  await expect(page.locator('#compareSummary')).toBeVisible();
  const summary=await page.locator('#compareSummary').boundingBox(),h=await header.boundingBox();
  expect(summary.y).toBeGreaterThanOrEqual(h.y+h.height);
  await clickVisible(page.locator('[aria-controls="view-reader"]'));
  await expect(toolbar).toBeVisible();await assertStack();
  await clickVisible(page.locator('#readerMoreTrigger'));
  await clickVisible(page.locator('#fullscreenBtn'));
  await expect(page.locator('#view-reader')).toHaveClass(/reader-fullscreen/);
  expect((await toolbar.boundingBox()).y).toBeLessThan(30);
  await page.keyboard.press('Escape');await assertStack();
  // At the container end, both sticky rows leave together without overlapping.
  await page.evaluate(()=>window.scrollBy({top:document.getElementById('view-reader').getBoundingClientRect().bottom-document.querySelector('.bs-header').getBoundingClientRect().bottom-30,behavior:'instant'}));
  await page.evaluate(async()=>{await new Promise(requestAnimationFrame);await new Promise(requestAnimationFrame);});
  const end=await stack(page),endHeader=await header.boundingBox();
  expect(end.toolbar.top).toBeGreaterThanOrEqual(endHeader.y+endHeader.height-1);
});
