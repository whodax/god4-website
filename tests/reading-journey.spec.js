const { test, expect } = require('@playwright/test');

test.beforeEach(async ({page}) => {
  await page.addInitScript(() => {
    if(sessionStorage.getItem('journey-test-initialized')) return;
    localStorage.removeItem('god4.plan.completedDays');
    localStorage.removeItem('god4.plan.journey.v1');
    sessionStorage.setItem('journey-test-initialized','true');
    const NativeDate=Date;
    let fakeTime=new NativeDate('2026-01-10T12:00:00').getTime();
    window.setJourneyDate=(value)=>{ fakeTime=new NativeDate(value+'T12:00:00').getTime(); };
    window.Date=class extends NativeDate {
      constructor(...args){ super(...(args.length ? args : [fakeTime])); }
      static now(){ return fakeTime; }
    };
  });
  await page.addInitScript(() => {
    window.addEventListener('DOMContentLoaded', () => initializeBibleExperience());
  });
  await page.goto('/');
  await page.getByRole('button',{name:'Plan',exact:true}).click();
});

test('a navigation failure leaves the day incomplete',async ({page})=>{
  await page.evaluate(()=>{ window.navigateReaderToPassage=()=>Promise.resolve(false); });
  await page.locator('#planDays [data-plan-day="1"]').click();
  await page.waitForTimeout(30);
  expect(await page.evaluate(()=>UserData.journey.load().plans[0])).toEqual([]);
  await expect(page.locator('#planDone')).toHaveText('0 of 30 days completed');
});

test('reopening a completed reading navigates without changing counts or streak',async ({page})=>{
  const dayOne=page.locator('#planDays [data-plan-day="1"]');
  await dayOne.click();
  await expect(page.locator('#readerContent h2')).toHaveText('Matthew 1');
  await expect(page.locator('#planDone')).toHaveText('1 of 30 days completed');
  await expect(page.locator('#journeyStreak')).toHaveText('1 day streak');
  await page.getByRole('button',{name:'Plan',exact:true}).click();
  await page.locator('#planDays [data-plan-day="1"]').click();
  await expect(page.locator('#readerContent h2')).toHaveText('Matthew 1');
  await expect(page.locator('#planDone')).toHaveText('1 of 30 days completed');
  await expect(page.locator('#journeyTotal')).toHaveText('1 of 150 days completed');
  await expect(page.locator('#journeyStreak')).toHaveText('1 day streak');
});

test('same-day completions count separately and streak follows local calendar dates',async ({page})=>{
  for(const day of [1,2,3,4,5]){
    if(day>1) await page.getByRole('button',{name:'Plan',exact:true}).click();
    await page.locator('#planDays [data-plan-day="'+day+'"]').click();
    await expect(page.locator('#planDays [data-plan-day="'+day+'"][aria-pressed="true"]')).toHaveCount(1);
  }
  await expect(page.locator('#journeyTotal')).toHaveText('5 of 150 days completed');
  await expect(page.locator('#journeyStreak')).toHaveText('1 day streak');
  await page.evaluate(()=>setJourneyDate('2026-01-11'));
  await page.getByRole('button',{name:'Plan',exact:true}).click();
  await page.locator('#planDays [data-plan-day="6"]').click();
  await expect(page.locator('#journeyStreak')).toHaveText('2 day streak');
  await page.evaluate(()=>setJourneyDate('2026-01-14'));
  await page.getByRole('button',{name:'Plan',exact:true}).click();
  await page.locator('#planDays [data-plan-day="7"]').click();
  await expect(page.locator('#journeyTotal')).toHaveText('7 of 150 days completed');
  await expect(page.locator('#journeyStreak')).toHaveText('1 day streak');
  expect(await page.evaluate(()=>UserData.journey.load().completedDates)).toEqual(['2026-01-10','2026-01-11','2026-01-14']);
});

test('journey progress stays accessible and fits a narrow mobile viewport',async ({page})=>{
  await page.setViewportSize({width:320,height:720});
  await expect(page.locator('.plan-progress-bar')).toHaveAttribute('role','progressbar');
  await expect(page.locator('#journeyStatus')).toHaveAttribute('role','status');
  await expect(page.locator('#planDays button').first()).toHaveAccessibleName('Part 1 of 5, day 1: Matthew 1-2');
  const overflow=await page.evaluate(()=>({width:document.documentElement.scrollWidth,elements:Array.from(document.querySelectorAll('body *')).map(element=>({tag:element.tagName,id:element.id,className:typeof element.className==='string'?element.className:'',right:Math.round(element.getBoundingClientRect().right),left:Math.round(element.getBoundingClientRect().left)})).filter(item=>item.right>320||item.left<0).slice(0,12)}));
  expect(overflow.width,JSON.stringify(overflow.elements)).toBeLessThanOrEqual(320);
  const firstDay=page.locator('#planDays [data-plan-day="1"]');
  await firstDay.focus();
  await page.keyboard.press('Enter');
  await expect(page.locator('#readerContent h2')).toHaveText('Matthew 1');
  await expect(page.locator('#journeyTotal')).toHaveText('1 of 150 days completed');
});

test('legacy completed days migrate to Plan 1 without streak history',async ({page})=>{
  await page.evaluate(()=>{
    localStorage.removeItem('god4.plan.journey.v1');
    localStorage.setItem('god4.plan.completedDays','[1,3,3,31,"2"]');
  });
  await page.reload();
  await page.getByRole('button',{name:'Plan',exact:true}).click();
  await expect(page.locator('#planDone')).toHaveText('2 of 30 days completed');
  await expect(page.locator('#journeyTotal')).toHaveText('2 of 150 days completed');
  await expect(page.locator('#journeyStreak')).toHaveText('0 day streak');
  expect(await page.evaluate(()=>UserData.journey.load())).toEqual({version:1,plans:[[1,3],[],[],[],[]],completedDates:[]});
});

test('finishing a plan advances through all five parts to completion',async ({page})=>{
  for(let planIndex=0;planIndex<5;planIndex++){
    await page.evaluate((index)=>{
      var data=UserData.journey.load();
      data.plans[index]=Array.from({length:29},(_,day)=>day+1);
      UserData.journey.save(data);
      journeyState=UserData.journey.load();
      renderPlan();
    },planIndex);
    await page.getByRole('button',{name:'Plan',exact:true}).click();
    await page.locator('#planDays [data-plan-day="30"]').click();
    if(planIndex<4) await expect(page.locator('#planTitle')).toContainText('Part '+(planIndex+2)+' of 5');
    else {
      await expect(page.locator('#journeyStatus')).toHaveText('New Testament journey complete');
      await expect(page.locator('#journeyTotal')).toHaveText('150 of 150 days completed');
      await expect(page.locator('#planDays')).toContainText('You completed the full New Testament reading journey.');
    }
  }
});
