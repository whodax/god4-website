const {test,expect}=require('@playwright/test');

async function visibleVerse(page,verse){
  const target=page.locator(`#readerContent [data-verse-number="${verse}"]`);
  await expect.poll(()=>target.evaluate(el=>{const r=el.getBoundingClientRect();return r.top>=readerVisibleTop()&&r.bottom<=innerHeight;})).toBe(true);
}
async function tapVisibleTab(page,name){
  const point=await page.locator(`[aria-controls="view-${name}"]`).evaluate(button=>{
    const rect=button.getBoundingClientRect();
    const x=(rect.left+rect.right)/2,y=(rect.top+rect.bottom)/2;
    return {x,y,top:rect.top,bottom:rect.bottom,navBottom:document.querySelector('nav').getBoundingClientRect().bottom,
      accessible:document.elementFromPoint(x,y)?.closest('button')===button};
  });
  expect(point.top).toBeGreaterThanOrEqual(point.navBottom-1);
  expect(point.bottom).toBeLessThanOrEqual(await page.evaluate(()=>innerHeight));
  expect(point.accessible).toBe(true);
  // Raw touch coordinates cannot auto-scroll an offscreen control into view.
  await page.touchscreen.tap(point.x,point.y);
  await expect(page.locator(`#view-${name}`)).toHaveClass(/active/);
  await page.evaluate(async()=>{await new Promise(requestAnimationFrame);await new Promise(requestAnimationFrame);});
}

test.describe('mobile sticky Study Desk navigation',()=>{
  test.use({viewport:{width:390,height:844},isMobile:true,hasTouch:true});
  test.beforeEach(async({page})=>{
    page.errors=[];page.on('pageerror',error=>page.errors.push(error.message));
    await page.emulateMedia({reducedMotion:'reduce'});
    await page.goto('/');await page.evaluate(async()=>{await initializeBibleExperience();await changeTranslation('web');await document.fonts.ready;});
  });
  test.afterEach(async({page})=>expect(page.errors).toEqual([]));
  for(const [book,chapter,verse] of [['genesis',24,45],['psalms',23,6],['john',1,30]]){
    test(`${book} ${chapter}:${verse} returns to selected verse using reachable raw-touch tabs`,async({page},testInfo)=>{
      await page.evaluate(({book,chapter,verse})=>navigateReaderToPassage(book,chapter,verse),{book,chapter,verse});
      await visibleVerse(page,verse);
      const initialY=await page.evaluate(()=>scrollY);
      await expect(page.locator('#bibleApp .bs-nav')).toHaveCSS('position','sticky');
      if(book==='genesis') await page.screenshot({path:testInfo.outputPath('sticky-reader-mobile.png')});
      await tapVisibleTab(page,'compare');
      await tapVisibleTab(page,'reader');
      await expect(page.locator('#verseSelect')).toHaveValue(String(verse));
      await visibleVerse(page,verse);
      expect(Math.abs(await page.evaluate(()=>scrollY)-initialY)).toBeLessThan(3);
      if(book!=='psalms') await expect(page.locator('#readerContent h2')).not.toBeInViewport();
    });
  }
  test('no selection restores the previous anchor with reachable tabs',async({page})=>{
    await page.evaluate(async()=>{
      await navigateReaderToPassage('genesis',24);
      window.scrollBy({top:document.querySelector('[data-verse-number="45"]').getBoundingClientRect().top-readerVisibleTop()-32,behavior:'instant'});
    });
    await page.evaluate(()=>new Promise(requestAnimationFrame));
    const before=await page.locator('#readerContent [data-verse-number="45"]').boundingBox();
    await tapVisibleTab(page,'compare');await tapVisibleTab(page,'reader');
    const after=await page.locator('#readerContent [data-verse-number="45"]').boundingBox();
    expect(Math.abs(after.y-before.y)).toBeLessThan(3);
    await expect(page.locator('#verseSelect')).toHaveValue('');
  });
  test('selected verse wins after the user manually scrolls all the way back to the tabs',async({page})=>{
    await page.evaluate(async()=>{await navigateReaderToPassage('genesis',24,45);window.scrollTo({top:document.querySelector('#bibleApp').offsetTop-150,behavior:'instant'});});
    await tapVisibleTab(page,'compare');await tapVisibleTab(page,'reader');
    await visibleVerse(page,45);await expect(page.locator('#verseSelect')).toHaveValue('45');
  });
  test('Plan stays reachable from a long Reader and returns to its selected verse',async({page})=>{
    await page.evaluate(()=>navigateReaderToPassage('genesis',24,45));
    await visibleVerse(page,45);
    await tapVisibleTab(page,'plan');await tapVisibleTab(page,'reader');
    await visibleVerse(page,45);await expect(page.locator('#verseSelect')).toHaveValue('45');
  });
  test('keyboard focus, narrow reflow, zoom equivalent and fullscreen remain usable',async({page})=>{
    // 320 CSS pixels also models the existing 640px / 200% reflow acceptance check.
    for(const width of [390,320]){
      await page.setViewportSize({width,height:844});
      await page.evaluate(()=>navigateReaderToPassage('genesis',24,45));
      await visibleVerse(page,45);
      expect(await page.evaluate(()=>innerWidth)).toBe(width);
      expect(await page.evaluate(()=>document.documentElement.scrollWidth<=innerWidth)).toBe(true);
      const geometry=await page.evaluate(()=>{
        const tabs=document.querySelector('.bs-nav').getBoundingClientRect(),toolbar=document.querySelector('.reader-toolbar').getBoundingClientRect();
        return {tabsBottom:tabs.bottom,toolbarTop:toolbar.top,toolbarBottom:toolbar.bottom,height:innerHeight};
      });
      expect(Math.abs(geometry.toolbarTop-geometry.tabsBottom)).toBeLessThan(2);
      expect(geometry.toolbarBottom).toBeLessThan(geometry.height-120);
    }
    await page.setViewportSize({width:390,height:844});
    const compare=page.locator('[aria-controls="view-compare"]');
    await compare.focus();await expect(compare).toBeFocused();
    await expect(compare).toHaveCSS('outline-style','solid');await compare.press('Enter');
    await expect(compare).toHaveAttribute('aria-pressed','true');
    const reader=page.locator('[aria-controls="view-reader"]');
    await reader.focus();await reader.press('Enter');await expect(reader).toBeFocused();
    await visibleVerse(page,45);
    await page.evaluate(()=>toggleFullscreen());
    expect(await page.evaluate(()=>readerVisibleTop())).toBe(await page.locator('.reader-toolbar').evaluate(el=>el.getBoundingClientRect().bottom));
    await page.evaluate(()=>toggleFullscreen());
    for(const name of ['reader','compare','plan']) await expect(page.locator(`[aria-controls="view-${name}"]`)).toHaveCount(1);
  });
});
