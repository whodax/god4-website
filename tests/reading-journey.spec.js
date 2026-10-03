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
  await expect(page.locator('#journeyStreak')).toHaveText('1-day streak');
  await page.getByRole('button',{name:'Plan',exact:true}).click();
  await page.locator('#planDays [data-plan-day="1"]').click();
  await expect(page.locator('#readerContent h2')).toHaveText('Matthew 1');
  await expect(page.locator('#planDone')).toHaveText('1 of 30 days completed');
  await expect(page.locator('#journeyTotal')).toHaveText('1 of 150 days completed');
  await expect(page.locator('#journeyStreak')).toHaveText('1-day streak');
});

test('same-day completions count separately and streak follows local calendar dates',async ({page})=>{
  for(const day of [1,2,3,4,5]){
    if(day>1) await page.getByRole('button',{name:'Plan',exact:true}).click();
    await page.locator('#planDays [data-plan-day="'+day+'"]').click();
    await expect(page.locator('#planDays [data-plan-day="'+day+'"][aria-pressed="true"]')).toHaveCount(1);
  }
  await expect(page.locator('#journeyTotal')).toHaveText('5 of 150 days completed');
  await expect(page.locator('#journeyStreak')).toHaveText('1-day streak');
  await page.evaluate(()=>setJourneyDate('2026-01-11'));
  await page.getByRole('button',{name:'Plan',exact:true}).click();
  await page.locator('#planDays [data-plan-day="6"]').click();
  await expect(page.locator('#journeyStreak')).toHaveText('2-day streak');
  await page.evaluate(()=>setJourneyDate('2026-01-14'));
  await page.getByRole('button',{name:'Plan',exact:true}).click();
  await page.locator('#planDays [data-plan-day="7"]').click();
  await expect(page.locator('#journeyTotal')).toHaveText('7 of 150 days completed');
  await expect(page.locator('#journeyStreak')).toHaveText('1-day streak');
  expect(await page.evaluate(()=>UserData.journey.load().completedDates)).toEqual(['2026-01-10','2026-01-11','2026-01-14']);
});

test('journey progress stays accessible and fits a narrow mobile viewport',async ({page})=>{
  for(const width of [320,375,480]){
    await page.setViewportSize({width,height:720});
    await expect.poll(()=>page.evaluate(()=>document.documentElement.scrollWidth)).toBeLessThanOrEqual(width);
  }
  await expect(page.locator('.plan-progress-bar')).toHaveAttribute('role','progressbar');
  await expect(page.locator('#journeyStatus')).toHaveAttribute('role','status');
  await expect(page.getByRole('group',{name:'New Testament journey progress'})).toContainText('Part 1 of 5');
  await expect(page.locator('#planStats').getByText('Part 1 of 5',{exact:true})).toHaveCount(1);
  await expect(page.locator('#journeyStatus')).toBeEmpty();
  await expect(page.locator('#planDays button').first()).toHaveAccessibleName('Part 1 of 5, day 1: Matthew 1-2');
  await page.setViewportSize({width:320,height:720});
  const firstDay=page.locator('#planDays [data-plan-day="1"]');
  await firstDay.focus();
  await page.keyboard.press('Enter');
  await expect(page.locator('#readerContent h2')).toHaveText('Matthew 1');
  await expect(page.locator('#journeyTotal')).toHaveText('1 of 150 days completed');
});

test('Back to Plan is hidden in ordinary Reader and returns focus after a plan reading',async ({page})=>{
  await page.getByRole('button',{name:'Reader',exact:true}).click();
  await expect(page.locator('#readerBackToPlan')).toBeHidden();
  await page.getByRole('button',{name:'Plan',exact:true}).click();
  await page.locator('#planDays [data-plan-day="5"]').click();
  const back=page.getByRole('button',{name:'Return to the reading plan'});
  await expect(back).toBeVisible();
  expect(await page.evaluate(()=>activePlanReadingSession.day)).toBe(5);
  await back.focus();
  await expect(back).toBeFocused();
  await page.keyboard.press('Enter');
  await expect(page.locator('#view-plan')).toHaveClass(/active/);
  await expect(page.locator('#planHeading')).toBeFocused();
  await expect(back).toBeHidden();
  expect(await page.evaluate(()=>activePlanReadingSession)).toBeNull();
  await expect(page.locator('#journeyTotal')).toHaveText('1 of 150 days completed');
});

test('Back to Plan uses one control in fullscreen and returns to the same Plan view',async ({page})=>{
  await page.locator('#planDays [data-plan-day="1"]').click();
  const back=page.locator('#readerBackToPlan');
  await expect(back).toBeVisible();
  await page.locator('#fullscreenBtn').click();
  await expect(page.locator('#view-reader')).toHaveClass(/reader-fullscreen/);
  await expect(page.locator('#readerBackToPlan')).toHaveCount(1);
  await back.click();
  await expect(page.locator('#view-reader')).not.toHaveClass(/reader-fullscreen/);
  await expect(page.locator('#view-plan')).toHaveClass(/active/);
  await expect(page.locator('#planHeading')).toBeFocused();
  expect(await page.evaluate(()=>document.documentElement.scrollWidth)).toBeLessThanOrEqual(1280);
});

test('reloading does not persist an active Plan reading session',async ({page})=>{
  await page.locator('#planDays [data-plan-day="1"]').click();
  expect(await page.evaluate(()=>activePlanReadingSession.day)).toBe(1);
  await page.reload();
  expect(await page.evaluate(()=>activePlanReadingSession)).toBeNull();
  await expect(page.locator('#readerBackToPlan')).toBeHidden();
  await expect(page.locator('#journeyTotal')).toHaveText('1 of 150 days completed');
});

test('Plan sessions store chapter ranges and replace context when another day opens',async ({page})=>{
  await page.locator('#planDays [data-plan-day="1"]').click();
  expect(await page.evaluate(()=>activePlanReadingSession)).toMatchObject({
    planPart:1,day:1,readings:[{bookId:'matthew',startChapter:1,endChapter:2}],
    start:{bookId:'matthew',chapter:1,verse:1},end:{bookId:'matthew',chapter:2,verse:23}
  });
  await page.getByRole('button',{name:'Plan',exact:true}).click();
  await page.locator('#planDays [data-plan-day="5"]').click();
  expect(await page.evaluate(()=>activePlanReadingSession)).toMatchObject({
    planPart:1,day:5,readings:[{bookId:'matthew',startChapter:9,endChapter:10}],
    start:{bookId:'matthew',chapter:9,verse:1},end:{bookId:'matthew',chapter:10,verse:42}
  });
});

test('cross-book readings keep their final Bible location in the session',async ({page})=>{
  await page.evaluate(()=>{
    journeyState.plans[0]=Array.from({length:30},(_,index)=>index+1);
    UserData.journey.save(journeyState);
    renderPlan();
  });
  await page.locator('#planDays [data-plan-day="5"]').click();
  expect(await page.evaluate(()=>activePlanReadingSession)).toMatchObject({
    planPart:2,day:5,
    readings:[{bookId:'luke',startChapter:24,endChapter:24},{bookId:'john',startChapter:1,endChapter:1}],
    start:{bookId:'luke',chapter:24,verse:1},end:{bookId:'john',chapter:1,verse:51}
  });
});

test('manual advancement stays within the assigned chapters and exits only beyond the final one',async ({page})=>{
  await page.locator('#planDays [data-plan-day="5"]').click();
  await expect(page.locator('#readerContent h2')).toHaveText('Matthew 9');
  await page.locator('[data-reader-action="next"]').first().click();
  await expect(page.locator('#readerContent h2')).toHaveText('Matthew 10');
  expect(await page.evaluate(()=>activePlanReadingSession.day)).toBe(5);
  await page.locator('[data-reader-action="next"]').first().click();
  await expect(page.locator('#view-plan')).toHaveClass(/active/);
  await expect(page.locator('#readerContent h2')).toHaveText('Matthew 10');
  await expect(page.locator('#journeyStatus')).toHaveText('Daily reading complete. Returning to Plan.');
  await expect(page.locator('#journeyTotal')).toHaveText('1 of 150 days completed');
  await expect(page.locator('#journeyStreak')).toHaveText('1-day streak');
  expect(await page.evaluate(()=>activePlanReadingSession)).toBeNull();
});

test('manual navigation outside the assigned chapter cancels auto-return and scrolling does not finish a lesson',async ({page})=>{
  await page.locator('#planDays [data-plan-day="5"]').click();
  await page.evaluate(()=>document.getElementById('view-reader').scrollTo(0,document.getElementById('view-reader').scrollHeight));
  await page.waitForTimeout(50);
  expect(await page.evaluate(()=>activePlanReadingSession.day)).toBe(5);
  await page.locator('#chapterSelect').selectOption('11');
  await expect(page.locator('#readerContent h2')).toHaveText('Matthew 11');
  expect(await page.evaluate(()=>activePlanReadingSession)).toBeNull();
  await expect(page.locator('#readerBackToPlan')).toBeHidden();
  await expect(page.locator('#journeyTotal')).toHaveText('1 of 150 days completed');
  await page.getByRole('button',{name:'Compare',exact:true}).click();
  expect(await page.evaluate(()=>activePlanReadingSession)).toBeNull();
  await expect(page.locator('#readerBackToPlan')).toBeHidden();
});

test('continuous Read Aloud stops at the assigned final verse and returns once',async ({page})=>{
  await page.addInitScript(()=>{
    window.__planSpeech={utterances:[]};
    Object.defineProperty(window,'SpeechSynthesisUtterance',{configurable:true,value:function(text){this.text=text;}});
    Object.defineProperty(window,'speechSynthesis',{configurable:true,value:{
      speak(utterance){window.__planSpeech.utterances.push({book:currentBook,chapter:currentChapter,utterance});},
      pause(){},resume(){},cancel(){},getVoices(){return []}
    }});
  });
  await page.reload();
  await page.getByRole('button',{name:'Plan',exact:true}).click();
  await page.locator('#planDays [data-plan-day="5"]').click();
  await page.locator('#readAloudPlay').click();
  await page.evaluate(()=>{
    var index=0;
    while(currentChapter===9 && index<200){ window.__planSpeech.utterances[index++].utterance.onend(); }
  });
  await expect(page.locator('#readerContent h2')).toHaveText('Matthew 10');
  await expect(page.locator('#view-reader')).toHaveClass(/active/);
  expect(await page.evaluate(()=>activePlanReadingSession.day)).toBe(5);
  await page.evaluate(()=>{
    var index=window.__planSpeech.utterances.length-1, guard=0;
    while(BibleSpeech.getState()==='playing' && guard++<200){
      var item=window.__planSpeech.utterances[index++];
      if(!item) break;
      item.utterance.onend();
    }
  });
  await expect(page.locator('#view-plan')).toHaveClass(/active/);
  await expect(page.locator('#journeyStatus')).toHaveText('Daily reading complete. Returning to Plan.');
  expect(await page.evaluate(()=>window.__planSpeech.utterances.every(item=>item.book==='matthew'&&[9,10].includes(item.chapter)))).toBe(true);
  expect(await page.evaluate(()=>window.__planSpeech.utterances.at(-1).utterance.text)).toBe(await page.evaluate(()=>BibleData.getVerse('web','matthew',10,42).text));
  await expect(page.locator('#journeyTotal')).toHaveText('1 of 150 days completed');
  await expect(page.locator('#journeyStreak')).toHaveText('1-day streak');
  expect(await page.evaluate(()=>activePlanReadingSession)).toBeNull();
});

test('ordinary Reader read-aloud continues beyond a chapter when no Plan session is active',async ({page})=>{
  await page.addInitScript(()=>{
    window.__ordinarySpeech=[];
    Object.defineProperty(window,'SpeechSynthesisUtterance',{configurable:true,value:function(text){this.text=text;}});
    Object.defineProperty(window,'speechSynthesis',{configurable:true,value:{
      speak(utterance){window.__ordinarySpeech.push(utterance);},pause(){},resume(){},cancel(){},getVoices(){return []}
    }});
  });
  await page.reload();
  await page.getByRole('button',{name:'Reader',exact:true}).click();
  await page.locator('#bookSelect').selectOption('matthew');
  await page.locator('#chapterSelect').selectOption('9');
  await page.locator('#readAloudPlay').click();
  expect(await page.evaluate(()=>activePlanReadingSession)).toBeNull();
  await expect(page.locator('#readAloudStatus')).toHaveText('Reading aloud.');
  await page.evaluate(()=>{
    var index=0;
    while(currentChapter===9 && index<200) window.__ordinarySpeech[index++].onend();
  });
  await expect(page.locator('#readerContent h2')).toHaveText('Matthew 10');
  await expect(page.locator('#readAloudStatus')).toHaveText('Continuing with Matthew 10.');
});

test('Next Chapter completes a final Bible-boundary Plan lesson without disabling the action',async ({page})=>{
  await page.evaluate(()=>{
    journeyState.plans=[
      Array.from({length:30},(_,index)=>index+1),Array.from({length:30},(_,index)=>index+1),
      Array.from({length:30},(_,index)=>index+1),Array.from({length:30},(_,index)=>index+1),
      Array.from({length:29},(_,index)=>index+1)
    ];
    UserData.journey.save(journeyState);
    renderPlan();
  });
  await page.locator('#planDays [data-plan-day="30"]').click();
  await expect(page.locator('#readerContent h2')).toHaveText('Revelation 22');
  const next=page.locator('[data-reader-action="next"]').first();
  await expect(next).toBeEnabled();
  await next.click();
  await expect(page.locator('#view-plan')).toHaveClass(/active/);
  await expect(page.locator('#planTitle')).toHaveText('Journey complete');
  await expect(page.locator('#journeyTotal')).toHaveText('150 of 150 days completed');
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
  await expect(page.locator('#journeyStreak')).toHaveText('0-day streak');
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
      await expect(page.locator('#planTitle')).toHaveText('Journey complete');
      await expect(page.locator('#journeyTotal')).toHaveText('150 of 150 days completed');
      await expect(page.locator('#planDays')).toContainText('You completed the full New Testament reading journey.');
    }
  }
});
