const {test,expect}=require('@playwright/test');

test.use({contextOptions:{reducedMotion:'reduce'},serviceWorkers:'block'});

const passages=[['web','john',1,'grc'],['kjv','isaiah',1,'he'],['kjv','isaiah',64,'he'],['dra','isaiah',1,'he']];

async function geometry(page){
  return page.evaluate(()=>{
    const context=document.getElementById('wordStudyContext'),header=document.querySelector('.word-study-header');
    const contextBounds=context.getBoundingClientRect(),headerBounds=header.getBoundingClientRect();
    const top=Math.max(readerVisibleTop(),getComputedStyle(header).position==='sticky'?headerBounds.bottom:0);
    const tokens=Array.from(document.querySelectorAll('#wordStudyOriginalTokens button'),button=>{
      const bounds=button.getBoundingClientRect();
      const points=[[bounds.left+2,bounds.top+2],[bounds.right-2,bounds.top+2],[bounds.left+2,bounds.bottom-2],[bounds.right-2,bounds.bottom-2]];
      return {top:bounds.top,bottom:bounds.bottom,contextGap:bounds.top-contextBounds.bottom,
        visible:bounds.top>=top+4&&bounds.bottom<=innerHeight-4,
        hit:points.every(([left,above])=>button.contains(document.elementFromPoint(left,above)))};
    });
    const reader=document.getElementById('view-reader');
    return {contextPosition:getComputedStyle(context).position,contextBottom:contextBounds.bottom,top,tokens,
      panelOverflow:document.getElementById('wordStudyPanel').scrollWidth>document.getElementById('wordStudyPanel').clientWidth,
      documentOverflow:document.documentElement.scrollWidth>innerWidth,scrollY,readerScroll:reader.scrollTop};
  });
}

for(const width of [1280,390,320])for(const fullscreen of [false,true]){
  test.describe(`${width}px ${fullscreen?'fullscreen':'normal'}`,()=>{
    test.use({viewport:{width,height:900},hasTouch:width!==1280});
    for(const [translationId,bookId,chapter,language]of passages){
      test(`${translationId} ${bookId} ${chapter}:1 unfocused rows never pass behind verse context`,async({page},info)=>{
        const errors=[];page.on('pageerror',error=>errors.push(error.message));
        await page.goto('/');
        expect(await page.evaluate(()=>matchMedia('(prefers-reduced-motion: reduce)').matches)).toBe(true);
        await page.evaluate(async context=>{
          await initializeBibleExperience();await changeTranslation(context.translationId);
          await navigateReaderToPassage(context.bookId,context.chapter,1);await WordStudyLoader.ensure();await document.fonts.ready;
        },{translationId,bookId,chapter});
        if(fullscreen)await page.locator('#fullscreenBtn').click();
        const word=page.locator('#readerContent [data-verse-number="1"] [data-word-study-term]').first();
        const excerpt=await word.evaluate(element=>element.closest('.reader-verse').getAttribute('data-verse-text'));
        await word.press('Enter');
        const tokens=page.locator('#wordStudyOriginalTokens button');
        await expect(tokens.first()).toHaveAttribute('lang',language);
        await expect(page.locator('#wordStudyPanel')).not.toHaveAttribute('data-word-study-state','loading');
        await page.evaluate(()=>document.fonts.ready.then(()=>true));
        await page.locator('#wordStudyHeading').focus();
        const snapshots=[];
        for(const clearance of [8,24,48]){
          await page.evaluate(clearance=>{
            const token=document.querySelector('#wordStudyOriginalTokens button'),reader=document.getElementById('view-reader');
            const header=document.querySelector('.word-study-header');
            const top=readerVisibleTop()+header.getBoundingClientRect().height+clearance;
            (reader.classList.contains('reader-fullscreen')?reader:window).scrollBy({top:token.getBoundingClientRect().top-top,behavior:'instant'});
          },clearance);
          await page.evaluate(()=>new Promise(requestAnimationFrame));
          const measured=await geometry(page);snapshots.push(measured);
          console.log('Unfocused scroll geometry',JSON.stringify({width,fullscreen,translationId,bookId,chapter,clearance,...measured}));
          expect(measured.tokens[0].contextGap).toBeGreaterThanOrEqual(4);
          expect(measured.tokens[0].visible).toBe(true);
          expect(measured.tokens.filter(token=>token.visible).every(token=>token.hit)).toBe(true);
          expect(measured.panelOverflow).toBe(false);expect(measured.documentOverflow).toBe(false);
          await expect(page.locator('#wordStudyHeading')).toBeFocused();
        }
        await info.attach('unfocused-scroll-geometry',{body:JSON.stringify(snapshots),contentType:'application/json'});
        await expect(page.locator('#wordStudyVerse')).toHaveText(excerpt);
        await expect(page.locator('#wordStudyPanel #wordStudyContext #wordStudyVerse')).toHaveCount(1);
        await page.locator('#wordStudyClose').focus();await page.keyboard.press('Tab');
        await expect(tokens.first()).toBeFocused();await page.keyboard.press('Enter');
        await expect(page.locator('#wordStudyOriginalDetails')).toBeVisible();
        await tokens.last().evaluate(element=>element.focus({preventScroll:true}));await page.keyboard.press('Space');
        await expect(tokens.last()).toHaveAttribute('aria-pressed','true');
        await expect.poll(async()=>{const measured=await geometry(page);return measured.tokens.at(-1).visible&&measured.tokens.at(-1).hit;}).toBe(true);
        await page.screenshot({path:info.outputPath('unfocused-scroll.png')});
        await page.keyboard.press('Escape');await expect(word).toBeFocused();
        await expect(page.locator('#wordStudyPanel')).toBeHidden();expect(errors).toEqual([]);
      });
    }
  });
}
