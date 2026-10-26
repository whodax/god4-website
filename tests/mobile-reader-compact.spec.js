const {test,expect}=require('@playwright/test');
test.use({hasTouch:true});

async function open(page,width,fullscreen=false,dark=false){
  await page.setViewportSize({width,height:844});
  await page.emulateMedia({reducedMotion:'reduce'});
  await page.addInitScript(()=>{
    window.IntersectionObserver=class{observe(){}unobserve(){}disconnect(){}};
    window.__compactSpeech=[];
    Object.defineProperty(window,'AudioContext',{configurable:true,value:undefined});
    Object.defineProperty(window,'webkitAudioContext',{configurable:true,value:undefined});
    Object.defineProperty(window,'SpeechSynthesisUtterance',{configurable:true,value:function(text){this.text=text;}});
    Object.defineProperty(window,'speechSynthesis',{configurable:true,value:{getVoices(){return [{name:'Microsoft David',lang:'en-US',localService:true}];},addEventListener(){},pause(){},resume(){},cancel(){},speak(u){window.__compactSpeech.push(u);u.onstart?.();}}});
  });
  await page.goto('/');await page.evaluate(()=>initializeBibleExperience());
  await page.evaluate(()=>ReaderTranslationLoader.ensure());await page.evaluate(()=>document.fonts.ready);
  if(dark)await page.evaluate(()=>document.documentElement.setAttribute('data-theme','dark'));
  await page.evaluate(()=>document.getElementById('view-reader').scrollIntoView({block:'start',behavior:'instant'}));
  if(fullscreen){
    await page.locator('#readerMoreTrigger').tap();await page.locator('#fullscreenBtn').tap();
    await page.locator('#readerMoreTrigger').tap();
  }
}
const voice=page=>page.locator('[data-reader-select="readAloudVoice"]');
const speed=page=>page.locator('[data-reader-select="readAloudSpeed"]');
async function snapshot(page){return page.evaluate(()=>({page:scrollY,reader:document.getElementById('view-reader').scrollTop,verse:document.querySelector('#readerContent [data-verse-number="12"]').getBoundingClientRect().top}));}
async function readingTouch(page){
  // Model a background touch without Chromium retargeting it to a nearby word.
  await page.evaluate(()=>document.activeElement.blur());await page.locator('#readerContent').dispatchEvent('pointerdown',{pointerType:'touch',isPrimary:true});await page.locator('#readerContent').dispatchEvent('pointerup',{pointerType:'touch',isPrimary:true});}
async function scroll(page,delta){
  // Flush pending Options/anchor scroll events before starting a new gesture.
  await page.evaluate(()=>new Promise(requestAnimationFrame));
  await page.locator('#readerContent').dispatchEvent('wheel',{deltaY:delta});
  await page.evaluate(delta=>{const view=document.getElementById('view-reader');(view.classList.contains('reader-fullscreen')?view:window).scrollBy({top:delta,behavior:'instant'});},delta);
}

for(const width of [320,360,390,430])for(const fullscreen of [false,true])for(const dark of [false,true]){
  test(`${width}px fullscreen=${fullscreen} dark=${dark}: three rows, independent Options and recovery`,async({page},testInfo)=>{
    await open(page,width,fullscreen,dark);
    await expect.poll(()=>page.evaluate(()=>document.documentElement.scrollWidth)).toBeLessThanOrEqual(width);
    const geometry=await page.evaluate(fullscreen=>{
      const rect=e=>{const r=e.getBoundingClientRect();return {x:r.x,y:r.y,width:r.width,height:r.height,right:r.right};};
      const toolbar=document.querySelector('.reader-toolbar');
      return {rows:[Array.from(document.querySelectorAll(fullscreen?'.reader-compact-tabs button':'.bs-nav .bs-btn')),Array.from(document.querySelectorAll('#readerReferenceNavigation button')).concat(document.getElementById('readerMoreTrigger')),Array.from(toolbar.querySelectorAll('.reader-compact-playback button')).filter(e=>!e.hidden)].map(row=>row.map(rect)),overflow:document.documentElement.scrollWidth>innerWidth};
    },fullscreen);
    expect(geometry.overflow).toBe(false);expect(geometry.rows.map(r=>r.length)).toEqual([4,4,6]);
    for(const row of geometry.rows){
      expect(Math.max(...row.map(r=>r.y))-Math.min(...row.map(r=>r.y))).toBeLessThanOrEqual(1);
      for(const r of row){expect(r.width).toBeGreaterThanOrEqual(44);expect(r.height).toBeGreaterThanOrEqual(44);expect(r.x).toBeGreaterThanOrEqual(0);expect(r.right).toBeLessThanOrEqual(width);}
    }
    expect(geometry.rows[1][0].y).toBeGreaterThanOrEqual(geometry.rows[0][0].y+44);
    expect(geometry.rows[2][0].y).toBeGreaterThanOrEqual(geometry.rows[1][0].y+44);
    for(const button of await page.locator('.reader-toolbar button:visible').all())await expect(button).toHaveAccessibleName(/\S/);
    await voice(page).tap();await expect(page.getByRole('dialog',{name:'Select Reading Voice',exact:true})).toBeVisible();
    await page.keyboard.press('Escape');await expect(voice(page)).toBeFocused();
    await speed(page).press('Enter');await page.locator('#readerOptionsPicker [data-option-value="1.25"]').tap();
    await expect(page.locator('#readAloudSpeed')).toHaveValue('1.25');await expect(speed(page)).toBeFocused();
    await page.locator('#readerContent [data-verse-number="12"]').scrollIntoViewIfNeeded();
    const before=await snapshot(page);
    await page.locator('#readerMoreTrigger').tap();const expanded=await snapshot(page);
    expect(Math.abs(expanded.verse-before.verse)).toBeLessThanOrEqual(1);
    await expect(page.locator('#readerSecondaryControls [data-voice-command-button]')).toBeVisible();
    await expect(page.locator('#readerSecondaryControls #readerSaveVerse')).toBeVisible();
    await expect(page.locator('#readerSecondaryControls #fullscreenBtn')).toBeVisible();
    const palette=await page.locator('#readerSaveVerse').evaluate(e=>({background:getComputedStyle(e).backgroundColor,color:getComputedStyle(e).color}));
    for(const control of ['#fullscreenBtn','.reader-compact-stop']){
      await expect(page.locator(control)).toHaveCSS('background-color',palette.background);
      await expect(page.locator(control)).toHaveCSS('color',palette.color);
    }
    await page.locator('#readerMoreTrigger').tap();expect(Math.abs((await snapshot(page)).verse-before.verse)).toBeLessThanOrEqual(1);
    await readingTouch(page);await scroll(page,96);
    const recovery=page.getByRole('button',{name:'Show Reader controls',exact:true});
    await expect(recovery).toBeVisible();const concealed=await snapshot(page);
    await recovery.tap();await expect(recovery).toBeHidden();expect(await snapshot(page)).toEqual(concealed);
    await expect(page.locator('#readerMoreTrigger')).toHaveAttribute('aria-expanded','false');
    await page.locator('#readerMoreTrigger').tap();await readingTouch(page);await scroll(page,96);
    await expect(recovery).toBeVisible();await recovery.tap();
    await expect(page.locator('#readerMoreTrigger')).toHaveAttribute('aria-expanded','true');
    await page.keyboard.press('Escape');await expect(page.locator('#readerMoreTrigger')).toBeFocused();
    await expect(page.locator('#readerMoreTrigger')).toHaveCSS('outline-style','solid');
    console.log(JSON.stringify({width,fullscreen,dark,geometry}));
    await page.screenshot({path:testInfo.outputPath('compact-reader.png')});
  });
}

test('mobile playback pauses, resumes and stops; verse/chapter navigation and DRA remain intact',async({page})=>{
  await open(page,390);
  await page.locator('[data-reader-action="next-verse"]').tap();await expect(page.locator('#readerReferenceText')).toHaveText('John 1:1');
  await page.locator('[data-reader-action="next-verse"]').tap();await expect(page.locator('#readerReferenceText')).toHaveText('John 1:2');
  await page.locator('[data-reader-action="previous-verse"]').tap();await expect(page.locator('#readerReferenceText')).toHaveText('John 1:1');
  await page.locator('#readAloudPlay').focus();await page.keyboard.press('Enter');
  await expect(page.locator('#readAloudPlay')).toHaveAccessibleName('Pause reading aloud');
  await page.keyboard.press('Enter');await expect(page.locator('#readAloudPlay')).toHaveAccessibleName('Resume reading aloud');
  await page.keyboard.press('Enter');await expect(page.locator('#readAloudPlay')).toHaveAccessibleName('Pause reading aloud');
  await page.locator('#readerMoreTrigger').tap();await page.locator('.reader-compact-stop').tap();
  expect(await page.evaluate(()=>BibleSpeech.getState())).toBe('idle');
  await page.locator('#readerMoreTrigger').tap();await page.locator('#readerTranslationTrigger').tap();
  await page.locator('#readerTranslationPicker [data-translation="dra"]').tap();
  await expect(page.locator('#readerTranslation')).toHaveValue('dra');
  await page.locator('[data-reader-action="next"]').tap();await expect(page.locator('#readerReferenceText')).toHaveText('John 2');
  await page.locator('[data-reader-action="previous"]').tap();await expect(page.locator('#readerReferenceText')).toHaveText('John 1');
});

test('mobile navigation proxies retain Compare, Plan and Offline access in fullscreen',async({page})=>{
  await open(page,320,true);
  await page.locator('.reader-compact-tabs button[aria-controls="view-compare"]').tap();
  await expect(page.locator('#view-compare')).toBeVisible();await expect(page.locator('#view-reader')).not.toHaveClass(/reader-fullscreen/);
  await page.locator('.bs-nav [aria-controls="view-reader"]').tap();
  await page.locator('#readerMoreTrigger').tap();await page.locator('#fullscreenBtn').tap();await page.locator('#readerMoreTrigger').tap();
  await page.locator('.reader-compact-tabs button[aria-controls="view-plan"]').tap();await expect(page.locator('#view-plan')).toBeVisible();
  await expect(page.locator('#view-reader')).not.toHaveClass(/reader-fullscreen/);
  await page.locator('.bs-nav [aria-controls="view-reader"]').tap();
  await page.locator('#readerMoreTrigger').tap();await page.locator('#fullscreenBtn').tap();await page.locator('#readerMoreTrigger').tap();
  await page.locator('.reader-compact-tabs button[aria-controls="offlineBiblesDialog"]').tap();await expect(page.locator('#offlineBiblesDialog')).toBeVisible();
  await expect(page.locator('#view-reader')).not.toHaveClass(/reader-fullscreen/);
  await page.keyboard.press('Escape');await expect(page.locator('#offlineBiblesTrigger')).toBeFocused();
});

test('desktop native layout and original controls survive repeated breakpoint changes',async({page})=>{
  await open(page,390);
  for(let i=0;i<3;i++){
    await page.setViewportSize({width:1440,height:900});
    await expect(page.locator('.reader-toolbar > #fullscreenBtn')).toBeVisible();
    await expect(page.locator('.reader-toolbar > #readAloudPlay')).toBeVisible();
    await expect(page.locator('#readerSecondaryControls #readerVerseNavigation [data-reader-action="next-verse"]')).toHaveCount(1);
    await expect(page.locator('.reader-compact-tabs')).toBeHidden();
    await page.locator('#readerMoreTrigger').click();await expect(page.locator('#readAloudVoice')).toBeVisible();await expect(page.locator('#readAloudSpeed')).toBeVisible();
    await page.locator('#readerMoreTrigger').click();await page.setViewportSize({width:390,height:844});
    await expect(page.locator('.reader-compact-playback [data-reader-action="next-verse"]')).toBeVisible();
    await expect(page.locator('#readAloudPlay')).toHaveCount(1);await expect(voice(page)).toHaveCount(1);
  }
});

test('late compact chapter positioning cannot override a newer verse or Plan navigation',async({page})=>{
  await open(page,390);
  await page.evaluate(async()=>{
    await navigateReaderToPassage('john',2);
    await navigateReaderToPassage('psalms',23,6);
  });
  await expect(page.locator('#readerReferenceText')).toHaveText('Psalms 23:6');
  await expect(page.locator('#readerContent [data-verse-number="6"]')).toBeFocused();
  await page.evaluate(async()=>{await new Promise(requestAnimationFrame);await new Promise(requestAnimationFrame);});
  const position=await page.evaluate(()=>scrollY);
  await page.evaluate(async()=>{await new Promise(requestAnimationFrame);await new Promise(requestAnimationFrame);});
  expect(await page.evaluate(()=>scrollY)).toBe(position);
  const manual=await page.evaluate(async()=>{
    await navigateReaderToPassage('john',1);
    scrollBy({top:200,behavior:'instant'});
    const intended=scrollY;
    await new Promise(requestAnimationFrame);await new Promise(requestAnimationFrame);
    return {intended,actual:scrollY};
  });
  expect(manual.actual).toBe(manual.intended);
  await page.evaluate(async()=>{
    await navigateReaderToPassage('john',3);
    document.querySelector('.bs-nav [aria-controls="view-plan"]').click();
  });
  await expect(page.locator('#view-plan')).toBeVisible();
  const plan=await page.locator('#planHeading').boundingBox();
  await page.evaluate(async()=>{await new Promise(requestAnimationFrame);await new Promise(requestAnimationFrame);});
  expect(await page.locator('#planHeading').boundingBox()).toEqual(plan);
});

test('focused native reading voice and speed survive a desktop-to-mobile reparent',async({page})=>{
  await open(page,390);
  for(const id of ['readAloudVoice','readAloudSpeed']){
    await page.setViewportSize({width:1440,height:844});
    await expect(page.locator('.reader-toolbar')).not.toHaveClass(/reader-compact-mobile/);
    if(await page.locator('#readerMoreTrigger').getAttribute('aria-expanded')==='false')await page.locator('#readerMoreTrigger').click();
    const native=page.locator('#'+id),value=await native.inputValue();
    await native.focus();await page.setViewportSize({width:390,height:844});
    await expect(page.locator('.reader-toolbar')).toHaveClass(/reader-compact-mobile/);
    await expect(native).toBeVisible();await expect(native).toBeFocused();await expect(native).toHaveValue(value);
    await expect(native).not.toHaveAttribute('data-reader-reparenting','');
    await page.locator('#readAloudPlay').focus();
    await expect(page.locator(`[data-reader-select="${id}"]`)).toBeVisible();
    await expect(page.locator('#readAloudPlay')).toBeFocused();
  }
});
