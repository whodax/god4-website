const {test,expect}=require('@playwright/test');
test.use({serviceWorkers:'block',hasTouch:true});

for(const width of [320,1280])for(const fullscreen of [false,true])for(const anchoring of ['auto','none'])for(const focused of [false,true])for(const alignment of ['fractional','exact']){
  test(`${width}px fullscreen=${fullscreen} anchoring=${anchoring} Chapter focus=${focused} alignment=${alignment}: chapter navigation cancels an outstanding smooth scroll`,async({page},info)=>{
    await page.setViewportSize({width,height:844});
    await page.emulateMedia({colorScheme:'dark',reducedMotion:'no-preference'});
    await page.addInitScript(()=>localStorage.setItem('god4.theme','dark'));
    await page.route('**/js/bible/translation-picker.js',route=>route.abort());
    await page.goto('/');await page.evaluate(()=>initializeBibleExperience());
    await page.evaluate(()=>document.fonts.ready);await page.locator('#readerMoreTrigger').click();
    await expect(page.locator('#readerSaveStatus')).toContainText('Native controls');
    if(fullscreen)await page.locator('#fullscreenBtn').click();
    await page.evaluate(()=>navigateReaderToPassage('john',1));
    await expect.poll(()=>page.evaluate(()=>Math.abs(document.querySelector('#readerContent h2').getBoundingClientRect().top-(readerVisibleTop()+16)))).toBeLessThan(2);
    if(alignment==='exact'){
      const correction=await page.evaluate(()=>readerVisibleTop()+16-document.querySelector('#readerContent h2').getBoundingClientRect().top);
      await page.addStyleTag({content:`#readerContent h2{transform:translateY(${correction}px)}`});
    }
    const result=await page.evaluate(async({fullscreen,anchoring,focused})=>{
      const view=document.getElementById('view-reader'),surface=fullscreen?view:window;
      document.documentElement.style.overflowAnchor=anchoring;view.style.overflowAnchor=anchoring;
      const select=document.getElementById('chapterSelect');
      if(focused)select.focus({preventScroll:true});else document.activeElement.blur();
      const toolbar=document.querySelector('.reader-toolbar'),toolbarHeight=toolbar.getBoundingClientRect().height;
      surface.scrollBy({top:80,behavior:'smooth'});
      for(const chapter of ['2','1']){select.value=chapter;select.dispatchEvent(new Event('change',{bubbles:true}));}
      const immediate=document.querySelector('#readerContent h2').getBoundingClientRect().top-(readerVisibleTop()+16);
      await new Promise(resolve=>{
        let previous=fullscreen?view.scrollTop:scrollY,stable=0;
        function frame(){
          const position=fullscreen?view.scrollTop:scrollY;
          stable=position===previous?stable+1:0;previous=position;
          if(stable>=8)resolve();else requestAnimationFrame(frame);
        }
        requestAnimationFrame(frame);
      });
      return {immediate,final:document.querySelector('#readerContent h2').getBoundingClientRect().top-(readerVisibleTop()+16),
        toolbarHeight,finalToolbarHeight:toolbar.getBoundingClientRect().height,focused:document.activeElement.id,
        anchoring:getComputedStyle(fullscreen?view:document.documentElement).overflowAnchor};
    },{fullscreen,anchoring,focused});
    await info.attach('chapter-scroll-geometry',{body:JSON.stringify(result),contentType:'application/json'});
    console.log('Chapter scroll cancellation',JSON.stringify({width,fullscreen,anchoring,focused,alignment,...result}));
    expect(Math.abs(result.immediate)).toBeLessThan(2);
    expect(Math.abs(result.final)).toBeLessThan(2);
    expect(result.finalToolbarHeight).toBe(result.toolbarHeight);
    if(focused)await expect(page.locator('#chapterSelect')).toBeFocused();
    await expect(page.locator('#readerReferenceText')).toHaveText('John 1');
    await expect(page.locator('#verseSelect')).toHaveValue('');
    await expect(page.locator('#readerContent .verse-focused')).toHaveCount(0);
  });
}

for(const width of [320,1280])for(const next of ['verse','tab','fullscreen'])test(`${width}px: pending chapter correction does not override a newer ${next} action`,async({page})=>{
  await page.setViewportSize({width,height:844});
  await page.emulateMedia({reducedMotion:'reduce'});
  await page.route('**/js/bible/translation-picker.js',route=>route.abort());
  await page.goto('/');await page.evaluate(()=>initializeBibleExperience());
  await page.evaluate(()=>document.fonts.ready);
  await page.locator('#readerMoreTrigger').click();
  await expect(page.locator('#readerSaveStatus')).toContainText('Native controls');
  const result=await page.evaluate(async next=>{
    const chapter=document.getElementById('chapterSelect');chapter.value='2';chapter.dispatchEvent(new Event('change',{bubbles:true}));
    if(next==='verse'){
      const verse=document.getElementById('verseSelect');verse.value='21';verse.dispatchEvent(new Event('change',{bubbles:true}));
    }else if(next==='tab')document.querySelector('.bs-btn[aria-controls="view-plan"]').click();
    else document.getElementById('fullscreenBtn').click();
    const view=document.getElementById('view-reader'),before={window:scrollY,reader:view.scrollTop};
    await new Promise(resolve=>requestAnimationFrame(()=>requestAnimationFrame(resolve)));
    return {before,after:{window:scrollY,reader:view.scrollTop},verse:currentVerse,fullscreen:view.classList.contains('reader-fullscreen'),active:view.classList.contains('active')};
  },next);
  expect(Math.abs(result.after.window-result.before.window)).toBeLessThan(2);
  expect(Math.abs(result.after.reader-result.before.reader)).toBeLessThan(2);
  if(next==='verse'){
    expect(result.verse).toBe(21);
    await expect(page.locator('#readerContent .verse-focused')).toHaveAttribute('data-verse-number','21');
    await expect(page.locator('#readerContent .verse-focused')).toBeFocused();
  }else if(next==='tab')expect(result.active).toBe(false);
  else expect(result.fullscreen).toBe(true);
});
