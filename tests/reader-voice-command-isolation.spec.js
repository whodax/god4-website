const {test,expect}=require('@playwright/test');
const {toggleReaderFullscreen}=require('./reader-navigation-test-helper');

test.use({hasTouch:true,userAgent:'Mozilla/5.0 (Linux; Android 14; Pixel 7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/130.0.0.0 Mobile Safari/537.36'});

async function open(page,provider='native',fullscreen=false,{permission='prompt'}={}){
  await page.setViewportSize({width:390,height:844});await page.emulateMedia({reducedMotion:'reduce'});
  await page.addInitScript(({provider,permission})=>{
    window.IntersectionObserver=class{observe(){}unobserve(){}disconnect(){}};
    Object.defineProperty(navigator,'permissions',{configurable:true,value:{query:async()=>({state:permission})}});
    const trace=window.__isolation={captures:[],native:[],sources:[],requests:[],events:[],overlaps:[],speaking:false,autoEnd:true,pauses:0,resumes:0,cancels:0};
    class Recognition{
      constructor(){trace.captures.push(this);this.results=[];this.active=false;}
      start(){if(trace.startError)throw new DOMException('Controlled recognition failure',trace.startError);if(trace.speaking)trace.overlaps.push('microphone started during narration');this.active=true;trace.events.push('mic:start');this.onstart?.();}
      abort(){trace.events.push('mic:abort');if(trace.abortError)throw new Error('Controlled abort failure');if(trace.autoEnd)queueMicrotask(()=>this.finish());}
      stop(){trace.events.push('mic:stop');if(trace.autoEnd)queueMicrotask(()=>this.finish());}
      finish(){this.active=false;trace.events.push('mic:end');this.onend?.();}
      emit(text,final=true,index=this.results.length){this.results[index]=Object.assign([{transcript:text}],{isFinal:final});this.onresult?.({resultIndex:index,results:this.results});}
    }
    window.SpeechRecognition=Recognition;window.webkitSpeechRecognition=Recognition;
    const assertReleased=()=>{if(trace.captures.some(r=>r.active))trace.overlaps.push('narration started before microphone release');};
    Object.defineProperty(window,'SpeechSynthesisUtterance',{configurable:true,value:function(text){this.text=text;}});
    Object.defineProperty(window,'speechSynthesis',{configurable:true,value:{getVoices(){return [{name:'Microsoft David',lang:'en-US',localService:true}];},addEventListener(){},
      speak(u){assertReleased();trace.speaking=true;trace.events.push('native:start');trace.native.push(u);u.onstart?.();},
      pause(){trace.pauses++;trace.speaking=false;trace.events.push('native:pause');},resume(){assertReleased();trace.resumes++;trace.speaking=true;trace.events.push('native:resume');},cancel(){trace.cancels++;trace.speaking=false;trace.events.push('native:cancel');}
    }});
    class Context{
      constructor(){this.state='running';this.destination={};}
      resume(){assertReleased();this.state='running';trace.events.push('cloud:resume');return Promise.resolve();}
      suspend(){this.state='suspended';trace.speaking=false;trace.events.push('cloud:pause');return Promise.resolve();}
      decodeAudioData(){return Promise.resolve({duration:1});}
      createBufferSource(){const context=this,s={connect(){},disconnect(){},start(){if(context.state==='running'){assertReleased();trace.speaking=true;}trace.events.push('cloud:start');},stop(){trace.speaking=false;trace.events.push('cloud:stop');},end(){trace.speaking=false;this.onended?.();}};trace.sources.push(s);return s;}
    }
    Object.defineProperty(window,'AudioContext',{configurable:true,value:provider==='native'?undefined:Context});
    Object.defineProperty(window,'webkitAudioContext',{configurable:true,value:undefined});
  },{provider,permission});
  await page.route('**/api/tts',async route=>{await page.evaluate(b=>__isolation.requests.push(b),route.request().postDataJSON());await route.fulfill({status:200,contentType:'audio/mpeg',body:'controlled audio'});});
  page.errors=[];page.on('pageerror',e=>page.errors.push(e.message));
  await page.goto('/');await page.evaluate(()=>initializeBibleExperience());await page.evaluate(()=>ReaderTranslationLoader.ensure());
  if(fullscreen)await toggleReaderFullscreen(page);
}

async function command(page,text){
  await mic(page);await page.evaluate(text=>__isolation.captures.at(-1).emit(text),text);
  await expect(page.locator('[data-voice-command-button]')).toHaveAttribute('aria-pressed','false');
}

const commands=[
  ...['play','play the passage','read','read the passage','resume','continue'].map(command=>[command,'playing','john',2,5]),
  ['pause','paused','john',2,5],['stop','idle','john',2,5],
  ...['repeat','repeat verse','repeat last verse'].map(command=>[command,'playing','john',2,5]),
  ['next verse','playing','john',2,6],['previous verse','playing','john',2,4],['back verse','playing','john',2,4],
  ...['next chapter','next','go to next chapter'].map(command=>[command,'idle','john',3,null]),
  ...['previous chapter','previous','back','go to previous chapter'].map(command=>[command,'idle','john',1,null]),
  ['John chapter two','idle','john',2,null],['open Genesis 1','idle','genesis',1,null],
  ['go to Isaiah chapter sixty four verse one','idle','isaiah',64,1],
  ['read John 1 verse 20','playing','john',1,20],['John 1 verse 20 play','playing','john',1,20],
  ['first John two verse twenty three read','playing','1-john',2,23],
  ['  Pause .  ','paused','john',2,5]
];

for(const provider of ['native','cloud'])for(const [spoken,state,book,chapter,verse] of commands){
  test(`${provider}: explicit command turn preserves '${spoken}'`,async({page})=>{
    await open(page,provider);await page.evaluate(async()=>{await navigateReaderToPassage('john',2,5);playReader();});await count(page,provider,1);
    await mic(page);expect(await page.evaluate(()=>BibleSpeech.getState())).toBe('paused');
    expect(await page.evaluate(()=>__isolation.captures.at(-1).continuous)).toBe(false);
    await page.evaluate(spoken=>__isolation.captures.at(-1).emit(spoken),spoken);
    await expect(page.locator('[data-voice-command-button]')).toHaveAttribute('aria-pressed','false');
    await expect.poll(()=>page.evaluate(()=>BibleSpeech.getState())).toBe(state);
    await expect(page.locator('#bookSelect')).toHaveValue(book);await expect(page.locator('#chapterSelect')).toHaveValue(String(chapter));
    if(state==='playing'){
      await expect.poll(()=>page.evaluate(()=>getPlaybackResumeCursor().verse)).toBe(verse);
      const expected=await page.evaluate(({book,chapter,verse})=>BibleData.getVerse('web',book,chapter,verse).text,{book,chapter,verse});
      const existingCloud=provider==='cloud' && ['play','play the passage','read','read the passage','resume','continue'].includes(spoken);
      const intro=book==='john' && chapter===2 && !existingCloud?'':await page.evaluate(({book,chapter})=>BibleData.getChapter('web',book,chapter).bookName+' chapter '+chapter+'. ',{book,chapter});
      await expect.poll(()=>text(page,provider)).toBe(intro+expected);
      if(existingCloud)expect(await page.evaluate(()=>__isolation.requests.length)).toBe(1);
    } else if(state==='idle')await expect(page.locator('#verseSelect')).toHaveValue(verse===null?'':String(verse));
    expect(await page.evaluate(()=>__isolation.overlaps)).toEqual([]);
    expect(await page.evaluate(()=>__isolation.events.filter(e=>e==='mic:start').length)).toBe(1);
  });
}

for(const provider of ['native','cloud']){
  test(`${provider}: listening uses final results only; paused resume retains the chapter and ignores old audio callbacks`,async({page})=>{
    await open(page,provider);await page.evaluate(()=>playReader());await count(page,provider,1);await mic(page);
    await page.evaluate(()=>{const r=__isolation.captures.at(-1);r.emit('play',false,0);r.emit('pause',false,0);});
    await page.evaluate(()=>__isolation.captures.at(-1).onresult({resultIndex:0,results:[[{transcript:'play'}]]}));
    expect(await page.evaluate(()=>BibleSpeech.getState())).toBe('paused');
    if(provider==='native')await page.evaluate(()=>{const old=__isolation.native[0];old.onend();old.onerror({error:'interrupted'});old.onstart();});
    expect(await page.evaluate(()=>BibleSpeech.getState())).toBe('paused');
    await page.evaluate(()=>__isolation.captures.at(-1).emit('pause',true,0));
    await expect(page.locator('[data-voice-command-button]')).toHaveAttribute('aria-pressed','false');
    await command(page,'resume');await count(page,provider,provider==='native'?2:1);
    if(provider==='native')expect(await text(page,provider)).toBe(await page.evaluate(()=>BibleData.getVerse('web','john',1,1).text));
    await finishVerse(page,provider);await count(page,provider,provider==='native'?3:2);
    expect(await text(page,provider)).toBe(await page.evaluate(()=>BibleData.getVerse('web','john',1,2).text));
    expect(await page.evaluate(()=>__isolation.overlaps)).toEqual([]);
  });

  test(`${provider}: manual Play waits for microphone end and Stop cancels pending audio`,async({page})=>{
    await open(page,provider);await mic(page);await page.evaluate(()=>{__isolation.autoEnd=false;document.getElementById('readAloudPlay').click();});
    expect(await page.evaluate(provider=>provider==='native'?__isolation.native.length:__isolation.sources.length,provider)).toBe(0);
    await expect(page.locator('[data-voice-command-button]')).toHaveAttribute('aria-busy','true');
    await page.evaluate(()=>{stopReader();__isolation.captures.at(-1).finish();});
    await expect(page.locator('[data-voice-command-button]')).toHaveAttribute('aria-pressed','false');
    expect(await page.evaluate(()=>BibleSpeech.getState())).toBe('idle');
    expect(await page.evaluate(provider=>provider==='native'?__isolation.native.length:__isolation.sources.length,provider)).toBe(0);
    await page.locator('#readAloudPlay').focus();await page.keyboard.press('Enter');await count(page,provider,1);
    expect(await page.evaluate(()=>__isolation.overlaps)).toEqual([]);
  });

  test(`${provider}: idle listening and completion never reopen capture; a new turn rejects old recognizer events`,async({page})=>{
    await open(page,provider,false,{permission:'granted'});await page.clock.install();await page.clock.runFor(60000);
    expect(await page.evaluate(()=>__isolation.captures.length)).toBe(0);
    await mic(page);await page.clock.runFor(60000);expect(await page.evaluate(()=>__isolation.captures.length)).toBe(1);
    await page.evaluate(()=>__isolation.captures[0].finish());await page.clock.runFor(60000);
    await expect(page.locator('[data-voice-command-button]')).toHaveAttribute('aria-pressed','false');
    await mic(page);await page.evaluate(()=>{const old=__isolation.captures[0];old.emit('play');old.onerror({error:'network'});old.finish();old.onstart();});
    await expect(page.locator('[data-voice-command-button]')).toHaveAttribute('aria-pressed','true');
    await page.evaluate(()=>__isolation.captures[1].emit('play'));await count(page,provider,1);
    await page.evaluate(()=>{stopReader();readVerseAloud(1);});await count(page,provider,2);
    await finishVerse(page,provider);await page.clock.runFor(60000);
    expect(await page.evaluate(()=>BibleSpeech.getState())).toBe('idle');
    expect(await page.evaluate(()=>__isolation.captures.length)).toBe(2);
    expect(await page.evaluate(()=>__isolation.overlaps)).toEqual([]);
  });
}

for(const error of ['no-speech','network','not-allowed','audio-capture','aborted'])test(`Android ${error}: accurate error state, no restart and explicit recovery`,async({page})=>{
  await open(page);await page.clock.install();await mic(page);
  await page.evaluate(error=>__isolation.captures[0].onerror({error}),error);await page.clock.runFor(60000);
  await expect(page.locator('[data-voice-command-button]')).toHaveAttribute('aria-pressed','false');
  await expect(page.locator('#voiceStatusTop')).toContainText(error==='aborted'?'aborted':error==='no-speech'?'No speech':error==='network'?'connect':error==='not-allowed'?'blocked':'microphone');
  expect(await page.evaluate(()=>__isolation.captures.length)).toBe(1);
  await command(page,'play');await count(page,'native',1);expect(await page.evaluate(()=>__isolation.captures.length)).toBe(2);
});

test('missing release confirmation blocks audio, times out safely, and cannot execute a stale command later',async({page})=>{
  await open(page);await page.clock.install();await mic(page);
  await page.evaluate(()=>{__isolation.autoEnd=false;__isolation.captures[0].emit('play');});await page.clock.runFor(5000);
  await expect(page.locator('#voiceStatusTop')).toContainText('Microphone has not closed');
  await expect(page.locator('[data-voice-command-button]')).toHaveAttribute('aria-pressed','true');
  expect(await page.evaluate(()=>__isolation.native.length)).toBe(0);
  await page.locator('#readAloudPlay').click();await page.clock.runFor(60000);
  expect(await page.evaluate(()=>__isolation.native.length)).toBe(0);
  await page.evaluate(()=>__isolation.captures[0].finish());await page.clock.runFor(60000);
  await expect(page.locator('#voiceStatusTop')).toContainText('Microphone is now off');
  await expect(page.locator('[data-voice-command-button]')).toHaveAttribute('aria-busy','false');
  expect(await page.evaluate(()=>__isolation.native.length)).toBe(0);
  await page.locator('#readAloudPlay').focus();await page.keyboard.press('Enter');await count(page,'native',1);
});

test('release edge: a cloud failure during capture cannot start native fallback until the command completes',async({page})=>{
  await open(page,'cloud');let release,requested=false;const gate=new Promise(resolve=>release=resolve);
  await page.route('**/api/tts',async route=>{requested=true;await gate;await route.fulfill({status:503,contentType:'application/json',body:'{}'});});
  await page.locator('#readAloudPlay').focus();await page.keyboard.press('Enter');await expect.poll(()=>requested).toBe(true);
  await mic(page);release();
  await expect.poll(()=>page.evaluate(()=>BibleSpeech.getResolvedVoiceInfo().provider)).toBe('native');
  expect(await page.evaluate(()=>BibleSpeech.getState())).toBe('paused');expect(await page.evaluate(()=>__isolation.native.length)).toBe(0);
  await page.evaluate(()=>__isolation.captures[0].emit('resume'));await count(page,'native',1);
  expect(await text(page,'native')).toBe('John chapter 1. '+await page.evaluate(()=>BibleData.getVerse('web','john',1,1).text));
  expect(await page.evaluate(()=>__isolation.overlaps)).toEqual([]);
});

for(const provider of ['native','cloud'])test(`${provider} release edge: superseded verse requests and navigation cannot execute stale audio`,async({page})=>{
  await open(page,provider);await mic(page);
  await page.evaluate(()=>{__isolation.autoEnd=false;readVerseAloud(1);readVerseAloud(2);__isolation.captures[0].finish();});await count(page,provider,1);
  expect(await text(page,provider)).toBe('John chapter 1. '+await page.evaluate(()=>BibleData.getVerse('web','john',1,2).text));
  await expect(page.locator('#voiceStatusTop')).toHaveText('Microphone off.');
  await mic(page);await page.evaluate(()=>__isolation.captures[1].emit('play'));
  await page.evaluate(async()=>{await navigateReaderToPassage('john',3,null);__isolation.captures[1].finish();});
  expect(await page.evaluate(()=>BibleSpeech.getState())).toBe('idle');await expect(page.locator('#chapterSelect')).toHaveValue('3');
  expect(await page.evaluate(()=>__isolation.overlaps)).toEqual([]);
});

for(const name of ['InvalidStateError','NotAllowedError'])test(`release edge: ${name} on explicit start never retries or disables subsequent manual playback`,async({page})=>{
  await open(page);await page.clock.install();await page.evaluate(name=>__isolation.startError=name,name);await mic(page);await page.clock.runFor(60000);
  await expect(page.locator('[data-voice-command-button]')).toHaveAttribute('aria-pressed','false');
  expect(await page.evaluate(()=>__isolation.captures.length)).toBe(1);
  await page.evaluate(()=>__isolation.startError=null);await command(page,'play');await count(page,'native',1);
});

test('release edge: stop fallback ignores closing transcripts, and abort failures cannot start pending audio',async({page})=>{
  await open(page);await mic(page);
  await page.evaluate(()=>{const r=__isolation.captures[0];r.abort=undefined;r.stop=function(){this.emit('stop');this.finish();};r.emit('play');});await count(page,'native',1);
  await mic(page);await page.evaluate(()=>{__isolation.abortError=true;__isolation.captures[1].emit('resume');});
  await expect(page.locator('#voiceStatusTop')).toContainText('Microphone could not close');
  expect(await page.evaluate(()=>BibleSpeech.getState())).toBe('paused');
  await page.evaluate(()=>{__isolation.abortError=false;__isolation.captures[1].finish();});
  expect(await page.evaluate(()=>__isolation.native.length)).toBe(1);
  await command(page,'resume');await count(page,'native',2);
});

for(const width of [320,390])test(`release edge: ${width}px fullscreen offline native commands retain keyboard and recovery access`,async({page,context})=>{
  await open(page,'native',true);await page.setViewportSize({width,height:844});await context.setOffline(true);
  await mic(page);await page.evaluate(()=>__isolation.captures[0].emit('play'));await count(page,'native',1);
  await mic(page);await page.evaluate(()=>__isolation.captures[1].emit('pause'));
  await expect(page.locator('[data-voice-command-button]')).toHaveAttribute('aria-pressed','false');
  await page.locator('#readerMoreTrigger').press('Escape');await expect(page.locator('#readerMoreTrigger')).toBeFocused();
  await page.locator('#readAloudPlay').focus();await page.keyboard.press('Enter');await count(page,'native',2);
  expect(await page.evaluate(()=>document.documentElement.scrollWidth<=innerWidth)).toBe(true);
  expect(await page.evaluate(()=>__isolation.overlaps)).toEqual([]);
});
async function mic(page){
  await page.evaluate(()=>new Promise(requestAnimationFrame));
  const recovery=page.getByRole('button',{name:'Show Reader controls',exact:true});if(await recovery.isVisible())await recovery.click();
  const more=page.locator('#readerMoreTrigger');if(await more.getAttribute('aria-expanded')==='false')await more.click();
  await page.locator('[data-voice-command-button]').click();
}
async function count(page,provider,n){await expect.poll(()=>page.evaluate(provider=>provider==='native'?__isolation.native.length:__isolation.sources.length,provider)).toBe(n);}
async function finishVerse(page,provider){await page.evaluate(provider=>{__isolation.speaking=false;if(provider==='native')__isolation.native.at(-1).onend();else __isolation.sources.at(-1).end();},provider);}
async function text(page,provider){return page.evaluate(provider=>provider==='native'?__isolation.native.at(-1).text:__isolation.requests.at(-1).text,provider);}
test.afterEach(async({page},info)=>{
  if(info.status!==info.expectedStatus)console.log('Voice isolation failure trace:',JSON.stringify(await page.evaluate(()=>({state:BibleSpeech.getState(),events:__isolation.events,overlaps:__isolation.overlaps,native:__isolation.native.map(u=>u.text),requests:__isolation.requests}))));
  expect(page.errors||[]).toEqual([]);
});

for(const provider of ['native','cloud']){
  for(const fullscreen of [false,true])test(`${provider} fullscreen=${fullscreen}: Voice Commands Play releases capture before chapter introduction and echo cannot cancel three complete verses`,async({page})=>{
    await open(page,provider,fullscreen);await mic(page);await page.evaluate(()=>__isolation.captures.at(-1).emit('play'));await count(page,provider,1);
    expect(await text(page,provider)).toBe('John chapter 1. '+await page.evaluate(()=>BibleData.getVerse('web','john',1,1).text));
    await page.evaluate(()=>{__isolation.playChanges=[];new MutationObserver(records=>__isolation.playChanges.push(...records.map(r=>r.attributeName||'text'))).observe(document.getElementById('readAloudPlay'),{childList:true,attributes:true,attributeFilter:['aria-label','data-playback-state']});});
    await page.evaluate(()=>{const r=__isolation.captures[0];r.emit('John chapter one');r.emit('pause',false);r.emit('stop');});
    expect(await page.evaluate(()=>BibleSpeech.getState())).toBe('playing');
    for(let v=1;v<=3;v++){await finishVerse(page,provider);await count(page,provider,v+1);expect(await text(page,provider)).toBe(await page.evaluate(v=>BibleData.getVerse('web','john',1,v).text,v+1));}
    expect(await page.evaluate(()=>__isolation.overlaps)).toEqual([]);
    expect(await page.evaluate(()=>__isolation.captures.length)).toBe(1);
    expect(await page.evaluate(()=>__isolation.playChanges)).toEqual([]);
  });
  test(`${provider}: a result followed by service end cannot restart the microphone into narration`,async({page})=>{
    await open(page,provider);await page.clock.install();await mic(page);
    await page.evaluate(()=>{const r=__isolation.captures[0];r.emit('play');r.finish();});await page.clock.runFor(1000);await count(page,provider,1);
    expect(await page.evaluate(()=>__isolation.events.filter(e=>e==='mic:start').length)).toBe(1);
    expect(await page.evaluate(()=>__isolation.overlaps)).toEqual([]);
  });
}
