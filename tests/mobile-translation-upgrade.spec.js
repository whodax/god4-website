const {test,expect}=require('@playwright/test');
const fs=require('node:fs');
const path=require('node:path');
const http=require('node:http');
const crypto=require('node:crypto');
const {execFileSync}=require('node:child_process');
const generator=require('../tools/generate-translation-manifest');

const root=path.resolve(__dirname,'..');
for(const previous of [
  {version:43,commit:'a051890a7d04aac53b937e62d909e284b0101f4d',assets:46},
  {version:44,commit:'301b36f3b2bed4fdac5eadf5bde231a42b0c454b',assets:47},
  {version:45,commit:'51d2e4185fdc8f6294cb68ce65b88f0357be750e',assets:47},
  {version:46,commit:'cc5246704b366fe881b3d7393723810d22db308a',assets:47},
  {version:47,commit:'42e9cdaa3dbaef221b05760173c0f7237ddc4d7d',assets:47},
  {version:48,commit:'33cb61666b788e6573ebce721fc32a641ae3b474',assets:49},
  {version:49,commit:'782dfdce88c64b079b92da35f3fb477b8e0b7ccf',assets:49}
])test.describe(`installed cache ${previous.version}`,()=>{
const baseline=previous.commit;
const oldCache='god4-shell-compact-reader-'+previous.version,newCache='god4-shell-compact-reader-50';
const runtimePath='/js/bible/translation-picker.js';
const alignmentPath='/js/word-study/alignment.js';
const assetPaths=['/css/companion.css','/js/bible/reader.js','/js/bible/scripture-picker.js','/js/bible/compare.js','/js/app.js','/js/bible/speech.js',...(previous.version>=44?[runtimePath]:[]),...(previous.version>=48?[alignmentPath]:[])];
const themePaths=['/css/theme.css','/js/theme.js'];
const oldHome=previous.version>=46?execFileSync('git',['show',baseline+':index.html'],{cwd:root}):null;
const prior=Object.fromEntries(['/sw.js',...assetPaths].map(url=>[url,execFileSync('git',['show',baseline+':'+url.slice(1)],{cwd:root})]));
const current=Object.fromEntries(assetPaths.map(url=>[url,fs.readFileSync(path.join(root,url.slice(1)))]));
const digest=body=>crypto.createHash('sha256').update(body).digest('hex');
const oldHashes=Object.fromEntries(assetPaths.map(url=>[url,digest(prior[url])]));
const newHashes=Object.fromEntries(assetPaths.map(url=>[url,digest(current[url])]));
const themeHashes=Object.fromEntries(themePaths.map(url=>[url,digest(fs.readFileSync(path.join(root,url.slice(1))))]));
const runtimeHashes={[runtimePath]:digest(fs.readFileSync(path.join(root,runtimePath.slice(1))))};
const saved=[{ref:'John 1:1',text:'Installed-user saved verse',location:{translationId:'dra',bookId:'john',chapter:1,verse:1}}];

test.use({viewport:{width:320,height:844},hasTouch:true,serviceWorkers:'allow'});

test('shell 50 preserves activation, Bible caches and the exact required assets',()=>{
  const worker=fs.readFileSync(path.join(root,'sw.js'),'utf8');
  let normalized=worker.replace(/\r\n/g,'\n').replace("'compact-reader-50'","'compact-reader-"+previous.version+"'");
  if(previous.version<48)normalized=normalized.replace("  '/css/theme.css',\n",'').replace("  '/js/theme.js',\n",'');
  if(previous.version===43)normalized=normalized.replace("  '/js/bible/translation-picker.js',\n",'');
  expect(normalized).toBe(prior['/sw.js'].toString('utf8').replace(/\r\n/g,'\n'));
  if(previous.version>=48){
    const changed=previous.version===49?[alignmentPath,'/js/bible/reader.js']:['/css/companion.css',runtimePath,alignmentPath,'/js/bible/reader.js'];
    // Compare source content across Windows CRLF checkouts and Git LF blobs.
    // Keep the raw-byte hashes above unchanged: integration tests still verify
    // the exact assets served by the worker and retained across PWA upgrades.
    const normalizedSource=bytes=>bytes.toString('utf8').replace(/\r\n/g,'\n');
    for(const asset of assetPaths){
      const same=normalizedSource(current[asset])===normalizedSource(prior[asset]);
      expect(same,asset+' should '+(changed.includes(asset)?'change':'remain unchanged')+' from shell '+previous.version).toBe(!changed.includes(asset));
    }
    return;
  }
  if(previous.version===47){
    expect(current['/js/bible/speech.js'].toString('utf8').replace(/\r\n/g,'\n')).toBe(prior['/js/bible/speech.js'].toString('utf8').replace(/\r\n/g,'\n'));
    for(const asset of ['/css/companion.css','/js/bible/reader.js',runtimePath])expect(current[asset].toString('utf8').replace(/\r\n/g,'\n')).not.toBe(prior[asset].toString('utf8').replace(/\r\n/g,'\n'));
    const app=prior['/js/app.js'].toString('utf8').replace(/\r\n/g,'\n'),boundary=app.indexOf('function renderLeaf(){');
    expect(current['/js/app.js'].toString('utf8').replace(/\r\n/g,'\n')).toBe(app.slice(0,boundary)+app.slice(boundary).replace(/^ +/gm,''));
    return;
  }
  expect(newHashes['/js/bible/reader.js']).not.toBe(oldHashes['/js/bible/reader.js']);
  expect(current['/js/bible/reader.js'].toString('utf8').replace(/\r\n/g,'\n')).not.toBe(prior['/js/bible/reader.js'].toString('utf8').replace(/\r\n/g,'\n'));
  for(const asset of ['/css/companion.css','/js/app.js','/js/bible/speech.js']){
    expect(current[asset].toString('utf8').replace(/\r\n/g,'\n')).not.toBe(prior[asset].toString('utf8').replace(/\r\n/g,'\n'));
  }
});

async function fixture(){
  const state={version:previous.version,failAsset:null};
  const types={'.html':'text/html; charset=utf-8','.js':'application/javascript; charset=utf-8','.css':'text/css; charset=utf-8','.json':'application/json','.webmanifest':'application/manifest+json','.png':'image/png','.svg':'image/svg+xml','.woff2':'font/woff2'};
  const server=http.createServer((request,response)=>{
    const pathname=new URL(request.url,'http://localhost').pathname;
    const relative=pathname==='/'?'/index.html':pathname==='/offline'?'/offline.html':pathname;
    const file=path.resolve(root,'.'+relative);
    if(!file.startsWith(root+path.sep)){response.writeHead(403).end();return;}
    if(state.version===50&&pathname===state.failAsset){response.writeHead(503).end('Install failure fixture');return;}
    try{
      let body=state.version===previous.version&&pathname==='/'&&oldHome?oldHome:state.version===previous.version&&prior[pathname]?prior[pathname]:fs.readFileSync(file);
      if(/^\/js\/bible\/(web|asv|kjv|ylt|dby|webster|rv|gnv|dra)\.js$/.test(pathname))body=generator.canonicalDeployBytes(body);
      response.writeHead(200,{'content-type':types[path.extname(file)]||'application/octet-stream','cache-control':'no-store'});
      response.end(body);
    }catch(error){response.writeHead(404).end();}
  });
  await new Promise(resolve=>server.listen(0,'127.0.0.1',resolve));
  return {state,origin:'http://127.0.0.1:'+server.address().port,
    stop:async context=>{
      await Promise.all(context.pages().map(page=>page.goto('about:blank')));
      await new Promise(resolve=>{server.close(resolve);server.closeAllConnections();});
    }};
}
async function hashes(page,cacheName=null,urls=assetPaths){
  return page.evaluate(async({urls,cacheName})=>{
    const result={},cache=cacheName?await caches.open(cacheName):null;
    for(const url of urls){
      const response=cache?await cache.match(url):await fetch(url);
      if(!response)throw new Error('Missing shell asset: '+url);
      const bytes=await response.arrayBuffer();
      result[url]=Array.from(new Uint8Array(await crypto.subtle.digest('SHA-256',bytes)),byte=>byte.toString(16).padStart(2,'0')).join('');
    }
    return result;
  },{urls,cacheName});
}
async function installOld(page,origin){
  await page.addInitScript(()=>{window.IntersectionObserver=class{observe(){}unobserve(){}disconnect(){}};});
  if(previous.version===45)await page.addInitScript(()=>{
    window.__upgradeSpeech=[];
    Object.defineProperty(window,'AudioContext',{configurable:true,value:undefined});
    Object.defineProperty(window,'webkitAudioContext',{configurable:true,value:undefined});
    Object.defineProperty(window,'SpeechSynthesisUtterance',{configurable:true,value:function(text){this.text=text;}});
    Object.defineProperty(window,'speechSynthesis',{configurable:true,value:{getVoices(){return [{name:'Microsoft David',lang:'en-US',localService:true}];},addEventListener(){},cancel(){},pause(){},resume(){},speak(utterance){window.__upgradeSpeech.push(utterance.text);utterance.onstart?.();}}});
  });
  await page.goto(origin);
  await page.evaluate(()=>navigator.serviceWorker.ready.then(()=>true));
  await page.reload();
  await expect.poll(()=>page.evaluate(()=>!!navigator.serviceWorker.controller)).toBe(true);
  await page.evaluate(async entries=>{
    await initializeBibleExperience();
    if(!(await BibleTranslationLoader.retain('web')).ok)throw new Error('WEB retention failed');
    await changeTranslation('dra');
    if(!(await BibleTranslationLoader.retain('dra')).ok)throw new Error('DRA retention failed');
    UserData.savedVerses.save(entries);
    const vendor=await fetch('/js/vendor/supabase-js-2.117.0.min.js');
    if(!vendor.ok)throw new Error('Vendor fixture unavailable');
  },saved);
  if(previous.version===45)expect(await page.evaluate(async()=> (await BibleTranslationLoader.retain('kjv')).ok)).toBe(true);
  await expect(page.locator('#readerTranslation')).toHaveValue('dra');
  await expectOldPicker(page);
  expect(await hashes(page)).toEqual(oldHashes);
  const keys=await page.evaluate(async name=>(await(await caches.open(name)).keys()).map(request=>new URL(request.url).pathname+new URL(request.url).search).sort(),oldCache);
  expect(keys).toHaveLength(previous.assets);
  return keys;
}
async function expectOldPicker(page){
  if(previous.version>=44)await expectCurrentPicker(page);
  else await expect(page.locator('#readerTranslationTrigger')).toHaveCount(0);
}
async function expectCurrentPicker(page){
  if(await page.evaluate(()=>matchMedia('(max-width:620px)').matches))await expect(page.locator('#readerTranslationTrigger')).toBeVisible();
  else await expect(page.locator('#readerTranslation')).toBeVisible();
}
async function planPosition(page){
  await page.getByRole('button',{name:'Reader',exact:true}).click();
  await page.evaluate(()=>{
    const verse=document.querySelector('#readerContent [data-verse-number="45"]');
    window.scrollBy({top:verse.getBoundingClientRect().top-readerVisibleTop()-16,behavior:'instant'});
  });
  await page.getByRole('button',{name:'Plan',exact:true}).click();
  return page.evaluate(()=>{
    const heading=document.getElementById('planHeading').getBoundingClientRect();
    const day=document.querySelector('#planDays button').getBoundingClientRect();
    return {headingTop:heading.top,headingBottom:heading.bottom,dayBottom:day.bottom,top:readerVisibleTop(),height:innerHeight};
  });
}
async function requestUpdate(page){
  await page.evaluate(async()=>{
    const registration=await navigator.serviceWorker.getRegistration();
    window.lastInstallState=null;
    registration.addEventListener('updatefound',()=>{
      const worker=registration.installing;
      worker.addEventListener('statechange',()=>{window.lastInstallState=worker.state;});
    },{once:true});
    await registration.update();
  });
}
async function acceptUpdate(page){
  await expect(page.locator('#pwaUpdateButton')).toBeVisible();
  await Promise.all([page.waitForEvent('load'),page.locator('#pwaUpdateButton').click()]);
  await page.evaluate(()=>initializeBibleExperience());
  await page.evaluate(()=>ReaderTranslationLoader.ensure().then(()=>true));
  await expectCurrentPicker(page);
  await expect(page.locator('#readerTranslation')).toHaveValue('dra');
  expect(await hashes(page)).toEqual(newHashes);
  expect(await hashes(page,newCache)).toEqual(newHashes);
  expect(await hashes(page,newCache,[runtimePath])).toEqual(runtimeHashes);
  await expect.poll(()=>page.evaluate(()=>caches.keys())).not.toContain(oldCache);
}
async function retainedState(page){
  return page.evaluate(async version=>{
    const registration=await navigator.serviceWorker.ready;
    const retained={};
    for(const id of version===45?['web','dra','kjv']:['web','dra']){
      retained[id]=await new Promise(resolve=>{
        const channel=new MessageChannel();
        channel.port1.onmessage=event=>resolve(event.data.activeRevision);
        registration.active.postMessage({type:'BIBLE_TRANSLATION_STATUS',id},[channel.port2]);
      });
    }
    return {retained,saved:UserData.savedVerses.load(),translation:UserData.translation.load()};
  },previous.version);
}

async function kjvSpeech(page,updated){
  await page.evaluate(async()=>{
    if(!await BibleTranslationLoader.ensure('kjv'))throw new Error('Retained KJV unavailable');
    await navigateSearchResult({translationId:'kjv',bookId:'genesis',chapter:1,verse:2});
    const chapter=BibleData.getChapter('kjv','genesis',1);
    BibleSpeech.playVerse(chapter.verses[1],2,{translationId:'kjv',bookId:'genesis',chapter:1});
  });
  const verse=page.locator('#readerContent [data-verse-number="2"]');
  await expect(verse.locator('i')).toHaveCount(updated?1:0);
  const raw=await verse.getAttribute('data-verse-text');
  expect(raw).toContain('[was]');
  expect(await page.evaluate(()=>window.__upgradeSpeech.at(-1))).toBe(updated?raw.replace('[was]','was'):raw);
  await page.evaluate(async()=>{stopReader();await changeTranslation('dra');await navigateReaderToPassage('john',1,1);});
}

async function readerOptions(page,updated){
  await page.locator('#readerMoreTrigger').click();
  if(updated){
    await page.evaluate(()=>ReaderTranslationLoader.ensure());
    await expect(page.locator('#readerMoreTrigger')).toHaveText('Hide Options');
    const mobile=await page.evaluate(()=>matchMedia('(max-width:620px)').matches);
    for(const id of ['bookSelect','chapterSelect','verseSelect','readAloudVoice','readAloudSpeed']){
      if(mobile)await expect(page.locator(`[data-reader-select="${id}"]`)).toBeVisible();
      else await expect(page.locator('#'+id)).toBeVisible();
    }
    await page.evaluate(()=>selectReaderVerse(2));
    const save=page.locator('#readerSaveVerse');
    await save.click();await expect(page.locator('#readerSaveStatus')).toHaveText('John 1:2 (DRA) saved.');
    await expect(save).toHaveAttribute('aria-pressed','true');
    expect(await page.evaluate(()=>UserData.savedVerses.load().at(-1).location)).toEqual({translationId:'dra',bookId:'john',chapter:1,verse:2});
    await expect(save).toHaveText('Saved ✓');await expect(save).toHaveAttribute('aria-disabled','true');
    await save.press('Enter');
    expect(await page.evaluate(()=>UserData.savedVerses.load().filter(entry=>entry.location?.verse===2))).toHaveLength(1);
    await page.locator('.saved-pill').click();
    await page.locator('#tray .saved-verse-row').filter({hasText:'John 1:2 (DRA)'}).locator('.saved-verse-remove').filter({hasText:'Remove'}).click();
    await page.locator('#closeTray').click();
    await expect(save).toHaveAttribute('aria-pressed','false');
    await expect(page.locator('#readerSaveStatus')).toHaveText('John 1:2 (DRA) removed from Saved.');
    if(mobile){
      await page.locator('#readerContent').dispatchEvent('wheel',{deltaY:96});
      await page.evaluate(()=>scrollBy({top:96,behavior:'instant'}));
      const recovery=page.getByRole('button',{name:'Show Reader controls',exact:true});await expect(recovery).toBeVisible();
      const before=await page.evaluate(()=>({scroll:scrollY,content:document.getElementById('readerContent').getBoundingClientRect().top}));
      await recovery.tap();
      await expect(page.locator('.reader-toolbar')).toHaveCSS('visibility','visible');
      await expect(page.locator('#readAloudPlay')).toBeFocused();
      expect(await page.evaluate(()=>({scroll:scrollY,content:document.getElementById('readerContent').getBoundingClientRect().top}))).toEqual(before);
      await expect(page.locator('#readerMoreTrigger')).toHaveText('Hide Options');
    }
  }else expect(await page.evaluate(()=>typeof ReaderOptions)).toBe('undefined');
  await page.locator('#readerMoreTrigger').press('Escape');
  await expect(page.locator('#readerSecondaryControls')).toBeHidden();
  if(updated)await expect(page.locator('#readerMoreTrigger')).toHaveText('Options');
}

for(const width of previous.version>=44?[1280,320,390]:[320,390])test(`installed shell ${previous.version} waits for acceptance and preserves offline data across tabs at ${width}px`,async({page,context})=>{
  test.setTimeout(60000);
  await page.setViewportSize({width,height:844});
  const server=await fixture(),errors=[];
  page.on('pageerror',error=>errors.push(error.message));
  try{
    const keys=await installOld(page,server.origin),before=await retainedState(page);
    if(previous.version===47)await page.evaluate(()=>localStorage.setItem('god4.theme','dark'));
    expect(before.saved).toEqual(saved);
    expect(Object.values(before.retained).every(Boolean)).toBe(true);
    if(previous.version===46)await readerOptions(page,false);
    if(previous.version===45)await kjvSpeech(page,false);
    if(previous.version===44){
      const oldPosition=await planPosition(page);
      expect(oldPosition.headingTop).toBeLessThan(oldPosition.top);
    }
    const second=await context.newPage();
    second.on('pageerror',error=>errors.push(error.message));
    await second.goto(server.origin);await second.evaluate(()=>{window.upgradeTabMarker='old tab';return initializeBibleExperience();});
    server.state.version=50;
    await requestUpdate(page);
    await expect(page.locator('#pwaUpdateButton')).toBeVisible();
    expect(await page.evaluate(async()=>{
      const registration=await navigator.serviceWorker.getRegistration();
      return {active:registration.active.state,waiting:registration.waiting.state};
    })).toEqual({active:'activated',waiting:'installed'});
    expect(await hashes(page)).toEqual(oldHashes);
    expect(await hashes(page,newCache)).toEqual(newHashes);
    expect(await hashes(page,newCache,[runtimePath])).toEqual(runtimeHashes);
    await page.reload();await page.evaluate(()=>initializeBibleExperience());
    await expectOldPicker(page);
    expect(await hashes(page)).toEqual(oldHashes);
    const responses=[];
    page.on('response',response=>{if(assetPaths.concat(runtimePath).includes(new URL(response.url()).pathname))responses.push({path:new URL(response.url()).pathname,worker:response.fromServiceWorker()});});
    await acceptUpdate(page);
    if(previous.version===47){
      await expect(page.locator('html')).toHaveAttribute('data-theme','dark');
      expect(await hashes(page,newCache,themePaths)).toEqual(themeHashes);
      expect(await hashes(page,null,themePaths)).toEqual(themeHashes);
    }
    if(previous.version===44){
      const newPosition=await planPosition(page);
      expect(newPosition.headingTop).toBeGreaterThanOrEqual(newPosition.top);
      expect(newPosition.headingBottom).toBeLessThanOrEqual(newPosition.height);
      expect(newPosition.dayBottom).toBeLessThanOrEqual(newPosition.height);
      console.log('Installed 44-to-50 Reader/Plan geometry:',JSON.stringify({width,newPosition}));
    }
    if(previous.version===45)await kjvSpeech(page,true);
    if(previous.version===46)await readerOptions(page,true);
    for(const asset of assetPaths.concat(runtimePath))expect(responses.some(response=>response.path===asset&&response.worker)).toBe(true);
    expect(await retainedState(page)).toEqual(before);
    const upgradedKeys=await page.evaluate(async name=>(await(await caches.open(name)).keys()).map(request=>new URL(request.url).pathname+new URL(request.url).search).sort(),newCache);
    expect(upgradedKeys).toEqual(keys.concat(previous.version>=48?[]:themePaths,previous.version===43?[runtimePath]:[]).sort());
    expect(upgradedKeys).toHaveLength(49);
    expect(await page.evaluate(()=>caches.keys())).toContain('god4-auth-vendor-supabase-js-2.117.0');
    expect(await second.evaluate(()=>window.upgradeTabMarker)).toBe('old tab');
    await expectOldPicker(second);
    expect(await hashes(second)).toEqual(newHashes);
    await second.reload();await second.evaluate(()=>initializeBibleExperience());
    await expect(second.locator('#readerTranslationTrigger')).toBeVisible();
    await context.setOffline(true);
    await page.reload();await page.evaluate(()=>initializeBibleExperience());
    expect(await hashes(page)).toEqual(newHashes);
    if(previous.version===47){expect(await hashes(page,null,themePaths)).toEqual(themeHashes);await expect(page.locator('html')).toHaveAttribute('data-theme','dark');await page.locator('[data-theme-toggle]').click();await expect(page.locator('html')).toHaveAttribute('data-theme','light');}
    expect(await retainedState(page)).toEqual(before);
    if(previous.version===45)await kjvSpeech(page,true);
    if(previous.version===46)await readerOptions(page,true);
    if(previous.version===44){
      const offlinePosition=await planPosition(page);
      expect(offlinePosition.headingTop).toBeGreaterThanOrEqual(offlinePosition.top);
      expect(offlinePosition.headingBottom).toBeLessThanOrEqual(offlinePosition.height);
      await page.getByRole('button',{name:'Reader',exact:true}).click();
    }
    for(const id of ['web','dra']){
      if(width<=620){
        await page.locator('#readerTranslationTrigger').click();
        await page.locator(`#readerTranslationPicker [data-translation="${id}"]`).tap();
        await expect(page.locator('#readerTranslationPicker')).not.toBeVisible();
      }else await page.locator('#readerTranslation').selectOption(id);
      await expect(page.locator('#readerTranslation')).toHaveValue(id);
      await expect.poll(()=>page.evaluate(()=>currentTranslation)).toBe(id);
      await expect(page.locator('#readerContent h2')).toHaveText('John 1');
    }
    if(previous.version===47){
      await page.getByRole('button',{name:'Compare',exact:true}).click();
      const trigger=page.locator('[data-themed-select="compareChapter"]');
      await expect(trigger).toBeVisible();await trigger.click();
      await expect(page.locator('#themedSelectPicker')).toBeVisible();
      await page.locator('#themedSelectPicker [data-option-value="3"]').click();
      await expect(page.locator('#compareSummary')).toHaveText('Comparing John 3');
      await expect(trigger).toHaveText('Chapter 3');
      await page.getByRole('button',{name:'Reader',exact:true}).click();
    }
    expect(errors).toEqual([]);
  }finally{await context.setOffline(false);await server.stop(context);}
});

test(`failed shell-50 installation leaves installed shell ${previous.version} usable offline and retries without data loss`,async({page,context})=>{
  test.setTimeout(60000);
  const server=await fixture();
  try{
    await installOld(page,server.origin);
    const before=await retainedState(page);
    server.state.version=50;server.state.failAsset=previous.version===49?alignmentPath:previous.version===48?'/css/companion.css':previous.version===47?'/js/theme.js':previous.version===46?runtimePath:previous.version===45?'/js/bible/speech.js':previous.version===44?'/js/bible/reader.js':'/css/companion.css';
    await requestUpdate(page);
    await expect.poll(()=>page.evaluate(()=>window.lastInstallState)).toBe('redundant');
    expect(await page.evaluate(async()=>!!(await navigator.serviceWorker.getRegistration()).waiting)).toBe(false);
    await expect(page.locator('#pwaUpdateButton')).toBeHidden();
    expect(await hashes(page)).toEqual(oldHashes);
    await context.setOffline(true);
    await page.reload();await page.evaluate(()=>initializeBibleExperience());
    if(previous.version===43)await expect(page.locator('#readerTranslation')).toBeVisible();
    await expectOldPicker(page);
    expect(await hashes(page)).toEqual(oldHashes);
    expect(await retainedState(page)).toEqual(before);
    if(previous.version===45)await kjvSpeech(page,false);
    await context.setOffline(false);server.state.failAsset=null;
    await requestUpdate(page);
    await acceptUpdate(page);
    if(previous.version===46)await readerOptions(page,true);
    if(previous.version===45)await kjvSpeech(page,true);
    expect(await retainedState(page)).toEqual(before);
  }finally{await context.setOffline(false);await server.stop(context);}
});
});
