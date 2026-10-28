const {test,expect}=require('@playwright/test');
test.use({hasTouch:true,userAgent:'Mozilla/5.0 (Linux; Android 14; Pixel 7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/130.0.0.0 Mobile Safari/537.36'});
async function open(page,width=390,dark=false){
  await page.setViewportSize({width,height:844});await page.emulateMedia({reducedMotion:'reduce'});
  await page.addInitScript(()=>{
    window.IntersectionObserver=class{observe(){}unobserve(){}disconnect(){}};
    Object.defineProperty(navigator,'permissions',{configurable:true,value:{query:async()=>({state:'prompt'})}});
    window.__mic={captures:[],audio:[],autoEnd:true,overlaps:[]};
    class Recognition{constructor(){__mic.captures.push(this);}start(){this.active=true;this.onstart?.();}abort(){if(__mic.autoEnd)queueMicrotask(()=>this.end());}end(){this.active=false;this.onend?.();}emit(text){this.onresult?.({resultIndex:0,results:[Object.assign([{transcript:text}],{isFinal:true})]});}}
    window.SpeechRecognition=Recognition;
    Object.defineProperty(window,'AudioContext',{configurable:true,value:undefined});Object.defineProperty(window,'webkitAudioContext',{configurable:true,value:undefined});
    Object.defineProperty(window,'SpeechSynthesisUtterance',{configurable:true,value:function(text){this.text=text;}});
    Object.defineProperty(window,'speechSynthesis',{configurable:true,value:{getVoices(){return [{name:'Microsoft David',lang:'en-US',localService:true}];},addEventListener(){},pause(){},resume(){},cancel(){},speak(u){if(__mic.captures.some(r=>r.active))__mic.overlaps.push('audio before release');__mic.audio.push(u);u.onstart?.();}}});
  });
  page.errors=[];page.on('pageerror',e=>page.errors.push(e.message));
  await page.goto('/');await page.evaluate(()=>initializeBibleExperience());await page.evaluate(()=>ReaderTranslationLoader.ensure());await page.evaluate(()=>document.fonts.ready);
  if(dark)await page.evaluate(()=>document.documentElement.setAttribute('data-theme','dark'));
  await page.evaluate(()=>document.getElementById('view-reader').scrollIntoView({block:'start',behavior:'instant'}));
}
const mic=page=>page.locator('#readerVoiceCommands');
async function say(page,text){await mic(page).tap();await page.evaluate(t=>__mic.captures.at(-1).emit(t),text);await expect(mic(page)).toHaveAttribute('aria-pressed','false');await page.evaluate(()=>voiceNavigationTask);}
test.afterEach(async({page})=>{expect(page.errors||[]).toEqual([]);expect(await page.evaluate(()=>__mic.overlaps)).toEqual([]);});
for(const width of [320,360,390,430])for(const dark of [false,true])test(`${width}px dark=${dark}: adjacent microphone, shared state and unchanged three rows in normal/fullscreen`,async({page},info)=>{
  await open(page,width,dark);
  for(const fullscreen of [false,true]){
    if(fullscreen){await page.locator('#readerMoreTrigger').tap();await page.locator('#fullscreenBtn').tap();await page.locator('#readerMoreTrigger').tap();}
    await expect(page.locator('[data-voice-command-button]')).toHaveCount(1);await expect(mic(page)).toBeVisible();await expect(mic(page)).toHaveAccessibleName(/Voice Commands.*speak a command/);
    const geometry=await mic(page).evaluate(e=>{const r=e.getBoundingClientRect(),o=document.getElementById('readerMoreTrigger').getBoundingClientRect();return {x:r.x,y:r.y,width:r.width,height:r.height,gap:r.left-o.right,optionsY:o.y,next:e.previousElementSibling.id,overflow:document.documentElement.scrollWidth>innerWidth};});
    expect(geometry.next).toBe('readerMoreTrigger');expect(geometry.gap).toBeGreaterThanOrEqual(0);expect(geometry.gap).toBeLessThanOrEqual(3);expect(geometry.y).toBe(geometry.optionsY);expect(geometry.width).toBeGreaterThanOrEqual(44);expect(geometry.height).toBeGreaterThanOrEqual(44);expect(geometry.overflow).toBe(false);
    const before=await mic(page).evaluate(()=>document.querySelector('#readerContent [data-verse-number="1"]').getBoundingClientRect().top);
    const idle=await mic(page).evaluate(e=>getComputedStyle(e).boxShadow);await mic(page).tap();await expect(mic(page)).toHaveAttribute('aria-pressed','true');await expect(mic(page)).toHaveAccessibleName(/listening/);
    expect(await mic(page).evaluate(e=>getComputedStyle(e).boxShadow)).not.toBe(idle);
    expect(await mic(page).evaluate(()=>document.querySelector('#readerContent [data-verse-number="1"]').getBoundingClientRect().top)).toBe(before);
    await page.evaluate(()=>__mic.captures.at(-1).emit('ASV Matthew chapter 1 verse 2'));await page.evaluate(()=>voiceNavigationTask);await expect(page.locator('#readerTranslation')).toHaveValue('asv');await expect(page.locator('#verseSelect')).toHaveValue('2');
    await expect(page.locator('#readerMoreTrigger')).toHaveAttribute('aria-expanded','false');
    await page.screenshot({path:info.outputPath(`microphone-${fullscreen?'fullscreen':'normal'}.png`)});
  }
  expect(await page.evaluate(()=>__mic.captures.length)).toBe(2);
});
test('keyboard focus, microphone release, cancellation and breakpoint restoration retain the same button and one listener',async({page})=>{
  await open(page);await page.evaluate(()=>window.__originalMic=document.getElementById('readerVoiceCommands'));
  await page.locator('#readerMoreTrigger').focus();await page.keyboard.press('Tab');await expect(mic(page)).toBeFocused();await expect(mic(page)).toHaveCSS('outline-style','solid');
  await page.keyboard.press('Enter');await expect(mic(page)).toHaveAttribute('aria-pressed','true');await page.evaluate(()=>{__mic.autoEnd=false;__mic.captures[0].emit('play');});
  await expect(mic(page)).toHaveAttribute('aria-busy','true');expect(await page.evaluate(()=>__mic.audio.length)).toBe(0);await page.evaluate(()=>__mic.captures[0].end());await expect.poll(()=>page.evaluate(()=>__mic.audio.length)).toBe(1);
  await page.evaluate(()=>{__mic.autoEnd=true;stopReader();});
  for(let i=0;i<3;i++){
    await mic(page).focus();await page.setViewportSize({width:1440,height:900});await expect(page.locator('#readerMoreTrigger')).toBeFocused();await expect(page.locator('#readerSecondaryControls #readerVoiceCommands')).toHaveCount(1);await page.locator('#readerMoreTrigger').click();await expect(mic(page)).toBeVisible();await expect(mic(page).locator('svg')).toBeHidden();await page.locator('#readerMoreTrigger').click();
    await page.setViewportSize({width:390,height:844});await expect(page.locator('.reader-toolbar > #readerVoiceCommands')).toBeVisible();await say(page,'stop');
  }
  expect(await page.evaluate(()=>document.getElementById('readerVoiceCommands')===__originalMic)).toBe(true);expect(await page.evaluate(()=>__mic.captures.length)).toBe(4);
});
for(const dark of [false,true])test(`320px dark=${dark}: enlarged text and long references remain readable without horizontal clipping`,async({page})=>{
  await open(page,320,dark);await page.evaluate(async()=>{await navigateReaderToPassage('2-thessalonians',3,18);document.getElementById('readerReferenceText').style.fontSize='200%';});
  await expect(page.locator('#readerReferenceText')).toHaveText('2 Thessalonians 3:18');await expect(mic(page)).toBeVisible();
  const size=await page.locator('#scripturePickerTrigger').evaluate(e=>({width:e.clientWidth,scroll:e.scrollWidth,height:e.clientHeight,content:e.scrollHeight,font:parseFloat(getComputedStyle(e.firstElementChild).fontSize),overflow:document.documentElement.scrollWidth>innerWidth}));
  expect(size.scroll).toBeLessThanOrEqual(size.width);expect(size.content).toBeLessThanOrEqual(size.height);expect(size.font).toBeGreaterThanOrEqual(28);expect(size.overflow).toBe(false);
});
test('offline Play remains accessible from Show Controls and microphone without expanding Options',async({page,context})=>{
  await open(page,320);await context.setOffline(true);await say(page,'play');await expect.poll(()=>page.evaluate(()=>__mic.audio.length)).toBe(1);
  await page.evaluate(()=>document.activeElement.blur());await page.locator('#readerContent').dispatchEvent('pointerdown',{pointerType:'touch',isPrimary:true});await page.locator('#readerContent').dispatchEvent('pointerup',{pointerType:'touch',isPrimary:true});
  const recovery=page.getByRole('button',{name:'Show Reader controls',exact:true});await expect(recovery).toBeVisible();await recovery.tap();await expect(mic(page)).toBeVisible();await say(page,'pause');expect(await page.evaluate(()=>BibleSpeech.getState())).toBe('paused');await expect(page.locator('#readerMoreTrigger')).toHaveAttribute('aria-expanded','false');
});
