const {test,expect}=require('@playwright/test');
const fs=require('node:fs');
const path=require('node:path');
const http=require('node:http');
const crypto=require('node:crypto');
const {execFileSync}=require('node:child_process');
const generator=require('../tools/generate-translation-manifest');

const root=path.resolve(__dirname,'..');
const baseline='a051890a7d04aac53b937e62d909e284b0101f4d';
const oldCache='god4-shell-compact-reader-43',newCache='god4-shell-compact-reader-44';
const assetPaths=['/css/companion.css','/js/bible/reader.js','/js/app.js'];
const runtimePath='/js/bible/translation-picker.js';
const prior=Object.fromEntries(['/sw.js',...assetPaths].map(url=>[url,execFileSync('git',['show',baseline+':'+url.slice(1)],{cwd:root})]));
const current=Object.fromEntries(assetPaths.map(url=>[url,fs.readFileSync(path.join(root,url.slice(1)))]));
const digest=body=>crypto.createHash('sha256').update(body).digest('hex');
const oldHashes=Object.fromEntries(assetPaths.map(url=>[url,digest(prior[url])]));
const newHashes=Object.fromEntries(assetPaths.map(url=>[url,digest(current[url])]));
const runtimeHashes={[runtimePath]:digest(fs.readFileSync(path.join(root,runtimePath.slice(1))))};
const saved=[{ref:'John 1:1',text:'Installed-user saved verse',location:{translationId:'dra',bookId:'john',chapter:1,verse:1}}];

test.use({viewport:{width:320,height:844},hasTouch:true,serviceWorkers:'allow'});

test('shell 44 adds only the lazy translation runtime and preserves activation and Bible-cache behavior',()=>{
  const worker=fs.readFileSync(path.join(root,'sw.js'),'utf8');
  expect(worker.replace(/\r\n/g,'\n').replace("'compact-reader-44'","'compact-reader-43'").replace("  '/js/bible/translation-picker.js',\n",'')).toBe(prior['/sw.js'].toString('utf8').replace(/\r\n/g,'\n'));
  for(const asset of assetPaths)expect(newHashes[asset]).not.toBe(oldHashes[asset]);
});

async function fixture(){
  const state={version:43,failCss:false};
  const types={'.html':'text/html; charset=utf-8','.js':'application/javascript; charset=utf-8','.css':'text/css; charset=utf-8','.json':'application/json','.webmanifest':'application/manifest+json','.png':'image/png','.svg':'image/svg+xml','.woff2':'font/woff2'};
  const server=http.createServer((request,response)=>{
    const pathname=new URL(request.url,'http://localhost').pathname;
    const relative=pathname==='/'?'/index.html':pathname==='/offline'?'/offline.html':pathname;
    const file=path.resolve(root,'.'+relative);
    if(!file.startsWith(root+path.sep)){response.writeHead(403).end();return;}
    if(state.version===44&&state.failCss&&pathname==='/css/companion.css'){response.writeHead(503).end('Install failure fixture');return;}
    try{
      let body=state.version===43&&prior[pathname]?prior[pathname]:fs.readFileSync(file);
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
  await expect(page.locator('#readerTranslation')).toHaveValue('dra');
  await expect(page.locator('#readerTranslationTrigger')).toHaveCount(0);
  expect(await hashes(page)).toEqual(oldHashes);
  const keys=await page.evaluate(async name=>(await(await caches.open(name)).keys()).map(request=>new URL(request.url).pathname+new URL(request.url).search).sort(),oldCache);
  expect(keys).toHaveLength(46);
  return keys;
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
  await expect(page.locator('#readerTranslationTrigger')).toBeVisible();
  await expect(page.locator('#readerTranslation')).toHaveValue('dra');
  expect(await hashes(page)).toEqual(newHashes);
  expect(await hashes(page,newCache)).toEqual(newHashes);
  expect(await hashes(page,newCache,[runtimePath])).toEqual(runtimeHashes);
  await expect.poll(()=>page.evaluate(()=>caches.keys())).not.toContain(oldCache);
}
async function retainedState(page){
  return page.evaluate(async()=>{
    const registration=await navigator.serviceWorker.ready;
    const retained={};
    for(const id of ['web','dra']){
      retained[id]=await new Promise(resolve=>{
        const channel=new MessageChannel();
        channel.port1.onmessage=event=>resolve(event.data.activeRevision);
        registration.active.postMessage({type:'BIBLE_TRANSLATION_STATUS',id},[channel.port2]);
      });
    }
    return {retained,saved:UserData.savedVerses.load(),translation:UserData.translation.load()};
  });
}

for(const width of [320,390])test(`installed shell 43 waits for acceptance, updates both assets and preserves offline data across tabs at ${width}px`,async({page,context})=>{
  test.setTimeout(60000);
  await page.setViewportSize({width,height:844});
  const server=await fixture(),errors=[];
  page.on('pageerror',error=>errors.push(error.message));
  try{
    const keys=await installOld(page,server.origin),before=await retainedState(page);
    expect(before.saved).toEqual(saved);
    expect(Object.values(before.retained).every(Boolean)).toBe(true);
    const second=await context.newPage();
    second.on('pageerror',error=>errors.push(error.message));
    await second.goto(server.origin);await second.evaluate(()=>{window.upgradeTabMarker='old tab';return initializeBibleExperience();});
    server.state.version=44;
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
    await expect(page.locator('#readerTranslationTrigger')).toHaveCount(0);
    expect(await hashes(page)).toEqual(oldHashes);
    const responses=[];
    page.on('response',response=>{if(assetPaths.concat(runtimePath).includes(new URL(response.url()).pathname))responses.push({path:new URL(response.url()).pathname,worker:response.fromServiceWorker()});});
    await acceptUpdate(page);
    for(const asset of assetPaths.concat(runtimePath))expect(responses.some(response=>response.path===asset&&response.worker)).toBe(true);
    expect(await retainedState(page)).toEqual(before);
    const upgradedKeys=await page.evaluate(async name=>(await(await caches.open(name)).keys()).map(request=>new URL(request.url).pathname+new URL(request.url).search).sort(),newCache);
    expect(upgradedKeys).toEqual(keys.concat(runtimePath).sort());
    expect(upgradedKeys).toHaveLength(47);
    expect(await page.evaluate(()=>caches.keys())).toContain('god4-auth-vendor-supabase-js-2.117.0');
    expect(await second.evaluate(()=>window.upgradeTabMarker)).toBe('old tab');
    await expect(second.locator('#readerTranslationTrigger')).toHaveCount(0);
    expect(await hashes(second)).toEqual(newHashes);
    await second.reload();await second.evaluate(()=>initializeBibleExperience());
    await expect(second.locator('#readerTranslationTrigger')).toBeVisible();
    await context.setOffline(true);
    await page.reload();await page.evaluate(()=>initializeBibleExperience());
    expect(await hashes(page)).toEqual(newHashes);
    expect(await retainedState(page)).toEqual(before);
    for(const id of ['web','dra']){
      await page.locator('#readerTranslationTrigger').click();
      await page.locator(`#readerTranslationPicker [data-translation="${id}"]`).tap();
      await expect(page.locator('#readerTranslationPicker')).not.toBeVisible();
      await expect(page.locator('#readerTranslation')).toHaveValue(id);
      await expect(page.locator('#readerContent h2')).toHaveText('John 1');
    }
    expect(errors).toEqual([]);
  }finally{await context.setOffline(false);await server.stop(context);}
});

test('failed shell-44 installation leaves installed shell 43 usable offline and retries without data loss',async({page,context})=>{
  test.setTimeout(60000);
  const server=await fixture();
  try{
    await installOld(page,server.origin);
    const before=await retainedState(page);
    server.state.version=44;server.state.failCss=true;
    await requestUpdate(page);
    await expect.poll(()=>page.evaluate(()=>window.lastInstallState)).toBe('redundant');
    expect(await page.evaluate(async()=>!!(await navigator.serviceWorker.getRegistration()).waiting)).toBe(false);
    await expect(page.locator('#pwaUpdateButton')).toBeHidden();
    expect(await hashes(page)).toEqual(oldHashes);
    await context.setOffline(true);
    await page.reload();await page.evaluate(()=>initializeBibleExperience());
    await expect(page.locator('#readerTranslation')).toBeVisible();
    await expect(page.locator('#readerTranslationTrigger')).toHaveCount(0);
    expect(await hashes(page)).toEqual(oldHashes);
    expect(await retainedState(page)).toEqual(before);
    await context.setOffline(false);server.state.failCss=false;
    await requestUpdate(page);
    await acceptUpdate(page);
    expect(await retainedState(page)).toEqual(before);
  }finally{await context.setOffline(false);await server.stop(context);}
});
