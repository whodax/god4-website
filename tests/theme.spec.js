const {test,expect}=require('@playwright/test');
const fs=require('node:fs');
const {execFileSync}=require('node:child_process');
const baseline='42e9cdaa3dbaef221b05760173c0f7237ddc4d7d';
test.use({hasTouch:true,serviceWorkers:'block'});
const toggle=page=>page.locator('[data-theme-toggle]');
async function dark(page){await toggle(page).click();await expect(page.locator('html')).toHaveAttribute('data-theme','dark');}
async function reader(page){
  await page.evaluate(()=>initializeBibleExperience());await page.evaluate(()=>ReaderTranslationLoader.ensure());
  await page.evaluate(()=>document.fonts.ready);await page.emulateMedia({reducedMotion:'reduce'});
}
async function position(page){return page.evaluate(()=>({page:scrollY,reader:document.getElementById('view-reader').scrollTop,verse:document.querySelector('#readerContent [data-verse-number="12"]').getBoundingClientRect().top,translation:currentTranslation,book:currentBook,chapter:currentChapter,selected:currentVerse,spoken:currentSpokenVerse,fullscreen:document.getElementById('view-reader').classList.contains('reader-fullscreen')}));}
async function speech(page,cloud=false){
  await page.addInitScript(cloud=>{
    window.__themeSpeech={utterances:[],sources:[],cancels:0};
    Object.defineProperty(window,'SpeechSynthesisUtterance',{configurable:true,value:function(text){this.text=text;}});
    Object.defineProperty(window,'speechSynthesis',{configurable:true,value:{getVoices(){return[{name:'Microsoft David',lang:'en-US',localService:true}];},addEventListener(){},speak(utterance){window.__themeSpeech.utterances.push(utterance);utterance.onstart?.();},pause(){},resume(){},cancel(){window.__themeSpeech.cancels++;}}});
    class Context{constructor(){this.state='running';this.destination={};}resume(){return Promise.resolve();}suspend(){return Promise.resolve();}decodeAudioData(){return Promise.resolve({duration:30});}createBufferSource(){const source={connect(){},disconnect(){},start(){},stop(){}};window.__themeSpeech.sources.push(source);return source;}}
    Object.defineProperty(window,'AudioContext',{configurable:true,value:cloud?Context:undefined});
    Object.defineProperty(window,'webkitAudioContext',{configurable:true,value:undefined});
  },cloud);
  await page.route('**/api/tts',route=>route.fulfill({contentType:'audio/mpeg',body:'audio'}));
}

for(const width of [320,360,390,430,1280])for(const system of ['light','dark'])test(`${width}px system ${system}: default light, adjacent 44px toggle, keyboard and theme geometry`,async({page},info)=>{
  await page.setViewportSize({width,height:900});await page.emulateMedia({colorScheme:system,reducedMotion:'reduce'});await page.goto('/');
  await expect(page.locator('html')).toHaveAttribute('data-theme','light');
  await expect(toggle(page)).toHaveAccessibleName('Switch to Dark Mode');
  const bounds=await toggle(page).boundingBox(),saved=await page.locator('.saved-pill').boundingBox();
  expect(bounds.width).toBeGreaterThanOrEqual(44);expect(bounds.height).toBeGreaterThanOrEqual(44);
  expect(bounds.x+bounds.width).toBeLessThanOrEqual(saved.x);expect(Math.abs(bounds.y+bounds.height/2-saved.y-saved.height/2)).toBeLessThan(1);
  await expect(page.locator('.theme-moon')).toBeVisible();await expect(page.locator('.theme-sun')).toBeHidden();
  await reader(page);
  const light=await page.locator('#readerContent').evaluate(node=>{const style=getComputedStyle(node),box=node.getBoundingClientRect();return{font:style.font,line:style.lineHeight,width:box.width,height:box.height};});
  await page.screenshot({path:info.outputPath('light-home.png')});
  await toggle(page).focus();await page.keyboard.press('Enter');
  await expect(toggle(page)).toHaveAccessibleName('Switch to Light Mode');await expect(toggle(page)).toHaveAttribute('aria-pressed','true');await expect(toggle(page)).toBeFocused();
  await expect(page.locator('.theme-sun')).toBeVisible();await expect(page.locator('.theme-moon')).toBeHidden();
  await expect(page.locator('body')).toHaveCSS('color','rgb(240, 232, 214)');
  expect(await page.locator('#readerContent').evaluate(node=>{const style=getComputedStyle(node),box=node.getBoundingClientRect();return{font:style.font,line:style.lineHeight,width:box.width,height:box.height};})).toEqual(light);
  expect(await page.evaluate(()=>document.documentElement.scrollWidth<=innerWidth)).toBe(true);
  await page.screenshot({path:info.outputPath('dark-home.png')});
  await page.keyboard.press('Space');await expect(toggle(page)).toHaveAccessibleName('Switch to Dark Mode');
  await expect(page.locator('html')).toHaveAttribute('data-theme','light');
});

test('returning dark preference applies before CSS/body paint, persists and synchronizes tabs and clearing',async({page,context})=>{
  await page.goto('/');await dark(page);const second=await context.newPage();
  let release;const blocked=new Promise(resolve=>release=resolve);
  await second.route('**/css/variables.css',async route=>{await blocked;await route.continue();});
  await second.route('**/js/theme.js',async route=>{const response=await route.fetch();await route.fulfill({response,body:await response.text()+';window.__themeBoot={theme:document.documentElement.dataset.theme,body:document.body!==null,paint:performance.getEntriesByType("paint").length};'});});
  await second.goto('/',{waitUntil:'commit'});
  try{await second.waitForFunction(()=>window.__themeBoot,null,{polling:50});expect(await second.evaluate(()=>window.__themeBoot)).toEqual({theme:'dark',body:false,paint:0});}finally{release();}
  await second.waitForLoadState();await expect(toggle(second)).toHaveAccessibleName('Switch to Light Mode');
  await toggle(second).click();await expect(page.locator('html')).toHaveAttribute('data-theme','light');
  await dark(page);await page.reload();await expect(page.locator('html')).toHaveAttribute('data-theme','dark');
  await second.evaluate(()=>localStorage.clear());await expect(page.locator('html')).toHaveAttribute('data-theme','light');
  await second.close();
});

test('blocked storage, invalid preferences and unrelated storage events are safe',async({page})=>{
  const errors=[];page.on('pageerror',error=>errors.push(error.message));
  await page.addInitScript(()=>{Storage.prototype.getItem=function(){throw Error('blocked');};Storage.prototype.setItem=function(){throw Error('blocked');};});
  await page.goto('/');await dark(page);await toggle(page).click();
  await expect(page.locator('html')).toHaveAttribute('data-theme','light');expect(errors).toEqual([]);
  await page.evaluate(()=>dispatchEvent(new StorageEvent('storage',{key:'god4.theme',newValue:'dark',storageArea:sessionStorage})));
  await expect(page.locator('html')).toHaveAttribute('data-theme','light');
});

test('invalid stored values default to light without altering other local data',async({page})=>{
  await page.addInitScript(()=>{localStorage.setItem('god4.theme','midnight');localStorage.setItem('unrelated-marker','preserved');});
  await page.goto('/');await expect(page.locator('html')).toHaveAttribute('data-theme','light');await dark(page);
  expect(await page.evaluate(()=>localStorage.getItem('unrelated-marker'))).toBe('preserved');
});

test('delayed unrelated scripts cannot leave the parsed theme button mislabeled',async({page})=>{
  await page.addInitScript(()=>localStorage.setItem('god4.theme','dark'));
  let release;const blocked=new Promise(resolve=>release=resolve);
  await page.route('**/js/bible/library.js',async route=>{await blocked;await route.continue();});
  await page.goto('/',{waitUntil:'commit'});
  try{await expect(toggle(page)).toHaveAccessibleName('Switch to Light Mode');await toggle(page).click();await expect(toggle(page)).toHaveAccessibleName('Switch to Dark Mode');}finally{release();}
  await page.waitForLoadState();await expect(page.locator('html')).toHaveAttribute('data-theme','light');
});

test('a queued stale cross-tab event cannot override the latest stored choice',async({page})=>{
  await page.goto('/');await dark(page);
  await page.evaluate(()=>dispatchEvent(new StorageEvent('storage',{key:'god4.theme',newValue:'light',storageArea:localStorage})));
  await expect(page.locator('html')).toHaveAttribute('data-theme','dark');
});

for(const mode of ['light','dark'])test(`${mode}: native mobile fallback uses the chosen scheme when optional pickers fail`,async({page})=>{
  await page.setViewportSize({width:320,height:900});await page.emulateMedia({colorScheme:mode==='dark'?'light':'dark'});
  await page.addInitScript(mode=>localStorage.setItem('god4.theme',mode),mode);
  await page.route('**/js/bible/translation-picker.js',route=>route.abort());
  await page.goto('/');await page.evaluate(()=>initializeBibleExperience());await page.locator('#readerMoreTrigger').tap();
  await expect(page.locator('#bookSelect')).toBeVisible();
  for(const id of ['bookSelect','chapterSelect','verseSelect','readAloudVoice','readAloudSpeed'])await expect(page.locator('#'+id)).toHaveCSS('color-scheme',mode);
  await expect(page.locator('#readerTranslation')).toBeVisible();await expect(page.locator('#readerTranslation')).toHaveCSS('color-scheme',mode);
  expect(await page.evaluate(()=>document.documentElement.scrollWidth<=innerWidth)).toBe(true);
});

for(const width of [320,360,390,430])for(const fullscreen of [false,true])test(`${width}px fullscreen=${fullscreen}: theme changes preserve hidden controls, position, selection and enlarged text`,async({page,context})=>{
  await page.setViewportSize({width,height:900});await page.goto('/');await reader(page);
  const second=await context.newPage();await second.goto('/');await page.bringToFront();
  await page.evaluate(()=>document.getElementById('view-reader').scrollIntoView({block:'start',behavior:'instant'}));
  if(fullscreen)await page.locator('#fullscreenBtn').tap();
  await page.locator('#readerMoreTrigger').tap();
  await page.locator('#readerContent [data-verse-number="12"]').scrollIntoViewIfNeeded();
  await page.locator('#readerContent').dispatchEvent('wheel',{deltaY:96});
  await page.evaluate(()=>{const view=document.getElementById('view-reader');(view.classList.contains('reader-fullscreen')?view:window).scrollBy({top:96,behavior:'instant'});});
  const recovery=page.getByRole('button',{name:'Show Reader controls',exact:true});await expect(recovery).toBeVisible();
  const before=await position(page);await dark(second);await expect(page.locator('html')).toHaveAttribute('data-theme','dark');expect(await position(page)).toEqual(before);
  await recovery.tap();expect(await position(page)).toEqual(before);await expect(page.locator('#readerMoreTrigger')).toHaveText('Hide Options');
  const rows=await page.locator('#readerSecondaryControls').evaluate(node=>getComputedStyle(node).gridTemplateRows.split(' ').length);expect(rows).toBe(4);
  await page.addStyleTag({content:'.header-actions button,.reader-option-trigger{font-size:20px!important;}'});
  expect(await page.evaluate(()=>document.documentElement.scrollWidth<=innerWidth)).toBe(true);
  if(fullscreen){await page.locator('#fullscreenBtn').tap();await expect(toggle(page)).not.toHaveAttribute('inert','');}
  await second.close();
});

for(const cloud of [false,true])test(`theme changes do not interrupt ${cloud?'cloud':'native'} speech, repeat or pause`,async({page,context})=>{
  await speech(page,cloud);await page.setViewportSize({width:390,height:900});await page.goto('/');await reader(page);
  await page.locator('#view-reader').scrollIntoViewIfNeeded();await page.locator('#readAloudPlay').tap();
  await expect.poll(()=>page.evaluate(()=>BibleSpeech.getState())).toBe('playing');
  await expect(page.getByRole('button',{name:'Show Reader controls',exact:true})).toBeVisible();
  const second=await context.newPage();await second.goto('/');const before=await position(page);
  const counters=await page.evaluate(()=>({cancels:__themeSpeech.cancels,utterances:__themeSpeech.utterances.length,sources:__themeSpeech.sources.length}));
  await dark(second);await expect(page.locator('html')).toHaveAttribute('data-theme','dark');expect(await position(page)).toEqual(before);
  expect(await page.evaluate(()=>({cancels:__themeSpeech.cancels,utterances:__themeSpeech.utterances.length,sources:__themeSpeech.sources.length}))).toEqual(counters);
  expect(await page.evaluate(()=>BibleSpeech.getState())).toBe('playing');
  await page.evaluate(()=>pauseReader());await expect(page.locator('.reader-toolbar')).not.toHaveAttribute('inert','');
  await toggle(second).click();await expect(page.locator('html')).toHaveAttribute('data-theme','light');expect(await page.evaluate(()=>BibleSpeech.getState())).toBe('paused');
  await page.evaluate(()=>resumeReader());await expect.poll(()=>page.evaluate(()=>BibleSpeech.getState())).toBe('playing');
  await page.evaluate(()=>repeatLastSpokenVerse());await page.evaluate(()=>stopReader());await second.close();
});

test('all nine translations and KJV italics remain exact while appearance changes',async({page})=>{
  await page.goto('/');await reader(page);
  for(const id of ['web','asv','kjv','ylt','dby','webster','rv','gnv','dra']){
    await page.evaluate(id=>changeTranslation(id),id);await page.evaluate(()=>navigateReaderToPassage('genesis',1,2));
    const before=await page.locator('#readerContent').textContent();await toggle(page).click();
    expect(await page.locator('#readerContent').textContent()).toBe(before);await expect(page.locator('#readerTranslation')).toHaveValue(id);
    if(id==='kjv')await expect(page.locator('#readerContent .reader-verse i').first()).toHaveCSS('font-style','italic');
  }
});

test('Saved, Search, Compare, Plan, Word Study, account and every Reader picker inherit dark appearance',async({page})=>{
  await page.setViewportSize({width:390,height:900});await page.goto('/');await dark(page);await reader(page);
  await page.evaluate(()=>navigateReaderToPassage('john',1,2));await page.locator('#readerMoreTrigger').tap();await page.locator('#readerSaveVerse').tap();
  await expect(page.locator('#readerSaveVerse')).toHaveText('Saved ✓');await page.locator('.saved-pill').tap();await expect(page.locator('#tray')).toHaveCSS('background-color','rgb(36, 50, 72)');
  await page.locator('#closeTray').tap();
  for(const id of ['bookSelect','chapterSelect','verseSelect','readAloudVoice','readAloudSpeed']){
    const trigger=page.locator(`[data-reader-select="${id}"]`);await trigger.tap();
    await expect(page.locator('#readerOptionsPicker')).toBeVisible();await expect(page.locator('#readerOptionsPicker')).toHaveCSS('background-color','rgb(36, 50, 72)');
    expect(await page.locator('#readerOptionsPicker').evaluate(node=>getComputedStyle(node,'::backdrop').backgroundColor)).toBe('rgba(12, 22, 38, 0.72)');
    await page.keyboard.press('Escape');await expect(trigger).toBeFocused();
  }
  await page.locator('#readerTranslationTrigger').tap();await expect(page.locator('#readerTranslationPicker')).toHaveCSS('background-color','rgb(36, 50, 72)');await page.keyboard.press('Escape');
  await page.locator('#scripturePickerTrigger').tap();await expect(page.locator('#scripturePicker')).toHaveCSS('background-color','rgb(36, 50, 72)');await page.keyboard.press('Escape');
  await page.locator('#readerContent [data-verse-number="2"] .word-study-token').first().click();await expect(page.locator('#wordStudyPanel')).toBeVisible();
  await expect(page.locator('#wordStudyPanel')).toHaveCSS('color','rgb(240, 232, 214)');
  await page.getByRole('button',{name:'Compare',exact:true}).click();await expect(page.locator('#compareGrid .compare-col')).toHaveCount(2);
  await page.getByRole('button',{name:'Plan',exact:true}).click();await expect(page.locator('#planDays button').first()).toBeVisible();
  await page.locator('#searchInput').fill('John 1:1');await page.locator('.search-box > button:not(#searchClear)').click();await expect(page.locator('.result-card').first()).toBeVisible();
  await page.locator('#accountTrigger').click();await expect(page.locator('#accountDialog')).toHaveCSS('background-color','rgb(36, 50, 72)');
  await page.keyboard.press('Escape');await expect(page.locator('#accountTrigger')).toBeFocused();
  await page.locator('#offlineBiblesTrigger').click();await expect(page.locator('#offlineBiblesDialog')).toHaveCSS('background-color','rgb(36, 50, 72)');await page.keyboard.press('Escape');
});

test('Scripture, labels, focus and dark borders meet contrast thresholds; CSS parses',async({page})=>{
  await page.goto('/');await dark(page);await reader(page);await page.keyboard.press('Tab');await toggle(page).focus();
  await expect(toggle(page)).toHaveCSS('outline-style','solid');await expect(toggle(page)).toHaveCSS('outline-width','2px');
  const result=await page.evaluate(()=>{
    function rgb(color){color=color.trim();return color.startsWith('#')?[1,3,5].map(index=>parseInt(color.slice(index,index+2),16)):color.match(/[\d.]+/g).slice(0,3).map(Number);}
    function luminance(color){return rgb(color).map(value=>{value/=255;return value<=.04045?value/12.92:Math.pow((value+.055)/1.055,2.4);}).reduce((total,value,index)=>total+value*[.2126,.7152,.0722][index],0);}
    function ratio(foreground,background){const first=luminance(foreground),second=luminance(background);return(Math.max(first,second)+.05)/(Math.min(first,second)+.05);}
    const root=getComputedStyle(document.documentElement),button=getComputedStyle(document.querySelector('[data-theme-toggle]'));
    return{scripture:ratio(root.getPropertyValue('--ink'),root.getPropertyValue('--vellum')),secondary:ratio(root.getPropertyValue('--ink-soft'),root.getPropertyValue('--vellum-card')),focus:ratio(button.outlineColor,root.getPropertyValue('--vellum')),border:ratio(root.getPropertyValue('--line'),root.getPropertyValue('--theme-surface')),rules:[...document.styleSheets].find(sheet=>sheet.href?.endsWith('/css/theme.css')).cssRules.length};
  });
  console.log('Theme measured contrast',result);expect(result.scripture).toBeGreaterThanOrEqual(4.5);expect(result.secondary).toBeGreaterThanOrEqual(4.5);expect(result.focus).toBeGreaterThanOrEqual(3);expect(result.border).toBeGreaterThanOrEqual(3);expect(result.rules).toBeGreaterThan(20);
  expect(await page.locator('#searchInput').evaluate(node=>getComputedStyle(node,'::placeholder').color)).toBe('rgb(201, 195, 184)');
});

test('light Reader rendering is pixel-identical without dark-theme rules',async({page},info)=>{
  await page.goto('/');await reader(page);await page.locator('#readerContent').scrollIntoViewIfNeeded();
  const before=await page.locator('#readerContent').screenshot({animations:'disabled'});
  await page.addStyleTag({content:fs.readFileSync(require.resolve('../css/theme.css'),'utf8').split(':root{')[0]});
  await page.locator('link[href="/css/theme.css"]').evaluate(node=>node.remove());
  const after=await page.locator('#readerContent').screenshot({animations:'disabled'});
  await info.attach('original-light-reader',{body:after,contentType:'image/png'});await info.attach('theme-light-reader',{body:before,contentType:'image/png'});
  expect(Buffer.compare(after,before)).toBe(0);
});

test('offline and account callback restore preference; performance compaction changes only leading whitespace',async({page})=>{
  await page.goto('/');await dark(page);await page.goto('/offline');await expect(page.locator('html')).toHaveAttribute('data-theme','dark');
  await page.goto('/auth/callback/');await expect(page.locator('html')).toHaveAttribute('data-theme','dark');await expect(page.locator('body')).toHaveCSS('color','rgb(240, 232, 214)');
  const original=execFileSync('git',['show',baseline+':js/app.js'],{encoding:'utf8'}).replace(/\r\n/g,'\n');
  const current=fs.readFileSync(require.resolve('../js/app.js'),'utf8').replace(/\r\n/g,'\n');
  const boundary=original.indexOf('function renderLeaf(){');
  expect(current).toBe(original.slice(0,boundary)+original.slice(boundary).replace(/^ +/gm,''));
});

test('cross-tab switching leaves open modal, focus, selection, saved data and plan data intact',async({page,context})=>{
  await page.setViewportSize({width:390,height:900});await page.goto('/');await reader(page);
  await page.evaluate(()=>navigateReaderToPassage('john',1,2));await page.locator('#readerMoreTrigger').tap();await page.locator('#readerSaveVerse').tap();
  await page.evaluate(()=>{UserData.plan.save([1,2]);UserData.journey.save({version:1,plans:[[1,2],[],[],[],[]],completedDates:[]});localStorage.setItem('theme-account-state-fixture','preserved');});
  await page.locator('[data-reader-select="bookSelect"]').tap();
  const before=await page.evaluate(()=>({focus:document.activeElement.textContent,selection:currentVerse,storage:Object.fromEntries(Object.entries(localStorage)),open:document.getElementById('readerOptionsPicker').open}));
  const second=await context.newPage();await second.goto('/');await dark(second);
  await expect(page.locator('html')).toHaveAttribute('data-theme','dark');
  const after=await page.evaluate(()=>({focus:document.activeElement.textContent,selection:currentVerse,storage:Object.fromEntries(Object.entries(localStorage).filter(([key])=>key!=='god4.theme')),open:document.getElementById('readerOptionsPicker').open}));
  expect(after).toEqual(before);await page.bringToFront();await page.keyboard.press('Escape');await expect(page.locator('[data-reader-select="bookSelect"]')).toBeFocused();
  await page.reload();await reader(page);expect(await page.evaluate(()=>UserData.savedVerses.load().length)).toBe(1);expect(await page.evaluate(()=>UserData.journey.load().plans[0])).toEqual([1,2]);await second.close();
});

test('fullscreen exit permits header switching and return at the preserved visible anchor',async({page},info)=>{
  await page.setViewportSize({width:390,height:900});await page.goto('/');await reader(page);
  await page.evaluate(()=>document.getElementById('view-reader').scrollIntoView({block:'start',behavior:'instant'}));
  await page.locator('#fullscreenBtn').tap();await page.locator('#readerContent [data-verse-number="12"]').scrollIntoViewIfNeeded();
  const before=await position(page);await page.screenshot({path:info.outputPath('light-fullscreen.png')});
  await page.locator('#fullscreenBtn').tap();await toggle(page).tap();await page.locator('#fullscreenBtn').tap();
  const {page:backgroundScroll,...anchor}=before;
  const {page:returnedBackgroundScroll,...returnedAnchor}=await position(page);
  expect(returnedAnchor).toEqual(anchor);await page.screenshot({path:info.outputPath('dark-fullscreen.png')});
  await expect(page.locator('#view-reader')).toHaveAttribute('aria-modal','true');await expect(page.locator('nav')).toHaveAttribute('inert','');
});
