const {test,expect}=require('@playwright/test');
const {toggleReaderFullscreen}=require('./reader-navigation-test-helper');
test.use({hasTouch:true});

async function open(page,{provider='native',fullscreen=false,width=390,theme='light',voice='male',speed='1',delayedPermission=false}={}){
  await page.setViewportSize({width,height:844});await page.emulateMedia({reducedMotion:'reduce'});
  await page.addInitScript(({provider,theme,voice,speed,delayedPermission})=>{
    localStorage.setItem('god4.theme',theme);
    if(localStorage.getItem('god4.speech.voice')===null)localStorage.setItem('god4.speech.voice',voice);
    if(localStorage.getItem('god4.speech.speed')===null)localStorage.setItem('god4.speech.speed',speed);
    window.IntersectionObserver=class{observe(){}unobserve(){}disconnect(){}};
    window.__android={native:[],sources:[],requests:[],starts:0,stops:0,autoStart:true,oscillators:0,recognizers:0};
    Object.defineProperty(navigator,'permissions',{configurable:true,value:{query:()=>delayedPermission?new Promise(resolve=>__android.resolvePermission=resolve):Promise.resolve({state:'prompt'})}});
    class Recognition{
      constructor(){window.__recognition=this;__android.recognizers++;}
      start(){__android.starts++;this.onstart?.();}
      stop(){__android.stops++;this.onend?.();}
    }
    window.SpeechRecognition=Recognition;window.webkitSpeechRecognition=Recognition;
    Object.defineProperty(window,'SpeechSynthesisUtterance',{configurable:true,value:function(text){this.text=text;}});
    Object.defineProperty(window,'speechSynthesis',{configurable:true,value:{
      getVoices(){return [{name:'Microsoft David',lang:'en-US',localService:true},{name:'Microsoft Zira',lang:'en-US',localService:true}];},addEventListener(){},pause(){},resume(){},cancel(){},
      speak(u){__android.native.push(u);if(__android.autoStart)u.onstart?.();}
    }});
    class Context{
      constructor(){this.state='running';this.destination={};}resume(){this.state='running';return Promise.resolve();}suspend(){this.state='suspended';return Promise.resolve();}
      decodeAudioData(){return __android.holdDecode?new Promise(resolve=>__android.releaseDecode=()=>resolve({duration:1})):Promise.resolve({duration:1});}
      createOscillator(){__android.oscillators++;throw new Error('Unexpected tone generation');}
      createBufferSource(){const s={connect(){},disconnect(){},start(){},stop(){},end(){this.onended?.();}};__android.sources.push(s);return s;}
    }
    Object.defineProperty(window,'AudioContext',{configurable:true,value:provider==='native'?undefined:Context});
    Object.defineProperty(window,'webkitAudioContext',{configurable:true,value:undefined});
  },{provider,theme,voice,speed,delayedPermission});
  await page.route('**/api/tts',async route=>{
    await page.evaluate(body=>__android.requests.push(body),route.request().postDataJSON());
    await route.fulfill({status:provider==='fallback'?503:200,contentType:provider==='fallback'?'application/json':'audio/mpeg',body:provider==='fallback'?'{}':'audio'});
  });
  page.errors=[];page.on('pageerror',e=>page.errors.push(e.message));
  await page.goto('/');await page.evaluate(()=>initializeBibleExperience());await page.evaluate(()=>ReaderTranslationLoader.ensure());await page.evaluate(()=>document.fonts.ready);
  if(fullscreen)await toggleReaderFullscreen(page);
}
test.afterEach(async({page})=>expect(page.errors||[]).toEqual([]));
async function end(page,provider){await page.evaluate(provider=>provider==='cloud'?__android.sources.at(-1).end():__android.native.at(-1).onend(),provider);}
async function count(page,provider,n){await expect.poll(()=>page.evaluate(provider=>provider==='cloud'?__android.sources.length:__android.native.length,provider)).toBe(n);}
async function text(page,provider){return page.evaluate(provider=>provider==='cloud'?__android.requests.at(-1).text:__android.native.at(-1).text,provider);}
async function mic(page){await page.locator('#readerMoreTrigger').click();await page.locator('[data-voice-command-button]').click();}

for(const provider of ['native','cloud','fallback'])for(const fullscreen of [false,true]){
  test(`${provider} fullscreen=${fullscreen}: verse handoffs keep Play stable and never reset idle recognition`,async({page})=>{
    await open(page,{provider,fullscreen});
    for(const id of ['voiceStatusTop','readAloudStatus']){
      const status=page.locator('#'+id);
      await expect(status).toHaveText('');await expect(status).toHaveAttribute('aria-live','polite');
      expect(await status.evaluate(element=>getComputedStyle(element).display)).not.toBe('none');
    }
    await mic(page);
    await page.locator('#readAloudPlay').focus();await page.keyboard.press('Enter');await count(page,provider,1);
    await expect(page.locator('#readAloudPlay')).toHaveAccessibleName('Pause reading aloud');
    expect(await text(page,provider)).toBe('John chapter 1. '+await page.evaluate(()=>BibleData.getVerse('web','john',1,1).text));
    await page.evaluate(()=>{
      __android.changes=[];__android.play=document.getElementById('readAloudPlay');
      new MutationObserver(records=>__android.changes.push(...records.map(r=>r.attributeName||'text'))).observe(__android.play,{childList:true,attributes:true,attributeFilter:['aria-label','data-playback-state']});
      __android.autoStart=false;__android.holdDecode=true;
    });
    await end(page,provider);
    if(provider==='cloud'){
      await expect.poll(()=>page.evaluate(()=>typeof __android.releaseDecode)).toBe('function');
    }else await count(page,provider,2);
    expect(await page.evaluate(()=>BibleSpeech.getState())).toBe('playing');
    expect(await page.evaluate(()=>__android.changes)).toEqual([]);
    if(provider==='cloud')await page.evaluate(()=>__android.releaseDecode());else await page.evaluate(()=>__android.native.at(-1).onstart());
    await count(page,provider,2);
    expect(await text(page,provider)).toBe(await page.evaluate(()=>BibleData.getVerse('web','john',1,2).text));
    expect(await page.evaluate(()=>__android.changes)).toEqual([]);
    await page.keyboard.press('Enter');expect(await page.evaluate(()=>BibleSpeech.getState())).toBe('paused');
    await page.keyboard.press('Enter');expect(await page.evaluate(()=>BibleSpeech.getState())).toBe('playing');
    await page.evaluate(()=>{__android.autoStart=true;__android.holdDecode=false;});
    await end(page,provider);await count(page,provider,3);
    expect(await page.evaluate(()=>({starts:__android.starts,stops:__android.stops,tones:__android.oscillators}))).toEqual({starts:1,stops:0,tones:0});
    await page.locator('.reader-compact-stop').click();expect(await page.evaluate(()=>BibleSpeech.getState())).toBe('idle');
    await page.locator('[data-voice-command-button]').click();expect(await page.evaluate(()=>__android.stops)).toBe(1);
  });
  test(`${provider} fullscreen=${fullscreen}: chapter-only announcements survive pause, seek, repeat and chapter progression`,async({page})=>{
    await open(page,{provider,fullscreen});await page.evaluate(()=>navigateReaderToPassage('john',1,51));
    await page.locator('#readAloudPlay').focus();await page.keyboard.press('Enter');await count(page,provider,1);
    expect(await text(page,provider)).toBe('John chapter 1. '+await page.evaluate(()=>BibleData.getVerse('web','john',1,51).text));
    await end(page,provider);await count(page,provider,2);
    expect(await text(page,provider)).toBe('John chapter 2. '+await page.evaluate(()=>BibleData.getVerse('web','john',2,1).text));
    await page.evaluate(()=>{pauseReader();resumeReader();});
    expect(await page.evaluate(provider=>provider==='cloud'?__android.sources.length:__android.native.length,provider)).toBe(2);
    await end(page,provider);await count(page,provider,3);
    expect(await text(page,provider)).toBe(await page.evaluate(()=>BibleData.getVerse('web','john',2,2).text));
    await page.evaluate(()=>nextReaderVerse());await count(page,provider,4);
    expect(await text(page,provider)).toBe(await page.evaluate(()=>BibleData.getVerse('web','john',2,3).text));
    await page.evaluate(()=>previousReaderVerse());await count(page,provider,5);
    expect(await text(page,provider)).toBe(await page.evaluate(()=>BibleData.getVerse('web','john',2,2).text));
    await page.evaluate(()=>repeatLastSpokenVerse());await count(page,provider,6);
    expect(await text(page,provider)).toBe(await page.evaluate(()=>BibleData.getVerse('web','john',2,2).text));
    await page.evaluate(async()=>{stopReader();await changeTranslation('dra');playReader();});await count(page,provider,7);
    const expected=await page.evaluate(()=>{const c=BibleData.getChapter('dra',currentBook,currentChapter);return c.bookName+' chapter '+currentChapter+'. '+c.verses[getPlaybackResumeCursor().verse-1];});
    expect(await text(page,provider)).toBe(expected);
  });
}

for(const width of [320,360,390,430])for(const theme of ['light','dark'])test(`${width}px ${theme}: person icons, persistence and high-speed migration preserve 44px controls`,async({page})=>{
  await open(page,{width,theme,voice:theme==='dark'?'female':'male',speed:width===320?'2.25':'2.5'});
  const voice=page.locator('[data-reader-select="readAloudVoice"]');
  await expect(voice).toHaveAccessibleName('Select reading voice, '+(theme==='dark'?'Female':'Male'));
  await expect(voice.locator('svg')).toHaveCount(1);await expect(voice.locator('svg')).toHaveAttribute('aria-hidden','true');
  expect((await voice.boundingBox()).height).toBeGreaterThanOrEqual(44);
  expect(await page.evaluate(()=>({speed:BibleSpeech.getSpeed(),saved:localStorage.getItem('god4.speech.speed')}))).toEqual({speed:2,saved:'2'});
  await expect(page.locator('#readAloudSpeed option')).toHaveText(['50%','75%','100%','125%','150%','175%','200%']);
  const before=await voice.locator('svg').innerHTML();await voice.click();
  await page.locator('#readerOptionsPicker [data-option-value="'+(theme==='dark'?'male':'female')+'"]').click();
  await expect(voice).toHaveAccessibleName('Select reading voice, '+(theme==='dark'?'Male':'Female'));
  expect(await voice.locator('svg').innerHTML()).not.toBe(before);
  if(width===320 && theme==='light' || width===390 && theme==='dark')await page.screenshot({path:'playwright-report/android-reader-icons/'+width+'-'+theme+'.png'});
  await page.reload();await page.evaluate(()=>initializeBibleExperience());await page.evaluate(()=>ReaderTranslationLoader.ensure());
  await expect(voice).toHaveAccessibleName('Select reading voice, '+(theme==='dark'?'Male':'Female'));
  await page.locator('[data-reader-select="readAloudSpeed"]').click();await page.keyboard.press('End');
  await expect(page.locator('#readerOptionsPicker [data-option-value="2"]')).toBeFocused();
});

for(const reason of ['silence','end','network'])test(`idle recognition ${reason} cannot enter a microphone restart loop`,async({page})=>{
  await open(page);await page.clock.install();await mic(page);
  expect(await page.evaluate(()=>__recognition.continuous)).toBe(true);
  await page.clock.runFor(60000);expect(await page.evaluate(()=>__android.starts)).toBe(1);
  await page.evaluate(reason=>{if(reason!=='end')__recognition.onerror({error:reason==='silence'?'no-speech':'network'});__recognition.onend();__recognition.onend();},reason);
  await page.clock.runFor(60000);expect(await page.evaluate(()=>__android.starts)).toBe(1);
  await expect(page.locator('[data-voice-command-button]')).toHaveAttribute('aria-pressed','false');
  await expect(page.locator('[data-voice-command-button]')).toBeEnabled();
  await page.locator('[data-voice-command-button]').click();expect(await page.evaluate(()=>__android.starts)).toBe(2);
});

test('continuous results deduplicate interim/final slots and handle successive commands without stopping capture',async({page})=>{
  await open(page);await mic(page);
  await page.evaluate(()=>{
    __android.commands=[];const handle=handleVoiceCommand;window.handleVoiceCommand=t=>{__android.commands.push(t);handle(t);};
    const result=(t,final)=>Object.assign([{transcript:t}],{isFinal:final});
    __recognition.onresult({resultIndex:0,results:[result('play',false)]});
    __recognition.onresult({resultIndex:0,results:[result('play',true)]});
    __recognition.onresult({resultIndex:1,results:[result('play',true),result('pause',true)]});
    __recognition.onresult({resultIndex:2,results:[result('play',true),result('pause',true),result('resume',true)]});
  });
  expect(await page.evaluate(()=>__android.commands)).toEqual(['play','pause','resume']);
  expect(await page.evaluate(()=>({starts:__android.starts,stops:__android.stops}))).toEqual({starts:1,stops:0});
  expect(await page.evaluate(()=>BibleSpeech.getState())).toBe('playing');
});

test('silence during continuous playback does not stop Reader audio or restart recognition',async({page})=>{
  await open(page,{provider:'cloud'});await page.clock.install();await mic(page);await page.locator('#readAloudPlay').focus();await page.keyboard.press('Enter');await count(page,'cloud',1);
  await page.evaluate(()=>{__recognition.onerror({error:'no-speech'});__recognition.onend();});
  await end(page,'cloud');await count(page,'cloud',2);await page.clock.runFor(10000);
  expect(await page.evaluate(()=>BibleSpeech.getState())).toBe('playing');expect(await page.evaluate(()=>__android.starts)).toBe(1);
  await expect(page.locator('#voiceStatusTop')).toHaveClass(/sr-only/);await expect(page.locator('#readAloudStatus')).toHaveClass(/sr-only/);
});

test('all nine translations announce verified chapter metadata and preserve canonical text',async({page})=>{
  await open(page);
  for(const id of ['web','asv','kjv','ylt','dby','webster','rv','gnv','dra']){
    const expected=await page.evaluate(async id=>{stopReader();await changeTranslation(id);await navigateReaderToPassage('john',1,1);const v=BibleData.getVerse(id,'john',1,1).text;readVerseAloud(1);return {spoken:BibleData.getChapter(id,'john',1).bookName+' chapter 1. '+(id==='kjv'?v.replace(/\[((?:\[[^[\]]*\]|[^[\]])+)\]/g,'$1'):v),canonical:v};},id);
    expect(await text(page,'native')).toBe(expected.spoken);
    expect(await page.evaluate(id=>BibleData.getVerse(id,'john',1,1).text,id)).toBe(expected.canonical);
  }
});

test('a service ending after a command restarts once, then stops retrying when idle',async({page})=>{
  await open(page);await page.clock.install();await mic(page);
  await page.evaluate(()=>{__recognition.onresult({results:[Object.assign([{transcript:'next verse'}],{isFinal:true})]});__recognition.onend();__recognition.onend();});
  await page.clock.runFor(1);expect(await page.evaluate(()=>__android.starts)).toBe(2);
  await expect(page.locator('#verseSelect')).toHaveValue('1');
  await page.evaluate(()=>__recognition.onend());await page.clock.runFor(60000);
  expect(await page.evaluate(()=>__android.starts)).toBe(2);
  await expect(page.locator('[data-voice-command-button]')).toHaveAttribute('aria-pressed','false');
});

test('explicit Stop listening cancels a pending post-command restart',async({page})=>{
  await open(page);await page.clock.install();await mic(page);
  await page.evaluate(()=>{__recognition.onresult({results:[Object.assign([{transcript:'next verse'}],{isFinal:true})]});__recognition.onend();document.querySelector('[data-voice-command-button]').click();});
  await page.clock.runFor(60000);
  expect(await page.evaluate(()=>__android.starts)).toBe(1);
  await expect(page.locator('[data-voice-command-button]')).toHaveAttribute('aria-pressed','false');
});

test('late granted permission cannot reactivate recognition after an explicit stop',async({page})=>{
  await open(page,{delayedPermission:true});await mic(page);await page.locator('[data-voice-command-button]').click();
  await page.evaluate(()=>__android.resolvePermission({state:'granted'}));await page.clock.install();await page.clock.runFor(60000);
  expect(await page.evaluate(()=>__android.starts)).toBe(1);
  await expect(page.locator('[data-voice-command-button]')).toHaveAttribute('aria-pressed','false');
});

test('direct cloud callers cannot exceed 200% or cancel valid playback with an invalid rate',async({page})=>{
  await open(page,{provider:'cloud'});await page.locator('#readAloudPlay').focus();await page.keyboard.press('Enter');await count(page,'cloud',1);
  expect(await page.evaluate(()=>[2.25,2.5,Infinity,NaN].map(rate=>BibleCloudTTS.speak('Invalid rate','male',rate,{})))).toEqual([false,false,false,false]);
  expect(await page.evaluate(()=>__android.requests.length)).toBe(1);
  expect(await page.evaluate(()=>BibleSpeech.getState())).toBe('playing');
  await end(page,'cloud');await count(page,'cloud',2);
});

for(const provider of ['native','cloud'])test(`${provider}: all 51 John 1 verses read continuously with one chapter introduction and one microphone capture`,async({page})=>{
  await open(page,{provider});await mic(page);await page.locator('#readAloudPlay').focus();await page.keyboard.press('Enter');await count(page,provider,1);
  await page.evaluate(()=>{__android.changes=[];new MutationObserver(records=>__android.changes.push(...records.map(r=>r.attributeName||'text'))).observe(document.getElementById('readAloudPlay'),{childList:true,attributes:true,attributeFilter:['aria-label','data-playback-state']});});
  const verses=await page.evaluate(()=>BibleData.getChapter('web','john',1).verses);
  expect(verses).toHaveLength(51);
  for(let i=0;i<verses.length;i++){
    expect(await text(page,provider)).toBe((i===0?'John chapter 1. ':'')+verses[i]);
    await end(page,provider);await count(page,provider,i+2);
  }
  expect(await text(page,provider)).toBe('John chapter 2. '+await page.evaluate(()=>BibleData.getVerse('web','john',2,1).text));
  expect(await page.evaluate(()=>({starts:__android.starts,stops:__android.stops,changes:__android.changes}))).toEqual({starts:1,stops:0,changes:[]});
});
