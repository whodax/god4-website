const {test,expect}=require('@playwright/test');
const {expectPlanFocusVisible}=require('./plan-focus-helpers');

test.use({serviceWorkers:'block'});
test.beforeEach(async({page})=>{
  page.planErrors=[];
  page.on('pageerror',error=>page.planErrors.push(error.message));
  await page.addInitScript(()=>{window.IntersectionObserver=class {observe(){} unobserve(){} disconnect(){}};});
  await page.goto('/');
  await page.evaluate(()=>document.fonts.ready);
});
test.afterEach(async({page})=>expect(page.planErrors).toEqual([]));

async function planKeyboard(page){
  await page.getByRole('button',{name:'Plan',exact:true}).press('Enter');
  await page.keyboard.press('Tab');
  await expect(page.locator('#offlineBiblesTrigger')).toBeFocused();
  await page.keyboard.press('Tab');
  await expect(page.locator('[data-plan-day="1"]')).toBeFocused();
}
async function holdBible(page,fail=false){
  let release;
  const gate=new Promise(resolve=>release=resolve);
  await page.route('**/js/bible/web.js?*',async route=>{
    await gate;
    if(fail) await route.abort().catch(()=>{});
    else await route.continue().catch(()=>{});
  });
  return release;
}
async function twoFrames(page){await page.evaluate(()=>new Promise(resolve=>requestAnimationFrame(()=>requestAnimationFrame(resolve))));}
async function queuePlanFrames(page){
  await page.evaluate(()=>{
    window.planFrames=[];
    window.planScrolls=[];
    const frame=window.requestAnimationFrame,scroll=window.scrollBy;
    window.requestAnimationFrame=function(callback){
      if(/\/plans\.js:/.test(new Error().stack||'')){planFrames.push(callback);return -planFrames.length;}
      return frame.call(window,callback);
    };
    window.scrollBy=function(...args){
      const caller=(new Error().stack||'').split('\n')[2]||'';
      if(/\/plans\.js:/.test(caller)) planScrolls.push(args[0]);
      return scroll.apply(window,args);
    };
    window.flushPlanFrames=()=>{const frames=planFrames.splice(0);frames.forEach(callback=>callback(performance.now()));};
  });
}

for(const [width,key] of [[390,'Enter'],[320,'Space']]){
  test('focused preparation, delayed readiness and cold return fit '+width+'x720',async({page})=>{
    await page.setViewportSize({width,height:720});
    const release=await holdBible(page);
    try{
      await planKeyboard(page);
      const day=page.locator('[data-plan-day="1"]');
      const before=await expectPlanFocusVisible(page,day);
      await page.keyboard.press(key);
      await expect(page.locator('#journeyStatus')).toHaveText('Preparing reading…');
      const preparing=await expectPlanFocusVisible(page,day);
      await twoFrames(page);
      const pending=await expectPlanFocusVisible(page,day);
      expect(await page.evaluate(()=>journeyState.plans[0])).toEqual([]);
      expect(await page.evaluate(()=>activePlanReadingSession)).toBeNull();
      release();
      await expect(page.locator('#readerContent h2')).toHaveText('Matthew 1');
      await page.locator('#readerBackToPlan').press('Enter');
      const returned=await expectPlanFocusVisible(page,page.locator('[data-plan-day="2"]'));
      console.log('PLAN_RECTANGLES',JSON.stringify({width,before,preparing,pending,returned}));
    }finally{release();}
  });

  test('readiness failure keeps the same focused day fully visible at '+width+'x720',async({page})=>{
    await page.setViewportSize({width,height:720});
    const release=await holdBible(page,true);
    try{
      await planKeyboard(page);
      const day=page.locator('[data-plan-day="1"]');
      await expectPlanFocusVisible(page,day);
      await page.keyboard.press(key);
      await expect(page.locator('#journeyStatus')).toHaveText('Preparing reading…');
      await expectPlanFocusVisible(page,day);
      release();
      await expect(page.locator('#journeyStatus')).toContainText('Reading unavailable');
      const failure=await expectPlanFocusVisible(page,day);
      expect(await page.evaluate(()=>journeyState.plans[0])).toEqual([]);
      expect(await page.evaluate(()=>activePlanReadingSession)).toBeNull();
      console.log('PLAN_FAILURE_RECTANGLE',JSON.stringify({width,failure}));
    }finally{release();}
  });

  test('fullscreen Reader return preserves the next-day target and outline at '+width+'x720',async({page})=>{
    await page.setViewportSize({width,height:720});
    await planKeyboard(page);
    await page.keyboard.press(key);
    await expect(page.locator('#readerContent h2')).toHaveText('Matthew 1');
    await page.locator('#fullscreenBtn').press('Enter');
    await expect(page.locator('#view-reader')).toHaveClass(/reader-fullscreen/);
    await page.locator('#readerBackToPlan').press('Enter');
    await expect(page.locator('#view-reader')).not.toHaveClass(/reader-fullscreen/);
    await expectPlanFocusVisible(page,page.locator('[data-plan-day="2"]'));
  });
}

test('fully visible desktop focus does not trigger a scroll or horizontal movement',async({page})=>{
  await page.setViewportSize({width:1440,height:900});
  const release=await holdBible(page);
  try{
    await planKeyboard(page);
    await expectPlanFocusVisible(page,page.locator('[data-plan-day="1"]'));
    await page.evaluate(()=>{
      const box=document.activeElement.getBoundingClientRect();
      window.scrollBy({top:(box.top+box.bottom)/2-innerHeight/2,left:0,behavior:'instant'});
    });
    await twoFrames(page);
    const before=await page.evaluate(()=>({x:scrollX,y:scrollY}));
    await page.keyboard.press('Enter');
    await expect(page.locator('#journeyStatus')).toHaveText('Preparing reading…');
    await expectPlanFocusVisible(page,page.locator('[data-plan-day="1"]'));
    expect(await page.evaluate(()=>({x:scrollX,y:scrollY}))).toEqual(before);
  }finally{release();}
});

for(const destination of ['Compare','Reader'])test('queued Plan correction cannot scroll after leaving for '+destination,async({page})=>{
  await page.setViewportSize({width:320,height:720});
  const release=await holdBible(page);
  try{
    await planKeyboard(page);
    await expectPlanFocusVisible(page,page.locator('[data-plan-day="1"]'));
    await queuePlanFrames(page);
    await page.keyboard.press('Enter');
    await expect(page.locator('#journeyStatus')).toHaveText('Preparing reading…');
    expect(await page.evaluate(()=>planFrames.length)).toBeGreaterThan(0);
    await page.getByRole('button',{name:destination,exact:true}).click();
    await page.evaluate(()=>flushPlanFrames());
    expect(await page.evaluate(()=>planScrolls)).toEqual([]);
    release();
    await page.evaluate(()=>initializeBibleExperience());
    await twoFrames(page);
    expect(await page.evaluate(()=>planScrolls)).toEqual([]);
    expect(await page.evaluate(()=>activePlanReadingSession)).toBeNull();
    expect(await page.evaluate(()=>journeyState.plans[0])).toEqual([]);
    await expect(page.getByRole('button',{name:destination,exact:true})).toBeFocused();
  }finally{release();}
});

test('translation invalidation rejects a queued scroll even while the old day remains focused',async({page})=>{
  await page.setViewportSize({width:320,height:720});
  const release=await holdBible(page);
  try{
    await planKeyboard(page);
    const day=page.locator('[data-plan-day="1"]');
    await expectPlanFocusVisible(page,day);
    await queuePlanFrames(page);
    await page.keyboard.press('Space');
    await expect(page.locator('#journeyStatus')).toHaveText('Preparing reading…');
    await page.evaluate(()=>{window.translationResult=changeTranslation('asv');flushPlanFrames();});
    expect(await page.evaluate(()=>planScrolls)).toEqual([]);
    await expect(day).toBeFocused();
    release();
    await page.evaluate(()=>translationResult);
    await twoFrames(page);
    expect(await page.evaluate(()=>planScrolls)).toEqual([]);
    expect(await page.evaluate(()=>activePlanReadingSession)).toBeNull();
    expect(await page.evaluate(()=>journeyState.plans[0])).toEqual([]);
  }finally{release();}
});

test('only the superseding focused day can apply a queued correction',async({page})=>{
  await page.setViewportSize({width:320,height:720});
  const release=await holdBible(page);
  try{
    await planKeyboard(page);
    await expectPlanFocusVisible(page,page.locator('[data-plan-day="1"]'));
    await queuePlanFrames(page);
    await page.keyboard.press('Enter');
    await expect(page.locator('#journeyStatus')).toHaveText('Preparing reading…');
    await page.keyboard.press('Tab');
    await page.keyboard.press('Space');
    await expect(page.locator('[data-plan-day="2"]')).toBeFocused();
    await page.evaluate(()=>flushPlanFrames());
    await expectPlanFocusVisible(page,page.locator('[data-plan-day="2"]'));
    expect(await page.evaluate(()=>pendingPlanNavigation.dayNumber)).toBe(2);
    release();
    await expect(page.locator('#readerContent h2')).toHaveText('Matthew 3');
    expect(await page.evaluate(()=>journeyState.plans[0])).toEqual([2]);
  }finally{release();}
});

test('successful Reader handoff rejects any deferred Plan scroll',async({page})=>{
  await page.setViewportSize({width:320,height:720});
  const release=await holdBible(page);
  try{
    await planKeyboard(page);
    await expectPlanFocusVisible(page,page.locator('[data-plan-day="1"]'));
    await queuePlanFrames(page);
    await page.keyboard.press('Enter');
    await expect(page.locator('#journeyStatus')).toHaveText('Preparing reading…');
    release();
    await expect(page.locator('#readerContent h2')).toHaveText('Matthew 1');
    await page.evaluate(()=>flushPlanFrames());
    expect(await page.evaluate(()=>planScrolls)).toEqual([]);
    await expect(page.locator('#readerContent [data-verse-number="1"]')).toBeFocused();
  }finally{release();}
});

test('changed native focus cannot be stolen by an older correction',async({page})=>{
  const release=await holdBible(page);
  try{
    await planKeyboard(page);
    await expectPlanFocusVisible(page,page.locator('[data-plan-day="1"]'));
    await queuePlanFrames(page);
    await page.keyboard.press('Enter');
    await expect(page.locator('#journeyStatus')).toHaveText('Preparing reading…');
    await page.locator('#planHeading').focus();
    await page.evaluate(()=>flushPlanFrames());
    await expect(page.locator('#planHeading')).toBeFocused();
    expect(await page.evaluate(()=>planScrolls)).toEqual([]);
  }finally{release();}
});

test('focus correction clears the existing sticky header boundary without horizontal scroll',async({page})=>{
  await page.setViewportSize({width:320,height:720});
  const release=await holdBible(page);
  try{
    await planKeyboard(page);
    const day=page.locator('[data-plan-day="1"]');
    await expectPlanFocusVisible(page,day);
    await page.evaluate(()=>{
      const rect=document.activeElement.getBoundingClientRect();
      window.scrollBy({top:rect.top-readerVisibleTop()+8,left:0,behavior:'instant'});
    });
    await page.keyboard.press('Space');
    await expect(page.locator('#journeyStatus')).toHaveText('Preparing reading…');
    await expectPlanFocusVisible(page,day);
  }finally{release();}
});

test('completed Journey retains heading fallback and makes it fully visible',async({page})=>{
  await page.setViewportSize({width:320,height:720});
  await planKeyboard(page);
  await page.evaluate(()=>{
    journeyState.plans=Array.from({length:5},()=>Array.from({length:30},(_,i)=>i+1));
    renderPlan();focusNextJourneyDay();
  });
  await expectPlanFocusVisible(page,page.locator('#planHeading'));
});


test('settled focus-outline animation is rechecked without changing focus',async({page})=>{
  await page.setViewportSize({width:390,height:720});
  const release=await holdBible(page);
  try{
    await planKeyboard(page);
    const day=page.locator('[data-plan-day="1"]');
    await expectPlanFocusVisible(page,day);
    await page.evaluate(()=>{window.outlineAnimation=document.activeElement.animate([
      {outlineWidth:'2px',outlineOffset:'2px'},{outlineWidth:'6px',outlineOffset:'6px'}
    ],{duration:150,fill:'forwards'});});
    await page.keyboard.press('Enter');
    await expect(page.locator('#journeyStatus')).toHaveText('Preparing reading…');
    await page.evaluate(()=>outlineAnimation.finished);
    await expectPlanFocusVisible(page,day);
    expect(await day.evaluate(element=>getComputedStyle(element).outlineWidth)).toBe('6px');
  }finally{release();}
});


for(const action of ['Compare','translation'])test('settled animation cannot replay a scroll after '+action+' cancellation',async({page})=>{
  await page.setViewportSize({width:320,height:720});
  const release=await holdBible(page);
  try{
    await planKeyboard(page);
    await expectPlanFocusVisible(page,page.locator('[data-plan-day="1"]'));
    await queuePlanFrames(page);
    await page.evaluate(action=>{
      window.oldFocusAnimation=document.activeElement.animate([
        {outlineWidth:'2px',outlineOffset:'2px'},{outlineWidth:'6px',outlineOffset:'6px'}
      ],{duration:150,fill:'forwards'});
      window.oldPlanResult=openJourneyDay(1);
      if(action==='Compare') switchView('compare',document.querySelector('[aria-controls="view-compare"]'));
      else window.newTranslationResult=changeTranslation('asv');
    },action);
    await page.evaluate(()=>oldFocusAnimation.finished);
    await page.evaluate(()=>flushPlanFrames());
    expect(await page.evaluate(()=>planScrolls)).toEqual([]);
    release();
    expect(await page.evaluate(()=>oldPlanResult)).toBe(false);
    if(action==='translation') await page.evaluate(()=>newTranslationResult);
    expect(await page.evaluate(()=>journeyState.plans[0])).toEqual([]);
    expect(await page.evaluate(()=>activePlanReadingSession)).toBeNull();
  }finally{release();}
});
