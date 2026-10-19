const {test,expect}=require('@playwright/test');

test.use({serviceWorkers:'block'});

async function geometry(page){
  return page.evaluate(()=>{
    const headingElement=document.getElementById('planHeading'),heading=headingElement.getBoundingClientRect();
    const dayElement=document.querySelector('#planDays button'),day=dayElement.getBoundingClientRect();
    const reader=document.getElementById('view-reader');
    const tabs=readerStickyNavigation().getBoundingClientRect();
    return {scrollElement:document.scrollingElement.tagName,scrollY,documentScroll:document.scrollingElement.scrollTop,
      readerScroll:reader.scrollTop,readerOverflow:getComputedStyle(reader).overflowY,
      top:readerVisibleTop(),headingTop:heading.top,headingBottom:heading.bottom,
      firstDayTop:day.top,firstDayBottom:day.bottom,height:innerHeight,tabsTop:tabs.top,tabsBottom:tabs.bottom,
      headingHit:headingElement.contains(document.elementFromPoint(heading.left+heading.width/2,heading.top+heading.height/2)),
      firstDayHit:dayElement.contains(document.elementFromPoint(day.left+day.width/2,day.top+day.height/2))};
  });
}
async function planVisible(page){
  const measured=await geometry(page);
  expect(measured.headingTop,JSON.stringify(measured)).toBeGreaterThanOrEqual(measured.top);
  expect(measured.headingBottom,JSON.stringify(measured)).toBeLessThanOrEqual(measured.height);
  expect(measured.firstDayTop,JSON.stringify(measured)).toBeGreaterThanOrEqual(measured.top);
  expect(measured.firstDayBottom,JSON.stringify(measured)).toBeLessThanOrEqual(measured.height);
  expect(measured.headingHit).toBe(true);expect(measured.firstDayHit).toBe(true);
  expect(await page.evaluate(()=>window.planTabScrolls.every(options=>options.behavior==='instant'))).toBe(true);
  await expect(page.locator('#view-plan')).toHaveClass(/active/);
  await expect(page.locator('#planDays button')).toHaveCount(30);
  return measured;
}
async function deepReader(page){
  await page.getByRole('button',{name:'Reader',exact:true}).click();
  await page.evaluate(async()=>{
    await navigateReaderToPassage('genesis',24,null);
    const verse=document.querySelector('#readerContent [data-verse-number="45"]');
    window.scrollBy({top:verse.getBoundingClientRect().top-readerVisibleTop()-16,behavior:'instant'});
  });
  expect(await page.evaluate(()=>scrollY)).toBeGreaterThan(1500);
}
async function deepCompare(page){
  await page.getByRole('button',{name:'Compare',exact:true}).click();
  await expect(page.locator('#compareGrid .compare-col')).toHaveCount(2);
  await expect(page.locator('#compareSummary')).toHaveText('Comparing Genesis 24');
  await page.evaluate(()=>{
    const paragraph=document.querySelectorAll('#compareGrid .compare-col .compare-text p')[35];
    window.scrollBy({top:paragraph.getBoundingClientRect().top-readerVisibleTop()-16,behavior:'instant'});
  });
  expect(await page.evaluate(()=>scrollY)).toBeGreaterThan(1500);
}
for(const width of [1280,390,320])test.describe(`${width}px Plan tab navigation`,()=>{
  test.use({viewport:{width,height:width===1280?900:720},hasTouch:width<620});
  test.beforeEach(async({page})=>{
    page.navigationErrors=[];
    page.on('pageerror',error=>page.navigationErrors.push(error.message));
    await page.goto('/');
    await page.evaluate(async()=>{await initializeBibleExperience();await document.fonts.ready;});
    await deepReader(page);
    await page.evaluate(()=>{
      window.planTabScrolls=[];
      const scroll=window.scrollBy;
      window.scrollBy=function(options){
        if(document.getElementById('view-plan').classList.contains('active'))planTabScrolls.push(options);
        return scroll.apply(window,arguments);
      };
    });
  });
  test.afterEach(async({page})=>expect(page.navigationErrors).toEqual([]));

  for(const source of ['Reader','Compare'])test(`${source} to Plan reveals the heading and first day immediately`,async({page},info)=>{
    if(source==='Compare')await deepCompare(page);
    const before=await geometry(page);
    const plan=page.getByRole('button',{name:'Plan',exact:true});
    if(width<620)await plan.tap();else await plan.click();
    const after=await geometry(page);
    console.log('PLAN_TAB_GEOMETRY',JSON.stringify({width,source,before,after}));
    await page.screenshot({path:info.outputPath('plan-after-switch.png')});
    await planVisible(page);
    await expect(page.getByRole('button',{name:'Plan',exact:true})).toBeFocused();
    await expect(page.getByRole('button',{name:'Plan',exact:true})).toHaveAttribute('aria-pressed','true');
  });
  test('late Compare runtime completion leaves the Plan heading and focus in place',async({page})=>{
    let release;
    const gate=new Promise(resolve=>release=resolve);
    await page.route('**/js/bible/compare.js',async route=>{await gate;await route.continue();});
    try{
      await page.getByRole('button',{name:'Compare',exact:true}).click();
      await expect(page.locator('#view-compare')).toHaveAttribute('aria-busy','true');
      const plan=page.getByRole('button',{name:'Plan',exact:true});
      await plan.click();const before=await planVisible(page);
      release();await page.evaluate(()=>CompareLoader.ensure().then(()=>true));
      await page.evaluate(()=>new Promise(resolve=>requestAnimationFrame(()=>requestAnimationFrame(resolve))));
      expect((await planVisible(page)).scrollY).toBe(before.scrollY);
      await expect(plan).toBeFocused();
    }finally{release();}
  });
  test('repeated pointer and keyboard switches preserve the Reader anchor and do not leave delayed Plan jumps',async({page})=>{
    for(let cycle=0;cycle<3;cycle++){
      await deepReader(page);
      const anchor=await page.evaluate(()=>{
        rememberReaderTabPosition(true);
        return {verse:readerTabPosition.verse,offset:readerTabPosition.offset};
      });
      const plan=page.getByRole('button',{name:'Plan',exact:true});
      if(cycle===0)await plan.click();
      else await plan.press(cycle===1?'Enter':' ');
      const before=await planVisible(page);
      await page.evaluate(()=>new Promise(resolve=>requestAnimationFrame(()=>requestAnimationFrame(resolve))));
      const after=await planVisible(page);
      expect(after.scrollY).toBe(before.scrollY);
      await page.getByRole('button',{name:'Reader',exact:true}).click();
      const offset=await page.locator(`#readerContent [data-verse-number="${anchor.verse}"]`).evaluate(element=>element.getBoundingClientRect().top-readerVisibleTop());
      expect(Math.abs(offset-anchor.offset)).toBeLessThan(2);
      await deepCompare(page);
      await plan.click();await planVisible(page);
      await expect(page.locator('#readerContent h2')).toHaveText('Genesis 24');
      await expect(page.locator('#verseSelect')).toHaveValue('');
      expect(await page.evaluate(()=>UserData.translation.load())).toBe('web');
    }
  });
});
