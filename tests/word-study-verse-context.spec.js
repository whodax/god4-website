const {test,expect}=require('@playwright/test');
test.use({contextOptions:{reducedMotion:'reduce'}});

test.afterEach(async({page},info)=>{
  if(info.status!==info.expectedStatus){
    console.log('Verse context geometry:',JSON.stringify(await position(page)));
    await page.screenshot({path:info.outputPath('verse-context-failure.png')});
  }
});

async function position(page){
  return page.evaluate(()=>{
    const rect=id=>{const r=document.getElementById(id).getBoundingClientRect();return {top:r.top,bottom:r.bottom};};
    const tokens=document.querySelectorAll('#wordStudyOriginalTokens button');
    const token=tokens[tokens.length-1].getBoundingClientRect();
    return {verse:rect('wordStudyVerse'),header:document.querySelector('.word-study-header').getBoundingClientRect().bottom,
      token:{top:token.top,bottom:token.bottom},height:innerHeight,top:readerVisibleTop(),
      y:scrollY,reader:document.getElementById('view-reader').scrollTop,width:document.documentElement.scrollWidth,
      margin:getComputedStyle(tokens[tokens.length-1]).scrollMarginTop,
      inset:getComputedStyle(document.getElementById('wordStudyPanel')).getPropertyValue('--word-study-verse-height')};
  });
}

for(const [mode,width,fullscreen] of [['desktop',1280,false],['fullscreen desktop',1280,true],['mobile',390,false],['fullscreen mobile',390,true],['narrow',320,false]]){
  for(const [book,chapter,verse,lang] of [['isaiah',53,5,'he'],['john',1,1,'grc']]){
    test(`${mode}: ${book} keeps the selected verse with original tokens and late definitions do not move focus or scroll`,async({page},testInfo)=>{
      await page.setViewportSize({width,height:844});
      await page.goto('/');
      await page.evaluate(async({book,chapter,verse})=>{
        await initializeBibleExperience();await changeTranslation('kjv');
        await navigateReaderToPassage(book,chapter,verse);await WordStudyLoader.ensure();await document.fonts.ready;
        WordStudyProvider.lookup=()=>new Promise(resolve=>window.finishContextDefinition=resolve);
      },{book,chapter,verse});
      if(fullscreen) await page.locator('#fullscreenBtn').click();
      const word=page.locator(`#readerContent [data-verse-number="${verse}"] [data-word-study-term]`).first();
      const expected=await word.evaluate(e=>e.closest('.reader-verse').getAttribute('data-verse-text'));
      await word.press('Enter');
      await expect(page.locator('#wordStudyHeading')).toBeFocused();
      await expect(page.locator('#wordStudyVerse')).toHaveText(expected);
      await expect(page.locator('html')).toHaveCSS('overflow-anchor','none');
      const tokens=page.locator('#wordStudyOriginalTokens button');
      await expect(tokens.first()).toHaveAttribute('lang',lang);
      await expect.poll(()=>page.evaluate(()=>{
        const verse=document.getElementById('wordStudyVerse').getBoundingClientRect();
        const first=document.querySelector('#wordStudyOriginalTokens button').getBoundingClientRect();
        return verse.top>=readerVisibleTop() && verse.bottom<=first.top && first.bottom<=innerHeight;
      })).toBe(true);
      await tokens.last().evaluate(e=>e.scrollIntoView({block:'start',behavior:'instant'}));
      await tokens.last().press('Enter');
      await expect(page.locator('#wordStudyOriginalDetails')).toBeVisible();
      await page.evaluate(()=>document.fonts.ready);
      await page.evaluate(async()=>{await new Promise(requestAnimationFrame);await new Promise(requestAnimationFrame);});
      await expect.poll(async()=>{
        const g=await position(page);
        return g.verse.bottom<=g.token.top && g.token.top>=Math.max(g.header,g.top)+4 && g.token.bottom<=g.height;
      }).toBe(true);
      await expect(page.locator('#wordStudyPanel #wordStudyContext #wordStudyVerse')).toHaveText(expected);
      await expect(page.locator('#wordStudyContext')).toHaveCSS('position','static');
      const before=await position(page);
      expect(before.width).toBeLessThanOrEqual(width);
      await page.evaluate(()=>finishContextDefinition({status:'available',definition:'A long English definition. '.repeat(160)}));
      await expect(page.locator('#wordStudyPanel')).toHaveAttribute('data-word-study-state','available');
      await expect(tokens.last()).toBeFocused();
      const after=await position(page);
      // The fixed fullscreen Reader owns scrolling; the document behind it is inert.
      expect(fullscreen?after.reader:after.y).toBe(fullscreen?before.reader:before.y);
      expect(after.verse).toEqual(before.verse);expect(after.token).toEqual(before.token);
      await page.screenshot({path:testInfo.outputPath('verse-and-study.png')});
      await page.keyboard.press('Escape');
      await expect(page.locator('#wordStudyPanel')).toBeHidden();await expect(word).toBeFocused();
      await expect(page.locator('html')).toHaveCSS('overflow-anchor','auto');
    });
  }
}
