const {selectReaderOption}=require('./reader-navigation-test-helper');
const {test,expect}=require('@playwright/test');
const fs=require('fs'),path=require('path'),{execFileSync}=require('child_process');
const root=path.resolve(__dirname,'..');
test.use({serviceWorkers:'block'});
const tab=p=>p.getByRole('button',{name:'Compare',exact:true});
const reader=p=>p.getByRole('button',{name:'Reader',exact:true});
const count=(p,n)=>p.locator('[data-compare-count="'+n+'"]');
async function open(p){await p.goto('/');await p.evaluate(()=>initializeBibleExperience());await expect(p.locator('#readerContent h2')).toHaveText('John 1');}
async function rendered(p,n=2){await expect(p.locator('#compareGrid .compare-col')).toHaveCount(n);}
async function gate(p){let release;const barrier=new Promise(r=>release=r);await p.route('**/js/bible/compare.js',async r=>{await barrier;await r.continue()});return release;}
test.beforeEach(async({page})=>{
 page.auditErrors=[];page.auditFailures=[];page.auditConsole=[];page.on('pageerror',e=>page.auditErrors.push(e.message));page.on('requestfailed',r=>page.auditFailures.push({url:r.url(),error:r.failure()?.errorText}));page.on('console',m=>{if(m.type()==='error')page.auditConsole.push(m.text())});
 await page.addInitScript(()=>{
  window.compareAudit={init:0,activations:0,bindings:{},csp:[]};
  document.addEventListener('securitypolicyviolation',e=>compareAudit.csp.push(e.violatedDirective));
  const add=EventTarget.prototype.addEventListener;
  EventTarget.prototype.addEventListener=function(type,...args){
   if(this.id?.startsWith('compare')||this.classList?.contains('compare-edition-control')){const k=(this.id||this.className)+':'+type;compareAudit.bindings[k]=(compareAudit.bindings[k]||0)+1;}
   return add.call(this,type,...args);
  };
  document.addEventListener('load',e=>{
   if(e.target.tagName!=='SCRIPT'||!e.target.src.endsWith('/bible/compare.js')||!window.CompareRuntime)return;
   const init=CompareRuntime.initialize,activate=CompareRuntime.activate;
   if(typeof init==='function')CompareRuntime.initialize=function(...a){compareAudit.init++;return init.apply(this,a)};
   if(typeof activate==='function')CompareRuntime.activate=function(...a){compareAudit.activations++;return activate.apply(this,a)};
  },true);
 });
});
test.afterEach(async({page},info)=>{if(info.status!==info.expectedStatus)console.log('Compare failure diagnostics:',JSON.stringify({network:page.auditFailures,console:page.auditConsole,state:await page.evaluate(()=>({summary:document.getElementById('compareSummary')?.textContent,api:typeof CompareRuntime,audit:compareAudit})).catch(()=>null)}));expect(page.auditErrors).toEqual([])});

test('eager entry preserves Reader, Search, Plans, Saved and Word Study without Compare requests',async({page})=>{
 const scripts=[];page.on('request',r=>{if(r.resourceType()==='script')scripts.push(new URL(r.url()).pathname)});
 await open(page);expect(scripts).toContain('/js/bible/compare-loader.js');expect(scripts).not.toContain('/js/bible/compare.js');
 await page.locator('#readerContent [data-word-study-term="beginning"]').first().press('Enter');
 await expect(page.locator('#wordStudyDefinition')).toContainText('The act of doing that which begins anything');await page.keyboard.press('Escape');
 await page.locator('#searchInput').fill('John 3:16');await page.getByRole('button',{name:'Search',exact:true}).click();await expect(page.locator('#results .result-card')).toHaveCount(1);
 await page.getByRole('button',{name:'Plan',exact:true}).click();await expect(page.locator('#planDays button')).toHaveCount(30);
 await page.locator('#heroFav').click();await page.locator('.saved-pill').click();await expect(page.locator('#trayList')).toContainText('John 3:16');
 expect(scripts).not.toContain('/js/bible/compare.js');expect(await page.evaluate(()=>typeof CompareRuntime)).toBe('undefined');
});
test('focus alone does not load Compare',async({page})=>{await open(page);await tab(page).focus();await count(page,3).focus();expect(await page.evaluate(()=>typeof CompareRuntime)).toBe('undefined')});
for(const activation of ['click','Enter','Space'])test('first tab '+activation+' preserves activation and focus',async({page})=>{
 await open(page);if(activation==='click')await tab(page).click();else await tab(page).press(activation==='Space'?' ':activation);
 await rendered(page);await expect(page.locator('#compareSummary')).toHaveText('Comparing John 1');await expect(tab(page)).toBeFocused();
 expect(await page.evaluate(()=>[compareAudit.init,compareAudit.activations])).toEqual([1,1]);
});
test('Compare opens immediately before Reader initialization',async({page})=>{await page.goto('/');await tab(page).click();await rendered(page);await expect(page.locator('#compareSummary')).toHaveText('Comparing John 1')});
for(const n of [2,3,4])for(const activation of ['click','Enter','Space'])test(n+' editions first '+activation+' from Reader',async({page})=>{
 await open(page);if(activation==='click')await count(page,n).click();else await count(page,n).press(activation==='Space'?' ':activation);
 await rendered(page,n);await expect(page.locator('#view-reader')).toHaveClass(/active/);await expect(count(page,n)).toBeFocused();await expect(count(page,n)).toHaveAttribute('aria-pressed','true');
});
test('shared readiness, latest edition and repeated activation bind once',async({page})=>{
 const release=await gate(page);let requests=0;page.on('request',r=>{if(r.url().endsWith('/bible/compare.js'))requests++});await open(page);
 await tab(page).click();await count(page,3).click();await count(page,4).click();
 expect(await page.evaluate(()=>CompareLoader.ensure()===CompareLoader.ensure())).toBe(true);
 await expect(page.locator('#compareRuntimeStatus')).toHaveText('Loading Compare.');release();await rendered(page,4);
 expect(await page.evaluate(()=>[compareAudit.init,compareAudit.activations])).toEqual([1,1]);expect(requests).toBe(1);
 const bindings=await page.evaluate(()=>compareAudit.bindings);expect(Object.values(bindings).every(n=>n===1)).toBe(true);
 await page.evaluate(()=>{CompareLoader.initialize();initializeCompare();initializeCompare()});expect(await page.evaluate(()=>compareAudit.bindings)).toEqual(bindings);
 await tab(page).click();await count(page,2).click();await rendered(page,2);expect(requests).toBe(1);
});
test('synchronous command returns and async load contract survive readiness',async({page})=>{
 const release=await gate(page);await open(page);
 expect(await page.evaluate(()=>[setCompareEditionCount(3),syncCompareDefaultTranslation(),initializeCompareReference(),scrollCompareStartIntoView()].every(x=>x===undefined))).toBe(true);
 expect(await page.evaluate(()=>loadCompare() instanceof Promise)).toBe(true);release();await rendered(page,3);
 expect(await page.evaluate(()=>[typeof getCompareReference(),setCompareEditionCount(4)===undefined,loadCompare() instanceof Promise])).toEqual(['object',true,true]);await rendered(page,4);
});
for(const failure of ['network','missing global','invalid API'])test(failure+' reports accessible failure and retries',async({page})=>{
 let fail=true,requests=0;await page.route('**/js/bible/compare.js',r=>{requests++;if(!fail)return r.continue();if(failure==='network')return r.abort();return r.fulfill({contentType:'application/javascript',body:failure==='invalid API'?'window.CompareRuntime={version:1,initialize(){}}':'/* absent runtime */'})});
 await open(page);await tab(page).click();await expect(page.locator('#compareSummary')).toHaveText(/could not be loaded.*try again/);await expect(page.locator('#compareRuntimeStatus')).toHaveAttribute('aria-live','polite');await expect(page.locator('#view-compare')).toHaveAttribute('aria-busy','false');
 await reader(page).click();await selectReaderOption(page.locator('#chapterSelect'),'2');await expect(page.locator('#readerContent h2')).toHaveText('John 2');fail=false;await tab(page).click();await rendered(page);await expect(page.locator('#compareSummary')).toHaveText('Comparing John 2');expect(requests).toBe(2);expect(await page.evaluate(()=>compareAudit.init)).toBe(1);
});
for(const repeat of [false,true])test('delayed Compare Reader'+(repeat?' Compare':'')+' uses only current intent',async({page})=>{
 const release=await gate(page);await open(page);await tab(page).click();await reader(page).click();await selectReaderOption(page.locator('#chapterSelect'),'2');if(repeat)await tab(page).click();
 const before=await page.evaluate(()=>({y:scrollY,active:document.activeElement.id}));release();await page.evaluate(()=>CompareLoader.ensure());
 if(repeat){await rendered(page);await expect(page.locator('#compareSummary')).toHaveText('Comparing John 2')}else{
  expect(await page.evaluate(()=>compareAudit.activations)).toBe(0);await expect(page.locator('#view-reader')).toHaveClass(/active/);expect(await page.evaluate(()=>({y:scrollY,active:document.activeElement.id}))).toEqual(before);
 }
});
test('translation committed before readiness supplies current default edition',async({page})=>{
 const release=await gate(page);await open(page);await tab(page).click();await page.evaluate(()=>changeTranslation('asv'));release();await rendered(page);
 await expect(page.locator('#compareGrid [data-compare-index="0"]')).toHaveValue('asv');expect(await page.evaluate(()=>currentTranslation)).toBe('asv');
});
test('Compare waits for the pending Reader translation commit',async({page})=>{
 let release;const barrier=new Promise(r=>release=r);await page.route('**/js/bible/asv.js?*',async r=>{await barrier;await r.continue()});await open(page);
 await page.evaluate(()=>{window.pendingTranslation=changeTranslation('asv')});await tab(page).click();await page.evaluate(()=>CompareLoader.ensure());expect(await page.evaluate(()=>currentTranslation)).toBe('web');expect(await page.locator('.compare-col').count()).toBe(0);
 release();await page.evaluate(()=>pendingTranslation);await rendered(page);await expect(page.locator('#compareGrid [data-compare-index="0"]')).toHaveValue('asv');
});
test('late data render remains hidden with no Reader scrolling or focus loss',async({page})=>{
 await open(page);await page.evaluate(()=>CompareLoader.ensure());await page.evaluate(()=>{const ensure=BibleTranslationLoader.ensure.bind(BibleTranslationLoader);window.releaseData=[];BibleTranslationLoader.ensure=id=>new Promise(resolve=>releaseData.push(()=>ensure(id).then(resolve)))});
 await tab(page).click();await expect.poll(()=>page.evaluate(()=>releaseData.length)).toBeGreaterThan(0);await reader(page).click();await page.locator('#searchInput').focus();const before=await page.evaluate(()=>scrollY);
 await page.evaluate(()=>releaseData.forEach(fn=>fn()));await rendered(page);await expect(page.locator('#view-reader')).toHaveClass(/active/);await expect(page.locator('#searchInput')).toBeFocused();expect(await page.evaluate(()=>scrollY)).toBe(before);
});
test('edition changes preserve independently navigated Compare reference and translation slots',async({page})=>{
 await open(page);await tab(page).click();await rendered(page);await page.locator('#compareChapter').selectOption('3');await expect(page.locator('#compareSummary')).toHaveText('Comparing John 3');await count(page,3).click();await rendered(page,3);await expect(page.locator('#compareSummary')).toHaveText('Comparing John 3');
 await page.locator('[data-compare-index="2"]').selectOption('kjv');await count(page,4).click();await rendered(page,4);await expect(page.locator('[data-compare-index="2"]')).toHaveValue('kjv');expect(new Set(await page.locator('[data-compare-index]').evaluateAll(a=>a.map(e=>e.value))).size).toBe(4);
 await page.reload();await tab(page).click();await rendered(page,4);await expect(page.locator('[data-compare-index="2"]')).toHaveValue('kjv');
});
test('missing selected translation shows existing unavailable passage and retries',async({page})=>{
 let fail=true;await page.route('**/js/bible/asv.js?*',r=>fail?r.abort():r.continue());await open(page);await tab(page).click();await rendered(page);await expect(page.locator('.compare-col').nth(1)).toContainText('Passage unavailable in this translation.');fail=false;await tab(page).click();await expect(page.locator('.compare-col').nth(1).locator('.vnum')).toHaveCount(51);
});
for(const width of [320,390])test('mobile stacking and keyboard header clearance '+width,async({page})=>{
 await page.setViewportSize({width,height:844});await open(page);await page.evaluate(()=>navigateReaderToPassage('john',1,30));await tab(page).press('Enter');await rendered(page);const select=page.locator('[data-compare-index="1"]');await select.focus();await select.evaluate(e=>e.scrollIntoView({block:'start',behavior:'instant'}));await expect(select).toBeFocused();
 expect(await page.evaluate(()=>document.documentElement.scrollWidth<=innerWidth)).toBe(true);expect((await select.boundingBox()).y).toBeGreaterThanOrEqual(await page.evaluate(()=>document.querySelector('.bs-nav').getBoundingClientRect().bottom)-1);
});
test('external classic runtime obeys enforcing CSP and leaves headers unchanged',async({page})=>{
 const headers=fs.readFileSync(path.join(root,'_headers'),'utf8'),csp=headers.match(/Content-Security-Policy: (.*)/)[1].trim();await page.route('**/',async r=>{const response=await r.fetch();await r.fulfill({response,headers:{...response.headers(),'content-security-policy':csp}})});await open(page);await tab(page).click();await rendered(page);expect(await page.evaluate(()=>compareAudit.csp)).toEqual([]);
 expect(headers.replace(/\r\n/g,'\n')).toBe(execFileSync('git',['show','9a5baee2e7e41ab7cf400f70c7c735813601df10:_headers'],{encoding:'utf8'}).replace(/\r\n/g,'\n'));expect(fs.readFileSync(path.join(root,'js/bible/compare-loader.js'),'utf8')).not.toMatch(/\beval\s*\(|new Function|https?:\/\//);
});
test.describe('installed offline Compare',()=>{
 test.use({serviceWorkers:'allow'});
 async function install(p){await p.goto('/');await p.evaluate(async()=>{const r=await navigator.serviceWorker.ready,w=r.active;if(w.state!=='activated')await new Promise(resolve=>w.addEventListener('statechange',()=>{if(w.state==='activated')resolve()}))});await p.reload();await p.evaluate(()=>initializeBibleExperience());}
 test('unused runtime first activates offline; retained WEB and unavailable ASV remain distinct',async({page,context})=>{
  await install(page);expect(await page.evaluate(()=>typeof CompareRuntime)).toBe('undefined');const assets=await page.evaluate(async()=> (await(await caches.open('god4-shell-compact-reader-45')).keys()).map(r=>new URL(r.url).pathname));expect(assets).toHaveLength(47);expect(assets).toContain('/js/bible/translation-picker.js');expect(assets).toContain('/js/word-study/alignment.js');expect(assets).toContain('/js/bible/compare-loader.js');expect(assets).toContain('/js/bible/compare.js');
  const responses=[];page.on('response',r=>{if(r.url().endsWith('/bible/compare.js'))responses.push(r.fromServiceWorker())});await context.setOffline(true);await tab(page).click();await rendered(page);expect(responses).toEqual([true]);await expect(page.locator('.compare-col').first().locator('.vnum')).toHaveCount(51);await expect(page.locator('.compare-col').nth(1)).toContainText('Passage unavailable in this translation.');
 });
 test('warm Compare and offline reload preserve retained translations and lazy runtime',async({page,context})=>{
  await install(page);await tab(page).click();await rendered(page);await expect(page.locator('.compare-col').nth(1).locator('.vnum')).toHaveCount(51);await context.setOffline(true);await reader(page).click();await tab(page).click();await rendered(page);await expect(page.locator('.compare-col').nth(1).locator('.vnum')).toHaveCount(51);
  await page.reload();await page.evaluate(()=>initializeBibleExperience());expect(await page.evaluate(()=>typeof CompareRuntime)).toBe('undefined');await tab(page).click();await rendered(page);await expect(page.locator('.compare-col').nth(1).locator('.vnum')).toHaveCount(51);
 });
});
