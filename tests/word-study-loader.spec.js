const {selectReaderOption}=require('./reader-navigation-test-helper');
const {test, expect} = require('@playwright/test');
const fs = require('fs');
const path = require('path');
const vm = require('vm');
const http = require('http');
const {execFileSync} = require('child_process');
const root = path.resolve(__dirname, '..');
const baseline = '10726255dec7c31071365095eaa2dd2ac38442ea';
const dependencies = ['provider','original-language-provider','local-provider','sense-selector','dictionary-provider','controller'].map(n=>'/js/word-study/'+n+'.js');
const globals = ['WordStudyProvider','OriginalLanguageWordStudyProvider','LocalWordStudyProvider','WordStudySenseSelector','DictionaryWordStudyProvider','WordStudyController'];
test.use({serviceWorkers:'block'});

async function open(page){
  await page.goto('/');
  await page.evaluate(()=>initializeBibleExperience());
  await expect(page.locator('#readerContent')).toContainText('John 1');
}
function word(page, term='beginning'){ return page.locator('#readerContent [data-word-study-term="'+term+'"]').first(); }
async function result(page){ await expect(page.locator('#wordStudyDefinition')).toContainText('The act of doing that which begins anything'); }
async function gate(page){
  let release;
  const barrier=new Promise(resolve=>release=resolve);
  await page.route('**/js/word-study/provider.js',async route=>{await barrier;await route.continue();});
  return release;
}
test.beforeEach(async({page})=>{
  page.auditErrors=[];
  page.on('pageerror',e=>page.auditErrors.push(e.message));
  await page.addInitScript(()=>{
    window.studyBindings={};window.studyInitializations=0;window.studyOpens=0;
    const add=EventTarget.prototype.addEventListener;
    EventTarget.prototype.addEventListener=function(type,...args){
      if(['readerContent','wordStudyPanel','wordStudyClose','wordStudyOriginalTokens'].includes(this.id)){
        const key=this.id+':'+type;studyBindings[key]=(studyBindings[key]||0)+1;
      }
      return add.call(this,type,...args);
    };
    document.addEventListener('load',event=>{
      if(event.target.tagName!=='SCRIPT'||!event.target.src.endsWith('/word-study/controller.js')||!window.WordStudyController)return;
      const initialize=WordStudyController.initialize,activate=WordStudyController.openFromWord;
      WordStudyController.initialize=function(...args){studyInitializations++;return initialize.apply(this,args);};
      WordStudyController.openFromWord=function(...args){studyOpens++;return activate.apply(this,args);};
    },true);
  });
});
test.afterEach(async({page})=>expect(page.auditErrors).toEqual([]));

test('anonymous page eagerly loads only the loader; Reader/Search/Compare/Plans/Saved work without the runtime',async({page})=>{
  const requests=[];page.on('request',r=>{if(r.resourceType()==='script')requests.push(new URL(r.url()).pathname);});
  await open(page);
  expect(requests).toContain('/js/word-study/loader.js');
  expect(requests.filter(p=>dependencies.includes(p))).toEqual([]);
  expect(await page.evaluate(names=>names.map(n=>typeof window[n]),globals)).toEqual(globals.map(()=>'undefined'));
  await page.locator('#searchInput').fill('John 3:16');await page.getByRole('button',{name:'Search',exact:true}).click();
  await expect(page.locator('#results .result-card')).toHaveCount(1);
  await page.getByRole('button',{name:'Compare',exact:true}).click();await expect(page.locator('#compareGrid .compare-col')).toHaveCount(2);
  await page.getByRole('button',{name:'Plan',exact:true}).click();await expect(page.locator('#planDays .plan-day')).toHaveCount(30);
  await page.locator('#heroFav').click();await page.locator('.saved-pill').click();await expect(page.locator('#trayList')).toContainText('John 3:16');
  expect(requests.filter(p=>dependencies.includes(p))).toEqual([]);
});
test('focus alone does not request runtime',async({page})=>{
  await open(page);await word(page).focus();
  expect(await page.evaluate(()=>typeof WordStudyController)).toBe('undefined');
  await expect(page.locator('#wordStudyPanel')).toBeHidden();
});
for(const activation of ['click','Enter','Space','touch'])test(`first ${activation} immediately starts ordered readiness and preserves English/Greek`,async({page,context})=>{
  if(activation==='touch')await page.setViewportSize({width:390,height:844});
  const requests=[];page.on('request',r=>{if(dependencies.includes(new URL(r.url()).pathname))requests.push(new URL(r.url()).pathname);});
  await open(page);
  if(activation==='click')await word(page).click();
  else if(activation==='touch'){
    const session=await context.newCDPSession(page);
    await word(page).scrollIntoViewIfNeeded();const target=await word(page).boundingBox();
    await session.send('Input.dispatchTouchEvent',{type:'touchStart',touchPoints:[{x:target.x+target.width/2,y:target.y+target.height/2}]});
    await session.send('Input.dispatchTouchEvent',{type:'touchEnd',touchPoints:[]});
    await session.send('Input.dispatchTouchEvent',{type:'touchStart',touchPoints:[{x:target.x+target.width/2,y:target.y+target.height/2}]});
    await session.send('Input.dispatchTouchEvent',{type:'touchEnd',touchPoints:[]});
  }else await word(page).press(activation==='Space'?' ':activation);
  await result(page);await expect(page.locator('#wordStudyOriginalTokens .word-study-original-token')).toHaveCount(17);
  expect(requests).toEqual(dependencies);
  expect(await page.evaluate(()=>[studyInitializations,WordStudyProvider.normalizeLookupTerm===WordStudyLoader.normalizeLookupTerm])).toEqual([1,true]);
  await page.locator('#wordStudyHeading').press('Escape');await expect(word(page)).toBeFocused();
});
test('canonical eager normalization matches the unchanged standalone provider for punctuation, Unicode, and all ASCII characters',()=>{
  const realm=vm.createContext({window:{},document:{readyState:'loading',addEventListener(){}}});
  vm.runInContext(fs.readFileSync(path.join(root,'js/word-study/loader.js'),'utf8'),realm);
  vm.runInContext(execFileSync('git',['show',baseline+':js/word-study/provider.js'],{encoding:'utf8'}),realm);
  const inputs=[null,undefined,0,12,false,true,'beginning',"King's",'king’s','well-beloved',"'''Word'''",'Ἰησοῦς','בְּרֵאשִׁית'];
  for(let i=0;i<128;i++)inputs.push("'A"+String.fromCharCode(i)+"Z'");
  for(const input of inputs)expect(realm.WordStudyLoader.normalizeLookupTerm(input)).toBe(realm.WordStudyProvider.normalizeLookupTerm(input));
});
test('two words share one readiness promise and only the latest activation opens',async({page})=>{
  const release=await gate(page);await open(page);
  await word(page).click();await word(page,'word').click();
  expect(await page.evaluate(()=>WordStudyLoader.ensure()===WordStudyLoader.ensure())).toBe(true);
  await expect(page.locator('#wordStudyWord')).toHaveText('Word');
  release();await page.evaluate(()=>WordStudyLoader.ensure());
  await expect(page.locator('#wordStudyPanel')).toHaveAttribute('data-word-study-state','available');
  await expect(page.locator('#wordStudyWord')).toHaveText('Word');
  expect(await page.evaluate(()=>[studyInitializations,studyOpens])).toEqual([1,1]);
});
test('double click and repeated initialization never duplicate Reader or panel handlers',async({page})=>{
  const release=await gate(page);await open(page);await word(page).dblclick();release();await result(page);
  const bindings=await page.evaluate(()=>studyBindings);
  expect(bindings['readerContent:click']).toBe(2); // one Reader verse-highlighter plus one loader
  expect(bindings['readerContent:keydown']).toBe(1);
  for(const key of ['wordStudyPanel:keydown','wordStudyClose:click','wordStudyOriginalTokens:click'])expect(bindings[key]).toBe(1);
  await page.evaluate(()=>{WordStudyLoader.initialize();WordStudyController.initialize();});
  expect(await page.evaluate(()=>studyBindings)).toEqual(bindings);
});
for(let stage=0;stage<dependencies.length;stage++)for(const failure of ['network','missing global'])test(`${dependencies[stage]} ${failure} is accessible and retry reuses successful partial dependencies`,async({page})=>{
  let failing=true;const counts=dependencies.map(()=>0);
  await page.route('**/js/word-study/*.js',route=>{
    const index=dependencies.indexOf(new URL(route.request().url()).pathname);
    if(index<0)return route.continue();counts[index]++;
    if(failing&&index===stage)return failure==='network'?route.abort():route.fulfill({contentType:'application/javascript',body:'/* intentionally absent global */'});
    return route.continue();
  });
  await open(page);await word(page).click();
  await expect(page.locator('#wordStudyPanel')).toHaveAttribute('data-word-study-state','unavailable');
  await expect(page.locator('#wordStudyStatus')).toHaveText(/could not be loaded.*try again/);
  await expect(page.locator('#wordStudyStatus')).toHaveAttribute('aria-live','polite');
  await page.keyboard.press('Escape');await expect(word(page)).toBeFocused();
  failing=false;await word(page).click();await result(page);
  expect(counts).toEqual(dependencies.map((_,i)=>i===stage?2:1));
  expect(await page.evaluate(()=>studyInitializations)).toBe(1);
});
for(const action of ['chapter','translation','rerender','detached','context changed','Close','Escape','Compare'])test(`${action} during readiness cancels replay`,async({page})=>{
  const release=await gate(page);await open(page);await word(page).click();
  await expect(page.locator('#wordStudyStatus')).toHaveText(/Loading Word Study/);
  if(action==='chapter')await selectReaderOption(page.locator('#chapterSelect'),'2');
  if(action==='translation')await page.locator('#readerTranslation').selectOption('asv');
  if(action==='rerender')await page.evaluate(()=>renderPassage(currentBook,currentChapter));
  if(action==='detached')await word(page).evaluate(e=>e.remove());
  if(action==='context changed')await word(page).evaluate(e=>e.closest('.reader-verse').setAttribute('data-verse-number','999'));
  if(action==='Close')await page.locator('#wordStudyClose').click();
  if(action==='Escape')await page.locator('#wordStudyHeading').press('Escape');
  if(action==='Compare')await page.getByRole('button',{name:'Compare',exact:true}).click();
  release();await page.evaluate(()=>WordStudyLoader.ensure());
  expect(await page.evaluate(()=>studyOpens)).toBe(0);
  await expect(page.locator('#wordStudyPanel')).toBeHidden();
  if(action==='Close'||action==='Escape')await expect(word(page)).toBeFocused();
});
test('readiness and later lookup completion do not steal Search focus',async({page})=>{
  const release=await gate(page);await open(page);await word(page).click();await page.locator('#searchInput').focus();
  release();await result(page);await expect(page.locator('#searchInput')).toBeFocused();
  await page.evaluate(()=>{WordStudyProvider.lookup=()=>new Promise(resolve=>window.finishLookup=resolve);});
  await word(page).click();await page.locator('#searchInput').focus();
  await page.evaluate(()=>finishLookup({status:'available',definition:'Delayed result'}));
  await expect(page.locator('#wordStudyDefinition')).toHaveText('Delayed result');await expect(page.locator('#searchInput')).toBeFocused();
});
test('loaded lookup remains available on Reader return without focusing the hidden panel',async({page})=>{
  await open(page);await page.evaluate(()=>WordStudyLoader.ensure());
  await page.evaluate(()=>{WordStudyProvider.lookup=()=>new Promise(resolve=>window.finishHiddenLookup=resolve);});
  await word(page).click();await page.waitForFunction(()=>typeof finishHiddenLookup==='function');
  await page.getByRole('button',{name:'Compare',exact:true}).click();
  await page.evaluate(()=>finishHiddenLookup({status:'available',definition:'Retained result'}));
  await expect(page.locator('#wordStudyDefinition')).toHaveText('Retained result');
  await expect(page.locator('#wordStudyHeading')).not.toBeFocused();
  await page.getByRole('button',{name:'Reader',exact:true}).click();
  await expect(page.locator('#wordStudyPanel')).toBeVisible();
  await expect(page.locator('#wordStudyDefinition')).toHaveText('Retained result');
});
test('dictionary and original-language lookup start in parallel after readiness',async({page})=>{
  let release;const barrier=new Promise(r=>release=r),seen=[];
  await page.route('**/data/word-study/**',async route=>{seen.push(new URL(route.request().url()).pathname);await barrier;await route.continue();});
  await open(page);await word(page).click();
  await expect.poll(()=>seen.some(x=>x.endsWith('/be.json'))&&seen.some(x=>x.endsWith('/original-language/john/1.json'))).toBe(true);
  release();await result(page);await expect(page.locator('#wordStudyOriginalTokens .word-study-original-token')).toHaveCount(17);
});
for(const [book,chapter,verse,language,count] of [['genesis',1,1,'he',7],['genesis',31,47,'arc',9],['john',1,1,'grc',17],['romans',8,28,'grc',22]])test(`${book} ${chapter}:${verse} preserves ${language} tokens and detail selection`,async({page})=>{
  await open(page);await page.evaluate(async({book,chapter})=>{await changeTranslation('kjv');await navigateReaderToPassage(book,chapter);},{book,chapter});
  await page.locator('#readerContent [data-verse-number="'+verse+'"] [data-word-study-term]').first().press('Enter');
  await expect(page.locator('#wordStudyOriginalLanguage')).toBeVisible();
  const expected=JSON.parse(fs.readFileSync(path.join(root,`data/word-study/original-language/${book}/${chapter}.json`),'utf8')).records.filter(r=>r.verse===verse).sort((a,b)=>a.tokenIndex-b.tokenIndex);
  const tokens=page.locator('#wordStudyOriginalTokens button');await expect(tokens).toHaveText(expected.map(r=>r.surface));
  expect(await tokens.evaluateAll((items,language)=>items.some(e=>e.lang===language),language)).toBe(true);
  await tokens.first().press('Enter');await expect(page.locator('#wordStudyOriginalDetails')).toBeVisible();
  await expect(page.locator('#wordStudyOriginalTokens')).toHaveAttribute('dir',language==='grc'?'ltr':'rtl');
});
for(const width of [390,1280])test(`runtime-loading panel retains sticky Close and focus at ${width}px`,async({page})=>{
  await page.setViewportSize({width,height:844});const release=await gate(page);await open(page);await word(page).press('Enter');
  await expect(page.getByRole('button',{name:'Close Word Study'})).toBeVisible();
  expect(await page.locator('.word-study-header').evaluate(e=>getComputedStyle(e).position)).toBe('sticky');
  await page.locator('#wordStudyHeading').press('Tab');await expect(page.locator('#wordStudyClose')).toBeFocused();
  await page.keyboard.press('Escape');await expect(word(page)).toBeFocused();release();await page.evaluate(()=>WordStudyLoader.ensure());
  await expect(page.locator('#wordStudyPanel')).toBeHidden();
});

test.describe('installed offline runtime',()=>{
  test.use({serviceWorkers:'allow'});
  async function installed(page){await open(page);await page.evaluate(()=>navigator.serviceWorker.ready.then(()=>true));if(!await page.evaluate(()=>!!navigator.serviceWorker.controller))await page.reload();await page.evaluate(()=>initializeBibleExperience());}
  test('cache 26 preserves six runtimes; unused runtime first activates offline with local fallback and no durable JSON',async({page,context})=>{
    await installed(page);
    const assets=await page.evaluate(async()=> (await(await caches.open('god4-shell-compact-reader-37')).keys()).map(r=>new URL(r.url).pathname));
    for(const dep of dependencies)expect(assets).toContain(dep);expect(assets).toContain('/js/word-study/loader.js');
    expect(await page.evaluate(()=>typeof WordStudyController)).toBe('undefined');
    await context.setOffline(true);await word(page).press('Enter');
    await expect(page.locator('#wordStudyDefinition')).toHaveText('The first part, point, or origin of something.');
    await expect(page.locator('#wordStudyOriginalLanguage')).toBeHidden();
    expect(await page.evaluate(async()=>{const all=[];for(const n of await caches.keys())all.push(...(await(await caches.open(n)).keys()).map(r=>r.url));return all.some(u=>u.includes('/data/word-study/'));})).toBe(false);
  });
  test('warm data survives in-page offline use but offline reload preserves only runtime and local fallback',async({page,context})=>{
    await installed(page);await word(page).click();await result(page);await expect(page.locator('#wordStudyOriginalTokens button')).toHaveCount(17);
    await page.keyboard.press('Escape');await context.setOffline(true);await word(page).click();await result(page);await expect(page.locator('#wordStudyOriginalTokens button')).toHaveCount(17);
    await page.reload();await page.evaluate(()=>initializeBibleExperience());expect(await page.evaluate(()=>typeof WordStudyController)).toBe('undefined');
    await word(page).click();await expect(page.locator('#wordStudyDefinition')).toHaveText('The first part, point, or origin of something.');await expect(page.locator('#wordStudyOriginalLanguage')).toBeHidden();
  });
  test('first-use shell-hit readiness latency is measured',async({page})=>{
    await installed(page);const timing=await page.evaluate(async()=>{const start=performance.now();await WordStudyLoader.ensure();return performance.now()-start;});
    console.log('Word Study shell-hit readiness ms:',timing);expect(timing).toBeGreaterThanOrEqual(0);
  });
});

test('page script bytes and first-use network readiness are measured against main',async({browser})=>{
  const measurements=[];
  for(const current of [false,true]){
    const server=http.createServer((req,res)=>{const url=new URL(req.url,'http://localhost'),file=url.pathname==='/'?'index.html':url.pathname.slice(1);if(file.includes('..'))return res.writeHead(400).end();try{let body=current?fs.readFileSync(path.join(root,file)):execFileSync('git',['show',baseline+':'+file],{cwd:root,stdio:['ignore','pipe','ignore']});if(file.endsWith('.js')||file.endsWith('.html'))body=Buffer.from(body.toString().replace(/\r\n/g,'\n'));res.writeHead(200,{'content-type':file.endsWith('.js')?'application/javascript':file.endsWith('.html')?'text/html':file.endsWith('.css')?'text/css':'application/octet-stream','cache-control':'no-store'}).end(body);}catch{res.writeHead(404).end();}});
    await new Promise(r=>server.listen(0,'127.0.0.1',r));const context=await browser.newContext({serviceWorkers:'block'}),page=await context.newPage();
    try{
      await page.goto('http://127.0.0.1:'+server.address().port);
      const scripts=await page.evaluate(()=>performance.getEntriesByType('resource').filter(e=>e.initiatorType==='script').map(e=>({url:e.name,transfer:e.transferSize,decoded:e.decodedBodySize})));
      measurements.push({current,count:scripts.length,transfer:scripts.reduce((n,x)=>n+x.transfer,0),decoded:scripts.reduce((n,x)=>n+x.decoded,0)});
      if(current){expect(scripts.filter(s=>dependencies.includes(new URL(s.url).pathname))).toEqual([]);const timing=await page.evaluate(async()=>{const start=performance.now();await WordStudyLoader.ensure();return performance.now()-start;});console.log('Word Study network readiness ms:',timing);}
    }finally{await context.close();await new Promise(r=>server.close(r));}
  }
  console.log('Word Study baseline/current LF local uncompressed page scripts:',JSON.stringify(measurements));
  expect(measurements.map(m=>m.count)).toEqual([24,20]);expect(measurements[1].decoded).toBeLessThan(measurements[0].decoded);
});
