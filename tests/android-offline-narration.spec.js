const {test,expect}=require('@playwright/test');

const male={name:'English US Male',lang:'en-US',localService:true,voiceURI:'local-male'};
const female={name:'English US Female',lang:'en-US',localService:true,voiceURI:'local-female'};
const unknown={name:'English (United States)',lang:'en-US',localService:true,voiceURI:'en-us-x-opaque'};

async function open(page,voices=[female,male],cloud=false){
  await page.addInitScript(({voices,cloud})=>{
    window.__online=false;
    Object.defineProperty(navigator,'onLine',{get:()=>__online});
    window.__speech={voices,spoken:[],cloud:[],pauses:0,resumes:0};
    window.SpeechSynthesisUtterance=function(text){this.text=text;};
    const listeners=[];
    Object.defineProperty(window,'speechSynthesis',{value:{
      getVoices:()=>__speech.voices,
      addEventListener(type,listener){if(type==='voiceschanged')listeners.push(listener);},
      speak(utterance){__speech.spoken.push(utterance);},
      cancel(){const previous=__speech.spoken.at(-1);previous?.onerror?.({error:'canceled'});},
      pause(){__speech.pauses++;},resume(){__speech.resumes++;}
    }});
    __speech.changeVoices=value=>{__speech.voices=value;listeners.forEach(listener=>listener());};
    window.addEventListener('DOMContentLoaded',async()=>{
      await initializeBibleExperience();
      if(cloud)window.BibleCloudTTS={
        available:()=>true,prepare(){},cancel(){},pause(){},resume(){},
        speak(text,voice,rate,callbacks){__speech.cloud.push({text,voice,callbacks});return true;}
      };
    });
  },{voices,cloud});
  await page.goto('/?cloud-tts=0');
  await expect(page.locator('#readerContent h2')).toHaveText('John 1');
}
const state=page=>page.evaluate(()=>({text:__speech.spoken.at(-1)?.text,voice:__speech.spoken.at(-1)?.voice?.voiceURI,count:__speech.spoken.length,cursor:getPlaybackResumeCursor(),playing:BibleSpeech.getState()}));
const status=page=>page.locator('#readAloudStatus');
const play=page=>page.evaluate(()=>playReader());
const stop=page=>page.evaluate(()=>stopReader());

test('offline profiles resolve installed gender and preserve the chosen preference',async({page})=>{
  await open(page,[female,{...male,localService:false,voiceURI:'remote-male'},male]);
  await play(page);
  expect(await state(page)).toMatchObject({voice:'local-male'});
  await stop(page);
  await page.evaluate(()=>BibleSpeech.setVoice('female'));
  await play(page);
  expect(await state(page)).toMatchObject({voice:'local-female'});
  await page.reload();
  await expect(page.locator('#readAloudVoice')).toHaveValue('female');
});

test('offline missing voice guidance stays visible and voice inventory changes are applied',async({page})=>{
  await page.setViewportSize({width:320,height:780});
  await open(page,[female]);
  await page.evaluate(()=>ReaderTranslationLoader.ensure());
  await play(page);
  expect(await state(page)).toMatchObject({count:0,playing:'idle'});
  await expect(status(page)).toContainText('No verified offline male voice');
  await expect(status(page)).toContainText('Install voice data');
  expect(await status(page).evaluate(e=>e.getBoundingClientRect().width)).toBeGreaterThan(1);
  await page.evaluate(v=>__speech.changeVoices([v]),unknown);
  await play(page);
  expect(await state(page)).toMatchObject({voice:unknown.voiceURI});
  await expect(status(page)).toContainText('gender unverified');
  await stop(page);
  await page.evaluate(v=>__speech.changeVoices([v]),male);
  await play(page);
  expect(await state(page)).toMatchObject({voice:male.voiceURI});
  await expect(status(page)).toContainText('same-gender');
  expect(await page.evaluate(()=>localStorage.getItem('god4.speech.voice'))).toBe('male');
});

test('Stop and rapid Play replay the latest native word boundary and ignore old callbacks',async({page})=>{
  await open(page);
  const position=await page.evaluate(()=>localStorage.getItem('god4.reader.position'));
  await page.evaluate(()=>{
    playReader();
    const old=__speech.spoken[0];
    old.onstart();
    old.onboundary({name:'word',charIndex:old.text.indexOf('beginning') + 3});
    stopReader();
    playReader();
    old.onboundary({name:'word',charIndex:old.text.lastIndexOf('God')});
    old.onend();
    old.onerror({error:'interrupted'});
    __speech.spoken[1].onstart();
  });
  const text=await page.evaluate(()=>BibleData.getVerse('web','john',1,1).text);
  expect(await state(page)).toMatchObject({text:text.slice(text.indexOf('beginning')),count:2,playing:'playing',cursor:{chapter:1,verse:1}});
  await expect(page.locator('.verse-spoken')).toHaveAttribute('data-verse-number','1');
  expect(await page.evaluate(()=>localStorage.getItem('god4.reader.position'))).toBe(position);
  await stop(page);
  await play(page);
  expect(await state(page)).toMatchObject({text:text.slice(text.indexOf('beginning')),count:3});
});

test('Pause and Play resume transport; Stop without a boundary resumes the current verse after progression',async({page})=>{
  await open(page);
  await page.evaluate(()=>{
    playReader();
    for(let i=0;i<2;i++){const u=__speech.spoken.at(-1);u.onstart();u.onend();}
    __speech.spoken.at(-1).onstart();
    pauseReader();playReader();
  });
  expect(await state(page)).toMatchObject({count:3,cursor:{verse:3}});
  expect(await page.evaluate(()=>[__speech.pauses,__speech.resumes])).toEqual([1,1]);
  await stop(page);await play(page);
  expect(await state(page)).toMatchObject({count:4,text:await page.evaluate(()=>BibleData.getVerse('web','john',1,3).text)});
});

test('Stop before a new chapter starts retains its pending verse and announces the chapter once',async({page})=>{
  await open(page);
  await page.evaluate(()=>{
    playReader(BibleData.getChapter('web','john',1).verses.length);
    __speech.spoken[0].onstart();
    __speech.spoken[0].onend();
    stopReader();playReader();
    __speech.spoken[1].onend();
  });
  expect(await state(page)).toMatchObject({count:3,cursor:{chapter:2,verse:1}});
  expect((await state(page)).text).toMatch(/^John chapter 2\. /);
  await page.evaluate(()=>{__speech.spoken[2].onstart();__speech.spoken[2].onend();});
  expect((await state(page)).text).not.toContain('chapter');
  expect(await state(page)).toMatchObject({count:4,cursor:{chapter:2,verse:2}});
});

test('going offline keeps the cloud preference and resumes the interrupted verse with the installed voice',async({page})=>{
  await open(page,[male,female],true);
  await page.evaluate(()=>{
    __online=true;
    BibleSpeech.setVoice('female');
    playReader();
    __speech.cloud[0].callbacks.onstart();
    __online=false;
    window.dispatchEvent(new Event('offline'));
    stopReader();playReader();
    __speech.cloud[0].callbacks.onend();
    __speech.spoken[0].onstart();
  });
  expect(await state(page)).toMatchObject({count:1,voice:'local-female',playing:'playing',cursor:{verse:1},text:await page.evaluate(()=>BibleData.getVerse('web','john',1,1).text)});
  expect(await page.evaluate(()=>[__speech.cloud[0].voice,localStorage.getItem('god4.speech.voice')])).toEqual(['female','female']);
});

test('a cloud failure after connectivity drops reports the actual offline voice limitation',async({page})=>{
  await open(page,[female],true);
  await page.evaluate(()=>{
    __online=true;
    playReader();
    __online=false;
    __speech.cloud[0].callbacks.onfallback();
  });
  expect(await state(page)).toMatchObject({count:0,playing:'idle'});
  await expect(status(page)).toContainText('No verified offline male voice');
  await expect(status(page)).toContainText('Install voice data');
});

test('the compact Reader Stop and Play controls resume from a native boundary',async({page})=>{
  await page.setViewportSize({width:390,height:780});
  await open(page);
  await page.evaluate(()=>ReaderTranslationLoader.ensure());
  await page.locator('#readAloudPlay').press('Enter');
  await page.evaluate(()=>{
    const first=__speech.spoken[0];
    first.onstart();
    first.onboundary({name:'word',charIndex:first.text.indexOf('beginning')});
  });
  const recovery=page.getByRole('button',{name:'Show Reader controls',exact:true});
  if(await recovery.isVisible())await recovery.click();
  const options=page.locator('#readerMoreTrigger');
  if(await options.getAttribute('aria-expanded')==='false')await options.click();
  await page.locator('.reader-compact-stop').click();
  expect(await state(page)).toMatchObject({playing:'idle'});
  expect(await page.evaluate(()=>__speech.resumes)).toBe(0);
  await page.locator('#readAloudPlay').press('Enter');
  expect(await state(page)).toMatchObject({count:2,text:'beginning was the Word, and the Word was with God, and the Word was God.'});
});
