const {test,expect}=require('@playwright/test');

async function install(page,provider='native'){
  await page.addInitScript(provider=>{
    window.__kjvAudio={native:[],cloud:[],sources:[],paused:0,resumed:0};
    Object.defineProperty(window,'SpeechSynthesisUtterance',{configurable:true,value:function(text){this.text=text;}});
    Object.defineProperty(window,'speechSynthesis',{configurable:true,value:{
      getVoices(){return [{name:'Microsoft David',lang:'en-US',localService:true}];},addEventListener(){},
      speak(utterance){window.__kjvAudio.native.push(utterance);utterance.onstart?.();},cancel(){},
      pause(){window.__kjvAudio.paused++;},resume(){window.__kjvAudio.resumed++;}
    }});
    class Context{
      constructor(){this.state='running';this.destination={};}
      resume(){return Promise.resolve();}suspend(){return Promise.resolve();}
      decodeAudioData(){return Promise.resolve({duration:1});}
      createBufferSource(){const source={connect(){},disconnect(){},start(){this.started=true;},stop(){},end(){this.onended?.();}};window.__kjvAudio.sources.push(source);return source;}
    }
    Object.defineProperty(window,'AudioContext',{configurable:true,value:provider==='native'?undefined:Context});
    Object.defineProperty(window,'webkitAudioContext',{configurable:true,value:undefined});
    window.IntersectionObserver=class{observe(){}unobserve(){}disconnect(){}};
  },provider);
  await page.route('**/api/tts',async route=>{
    const body=route.request().postDataJSON();
    await page.evaluate(body=>window.__kjvAudio.cloud.push(body),body);
    await route.fulfill({status:provider==='fallback'?503:200,contentType:provider==='fallback'?'application/json':'audio/mpeg',body:provider==='fallback'?'{}':'audio'});
  });
  await page.goto('/');await page.evaluate(()=>initializeBibleExperience());
  await navigate(page,'genesis',1,2);
}
async function navigate(page,bookId,chapter,verse,translationId='kjv'){
  await page.evaluate(async location=>{
    if(!await BibleTranslationLoader.ensure(location.translationId))throw new Error('Translation fixture unavailable');
    await navigateSearchResult(location);
  },{bookId,chapter,verse,translationId});
}
async function text(page,provider){
  return page.evaluate(provider=>provider==='cloud'?window.__kjvAudio.cloud.at(-1)?.text:window.__kjvAudio.native.at(-1)?.text,provider);
}
async function end(page,provider){
  await page.evaluate(provider=>provider==='cloud'?window.__kjvAudio.sources.at(-1).end():window.__kjvAudio.native.at(-1).onend(),provider);
}
const expected='And the earth was without form, and void; and darkness was upon the face of the deep. And the Spirit of God moved upon the face of the waters.';

for(const provider of ['native','cloud','fallback'])test(`${provider}: chapter, repeat and single-verse playback share supplied-word handling`,async({page})=>{
  const errors=[];page.on('pageerror',error=>errors.push(error.message));
  await install(page,provider);
  await page.locator('#readAloudPlay').click();
  await expect.poll(()=>text(page,provider)).toBe('Genesis chapter 1. '+expected);
  await expect(page.locator('#readerContent .verse-spoken')).toHaveAttribute('data-verse-number','2');
  const raw=await page.locator('#readerContent [data-verse-number="2"]').getAttribute('data-verse-text');
  expect(raw).toContain('[was]');
  await page.evaluate(()=>BibleSpeech.pauseResume());
  expect(await page.evaluate(()=>BibleSpeech.getState())).toBe('paused');
  await page.evaluate(()=>BibleSpeech.pauseResume());
  const attempts=await page.evaluate(provider=>provider==='cloud'?window.__kjvAudio.sources.length:window.__kjvAudio.native.length,provider);
  expect(await page.evaluate(()=>BibleSpeech.repeatVerse(2))).toBe(true);
  await expect.poll(()=>page.evaluate(provider=>provider==='cloud'?window.__kjvAudio.sources.filter(source=>source.started).length:window.__kjvAudio.native.length,provider)).toBe(attempts+1);
  await expect.poll(()=>text(page,provider)).toBe(expected);
  await end(page,provider);
  await expect(page.locator('#readerContent .verse-spoken')).toHaveAttribute('data-verse-number','3');
  await page.evaluate(()=>stopReader());
  await navigate(page,'genesis',1,4);
  await page.evaluate(()=>BibleSpeech.playVerse(BibleData.getChapter('kjv','genesis',1).verses[3],4,{translationId:'kjv',bookId:'genesis',chapter:1}));
  await expect.poll(()=>text(page,provider)).toBe('Genesis chapter 1. And God saw the light, that it was good: and God divided the light from the darkness.');
  await navigate(page,'genesis',2,1);
  await expect(page.locator('#readerContent .verse-spoken')).toHaveCount(0);
  expect(errors).toEqual([]);
});

for(const width of [1280,320,390])for(const fullscreen of [false,true])test(`${width}px fullscreen=${fullscreen}: supplied words remain readable, keyboard-operable and canonical`,async({page})=>{
  await page.setViewportSize({width,height:844});await install(page);
  if(fullscreen)await require('./reader-navigation-test-helper').toggleReaderFullscreen(page);
  const verse=page.locator('#readerContent [data-verse-number="2"]'),word=verse.locator('i .word-study-token');
  await expect(word).toHaveText('was');await expect(word).toHaveAccessibleName('Study word was');
  const styles=await word.evaluate(element=>({font:getComputedStyle(element).fontFamily,size:getComputedStyle(element).fontSize,style:getComputedStyle(element).fontStyle,color:getComputedStyle(element).color}));
  const other=await verse.locator('.word-study-token').first().evaluate(element=>({font:getComputedStyle(element).fontFamily,size:getComputedStyle(element).fontSize,color:getComputedStyle(element).color}));
  expect(styles).toMatchObject({...other,style:'italic'});
  expect(await page.locator('#readerContent .sr-only').ariaSnapshot()).toContain('KJV italics: supplied words, not emphasis.');
  await expect(page.locator('#readerContent .sr-only')).toHaveCount(1);
  expect(await word.getAttribute('aria-describedby')).toBeNull();
  await word.focus();await page.keyboard.press('Enter');
  await expect(page.locator('#wordStudyPanel')).toBeVisible();
  await expect(page.locator('#wordStudyWord')).toHaveText('was');
  await page.keyboard.press('Escape');await expect(word).toBeFocused();
  await word.scrollIntoViewIfNeeded();
  expect(await word.evaluate(element=>{const bounds=element.getBoundingClientRect();return element.contains(document.elementFromPoint(bounds.left+bounds.width/2,bounds.top+bounds.height/2));})).toBe(true);
  expect(await page.evaluate(()=>document.documentElement.scrollWidth<=innerWidth)).toBe(true);
  expect(await verse.getAttribute('data-verse-text')).toContain('[was]');
  if(fullscreen){
    await page.keyboard.press('Escape');
    await expect(page.locator('#view-reader')).not.toHaveClass(/reader-fullscreen/);
    const returnedFocus=page.locator(width<620?'#readerMoreTrigger':'#fullscreenBtn');
    await expect(returnedFocus).toBeVisible();
    await expect(returnedFocus).toBeFocused();
  }
});

test('parenthetical asides, literal nested brackets, saved text and reference coordinates stay intact',async({page})=>{
  await install(page);
  await navigate(page,'genesis',14,8);
  const verse=page.locator('#readerContent [data-verse-number="8"]');
  await expect(verse).toContainText('(the same is Zoar;)');
  await page.locator('#readAloudPlay').click();
  await expect.poll(()=>text(page,'native')).toContain('(the same is Zoar;)');
  await page.evaluate(()=>{
    stopReader();const verse=BibleData.getChapter('kjv','genesis',14).verses[7];
    toggleFav('Genesis 14:8',verse,null,{translationId:'kjv',bookId:'genesis',chapter:14,verse:8});
  });
  expect(await page.evaluate(()=>UserData.savedVerses.load()[0])).toMatchObject({text:await verse.getAttribute('data-verse-text'),location:{translationId:'kjv',bookId:'genesis',chapter:14,verse:8}});
  await navigate(page,'1-john',2,23);
  const supplied=page.locator('#readerContent [data-verse-number="23"] i');
  await expect(supplied).toHaveText('[but] he that acknowledgeth the Son hath the Father also');
  await page.locator('#readAloudPlay').click();
  await expect.poll(()=>text(page,'native')).toBe('1 John chapter 2. Whosoever denieth the Son, the same hath not the Father: [but] he that acknowledgeth the Son hath the Father also.');
});

for(const id of ['web','dra'])test(`${id}: canonical Reader rendering and speech remain unchanged`,async({page})=>{
  await install(page);await navigate(page,'genesis',1,2,id);
  const verse=page.locator('#readerContent [data-verse-number="2"]');
  await expect(verse.locator('i')).toHaveCount(0);await expect(page.locator('#readerContent .sr-only')).toHaveCount(0);
  const canonical=await verse.getAttribute('data-verse-text');
  expect(await verse.evaluate(element=>{const copy=element.cloneNode(true);copy.querySelector('.vnum').remove();return copy.textContent;})).toBe(canonical);
  await page.locator('#readAloudPlay').click();
  await expect.poll(()=>text(page,'native')).toBe('Genesis chapter 1. '+canonical);
});

test('KJV search and Compare retain canonical bracketed text and exact verse coordinates',async({page})=>{
  await install(page);
  const canonical=await page.locator('#readerContent [data-verse-number="2"]').getAttribute('data-verse-text');
  await page.locator('#searchTranslationToggle').click();
  await page.locator('#searchTranslationMenu').getByRole('option',{name:'KJV',exact:true}).click();
  await page.locator('#searchInput').fill('Genesis 1:2');
  await page.getByRole('button',{name:'Search',exact:true}).click();
  await expect(page.locator('#results .result-card')).toHaveCount(1);
  await expect(page.locator('#results .txt')).toHaveText('"'+canonical+'"');
  await page.locator('#results .result-card').click();
  await expect(page.locator('#readerContent .verse-focused')).toHaveAttribute('data-verse-number','2');
  await page.getByRole('button',{name:'Compare',exact:true}).click();
  await expect(page.locator('#compareSummary')).toHaveText('Comparing Genesis 1:2');
  await require('./reader-navigation-test-helper').selectCompareOption(page.locator('#compareGrid [data-compare-side="left"]'),'kjv');
  await expect(page.locator('#compareGrid .compare-col').first()).toContainText(canonical);
  expect(await page.evaluate(()=>BibleData.getVerse('kjv','genesis',1,2).text)).toBe(canonical);
});
