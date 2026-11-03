const {test,expect}=require('@playwright/test');

test.use({hasTouch:true,isMobile:true});
async function open(page,width,dark){
 await page.setViewportSize({width,height:844});
 await page.addInitScript(()=>{window.IntersectionObserver=class{observe(){}disconnect(){}};});
 await page.goto('/');if(dark)await page.locator('[data-theme-toggle]').tap();
 await page.evaluate(()=>document.fonts.ready);
}
async function reader(page){
 await page.locator('#headerMenuTrigger').tap();
 await page.locator('#headerMenu [data-destination="reader"]').tap();
 await expect(page.locator('#headerMenu')).not.toBeVisible();
}
async function geometry(page){return page.evaluate(()=>{
 const heading=document.querySelector('#readerContent h2').getBoundingClientRect();
 const tabs=readerStickyNavigation().getBoundingClientRect(),toolbar=document.querySelector('.reader-toolbar').getBoundingClientRect();
 return {scroll:scrollY,heading:heading.top,visibleTop:readerVisibleTop(),delta:heading.top-readerVisibleTop()-16,tabsHeight:tabs.height,toolbarHeight:toolbar.height};
});}
async function stableChapter(page){
 await expect(page.locator('#readerContent h2')).toBeVisible();
 await expect.poll(async()=>Math.abs((await geometry(page)).delta)).toBeLessThan(2);
 // Responsive composition must not animate the dimensions used by sticky positioning.
 const paint=['background-color','color','border-top-color','border-right-color','border-bottom-color','border-left-color','box-shadow','outline-color'];
 const layout=await page.locator('.bs-nav').evaluate((e,paint)=>e.getAnimations({subtree:true}).filter(a=>a.playState==='running'&&!paint.includes(a.transitionProperty)).map(a=>a.transitionProperty),paint);
 expect(layout,'Navigation must not animate font size, spacing or padding during chapter positioning').toEqual([]);
 const before=await geometry(page);
 await page.evaluate(async()=>{
  await document.fonts.ready;
  await Promise.all(document.getElementById('bibleApp').getAnimations({subtree:true}).map(a=>a.finished.catch(()=>{})));
  await new Promise(resolve=>requestAnimationFrame(()=>requestAnimationFrame(resolve)));
 });
 const after=await geometry(page);
 expect(Math.abs(after.delta)).toBeLessThan(2);
 expect(after.tabsHeight).toBe(before.tabsHeight);expect(after.toolbarHeight).toBe(before.toolbarHeight);expect(after.scroll).toBe(before.scroll);
 console.log('Stable Reader chapter geometry',JSON.stringify(after));
}
for(const width of [320,390,430,1280])for(const dark of [false,true])test(`${width}px dark=${dark}: cold menu Reader navigation has stable sticky geometry`,async({page})=>{
 await open(page,width,dark);await reader(page);await stableChapter(page);
 await expect(page.locator('#readerMoreTrigger')).toHaveAttribute('aria-expanded','false');
 expect(await page.evaluate(()=>BibleSpeech.getState())).toBe('idle');
 await expect(page.locator('#readerVoiceCommands')).toHaveAttribute('aria-pressed','false');
});
for(const dark of [false,true])test(`dark=${dark}: responsive reflow and repeated Reader destinations preserve chapter position`,async({page})=>{
 await open(page,1280,dark);await reader(page);await stableChapter(page);
 for(const width of [430,390,320,1280]){
  await page.setViewportSize({width,height:844});
  await expect(page.locator('.reader-toolbar')).toHaveClass(width<=620?/reader-compact-mobile/:/^(?!.*reader-compact-mobile).*$/);
  await page.locator('#headerMenuTrigger').tap();await page.locator('#headerMenu [data-destination="featured"]').tap();
  await expect(page.locator('#headerMenu')).not.toBeVisible();
  await reader(page);await stableChapter(page);
 }
});
