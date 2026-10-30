const {test,expect}=require('@playwright/test');
test.use({hasTouch:true,isMobile:true});
async function choose(page,id){await page.locator('#headerMenuTrigger').click();await page.locator('#headerMenu [data-destination="'+id+'"]').click();await expect(page.locator('#headerMenu')).not.toBeVisible();}
async function start(page,width=320,dark=false){
 await page.setViewportSize({width,height:844});
 await page.addInitScript(()=>{window.IntersectionObserver=class{observe(){}disconnect(){}};});
 page.errors=[];page.on('pageerror',e=>page.errors.push(e.message));
 await page.goto('/');if(dark)await page.locator('[data-theme-toggle]').click();await page.evaluate(()=>document.fonts.ready);
}
async function visible(page,selector){
 await expect.poll(()=>page.locator(selector).evaluate(e=>{const r=e.getBoundingClientRect(),v=visualViewport,nav=document.querySelector('body>nav').getBoundingClientRect();return r.top>=Math.max(nav.bottom,v.offsetTop)-1&&r.bottom<=v.offsetTop+v.height+1;})).toBe(true);
}
for(const width of [320,390,430])for(const dark of [false,true]){
 test(`${width}px dark=${dark}: centered wordmark, aligned artwork and established blue controls`,async({page})=>{
  await start(page,width,dark);
  const m=await page.evaluate(()=>{const rect=id=>document.getElementById(id).getBoundingClientRect().toJSON();return {word:rect('headerWordmark'),mark:rect('brandMark'),buttons:[document.querySelector('.theme-toggle'),document.querySelector('.saved-pill'),document.getElementById('accountTrigger'),document.getElementById('headerMenuTrigger')].map(e=>e.getBoundingClientRect().toJSON()),overflow:document.documentElement.scrollWidth>innerWidth};});
  expect(Math.abs(m.word.x+m.word.width/2-width/2)).toBeLessThanOrEqual(.5);expect(Math.abs(m.word.y+m.word.height/2-m.mark.y-m.mark.height/2)).toBeLessThanOrEqual(1);
  expect(m.mark.right).toBeLessThan(m.word.x);expect(m.word.x-m.mark.right).toBe(8);expect(m.mark.width).toBe(60);expect(m.mark.height).toBe(60);expect(m.mark.x).toBeGreaterThanOrEqual(0);
  expect(m.overflow).toBe(false);for(let i=0;i<4;i++){const b=m.buttons[i];expect(b.height).toBeGreaterThanOrEqual(44);expect(b.width).toBeGreaterThanOrEqual(44);expect(b.y).toBe(m.buttons[0].y);expect(b.y).toBeGreaterThan(m.mark.bottom);if(i)expect(b.x).toBeGreaterThanOrEqual(m.buttons[i-1].right);}
  for(const selector of ['#accountTrigger','#headerMenuTrigger','.hero-ctas a[href="#resources"]']){
   const colors=await page.locator(selector).evaluate(e=>{const c=getComputedStyle(e),b=getComputedStyle(document.querySelector('.hero-ctas .btn-primary'));return {background:c.backgroundColor,color:c.color,referenceBackground:b.backgroundColor,referenceColor:b.color,border:c.borderColor,referenceBorder:b.borderColor,shadow:c.boxShadow,referenceShadow:b.boxShadow};});
   expect(colors.background).toBe(colors.referenceBackground);expect(colors.color).toBe(colors.referenceColor);expect(colors.border).toBe(colors.referenceBorder);expect(colors.shadow).toBe(colors.referenceShadow);
  }
  await page.screenshot({path:test.info().outputPath(`header-${width}-${dark}.png`)});expect(page.errors).toEqual([]);
 });
 test(`${width}px dark=${dark}: Reader, study and audio destinations reach the actual controls`,async({page})=>{
  await start(page,width,dark);await choose(page,'reader');
  await expect(page.locator('#readerContent h2')).toBeVisible();
  await expect.poll(()=>page.evaluate(()=>Math.abs(document.querySelector('.reader-toolbar').getBoundingClientRect().top-readerStickyNavigation().getBoundingClientRect().bottom))).toBeLessThanOrEqual(2);
  await expect.poll(()=>page.evaluate(()=>Math.abs(document.querySelector('#readerContent h2').getBoundingClientRect().top-readerVisibleTop()-16))).toBeLessThan(2);
  await visible(page,'#readerContent h2');
  console.log('Reader destination geometry:',await page.evaluate(()=>({navBottom:document.querySelector('body>nav').getBoundingClientRect().bottom,tabsBottom:readerStickyNavigation().getBoundingClientRect().bottom,toolbarTop:document.querySelector('.reader-toolbar').getBoundingClientRect().top,chapterTop:document.querySelector('#readerContent h2').getBoundingClientRect().top})));
  await page.evaluate(()=>navigateReaderToPassage('john',1,16));
  const before=await page.evaluate(()=>({book:currentBook,chapter:currentChapter,verse:currentVerse,translation:currentTranslation}));
  await choose(page,'study');await expect(page.locator('#readerContent .verse-focused .word-study-token:focus')).toHaveCount(1);await expect(page.locator('#wordStudyPanel')).toBeHidden();
  await expect(page.locator('#readerTranslationStatus')).toContainText('Select a word in the current verse');
  await expect(page.locator('#readerContent .word-study-token:focus')).toHaveAttribute('aria-description',/Select a word/);await expect(page.locator('#readerContent .word-study-token:focus')).toHaveCSS('outline-style','solid');
  for(const [action,id] of [['aloud','readAloudPlay'],['commands','readerVoiceCommands']]){
   await page.evaluate(()=>document.activeElement.blur());
   await page.locator('#readerContent').dispatchEvent('pointerdown',{pointerType:'touch',isPrimary:true});await page.locator('#readerContent').dispatchEvent('pointerup',{pointerType:'touch',isPrimary:true});
   await page.evaluate(()=>new Promise(requestAnimationFrame));await page.locator('#readerContent').dispatchEvent('wheel',{deltaY:96});await page.evaluate(()=>window.scrollBy({top:96,behavior:'instant'}));
   await expect(page.locator('.reader-toolbar')).toHaveAttribute('inert','');await expect(page.locator('.reader-toolbar')).toHaveCSS('visibility','hidden');
   await choose(page,action);await expect(page.locator('#'+id)).toBeFocused();await visible(page,'#'+id);await expect(page.locator('#readerMoreTrigger')).toHaveAttribute('aria-expanded','true');}
  expect(await page.evaluate(()=>BibleSpeech.getState())).toBe('idle');await expect(page.locator('#readerVoiceCommands')).toHaveAttribute('aria-pressed','false');
  for(const [action,id] of [['voice','readAloudVoice'],['speed','readAloudSpeed']]){const current=await page.locator('#'+id).inputValue();await choose(page,action);await expect(page.locator('#readerOptionsPicker')).toBeVisible();await expect(page.locator('#readerOptionsPicker [aria-pressed="true"]')).toHaveAttribute('data-option-value',current);await page.keyboard.press('Escape');await expect(page.locator('[data-reader-select="'+id+'"]').first()).toBeFocused();}
  expect(await page.evaluate(()=>({book:currentBook,chapter:currentChapter,verse:currentVerse,translation:currentTranslation}))).toEqual(before);expect(page.errors).toEqual([]);
 });
 test(`${width}px dark=${dark}: Search follows the keyboard visual viewport without repeated jumps or stale corrections`,async({page})=>{
  await start(page,width,dark);await page.locator('#searchInput').fill('faith');await choose(page,'search');await expect(page.locator('#searchInput')).toBeFocused();
  await page.evaluate(()=>{Object.defineProperty(visualViewport,'height',{configurable:true,value:320});visualViewport.dispatchEvent(new Event('resize'));});
  await visible(page,'#searchInput');await expect(page.locator('#searchInput')).toHaveValue('faith');
  const y=await page.evaluate(()=>scrollY);
  await page.evaluate(async()=>{visualViewport.dispatchEvent(new Event('resize'));visualViewport.dispatchEvent(new Event('scroll'));await new Promise(requestAnimationFrame);await new Promise(requestAnimationFrame);});expect(await page.evaluate(()=>scrollY)).toBe(y);
  await page.evaluate(()=>{Object.defineProperty(visualViewport,'height',{configurable:true,value:180});visualViewport.dispatchEvent(new Event('resize'));});
  await expect.poll(()=>page.locator('#searchInput').evaluate(e=>Math.abs(e.getBoundingClientRect().top-document.querySelector('body>nav').getBoundingClientRect().bottom-8))).toBeLessThan(2);
  const tightY=await page.evaluate(()=>scrollY);await page.evaluate(async()=>{visualViewport.dispatchEvent(new Event('scroll'));await new Promise(requestAnimationFrame);await new Promise(requestAnimationFrame);});expect(await page.evaluate(()=>scrollY)).toBe(tightY);
  await page.locator('#headerMenuTrigger').focus();
  await page.evaluate(async()=>{window.scrollTo({top:0,behavior:'instant'});Object.defineProperty(visualViewport,'height',{configurable:true,value:250});visualViewport.dispatchEvent(new Event('resize'));await new Promise(requestAnimationFrame);await new Promise(requestAnimationFrame);});expect(await page.evaluate(()=>scrollY)).toBe(0);
  await page.locator('#headerMenuTrigger').click();await page.keyboard.press('Escape');await expect(page.locator('#headerMenuTrigger')).toBeFocused();
  await page.evaluate(()=>{delete visualViewport.height;});await choose(page,'resources');await visible(page,'#resources h2');expect(page.errors).toEqual([]);
 });
}

for(const width of [320,1280])test(`${width}px: failed optional compact runtime keeps Reader and audio controls usable`,async({page})=>{
 await start(page,width);await page.route('**/js/bible/translation-picker.js',r=>r.abort());
 await choose(page,'reader');await expect(page.locator('#readerContent h2')).toBeVisible();
 for(const [action,id] of [['aloud','readAloudPlay'],['commands','readerVoiceCommands']]){await choose(page,action);await expect(page.locator('#'+id)).toBeVisible();await expect(page.locator('#'+id)).toBeFocused();}
 expect(await page.evaluate(()=>BibleSpeech.getState())).toBe('idle');await expect(page.locator('#readerVoiceCommands')).toHaveAttribute('aria-pressed','false');expect(page.errors).toEqual([]);
});
