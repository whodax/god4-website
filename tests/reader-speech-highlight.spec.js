const {test,expect}=require('@playwright/test');
async function install(page,options={}){
  await page.addInitScript(options=>{
    window.__highlight={utterances:[],sources:[],decodes:[],requests:[]};
    Object.defineProperty(window,'SpeechSynthesisUtterance',{configurable:true,value:function(text){this.text=text;}});
    Object.defineProperty(window,'speechSynthesis',{configurable:true,value:{
      getVoices(){return [{name:'Microsoft David',lang:'en-US',localService:true},{name:'Microsoft Zira',lang:'en-US',localService:true}];},addEventListener(){},
      speak(u){window.__highlight.utterances.push(u);if(!options.deferStart)u.onstart?.();},pause(){},resume(){},cancel(){}
    }});
    class Context{
      constructor(){this.state='running';this.destination={};}
      resume(){this.state='running';return Promise.resolve();}suspend(){this.state='suspended';return Promise.resolve();}
      decodeAudioData(){return options.deferDecode?new Promise(resolve=>window.__highlight.decodes.push(()=>resolve({duration:1}))):Promise.resolve({duration:1});}
      createBufferSource(){const source={connect(){},disconnect(){},start(){this.started=true;},stop(){this.stopped=true;},end(){this.onended?.();}};window.__highlight.sources.push(source);return source;}
    }
    Object.defineProperty(window,'AudioContext',{configurable:true,value:options.cloud?Context:undefined});
    Object.defineProperty(window,'webkitAudioContext',{configurable:true,value:undefined});
  },options);
  await page.route('**/api/tts',route=>route.fulfill({status:options.failCloud?503:200,contentType:options.failCloud?'application/json':'audio/mpeg',body:options.failCloud?'{}':'audio'}));
  await page.goto('/');await page.evaluate(()=>initializeBibleExperience());
  await page.evaluate(()=>navigateSearchResult({bookId:'john',chapter:3,verse:16,translationId:currentTranslation}));
}
async function active(page,verse){
  await expect(page.locator('#readerContent .verse-spoken')).toHaveCount(verse?1:0);
  if(verse)await expect(page.locator('#readerContent .verse-spoken')).toHaveAttribute('data-verse-number',String(verse));
}
async function advance(page,cloud=false){await page.evaluate(cloud=>cloud?window.__highlight.sources.at(-1).end():window.__highlight.utterances.at(-1).onend(),cloud);}
test('actual native start owns highlight; progression suppresses selection, pause/resume retains, Stop restores',async({page})=>{
  await install(page,{deferStart:true});await page.locator('#readAloudPlay').click();await active(page,null);
  await page.evaluate(()=>window.__highlight.utterances[0].onstart());await active(page,16);
  const initialFocus=await page.evaluate(()=>document.activeElement.id);
  await advance(page);await active(page,null);
  await page.evaluate(()=>window.__highlight.utterances.at(-1).onstart());await active(page,17);
  const selected=page.locator('#readerContent [data-verse-number="16"]');
  expect(await selected.evaluate(e=>getComputedStyle(e).backgroundColor)).toBe('rgba(0, 0, 0, 0)');
  await page.evaluate(()=>pauseReader());await active(page,17);
  await page.evaluate(()=>resumeReader());await active(page,17);
  expect(await page.evaluate(()=>document.activeElement.id)).toBe(initialFocus);
  await page.locator('#readAloudPlay').click();await active(page,null);
  expect(await selected.evaluate(e=>getComputedStyle(e).backgroundColor)).toBe('rgb(255, 243, 205)');
  await page.evaluate(()=>window.__highlight.utterances[0].onstart());await active(page,null);
});
for(const width of [390,320])for(const fullscreen of [false,true]){
  test(`one voice-following highlight without overflow or focus stealing at ${width}px, fullscreen=${fullscreen}`,async({page})=>{
    await page.setViewportSize({width,height:800});await install(page);
    if(fullscreen)await page.locator('#fullscreenBtn').click();
    await page.locator('#readAloudPlay').click();await active(page,16);
    await page.locator('#readerMoreTrigger').focus();await advance(page);await active(page,17);
    await expect(page.locator('#readerMoreTrigger')).toBeFocused();
    expect(await page.evaluate(()=>document.documentElement.scrollWidth<=innerWidth)).toBe(true);
    expect(await page.locator('#readerContent .verse-spoken').evaluate(e=>({background:getComputedStyle(e).backgroundColor,underline:getComputedStyle(e).boxShadow}))).toMatchObject({background:'rgb(255, 243, 205)'});
    await page.evaluate(()=>stopReader());await active(page,null);
  });
}
for(const profile of ['male','female'])for(const fallback of [false,true]){
  test(`${profile} cloud profile, native fallback=${fallback}, progresses and clears`,async({page})=>{
    await install(page,{cloud:true,failCloud:fallback});await page.evaluate(profile=>BibleSpeech.setVoice(profile),profile);
    await page.locator('#readAloudPlay').click();await active(page,16);
    expect(await page.evaluate(()=>BibleSpeech.getResolvedVoiceInfo().preference)).toBe(profile);
    expect(await page.evaluate(()=>BibleSpeech.getResolvedVoiceInfo().provider)).toBe(fallback?'native':'cloud');
    await advance(page,!fallback);await active(page,17);
    await page.evaluate(()=>repeatLastSpokenVerse());await active(page,17);
    await advance(page,!fallback);await active(page,18);
    await page.evaluate(()=>stopReader());await active(page,null);
  });
}
for(const change of ['navigation','previous','next','translation','Stop']){
  test(`${change} cancels native playback and stale start/end callbacks`,async({page})=>{
    await install(page);await page.locator('#readAloudPlay').click();await active(page,16);
    await page.evaluate(async change=>{
      if(change==='navigation')await navigateReaderToPassage('isaiah',53,5);
      else if(change==='previous')prevChapter();else if(change==='next')nextChapter();
      else if(change==='translation')await changeTranslation('kjv');else stopReader();
      window.__highlight.utterances[0].onstart();window.__highlight.utterances[0].onend();
    },change);await active(page,null);
  });
}
for(const cancellation of ['Stop','superseded','translation']){
  test(`delayed decode ${cancellation} cannot restore an obsolete speech highlight`,async({page})=>{
    await install(page,{cloud:true,deferDecode:true});await page.locator('#readAloudPlay').click();
    await expect.poll(()=>page.evaluate(()=>window.__highlight.decodes.length)).toBe(1);await active(page,null);
    await page.evaluate(async cancellation=>{
      if(cancellation==='translation')await changeTranslation('kjv');
      else if(cancellation==='superseded'){stopReader();await navigateReaderToPassage('john',3,20);playReader();}
      else stopReader();
      window.__highlight.decodes[0]();
    },cancellation);
    await active(page,null);
    if(cancellation==='superseded'){
      await expect.poll(()=>page.evaluate(()=>window.__highlight.decodes.length)).toBe(2);
      await page.evaluate(()=>window.__highlight.decodes[1]());await active(page,20);
    }else expect(await page.evaluate(()=>window.__highlight.sources.filter(s=>s.started).length)).toBe(0);
  });
}
test('delayed response starts no highlight after Stop',async({page})=>{
  await install(page,{cloud:true});let pending;
  await page.route('**/api/tts',route=>{pending=route;});
  await page.locator('#readAloudPlay').click();await expect.poll(()=>Boolean(pending)).toBe(true);
  await active(page,null);await page.evaluate(()=>stopReader());
  await pending.fulfill({status:200,contentType:'audio/mpeg',body:'audio'});
  await active(page,null);expect(await page.evaluate(()=>BibleSpeech.getState())).toBe('idle');
});
test('offline native playback uses actual callbacks and clears on completion',async({page,context})=>{
  await install(page);await context.setOffline(true);
  await page.evaluate(()=>readVerseAloud(16));await active(page,16);await advance(page);await active(page,null);
});
test('Repeat preserves paused boundary cursor and one primary highlight',async({page})=>{
  await install(page);await page.locator('#readAloudPlay').click();await active(page,16);
  await advance(page);await active(page,17);
  await page.evaluate(()=>pauseReader());await page.evaluate(()=>repeatLastSpokenVerse());await active(page,17);
  await advance(page);await active(page,17);
  expect(await page.evaluate(()=>BibleSpeech.getState())).toBe('paused');
  await page.evaluate(()=>resumeReader());await active(page,18);
});
test('automatic chapter continuation clears old selected state and follows first verse',async({page})=>{
  await install(page);await page.evaluate(()=>navigateReaderToPassage('john',3,36));
  await page.locator('#readAloudPlay').click();await active(page,36);
  await advance(page);await expect(page.locator('#readerContent h2')).toHaveText('John 4');await active(page,1);
});
test('Plan final verse clears speech state and returns to Plan without stale callbacks',async({page})=>{
  await install(page);await page.evaluate(()=>{
    activePlanReadingSession={planPart:1,day:1,readings:[{bookId:'john',startChapter:3,endChapter:3}],end:{bookId:'john',chapter:3,verse:36},translationId:currentTranslation};updatePlanSessionControl();
  });
  await page.evaluate(()=>navigateReaderToPassage('john',3,36));await page.locator('#readAloudPlay').click();await active(page,36);
  await advance(page);await expect(page.locator('#view-plan')).toHaveClass(/active/);await active(page,null);
  await page.evaluate(()=>window.__highlight.utterances[0].onstart());await active(page,null);
});
