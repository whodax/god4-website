const {test, expect} = require('@playwright/test');

test.use({hasTouch:true});

async function openOfflinePlan(page, context, width){
  await page.setViewportSize({width,height:720});
  await page.addInitScript(()=>{window.IntersectionObserver=class {observe(){} unobserve(){} disconnect(){}};});
  await page.goto('/');
  await page.evaluate(()=>navigator.serviceWorker.ready.then(()=>true));
  if(!await page.evaluate(()=>Boolean(navigator.serviceWorker.controller))) await page.reload({waitUntil:'domcontentloaded'});
  expect(await page.evaluate(()=>BibleTranslationLoader.retain('web'))).toMatchObject({ok:true});
  await page.reload({waitUntil:'domcontentloaded'});
  await page.evaluate(()=>document.fonts.ready);
  await context.setOffline(true);
  await page.getByRole('button',{name:'Plan',exact:true}).click();
  expect(await page.evaluate(()=>openJourneyDay(1))).toBe(true);
  await expect(page.locator('#readerBackToPlan')).toBeVisible();
  await expect(page.locator('#pwaStatus')).toBeVisible();
}

async function returnGeometry(page){
  return page.evaluate(()=>{
    const button=document.getElementById('readerBackToPlan');
    const status=document.getElementById('pwaStatus');
    const b=button.getBoundingClientRect(), s=status.getBoundingClientRect();
    const style=element=>{const c=getComputedStyle(element);return {position:c.position,zIndex:c.zIndex,pointerEvents:c.pointerEvents};};
    return {button:b.toJSON(),status:s.toJSON(),buttonStyle:style(button),statusStyle:style(status),
      hit:document.elementFromPoint(b.x+b.width/2,b.y+b.height/2)?.id,
      overlap:b.left<s.right&&b.right>s.left&&b.top<s.bottom&&b.bottom>s.top,
      overflow:document.documentElement.scrollWidth>innerWidth};
  });
}

for(const width of [390,320])for(const fullscreen of [false,true])for(const activation of ['mouse','touch']){
  test('offline Plan return '+activation+' at '+width+(fullscreen?' fullscreen':' normal'),async({page,context})=>{
    await openOfflinePlan(page,context,width);
    if(fullscreen) await page.locator('#fullscreenBtn').click();
    const geometry=await returnGeometry(page);
    // Raw input reproduces actual hit testing, without keyboard or DOM click workarounds.
    const x=geometry.button.x+geometry.button.width/2, y=geometry.button.y+geometry.button.height/2;
    if(activation==='touch') await page.touchscreen.tap(x,y); else await page.mouse.click(x,y);
    await expect(page.locator('#view-plan')).toHaveClass(/active/);
    expect(geometry.hit).toBe('readerBackToPlan');
    expect(geometry.overlap).toBe(false);
    expect(geometry.button.top-geometry.status.bottom).toBeGreaterThanOrEqual(12);
    expect(geometry.status.top).toBeGreaterThanOrEqual(0);
    expect(geometry.overflow).toBe(false);
    await expect(page.locator('[data-plan-day="2"]')).toBeFocused();
    expect(await page.evaluate(()=>journeyState.plans[0])).toEqual([1]);
    await expect(page.locator('#view-reader')).not.toHaveClass(/reader-fullscreen/);
    await expect(page.locator('#pwaStatus')).toBeVisible();
    expect(await page.locator('#pwaStatus').evaluate(element=>getComputedStyle(element).bottom)).toBe('18px');
    await expect(page.locator('#pwaStatus')).toHaveAttribute('role','status');
    await expect(page.locator('#pwaStatusMessage')).toContainText('You are offline');
  });
}

for(const width of [390,320])for(const key of ['Enter','Space']){
  test('offline Plan return retains '+key+' and visible focus at '+width,async({page,context})=>{
    await openOfflinePlan(page,context,width);
    const back=page.locator('#readerBackToPlan');
    await back.focus();
    await page.keyboard.press('Shift');
    expect(await back.evaluate(element=>{const s=getComputedStyle(element);return element.matches(':focus-visible')&&s.outlineStyle!=='none'&&parseFloat(s.outlineWidth)>0;})).toBe(true);
    expect((await returnGeometry(page)).overlap).toBe(false);
    await page.keyboard.press(key);
    await expect(page.locator('[data-plan-day="2"]')).toBeFocused();
  });
}

for(const width of [390,320]){
  test('offline browser Back preserves Plan completion at '+width,async({page,context})=>{
    await openOfflinePlan(page,context,width);
    await page.goBack();
    await expect(page.locator('#view-plan')).toHaveClass(/active/);
    await expect(page.locator('[data-plan-day="2"]')).toBeFocused();
    expect(await page.evaluate(()=>journeyState.plans[0])).toEqual([1]);
    await expect(page.locator('#readerBackToPlan')).toBeHidden();
    await expect(page.locator('#pwaStatus')).toBeVisible();
  });

  test('offline Reader navigation and speech completion return to Plan at '+width,async({page,context})=>{
    await page.addInitScript(()=>{
      window.__offlineSpeech=[];
      Object.defineProperty(window,'AudioContext',{configurable:true,value:undefined});
      Object.defineProperty(window,'webkitAudioContext',{configurable:true,value:undefined});
      Object.defineProperty(window,'SpeechSynthesisUtterance',{configurable:true,value:function(text){this.text=text;}});
      Object.defineProperty(window,'speechSynthesis',{configurable:true,value:{
        speak(utterance){window.__offlineSpeech.push(utterance);if(utterance.onstart)utterance.onstart();},
        pause(){},resume(){},cancel(){},getVoices(){return [];}
      }});
    });
    await openOfflinePlan(page,context,width);
    await page.locator('[data-reader-action="next"]').first().click();
    await expect(page.locator('#readerContent h2')).toHaveText('Matthew 2');
    await page.locator('#readAloudPlay').click();
    expect(await page.evaluate(()=>__offlineSpeech.length)).toBeGreaterThan(0);
    await page.evaluate(()=>{
      let index=0;
      while(BibleSpeech.getState()==='playing'&&index<100){
        const utterance=window.__offlineSpeech[index++];
        if(!utterance) break;
        utterance.onend();
      }
    });
    await expect(page.locator('#view-plan')).toHaveClass(/active/);
    await expect(page.locator('#journeyStatus')).toHaveText('Daily reading complete. Returning to Plan.');
    await expect(page.locator('[data-plan-day="2"]')).toBeFocused();
    expect(await page.evaluate(()=>journeyState.plans[0])).toEqual([1]);
    await expect(page.locator('#pwaStatus')).toBeVisible();
    expect(await page.locator('#pwaStatus').evaluate(element=>getComputedStyle(element).bottom)).toBe('18px');
  });
}
