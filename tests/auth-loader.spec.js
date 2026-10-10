const {test,expect}=require('@playwright/test');
const fs=require('fs'),path=require('path');
const root=path.resolve(__dirname,'..');
const {execFileSync}=require('child_process');
const http=require('http');
const key='sb-loader-test-auth-token';
const deps=['/js/vendor/supabase-js-2.117.0.min.js','/js/auth/supabase-provider.js','/js/auth/auth.js'];
async function fakeClient(page,{session=false,delayed=false,restoreFails=false}={}){
  await page.route('**/js/auth/config.js',route=>route.fulfill({contentType:'text/javascript',body:`var God4AuthConfig={enabled:true,authStorageKey:${JSON.stringify(key)},supabaseUrl:'https://example.supabase.co',publishableKey:'test-public',allowedHosts:['127.0.0.1'],allowedOrigins:['http://127.0.0.1:4173'],callbackPath:'/auth/callback/'};`}));
  await page.route('**/js/vendor/supabase-js-2.117.0.min.js',route=>route.fulfill({contentType:'text/javascript',body:`window.clientCount=0;window.subscriptionCount=0;window.supabase={createClient(url,publishable,options){window.clientCount++;window.receivedStorageKey=options.auth.storageKey;return{auth:{getSession(){return ${restoreFails?`Promise.reject(new Error('Controlled restoration failure'))`:delayed?`new Promise(resolve=>window.finishRestore=()=>resolve({data:{session:${session?`{user:{id:'test-user',email:'reader@example.test'},access_token:'private-test-sentinel'}`:'null'}}}))`:`Promise.resolve({data:{session:${session?`{user:{id:'test-user',email:'reader@example.test'},access_token:'private-test-sentinel'}`:'null'}}})`};},onAuthStateChange(){window.subscriptionCount++;return{data:{subscription:{unsubscribe(){}}}};},signOut:async()=>({}),signInWithPassword:async()=>({data:{user:{id:'test-user'}}})}};}};` }));
}
async function open(page){await page.goto('/');}
test.beforeEach(async({page})=>{page.errors=[];page.on('pageerror',e=>page.errors.push(e.message));});
test.afterEach(async({page})=>expect(page.errors).toEqual([]));

test('anonymous startup leaves the full auth stack absent and Bible/local features independent',async({page})=>{
  const requests=[];page.on('request',r=>{if(deps.includes(new URL(r.url()).pathname))requests.push(r.url());});
  await page.route('**/js/vendor/supabase-js-2.117.0.min.js',route=>route.abort());await open(page);
  expect(await page.evaluate(()=>typeof God4Auth)).toBe('undefined');
  await page.evaluate(async()=>{await initializeBibleExperience();await navigateReaderToPassage('john',1);});
  await page.locator('#chapterSelect').selectOption('2');await expect(page.locator('#readerContent h2')).toHaveText('John 2');
  await page.locator('#searchInput').fill('Genesis 24:45');await page.getByRole('button',{name:'Search',exact:true}).click();await page.locator('#results .result-card').first().click();
  await expect(page.locator('#verseSelect')).toHaveValue('45');
  await page.locator('[aria-controls="view-compare"]').click();await expect(page.locator('.compare-col')).toHaveCount(2);
  await page.locator('[aria-controls="view-plan"]').click();await expect(page.locator('#planDays .plan-day')).toHaveCount(30);
  await page.locator('#heroFav').click();await expect(page.locator('#savedCount')).toHaveText('1');
  expect(requests).toEqual([]);expect(await page.evaluate(()=>typeof God4Auth)).toBe('undefined');
});
for(const activation of ['click','Enter','Space'])test(`early ${activation} opens accessible loading and starts auth once`,async({page})=>{
  await fakeClient(page,{delayed:true});await page.goto('/',{waitUntil:'domcontentloaded'});const button=page.locator('#accountTrigger');
  if(activation==='click')await button.click();else {await button.focus();await button.press(activation);}
  await expect(page.locator('#accountRestoring')).toBeVisible();await expect(page.locator('#accountClose')).toBeFocused();
  await expect(page.locator('#accountRestoring')).toHaveAttribute('role','status');
  await expect.poll(()=>page.evaluate(()=>typeof finishRestore)).toBe('function');
  await page.evaluate(()=>finishRestore());await expect(page.locator('#accountSignInForm')).toBeVisible();
  await expect(page.locator('#accountClose')).toBeFocused();expect(await page.evaluate(()=>clientCount)).toBe(1);
});
test('concurrent readiness deduplicates scripts, service, client, subscriptions and UI binding',async({page})=>{
  await fakeClient(page);await open(page);let requests=[];page.on('request',r=>{if(deps.includes(new URL(r.url()).pathname))requests.push(new URL(r.url()).pathname)});
  expect(await page.evaluate(async()=>{const a=God4AuthLoader.ensure(),b=God4AuthLoader.ensure();await Promise.all([a,b]);return a===b;})).toBe(true);
  expect(requests).toEqual(deps);expect(await page.evaluate(()=>({clients:clientCount,subscriptions:subscriptionCount,key:receivedStorageKey}))).toEqual({clients:1,subscriptions:1,key});
  await page.addScriptTag({url:'/js/auth/loader.js'});await page.addScriptTag({url:'/js/auth/account-ui.js?v=20260924-1'});
  await page.evaluate(()=>God4AuthLoader.ensure());expect(await page.evaluate(()=>subscriptionCount)).toBe(1);
  const count=await page.evaluate(()=>{let calls=0;const dialog=document.getElementById('accountDialog'),show=dialog.showModal.bind(dialog);dialog.showModal=()=>{calls++;show()};document.getElementById('accountTrigger').click();return calls});expect(count).toBe(1);
});
test('session presence restores eagerly without exposing storage values or signed-out flash',async({page})=>{
  await fakeClient(page,{session:true,delayed:true});await page.addInitScript(key=>localStorage.setItem(key,'private-test-sentinel'),key);await open(page);
  await expect.poll(()=>page.evaluate(()=>typeof finishRestore)).toBe('function');await expect(page.locator('#accountTrigger')).toHaveText('Account');
  await page.locator('#accountTrigger').click();await expect(page.locator('#accountSignInForm')).toBeHidden();
  await page.evaluate(()=>finishRestore());await expect(page.locator('#accountTrigger')).toHaveText('reader@example.test');
  expect(await page.evaluate(()=>JSON.stringify(God4Auth.getState()))).not.toContain('private-test-sentinel');expect(await page.locator('body').textContent()).not.toContain('private-test-sentinel');
});
test('storage read failure triggers conservative eager initialization',async({page})=>{
  await fakeClient(page);await page.addInitScript(key=>{const get=Storage.prototype.getItem;Storage.prototype.getItem=function(name){if(name===key)throw new Error('Controlled denied storage');return get.call(this,name)}},key);await open(page);
  await expect.poll(()=>page.evaluate(()=>window.clientCount||0)).toBe(1);
});
test('cross-tab appearance loads once and removal never fabricates signed-out state',async({page,context})=>{
  await fakeClient(page,{session:true});await open(page);
  const other=await context.newPage();await other.goto('/');
  await other.evaluate(key=>localStorage.setItem(key,'private-test-sentinel'),key);
  await expect(page.locator('#accountTrigger')).toHaveText('reader@example.test');
  await other.evaluate(key=>localStorage.removeItem(key),key);
  expect(await page.evaluate(()=>God4Auth.getState().status)).toBe('signed-in');expect(await page.evaluate(()=>clientCount)).toBe(1);
  await other.close();
});
test('dismissed loading dialog stays closed and focus is not stolen on completion',async({page})=>{
  await fakeClient(page,{delayed:true});await open(page);await page.locator('#accountTrigger').click();await expect.poll(()=>page.evaluate(()=>typeof finishRestore)).toBe('function');
  await page.keyboard.press('Escape');await expect(page.locator('#accountTrigger')).toBeFocused();await page.getByRole('button',{name:'Search',exact:true}).click();await page.locator('#searchInput').focus();
  await page.evaluate(()=>finishRestore());await page.evaluate(()=>God4AuthLoader.ensure());await expect(page.locator('#accountDialog')).not.toBeVisible();await expect(page.locator('#searchInput')).toBeFocused();
});
for(const stage of [0,1,2])for(const failure of ['network','missing global'])test(`${deps[stage]} ${failure} rejects and retries with prior dependencies reused`,async({page})=>{
  await fakeClient(page);let failing=true,counts=[0,0,0];
  await page.route('**/js/**',async route=>{const i=deps.indexOf(new URL(route.request().url()).pathname);if(i<0)return route.fallback();counts[i]++;if(i===stage&&failing){if(failure==='network')return route.abort();return route.fulfill({contentType:'text/javascript',body:'/* controlled missing dependency */'});}return route.fallback();});
  await open(page);const message=await page.evaluate(()=>God4AuthLoader.ensure().then(()=>null,e=>e.message));expect(message).toBe('Account scripts could not be loaded.');
  await page.locator('#accountTrigger').click();await expect(page.locator('#accountUnavailable')).toBeVisible();await page.keyboard.press('Escape');
  failing=false;await page.locator('#accountTrigger').click();await expect(page.locator('#accountSignInForm')).toBeVisible();
  for(let i=0;i<stage;i++)expect(counts[i]).toBe(1);expect(await page.evaluate(()=>clientCount)).toBe(1);expect(await page.evaluate(()=>subscriptionCount)).toBe(1);
});
test('restoration failure remains unavailable without creating a second client',async({page})=>{
  await fakeClient(page,{restoreFails:true});await open(page);await page.locator('#accountTrigger').click();await expect(page.locator('#accountUnavailable')).toBeVisible();
  await page.keyboard.press('Escape');await page.locator('#accountTrigger').click();await expect(page.locator('#accountUnavailable')).toBeVisible();expect(await page.evaluate(()=>clientCount)).toBe(1);
});

test('a stale storage hint grants no identity and URL indicators trigger normal-page readiness',async({page})=>{
  await fakeClient(page);await page.addInitScript(key=>localStorage.setItem(key,'private-test-sentinel'),key);
  const logs=[];page.on('console',message=>logs.push(message.text()));await open(page);
  await expect.poll(()=>page.evaluate(()=>window.God4Auth?.getState().status)).toBe('guest');
  expect(await page.evaluate(()=>God4Auth.getState().user)).toBeNull();expect(logs.join('\n')).not.toContain('private-test-sentinel');
  await page.evaluate(key=>localStorage.removeItem(key),key);
  await page.goto('/?code=synthetic-indicator');await expect.poll(()=>page.evaluate(()=>window.clientCount||0)).toBe(1);
});

test('cached auth stays unexecuted until Account activation and loads offline',async({page,context})=>{
  await open(page);await page.evaluate(()=>navigator.serviceWorker.ready.then(()=>true));
  if(!await page.evaluate(()=>Boolean(navigator.serviceWorker.controller)))await page.reload();
  await expect.poll(()=>page.evaluate(()=>Boolean(navigator.serviceWorker.controller))).toBe(true);
  const cached=await page.evaluate(async()=>{const cache=await caches.open('god4-shell-compact-reader-24');return(await cache.keys()).map(r=>new URL(r.url).pathname)});
  for(const asset of [...deps,'/js/auth/config.js','/js/auth/loader.js','/js/auth/account-ui.js'])expect(cached).toContain(asset);
  expect(await page.evaluate(()=>typeof God4Auth)).toBe('undefined');await context.setOffline(true);
  await page.locator('#accountTrigger').click();await page.evaluate(()=>God4AuthLoader.ensure());
  expect(await page.evaluate(()=>[typeof supabase.createClient,typeof SupabaseAuthProvider.create,typeof God4Auth.initialize])).toEqual(['function','function','function']);
  await expect(page.locator('#accountUnavailable')).toBeVisible(); // Local origin remains unapproved, as before.
});

test('returning identity causes no additional layout shift relative to eager baseline',async({browser})=>{
  const baseline=file=>execFileSync('git',['show',`a1b83bc89f287095a2709313398e83fad7b3273e:${file}`],{cwd:root,encoding:'utf8'});
  const measurements=[];
  for(const eager of [true,false]){
    const context=await browser.newContext({viewport:{width:390,height:844},serviceWorkers:'block'}),page=await context.newPage();
    await fakeClient(page,{session:true,delayed:true});await page.addInitScript(key=>{
      localStorage.setItem(key,'private-test-sentinel');window.shifts=[];
      new PerformanceObserver(list=>window.shifts.push(...list.getEntries().map(e=>({time:e.startTime,value:e.value,recent:e.hadRecentInput})))).observe({type:'layout-shift',buffered:true});
    },key);
    if(eager){await page.route('http://127.0.0.1:4173/',r=>r.fulfill({contentType:'text/html',body:baseline('index.html')}));await page.route('**/js/auth/account-ui.js*',r=>r.fulfill({contentType:'text/javascript',body:baseline('js/auth/account-ui.js')}));}
    await page.goto('http://127.0.0.1:4173/');await expect.poll(()=>page.evaluate(()=>typeof finishRestore)).toBe('function');
    await page.evaluate(()=>document.fonts.ready);await page.waitForTimeout(600);
    const start=await page.evaluate(()=>performance.now());const before=await page.locator('#accountTrigger').boundingBox();
    await page.evaluate(()=>finishRestore());await expect(page.locator('#accountTrigger')).toHaveText('reader@example.test');await page.waitForTimeout(150);
    const after=await page.locator('#accountTrigger').boundingBox();const cls=await page.evaluate(start=>shifts.filter(e=>e.time>=start&&!e.recent).reduce((sum,e)=>sum+e.value,0),start);
    measurements.push({eager,before,after,cls});await context.close();
  }
  console.log('Account restoration layout measurements:',JSON.stringify(measurements));
  expect(measurements[1].cls).toBeLessThanOrEqual(measurements[0].cls+0.0001);
  expect(measurements[1].before.width).toBeCloseTo(measurements[0].before.width,1);
  expect(measurements[1].after.width).toBeCloseTo(measurements[0].after.width,1);
});

test('anonymous critical-path script bytes are measured separately from worker precache',async({browser})=>{
  const results=[];
  for(const eager of [true,false]){
    const server=http.createServer((request,response)=>{
      const pathname=new URL(request.url,'http://localhost').pathname;
      const file=pathname==='/'?'index.html':pathname.slice(1);
      if(file.includes('..'))return response.writeHead(400).end();
      try{
        const body=eager&&(file==='index.html'||file.endsWith('.js'))?execFileSync('git',['show',`a1b83bc89f287095a2709313398e83fad7b3273e:${file}`],{cwd:root,stdio:['ignore','pipe','ignore']}):fs.readFileSync(path.join(root,file));
        response.writeHead(200,{'Content-Type':file.endsWith('.js')?'application/javascript':file.endsWith('.css')?'text/css':file.endsWith('.html')?'text/html':'application/octet-stream','Cache-Control':'no-store'}).end(body);
      }catch{response.writeHead(404).end();}
    });
    await new Promise(resolve=>server.listen(0,'127.0.0.1',resolve));
    const context=await browser.newContext({serviceWorkers:'block'}),page=await context.newPage();
    try{
      await page.goto(`http://127.0.0.1:${server.address().port}/`);
      const scripts=await page.evaluate(()=>performance.getEntriesByType('resource').filter(e=>e.initiatorType==='script').map(e=>({path:new URL(e.name).pathname,transfer:e.transferSize,encoded:e.encodedBodySize,decoded:e.decodedBodySize})));
      results.push({eager,count:scripts.length,transfer:scripts.reduce((n,s)=>n+s.transfer,0),encoded:scripts.reduce((n,s)=>n+s.encoded,0),decoded:scripts.reduce((n,s)=>n+s.decoded,0),auth:scripts.filter(s=>s.path.startsWith('/js/auth/')||s.path.includes('/vendor/supabase'))});
      if(!eager)expect(scripts.some(s=>deps.includes(s.path))).toBe(false);
    }finally{await context.close();await new Promise(resolve=>server.close(resolve));}
  }
  console.log('Local uncompressed script resource measurements (baseline Git blobs/current checkout; worker blocked):',JSON.stringify(results));
  // Git blobs use LF; checkout byte counts also include working-tree line endings.
  expect(results[1].decoded).toBeLessThan(results[0].decoded-210000);
});
