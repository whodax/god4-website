const {toggleReaderFullscreen}=require('./reader-navigation-test-helper');
const {test,expect}=require('@playwright/test');
const fs=require('node:fs');
const path=require('node:path');

const translations=['web','asv','kjv','ylt','dby','webster','rv','gnv','dra'];
const dialogSelector='#readerTranslationPicker';
async function focusContrast(button){
  const styles=await button.evaluate(element=>{
    const computed=getComputedStyle(element);
    let surface=element.parentElement;
    while(surface&&getComputedStyle(surface).backgroundColor==='rgba(0, 0, 0, 0)')surface=surface.parentElement;
    return {visible:element.matches(':focus-visible'),color:computed.outlineColor,
      style:computed.outlineStyle,width:computed.outlineWidth,offset:computed.outlineOffset,
      backgrounds:[getComputedStyle(surface).backgroundColor,computed.backgroundColor]};
  });
  expect(styles.visible).toBe(true);
  expect(styles.color).toBe('rgb(27, 42, 68)');
  expect(styles.style).toBe('solid');expect(styles.width).toBe('2px');expect(styles.offset).toBe('2px');
  function luminance(color){
    const channels=color.match(/[\d.]+/g).slice(0,3).map(Number).map(value=>{
      const channel=value/255;
      return channel<=0.04045?channel/12.92:((channel+0.055)/1.055)**2.4;
    });
    return channels[0]*0.2126+channels[1]*0.7152+channels[2]*0.0722;
  }
  const outline=luminance(styles.color);
  const ratios=styles.backgrounds.map(background=>{
    const adjacent=luminance(background);
    return (Math.max(outline,adjacent)+0.05)/(Math.min(outline,adjacent)+0.05);
  });
  for(const ratio of ratios)expect(ratio).toBeGreaterThanOrEqual(3);
  return {outline:styles.color,backgrounds:styles.backgrounds,ratios};
}
async function openReader(page){
  await page.goto('/');
  await page.evaluate(()=>initializeBibleExperience());
}
async function openPicker(page){
  await page.locator('#readerTranslationTrigger').click();
  await expect(page.locator(dialogSelector)).toBeVisible();
}
async function bounds(page){
  return page.locator(dialogSelector).evaluate(dialog=>{
    const rect=dialog.getBoundingClientRect(),list=dialog.querySelector('.reader-translation-options');
    const close=dialog.querySelector('.reader-translation-heading button'),closeRect=close.getBoundingClientRect();
    return {fits:rect.left>=0&&rect.right<=innerWidth&&rect.top>=0&&rect.bottom<=innerHeight,
      overflow:dialog.scrollWidth>dialog.clientWidth||document.documentElement.scrollWidth>innerWidth,
      scrollable:list.scrollHeight>list.clientHeight,
      closeHit:close.contains(document.elementFromPoint(closeRect.left+closeRect.width/2,closeRect.top+closeRect.height/2))};
  });
}
for(const width of [320,390])for(const fullscreen of [false,true])for(const colorScheme of ['light','dark']){
  test.describe(`${width}px ${fullscreen?'fullscreen':'normal'} ${colorScheme}`,()=>{
    test.use({viewport:{width,height:480},hasTouch:true,colorScheme,contextOptions:{reducedMotion:'reduce'},serviceWorkers:'block'});
    test('all translations scroll, remain touch targets and retain accessible selected state',async({page},info)=>{
      const errors=[];page.on('pageerror',error=>errors.push(error.message));
      await openReader(page);
      if(fullscreen)await toggleReaderFullscreen(page);
      await openPicker(page);
      const dialog=page.locator(dialogSelector),buttons=dialog.locator('[data-translation]');
      await expect(dialog).toHaveAccessibleName('Bible translation');
      expect(await buttons.evaluateAll(elements=>elements.map(element=>element.dataset.translation))).toEqual(translations);
      await expect(dialog.locator('[aria-pressed="true"]')).toHaveCount(1);
      await expect(dialog.locator('[data-translation="web"]')).toBeFocused();
      expect(await bounds(page)).toEqual({fits:true,overflow:false,scrollable:true,closeHit:true});
      for(const button of await buttons.all()){
        await button.evaluate(element=>element.scrollIntoView({block:'nearest'}));
        expect(await button.evaluate(element=>{
          const rect=element.getBoundingClientRect(),list=element.parentElement.getBoundingClientRect();
          return rect.width>=44&&rect.height>=44&&rect.top>=list.top&&rect.bottom<=list.bottom&&
            element.contains(document.elementFromPoint(rect.left+rect.width/2,rect.top+rect.height/2));
        })).toBe(true);
      }
      const selected=dialog.locator('[data-translation="web"]');
      await selected.evaluate(element=>element.scrollIntoView({block:'nearest'}));
      await expect(selected).toHaveCSS('background-color','rgb(255, 243, 205)');
      await expect(dialog).toHaveCSS('background-color','rgb(247, 241, 222)');
      await expect(buttons.last()).toHaveAccessibleName('CTH — Catholic Bible (Douay-Rheims)');
      await page.screenshot({path:info.outputPath('translation-picker.png')});
      await buttons.last().tap();
      await expect(dialog).not.toBeVisible();
      await expect(page.locator('#readerTranslation')).toHaveValue('dra');
      await expect(page.locator('#readerTranslationTrigger')).toHaveAccessibleName('Bible translation: CTH — Catholic Bible (Douay-Rheims)');
      await expect(page.locator('#readerTranslationTrigger')).toBeFocused();
      if(fullscreen)await expect(page.locator('#view-reader')).toHaveClass(/reader-fullscreen/);
      await page.reload();await page.evaluate(()=>initializeBibleExperience());
      await expect(page.locator('#readerTranslation')).toHaveValue('dra');
      await openPicker(page);
      await expect(dialog.locator('[data-translation="dra"]')).toHaveAttribute('aria-pressed','true');
      await page.keyboard.press('Escape');
      await expect(page.locator('#readerTranslationTrigger')).toBeFocused();
      expect(errors).toEqual([]);
    });
    test('keyboard navigation separates focus from selection and traps focus without leaving fullscreen',async({page})=>{
      await openReader(page);
      if(fullscreen)await toggleReaderFullscreen(page);
      await page.locator('#readerTranslationTrigger').press('Enter');
      const dialog=page.locator(dialogSelector),first=dialog.locator('[data-translation="web"]'),last=dialog.locator('[data-translation="dra"]');
      await expect(first).toBeFocused();
      await focusContrast(first);
      await first.press('ArrowDown');await expect(dialog.locator('[data-translation="asv"]')).toBeFocused();
      await focusContrast(dialog.locator('[data-translation="asv"]'));
      await expect(page.locator('#readerTranslation')).toHaveValue('web');
      await page.keyboard.press('End');await expect(last).toBeFocused();
      await page.keyboard.press('Tab');await expect(dialog.getByRole('button',{name:'Close Bible translation picker'})).toBeFocused();
      await focusContrast(dialog.getByRole('button',{name:'Close Bible translation picker'}));
      await page.keyboard.press('Shift+Tab');await expect(last).toBeFocused();
      await page.keyboard.press('Home');await expect(first).toBeFocused();
      await expect(first).toHaveCSS('outline-style','solid');
      await page.keyboard.press('Escape');await expect(dialog).not.toBeVisible();
      await expect(page.locator('#readerTranslationTrigger')).toBeFocused();
      await focusContrast(page.locator('#readerTranslationTrigger'));
      if(fullscreen)await expect(page.locator('#view-reader')).toHaveClass(/reader-fullscreen/);
      await openPicker(page);await page.keyboard.press('End');await page.keyboard.press(' ');
      await expect(dialog).not.toBeVisible();await expect(page.locator('#readerTranslation')).toHaveValue('dra');
    });
  });
}
test.describe('mobile loading and interaction',()=>{
  test.use({viewport:{width:320,height:640},hasTouch:true,serviceWorkers:'block'});
  test('all nine translations use the existing loader and preserve passage and persistence',async({page})=>{
    await openReader(page);
    for(const id of translations){
      await openPicker(page);await page.locator(`[data-translation="${id}"]`).tap();
      await expect(page.locator(dialogSelector)).not.toBeVisible();
      await expect(page.locator('#readerTranslation')).toHaveValue(id);
      expect(await page.evaluate(()=>currentTranslation)).toBe(id);
      await expect(page.locator('#readerContent h2')).toHaveText('John 1');
    }
  });
  test('failed loading retains the previous selection and permits retry or cancellation',async({page})=>{
    const asvRequest=url=>url.pathname==='/js/bible/asv.js';
    await page.route(asvRequest,route=>route.abort());
    await openReader(page);await openPicker(page);
    await page.locator('[data-translation="asv"]').tap();
    await expect(page.locator(`${dialogSelector} [role="status"]`)).toContainText('Translation unavailable');
    await expect(page.locator('#readerTranslation')).toHaveValue('web');
    await expect(page.locator('[data-translation="web"]')).toHaveAttribute('aria-pressed','true');
    await page.unroute(asvRequest);
    await page.locator('[data-translation="asv"]').tap();
    await expect(page.locator(dialogSelector)).not.toBeVisible();
    await expect(page.locator('#readerTranslation')).toHaveValue('asv');
  });
  test('Escape during pending loading does not reopen the picker or steal later focus',async({page})=>{
    await openReader(page);
    await page.evaluate(()=>{
      const ensure=BibleTranslationLoader.ensure;
      BibleTranslationLoader.ensure=id=>new Promise(resolve=>{window.finishTranslation=()=>resolve(ensure(id));});
    });
    await openPicker(page);await page.locator('[data-translation="asv"]').tap();
    await expect(page.locator(`${dialogSelector} [role="status"]`)).toHaveText('Loading translation…');
    await page.keyboard.press('Escape');
    await openPicker(page);
    await expect(page.locator(`${dialogSelector} .reader-translation-options`)).not.toHaveAttribute('aria-busy','true');
    await page.keyboard.press('Escape');
    await page.locator('#readAloudPlay').focus();
    await page.evaluate(()=>finishTranslation());
    await expect(page.locator('#readerTranslation')).toHaveValue('asv');
    await expect(page.locator(dialogSelector)).not.toBeVisible();
    await expect(page.locator('#readAloudPlay')).toBeFocused();
  });
  test('resizing to desktop closes the modal and restores the native selector',async({page})=>{
    await openReader(page);await openPicker(page);
    await page.setViewportSize({width:1280,height:900});
    await expect(page.locator(dialogSelector)).not.toBeVisible();
    await expect(page.locator('#readerTranslation')).toBeVisible();
    await expect(page.locator('#readerTranslation')).toBeFocused();
    await expect(page.locator('#readerTranslationTrigger')).toBeHidden();
    await page.locator('#readerTranslation').selectOption('dra');
    await expect.poll(()=>page.evaluate(()=>currentTranslation)).toBe('dra');
    await expect(page.locator('#readerContent .reader-chapter-caption')).toContainText(await page.evaluate(()=>BibleData.getChapter('dra','john',1).title));
  });
  test('unsupported dialog retains the native mobile fallback',async({page})=>{
    await page.addInitScript(()=>{HTMLDialogElement.prototype.showModal=undefined;});
    await openReader(page);
    await expect(page.locator('#readerTranslation')).toBeVisible();
    await expect(page.locator('#readerTranslationTrigger')).toHaveCount(0);
    await page.locator('#readerTranslation').selectOption('dra');
    await expect.poll(()=>page.evaluate(()=>currentTranslation)).toBe('dra');
    await expect(page.locator('#readerContent .reader-chapter-caption')).toContainText(await page.evaluate(()=>BibleData.getChapter('dra','john',1).title));
  });
  test('a held touch has pressed feedback without changing the selected state',async({page})=>{
    await openReader(page);await openPicker(page);
    const selected=page.locator('[data-translation="web"]'),rect=await selected.boundingBox();
    const client=await page.context().newCDPSession(page);
    await client.send('Input.dispatchTouchEvent',{type:'touchStart',touchPoints:[{x:rect.x+rect.width/2,y:rect.y+rect.height/2}]});
    await expect(selected).toHaveCSS('background-color','rgb(237, 227, 200)');
    await expect(selected).toHaveAttribute('aria-pressed','true');
    await client.send('Input.dispatchTouchEvent',{type:'touchCancel',touchPoints:[]});
    await expect(selected).not.toHaveAttribute('data-pressed','true');
    await expect(selected).toHaveCSS('background-color','rgb(255, 243, 205)');
    await client.send('Input.dispatchTouchEvent',{type:'touchStart',touchPoints:[{x:rect.x+rect.width/2,y:rect.y+rect.height/2}]});
    await client.send('Input.dispatchTouchEvent',{type:'touchEnd',touchPoints:[]});
    await expect(page.locator(dialogSelector)).not.toBeVisible();
    await expect(page.locator('#readerTranslationTrigger')).toBeFocused();
    await client.detach();
  });
  test('opening, scrolling options and cancelling preserve the Reader scroll position',async({page})=>{
    await page.setViewportSize({width:320,height:480});await openReader(page);
    await page.evaluate(()=>document.fonts.ready.then(()=>true));
    await page.locator('#readerTranslationTrigger').scrollIntoViewIfNeeded();
    const position=()=>page.evaluate(()=>({page:scrollY,reader:document.getElementById('view-reader').scrollTop}));
    const before=await position();await openPicker(page);
    await page.locator('[data-translation="dra"]').evaluate(element=>element.scrollIntoView({block:'nearest'}));
    expect(await position()).toEqual(before);
    await page.getByRole('button',{name:'Close Bible translation picker'}).click();
    expect(await position()).toEqual(before);
    await expect(page.locator('#readerTranslationTrigger')).toBeFocused();
  });
  test('cancelled touch dragging scrolls the list without selecting or leaving a pressed highlight',async({page})=>{
    await page.setViewportSize({width:320,height:480});await openReader(page);await openPicker(page);
    const list=page.locator(`${dialogSelector} .reader-translation-options`),rect=await list.boundingBox();
    const client=await page.context().newCDPSession(page);
    const x=rect.x+rect.width/2,y=rect.y+rect.height-24;
    await client.send('Input.dispatchTouchEvent',{type:'touchStart',touchPoints:[{x,y}]});
    for(let step=1;step<=6;step++){
      await client.send('Input.dispatchTouchEvent',{type:'touchMove',touchPoints:[{x,y:y-step*22}]});
      await page.evaluate(()=>new Promise(requestAnimationFrame));
    }
    await client.send('Input.dispatchTouchEvent',{type:'touchCancel',touchPoints:[]});
    await expect.poll(()=>list.evaluate(element=>element.scrollTop)).toBeGreaterThan(0);
    await expect(page.locator('#readerTranslation')).toHaveValue('web');
    await expect(page.locator(`${dialogSelector} [data-pressed]`)).toHaveCount(0);
    expect((await bounds(page)).closeHit).toBe(true);
    await page.getByRole('button',{name:'Close Bible translation picker'}).tap();
    await expect(page.locator('#readerTranslationTrigger')).toBeFocused();await client.detach();
  });
});
test('narrow mouse hover, keyboard focus and held press use scoped theme states',async({page})=>{
  await page.setViewportSize({width:390,height:640});await openReader(page);await openPicker(page);
  const selected=page.locator('[data-translation="web"]');
  await selected.hover();await expect(selected).toHaveCSS('background-color','rgb(255, 243, 205)');
  const button=page.locator('[data-translation="asv"]');
  await expect(button).toHaveCSS('background-color','rgb(237, 227, 200)');
  await button.hover();await expect(button).toHaveCSS('background-color','rgb(247, 241, 222)');
  await page.mouse.down();await expect(button).toHaveCSS('background-color','rgb(237, 227, 200)');
  await page.mouse.move(0,0);await page.mouse.up();
  await page.locator('[data-translation="web"]').press('ArrowDown');
  await expect(button).toBeFocused();
  const measurements={normal:await focusContrast(button)};
  await button.hover();measurements.hover=await focusContrast(button);
  await page.mouse.down();measurements.pressed=await focusContrast(button);
  await page.mouse.move(0,0);await page.mouse.up();
  console.log('Picker computed keyboard-focus contrast:',JSON.stringify(measurements));
  await expect(page.locator('[data-translation="web"]')).toHaveAttribute('aria-pressed','true');
});
test('current shell supplies the lazy mobile picker offline after reload',async({page,context})=>{
  await page.setViewportSize({width:390,height:640});await openReader(page);
  await page.evaluate(()=>navigator.serviceWorker.ready.then(()=>true));
  await page.reload();await page.evaluate(()=>initializeBibleExperience());
  await page.evaluate(()=>BibleTranslationLoader.retain('dra'));
  await context.setOffline(true);await page.reload();await page.evaluate(()=>initializeBibleExperience());
  await openPicker(page);await page.locator('[data-translation="dra"]').click();
  await expect(page.locator(dialogSelector)).not.toBeVisible();
  await expect(page.locator('#readerTranslation')).toHaveValue('dra');
});

test.describe('translation runtime demand loading',()=>{
  test.use({serviceWorkers:'block'});
  test('homepage and desktop Reader do not fetch the runtime; translation changes deduplicate it',async({page})=>{
    const requests=[];page.on('request',request=>{if(new URL(request.url()).pathname==='/js/bible/translation-picker.js')requests.push(request.url());});
    await page.setViewportSize({width:1280,height:900});await page.goto('/');
    expect(requests).toEqual([]);
    await page.evaluate(()=>initializeBibleExperience());expect(requests).toEqual([]);
    expect(await page.evaluate(()=>typeof ReaderTranslationPicker)).toBe('undefined');
    await page.locator('#readerTranslation').focus();await page.locator('#readerTranslation').selectOption('dra');
    await expect.poll(()=>page.evaluate(()=>currentTranslation)).toBe('dra');
    expect(requests).toHaveLength(1);
    expect(await page.evaluate(()=>ReaderTranslationLoader.ensure()===ReaderTranslationLoader.ensure())).toBe(true);
    await page.evaluate(()=>Promise.all([changeTranslation('web'),changeTranslation('dra')]));
    await expect(page.locator('#readerTranslation')).toHaveValue('dra');expect(requests).toHaveLength(1);
    await expect(page.locator('#readerTranslation')).toBeVisible();
    await page.locator('#readAloudPlay').focus();
    await expect(page.locator('#readerTranslationTrigger')).toBeHidden();
  });
  test('a pending mobile runtime does not block Reader or Word Study and does not replace a focused native picker',async({page})=>{
    let release;const barrier=new Promise(resolve=>release=resolve);
    await page.route('**/js/bible/translation-picker.js',async route=>{await barrier;await route.continue();});
    await page.setViewportSize({width:320,height:844});
    try{
      await openReader(page);await expect(page.locator('#readerContent h2')).toHaveText('John 1');
      await expect(page.locator('#readerTranslation')).toBeVisible();
      await page.locator('#readerContent [data-word-study-term="beginning"]').first().click();
      await expect(page.locator('#wordStudyPanel')).toBeVisible();await page.keyboard.press('Escape');
      const native=page.locator('#readerTranslation');await native.focus();await native.selectOption('asv');
      release();await expect.poll(()=>page.evaluate(()=>currentTranslation)).toBe('asv');
      await expect(native).toBeVisible();await expect(native).toBeFocused();
      await expect(page.locator('#readerTranslationTrigger')).toHaveCount(0);
      await page.locator('#readAloudPlay').focus();
      await expect(page.locator('#readerTranslationTrigger')).toBeVisible();
      await expect(page.locator('#readAloudPlay')).toBeFocused();
      await openPicker(page);await page.keyboard.press('Escape');
      await expect(page.locator('#readerTranslationTrigger')).toBeFocused();
    }finally{release();}
  });
  for(const failure of ['network failure','missing runtime globals'])test(`${failure} retains the native selection and retries successfully`,async({page})=>{
    const errors=[];page.on('pageerror',error=>errors.push(error.message));
    const runtime='**/js/bible/translation-picker.js';
    let attempts=0;
    await page.route(runtime,route=>{attempts++;return failure==='network failure'?route.abort():route.fulfill({contentType:'application/javascript',body:'window.missingTranslationRuntime=true;'});});
    await page.setViewportSize({width:390,height:844});await openReader(page);
    await expect.poll(()=>attempts).toBe(1);
    await expect(page.locator('script[src="/js/bible/translation-picker.js"]')).toHaveCount(0);
    const native=page.locator('#readerTranslation');await native.focus();await native.selectOption('asv');
    await expect(page.locator('#readerTranslationStatus')).toContainText('Translation controls unavailable');
    await expect(native).toHaveValue('web');await expect(page.locator('#readerContent h2')).toHaveText('John 1');
    await page.unroute(runtime);await native.selectOption('asv');
    await expect.poll(()=>page.evaluate(()=>currentTranslation)).toBe('asv');
    await page.locator('#readAloudPlay').focus();await expect(page.locator('#readerTranslationTrigger')).toBeVisible();
    await expect(page.locator('#readerTranslationTrigger')).toHaveCount(1);
    expect(errors).toEqual([]);
  });
  test('the 10-second runtime timeout retries safely through late script and translation completion',async({page})=>{
    const runtimePath='/js/bible/translation-picker.js';
    const source=fs.readFileSync(path.join(__dirname,'..',runtimePath.slice(1)),'utf8');
    const errors=[];page.on('pageerror',error=>errors.push(error.message));
    let releaseOriginal,releaseRetry,attempts=0;
    const original=new Promise(resolve=>releaseOriginal=resolve),retry=new Promise(resolve=>releaseRetry=resolve);
    await page.route('**'+runtimePath,async route=>{
      const attempt=++attempts;
      await (attempt===1?original:retry);
      await route.fulfill({contentType:'application/javascript',body:source});
    });
    try{
      await page.setViewportSize({width:1280,height:900});await openReader(page);
      const epoch=new Date('2026-10-19T12:00:00Z');
      await page.clock.install({time:epoch});await page.clock.pauseAt(new Date(epoch.getTime()+1000));
      await page.setViewportSize({width:320,height:844});
      await expect.poll(()=>attempts).toBe(1);
      await page.evaluate(()=>{
        window.expiredRuntimeScript=document.querySelector('script[src="/js/bible/translation-picker.js"]');
        window.expiredRuntimeLoaded=new Promise(resolve=>expiredRuntimeScript.addEventListener('load',resolve,{once:true}));
        window.expiredTranslationResult=null;
        changeTranslation('asv').then(result=>{window.expiredTranslationResult=result;});
      });
      await page.clock.runFor(9999);
      expect(await page.evaluate(()=>window.expiredTranslationResult)).toBe(null);
      await expect(page.locator('script[src="'+runtimePath+'"]')).toHaveCount(1);
      await page.clock.runFor(1);
      await expect.poll(()=>page.evaluate(()=>window.expiredTranslationResult)).toBe(false);
      await expect(page.locator('script[src="'+runtimePath+'"]')).toHaveCount(0);
      await expect(page.locator('#readerTranslationStatus')).toContainText('Translation controls unavailable');
      await expect(page.locator('#readerTranslation')).toBeVisible();
      await expect(page.locator('#readerTranslation')).toHaveValue('web');
      await page.evaluate(()=>{
        window.retryTranslationResult=null;
        changeTranslation('dra').then(result=>{window.retryTranslationResult=result;});
        window.retryRuntimePromise=ReaderTranslationLoader.ensure();
      });
      await expect(page.locator('script[src="'+runtimePath+'"]')).toHaveCount(1);
      expect(await page.evaluate(()=>window.retryTranslationResult)).toBe(null);
      expect(await page.evaluate(()=>ReaderTranslationLoader.ensure()===retryRuntimePromise)).toBe(true);
      await expect(page.locator('#readerTranslationTrigger')).toHaveCount(0);
      await expect(page.locator('#readerTranslation')).toHaveValue('web');
      releaseRetry();releaseOriginal();
      await page.evaluate(()=>expiredRuntimeLoaded.then(()=>true));
      await page.clock.resume();
      await expect.poll(()=>page.evaluate(()=>window.retryTranslationResult)).toBe(true);
      await expect(page.locator('#readerTranslation')).toHaveValue('dra');
      await expect(page.locator('#readerTranslationTrigger')).toBeVisible();
      expect(await page.evaluate(()=>UserData.translation.load())).toBe('dra');
      await openPicker(page);await page.keyboard.press('Home');await page.keyboard.press('ArrowDown');
      await expect(page.locator('[data-translation="asv"]')).toBeFocused();
      await page.evaluate(()=>{
        window.currentPickerIdentity=ReaderTranslationPicker;
        const ensure=BibleTranslationLoader.ensure;
        BibleTranslationLoader.ensure=id=>id==='asv'?new Promise(resolve=>{
          window.finishStaleTranslation=()=>resolve(ensure(id));
        }):ensure(id);
        window.staleTranslation=changeTranslation('asv');
      });
      expect(await page.evaluate(()=>changeTranslation('web'))).toBe(true);
      expect(await page.evaluate(()=>{finishStaleTranslation();return staleTranslation;})).toBe(false);
      expect(await page.evaluate(()=>ReaderTranslationPicker===currentPickerIdentity)).toBe(true);
      expect(await page.evaluate(()=>ReaderTranslationLoader.ensure()===retryRuntimePromise)).toBe(true);
      await expect(page.locator('#readerTranslationTrigger')).toHaveCount(1);
      await expect(page.locator(dialogSelector)).toHaveCount(1);
      await expect(page.locator(dialogSelector)).toBeVisible();
      await expect(page.locator('[data-translation="asv"]')).toBeFocused();
      await expect(page.locator('[data-translation="web"]')).toHaveAttribute('aria-pressed','true');
      expect(await page.evaluate(()=>({translation:currentTranslation,persisted:UserData.translation.load(),expired:expiredTranslationResult})))
        .toEqual({translation:'web',persisted:'web',expired:false});
      console.log('Runtime timeout/retry network requests:',attempts);
      await page.keyboard.press('Escape');await expect(page.locator('#readerTranslationTrigger')).toBeFocused();
      expect(errors).toEqual([]);
    }finally{releaseOriginal();releaseRetry();}
  });
  test('a repeated or late runtime evaluation preserves the existing picker and fullscreen Escape behavior',async({page})=>{
    await page.setViewportSize({width:320,height:844});await openReader(page);
    await toggleReaderFullscreen(page);await openPicker(page);
    expect(await page.evaluate(async()=>{
      const identity=ReaderTranslationPicker;
      await new Promise((resolve,reject)=>{
        const script=document.createElement('script');script.src='/js/bible/translation-picker.js';
        script.onload=resolve;script.onerror=reject;document.head.appendChild(script);
      });
      return identity===ReaderTranslationPicker;
    })).toBe(true);
    await expect(page.locator('#readerTranslationTrigger')).toHaveCount(1);
    await expect(page.locator('#readerTranslationPicker')).toHaveCount(1);
    await page.keyboard.press('Escape');await expect(page.locator('#readerTranslationPicker')).not.toBeVisible();
    await expect(page.locator('#view-reader')).toHaveClass(/reader-fullscreen/);
    await expect(page.locator('#readerTranslationTrigger')).toBeFocused();
  });
});
