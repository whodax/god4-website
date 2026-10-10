const {test, expect} = require('@playwright/test');

async function geometry(page){
  return page.evaluate(()=>{
    const rect=el=>{const r=el.getBoundingClientRect();return {top:r.top,bottom:r.bottom,left:r.left,right:r.right,height:r.height,width:r.width};};
    const panel=document.getElementById('wordStudyPanel'),header=panel.querySelector('.word-study-header');
    const close=document.getElementById('wordStudyClose'),reader=document.getElementById('view-reader');
    const fullscreen=reader.classList.contains('reader-fullscreen');
    const toolbar=rect(reader.querySelector('.reader-toolbar'));
    const layers=fullscreen?[toolbar]:[toolbar,...['nav','#bibleApp .bs-nav'].map(s=>document.querySelector(s)).filter(e=>getComputedStyle(e).position==='sticky').map(rect)];
    const c=rect(close),hit=document.elementFromPoint((c.left+c.right)/2,(c.top+c.bottom)/2);
    return {panel:rect(panel),header:rect(header),heading:rect(document.getElementById('wordStudyHeading')),close:c,
      stack:Math.max(...layers.map(r=>r.bottom)),hit:!!hit && close.contains(hit),panelScroll:panel.scrollTop,
      overflow:getComputedStyle(panel).overflowY,docWidth:document.documentElement.scrollWidth,
      background:getComputedStyle(header).backgroundColor,surface:getComputedStyle(panel).backgroundColor,
      z:getComputedStyle(header).zIndex,toolbarZ:getComputedStyle(reader.querySelector('.reader-toolbar')).zIndex,
      active:document.activeElement.id,y:scrollY,readerScroll:reader.scrollTop};
  });
}
async function scrollPanel(page, mode){
  await page.evaluate(mode=>{
    const panel=document.getElementById('wordStudyPanel'),reader=document.getElementById('view-reader');
    const header=panel.querySelector('.word-study-header'),r=panel.getBoundingClientRect();
    const travel=Math.min(600,r.height-header.getBoundingClientRect().height-80);
    const target=mode==='start'?r.top-readerVisibleTop()-16:mode==='within'?r.top-readerVisibleTop()+travel:
      mode==='boundary'?r.bottom-readerVisibleTop()-header.getBoundingClientRect().height/2:
      r.bottom-readerVisibleTop()+30;
    (reader.classList.contains('reader-fullscreen')?reader:window).scrollBy({top:target,behavior:'instant'});
  },mode);
}
async function openResult(page, state){
  await page.evaluate(state=>{
    if(state==='english') OriginalLanguageWordStudyProvider.lookupVerse=()=>Promise.resolve({status:'unavailable'});
    if(state==='loading') WordStudyProvider.lookup=()=>new Promise(resolve=>{window.finishStudy=resolve;});
    if(state==='unavailable') WordStudyProvider.lookup=()=>Promise.resolve({status:'unavailable',message:'Definition not available yet.'});
    if(state==='error') WordStudyProvider.lookup=()=>Promise.reject(new Error('Controlled lookup failure'));
  },state);
  const word=page.locator(`[data-word-study-term="${state==='long'?'upon':'beginning'}"]`).first();
  await word.click();
  if(state!=='loading') await expect(page.locator('#wordStudyPanel')).not.toHaveAttribute('data-word-study-state','loading');
  if(['original','long'].includes(state)){
    await expect(page.locator('#wordStudyOriginalLanguage')).toBeVisible();
    await page.locator('.word-study-original-token').first().click();
  }
  return word;
}

for(const [name,width,fullscreen] of [['desktop',1280,false],['mobile',390,false],['reflow',320,false],['fullscreen desktop',1280,true],['fullscreen mobile',390,true]]){
  test.describe(name,()=>{
    test.use({viewport:{width,height:width===1280?900:844},hasTouch:width!==1280,reducedMotion:'reduce'});
    test.beforeEach(async({page})=>{
      page.errors=[];page.on('pageerror',e=>page.errors.push(e.message));
      await page.goto('/');
      await page.evaluate(async()=>{await initializeBibleExperience();await changeTranslation('web');await navigateReaderToPassage('john',1);await document.fonts.ready;});
      if(fullscreen) await page.locator('#fullscreenBtn').click();
    });
    test.afterEach(async({page})=>expect(page.errors).toEqual([]));
    for(const state of ['english','original','long','loading','unavailable','error']){
      test(`${state} keeps the single Close reachable within the panel`,async({page},testInfo)=>{
        const word=await openResult(page,state);
        await page.locator('#wordStudyHeading').focus();
        await expect(page.locator('#wordStudyHeading')).toBeFocused();
        await scrollPanel(page,'start');
        const before=await geometry(page);
        await scrollPanel(page,'within');
        const g=await geometry(page);
        expect(g.header.top).toBeGreaterThanOrEqual(g.stack-1);
        expect(g.header.top).toBeLessThanOrEqual(g.stack+1);
        expect(g.close.bottom).toBeLessThan(width===1280?900:844);
        expect(g.hit).toBe(true);expect(g.close.height).toBeGreaterThanOrEqual(44);expect(g.close.width).toBeGreaterThanOrEqual(44);
        expect(g.header.bottom).toBeLessThan(g.panel.bottom);
        expect(g.panelScroll).toBe(0);expect(g.overflow).toBe('visible');
        expect(g.docWidth).toBeLessThanOrEqual(width);expect(g.background).toBe(g.surface);
        expect(+g.z).toBeLessThan(+g.toolbarZ);expect(g.active).toBe(before.active);
        if(fullscreen){expect(g.y).toBe(before.y);expect(g.readerScroll).toBeGreaterThan(before.readerScroll);}
        else expect(g.y).toBeGreaterThan(before.y);
        const close=page.getByRole('button',{name:'Close Word Study',exact:true});
        await expect(close).toHaveCount(1);
        await page.keyboard.press('Tab');await expect(close).toBeFocused();
        expect(await close.evaluate(e=>e.matches(':focus-visible'))).toBe(true);
        await expect(close).toHaveCSS('outline-style','solid');
        const focused=await geometry(page);
        expect(focused.close.top-5).toBeGreaterThan(focused.stack);
        expect(focused.heading.right).toBeLessThan(focused.close.left);
        if(state==='long') expect(await page.locator('#wordStudyDefinition').textContent()).toHaveLength(1425);
        if(state==='long') await page.screenshot({path:testInfo.outputPath('word-study.png')});
        if(width===1280) await close.click();else await close.tap();
        await expect(page.locator('#wordStudyPanel')).toBeHidden();await expect(word).toBeFocused();
        if(fullscreen) await expect(page.locator('#view-reader')).toHaveClass(/reader-fullscreen/);
      });
    }
    test('long result honors content clearance and stops at the panel bottom',async({page})=>{
      await openResult(page,'long');
      await scrollPanel(page,'within');
      const token=page.locator('.word-study-original-token').last();
      await token.evaluate(e=>e.scrollIntoView({block:'start',behavior:'instant'}));
      const g=await geometry(page);
      const tokenTop=await token.evaluate(e=>e.getBoundingClientRect().top);
      expect(tokenTop).toBeGreaterThanOrEqual(g.header.bottom+3);
      await scrollPanel(page,'boundary');
      const boundary=await geometry(page);
      expect(boundary.header.top).toBeLessThan(boundary.stack);
      expect(boundary.header.bottom).toBeLessThanOrEqual(boundary.panel.bottom+1);
      await scrollPanel(page,'beyond');
      const beyond=await geometry(page);
      expect(beyond.panel.bottom).toBeLessThan(beyond.stack);
      expect(beyond.header.bottom).toBeLessThan(beyond.stack);
      expect(beyond.hit).toBe(false);
    });
    test('Escape and disconnected activating words remain safe',async({page})=>{
      const word=await openResult(page,'long');await scrollPanel(page,'within');
      await page.keyboard.press('Escape');await expect(page.locator('#wordStudyPanel')).toBeHidden();await expect(word).toBeFocused();
      await word.click();await expect(page.locator('#wordStudyPanel')).not.toHaveAttribute('data-word-study-state','loading');
      await word.evaluate(e=>{window.detachedStudyWord=e;e.remove();e.focus=()=>{throw new Error('Detached word focused');};});
      await page.locator('#wordStudyHeading').press('Escape');await expect(page.locator('#wordStudyPanel')).toBeHidden();
    });
  });
}
