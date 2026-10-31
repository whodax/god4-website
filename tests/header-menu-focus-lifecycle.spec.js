const {test,expect}=require('@playwright/test');
test.use({hasTouch:true,isMobile:true,userAgent:'Mozilla/5.0 (Linux; Android 14; Pixel 7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/130.0.0.0 Mobile Safari/537.36'});
async function open(page,width,dark=false,cloud=false){
 await page.setViewportSize({width,height:844});
 await page.addInitScript(({dark,cloud})=>{
  localStorage.setItem('god4.theme',dark?'dark':'light');
  window.IntersectionObserver=class{observe(){}disconnect(){}};
  window.__speechCalls=[];window.__recognitionStarts=0;window.__cloudSources=[];window.__holdCloud=false;
  class Context{constructor(){this.state='running';this.destination={};}resume(){return Promise.resolve();}suspend(){return Promise.resolve();}decodeAudioData(){return __holdCloud?new Promise(resolve=>window.__releaseCloud=()=>{__holdCloud=false;resolve({duration:1});}):Promise.resolve({duration:1});}createBufferSource(){const source={connect(){},disconnect(){},start(){},stop(){}};__cloudSources.push(source);return source;}}
  Object.defineProperty(window,'AudioContext',{configurable:true,value:cloud?Context:undefined});Object.defineProperty(window,'webkitAudioContext',{configurable:true,value:undefined});
  Object.defineProperty(window,'SpeechSynthesisUtterance',{configurable:true,value:function(text){this.text=text;}});
  Object.defineProperty(window,'speechSynthesis',{configurable:true,value:{getVoices:()=>[{name:'Microsoft David',lang:'en-US',localService:true}],addEventListener(){},cancel(){},pause(){},resume(){},speak(u){__speechCalls.push(u);u.onstart?.();}}});
  window.SpeechRecognition=class{start(){__recognitionStarts++;this.onstart?.();}stop(){this.onend?.();}};
  window.__focusEvents=[];document.addEventListener('focusin',e=>__focusEvents.push(e.target.id));
 },{dark,cloud});
 if(cloud)await page.route('**/api/tts',r=>r.fulfill({status:200,contentType:'audio/mpeg',body:'audio'}));
 page.errors=[];page.on('pageerror',e=>page.errors.push(e.message));await page.goto('/');
}
async function ready(page){await page.evaluate(async()=>{await initializeBibleExperience();await ReaderTranslationLoader.ensure();await document.fonts.ready;});}
async function choose(page,action){
 await page.locator('#headerMenuTrigger').tap();
 await page.evaluate(()=>{window.__menuClosed=new Promise(resolve=>document.getElementById('headerMenu').addEventListener('close',resolve,{once:true}));__focusEvents=[];});
 await page.locator('#headerMenu [data-destination="'+action+'"]').tap();
}
async function settled(page){
 await page.evaluate(async()=>{await __menuClosed;await ReaderTranslationLoader.ensure();await document.fonts.ready;await new Promise(requestAnimationFrame);await Promise.all(document.getElementById('view-reader').getAnimations({subtree:true}).map(a=>a.finished.catch(()=>{})));await new Promise(requestAnimationFrame);await new Promise(requestAnimationFrame);});
}
async function finalTarget(page,id){
 await expect(page.locator('#headerMenu')).not.toBeVisible();await expect(page.locator('#'+id)).toBeFocused();await expect(page.locator('.reader-toolbar')).not.toHaveAttribute('inert','');
 await expect(page.locator('.reader-toolbar')).toHaveCSS('visibility','visible');
 const g=await page.locator('#'+id).evaluate(e=>{const r=e.getBoundingClientRect(),v=visualViewport,view=document.getElementById('view-reader'),full=view.classList.contains('reader-fullscreen');const top=full?view.getBoundingClientRect().top:document.querySelector('body>nav').getBoundingClientRect().bottom;return {top:r.top,bottom:r.bottom,boundary:Math.max(top,v.offsetTop),visibleBottom:v.offsetTop+v.height,hit:e.contains(document.elementFromPoint(r.x+r.width/2,r.y+r.height/2)),focused:document.activeElement.id,last:__focusEvents.at(-1)};});
 expect(g.top).toBeGreaterThanOrEqual(g.boundary);expect(g.bottom).toBeLessThanOrEqual(g.visibleBottom);expect(g.hit).toBe(true);expect(g.focused).toBe(id);expect(g.last).toBe(id);expect(page.errors).toEqual([]);
}
for(const width of [320,390,430])for(const dark of [false,true])for(const state of ['idle','playing','paused'])test(`${width}px dark=${dark} ${state}: final menu targets survive dismissal, layout and auto-hide`,async({page})=>{
 await open(page,width,dark);await ready(page);await page.evaluate(()=>navigateReaderToPassage('john',1,16));
 if(state!=='idle'){await page.evaluate(()=>playReader());await expect.poll(()=>page.evaluate(()=>BibleSpeech.getState())).toBe('playing');if(state==='paused')await page.evaluate(()=>pauseResumeReadAloud());}
 const calls=await page.evaluate(()=>__speechCalls.length);
 for(const action of ['aloud','commands']){
  await choose(page,action);await settled(page);await finalTarget(page,action==='aloud'?'readAloudPlay':'readerVoiceCommands');
  await expect(page.locator('#readerMoreTrigger')).toHaveAttribute('aria-expanded','false');expect(await page.evaluate(()=>BibleSpeech.getState())).toBe(state);expect(await page.evaluate(()=>__speechCalls.length)).toBe(calls);expect(await page.evaluate(()=>__recognitionStarts)).toBe(0);
 }
 await page.locator('#readerMoreTrigger').tap();await expect(page.locator('#readerMoreTrigger')).toHaveAttribute('aria-expanded','true');
 await choose(page,'aloud');await settled(page);await finalTarget(page,'readAloudPlay');await expect(page.locator('#readerMoreTrigger')).toHaveAttribute('aria-expanded','true');
 await page.keyboard.press('Escape');await expect(page.locator('#readerMoreTrigger')).toBeFocused();
});
for(const width of [320,390,430])for(const dark of [false,true])test(`${width}px dark=${dark}: fullscreen recovery retains Stop and pairs Save with Fullscreen`,async({page})=>{
 await open(page,width,dark);await ready(page);await page.evaluate(()=>navigateReaderToPassage('john',1,1));
 await page.locator('#readerMoreTrigger').tap();await page.locator('#fullscreenBtn').tap();
 await page.evaluate(()=>playReader());await expect.poll(()=>page.evaluate(()=>BibleSpeech.getState())).toBe('playing');
 for(const id of ['readAloudPlay','readerVoiceCommands']){await page.evaluate(id=>ReaderReadingControls.reveal(document.getElementById(id)),id);await page.evaluate(()=>new Promise(requestAnimationFrame));await finalTarget(page,id);}
 const boxes=await page.evaluate(()=>['readerSaveVerse','fullscreenBtn'].map(id=>{const e=document.getElementById(id),r=e.getBoundingClientRect();return {x:r.x,right:r.right,y:r.y,width:r.width,height:r.height,overflow:e.scrollWidth>e.clientWidth};}));
 expect(Math.abs(boxes[0].y-boxes[1].y)).toBeLessThan(1);expect(boxes[0].right).toBeLessThanOrEqual(boxes[1].x);for(const b of boxes){expect(b.width).toBeGreaterThanOrEqual(44);expect(b.height).toBeGreaterThanOrEqual(44);expect(b.overflow).toBe(false);expect(b.x).toBeGreaterThanOrEqual(0);expect(b.right).toBeLessThanOrEqual(width);}
 await page.locator('.reader-compact-stop').tap();expect(await page.evaluate(()=>BibleSpeech.getState())).toBe('idle');await expect(page.locator('.reader-compact-stop')).toHaveAccessibleName('Stop reading aloud');
 await page.keyboard.press('Escape');await expect(page.locator('#readerMoreTrigger')).toBeFocused();await page.keyboard.press('Escape');await expect(page.locator('#view-reader')).not.toHaveClass(/reader-fullscreen/);
});
for(const width of [320,390,430])test(`${width}px: cancelled delayed runtime cannot override the newer microphone destination`,async({page})=>{
 let release;const gate=new Promise(resolve=>release=resolve);await page.route('**/js/bible/translation-picker.js',async r=>{await gate;await r.continue();});
 try{
  await open(page,width);await page.locator('#headerMenuTrigger').tap();await page.locator('#headerMenu [data-destination="aloud"]').tap();await expect(page.locator('#headerMenu')).toHaveAttribute('aria-busy','true');
  await page.keyboard.press('Escape');await choose(page,'commands');release();await settled(page);await finalTarget(page,'readerVoiceCommands');expect(await page.evaluate(()=>__speechCalls.length)).toBe(0);expect(await page.evaluate(()=>__recognitionStarts)).toBe(0);
 }finally{release();}
});
for(const width of [320,390,430])test(`${width}px: rapid touch menu navigation leaves only the latest requested control focused`,async({page})=>{
 await open(page,width);await ready(page);await page.evaluate(async()=>{await navigateReaderToPassage('john',1,1);playReader();});
 for(const action of ['aloud','commands','aloud','commands','aloud','commands']){await choose(page,action);await expect(page.locator('#headerMenu')).not.toBeVisible();}
 await settled(page);await finalTarget(page,'readerVoiceCommands');expect(await page.evaluate(()=>BibleSpeech.getState())).toBe('playing');expect(await page.evaluate(()=>__recognitionStarts)).toBe(0);
 for(const selector of ['.saved-pill','#accountTrigger']){await expect(page.locator(selector)).toHaveCSS('justify-content','center');await expect(page.locator(selector)).toHaveCSS('align-items','center');await expect(page.locator(selector)).toHaveCSS('text-align','center');}
});

for(const initial of ['playing','preparing'])test(`cloud ${initial}: explicit menu access survives provider start without restarting narration`,async({page})=>{
 await open(page,390,false,true);await ready(page);await page.evaluate(async initial=>{await navigateReaderToPassage('john',1,1);__holdCloud=initial==='preparing';playReader();},initial);
 await expect.poll(()=>page.evaluate(()=>BibleSpeech.getState())).toBe(initial);
 if(initial==='preparing')await expect.poll(()=>page.evaluate(()=>typeof __releaseCloud)).toBe('function');
 await choose(page,'aloud');await settled(page);await finalTarget(page,'readAloudPlay');
 if(initial==='preparing'){await page.evaluate(()=>__releaseCloud());await expect.poll(()=>page.evaluate(()=>BibleSpeech.getState())).toBe('playing');await page.evaluate(()=>new Promise(requestAnimationFrame));await finalTarget(page,'readAloudPlay');}
 const sources=await page.evaluate(()=>__cloudSources.length);expect(sources).toBeGreaterThan(0);
 await choose(page,'commands');await settled(page);await finalTarget(page,'readerVoiceCommands');
 expect(await page.evaluate(()=>BibleSpeech.getState())).toBe('playing');expect(await page.evaluate(()=>__cloudSources.length)).toBe(sources);expect(await page.evaluate(()=>__speechCalls.length)).toBe(0);expect(await page.evaluate(()=>__recognitionStarts)).toBe(0);
});

for(const action of ['aloud','commands'])test(`${action}: responsive reparenting preserves the menu-requested control, not Options`,async({page})=>{
 await open(page,390);await ready(page);await page.evaluate(async()=>{await navigateReaderToPassage('john',1,1);playReader();});
 await choose(page,action);await settled(page);const id=action==='aloud'?'readAloudPlay':'readerVoiceCommands';await finalTarget(page,id);
 for(const width of [640,390,900,430]){
  await page.setViewportSize({width,height:844});await page.evaluate(async()=>{await new Promise(requestAnimationFrame);await Promise.all(document.getElementById('view-reader').getAnimations({subtree:true}).map(a=>a.finished.catch(()=>{})));await new Promise(requestAnimationFrame);await new Promise(requestAnimationFrame);});await finalTarget(page,id);
 }
 expect(await page.evaluate(()=>BibleSpeech.getState())).toBe('playing');expect(await page.evaluate(()=>__recognitionStarts)).toBe(0);
});

for(const mode of ['new playback','reading gesture'])test(`menu ownership expires on ${mode} so normal auto-hide remains intact`,async({page})=>{
 await open(page,390);await ready(page);await page.evaluate(()=>navigateReaderToPassage('john',1,1));
 if(mode==='reading gesture')await page.evaluate(()=>playReader());
 await choose(page,mode==='new playback'?'aloud':'commands');await settled(page);await finalTarget(page,mode==='new playback'?'readAloudPlay':'readerVoiceCommands');
 if(mode==='new playback')await page.locator('#readAloudPlay').tap();
 await page.evaluate(()=>document.activeElement.blur());
 if(mode==='reading gesture'){
  await page.locator('#readerContent').dispatchEvent('pointerdown',{pointerType:'touch',isPrimary:true});await page.locator('#readerContent').dispatchEvent('pointerup',{pointerType:'touch',isPrimary:true});await page.evaluate(()=>new Promise(requestAnimationFrame));await page.locator('#readerContent').dispatchEvent('wheel',{deltaY:96});await page.evaluate(()=>window.scrollBy({top:96,behavior:'instant'}));
 }
 await expect(page.getByRole('button',{name:'Show Reader controls',exact:true})).toBeVisible();await expect(page.locator('.reader-toolbar')).toHaveAttribute('inert','');
 await page.setViewportSize({width:1280,height:844});await expect(page.locator('.reader-toolbar')).toHaveCSS('visibility','visible');await page.setViewportSize({width:390,height:844});await expect(page.getByRole('button',{name:'Show Reader controls',exact:true})).toBeVisible();
 expect(await page.evaluate(()=>BibleSpeech.getState())).toBe('playing');expect(await page.evaluate(()=>__recognitionStarts)).toBe(0);
});
