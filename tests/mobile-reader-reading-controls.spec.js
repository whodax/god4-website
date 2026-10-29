const {test,expect}=require('@playwright/test');

test.use({hasTouch:true});
const recovery=page=>page.getByRole('button',{name:'Show Reader controls',exact:true});
async function open(page,{width=390,fullscreen=false,cloud=false,fallback=false,deferred=false}={}){
  await page.setViewportSize({width,height:844});await page.emulateMedia({reducedMotion:'reduce'});
  await page.addInitScript(({cloud,deferred})=>{
    window.IntersectionObserver=class{observe(){}unobserve(){}disconnect(){}};
    window.__reading={utterances:[],sources:[],decodes:[]};
    Object.defineProperty(window,'SpeechSynthesisUtterance',{configurable:true,value:function(text){this.text=text;}});
    Object.defineProperty(window,'speechSynthesis',{configurable:true,value:{
      getVoices(){return [{name:'Microsoft David',lang:'en-US',localService:true}];},addEventListener(){},pause(){},resume(){},cancel(){},
      speak(utterance){window.__reading.utterances.push(utterance);if(!deferred)utterance.onstart?.();}
    }});
    class Context{
      constructor(){this.state='running';this.destination={};}resume(){return Promise.resolve();}suspend(){return Promise.resolve();}
      decodeAudioData(){return deferred?new Promise(resolve=>window.__reading.decodes.push(()=>resolve({duration:1}))):Promise.resolve({duration:1});}
      createBufferSource(){const source={connect(){},disconnect(){},start(){},stop(){}};window.__reading.sources.push(source);return source;}
    }
    Object.defineProperty(window,'AudioContext',{configurable:true,value:cloud?Context:undefined});
    Object.defineProperty(window,'webkitAudioContext',{configurable:true,value:undefined});
  },{cloud,deferred});
  await page.route('**/api/tts',route=>route.fulfill({status:fallback?503:200,contentType:fallback?'application/json':'audio/mpeg',body:fallback?'{}':'audio'}));
  await page.goto('/');await page.evaluate(()=>initializeBibleExperience());await page.evaluate(()=>ReaderTranslationLoader.ensure());
  await page.evaluate(()=>document.fonts.ready);
  await page.evaluate(()=>document.getElementById('view-reader').scrollIntoView({block:'start',behavior:'instant'}));
  if(fullscreen){await page.locator('#readerMoreTrigger').tap();await page.locator('#fullscreenBtn').tap();await page.locator('#readerMoreTrigger').tap();}
  await page.locator('#readerMoreTrigger').tap();
  await page.locator('#readerContent [data-verse-number="12"]').scrollIntoViewIfNeeded();
}
async function snapshot(page){
  return page.evaluate(()=>({page:scrollY,reader:document.getElementById('view-reader').scrollTop,verse:document.querySelector('#readerContent [data-verse-number="12"]').getBoundingClientRect().top,height:document.querySelector('.reader-toolbar').getBoundingClientRect().height}));
}
async function scroll(page,delta){
  await page.locator('#readerContent').dispatchEvent('wheel',{deltaY:delta});
  await page.evaluate(delta=>{const view=document.getElementById('view-reader');(view.classList.contains('reader-fullscreen')?view:window).scrollBy({top:delta,behavior:'instant'});},delta);
}
async function hidden(page){
  await expect(recovery(page)).toBeVisible();
  await expect(page.locator('.reader-toolbar')).toHaveAttribute('inert','');
  await expect(page.locator('.reader-toolbar')).toHaveAttribute('aria-hidden','true');
  await expect(page.locator('.reader-toolbar')).toHaveCSS('visibility','hidden');
  await expect.poll(()=>recovery(page).evaluate(button=>{const r=button.getBoundingClientRect();return button.contains(document.elementFromPoint(r.x+r.width/2,r.y+r.height/2));})).toBe(true);
  await expect(page.getByRole('button',{name:'Hide Options',exact:true})).toHaveCount(0);
}
async function visible(page){
  await expect(page.locator('.reader-toolbar')).not.toHaveAttribute('inert','');
  await expect(page.locator('.reader-toolbar')).toHaveCSS('visibility','visible');
  await expect(recovery(page)).toBeHidden();
}
async function readingTouch(page){
  // Model a background touch without Chromium retargeting it to a nearby word.
  await page.evaluate(()=>document.activeElement.blur());
  await page.locator('#readerContent').dispatchEvent('pointerdown',{pointerType:'touch',isPrimary:true});
  await page.locator('#readerContent').dispatchEvent('pointerup',{pointerType:'touch',isPrimary:true});
}

for(const width of [320,360,390,430])for(const fullscreen of [false,true]){
  test(`${width}px fullscreen=${fullscreen}: hide and recover Options independently without moving Scripture`,async({page},testInfo)=>{
    await open(page,{width,fullscreen});
    const before=await snapshot(page);await scroll(page,96);await hidden(page);
    const after=await snapshot(page);expect(after.verse-before.verse).toBe(-96);expect(after.height).toBe(before.height);
    expect(await page.evaluate(()=>readerVisibleTop())).toBeCloseTo((await recovery(page).boundingBox()).y+(await recovery(page).boundingBox()).height,1);
    expect((await recovery(page).boundingBox()).height).toBeGreaterThanOrEqual(44);
    expect((await recovery(page).boundingBox()).y).toBeGreaterThanOrEqual(4);
    await page.screenshot({path:testInfo.outputPath('controls-hidden.png')});
    await expect(recovery(page)).toHaveAttribute('aria-controls','readerControlStack');
    await recovery(page).tap();await visible(page);const restored=await snapshot(page);expect(restored).toEqual(after);
    console.log('Reader hide/show geometry:',JSON.stringify({width,fullscreen,toolbarHeight:before.height,additionalHideShift:after.verse-before.verse+96,recoveryShift:restored.verse-after.verse}));
    await page.screenshot({path:testInfo.outputPath('controls-restored.png')});
    await expect(page.locator('#readAloudPlay')).toBeFocused();
    await expect(page.locator('#readerMoreTrigger')).toHaveText('Hide Options');
    for(const id of ['bookSelect','chapterSelect','verseSelect','readAloudVoice','readAloudSpeed'])await expect(page.locator(`[data-reader-select="${id}"]`)).toBeVisible();
    await readingTouch(page);
    await scroll(page,96);await hidden(page);const down=await snapshot(page);
    await scroll(page,-96);await visible(page);const up=await snapshot(page);
    expect(up.verse-down.verse).toBe(96);
    expect(await page.evaluate(()=>document.documentElement.scrollWidth<=innerWidth)).toBe(true);
  });

  test(`${width}px fullscreen=${fullscreen}: native playing, repeat, pause, resume, stop and completion stay recoverable`,async({page})=>{
    await open(page,{width,fullscreen});
    await page.locator('#readAloudPlay').tap();await hidden(page);
    expect(await page.evaluate(()=>BibleSpeech.getState())).toBe('playing');
    await scroll(page,-96);await hidden(page);
    const before=await snapshot(page);await recovery(page).tap();await visible(page);expect(await snapshot(page)).toEqual(before);
    await expect(page.getByRole('button',{name:'Stop reading aloud',exact:true})).toBeVisible();
    await page.evaluate(()=>BibleSpeech.updateControls());await visible(page);
    await page.evaluate(()=>pauseReader());await visible(page);
    expect(await page.evaluate(()=>BibleSpeech.getState())).toBe('paused');
    await readingTouch(page);
    await page.evaluate(()=>resumeReader());await hidden(page);
    await page.evaluate(()=>repeatLastSpokenVerse());await hidden(page);
    await recovery(page).tap();await page.locator('.reader-compact-stop').tap();await visible(page);
    expect(await page.evaluate(()=>BibleSpeech.getState())).toBe('idle');
    await readingTouch(page);
    await page.evaluate(()=>readVerseAloud(12));await hidden(page);
    await page.evaluate(()=>window.__reading.utterances.at(-1).onend());await visible(page);
    expect(await page.evaluate(()=>BibleSpeech.getState())).toBe('idle');
  });
}

for(const cloud of [false,true])for(const fallback of cloud?[false,true]:[false])test(`preparing and fallback cloud=${cloud} fallback=${fallback}`,async({page})=>{
  await open(page,{width:320,fullscreen:true,cloud,fallback,deferred:true});
  await page.locator('#readAloudPlay').tap();
  await expect.poll(()=>page.evaluate(()=>BibleSpeech.getState())).toBe('preparing');await visible(page);
  if(cloud&&!fallback){await expect.poll(()=>page.evaluate(()=>window.__reading.decodes.length)).toBe(1);await page.evaluate(()=>window.__reading.decodes[0]());}
  else{await expect.poll(()=>page.evaluate(()=>window.__reading.utterances.length)).toBe(1);await page.evaluate(()=>window.__reading.utterances[0].onstart());}
  await hidden(page);expect(await page.evaluate(()=>BibleSpeech.getResolvedVoiceInfo().provider)).toBe(cloud&&!fallback?'cloud':'native');
  await page.evaluate(()=>pauseReader());await visible(page);
  await page.evaluate(()=>stopReader());await visible(page);
});

test('keyboard and assistive activation protect focused controls, with Escape and focus return',async({page})=>{
  await open(page,{width:320,fullscreen:true});
  await page.locator('#readAloudPlay').focus();await page.keyboard.press('Enter');await visible(page);
  await expect(page.locator('#readAloudPlay')).toBeFocused();
  await scroll(page,96);await visible(page);
  await readingTouch(page);await hidden(page);
  await recovery(page).focus();await page.keyboard.press('Escape');await visible(page);
  await expect(page.locator('#readAloudPlay')).toBeFocused();
  await page.keyboard.press('Escape');await expect(page.locator('#readerSecondaryControls')).toBeHidden();
  await page.keyboard.press('Escape');await expect(page.locator('#view-reader')).not.toHaveClass(/reader-fullscreen/);
  await page.evaluate(()=>stopReader());
  await page.locator('#readerMoreTrigger').dispatchEvent('click',{detail:0});
  await page.locator('#readAloudPlay').dispatchEvent('click',{detail:0});await visible(page);
});

test('selection dialogs and text selection are never interrupted by active playback',async({page})=>{
  await open(page,{width:390});
  await page.locator('[data-reader-select="readAloudSpeed"]').tap();
  await page.evaluate(()=>readVerseAloud(12));await visible(page);
  await expect(page.getByRole('dialog',{name:'Speed',exact:true})).toBeVisible();
  await page.keyboard.press('Escape');await expect(page.locator('[data-reader-select="readAloudSpeed"]')).toBeFocused();
  await page.evaluate(()=>stopReader());
  await page.evaluate(()=>{const range=document.createRange();range.selectNodeContents(document.querySelector('#readerContent [data-verse-number="12"]'));getSelection().removeAllRanges();getSelection().addRange(range);});
  const selection=await page.evaluate(()=>getSelection().toString());
  await scroll(page,96);await visible(page);expect(await page.evaluate(()=>getSelection().toString())).toBe(selection);
  await page.evaluate(()=>getSelection().removeAllRanges());
});

test('programmatic navigation and scrolling inside Options do not imitate a reading gesture',async({page})=>{
  await open(page,{width:320});
  await page.evaluate(()=>window.scrollBy({top:120,behavior:'instant'}));await visible(page);
  await page.locator('#readerSecondaryControls').dispatchEvent('wheel',{deltaY:120});
  await page.locator('#readerSecondaryControls').evaluate(element=>element.scrollTop=100);await visible(page);
  await page.locator('#readerSecondaryControls').dispatchEvent('pointerdown',{pointerType:'touch'});
  await page.evaluate(()=>readVerseAloud(12));await visible(page);
  await page.locator('#readerSecondaryControls').dispatchEvent('pointerup',{pointerType:'touch'});await visible(page);
  await scroll(page,96);await hidden(page);
  await page.evaluate(()=>stopReader());await visible(page);
});

test('touching Options or a picker during keyboard-started playback keeps controls available',async({page})=>{
  await open(page,{width:320});
  await page.locator('#readAloudPlay').focus();await page.keyboard.press('Enter');await visible(page);
  await page.locator('#readerMoreTrigger').tap();await visible(page);
  await page.locator('#readerMoreTrigger').tap();await visible(page);
  await page.locator('[data-reader-select="readAloudVoice"]').tap();
  await expect(page.getByRole('dialog',{name:'Select Reading Voice',exact:true})).toBeVisible();await visible(page);
  await page.getByRole('button',{name:'Close Reader selection'}).tap();await visible(page);
  await expect(page.locator('[data-reader-select="readAloudVoice"]')).toBeFocused();
  await scroll(page,96);await hidden(page);
});

for(const width of [320,360,390,430])for(const fullscreen of [false,true])test(`${width}px enlarged recovery control and reduced motion fullscreen=${fullscreen}`,async({page})=>{
  await open(page,{width,fullscreen});
  await page.addStyleTag({content:'.reader-show-controls{font-size:26px!important;}#readerSecondaryControls button{font-size:20px!important;}'});
  await scroll(page,96);await hidden(page);
  await expect(page.locator('.reader-toolbar')).toHaveCSS('transition-duration','0s');
  const button=recovery(page),bounds=await button.boundingBox();expect(bounds.height).toBeGreaterThanOrEqual(44);
  expect(await button.evaluate(element=>element.scrollWidth<=element.clientWidth)).toBe(true);
  await expect.poll(()=>page.evaluate(()=>readerVisibleTop())).toBeCloseTo(bounds.y+bounds.height,1);
  const before=await snapshot(page);await button.tap();await visible(page);expect(await snapshot(page)).toEqual(before);
});

test('desktop stays unchanged; mobile state resets across resize and leaving Reader',async({page})=>{
  await open(page,{width:1280});await page.locator('#readAloudPlay').click();await visible(page);
  await page.setViewportSize({width:390,height:844});await hidden(page);
  await page.setViewportSize({width:1280,height:844});await visible(page);
  await page.evaluate(()=>stopReader());await page.setViewportSize({width:390,height:844});
  await scroll(page,96);await hidden(page);
  await page.locator('.bs-btn[aria-controls="view-plan"]').click();
  await expect(page.locator('#view-plan')).toHaveClass(/active/);await expect(recovery(page)).toBeHidden();
  await page.locator('.bs-btn[aria-controls="view-reader"]').click();await visible(page);
});

test('real Chromium touch scrolling and offline playback retain recovery and Saved access',async({page,context})=>{
  await open(page,{width:390});
  const session=await context.newCDPSession(page);
  await page.evaluate(()=>{window.__readingMoves=0;document.addEventListener('touchmove',()=>window.__readingMoves++,{passive:true});});
  const before=await snapshot(page);
  await session.send('Input.dispatchTouchEvent',{type:'touchStart',touchPoints:[{x:120,y:760}]});
  for(const height of [700,640,580,520]){
    await session.send('Input.dispatchTouchEvent',{type:'touchMove',touchPoints:[{x:120,y:height}]});
    await page.evaluate(()=>new Promise(requestAnimationFrame));
  }
  await session.send('Input.dispatchTouchEvent',{type:'touchEnd',touchPoints:[]});
  await page.evaluate(()=>new Promise(resolve=>{let previous=scrollY,stable=0;function check(){stable=scrollY===previous?stable+1:0;previous=scrollY;if(stable===3)resolve();else requestAnimationFrame(check);}requestAnimationFrame(check);}));
  expect(await page.evaluate(()=>window.__readingMoves)).toBeGreaterThan(0);
  expect((await snapshot(page)).page).toBeGreaterThan(before.page);
  await expect(page.locator('#wordStudyPanel')).toBeHidden();
  await hidden(page);await context.setOffline(true);
  await page.evaluate(()=>readVerseAloud(12));await hidden(page);
  await recovery(page).tap();await visible(page);await page.locator('#readerSaveVerse').tap();
  await expect(page.locator('#readerSaveVerse')).toHaveText('Saved ✓');
  await page.locator('.saved-pill').tap();await expect(page.locator('#tray')).toHaveClass(/is-open/);
  await page.locator('#tray .saved-verse-remove').filter({hasText:'Remove'}).tap();
  await expect(page.locator('#savedCount')).toHaveText('0');
  await page.evaluate(()=>stopReader());await visible(page);await session.detach();
});

test('narrow fine-pointer desktop keeps its controls during playback and scrolling',async({browser})=>{
  const context=await browser.newContext({viewport:{width:390,height:844},hasTouch:false});const page=await context.newPage();
  try{
    await page.addInitScript(()=>{
      Object.defineProperty(window,'AudioContext',{configurable:true,value:undefined});Object.defineProperty(window,'webkitAudioContext',{configurable:true,value:undefined});
      Object.defineProperty(window,'SpeechSynthesisUtterance',{configurable:true,value:function(text){this.text=text;}});
      Object.defineProperty(window,'speechSynthesis',{configurable:true,value:{getVoices(){return [{name:'Microsoft David',lang:'en-US',localService:true}];},addEventListener(){},speak(utterance){utterance.onstart?.();},cancel(){},pause(){},resume(){}}});
    });
    await page.goto('/');await page.evaluate(()=>initializeBibleExperience());await page.evaluate(()=>ReaderTranslationLoader.ensure());
    await page.locator('#readerMoreTrigger').click();
    await page.evaluate(()=>readVerseAloud(12));
    expect(await page.evaluate(()=>BibleSpeech.getState())).toBe('playing');
    await page.evaluate(async()=>{await new Promise(requestAnimationFrame);await new Promise(requestAnimationFrame);});
    await visible(page);await scroll(page,96);await visible(page);
  }finally{await context.close();}
});

test('Word Study, translation selection and Compare remain usable after recovery',async({page})=>{
  await open(page,{width:390,fullscreen:true});await scroll(page,96);await hidden(page);
  await page.locator('#readerContent [data-verse-number="12"] .word-study-token').first().click();
  await expect(page.locator('#wordStudyPanel')).toBeVisible();
  await expect(page.locator('#wordStudyHeading')).toBeFocused();
  await recovery(page).tap();await page.locator('#readerTranslationTrigger').tap();
  await expect(page.locator('#readerTranslationPicker')).toBeVisible();
  await page.getByRole('button',{name:'Close Bible translation picker'}).tap();
  await expect(page.locator('#readerTranslationTrigger')).toBeFocused();
  await page.locator('#fullscreenBtn').tap();
  await page.locator('.bs-btn[aria-controls="view-compare"]').tap();
  await expect(page.locator('#view-compare')).toHaveClass(/active/);
  await page.locator('.bs-btn[aria-controls="view-reader"]').tap();await visible(page);
});

test('normal transition keeps geometry stable and zoom gestures do not trigger hiding',async({page})=>{
  await open(page);await page.emulateMedia({reducedMotion:'no-preference'});
  await expect(page.locator('.reader-toolbar')).toHaveCSS('transition-duration','0.12s, 0s');
  await page.locator('#readerContent').dispatchEvent('wheel',{deltaY:96,ctrlKey:true});
  await page.evaluate(()=>scrollBy({top:96,behavior:'instant'}));
  await page.evaluate(async()=>{await new Promise(requestAnimationFrame);await new Promise(requestAnimationFrame);});await visible(page);
  await page.evaluate(()=>{const target=document.getElementById('readerContent');target.dispatchEvent(new TouchEvent('touchmove',{bubbles:true,touches:[new Touch({identifier:1,target}),new Touch({identifier:2,target})]}));scrollBy({top:96,behavior:'instant'});});
  await page.evaluate(async()=>{await new Promise(requestAnimationFrame);await new Promise(requestAnimationFrame);});await visible(page);
  await scroll(page,96);await hidden(page);const before=await snapshot(page);
  await recovery(page).tap();await visible(page);expect(await snapshot(page)).toEqual(before);
});

test('dragging the recovery control does not activate it or click through the toolbar',async({page,context})=>{
  await open(page,{width:390,fullscreen:true});await scroll(page,96);await hidden(page);
  const client=await context.newCDPSession(page),bounds=await recovery(page).boundingBox();
  const x=bounds.x+bounds.width/2,y=bounds.y+bounds.height/2;
  await client.send('Input.dispatchTouchEvent',{type:'touchStart',touchPoints:[{x,y}]});
  await client.send('Input.dispatchTouchEvent',{type:'touchMove',touchPoints:[{x,y:y+40}]});
  await client.send('Input.dispatchTouchEvent',{type:'touchCancel',touchPoints:[]});
  await hidden(page);await recovery(page).tap();await visible(page);
  await expect(page.locator('#view-reader')).toHaveClass(/reader-fullscreen/);
  await expect(page.locator('#readerMoreTrigger')).toHaveText('Hide Options');
  expect(await page.evaluate(()=>BibleSpeech.getState())).toBe('idle');await client.detach();
});

test('recovery focuses Options if Read Aloud is unavailable',async({page})=>{
  await open(page,{width:320});
  await page.evaluate(()=>{
    Object.defineProperty(window,'speechSynthesis',{configurable:true,value:undefined});
    Object.defineProperty(window,'SpeechSynthesisUtterance',{configurable:true,value:undefined});BibleSpeech.updateControls();
  });
  await expect(page.locator('#readAloudPlay')).toBeDisabled();
  await scroll(page,96);await hidden(page);const before=await snapshot(page);
  await recovery(page).tap();await visible(page);await expect(page.locator('#readerMoreTrigger')).toBeFocused();
  expect(await snapshot(page)).toEqual(before);
});

test('older browsers without inert retain normal visible controls',async({page})=>{
  await page.addInitScript(()=>{delete HTMLElement.prototype.inert;});
  await open(page,{width:320});await scroll(page,96);await visible(page);
  await page.evaluate(()=>readVerseAloud(12));await visible(page);
  await expect(page.locator('.reader-show-controls')).toHaveCount(0);
});

test('preparation stopped within one frame still restores a scroll-hidden toolbar',async({page})=>{
  await open(page,{width:320,deferred:true});await scroll(page,96);await hidden(page);const before=await snapshot(page);
  await page.evaluate(()=>{readVerseAloud(12);stopReader();});await visible(page);
  expect(await page.evaluate(()=>BibleSpeech.getState())).toBe('idle');expect(await snapshot(page)).toEqual(before);
});

test('an unavailable speech module cannot break scrolling or control recovery',async({page})=>{
  await open(page,{width:320});await page.evaluate(()=>{window.BibleSpeech=undefined;ReaderOptions.sync();});
  await scroll(page,96);await hidden(page);await recovery(page).tap();await visible(page);
  await expect(page.locator('#readerMoreTrigger')).toBeFocused();
  await page.locator('[data-reader-select="verseSelect"]').tap();
  await expect(page.getByRole('dialog',{name:'Verse',exact:true})).toBeVisible();
});

test('rapid recovery during a normal fade restores focus before the next Escape',async({page})=>{
  await open(page,{width:320});await page.emulateMedia({reducedMotion:'no-preference'});
  await scroll(page,96);await expect(recovery(page)).toBeVisible();
  await recovery(page).tap();expect(await page.evaluate(()=>document.activeElement.id)).toBe('readAloudPlay');
  await page.locator('#readerMoreTrigger').press('Escape');
  await expect(page.locator('#readerSecondaryControls')).toBeHidden();
  await expect(page.locator('#readerMoreTrigger')).toHaveText('Options');
});
