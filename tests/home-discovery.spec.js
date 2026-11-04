const { test, expect } = require('@playwright/test');
const fs = require('node:fs');
const vm = require('node:vm');
const crypto = require('node:crypto');
const catalog = require('../js/home-discovery-catalog.json');

const key = 'god4.discovery.openingTopic';
const catalogPath = '/js/home-discovery-catalog.json';
const modulePath = '/js/home-discovery.js';
const card = page => page.locator('#leafCard');
const next = page => page.getByRole('button', {name:'Another verse'});
const status = page => page.locator('#discoveryStatus');
const text = page => card(page).evaluate(node => node.querySelector('#dropcap').textContent + node.querySelector('#verseText').textContent);
const ref = page => page.locator('#verseRef');

test.use({serviceWorkers:'block'});

test('approved catalog and every complete verse match canonical WEB', () => {
  const approved = JSON.stringify(catalog, null, 2) + '\n';
  expect(crypto.createHash('sha256').update(approved).digest('hex')).toBe('7ebea0ce348019ea9c75aa5c661d527d0af645c1406d98c2e6208b4b0ba945e8');
  const web = vm.runInNewContext(fs.readFileSync('js/bible/web.js','utf8') + '\nwebLibrary');
  const canon = require('../js/bible/canon.js');
  expect(catalog.topics).toHaveLength(25);
  const unique = new Set();
  for(const topic of catalog.topics){
    expect(topic.passages).toHaveLength(5);
    for(const passage of topic.passages){
      const {bookId,bookName,chapter,verseStart,verseEnd} = passage;
      expect(canon.book(bookId).name).toBe(bookName);
      expect(passage.reference).toBe(bookName + ' ' + chapter + ':' + verseStart + (verseStart===verseEnd?'':'\u2013'+verseEnd));
      const verses = web[bookId][chapter].verses.slice(verseStart-1,verseEnd);
      expect(verses).toHaveLength(verseEnd-verseStart+1);
      expect(verses.join(' ')).toBe(passage.text);
      for(let n=verseStart;n<=verseEnd;n++){
        const coordinate=[bookId,chapter,n].join(':');
        expect(unique.has(coordinate),coordinate).toBe(false);
        unique.add(coordinate);
      }
    }
  }
  expect(unique.size).toBe(175);
});

for(const [count,randomValue] of [[3,0],[4,0.5],[5,0.999]]) {
  test('sequence contains '+count+' distinct passages and rotates topics', async ({page}) => {
    await page.goto('/offline');
    const result = await page.evaluate(async ({catalog,randomValue,modulePath,key,count}) => {
      const {createDiscovery} = await import(modulePath);
      const values = new Map([[key,'love']]);
      const storage = () => ({getItem:k=>values.get(k),setItem:(k,v)=>values.set(k,v)});
      const discovery = createDiscovery(catalog.topics, () => randomValue, storage);
      const openingTopic = values.get(key);
      const sequence = [discovery.opening,...Array.from({length:count-1},()=>discovery.next())];
      const rotated = discovery.next();
      return {openingTopic,sequence,rotated,persisted:[...values]};
    },{catalog,randomValue,modulePath,key,count});
    expect(result.openingTopic).not.toBe('love');
    const topic = catalog.topics.find(t=>t.id===result.openingTopic);
    expect(result.sequence.every(p=>topic.passages.some(candidate=>candidate.id===p.id))).toBe(true);
    expect(new Set(result.sequence.map(p=>p.id)).size).toBe(count);
    expect(topic.passages.map(p=>p.id)).not.toContain(result.rotated.id);
    expect(result.persisted).toEqual([[key,topic.id]]);
  });
}

async function deterministic(page, options={}) {
  await page.addInitScript(({key,randomValues,storage,disableObserver})=>{
    const values=[...randomValues];
    Math.random=()=>values.shift() ?? 0;
    if(storage==='blocked'){
      const get=Storage.prototype.getItem, set=Storage.prototype.setItem;
      Storage.prototype.getItem=function(k){if(k===key)throw new DOMException('Blocked','SecurityError');return get.call(this,k);};
      Storage.prototype.setItem=function(k,v){if(k===key)throw new DOMException('Blocked','SecurityError');return set.call(this,k,v);};
    }else if(storage) localStorage.setItem(key,storage);
    if(disableObserver){
      const Observer=window.IntersectionObserver;
      window.IntersectionObserver=class extends Observer {
        observe(node){if(node.id!=='leafCard')super.observe(node);}
      };
    }
  },{key,randomValues:[],...options});
}

test('viewport loading is lazy and reload excludes the prior opening topic', async ({page}) => {
  await page.setViewportSize({width:390,height:300});
  await deterministic(page);
  const requested=[];
  page.on('request',r=>requested.push(new URL(r.url()).pathname));
  await page.goto('/');
  expect(await card(page).evaluate(node=>node.getBoundingClientRect().top-innerHeight)).toBeGreaterThan(200);
  expect(requested).not.toContain(catalogPath);
  await card(page).scrollIntoViewIfNeeded();
  await expect.poll(()=>page.evaluate(k=>localStorage.getItem(k),key)).toBe('love');
  await expect(ref(page)).toHaveText('John 3:16');
  await page.reload();
  await card(page).scrollIntoViewIfNeeded();
  await expect.poll(()=>page.evaluate(k=>localStorage.getItem(k),key)).toBe('faith');
  await expect(ref(page)).toHaveText('Hebrews 11:1');
  expect(requested.filter(url=>url===catalogPath)).toHaveLength(2);
});

for(const storage of ['blocked','{invalid'])test('first interaction works with '+storage+' opening history',async({page})=>{
  await deterministic(page,{storage,disableObserver:true});
  await page.goto('/');
  await next(page).press('Enter');
  await expect(ref(page)).toHaveText('Romans 5:8');
  await expect(next(page)).toBeFocused();
  await expect(status(page)).toHaveText('Romans 5:8 (WEB)');
  await expect(status(page)).toHaveAttribute('role','status');
  await next(page).press('Space');
  await expect(status(page)).toHaveText('1 John 4:9\u201310 (WEB)');
  await expect(next(page)).toBeFocused();
});

test('deferred catalog and rapid clicks keep reference, text and saved state together',async({page})=>{
  await deterministic(page,{disableObserver:true});
  let release;
  const gate=new Promise(resolve=>release=resolve);
  let count=0;
  await page.route('**'+catalogPath,async route=>{count++;await gate;await route.continue();});
  await page.goto('/');
  const save=page.locator('#heroFav');
  await save.click();
  await next(page).evaluate(button=>{
    window.discoveryAnnouncements=[];
    const region=document.getElementById('discoveryStatus');
    new MutationObserver(()=>discoveryAnnouncements.push(region.textContent)).observe(region,{childList:true});
    for(let i=0;i<3;i++)button.click();
  });
  await expect.poll(()=>count).toBe(1);
  release();
  await expect(status(page)).toHaveText('Hebrews 11:1 (WEB)');
  expect(await page.evaluate(()=>discoveryAnnouncements)).toEqual([
    'Romans 5:8 (WEB)','1 John 4:9\u201310 (WEB)','Hebrews 11:1 (WEB)'
  ]);
  await expect(save).toHaveAttribute('aria-pressed','false');
  await save.click();
  const passages=[catalog.topics[0].passages[0],catalog.topics[1].passages[0]];
  expect(await text(page)).toBe(passages[1].text);
  expect(await page.evaluate(()=>JSON.parse(localStorage.getItem('god4.savedVerses')))).toEqual(
    passages.map(p=>({ref:p.reference,text:p.text})));
  await expect(save).toHaveAttribute('aria-pressed','true');
  await expect(page.locator('#savedCount')).toHaveText('2');
});

test('failed catalog request leaves WEB fallback usable and the next click retries',async({page})=>{
  await deterministic(page,{disableObserver:true});
  await page.route('**'+catalogPath,route=>route.fulfill({status:503}),{times:1});
  await page.goto('/');
  await next(page).press('Enter');
  await expect(status(page)).toContainText('Try Another verse again');
  expect(await text(page)).toBe(catalog.topics[0].passages[0].text);
  await next(page).press('Enter');
  await expect(status(page)).toHaveText('Romans 5:8 (WEB)');
});

for(const width of [320,390,430])test('all nine long passages fit at '+width+'px',async({page})=>{
  await page.setViewportSize({width,height:760});
  const passages=catalog.topics.flatMap(t=>t.passages).filter(p=>p.text.length>300);
  expect(passages).toHaveLength(9);
  const targets=passages.map(p=>{
    const topic=catalog.topics.findIndex(t=>t.passages.includes(p));
    return [(topic+0.25)/25,0,(catalog.topics[topic].passages.indexOf(p)+0.25)/5];
  });
  await page.addInitScript(({key,targets})=>{
    localStorage.removeItem(key);
    const values=[...targets[Number(location.hash.slice(1)) || 0]];
    Math.random=()=>values.shift() ?? 0;
  },{key,targets});
  for(const [index,passage] of passages.entries()){
    await page.goto('/?long='+index+'#'+index);
    await card(page).scrollIntoViewIfNeeded();
    await expect(ref(page)).toHaveText(passage.reference);
    expect(await text(page)).toBe(passage.text);
    expect(await card(page).evaluate(node=>{
      const box=node.getBoundingClientRect(), text=node.querySelector('#verseText');
      const range=document.createRange();
      range.selectNodeContents(text);
      const content=range.getBoundingClientRect();
      return content.bottom<=box.bottom && content.right<=box.right && document.documentElement.scrollWidth===innerWidth;
    })).toBe(true);
  }
});

test('Reader translation changes leave the discovery card WEB-only',async({page})=>{
  await deterministic(page,{disableObserver:true});
  await page.goto('/');
  await page.evaluate(async()=>{
    await initializeBibleExperience();
    await changeTranslation('dra');
  });
  expect(await page.evaluate(()=>currentTranslation)).toBe('dra');
  await next(page).press('Enter');
  await expect(status(page)).toHaveText('Romans 5:8 (WEB)');
  expect(await text(page)).toBe(catalog.topics[0].passages[1].text);
});

test('first-use transfer stays separate from eager scripts and the full WEB bundle',async({page})=>{
  await deterministic(page,{disableObserver:true});
  const requested=[];
  page.on('request',r=>requested.push(new URL(r.url()).pathname));
  await page.goto('/');
  expect(requested).not.toContain(modulePath);
  expect(requested).not.toContain(catalogPath);
  await next(page).press('Enter');
  await expect(status(page)).toHaveText('Romans 5:8 (WEB)');
  expect(requested.filter(p=>p===catalogPath||p===modulePath)).toEqual([modulePath,catalogPath]);
  expect(requested).not.toContain('/js/bible/web.js');
  const sizes=await page.evaluate(paths=>paths.map(path=>{
    const entry=performance.getEntriesByName(location.origin+path)[0];
    return {path,decoded:entry.decodedBodySize,encoded:entry.encodedBodySize,transfer:entry.transferSize};
  }),[modulePath,catalogPath]);
  for(const asset of sizes)expect(asset.decoded).toBe(fs.statSync(asset.path.slice(1)).size);
  console.log('Discovery first use:',JSON.stringify(sizes));
});

test.describe('installed offline',()=>{
  test.use({serviceWorkers:'allow'});
  test('catalog loads and advances offline without a downloaded Bible',async({page,context})=>{
    await deterministic(page,{disableObserver:true});
    await page.goto('/');
    await page.evaluate(()=>navigator.serviceWorker.ready);
    await page.reload();
    await page.waitForFunction(()=>navigator.serviceWorker.controller);
    await context.setOffline(true);
    await page.reload();
    await next(page).press('Enter');
    await expect(status(page)).toHaveText('Romans 5:8 (WEB)');
    expect(await text(page)).toBe(catalog.topics[0].passages[1].text);
    expect(await page.evaluate(()=>caches.keys())).toEqual(['god4-shell-compact-reader-56']);
  });
});
