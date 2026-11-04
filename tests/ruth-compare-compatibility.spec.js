const {test,expect}=require('@playwright/test');
const {selectCompareOption}=require('./reader-navigation-test-helper');

async function reader(page,id='dra',book='ruth',chapter=2,verse=2){
  await page.goto('/');await page.evaluate(()=>initializeBibleExperience());
  await page.evaluate(()=>ReaderTranslationLoader.ensure());
  await page.evaluate(async({id,book,chapter,verse})=>{await changeTranslation(id);await navigateReaderToPassage(book,chapter,verse);},{id,book,chapter,verse});
}
async function compare(page){
  await page.getByRole('button',{name:'Compare',exact:true}).click();
  await expect(page.locator('#compareGrid .compare-col')).toHaveCount(2);
  await expect(page.locator('[data-themed-select="compare-edition-0"]')).toBeVisible();
}
async function editions(page,left='ylt',right='gnv'){
  await selectCompareOption(page.locator('[data-compare-index="0"]'),left);
  await page.evaluate(()=>loadCompare());
  await selectCompareOption(page.locator('[data-compare-index="1"]'),right);
  await page.evaluate(()=>loadCompare());
}
async function exact(page,ids=['ylt','gnv']){
  expect(await page.evaluate(()=>getCompareReference())).toEqual({bookId:'ruth',chapter:2,verse:2});
  for(const [index,id] of ids.entries()){
    const column=page.locator('.compare-col').nth(index);
    await expect(column.locator('select')).toHaveValue(id);
    await expect(column.locator('.compare-unavailable')).toHaveCount(0);
    await expect(column.locator('.compare-text p')).toHaveCount(1);
    await expect(column.locator('.vnum')).toHaveText('2');
    const text=await page.evaluate(id=>BibleData.getVerse(id,'ruth',2,2).text,id);
    await expect(column.locator('.compare-text p')).toHaveText('2'+text);
  }
}

for(const mobile of [false,true])test.describe(mobile?'Android-sized':'desktop',()=>{
  test.use({viewport:{width:mobile?390:1280,height:844},hasTouch:mobile,serviceWorkers:'allow',...(mobile?{userAgent:'Mozilla/5.0 (Linux; Android 14; Pixel 7) AppleWebKit/537.36 Chrome/130.0.0.0 Mobile Safari/537.36'}:{})});
  test.beforeEach(async({page})=>{
    page.errors=[];page.on('pageerror',e=>page.errors.push(e.message));
    await page.addInitScript(()=>{window.IntersectionObserver=class{observe(){}unobserve(){}disconnect(){}};});
  });
  test.afterEach(async({page})=>expect(page.errors).toEqual([]));

  test('CTH handoff and persisted selections display the exact verified verses without reanchoring',async({page})=>{
    await reader(page);await compare(page);await editions(page);await exact(page);
    const stored=await page.evaluate(()=>({compare:localStorage.getItem('god4.compare'),position:localStorage.getItem('god4.reader.position'),translation:localStorage.getItem('god4.translation')}));
    expect(stored.translation).toBe('dra');
    await page.reload();await page.evaluate(()=>initializeBibleExperience());await page.evaluate(()=>ReaderTranslationLoader.ensure());
    await compare(page);await exact(page);
    expect(await page.evaluate(()=>({compare:localStorage.getItem('god4.compare'),position:localStorage.getItem('god4.reader.position'),translation:localStorage.getItem('god4.translation')}))).toEqual(stored);
    await page.getByRole('button',{name:'Reader',exact:true}).click();
    await expect(page.locator('#readerTranslation option:checked')).toHaveText('CTH — Catholic Bible (Douay-Rheims)');
    await expect(page.locator('#scripturePickerTrigger')).toContainText('Ruth 2:2');
  });

  for(const from of ['ylt','gnv'])test('reviewed reverse direction '+from+' to CTH',async({page})=>{
    await reader(page,from);await compare(page);await editions(page,from,'dra');await exact(page,[from,'dra']);
    expect(await page.evaluate(()=>currentTranslation)).toBe(from);
  });

  for(const changed of [false,true])test('delayed Bible loading uses the current coordinate, changed='+changed,async({page})=>{
    await reader(page);
    const releases={},requested=[];
    await page.route(/\/js\/bible\/(ylt|gnv)\.js(?:\?|$)/,async route=>{
      const id=route.request().url().match(/\/(ylt|gnv)\.js/)[1];requested.push(id);
      await new Promise(resolve=>releases[id]=resolve);await route.continue();
    });
    await page.evaluate(()=>UserData.compare.save({count:2,selections:['ylt','gnv','web','asv'],persisted:true}));
    await page.getByRole('button',{name:'Compare',exact:true}).click();
    await expect.poll(()=>requested.length).toBe(2);
    await expect(page.locator('#compareGrid .compare-col')).toHaveCount(0);
    if(changed)await page.evaluate(()=>setCompareReference({bookId:'ruth',chapter:2,verse:3}));
    releases.ylt();await expect.poll(()=>page.evaluate(()=>BibleData.isTranslationLoaded('ylt'))).toBe(true);
    await expect(page.locator('#compareGrid .compare-col')).toHaveCount(0);
    releases.gnv();await expect(page.locator('#compareGrid .compare-col')).toHaveCount(2);
    if(changed){
      await expect(page.locator('.compare-unavailable')).toHaveText([/Numbering differs/,/Numbering differs/]);
      expect(await page.evaluate(()=>getCompareReference())).toEqual({bookId:'ruth',chapter:2,verse:3});
      await selectCompareOption(page.locator('#compareVerse'),'2');
    }
    await exact(page);
  });

  test('retained Bibles and Shell 54 relaunch render the approved verse offline',async({page,context})=>{
    await reader(page);
    await page.evaluate(()=>navigator.serviceWorker.ready);
    if(!await page.evaluate(()=>!!navigator.serviceWorker.controller))await page.reload();
    await page.evaluate(()=>initializeBibleExperience());await page.evaluate(()=>ReaderTranslationLoader.ensure());
    for(const id of ['dra','ylt','gnv'])expect(await page.evaluate(async id=>(await BibleTranslationLoader.retain(id)).ok,id)).toBe(true);
    await compare(page);await editions(page);await exact(page);
    await context.setOffline(true);
    try{
      await page.reload();await page.evaluate(()=>initializeBibleExperience());await page.evaluate(()=>ReaderTranslationLoader.ensure());
      await compare(page);await exact(page);
      expect(await page.evaluate(()=>caches.keys())).toContain('god4-shell-compact-reader-54');
      expect(await page.evaluate(()=>currentTranslation)).toBe('dra');
    }finally{await context.setOffline(false);}
  });

  test('unreviewed coordinates and translation pairs remain gated without changing origin',async({page})=>{
    await reader(page);await compare(page);await editions(page);
    for(const reference of [{bookId:'ruth',chapter:2,verse:1},{bookId:'ruth',chapter:2,verse:3},{bookId:'ruth',chapter:1,verse:2},{bookId:'ruth',chapter:3,verse:2},{bookId:'ruth',chapter:2,verse:null}]){
      await page.evaluate(async reference=>{setCompareReference(reference);await loadCompare();},reference);
      await expect(page.locator('.compare-unavailable')).toHaveText([/Numbering differs/,/Numbering differs/]);
      expect(await page.evaluate(()=>getCompareReference())).toEqual(reference);
    }
    await page.evaluate(async()=>{setCompareReference({bookId:'ruth',chapter:2,verse:2});await loadCompare();});await exact(page);
    await editions(page,'web','asv');
    await expect(page.locator('.compare-unavailable')).toHaveText([/Numbering differs/,/Numbering differs/]);
    await editions(page);await exact(page);
    expect(await page.evaluate(()=>currentTranslation)).toBe('dra');
  });

  test('Psalms and Catholic-only Esther, Daniel and Tobit retain their warnings',async({page})=>{
    await reader(page);await compare(page);await editions(page);
    for(const [bookId,chapter,verse,warning] of [['psalms',23,1,'Numbering differs'],['esther',16,24,'Catholic canon'],['esther',10,4,'Catholic canon'],['daniel',3,90,'Catholic canon'],['daniel',13,65,'Catholic canon'],['tobit',1,2,'Catholic canon']]){
      await page.evaluate(async reference=>{setCompareReference(reference);await loadCompare();},{bookId,chapter,verse});
      for(const column of await page.locator('.compare-col').all())await expect(column.locator('.compare-unavailable')).toContainText(warning);
      expect(await page.evaluate(()=>getCompareReference())).toEqual({bookId,chapter,verse});
    }
  });

  test('missing chapter, absent verse and empty verse never produce false numbering warnings or invented text',async({page})=>{
    await reader(page);await compare(page);await editions(page);
    for(const missing of ['chapter','verse','empty']){
      await page.evaluate(async missing=>{
        window.originalRuthData=window.originalRuthData || {getChapter:BibleData.getChapter,getVerse:BibleData.getVerse};
        BibleData.getChapter=function(id,book,chapter){return missing==='chapter' && id==='ylt' && book==='ruth' && chapter===2 ? null : originalRuthData.getChapter(id,book,chapter);};
        BibleData.getVerse=function(id,book,chapter,verse){return id==='ylt' && book==='ruth' && chapter===2 && verse===2 ? missing==='empty' ? {verse:2,text:'  '} : missing==='verse' ? null : originalRuthData.getVerse(id,book,chapter,verse) : originalRuthData.getVerse(id,book,chapter,verse);};
        await loadCompare();
      },missing);
      await expect(page.locator('.compare-col').nth(0).locator('.compare-unavailable')).toHaveText('Not available in this translation.');
      await expect(page.locator('.compare-col').nth(0).locator('.compare-text .vnum')).toHaveCount(0);
      await expect(page.locator('.compare-col').nth(1).locator('.compare-unavailable')).toHaveCount(0);
    }
  });
});
