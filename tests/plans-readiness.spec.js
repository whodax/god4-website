const {expectPlanFocusVisible}=require('./plan-focus-helpers');
const {test,expect}=require('@playwright/test');

test.use({serviceWorkers:'block'});
test.beforeEach(async({page})=>{
  page.planErrors=[];
  page.on('pageerror',error=>page.planErrors.push(error.message));
  await page.addInitScript(()=>{
    window.IntersectionObserver=class {observe(){} unobserve(){} disconnect(){}};
    window.planStartup={renders:0,elements:0,lookups:0};
    for(const name of ['getElementById','querySelector','querySelectorAll']){
      const original=Document.prototype[name];
      Document.prototype[name]=function(...args){
        if(/\/plans\.js:/.test(new Error().stack||'')) planStartup.lookups++;
        return original.apply(this,args);
      };
    }
    const html=Object.getOwnPropertyDescriptor(Element.prototype,'innerHTML');
    Object.defineProperty(Element.prototype,'innerHTML',{...html,set(value){
      html.set.call(this,value);
      if(this.id==='planDays'){
        planStartup.renders++;
        planStartup.elements+=this.querySelectorAll('*').length;
      }
    }});
  });
  await page.goto('/');
});
test.afterEach(async({page})=>expect(page.planErrors).toEqual([]));

async function plans(page){await page.getByRole('button',{name:'Plan',exact:true}).click();}
async function holdBible(page){
  let release;
  const gate=new Promise(resolve=>release=resolve);
  let requests=0;
  await page.route('**/js/bible/web.js?*',async route=>{
    requests++;
    await gate;
    await route.continue().catch(()=>{});
  });
  return {release,requests:()=>requests};
}
async function openDay(page,day){await page.evaluate(day=>{window.planResult=openJourneyDay(day);},day);}
async function untouched(page){
  expect(await page.evaluate(()=>UserData.journey.load().plans)).toEqual([[],[],[],[],[]]);
  expect(await page.evaluate(()=>activePlanReadingSession)).toBeNull();
  expect(await page.evaluate(()=>history.state?.god4PlanReaderSession)).toBeFalsy();
}

test('Plans has one authoritative startup render and still clears orphaned history',async({page})=>{
  expect(await page.evaluate(()=>planStartup)).toEqual({renders:1,elements:90,lookups:12});
  await expect(page.locator('#planDays button')).toHaveCount(30);
  await expect(page.locator('#planDone')).toHaveText('0 of 30 days completed');
  await page.evaluate(()=>history.replaceState({god4PlanReaderSession:'orphan',other:'keep'},'',location.href));
  await page.reload();
  expect(await page.evaluate(()=>history.state)).toEqual({other:'keep'});
  expect(await page.evaluate(()=>planStartup.renders)).toBe(1);
});

test('cold native day activation awaits real Bible acquisition and creates the correct session',async({page})=>{
  const gate=await holdBible(page);
  try{
    await plans(page);
    expect(await page.evaluate(()=>bibleExperienceReady)).toBe(false);
    await page.locator('[data-plan-day="1"]').click();
    await expect(page.locator('#journeyStatus')).toHaveText('Preparing reading…');
    await expect.poll(gate.requests).toBe(1);
    await untouched(page);
    expect(await page.evaluate(()=>({day:pendingPlanNavigation.dayNumber,translation:pendingPlanNavigation.translationId,start:pendingPlanNavigation.start.chapter,end:pendingPlanNavigation.end.chapter}))).toEqual({day:1,translation:'web',start:1,end:2});
    gate.release();
    await expect(page.locator('#readerContent h2')).toHaveText('Matthew 1');
    expect(await page.evaluate(()=>activePlanReadingSession)).toMatchObject({planPart:1,day:1,translationId:'web',start:{bookId:'matthew',chapter:1,verse:1},end:{bookId:'matthew',chapter:2,verse:23},completionPending:false});
    expect(await page.evaluate(()=>UserData.journey.load().plans[0])).toEqual([1]);
    await page.locator('#readerBackToPlan').click();
    await expect(page.locator('#view-plan')).toHaveClass(/active/);
    await expect(page.locator('[data-plan-day="2"]')).toBeFocused();
  }finally{gate.release();}
});

test('failed readiness announces failure without progress or session and the same day can retry',async({page})=>{
  const fail=route=>route.abort();
  await page.route('**/js/bible/web.js?*',fail);
  await plans(page);
  await openDay(page,1);
  expect(await page.evaluate(()=>planResult)).toBe(false);
  await expect(page.locator('#journeyStatus')).toHaveText('Reading unavailable. Please try again when this Bible is available.');
  await expect(page.locator('#view-plan')).toHaveClass(/active/);
  await untouched(page);
  await page.unroute('**/js/bible/web.js?*',fail);
  await openDay(page,1);
  expect(await page.evaluate(()=>planResult)).toBe(true);
  await expect(page.locator('#readerContent h2')).toHaveText('Matthew 1');
  expect(await page.evaluate(()=>UserData.journey.load().plans[0])).toEqual([1]);
});

test('a thrown readiness failure resolves false and remains retryable',async({page})=>{
  await plans(page);
  await page.evaluate(()=>{window.originalBibleReady=initializeBibleExperience;initializeBibleExperience=()=>Promise.reject(new Error('Controlled readiness failure'));});
  expect(await page.evaluate(()=>openJourneyDay(1))).toBe(false);
  await untouched(page);
  await expect(page.locator('#journeyStatus')).toContainText('Reading unavailable');
  await page.evaluate(()=>{initializeBibleExperience=originalBibleReady;});
  expect(await page.evaluate(()=>openJourneyDay(1))).toBe(true);
});

test('latest day wins one shared delayed acquisition without completing the superseded day',async({page})=>{
  const gate=await holdBible(page);
  try{
    await plans(page);
    await page.evaluate(()=>{window.firstDay=openJourneyDay(1);window.secondDay=openJourneyDay(2);});
    await expect.poll(gate.requests).toBe(1);
    await untouched(page);
    gate.release();
    expect(await page.evaluate(async()=>[await firstDay,await secondDay])).toEqual([false,true]);
    await expect(page.locator('#readerContent h2')).toHaveText('Matthew 3');
    expect(await page.evaluate(()=>activePlanReadingSession.day)).toBe(2);
    expect(await page.evaluate(()=>UserData.journey.load().plans[0])).toEqual([2]);
  }finally{gate.release();}
});

for(const destination of ['Compare','Reader'])test(destination+' departure cancels pending Plan navigation and preserves focus',async({page})=>{
  const gate=await holdBible(page);
  try{
    await plans(page);await openDay(page,1);
    await expect.poll(gate.requests).toBe(1);
    const tab=page.getByRole('button',{name:destination,exact:true});
    await tab.click();
    expect(await page.evaluate(()=>pendingPlanNavigation)).toBeNull();
    gate.release();
    expect(await page.evaluate(()=>planResult)).toBe(false);
    await expect(page.locator('#view-'+destination.toLowerCase())).toHaveClass(/active/);
    await expect(tab).toBeFocused();
    await untouched(page);
    await expect(page.locator('#journeyStatus')).toHaveText('');
  }finally{gate.release();}
});

test('translation request invalidates a pending day even before the new translation resolves',async({page})=>{
  const gate=await holdBible(page);
  let releaseTranslation;
  const translationGate=new Promise(resolve=>releaseTranslation=resolve);
  await page.route('**/js/bible/asv.js?*',async route=>{await translationGate;await route.continue().catch(()=>{});});
  try{
    await plans(page);await openDay(page,1);
    await expect.poll(gate.requests).toBe(1);
    await page.evaluate(()=>{window.translationResult=changeTranslation('asv');});
    expect(await page.evaluate(()=>currentTranslation)).toBe('web');
    expect(await page.evaluate(()=>pendingPlanNavigation)).toBeNull();
    gate.release();
    expect(await page.evaluate(()=>planResult)).toBe(false);
    await untouched(page);
    releaseTranslation();
    expect(await page.evaluate(()=>translationResult)).toBe(true);
    expect(await page.evaluate(()=>currentTranslation)).toBe('asv');
    expect(await page.evaluate(()=>openJourneyDay(1))).toBe(true);
    expect(await page.evaluate(()=>activePlanReadingSession.translationId)).toBe('asv');
  }finally{gate.release();releaseTranslation();}
});

test('superseding manual Reader action wins without completing the pending Plan day',async({page})=>{
  const gate=await holdBible(page);
  try{
    await plans(page);await openDay(page,1);
    await expect.poll(gate.requests).toBe(1);
    await page.evaluate(()=>{window.readerResult=runWithBibleExperience(()=>navigateReaderToPassage('john',2,1));});
    gate.release();
    expect(await page.evaluate(()=>planResult)).toBe(false);
    expect(await page.evaluate(()=>readerResult)).toBe(true);
    await expect(page.locator('#readerContent h2')).toHaveText('John 2');
    await untouched(page);
  }finally{gate.release();}
});

test('a changed Journey part invalidates its pending day',async({page})=>{
  const gate=await holdBible(page);
  try{
    await plans(page);await openDay(page,1);
    await expect.poll(gate.requests).toBe(1);
    await page.evaluate(()=>{journeyState.plans[0]=Array.from({length:30},(_,i)=>i+1);UserData.journey.save(journeyState);renderPlan();});
    gate.release();
    expect(await page.evaluate(()=>planResult)).toBe(false);
    expect(await page.evaluate(()=>activePlanReadingSession)).toBeNull();
    expect(await page.evaluate(()=>journeyState.plans[1])).toEqual([]);
    await expect(page.locator('#view-plan')).toHaveClass(/active/);
  }finally{gate.release();}
});

test('browser history during readiness invalidates pending navigation',async({page})=>{
  const gate=await holdBible(page);
  try{
    await plans(page);await openDay(page,1);
    await expect.poll(gate.requests).toBe(1);
    await page.evaluate(()=>window.dispatchEvent(new PopStateEvent('popstate',{state:null})));
    gate.release();
    expect(await page.evaluate(()=>planResult)).toBe(false);
    await untouched(page);
  }finally{gate.release();}
});

test('cold successful navigation retains browser Back and reload session boundaries',async({page})=>{
  await plans(page);
  expect(await page.evaluate(()=>openJourneyDay(1))).toBe(true);
  await page.goBack();
  await expect(page.locator('#view-plan')).toHaveClass(/active/);
  await expect(page.locator('[data-plan-day="2"]')).toBeFocused();
  expect(await page.evaluate(()=>openJourneyDay(2))).toBe(true);
  await page.reload();
  expect(await page.evaluate(()=>activePlanReadingSession)).toBeNull();
  await expect(page.locator('#readerBackToPlan')).toBeHidden();
  expect(await page.evaluate(()=>UserData.journey.load().plans[0])).toEqual([1,2]);
});

test('cold final Journey day completes only at its existing final manual boundary',async({page})=>{
  await page.evaluate(()=>{journeyState.plans=Array.from({length:5},(_,part)=>Array.from({length:part===4?29:30},(_,i)=>i+1));UserData.journey.save(journeyState);renderPlan();});
  await plans(page);
  expect(await page.evaluate(()=>openJourneyDay(30))).toBe(true);
  expect(await page.evaluate(()=>activePlanReadingSession.completionPending)).toBe(true);
  expect(await page.evaluate(()=>UserData.journey.load().plans[4].length)).toBe(29);
  await page.locator('[data-reader-action="next"]').first().click();
  await expect(page.locator('#view-plan')).toHaveClass(/active/);
  await expect(page.locator('#journeyTotal')).toHaveText('0 of 150 days completed');
  await expect(page.locator('[data-plan-day="1"]')).toBeFocused();
});

test('malformed Journey data retains existing validation and legacy fallback',async({page})=>{
  await page.evaluate(()=>localStorage.setItem('god4.plan.journey.v1',JSON.stringify({version:1,plans:[[1,1,31,'2'],null],completedDates:['2026-01-01','bad','2026-02-31']})));
  await page.reload();
  expect(await page.evaluate(()=>journeyState)).toEqual({version:1,plans:[[1],[],[],[],[]],completedDates:['2026-01-01']});
  await page.evaluate(()=>{localStorage.setItem('god4.plan.completedDays','[2,2,3,31]');localStorage.setItem('god4.plan.journey.v1','{broken');});
  await page.reload();
  expect(await page.evaluate(()=>journeyState)).toEqual({version:1,plans:[[2,3],[],[],[],[]],completedDates:[]});
});

for(const [width,key] of [[390,'Enter'],[320,'Space']])test('cold keyboard activation and return focus reflow at '+width+'px',async({page})=>{
  await page.setViewportSize({width,height:720});
  const gate=await holdBible(page);
  try{
    await plans(page);
    const day=page.locator('[data-plan-day="1"]');
    await page.keyboard.press('Tab');
    await expect(page.locator('#offlineBiblesTrigger')).toBeFocused();
    await page.keyboard.press('Tab');
    await expectPlanFocusVisible(page,day);
    await page.keyboard.press(key);
    await expect(page.locator('#journeyStatus')).toHaveText('Preparing reading…');
    await expectPlanFocusVisible(page,day);
    await expect(page.locator('#journeyStatus')).toHaveAttribute('aria-live','polite');
    await expect(page.locator('#journeyStatus')).toHaveAttribute('aria-atomic','true');
    expect(await page.evaluate(()=>document.documentElement.scrollWidth)).toBeLessThanOrEqual(width);
    gate.release();
    await expect(page.locator('#readerContent h2')).toHaveText('Matthew 1');
    await page.locator('#readerBackToPlan').press('Enter');
    await expectPlanFocusVisible(page,page.locator('[data-plan-day="2"]'));
    await expect(page.locator('[data-plan-day="1"]')).toHaveAttribute('aria-pressed','true');
    await expect(page.locator('.plan-progress-bar')).toHaveAttribute('aria-valuenow','1');
    expect(await page.evaluate(()=>document.documentElement.scrollWidth)).toBeLessThanOrEqual(width);
  }finally{gate.release();}
});

test('cold session translation refresh preserves progress and assigned ranges',async({page})=>{
  await plans(page);
  expect(await page.evaluate(()=>openJourneyDay(1))).toBe(true);
  const before=await page.evaluate(()=>({readings:activePlanReadingSession.readings,progress:UserData.journey.load()}));
  expect(await page.evaluate(()=>changeTranslation('asv'))).toBe(true);
  expect(await page.evaluate(()=>activePlanReadingSession)).toMatchObject({translationId:'asv',readings:before.readings,end:{bookId:'matthew',chapter:2,verse:23}});
  expect(await page.evaluate(()=>UserData.journey.load())).toEqual(before.progress);
  await page.locator('#readerBackToPlan').click();
  await expect(page.locator('[data-plan-day="2"]')).toBeFocused();
});

test('cold Plan session speech completes at its daily boundary and returns once',async({page})=>{
  await page.evaluate(()=>{
    BibleCloudTTS.available=()=>false;
    window.planUtterances=[];
    window.SpeechSynthesisUtterance=function(text){this.text=text;};
    Object.defineProperty(window,'speechSynthesis',{configurable:true,value:{getVoices(){return [];},cancel(){},pause(){},resume(){},speak(utterance){planUtterances.push(utterance);utterance.onstart();}}});
  });
  await plans(page);
  expect(await page.evaluate(()=>openJourneyDay(1))).toBe(true);
  await page.locator('#readAloudPlay').click();
  await page.evaluate(()=>{for(var verse=0;verse<48;verse++)planUtterances[verse].onend();});
  await expect(page.locator('#view-plan')).toHaveClass(/active/);
  await expect(page.locator('[data-plan-day="2"]')).toBeFocused();
  expect(await page.evaluate(()=>({count:planUtterances.length,state:BibleSpeech.getState(),session:activePlanReadingSession,progress:UserData.journey.load().plans[0]}))).toEqual({count:48,state:'idle',session:null,progress:[1]});
});
