const {test,expect}=require('@playwright/test');
const {selectReaderOption}=require('./reader-navigation-test-helper');
test.use({hasTouch:true,userAgent:'Mozilla/5.0 (Linux; Android 14; Pixel 7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/130.0.0.0 Mobile Safari/537.36'});
async function open(page,cloud=false,width=390){
  await page.setViewportSize({width,height:844});await page.emulateMedia({reducedMotion:'reduce'});
  await page.addInitScript(cloud=>{
    window.IntersectionObserver=class{observe(){}unobserve(){}disconnect(){}};
    Object.defineProperty(navigator,'permissions',{configurable:true,value:{query:async()=>({state:'prompt'})}});
    const s=window.__voiceNav={native:[],requests:[],sources:[],recognizers:[],overlaps:[],spoken:[],autoEnd:true};
    class Recognition{constructor(){this.maxAlternatives=1;s.recognizers.push(this);}start(){this.active=true;this.onstart?.();}abort(){if(s.autoEnd)queueMicrotask(()=>this.end());}end(){this.active=false;this.onend?.();}emit(t,final=true,alternatives=[]){this.onresult?.({resultIndex:0,results:[Object.assign([t,...alternatives].map(transcript=>({transcript})),{isFinal:final})]});}}
    window.SpeechRecognition=Recognition;window.webkitSpeechRecognition=Recognition;
    const released=()=>{if(s.recognizers.some(r=>r.active))s.overlaps.push('speech before microphone release');};
    Object.defineProperty(window,'SpeechSynthesisUtterance',{configurable:true,value:function(text){this.text=text;}});
    Object.defineProperty(window,'speechSynthesis',{configurable:true,value:{getVoices:()=>[{name:'Microsoft David',lang:'en-US',localService:true}],addEventListener(){},pause(){},resume(){released();},cancel(){},speak(u){released();s.native.push(u);s.spoken.push(u.text);u.onstart?.();}}});
    class Context{constructor(){this.state='running';this.destination={};}resume(){released();this.state='running';return Promise.resolve();}suspend(){this.state='suspended';return Promise.resolve();}decodeAudioData(bytes){return Promise.resolve({duration:1,text:new TextDecoder().decode(bytes)});}createBufferSource(){const src={connect(){},disconnect(){},start(){if(this.state!=='suspended')released();s.spoken.push(this.buffer.text);},stop(){},end(){this.onended?.();}};s.sources.push(src);return src;}}
    Object.defineProperty(window,'AudioContext',{configurable:true,value:cloud?Context:undefined});Object.defineProperty(window,'webkitAudioContext',{configurable:true,value:undefined});
  },cloud);
  await page.route('**/api/tts',async route=>{await page.evaluate(b=>__voiceNav.requests.push(b),route.request().postDataJSON());await route.fulfill({status:200,contentType:'audio/mpeg',body:route.request().postDataJSON().text});});
  page.errors=[];page.on('pageerror',e=>page.errors.push(e.message));
  await page.goto('/');await page.evaluate(()=>initializeBibleExperience());await page.evaluate(()=>ReaderTranslationLoader.ensure());
}
async function command(page,text,wait=true,alternatives=[]){
  await page.evaluate(()=>new Promise(requestAnimationFrame));const recovery=page.getByRole('button',{name:'Show Reader controls',exact:true});if(await recovery.isVisible())await recovery.click();
  const more=page.locator('#readerMoreTrigger');if(await more.getAttribute('aria-expanded')==='false')await more.click();
  await page.locator('[data-voice-command-button]').tap();await page.evaluate(({text,alternatives})=>__voiceNav.recognizers.at(-1).emit(text,true,alternatives),{text,alternatives});
  await expect(page.locator('[data-voice-command-button]')).toHaveAttribute('aria-pressed','false');
  if(wait)await page.evaluate(()=>voiceNavigationTask);
}
async function position(page){return page.evaluate(()=>({id:currentTranslation,book:currentBook,chapter:currentChapter,verse:currentVerse,stored:localStorage.getItem('god4.translation'),saved:JSON.stringify(UserData.savedVerses.load())}));}
test.afterEach(async({page})=>{expect(page.errors||[]).toEqual([]);expect(await page.evaluate(()=>__voiceNav.overlaps)).toEqual([]);});


async function heard(page,count,id,book,chapter,verse,introduction='destination'){
 const expected=await page.evaluate(({id,book,chapter,verse,introduction})=>{
  const data=BibleData.getChapter(id,book,chapter),raw=BibleData.getVerse(id,book,chapter,verse).text;
  const text=id==='kjv'?raw.replace(/\[((?:\[[^[\]]*\]|[^[\]])+)\]/g,'$1'):raw;
  return (introduction==='destination'?data.bookName+' chapter '+chapter+' verse '+verse+'. ':introduction==='chapter'?data.bookName+' chapter '+chapter+'. ':'')+text;
 },{id,book,chapter,verse,introduction});
 await expect.poll(()=>page.evaluate(()=>__voiceNav.spoken.length)).toBe(count);
 expect(await page.evaluate(()=>__voiceNav.spoken.at(-1))).toBe(expected);
 await expect(page.locator('#readerContent .verse-spoken')).toHaveAttribute('data-verse-number',String(verse));
}
async function advance(page,cloud){await page.evaluate(cloud=>cloud?__voiceNav.sources.at(-1).end():__voiceNav.native.at(-1).onend(),cloud);}
for(const cloud of [false,true])for(const id of ['web','asv','kjv','ylt','dby','webster','rv','gnv','dra'])test(`${id} ${cloud?'cloud':'native'}: explicit same-chapter seeks announce once; automatic verses and resume do not`,async({page})=>{
 await open(page,cloud);await page.evaluate(async id=>{await changeTranslation(id);await navigateReaderToPassage('john',2,3);playReader();},id);
 await heard(page,1,id,'john',2,3);
 await advance(page,cloud);await heard(page,2,id,'john',2,4,'none');
 await page.evaluate(()=>{pauseReader();resumeReader();});expect(await page.evaluate(()=>__voiceNav.spoken.length)).toBe(2);
 await page.evaluate(()=>nextReaderVerse());await heard(page,3,id,'john',2,5);
 await advance(page,cloud);await heard(page,4,id,'john',2,6,'none');
 await page.evaluate(()=>repeatLastSpokenVerse());await heard(page,5,id,'john',2,6,'none');
});
for(const width of [390,1280])for(const cloud of [false,true])test(`${width}px ${cloud?'cloud':'native'}: real Book Chapter Verse selectors identify the actual destination`,async({page})=>{
 await open(page,cloud,width);
 await selectReaderOption(page.locator('#bookSelect'),'mark');expect(await page.evaluate(()=>currentVerse)).toBeNull();
 expect(await page.evaluate(()=>__voiceNav.spoken.length)).toBe(0);
 await page.locator('#readAloudPlay').focus();await page.keyboard.press('Enter');await heard(page,1,'web','mark',1,1);
 await page.evaluate(()=>{stopReader();ReaderReadingControls.reveal();});
 await selectReaderOption(page.locator('#chapterSelect'),'2');expect(await page.evaluate(()=>currentVerse)).toBeNull();
 await page.locator('#readAloudPlay').focus();await page.keyboard.press('Enter');await heard(page,2,'web','mark',2,1);
 await page.evaluate(()=>{stopReader();ReaderReadingControls.reveal();});
 await selectReaderOption(page.locator('#verseSelect'),'16');
 await page.locator('#readAloudPlay').focus();await page.keyboard.press('Enter');await heard(page,3,'web','mark',2,16);
 await expect(page.locator('#readerReferenceText')).toHaveText('Mark 2:16');
 await page.evaluate(()=>nextReaderVerse());await heard(page,4,'web','mark',2,17);
});
for(const cloud of [false,true])test(`${cloud?'cloud':'native'}: Android command turns announce same-chapter and compound destinations without narration feedback`,async({page})=>{
 await open(page,cloud);await page.evaluate(async()=>{await navigateReaderToPassage('john',1,16);playReader();});await heard(page,1,'web','john',1,16);
 await command(page,'Verse 18');await heard(page,2,'web','john',1,18);
 await command(page,'Catholic Bible, Tobias chapter 1 verse 2');await heard(page,3,'dra','tobit',1,2);
 await command(page,'pause');expect(await page.evaluate(()=>BibleSpeech.getState())).toBe('paused');
 await command(page,'WEB Romans 8:28');expect(await page.evaluate(()=>BibleSpeech.getState())).toBe('paused');expect(await page.evaluate(()=>__voiceNav.spoken.length)).toBe(3);
 await command(page,'resume');await heard(page,4,'web','romans',8,28);
 await command(page,'resume');
 if(!cloud)await heard(page,5,'web','romans',8,28,'none');else expect(await page.evaluate(()=>__voiceNav.spoken.length)).toBe(4);
 await expect(page.locator('#readerVoiceCommands')).toHaveAttribute('aria-pressed','false');
});
for(const cloud of [false,true])test(`${cloud?'cloud':'native'}: superseded asynchronous translation cannot announce its obsolete destination`,async({page})=>{
 await open(page,cloud);await page.evaluate(()=>playReader());await heard(page,1,'web','john',1,1);
 let release,entered;const barrier=new Promise(r=>release=r),requested=new Promise(r=>entered=r);
 await page.route('**/js/bible/dra.js*',async route=>{entered();await barrier;await route.continue();});
 try{
  await command(page,'Catholic Bible, Tobias 1:2',false);await requested;await page.evaluate(()=>{window.__oldNavigation=voiceNavigationTask;});
  expect(await page.evaluate(()=>__voiceNav.spoken.length)).toBe(1);
  await command(page,'Read WEB Romans chapter 8 verse 28',false);await heard(page,2,'web','romans',8,28);
  release();await page.evaluate(()=>__oldNavigation);
  expect(await position(page)).toMatchObject({id:'web',book:'romans',chapter:8,verse:28});
  expect(await page.evaluate(()=>__voiceNav.spoken.length)).toBe(2);
 }finally{release();}
});
for(const cloud of [false,true])test(`${cloud?'cloud':'native'}: automatic chapter transition keeps chapter-only introduction and continuous verses`,async({page})=>{
 await open(page,cloud);await page.evaluate(async()=>{await navigateReaderToPassage('john',1,51);playReader();});await heard(page,1,'web','john',1,51);
 await advance(page,cloud);await heard(page,2,'web','john',2,1,'chapter');
 await advance(page,cloud);await heard(page,3,'web','john',2,2,'none');
});
for(const cloud of [false,true])test(`${cloud?'cloud fallback':'native'}: retained WEB and Catholic data announce offline without network or changed preferences`,async({page,context})=>{
 await open(page,cloud);await page.evaluate(async()=>{await BibleTranslationLoader.ensure('dra');BibleSpeech.setSpeed(1.5);});await context.setOffline(true);
 for(const [i,id] of ['web','dra'].entries()){
  await page.evaluate(async id=>{stopReader();await changeTranslation(id);await navigateReaderToPassage('john',1,16);playReader();},id);
  await heard(page,i+1,id,'john',1,16);expect(await page.evaluate(()=>BibleSpeech.getSpeed())).toBe(1.5);
 }
 expect(await page.evaluate(()=>__voiceNav.requests.length)).toBe(0);
});
