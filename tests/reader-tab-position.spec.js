const {test,expect}=require('@playwright/test');

async function frames(page){
  await page.evaluate(async()=>{await new Promise(requestAnimationFrame);await new Promise(requestAnimationFrame);});
}
async function location(page,verse){
  return page.evaluate(verse=>({y:scrollY,top:document.querySelector(`#readerContent [data-verse-number="${verse}"]`).getBoundingClientRect().top,
    heading:document.querySelector('#readerContent h2').getBoundingClientRect().top,
    height:document.documentElement.scrollHeight,focus:document.activeElement.id}),verse);
}
async function interactWithTab(page,name,mobile){
  const button=page.locator(`[aria-controls="view-${name}"]`);
  if(mobile) await button.tap(); else await button.click();
  await frames(page);
}
async function readAt(page,selectedVerse){
  await page.evaluate(async selectedVerse=>{
    await navigateReaderToPassage('genesis',24,selectedVerse);
    window.scrollBy({top:document.querySelector('#readerContent [data-verse-number="45"]').getBoundingClientRect().top-readerVisibleTop()-32,behavior:'instant'});
  },selectedVerse);
  await frames(page);
}
for(const [name,viewport] of [['mobile',{width:390,height:844}],['desktop',{width:1280,height:900}]]){
  test.describe(name,()=>{
    test.use({viewport,isMobile:name==='mobile',hasTouch:name==='mobile'});
    test.beforeEach(async({page})=>{
      page.errors=[];
      page.on('pageerror',error=>page.errors.push(error.message));
      await page.emulateMedia({reducedMotion:'reduce'});
      await page.goto('/');
      await page.evaluate(async()=>{await initializeBibleExperience();await changeTranslation('web');});
      await page.evaluate(()=>document.fonts.ready);
    });
    test.afterEach(async({page})=>expect(page.errors).toEqual([]));
    for(const [book,chapter,verse] of [['genesis',24,45],['psalms',23,4],['john',1,30]]){
      test(`unchanged ${book} ${chapter} preserves the reading location through settled Compare`,async({page})=>{
        await page.evaluate(async({book,chapter,verse})=>{
          await navigateReaderToPassage(book,chapter);
          var target=document.querySelector(`#readerContent [data-verse-number="${verse}"]`);
          window.scrollBy({top:target.getBoundingClientRect().top-readerVisibleTop()-32,behavior:'instant'});
          window.traceCalls={load:0,start:0,verse:0};
          for(const [key,name] of [['load','loadPassage'],['start','scrollReaderStartIntoView'],['verse','applyReaderVerseSelection']]){
            const original=window[name];window[name]=function(...args){traceCalls[key]++;return original(...args);};
          }
        },{book,chapter,verse});
        await frames(page);
        const before=await location(page,verse);
        // Real interaction lets the browser scroll/focus the responsive tab control.
        await interactWithTab(page,'compare',name==='mobile');
        const hidden=await location(page,verse);
        await interactWithTab(page,'reader',name==='mobile');
        const after=await location(page,verse);
        console.log(JSON.stringify({viewport:name,book,before,hidden,after,calls:await page.evaluate(()=>traceCalls)}));
        expect(Math.abs(after.y-before.y)).toBeLessThanOrEqual(3);
        expect(Math.abs(after.top-before.top)).toBeLessThanOrEqual(3);
        expect(after.heading).toBeLessThan(await page.evaluate(()=>readerVisibleTop()));
        expect(await page.evaluate(()=>traceCalls)).toEqual({load:0,start:0,verse:0});
      });
    }

    test('unchanged selected verse is authoritative without gaining focus',async({page})=>{
      await readAt(page,67);
      await interactWithTab(page,'compare',name==='mobile');
      await page.evaluate(()=>window.scrollTo({top:0,behavior:'instant'}));
      await interactWithTab(page,'reader',name==='mobile');
      await expect(page.locator('#verseSelect')).toHaveValue('67');
      const target=page.locator('#readerContent [data-verse-number="67"]');
      await expect(target).not.toBeFocused();
      const bounds=await target.evaluate(el=>({top:el.getBoundingClientRect().top,bottom:el.getBoundingClientRect().bottom,boundary:readerVisibleTop(),height:innerHeight}));
      expect(bounds.top).toBeGreaterThanOrEqual(bounds.boundary);
      expect(bounds.bottom).toBeLessThanOrEqual(bounds.height);
    });

    test('keyboard tab return restores reading position while preserving tab focus',async({page})=>{
      await readAt(page);
      const before=await location(page,45);
      const compare=page.locator('[aria-controls="view-compare"]');
      await compare.focus();await compare.press('Enter');await frames(page);
      const reader=page.locator('[aria-controls="view-reader"]');
      await reader.focus();await reader.press('Enter');await frames(page);
      const after=await location(page,45);
      expect(Math.abs(after.y-before.y)).toBeLessThanOrEqual(3);
      expect(Math.abs(after.top-before.top)).toBeLessThanOrEqual(3);
      await expect(reader).toBeFocused();
    });

    for(const change of ['book','chapter','translation']){
      test(`hidden ${change} change uses chapter positioning instead of the old bookmark`,async({page})=>{
        await readAt(page);
        await interactWithTab(page,'compare',name==='mobile');
        await page.evaluate(async change=>{
          if(change==='book') navigateToSpokenBook('Psalms',23);
          if(change==='chapter'){
            document.getElementById('chapterSelect').value='25';loadPassage(true);
          }
          if(change==='translation') await changeTranslation('asv');
        },change);
        await expect(page.locator('#view-compare')).toHaveClass(/active/);
        await interactWithTab(page,'reader',name==='mobile');
        const position=await page.evaluate(()=>({top:document.querySelector('#readerContent h2').getBoundingClientRect().top,boundary:readerVisibleTop()+16}));
        expect(Math.abs(position.top-position.boundary)).toBeLessThan(2);
        await expect(page.locator('#verseSelect')).toHaveValue('');
        await expect(page.locator('#readerContent h2')).not.toBeFocused();
      });
    }

    test('explicit verse selected while hidden becomes the target on Reader return',async({page})=>{
      await readAt(page);
      await interactWithTab(page,'compare',name==='mobile');
      expect(await page.evaluate(()=>selectReaderVerse(67))).toBe(true);
      await expect(page.locator('#view-compare')).toHaveClass(/active/);
      await interactWithTab(page,'reader',name==='mobile');
      const target=page.locator('#readerContent [data-verse-number="67"]');
      await expect(target).toBeFocused();
      const position=await target.evaluate(el=>({top:el.getBoundingClientRect().top,bottom:el.getBoundingClientRect().bottom,boundary:readerVisibleTop(),height:innerHeight}));
      expect(position.top).toBeGreaterThanOrEqual(position.boundary);
      expect(position.bottom).toBeLessThanOrEqual(position.height);
    });
  });
}
