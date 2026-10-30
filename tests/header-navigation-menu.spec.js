const {test,expect}=require('@playwright/test');
const fs=require('fs');
const {execFileSync}=require('child_process');
test.use({serviceWorkers:'block',hasTouch:true});
const menu=page=>page.locator('#headerMenu');
async function open(page,width=390,dark=false){
  await page.setViewportSize({width,height:844});
  await page.emulateMedia({reducedMotion:'reduce'});
  await page.addInitScript(()=>{window.IntersectionObserver=class{observe(){}disconnect(){}};});
  await page.goto('/');
  if(dark) await page.locator('[data-theme-toggle]').click();
}
async function choose(page,id){await page.locator('#headerMenuTrigger').click();await menu(page).locator(`[data-destination="${id}"]`).click();}
async function state(page){return page.evaluate(()=>({translation:currentTranslation,book:currentBook,chapter:currentChapter,verse:currentVerse,data:JSON.stringify(localStorage)}));}

for(const width of [320,390,430,1280])for(const dark of [false,true]){
  test(`${width}px dark=${dark}: groups, targets, scrolling, keyboard, dismiss and no reflow`,async({page})=>{
    await open(page,width,dark);
    const requests=[];page.on('request',r=>requests.push(r.url()));
    const before=await page.locator('#leafCard').boundingBox();
    await page.locator('#headerMenuTrigger').click();
    await expect(menu(page)).toBeVisible();
    await expect(menu(page).getByRole('heading',{level:3})).toHaveText(['Read & Study','My Bible','Preferences & Account','Explore']);
    await expect(menu(page).locator('[data-destination]')).toHaveCount(15);
    await expect(page.locator('#headerMenuClose')).toBeFocused();
    for(const button of await menu(page).getByRole('button').all()){
      await expect(button).toHaveAccessibleName(/\S/);
      const size=await button.boundingBox();expect(size.width).toBeGreaterThanOrEqual(44);expect(size.height).toBeGreaterThanOrEqual(44);
    }
    expect(await menu(page).evaluate(d=>d.scrollWidth<=d.clientWidth)).toBe(true);
    expect(await page.evaluate(()=>document.documentElement.scrollWidth<=innerWidth)).toBe(true);
    const bounds=await menu(page).boundingBox();expect(bounds.y).toBeGreaterThanOrEqual(0);expect(bounds.y+bounds.height).toBeLessThanOrEqual(844);
    await page.screenshot({path:test.info().outputPath(`menu-${width}-${dark}.png`)});
    await page.keyboard.press('Shift+Tab');await expect(menu(page).locator('[data-destination="resources"]')).toBeFocused();
    await expect(menu(page).locator('[data-destination="resources"]')).toBeInViewport({ratio:1});
    await page.keyboard.press('Tab');await expect(page.locator('#headerMenuClose')).toBeFocused();
    await expect(page.locator('#headerMenuClose')).toBeInViewport({ratio:1});
    await page.keyboard.press('Escape');await expect(menu(page)).not.toBeVisible();await expect(page.locator('#headerMenuTrigger')).toBeFocused();
    expect(await page.locator('#leafCard').boundingBox()).toEqual(before);
    await page.locator('#headerMenuTrigger').click();await page.locator('#headerMenuClose').click();await expect(page.locator('#headerMenuTrigger')).toBeFocused();
    await page.locator('#headerMenuTrigger').click();await page.mouse.click(2,2);await expect(menu(page)).not.toBeVisible();
    expect(requests.some(u=>/\/(web|dra|compare|translation-picker)\.js/.test(u))).toBe(false);
  });
}

for(const width of [390,1280]){
  test(`${width}px: Reader position, Word Study and saved state preserved`,async({page})=>{
    await open(page,width);await page.evaluate(()=>initializeBibleExperience());
    await page.evaluate(()=>navigateReaderToPassage('john',1,16));
    await page.locator('#heroFav').click();
    await page.evaluate(()=>document.querySelector('#readerContent [data-verse-number="16"]').scrollIntoView({block:'center',behavior:'instant'}));
    const before=await state(page),y=await page.evaluate(()=>scrollY);
    await choose(page,'reader');await expect(page.locator('#view-reader')).toHaveClass(/active/);
    expect(await state(page)).toEqual(before);expect(await page.evaluate(()=>scrollY)).toBe(y);
    await choose(page,'study');await expect(page.locator('#readerContent .word-study-token:focus')).toHaveCount(1);
    expect(await state(page)).toEqual(before);await expect(page.locator('#wordStudyPanel')).toBeHidden();
    await choose(page,'saved');await expect(page.locator('#tray')).toHaveAttribute('aria-hidden','false');
    await expect(page.locator('#closeTray')).toBeFocused();await page.keyboard.press('Escape');
    expect(await state(page)).toEqual(before);
    await page.evaluate(()=>document.querySelector('#readerContent [data-verse-number="16"]').scrollIntoView({block:'center',behavior:'instant'}));
    await page.evaluate(()=>new Promise(requestAnimationFrame));
    const returnY=await page.evaluate(()=>scrollY);
    for(let i=0;i<2;i++){
      await choose(page,'compare');await expect(page.locator('#view-compare')).toHaveClass(/active/);
      await choose(page,'reader');await expect(page.locator('#view-reader')).toHaveClass(/active/);
      await expect.poll(()=>page.evaluate(()=>scrollY)).toBe(returnY);
    }
  });
  test(`${width}px: Compare, Plan, Search, Account, Offline and Explore destinations`,async({page})=>{
    await open(page,width);await page.evaluate(()=>initializeBibleExperience());
    await choose(page,'compare');await expect(page.locator('#view-compare')).toHaveClass(/active/);await expect(page.locator('#compareBook')).toBeVisible();
    await choose(page,'plan');await expect(page.locator('#view-plan')).toHaveClass(/active/);await expect(page.locator('#planHeading')).toBeVisible();
    await page.locator('#searchInput').fill('faith');await choose(page,'search');await expect(page.locator('#searchInput')).toBeFocused();await expect(page.locator('#searchInput')).toHaveValue('faith');
    await choose(page,'account');await expect(page.locator('#accountDialog')).toBeVisible();await page.keyboard.press('Escape');
    await choose(page,'offline');await expect(page.locator('#offlineBiblesDialog')).toBeVisible();await page.keyboard.press('Escape');
    await choose(page,'featured');await expect(page.locator('#leafCard')).toBeFocused();
    await choose(page,'resources');await expect(page.locator('#resources')).toBeFocused();
  });
  test(`${width}px: translation, audio preferences, microphone and theme use existing controls`,async({page})=>{
    await open(page,width);await page.evaluate(()=>initializeBibleExperience());
    await choose(page,'translation');
    await expect(page.locator('#readerTranslation option')).toHaveCount(9);
    await expect(page.locator('#readerTranslation option[value="dra"]')).toContainText('Catholic');
    if(width<620){await expect(page.locator('#readerTranslationPicker')).toBeVisible();await expect(page.locator('#readerTranslationPicker [data-translation]')).toHaveCount(9);await page.keyboard.press('Escape');}
    else await expect(page.locator('#readerTranslation')).toBeFocused();
    const before=await state(page);
    await choose(page,'aloud');await expect(page.locator('#readAloudPlay')).toBeFocused();await expect(page.locator('#readerMoreTrigger')).toHaveAttribute('aria-expanded','true');
    await expect(page.locator('#readAloudPlay')).toHaveAccessibleName(/Play/);
    await choose(page,'commands');await expect(page.locator('#readerVoiceCommands')).toBeFocused();await expect(page.locator('#readerVoiceCommands')).toHaveAttribute('aria-pressed','false');
    await choose(page,'voice');
    expect(await page.evaluate(()=>['readAloudVoice'].includes(document.activeElement.id)||document.activeElement.dataset.readerSelect==='readAloudVoice')).toBe(true);
    expect(await state(page)).toEqual(before);
    await page.locator('#headerMenuTrigger').click();await expect(menu(page).locator('[data-destination="theme"]')).toHaveText('Switch to Dark Mode');await menu(page).locator('[data-destination="theme"]').click();
    await expect(page.locator('html')).toHaveAttribute('data-theme','dark');await expect(page.locator('#headerMenuTrigger')).toBeFocused();
    await page.locator('#headerMenuTrigger').click();await expect(menu(page).locator('[data-destination="theme"]')).toHaveText('Switch to Light Mode');
  });
}

test('cancelled delayed Bible load cannot navigate or steal focus after reopening',async({page})=>{
  await open(page);await page.evaluate(()=>{window.__release=null;initializeBibleExperience=()=>new Promise(resolve=>window.__release=resolve);});
  await choose(page,'reader');await page.keyboard.press('Escape');await page.locator('#headerMenuTrigger').click();
  await menu(page).locator('[data-destination="search"]').click();await expect(page.locator('#searchInput')).toBeFocused();
  await page.locator('#headerMenuTrigger').click();
  await page.evaluate(()=>window.__release(true));
  await expect(menu(page)).toBeVisible();await expect(page.locator('#headerMenuClose')).toBeFocused();
});

test('failed Bible load gives retry feedback without discarding menu or native controls',async({page})=>{
  await open(page);await page.evaluate(()=>{initializeBibleExperience=async()=>false;});await choose(page,'reader');
  await expect(menu(page)).toBeVisible();await expect(page.locator('#headerMenuStatus')).toContainText('Please try again');
  await menu(page).locator('[data-destination="search"]').click();await expect(page.locator('#searchInput')).toBeFocused();
});

test('opening Menu from the desktop Saved tray avoids competing focus traps and retains saved entries',async({page})=>{
  await open(page,1280);await page.locator('#heroFav').click();await page.locator('.saved-pill').click();
  await page.locator('#headerMenuTrigger').click();await expect(menu(page)).toBeVisible();await expect(page.locator('#tray')).toHaveAttribute('aria-hidden','true');
  await page.keyboard.press('Shift+Tab');await expect(menu(page).locator('[data-destination="resources"]')).toBeFocused();
  await page.keyboard.press('Escape');await expect(page.locator('#headerMenuTrigger')).toBeFocused();await page.locator('#headerMenuTrigger').click();
  await menu(page).locator('[data-destination="saved"]').click();await expect(page.locator('#tray')).toHaveAttribute('aria-hidden','false');
  await expect(page.locator('#closeTray')).toBeFocused();await expect(page.locator('#savedCount')).toHaveText('1');
});

for(const width of [320,390,430,1280])for(const dark of [false,true]){
  test(`${width}px dark=${dark}: existing ASV and Catholic selection, chapter and user settings survive`,async({page})=>{
    await open(page,width,dark);await page.evaluate(()=>initializeBibleExperience());
    await page.evaluate(()=>navigateReaderToPassage('john',1,2));
    for(const id of ['asv','dra']){
      await choose(page,'translation');
      if(width<620) await page.locator(`#readerTranslationPicker [data-translation="${id}"]`).click();
      else await page.locator('#readerTranslation').selectOption(id);
      await expect.poll(()=>page.evaluate(()=>currentTranslation)).toBe(id);
      await expect(page.locator('#readerContent')).toContainText('John 1');
      expect(await page.evaluate(()=>({book:currentBook,chapter:currentChapter,verse:currentVerse}))).toEqual({book:'john',chapter:1,verse:2});
    }
    await page.reload();expect(await page.evaluate(()=>currentTranslation)).toBe('dra');
  });
}

test('real footer destinations and explicit unavailable labels replace navigation placeholders',async({page})=>{
  await open(page);await expect(page.locator('a[href="#"]')).toHaveCount(0);
  await expect(page.getByRole('link',{name:'Open Bibles',exact:true})).toHaveAttribute('href','#companion');
  await expect(page.getByRole('link',{name:'Ethiopian Bible information'})).toHaveAttribute('href','#ethiopian');
  await expect(page.locator('.eth-cta')).toHaveText('Digital edition not yet available');
  await expect(page.locator('.foot-col .nav-unavailable')).toHaveCount(3);
});

test('touch dismissal and backdrop scrolling preserve the Reader position and Plan progress',async({page})=>{
  await open(page);await page.evaluate(()=>initializeBibleExperience());
  await page.evaluate(()=>{UserData.journey.save({version:1,plans:[[1,2],[],[],[],[]],completedDates:[]});document.getElementById('readerContent').scrollIntoView({block:'start',behavior:'instant'});});
  await page.evaluate(async()=>{await document.fonts.ready;await new Promise(requestAnimationFrame);await new Promise(requestAnimationFrame);});
  const progress=await page.evaluate(()=>UserData.journey.load()),y=await page.evaluate(()=>scrollY);
  await page.locator('#headerMenuTrigger').tap();await page.mouse.move(2,2);await page.mouse.wheel(0,400);
  await menu(page).evaluate(d=>new Promise(resolve=>requestAnimationFrame(()=>resolve())));
  expect(await page.evaluate(()=>scrollY)).toBe(y);
  await page.touchscreen.tap(2,2);await expect(menu(page)).not.toBeVisible();expect(await page.evaluate(()=>scrollY)).toBe(y);
  await choose(page,'plan');expect(await page.evaluate(()=>UserData.journey.load())).toEqual(progress);
  await choose(page,'reader');expect(await page.evaluate(()=>UserData.journey.load())).toEqual(progress);
});

for(const width of [390,1280])test(`${width}px: native translation remains accessible when optional picker fails`,async({page})=>{
  await open(page,width);await page.route('**/js/bible/translation-picker.js',r=>r.abort());
  await choose(page,'translation');await expect(page.locator('#readerTranslation')).toBeVisible();await expect(page.locator('#readerTranslation')).toBeFocused();
  await page.locator('#readerTranslation').selectOption('asv');
  await expect(page.locator('#readerTranslationStatus')).toContainText('Translation controls unavailable');
  await expect(page.locator('#readerTranslation')).toHaveValue('web');
  await page.unroute('**/js/bible/translation-picker.js');
  await page.locator('#readerTranslation').selectOption('asv');await expect.poll(()=>page.evaluate(()=>currentTranslation)).toBe('asv');
});

test.describe('cached menu',()=>{
  test.use({serviceWorkers:'allow'});
  test('fresh shell-54 installation serves menu and retained Bible/Saved state offline',async({page,context})=>{
    await open(page);await page.evaluate(()=>navigator.serviceWorker.ready.then(()=>true));
    await page.reload();await expect.poll(()=>page.evaluate(()=>!!navigator.serviceWorker.controller)).toBe(true);
    await page.evaluate(()=>initializeBibleExperience());await page.locator('#heroFav').click();
    const before=await state(page);
    await context.setOffline(true);await page.reload();await page.evaluate(()=>initializeBibleExperience());
    await choose(page,'reader');await expect(page.locator('#readerContent')).toContainText('John 1');
    await choose(page,'saved');await expect(page.locator('#tray')).toHaveAttribute('aria-hidden','false');await expect(page.locator('#savedCount')).toHaveText('1');
    expect(await state(page)).toEqual(before);
    expect(await page.evaluate(async()=>[...(await(await caches.open('god4-shell-compact-reader-54')).keys())].length)).toBe(49);
  });
});

test('implementation preserves shell 54, assets and strict startup budget intact',async()=>{
  const sw=fs.readFileSync('sw.js','utf8');expect(sw).toContain("'compact-reader-54'");
  expect((sw.split('const SHELL_ASSETS = [')[1].split('];')[0].match(/(?:HOME_URL|OFFLINE_URL|'[^']+')/g)||[]).length).toBe(49);
  const scripts=[...fs.readFileSync('index.html','utf8').matchAll(/<script[^>]+src="([^"]+)/g)].map(m=>m[1].split('?')[0].replace(/^\//,''));
  const bytes=scripts.reduce((n,file)=>n+Buffer.byteLength(fs.readFileSync(file,'utf8').replace(/\r\n/g,'\n')),0);
  console.log('Header menu startup scripts/bytes:',scripts.length,bytes);expect(scripts).toHaveLength(22);expect(bytes).toBeLessThanOrEqual(290914);
});

for(const width of [320,390,430,1280])for(const dark of [false,true])for(const mix of ['old app','old CSS','old app and CSS']){
  test(`${width}px dark=${dark}: ${mix} leaves functional native Read navigation`,async({page})=>{
    if(mix.includes('app'))await page.route('**/js/app.js',route=>route.fulfill({contentType:'application/javascript',body:execFileSync('git',['show','5e98b32:js/app.js'])}));
    if(mix.includes('CSS'))await page.route('**/css/components.css',route=>route.fulfill({contentType:'text/css',body:execFileSync('git',['show','5e98b32:css/components.css'])}));
    await open(page,width,dark);
    await expect(page.locator('#headerMenuTrigger')).toBeHidden();
    const fallback=page.getByRole('link',{name:'Open Bible Reader',exact:true});await expect(fallback).toBeVisible();
    const rect=await fallback.boundingBox();expect(rect.width).toBeGreaterThanOrEqual(44);expect(rect.height).toBeGreaterThanOrEqual(44);
    expect(await page.evaluate(()=>document.documentElement.scrollWidth<=innerWidth)).toBe(true);
    await page.locator('#heroFav').click();await fallback.click();await expect(page.locator('#readerContent h2')).toHaveText('John 1');
    await expect(page.locator('#savedCount')).toHaveText('1');await expect(page.locator('#headerMenu')).toHaveCount(0);
    if(mix==='old CSS'){
      await fallback.focus();
      await page.unroute('**/css/components.css');
      await page.evaluate(()=>{document.querySelector('link[href="css/components.css"]').href='/css/components.css?retry=1';});
      await expect(page.locator('#headerMenuTrigger')).toBeVisible();await expect(fallback).toBeHidden();await expect(page.locator('#headerMenuTrigger')).toBeFocused();
      await page.locator('#headerMenuTrigger').click();await expect(menu(page).locator('[data-destination]')).toHaveCount(15);
      await page.keyboard.press('Escape');await expect(page.locator('#headerMenuTrigger')).toBeFocused();
    }
  });
}

for(const followReference of [false,true])test(`delayed app, native reference followed=${followReference}: usable fallback and one enhanced menu`,async({page})=>{
  let release;const pending=new Promise(resolve=>release=resolve);
  await page.route('**/js/app.js',async route=>{await pending;await route.continue();});
  await page.addInitScript(()=>{window.IntersectionObserver=class{observe(){}disconnect(){}};});
  await page.setViewportSize({width:320,height:844});await page.goto('/',{waitUntil:'commit'});
  await expect(page.locator('#headerMenuTrigger')).toBeHidden();
  if(followReference){await page.locator('#headerMenuFallback').click();await expect(page).toHaveURL(/#companion$/);}
  else await page.locator('#headerMenuFallback').focus();
  release();await expect(page.locator('#headerMenuTrigger')).toBeVisible();
  if(!followReference)await expect(page.locator('#headerMenuTrigger')).toBeFocused();
  else await expect(page).toHaveURL(/#companion$/);
  await page.locator('#headerMenuTrigger').click();await expect(menu(page)).toHaveCount(1);await expect(menu(page).locator('[data-destination]')).toHaveCount(15);
  await page.keyboard.press('Escape');await expect(page.locator('#headerMenuTrigger')).toBeFocused();
});

test('failed CSS retains Read navigation and a delayed successful stylesheet retry enables the menu',async({page})=>{
  await page.route('**/css/components.css',route=>route.abort());await open(page);
  await expect(page.locator('#headerMenuTrigger')).toBeHidden();await page.locator('#headerMenuFallback').click();await expect(page.locator('#readerContent h2')).toHaveText('John 1');
  await page.unroute('**/css/components.css');let release;const pending=new Promise(resolve=>release=resolve);
  await page.route('**/css/components.css?retry=1',async route=>{await pending;await route.continue();});
  await page.evaluate(()=>{document.querySelector('link[href="css/components.css"]').href='/css/components.css?retry=1';});
  await expect(page.locator('#headerMenuTrigger')).toBeHidden();await expect(page.locator('#headerMenuFallback')).toBeVisible();release();
  await expect(page.locator('#headerMenuTrigger')).toBeVisible();await page.locator('#headerMenuTrigger').click();await expect(menu(page)).toBeVisible();
});

for(const width of [320,1280])test(`${width}px: production-53 HTML remains usable with new application code`,async({page})=>{
  const errors=[];page.on('pageerror',error=>errors.push(error.message));
  await page.route(url=>url.pathname==='/',route=>route.fulfill({contentType:'text/html',body:execFileSync('git',['show','5e98b32:index.html'])}));
  await open(page,width);await expect(page.locator('#headerMenuTrigger')).toHaveCount(0);
  await page.locator('.foot-col a[href="#companion"]').click();await expect(page.locator('#readerContent h2')).toHaveText('John 1');expect(errors).toEqual([]);
});

test('unsupported modal dialogs retain the native Read link',async({page})=>{
  await page.addInitScript(()=>{HTMLDialogElement.prototype.showModal=undefined;});await open(page);
  await expect(page.locator('#headerMenuTrigger')).toBeHidden();await page.locator('#headerMenuFallback').click();await expect(page.locator('#readerContent h2')).toHaveText('John 1');
});

test('a truncated components stylesheet cannot advertise menu readiness',async({page})=>{
  const source=fs.readFileSync('css/components.css','utf8');
  const prefix=source.slice(0,source.lastIndexOf('#headerMenuTrigger{--header-menu-ready:54;}'));
  await page.route('**/css/components.css',route=>route.fulfill({contentType:'text/css',body:prefix}));await open(page,320);
  await expect(page.locator('#headerMenuTrigger')).toBeHidden();await page.locator('#headerMenuFallback').click();await expect(page.locator('#readerContent h2')).toHaveText('John 1');
});
