const {test,expect}=require('@playwright/test');
const {startCspServer}=require('./csp-server');
async function open(page,width=1280){
  await page.setViewportSize({width,height:800});
  await page.goto('/');
  await page.evaluate(()=>initializeBibleExperience());
  await page.locator('#scripturePickerTrigger').click();
  await expect(page.locator('#scripturePicker')).toHaveAttribute('data-step','books');
}
async function choose(page,book,chapter){
  await page.locator(`[data-picker-action="book"][data-value="${book}"]`).click();
  await page.locator(`[data-picker-action="chapter"][data-value="${chapter}"]`).click();
}
test('current book, searchable books, canonical chapter and verse grids, direct focus and translation',async({page})=>{
  await open(page);
  await expect(page.locator('.picker-book-list [aria-current="true"]')).toHaveText('John');
  await expect(page.locator('.picker-book-list [aria-current="true"]')).toBeFocused();
  await page.locator('#pickerBookSearch').fill('isaiah');
  await expect(page.locator('.picker-book-list button')).toHaveCount(1);
  await page.locator('[data-picker-action="book"]').click();
  await expect(page.locator('[data-picker-action="chapter"]')).toHaveCount(66);
  await page.locator('[data-picker-action="chapter"][data-value="53"]').click();
  await expect(page.locator('[data-picker-action="verse"]')).toHaveCount(12);
  await page.locator('[data-picker-action="verse"][data-value="5"]').click();
  await expect(page.locator('#scripturePicker')).not.toBeVisible();
  await expect(page.locator('#readerContent h2')).toHaveText('Isaiah 53');
  await expect(page.locator('#readerContent [data-verse-number="5"]')).toBeFocused();
  await expect(page.locator('#readerTranslation')).toHaveValue('web');
  expect(await page.evaluate(()=>getReaderPosition())).toEqual({bookId:'isaiah',chapter:53,verse:5});
});
test('Whole chapter clears old verse selection with existing chapter semantics',async({page})=>{
  await open(page);await choose(page,'john',3);
  await page.getByRole('button',{name:'Whole chapter',exact:true}).click();
  await expect(page.locator('#readerContent h2')).toHaveText('John 3');
  await expect(page.locator('#readerContent .verse-focused')).toHaveCount(0);
  await expect(page.locator('#verseSelect')).toHaveValue('');
  await expect(page.locator('#scripturePickerTrigger')).toBeFocused();
});
for(const width of [390,320]){
  test(`stepped Back controls, touch targets and no overflow at ${width}px`,async({page})=>{
    await open(page,width);
    await expect(page.locator('.picker-detail')).not.toBeVisible();
    await page.locator('[data-picker-action="book"][data-value="psalms"]').click();
    await expect(page.locator('.picker-books')).not.toBeVisible();
    await expect(page.locator('[data-picker-action="chapter"]')).toHaveCount(150);
    await page.locator('[data-picker-action="chapter"][data-value="119"]').click();
    await expect(page.locator('[data-picker-action="verse"]')).toHaveCount(176);
    expect(await page.locator('#scripturePicker').evaluate(d=>({overflow:d.scrollWidth>d.clientWidth,
      small:[...d.querySelectorAll('.picker-options button')].some(b=>b.getBoundingClientRect().width<44||b.getBoundingClientRect().height<44)}))).toEqual({overflow:false,small:false});
    await page.getByRole('button',{name:'Back to chapters',exact:true}).click();
    await expect(page.locator('#scripturePicker')).toHaveAttribute('data-step','chapters');
    await page.getByRole('button',{name:'Back to books',exact:true}).click();
    await expect(page.locator('.picker-books')).toBeVisible();
    await choose(page,'isaiah',53);
    await page.locator('[data-picker-action="verse"][data-value="5"]').click();
    await expect(page.locator('#readerContent [data-verse-number="5"]')).toBeFocused();
    expect(await page.evaluate(()=>document.documentElement.scrollWidth<=innerWidth)).toBe(true);
  });
}
test('Escape returns focus, native Enter and Space activate, modal traps Tab',async({page})=>{
  await open(page);await page.keyboard.press('Escape');
  await expect(page.locator('#scripturePickerTrigger')).toBeFocused();
  await page.keyboard.press('Enter');
  await expect(page.locator('#scripturePicker')).toHaveAttribute('data-step','books');
  await page.locator('[data-picker-action="book"][data-value="john"]').press('Space');
  await expect(page.locator('#scripturePicker')).toHaveAttribute('data-step','chapters');
  await page.locator('[data-picker-action="chapter"][data-value="3"]').press('Enter');
  await expect(page.locator('#scripturePicker')).toHaveAttribute('data-step','verses');
  await page.locator('#scripturePicker [data-picker-action="close"]').focus();
  await page.keyboard.press('Shift+Tab');
  expect(await page.evaluate(()=>document.activeElement.closest('dialog')?.id)).toBe('scripturePicker');
  await page.locator('[data-picker-action="verse"][data-value="16"]').press('Space');
  await expect(page.locator('#readerContent [data-verse-number="16"]')).toBeFocused();
});
test('fullscreen picker Escape closes only picker and direct navigation retains fullscreen',async({page})=>{
  await page.goto('/');await page.evaluate(()=>initializeBibleExperience());
  await page.locator('#fullscreenBtn').click();
  await page.locator('#scripturePickerTrigger').click();
  await expect(page.locator('#scripturePicker')).toHaveAttribute('data-step','books');
  await page.keyboard.press('Escape');
  await expect(page.locator('#view-reader')).toHaveClass(/reader-fullscreen/);
  await expect(page.locator('#scripturePickerTrigger')).toBeFocused();
  await page.locator('#scripturePickerTrigger').click();await choose(page,'john',3);
  await page.locator('[data-picker-action="verse"][data-value="16"]').click();
  await expect(page.locator('#readerContent [data-verse-number="16"]')).toBeFocused();
  await expect(page.locator('#view-reader')).toHaveClass(/reader-fullscreen/);
});
test('Search targeting and current translation survive picker navigation',async({page})=>{
  await open(page);await page.keyboard.press('Escape');
  await page.evaluate(async()=>{await changeTranslation('kjv');await navigateSearchResult({translationId:'kjv',bookId:'john',chapter:3,verse:16});});
  await expect(page.locator('#readerContent [data-verse-number="16"]')).toBeFocused();
  await page.locator('#scripturePickerTrigger').click();
  await expect(page.locator('#scripturePicker')).toHaveAttribute('data-step','books');
  await choose(page,'john',3);
  await expect(page.locator('[data-picker-action="verse"][aria-current="true"]')).toHaveText('16');
  await page.locator('[data-picker-action="verse"][data-value="17"]').click();
  await expect(page.locator('#readerTranslation')).toHaveValue('kjv');
});
test('manual in-range selection preserves Plan, out-of-range selection invalidates it',async({page})=>{
  await open(page);await page.keyboard.press('Escape');
  await page.evaluate(()=>{
    activePlanReadingSession={readings:[{bookId:'john',startChapter:1,endChapter:3}],end:{bookId:'john',chapter:3,verse:36},translationId:currentTranslation};updatePlanSessionControl();
  });
  await page.locator('#scripturePickerTrigger').click();await choose(page,'john',3);
  await page.locator('[data-picker-action="verse"][data-value="16"]').click();
  expect(await page.evaluate(()=>Boolean(activePlanReadingSession))).toBe(true);
  await page.locator('#scripturePickerTrigger').click();await choose(page,'isaiah',53);
  await page.getByRole('button',{name:'Whole chapter',exact:true}).click();
  expect(await page.evaluate(()=>activePlanReadingSession)).toBeNull();
  await expect(page.locator('#readerBackToPlan')).not.toBeVisible();
});
test('empty source verse coordinates are omitted without renumbering',async({page})=>{
  await open(page);await page.keyboard.press('Escape');
  await page.evaluate(()=>{webLibrary.john[3].verses[1]='';});
  await page.locator('#scripturePickerTrigger').click();await choose(page,'john',3);
  await expect(page.locator('[data-picker-action="verse"][data-value="2"]')).toHaveCount(0);
  await expect(page.locator('[data-picker-action="verse"]')).toHaveCount(35);
  await expect(page.locator('[data-picker-action="verse"][data-value="3"]')).toHaveText('3');
});
for(const cancellation of ['Escape','translation','navigation']){
  test(`delayed readiness cannot reopen or move focus after ${cancellation}`,async({page})=>{
    await page.goto('/');await page.evaluate(()=>initializeBibleExperience());
    await page.evaluate(()=>{
      const ensure=BibleTranslationLoader.ensure;
      window.__releasePicker=null;
      BibleTranslationLoader.ensure=id=>id==='web'?new Promise(resolve=>{window.__releasePicker=()=>resolve(true);}):ensure(id);
    });
    await page.locator('#scripturePickerTrigger').click();
    await expect(page.locator('#scripturePicker')).toHaveAttribute('data-step','loading');
    if(cancellation==='Escape') await page.keyboard.press('Escape');
    else if(cancellation==='translation') await page.evaluate(()=>changeTranslation('kjv'));
    else await page.evaluate(()=>navigateReaderToPassage('john',3,16));
    await page.evaluate(()=>window.__releasePicker());
    await expect(page.locator('#scripturePicker')).not.toBeVisible();
    if(cancellation==='Escape') await expect(page.locator('#scripturePickerTrigger')).toBeFocused();
    if(cancellation==='navigation') await expect(page.locator('#readerContent [data-verse-number="16"]')).toBeFocused();
  });
}
test('unavailable Scripture stays safely in the dialog with no fallback passage',async({page})=>{
  await page.goto('/');await page.evaluate(()=>initializeBibleExperience());
  const before=await page.locator('#readerContent').innerHTML();
  await page.evaluate(()=>{BibleTranslationLoader.ensure=()=>Promise.resolve(false);});
  await page.locator('#scripturePickerTrigger').click();
  await expect(page.locator('.picker-status')).toContainText('Scripture is unavailable');
  await expect(page.locator('.picker-layout')).not.toBeVisible();
  expect(await page.locator('#readerContent').innerHTML()).toBe(before);
  await page.keyboard.press('Escape');await expect(page.locator('#scripturePickerTrigger')).toBeFocused();
});
test('opening during a pending translation cannot leave a stale loading dialog',async({page})=>{
  await page.goto('/');await page.evaluate(()=>initializeBibleExperience());
  await page.evaluate(()=>{
    const ensure=BibleTranslationLoader.ensure;
    BibleTranslationLoader.ensure=id=>id==='kjv'?new Promise(resolve=>{window.__releaseTranslation=async()=>resolve(await ensure(id));}):ensure(id);
    changeTranslation('kjv');
  });
  await page.locator('#scripturePickerTrigger').click();
  await expect(page.locator('#scripturePicker')).toHaveAttribute('data-step','loading');
  await page.evaluate(()=>window.__releaseTranslation());
  await expect(page.locator('#readerTranslation')).toHaveValue('kjv');
  await expect(page.locator('#scripturePicker')).not.toBeVisible();
  await expect(page.locator('#scripturePickerTrigger')).toBeFocused();
});
test('picker activation and direct navigation remain clean under enforcing CSP',async({browser})=>{
  const server=await startCspServer();
  let context;
  try{
    context=await browser.newContext();
    const page=await context.newPage();
    await page.addInitScript(()=>{
      window.__pickerViolations=[];
      document.addEventListener('securitypolicyviolation',e=>window.__pickerViolations.push(e.effectiveDirective));
    });
    await page.goto(server.origin);await page.evaluate(()=>initializeBibleExperience());
    await page.locator('#scripturePickerTrigger').click();
    await expect(page.locator('#scripturePicker')).toHaveAttribute('data-step','books');
    await choose(page,'isaiah',53);await page.locator('[data-picker-action="verse"][data-value="5"]').click();
    await expect(page.locator('#readerContent [data-verse-number="5"]')).toBeFocused();
    expect(await page.evaluate(()=>window.__pickerViolations)).toEqual([]);
  }finally{
    try{await context?.close();}
    finally{await server.close();}
  }
});
test('shell-installed picker and retained Scripture work on offline reload',async({page,context})=>{
  await page.goto('/');await page.evaluate(()=>initializeBibleExperience());
  await page.evaluate(async()=>{await navigator.serviceWorker.ready;});
  await page.reload();await page.evaluate(()=>initializeBibleExperience());
  await expect.poll(()=>page.evaluate(()=>Boolean(navigator.serviceWorker.controller))).toBe(true);
  // Use the existing verified translation protocol to retain WEB.
  await page.evaluate(async()=>{
    const worker=navigator.serviceWorker.controller;
    const revision=BibleTranslationManifest.web.revision;
    for(const type of ['BIBLE_TRANSLATION_ACQUIRE','BIBLE_TRANSLATION_PROMOTE']){
      await new Promise((resolve,reject)=>{const channel=new MessageChannel();channel.port1.onmessage=e=>e.data.ok===false?reject(Error(JSON.stringify(e.data))):resolve(e.data);worker.postMessage({type,id:'web',revision},[channel.port2]);});
    }
  });
  await context.setOffline(true);await page.reload();
  await page.locator('#scripturePickerTrigger').click();
  await expect(page.locator('#scripturePicker')).toHaveAttribute('data-step','books');
  await choose(page,'isaiah',53);await page.locator('[data-picker-action="verse"][data-value="5"]').click();
  await expect(page.locator('#readerContent h2')).toHaveText('Isaiah 53');
  await expect(page.locator('#readerContent [data-verse-number="5"]')).toBeFocused();
});
