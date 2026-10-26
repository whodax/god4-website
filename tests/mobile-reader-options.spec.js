const {test,expect}=require('@playwright/test');
const {selectReaderOption}=require('./reader-navigation-test-helper');
test.use({hasTouch:true});

async function open(page,{width=390,colorScheme='light',speech=false,blockedStorage=false}={}){
  await page.setViewportSize({width,height:844});await page.emulateMedia({colorScheme});
  await page.addInitScript(({speech,blockedStorage})=>{
    window.IntersectionObserver=class{observe(){}unobserve(){}disconnect(){}};
    if(blockedStorage){const write=Storage.prototype.setItem;Storage.prototype.setItem=function(key,value){if(key==='god4.savedVerses')throw new Error('Storage full');return write.call(this,key,value);};}
    if(speech){
      window.__optionsSpeech=[];
      Object.defineProperty(window,'AudioContext',{configurable:true,value:undefined});
      Object.defineProperty(window,'webkitAudioContext',{configurable:true,value:undefined});
      Object.defineProperty(window,'SpeechSynthesisUtterance',{configurable:true,value:function(text){this.text=text;}});
      Object.defineProperty(window,'speechSynthesis',{configurable:true,value:{getVoices(){return [{name:'Microsoft David',lang:'en-US',localService:true}];},addEventListener(){},cancel(){},pause(){},resume(){},speak(utterance){window.__optionsSpeech.push(utterance);utterance.onstart?.();}}});
    }
  },{speech,blockedStorage});
  await page.goto('/');await page.evaluate(()=>initializeBibleExperience());
  await expect(page.locator('#readerMoreTrigger')).toHaveText('Options');
  await page.locator('#readerMoreTrigger').click();
  await expect(page.locator('#readerMoreTrigger')).toHaveText('Hide Options');
  await page.evaluate(()=>ReaderTranslationLoader.ensure());
}
const trigger=(page,id)=>page.locator(`[data-reader-select="${id}"]`);
const option=(page,value)=>page.locator(`#readerOptionsPicker [data-option-value="${value}"]`);

for(const width of [320,390])for(const colorScheme of ['light','dark'])for(const fullscreen of [false,true])test(`${width}px ${colorScheme} fullscreen=${fullscreen}: all five selectors use readable themed dialogs`,async({page},testInfo)=>{
  await open(page,{width,colorScheme});
  if(fullscreen)await page.locator('#fullscreenBtn').click();
  const primary=await page.evaluate(()=>['#readerTranslationTrigger','[data-reader-action="previous-verse"]','#readAloudPlay','[data-reader-action="next-verse"]','[data-reader-select="readAloudVoice"]','[data-reader-select="readAloudSpeed"]'].map(selector=>{
    const element=document.querySelector(selector),bounds=element.getBoundingClientRect();
    return {left:bounds.left,right:bounds.right,client:element.clientWidth,scroll:element.scrollWidth};
  }));
  primary.forEach((bounds,index)=>{expect(bounds.scroll).toBeLessThanOrEqual(bounds.client+1);if(index)expect(bounds.left).toBeGreaterThanOrEqual(primary[index-1].right);});
  for(const [id,value,name] of [['bookSelect','genesis','Book'],['chapterSelect','2','Chapter'],['verseSelect','3','Verse'],['readAloudVoice','female','Select Reading Voice'],['readAloudSpeed','1.25','Speed']]){
    await expect(page.locator('#'+id)).toBeHidden();
    const button=trigger(page,id);await expect(button).toBeVisible();
    expect(await button.evaluate(element=>getComputedStyle(element).backgroundColor)).toBe('rgb(237, 227, 200)');
    expect(await button.evaluate(element=>getComputedStyle(element).color)).toBe('rgb(27, 42, 68)');
    expect((await button.boundingBox()).height).toBeGreaterThanOrEqual(44);
    const dialog=page.getByRole('dialog',{name,exact:true});
    if(!await dialog.isVisible()) await button.click();
    await expect(dialog).toBeVisible();
    await expect(dialog).toHaveCSS('background-color','rgb(247, 241, 222)');
    await expect(dialog).toHaveCSS('color','rgb(27, 42, 68)');
    if(id==='verseSelect' && await page.locator('#verseSelect').inputValue()===''){
      await expect(dialog.locator('[aria-pressed="true"]')).toHaveCount(0);
      await expect(option(page,'1')).toBeFocused();
      await expect(page.locator('#verseSelect')).toHaveValue('');
    } else await expect(dialog.locator('[aria-pressed="true"]')).toBeFocused();
    await option(page,value).scrollIntoViewIfNeeded();await option(page,value).click();
    await expect(page.locator('#'+id)).toHaveValue(value);
    const next=id==='bookSelect'?'Chapter':id==='chapterSelect'?'Verse':null;
    if(next){
      await expect(page.getByRole('dialog',{name:next,exact:true})).toBeVisible();
      await expect(page.locator('#readerOptionsPicker [data-option-value]')).not.toHaveCount(0);
    } else {
      await expect(dialog).not.toBeVisible();
      await expect(button).toBeFocused();
    }
  }
  expect(await page.evaluate(()=>BibleSpeech.getSpeed())).toBe(1.25);
  expect(await page.evaluate(()=>UserData.speechVoice.load())).toBe('female');
  await trigger(page,'bookSelect').click();
  await page.keyboard.press('End');
  await expect(option(page,'revelation')).toBeFocused();
  const bounds=await page.locator('#readerOptionsPicker').boundingBox();
  expect(bounds.x).toBeGreaterThanOrEqual(0);expect(bounds.y).toBeGreaterThanOrEqual(0);
  expect(bounds.x+bounds.width).toBeLessThanOrEqual(width);expect(bounds.y+bounds.height).toBeLessThanOrEqual(844);
  expect(await option(page,'revelation').evaluate(element=>{const bounds=element.getBoundingClientRect();return element.contains(document.elementFromPoint(bounds.left+bounds.width/2,bounds.top+bounds.height/2));})).toBe(true);
  await page.screenshot({path:testInfo.outputPath('themed-reader-options.png')});
  await page.keyboard.press('Escape');await expect(trigger(page,'bookSelect')).toBeFocused();
  if(fullscreen)await expect(page.locator('#view-reader')).toHaveClass(/reader-fullscreen/);
  expect(await page.evaluate(()=>document.documentElement.scrollWidth<=innerWidth)).toBe(true);
  await trigger(page,'readAloudSpeed').focus();await page.keyboard.press('Escape');
  await expect(page.locator('#readerMoreTrigger')).toHaveText('Options');
  await expect(page.locator('#readerMoreTrigger')).toHaveAttribute('aria-expanded','false');
  await expect(page.locator('#readerMoreTrigger')).toBeFocused();
});

for(const width of [320,360,390,430,1280])test(`${width}px: Save offers explicit selection, confirms once, persists and tracks drawer removal`,async({page})=>{
  await open(page,{width});
  const save=page.locator('#readerSaveVerse');
  await expect(save).toBeEnabled();await expect(save).toHaveText('Choose verse to save');
  await save.click();
  await expect(page.locator('#readerSaveStatus')).toContainText('Nothing has been saved');
  expect(await page.evaluate(()=>UserData.savedVerses.load())).toEqual([]);
  await option(page,'2').click();await expect(save).toBeFocused();
  await expect(save).toHaveAccessibleName('Save John 1:2 (WEB)');
  await expect(save).toHaveAttribute('aria-pressed','false');
  await save.press('Enter');
  await expect(page.locator('#readerSaveStatus')).toHaveText('John 1:2 (WEB) saved.');
  await expect(save).toHaveText('Saved ✓');await expect(save).toHaveAttribute('aria-pressed','true');
  await expect(save).toHaveAttribute('aria-disabled','true');await expect(save).toBeFocused();
  await expect(save).toHaveAccessibleName('John 1:2 (WEB) saved. Manage saved verses in Saved.');
  await save.press('Enter');await save.press('Space');
  await expect(page.locator('#savedCount')).toHaveText('1');
  expect(await page.evaluate(()=>UserData.savedVerses.load()[0])).toMatchObject({location:{translationId:'web',bookId:'john',chapter:1,verse:2}});
  await page.reload();await page.evaluate(()=>initializeBibleExperience());await page.locator('#readerMoreTrigger').click();await page.evaluate(()=>ReaderTranslationLoader.ensure());
  await expect(save).toHaveAttribute('aria-pressed','true');
  await expect(save).toHaveText('Saved ✓');
  await selectReaderOption(page.locator('#verseSelect'),'3');
  await expect(save).toHaveText('Save verse');await expect(save).toHaveAttribute('aria-disabled','false');
  await selectReaderOption(page.locator('#verseSelect'),'2');await expect(save).toHaveText('Saved ✓');
  await page.locator('.saved-pill').click();
  await page.locator('.saved-verse-remove').filter({hasText:'Remove'}).click();
  await expect(save).toHaveAttribute('aria-pressed','false');await expect(page.locator('#savedCount')).toHaveText('0');
  expect(await page.evaluate(()=>UserData.savedVerses.load())).toEqual([]);
  await expect(save).toHaveText('Save verse');await expect(save).toHaveAttribute('aria-disabled','false');
  await expect(page.locator('#readerSaveStatus')).toHaveClass(/sr-only/);
  await expect(page.locator('#readerSaveStatus')).toHaveAttribute('role','status');
  await expect(page.locator('#readerSaveStatus')).toHaveAttribute('aria-live','polite');
});

for(const paused of [false,true])for(const fullscreen of [false,true])test(`spoken verse wins over selected verse, paused=${paused} fullscreen=${fullscreen}`,async({page})=>{
  await open(page,{speech:true,width:320});
  if(fullscreen)await page.locator('#fullscreenBtn').click();
  await page.evaluate(async()=>{await BibleTranslationLoader.ensure('kjv');await navigateSearchResult({translationId:'kjv',bookId:'genesis',chapter:1,verse:2});});
  await page.locator('#readAloudPlay').click();
  await page.evaluate(()=>window.__optionsSpeech.at(-1).onend());
  if(paused)await page.evaluate(()=>BibleSpeech.pauseResume());
  await expect(page.locator('#readerContent .verse-spoken')).toHaveAttribute('data-verse-number','3');
  if(!paused){await expect(page.getByRole('button',{name:'Show Reader controls',exact:true})).toBeVisible();await page.getByRole('button',{name:'Show Reader controls',exact:true}).click();}
  await page.locator('#readerSaveVerse').click();
  await expect(page.locator('#readerSaveStatus')).toHaveText('Genesis 1:3 (KJV) saved.');
  expect(await page.evaluate(()=>UserData.savedVerses.load()[0])).toMatchObject({text:'And God said, Let there be light: and there was light.',location:{translationId:'kjv',bookId:'genesis',chapter:1,verse:3}});
  expect(await page.evaluate(()=>window.__optionsSpeech[0].text)).not.toContain('[was]');
  await page.evaluate(()=>stopReader());await expect(page.locator('#readerSaveVerse')).toHaveAccessibleName('Save Genesis 1:2 (KJV)');
  await expect(page.locator('#readerContent [data-verse-number="2"] i')).toHaveText('was');
});

test('storage failure retains the existing session fallback but never claims durable persistence',async({page})=>{
  await open(page,{blockedStorage:true});await selectReaderOption(page.locator('#verseSelect'),'2');
  await page.locator('#readerSaveVerse').click();
  await expect(page.locator('#readerSaveStatus')).toContainText('this visit only');
  await expect(page.locator('#readerSaveVerse')).toHaveAttribute('aria-pressed','true');
  await expect(page.locator('#savedCount')).toHaveText('1');
  expect(await page.evaluate(()=>localStorage.getItem('god4.savedVerses'))).toBeNull();
});

test('desktop retains native controls and mobile keyboard focus is visible and trapped without saving on focus',async({page})=>{
  await open(page,{width:1280});
  for(const id of ['bookSelect','chapterSelect','verseSelect','readAloudVoice','readAloudSpeed']){await expect(page.locator('#'+id)).toBeVisible();await expect(trigger(page,id)).toBeHidden();}
  await page.setViewportSize({width:320,height:844});
  await trigger(page,'verseSelect').focus();await page.keyboard.press('Enter');
  await page.keyboard.press('Home');await expect(option(page,'1')).toBeFocused();
  await expect(option(page,'')).toHaveCount(0);
  await page.keyboard.press('ArrowDown');await expect(option(page,'2')).toBeFocused();
  await page.keyboard.press('ArrowUp');await expect(option(page,'1')).toBeFocused();
  await expect(option(page,'1')).toHaveCSS('outline-color','rgb(27, 42, 68)');
  await expect(option(page,'1')).toHaveCSS('outline-width','2px');
  await page.keyboard.press('End');await page.keyboard.press('Tab');
  await expect(page.getByRole('button',{name:'Close Reader selection'})).toBeFocused();
  await page.keyboard.press('Shift+Tab');await expect(option(page,'51')).toBeFocused();
  expect(await page.evaluate(()=>UserData.savedVerses.load())).toEqual([]);
  await page.keyboard.press('Escape');await expect(trigger(page,'verseSelect')).toBeFocused();
});

test('touch, pressed/scroll states, high-contrast focus and Catholic saves retain real values',async({page})=>{
  await open(page,{width:320,colorScheme:'dark'});
  expect(await page.locator('#readerTranslation option').count()).toBe(9);
  await page.evaluate(async()=>{await changeTranslation('dra');await navigateReaderToPassage('tobit',1,1);});
  await trigger(page,'bookSelect').tap();
  const selected=page.locator('#readerOptionsPicker [aria-pressed="true"]');
  await expect(selected.locator('.reader-translation-check')).toBeVisible();
  await selected.dispatchEvent('pointerdown',{pointerType:'touch',pointerId:1});
  await expect(selected).toHaveAttribute('data-pressed','true');
  await page.locator('#readerOptionsPicker .reader-translation-options').dispatchEvent('scroll');
  await expect(selected).not.toHaveAttribute('data-pressed','true');
  await page.keyboard.press('Home');
  const colors=await page.locator('#readerOptionsPicker button:focus').evaluate(element=>({outline:getComputedStyle(element).outlineColor,background:getComputedStyle(element).backgroundColor}));
  function luminance(color){const channels=color.match(/[\d.]+/g).slice(0,3).map(Number).map(value=>{const channel=value/255;return channel<=0.04045?channel/12.92:((channel+0.055)/1.055)**2.4;});return channels[0]*0.2126+channels[1]*0.7152+channels[2]*0.0722;}
  const values=[luminance(colors.outline),luminance(colors.background)];
  const contrast=(Math.max(...values)+0.05)/(Math.min(...values)+0.05);
  console.log('Reader Options focus contrast:',contrast);expect(contrast).toBeGreaterThanOrEqual(3);
  await page.keyboard.press('Escape');await page.locator('#readerSaveVerse').tap();
  const entry=await page.evaluate(()=>UserData.savedVerses.load()[0]);
  expect(entry.location).toEqual({translationId:'dra',bookId:'tobit',chapter:1,verse:1});
  expect(entry.text).toBe(await page.evaluate(()=>BibleData.getVerse('dra','tobit',1,1).text));
  await expect(page.locator('#readerSaveStatus')).toHaveText(entry.ref+' saved.');
});

test('failed optional runtime retains native controls, actionable feedback and safe retry',async({page})=>{
  await page.route('**/js/bible/translation-picker.js',route=>route.abort('failed'));
  await page.setViewportSize({width:320,height:844});await page.goto('/');await page.evaluate(()=>initializeBibleExperience());
  await page.locator('#readerMoreTrigger').click();
  await expect(page.locator('#readerSaveStatus')).toContainText('Native controls');
  await expect(page.locator('#bookSelect')).toBeVisible();
  await page.locator('#verseSelect').selectOption('2');
  await page.locator('#readerSaveVerse').click();
  expect(await page.evaluate(()=>UserData.savedVerses.load())).toEqual([]);
  await page.unroute('**/js/bible/translation-picker.js');
  await page.locator('#readerMoreTrigger').click();await page.locator('#readerMoreTrigger').click();
  await expect(trigger(page,'verseSelect')).toBeVisible();
  await page.locator('#readerSaveVerse').click();await expect(page.locator('#readerSaveStatus')).toHaveText('John 1:2 (WEB) saved.');
});

test('delayed readiness saves the click-time verse once without overriding newer selection or focus',async({page})=>{
  let release;const ready=new Promise(resolve=>release=resolve);
  await page.route('**/js/bible/translation-picker.js',async route=>{await ready;await route.continue();});
  try{
    await page.setViewportSize({width:1280,height:844});await page.goto('/');await page.evaluate(()=>initializeBibleExperience());
    await page.locator('#readerMoreTrigger').click();await page.locator('#verseSelect').selectOption('2');
    await page.locator('#readerSaveVerse').dblclick();
    await expect(page.locator('#readerSaveStatus')).toHaveText('Preparing save…');
    await page.locator('#verseSelect').selectOption('3');await page.locator('#readAloudPlay').focus();
    release();await expect(page.locator('#readerSaveStatus')).toHaveText('John 1:2 (WEB) saved.');
    expect(await page.evaluate(()=>UserData.savedVerses.load().map(entry=>entry.location.verse))).toEqual([2]);
    await expect(page.locator('#readerSaveVerse')).toHaveAccessibleName('Save John 1:3 (WEB)');
    await expect(page.locator('#readAloudPlay')).toBeFocused();
  }finally{release();}
});

test('stale passage choices cannot navigate a changed Reader while global voice and speed choices remain valid',async({page})=>{
  await open(page);await trigger(page,'verseSelect').click();
  await page.evaluate(()=>navigateReaderToPassage('john',2));
  await option(page,'51').click();
  await expect(page.locator('#readerSaveStatus')).toContainText('Reader changed');
  await expect(page.locator('#readerContent h2')).toHaveText('John 2');
  expect(await page.evaluate(()=>getReaderDisplayedVerse())).toBeNull();
  await trigger(page,'readAloudSpeed').click();await option(page,'1.5').focus();
  await page.evaluate(()=>BibleSpeech.setSpeed(2));
  await expect(option(page,'2')).toHaveAttribute('aria-pressed','true');
  await expect(option(page,'1.5')).toBeFocused();
  await page.keyboard.press('Escape');await expect(trigger(page,'readAloudSpeed')).toContainText('200%');
  await trigger(page,'readAloudVoice').click();
  await page.evaluate(()=>navigateReaderToPassage('john',3));
  await option(page,'female').click();
  expect(await page.evaluate(()=>UserData.speechVoice.load())).toBe('female');
  await expect(trigger(page,'readAloudVoice')).toBeFocused();
  await expect(page.locator('#readerContent h2')).toHaveText('John 3');
});

test('external-tab saved changes synchronize the button, count and drawer',async({page,context})=>{
  await open(page);await selectReaderOption(page.locator('#verseSelect'),'2');
  await page.locator('#readerSaveVerse').click();
  const second=await context.newPage();await second.goto('/');
  await second.evaluate(()=>UserData.savedVerses.save([]));
  await expect(page.locator('#readerSaveVerse')).toHaveAttribute('aria-pressed','false');
  await expect(page.locator('#savedCount')).toHaveText('0');
  await expect(page.locator('#readerSaveStatus')).toHaveText('John 1:2 (WEB) removed from Saved.');
  await page.locator('.saved-pill').click();await expect(page.locator('#trayEmpty')).toBeVisible();
});

test('verified saved locations remain recognized when a legacy display reference differs',async({page})=>{
  await open(page);await selectReaderOption(page.locator('#verseSelect'),'2');
  await page.evaluate(()=>toggleFav('John 1:2',BibleData.getVerse('web','john',1,2).text,null,{translationId:'web',bookId:'john',chapter:1,verse:2}));
  await expect(page.locator('#readerSaveVerse')).toHaveAttribute('aria-pressed','true');
  await expect(page.locator('#readerSaveVerse')).toHaveAccessibleName('John 1:2 (WEB) saved. Manage saved verses in Saved.');
  await page.locator('#readerSaveVerse').press('Enter');
  expect(await page.evaluate(()=>UserData.savedVerses.load())).toHaveLength(1);
  await page.locator('.saved-pill').click();await page.locator('.saved-verse-remove').filter({hasText:'Remove'}).click();
  await expect(page.locator('#readerSaveVerse')).toHaveText('Save verse');
  expect(await page.evaluate(()=>UserData.savedVerses.load())).toEqual([]);
});

test('viewport changes restore the visible native launcher without replacing a focused native control',async({page})=>{
  await open(page);await trigger(page,'bookSelect').click();
  await page.setViewportSize({width:1280,height:844});
  await expect(page.locator('#readerOptionsPicker')).not.toBeVisible();
  await expect(page.locator('#bookSelect')).toBeFocused();await expect(trigger(page,'bookSelect')).toBeHidden();
  await page.setViewportSize({width:320,height:844});
  await expect(page.locator('#bookSelect')).toBeFocused();await expect(page.locator('#bookSelect')).toBeVisible();
  await trigger(page,'chapterSelect').click();await page.keyboard.press('Escape');
  await expect(trigger(page,'chapterSelect')).toBeFocused();
  await page.setViewportSize({width:1280,height:844});await expect(page.locator('#chapterSelect')).toBeFocused();
});

test('late unselected Save readiness cannot reopen a cancelled dialog or steal newer Search focus',async({page})=>{
  let release;const ready=new Promise(resolve=>release=resolve);
  await page.route('**/js/bible/translation-picker.js',async route=>{await ready;await route.continue();});
  try{
    await page.setViewportSize({width:1280,height:844});await page.goto('/');await page.evaluate(()=>initializeBibleExperience());
    await page.locator('#readerMoreTrigger').click();await page.locator('#readerSaveVerse').click();
    await page.keyboard.press('Escape');await page.locator('#searchInput').focus();
    release();await page.evaluate(()=>ReaderTranslationLoader.ensure());
    await expect(page.locator('#readerSecondaryControls')).toBeHidden();
    await expect(page.locator('#readerOptionsPicker')).not.toBeVisible();await expect(page.locator('#searchInput')).toBeFocused();
    expect(await page.evaluate(()=>UserData.savedVerses.load())).toEqual([]);
  }finally{release();}
});
