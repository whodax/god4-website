const {test, expect} = require('@playwright/test');
const fs = require('node:fs');
const path = require('node:path');
const zlib = require('node:zlib');
const repair = require('../tools/repair-web-psalms');
const generator = require('../tools/generate-translation-manifest');
const source = repair.readSource();
const root = path.resolve(__dirname, '..');
const expectedFirst = {
  web:Object.fromEntries(source.map(row => [row.chapter,row.verses[0]])),
  kjv:{23:'A Psalm of David. The LORD [is] my shepherd; I shall not want.'},
  asv:{23:'Jehovah is my shepherd; I shall not want.'}
};
test.beforeEach(async ({page}) => {
  page.errors = [];
  page.on('pageerror', e => page.errors.push(e.message));
  page.on('console', m => { if(m.type() === 'error') page.errors.push(m.text()); });
});
test.afterEach(async ({page}) => expect(page.errors).toEqual([]));
test('independent browser DOM extraction verifies every retained source verse and continuation', async ({page}) => {
  await page.goto('/');
  const pages=JSON.parse(zlib.gunzipSync(fs.readFileSync(path.join(__dirname,'fixtures/web-psalms/engwebp-psalms-html.json.gz'))));
  const parsed=await page.evaluate(pages => Object.entries(pages).map(([filename,html]) => {
    const doc=new DOMParser().parseFromString(html,'text/html');
    const main=doc.querySelector('.main');
    main.querySelectorAll('.notemark').forEach(node => node.remove());
    let current=null, verses=[], numbers=[];
    for(const block of main.children){
      if(block.classList.contains('tnav')) break;
      // Some markers occur mid-paragraph: text before the marker belongs to
      // the previous verse, even when both share the same poetry block.
      const walker=doc.createTreeWalker(block,NodeFilter.SHOW_ELEMENT | NodeFilter.SHOW_TEXT);
      let node;
      while((node=walker.nextNode())){
        if(node.nodeType===Node.ELEMENT_NODE && node.classList.contains('verse')){
          numbers.push(Number(node.id.slice(1)));
          current=[]; verses.push(current);
        } else if(node.nodeType===Node.TEXT_NODE && current && !node.parentElement.closest('.verse')){
          current.push(node.textContent);
        }
      }
      if(current) current.push(' ');
    }
    return {chapter:Number(filename.slice(3,6)),numbers,verses:verses.map(parts => parts.join(' ').replace(/\s+/gu,' ').trim())};
  }),pages);
  expect(parsed).toEqual(source);
});
for(const [translation, chapter, count] of [['web',22,31],['web',23,6],['web',24,10],['web',150,6],['kjv',23,6],['asv',23,6]]){
  test(`Reader ${translation} Psalm ${chapter}: heading, first/final verse and selectors`, async ({page}) => {
    await page.goto('/');
    await page.evaluate(async ({translation,chapter}) => {
      await BibleTranslationLoader.ensure(translation);
      currentTranslation=translation; currentBook='psalms'; currentChapter=chapter;
      renderPassage('psalms',chapter);
    }, {translation,chapter});
    await expect(page.locator('#readerContent h2')).toHaveText(`Psalms ${chapter}`);
    await expect(page.locator('#readerContent [data-verse-number="1"]')).toHaveAttribute('data-verse-text', expectedFirst[translation][chapter]);
    await expect(page.locator('#readerContent [data-verse-number]')).toHaveCount(count);
    await expect(page.locator('#verseSelect option')).toHaveCount(count + 1);
    await expect(page.locator('#verseSelect option[value=""]')).toHaveCount(1);
    if(translation === 'web'){
      await expect(page.locator(`#readerContent [data-verse-number="${count}"]`)).toHaveAttribute('data-verse-text',source[chapter - 1].verses.at(-1));
      expect(await page.evaluate(() => BibleData.validateTranslation('web'))).toBe(true);
      expect(await page.evaluate(() => BibleData.getChapterCount('web','psalms'))).toBe(150);
      await expect(page.locator('#chapterSelect option[value="151"]')).toHaveCount(0);
    }
  });
}

test('cache 19 upgrade uses repaired WEB integrity and replaces malformed retained WEB through explicit update', async ({page,context}) => {
  const current = generator.buildManifest().web, previous = repair.baseline.manifest.web;
  // Reconstruct the actual malformed Psalms inside current, otherwise unchanged WEB.
  let malformed = generator.canonicalDeployBytes(fs.readFileSync(path.join(root,'js/bible/web.js'))).toString();
  const book = repair.readLibrary(malformed).psalms, old = {};
  old[1] = {title:book[1].title,subtitle:book[1].subtitle,verses:[]};
  for(let ch=1;ch<=150;ch++) old[ch+1]={...book[ch],verses:[...book[ch].verses.slice(0,-1),repair.baseline.psalms[ch-1].finalVerse]};
  old.name=book.name; old.chapters=151;
  malformed=malformed.replace(JSON.stringify(book),JSON.stringify(old));
  expect(generator.contentMetadata(malformed).integrity).toBe(previous.integrity);
  await page.goto('/');
  await page.evaluate(() => navigator.serviceWorker.ready.then(() => true));
  await page.evaluate(async ({previous,malformed}) => {
    const shell=await caches.open('god4-shell-compact-reader-19');
    await shell.put('/js/bible/web.js',new Response(malformed));
    const ready=await caches.open('god4-bible-ready-v1');
    await ready.put('/__god4/bible-cache/ready/web/'+previous.revision,new Response(malformed,{headers:{'content-type':'application/javascript'}}));
    await ready.put('/__god4/bible-cache/active/web',new Response(JSON.stringify(previous),{headers:{'content-type':'application/json'}}));
    const registration=await navigator.serviceWorker.getRegistration(); await registration.unregister();
  },{previous,malformed});
  await page.reload();
  await page.evaluate(() => navigator.serviceWorker.ready.then(() => true));
  if(!await page.evaluate(() => Boolean(navigator.serviceWorker.controller))) await page.reload();
  await expect.poll(() => page.evaluate(() => caches.keys())).not.toContain('god4-shell-compact-reader-19');
  expect(await page.evaluate(() => BibleTranslationManifest.web.integrity)).toBe(current.integrity);
  const list=await page.evaluate(async () => {
    const registration=await navigator.serviceWorker.ready;
    return new Promise(resolve => {
      const channel=new MessageChannel(); channel.port1.onmessage=e => resolve(e.data);
      registration.active.postMessage({type:'BIBLE_TRANSLATION_LIST'},[channel.port2]);
    });
  });
  expect(list.items.find(item => item.id==='web').state).toBe('update-available');
  // Ordinary online loading must acquire the current revision rather than
  // serve the malformed bundle seeded in the previous shell/ready caches.
  expect(await page.evaluate(() => BibleTranslationLoader.ensure('web'))).toBe(true);
  expect(await page.evaluate(() => BibleData.getVerse('web','psalms',23,1).text)).toBe(expectedFirst.web[23]);
  expect(await page.evaluate(() => BibleTranslationLoader.retain('web'))).toMatchObject({ok:true,state:'current'});
  expect(await page.evaluate(() => BibleData.getVerse('web','psalms',23,1).text)).toBe(expectedFirst.web[23]);
  const active=await page.evaluate(async () => (await (await caches.open('god4-bible-ready-v1')).match('/__god4/bible-cache/active/web')).json());
  expect(active.revision).toBe(current.revision); expect(active.integrity).toBe(current.integrity);
  await context.setOffline(true);
  await page.reload();
  await page.evaluate(async () => { await BibleTranslationLoader.ensure('web'); currentTranslation='web'; currentBook='psalms'; currentChapter=150; renderPassage('psalms',150); });
  await expect(page.locator('#readerContent [data-verse-number="6"]')).toHaveAttribute('data-verse-text',source[149].verses.at(-1));
});
