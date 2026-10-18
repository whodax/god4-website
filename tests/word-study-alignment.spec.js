const {test,expect}=require('@playwright/test');
test.use({contextOptions:{reducedMotion:'reduce'},serviceWorkers:'block'});

async function open(page, translationId, bookId, chapter, verse, fixture=false, waitAlignment=true){
  await page.goto('/');
  expect(await page.evaluate(()=>matchMedia('(prefers-reduced-motion: reduce)').matches)).toBe(true);
  await page.evaluate(async context=>{
    await initializeBibleExperience();await changeTranslation(context.translationId);
    await navigateReaderToPassage(context.bookId,context.chapter,context.verse);
    await WordStudyLoader.ensure();await document.fonts.ready;
  },{translationId,bookId,chapter,verse});
  if(waitAlignment)await page.waitForFunction(()=>Boolean(window.WordStudyAlignment));
  if(fixture)await page.evaluate(async context=>{
    const row=document.querySelector('#readerContent [data-verse-number="'+context.verse+'"]');
    const words=WordStudyAlignment.wordSpans(row);
    const englishText=row.getAttribute('data-verse-text');
    const records=(await OriginalLanguageWordStudyProvider.lookupVerse(context)).records;
    const entry={...context,status:'verified',englishText,originalTokens:records,
      source:{title:'Synthetic alignment fixture (test only)',reference:'test-only fixture',revision:'1',reviewedBy:'test harness'},
      groups:[{english:[words[0],words[words.length-1]].map(word=>({start:Number(word.getAttribute('data-word-study-start')),end:Number(word.getAttribute('data-word-study-end'))})),original:[0,2]}]};
    WordStudyAlignment.lookup=WordStudyAlignment.createProvider([entry]).lookup;
  },{translationId,bookId,chapter,verse});
  return page.locator('#readerContent [data-verse-number="'+verse+'"] [data-word-study-term]').first();
}

for(const [translationId,bookId,chapter,verse] of [['kjv','isaiah',53,5],['web','john',1,1],['dra','isaiah',1,1]]){
  for(const [mode,width,height,fullscreen] of [['desktop',1280,844,false],['mobile',390,844,false],['fullscreen',390,844,true],['narrow',320,844,false],['narrow fullscreen',320,844,true],['desktop fullscreen',1280,844,true],['short',320,480,false]]){
    test(`${translationId} ${mode}: unavailable alignment preserves words without overlapping context`,async({page},info)=>{
      await page.setViewportSize({width,height});
      const word=await open(page,translationId,bookId,chapter,verse);
      if(fullscreen)await page.locator('#fullscreenBtn').click();
      await word.press('Enter');
      await expect(page.locator('#wordStudyOriginalLanguage')).toBeVisible();
      await expect(page.locator('#wordStudyAlignmentStatus')).toContainText('Exact word alignment is unavailable');
      await expect(page.locator('#wordStudyOriginalTokens [data-aligned="true"]')).toHaveCount(0);
      await expect(page.locator('#wordStudyVerse [data-selected="true"]')).toHaveCount(1);
      await page.evaluate(async()=>{await document.fonts.ready;await new Promise(requestAnimationFrame);await new Promise(requestAnimationFrame);});
      const geometry=await page.evaluate(()=>{
        const bounds=id=>document.getElementById(id).getBoundingClientRect();
        return {verseBottom:bounds('wordStudyVerse').bottom,headingTop:bounds('wordStudyOriginalHeading').top,
          contextBottom:bounds('wordStudyContext').bottom,tokenTop:document.querySelector('#wordStudyOriginalTokens button').getBoundingClientRect().top,
          scrollY,readerScroll:document.getElementById('view-reader').scrollTop,documentHeight:document.documentElement.scrollHeight,rootAnchor:getComputedStyle(document.documentElement).overflowAnchor,
          overflow:document.documentElement.scrollWidth>innerWidth};
      });
      await info.attach('initial-context-geometry',{body:JSON.stringify(geometry),contentType:'application/json'});
      expect(geometry.headingTop).toBeGreaterThanOrEqual(geometry.verseBottom);
      expect(geometry.tokenTop).toBeGreaterThanOrEqual(geometry.contextBottom);
      expect(geometry.overflow).toBe(false);
      await page.evaluate(async()=>{await new Promise(requestAnimationFrame);await new Promise(requestAnimationFrame);});
      const settled=await page.evaluate(()=>({scrollY,readerScroll:document.getElementById('view-reader').scrollTop,documentHeight:document.documentElement.scrollHeight,rootAnchor:getComputedStyle(document.documentElement).overflowAnchor}));
      await info.attach('settled-scroll-geometry',{body:JSON.stringify(settled),contentType:'application/json'});
      expect({scrollY:settled.scrollY,readerScroll:settled.readerScroll}).toEqual({scrollY:geometry.scrollY,readerScroll:geometry.readerScroll});
      const last=page.locator('#wordStudyOriginalTokens button').last();await last.press('Enter');
      await expect(page.locator('#wordStudyOriginalDetails')).toBeVisible();
      await expect(last).toBeFocused();
      await expect.poll(()=>last.evaluate(element=>{const rect=element.getBoundingClientRect();return rect.top>=readerVisibleTop()&&rect.bottom<=innerHeight;})).toBe(true);
      await page.screenshot({path:info.outputPath('original-language.png')});
      await page.keyboard.press('Escape');await expect(word).toBeFocused();
    });
  }
}

for(const [translationId,bookId,chapter,verse] of [['kjv','isaiah',53,5],['web','john',1,1]]){
  test(`${translationId}: synthetic many-to-many mapping highlights both directions with keyboard`,async({page})=>{
    await page.setViewportSize({width:390,height:844});
    const word=await open(page,translationId,bookId,chapter,verse,true);
    await word.press('Enter');
    await expect(page.locator('#wordStudyAlignmentStatus')).toContainText('Synthetic alignment fixture (test only)');
    await expect(page.locator('#wordStudyOriginalTokens [data-aligned="true"]')).toHaveCount(2);
    await expect(page.locator('#readerContent [data-aligned="true"]')).toHaveCount(2);
    const original=page.locator('[data-original-language-token-index="2"]');
    await expect(original).toHaveAttribute('aria-description','Aligned with the highlighted English phrase.');
    await original.press('Space');await expect(original).toBeFocused();
    await expect(page.locator('#wordStudyVerse [data-aligned="true"]')).toHaveCount(2);
    const phrase=page.locator('#wordStudyVerse [role="button"]').first();
    await phrase.press('Enter');await expect(phrase).toBeFocused();
    await expect(phrase).toHaveAttribute('aria-pressed','true');
    await expect(page.locator('#wordStudyOriginalTokens [data-aligned="true"]')).toHaveCount(2);
    await page.keyboard.press('Escape');await expect(word).toBeFocused();
    await expect(page.locator('#readerContent [data-aligned="true"]')).toHaveCount(0);
  });
}

test('lexical definitions never create inferred alignment',async({page})=>{
  const word=await open(page,'web','john',1,1);
  await page.evaluate(()=>{WordStudyProvider.lookup=()=>Promise.resolve({status:'available',definition:'λογος means word',relatedWords:['word']});});
  await word.press('Enter');
  await expect(page.locator('#wordStudyDefinition')).toHaveText('λογος means word');
  await expect(page.locator('#wordStudyAlignmentStatus')).toContainText('Exact word alignment is unavailable');
  await expect(page.locator('#wordStudyOriginalTokens [data-aligned="true"]')).toHaveCount(0);
});

test('Reader text drift invalidates a verified fixture and clears stale occurrence offsets',async({page})=>{
  const word=await open(page,'web','john',1,1,true);
  await word.press('Enter');
  await expect(page.locator('#wordStudyOriginalTokens [data-aligned="true"]')).toHaveCount(2);
  await page.keyboard.press('Escape');
  await word.evaluate(element=>{element.textContent='Altered display';});
  await word.press('Enter');
  await expect(page.locator('#wordStudyOriginalTokens button')).toHaveCount(17);
  await expect(page.locator('#wordStudyOriginalTokens [data-aligned="true"]')).toHaveCount(0);
  await expect(page.locator('#readerContent [data-aligned="true"]')).toHaveCount(0);
  await expect(page.locator('#wordStudyAlignmentStatus')).toContainText('Exact word alignment is unavailable');
});

for(const failure of ['network','missing global'])test('optional alignment '+failure+' retains English and original-language lookup',async({page})=>{
  await page.route('**/js/word-study/alignment.js',route=>failure==='network'?route.abort():route.fulfill({contentType:'application/javascript',body:''}));
  const word=await open(page,'web','john',1,1,false,false);
  await word.press('Enter');
  await expect(page.locator('#wordStudyPanel')).not.toHaveAttribute('data-word-study-state','loading');
  await expect(page.locator('#wordStudyOriginalTokens button')).toHaveCount(17);
  await page.locator('#wordStudyOriginalTokens button').first().press('Enter');
  await expect(page.locator('#wordStudyOriginalDetails')).toBeVisible();
  await expect(page.locator('#wordStudyAlignmentStatus')).toContainText('Exact word alignment is unavailable');
});

for(const [translationId,bookId,chapter,verse] of [['kjv','genesis',1,1],['kjv','isaiah',53,5],['web','john',1,1],['dra','isaiah',1,1]]){
  test(`${translationId} ${bookId}: stalled optional alignment never blocks lookup`,async({page})=>{
    const errors=[];page.on('pageerror',error=>errors.push(error.message));
    let requests=0;
    await page.route('**/js/word-study/alignment.js',()=>{requests++;});
    let word=await open(page,translationId,bookId,chapter,verse,false,false);
    if(bookId==='genesis')word=page.locator('#readerContent [data-verse-number="1"] [data-word-study-term="beginning"]');
    await word.press('Enter');
    await expect(page.locator('#wordStudyPanel')).not.toHaveAttribute('data-word-study-state','loading');
    await expect(page.locator('#wordStudyOriginalTokens button').first()).toBeVisible();
    if(bookId==='genesis')await expect(page.locator('#wordStudyDefinition')).toHaveText('The act of doing that which begins anything; commencement of an action, state, or space of time; entrance into being or upon a course; the first act, effort, or state of a succession of acts or states. In the beginning God created the heaven and the earth. Gen. i. 1.');
    await expect(page.locator('script[src="/js/word-study/alignment.js"]')).toHaveCount(1);
    await page.waitForTimeout(3100);
    await expect(page.locator('script[src="/js/word-study/alignment.js"]')).toHaveCount(0);
    await page.keyboard.press('Escape');await word.press('Enter');
    await expect(page.locator('#wordStudyOriginalTokens button').first()).toBeVisible();
    await expect(page.locator('#wordStudyAlignmentStatus')).toContainText('Exact word alignment is unavailable');
    await expect(page.locator('#wordStudyOriginalTokens [data-aligned="true"]')).toHaveCount(0);
    expect(requests).toBe(1);expect(errors).toEqual([]);
  });
}

for(const afterDeadline of [false,true])test('late alignment completion '+(afterDeadline?'after':'before')+' deadline does not rebuild active UI',async({page})=>{
  const errors=[];page.on('pageerror',error=>errors.push(error.message));
  let held,requests=0;
  await page.route('**/js/word-study/alignment.js',route=>{held=route;requests++;});
  const word=await open(page,'web','john',1,1,false,false);
  await word.press('Enter');
  const original=page.locator('#wordStudyOriginalTokens button').first();
  await expect(original).toBeVisible();await original.press('Enter');
  await page.evaluate(()=>{
    window.__alignmentVerse=document.getElementById('wordStudyVerse').firstChild;
    window.__alignmentOriginal=document.querySelector('#wordStudyOriginalTokens button');
    window.__alignmentLookups=0;
    const lookup=OriginalLanguageWordStudyProvider.lookupVerse;
    OriginalLanguageWordStudyProvider.lookupVerse=function(context){window.__alignmentLookups++;return lookup(context);};
  });
  if(afterDeadline){
    await page.waitForTimeout(3100);
    await expect(page.locator('script[src="/js/word-study/alignment.js"]')).toHaveCount(0);
  }
  const source=require('node:fs').readFileSync(require.resolve('../js/word-study/alignment.js'),'utf8');
  await held.fulfill({contentType:'application/javascript',body:source});
  if(afterDeadline)await page.evaluate(source);
  else await page.waitForFunction(()=>Boolean(window.WordStudyAlignment));
  await expect(original).toBeFocused();
  expect(await page.evaluate(()=>({verse:window.__alignmentVerse===document.getElementById('wordStudyVerse').firstChild,original:window.__alignmentOriginal===document.querySelector('#wordStudyOriginalTokens button'),lookups:window.__alignmentLookups}))).toEqual({verse:true,original:true,lookups:0});
  await page.keyboard.press('Escape');await word.press('Enter');
  await expect(page.locator('#wordStudyOriginalTokens button')).toHaveCount(17);
  await expect(page.locator('#wordStudyVerse [data-selected="true"]')).toHaveCount(afterDeadline?0:1);
  expect(requests).toBe(1);expect(errors).toEqual([]);
});

test('overlapping phrases preserve whitespace without empty keyboard controls',async({page})=>{
  const word=await open(page,'web','john',1,1,true);
  await page.evaluate(()=>{
    const lookup=WordStudyAlignment.lookup;
    WordStudyAlignment.lookup=function(context,records){
      const result=lookup(context,records);
      const words=WordStudyAlignment.wordSpans(document.querySelector('#readerContent [data-verse-number="1"]'));
      result.groups.push({english:[{start:0,end:Number(words[1].getAttribute('data-word-study-end'))}],original:[0]});
      result.groups.push({english:[{start:Number(words[1].getAttribute('data-word-study-start')),end:Number(words[1].getAttribute('data-word-study-end'))}],original:[1]});
      return result;
    };
  });
  await word.press('Enter');
  const controls=page.locator('#wordStudyVerse [role="button"]');
  await expect(controls).toHaveCount(3);
  expect(await controls.evaluateAll(elements=>elements.every(element=>element.textContent.trim()&&element.getAttribute('aria-label')==='Identify aligned phrase '+element.textContent.trim()))).toBe(true);
  const whitespace=page.locator('#wordStudyVerse [data-english-start]').filter({hasText:/^\s+$/});
  expect(await whitespace.count()).toBeGreaterThan(0);
  expect(await whitespace.evaluateAll(elements=>elements.every(element=>!element.hasAttribute('tabindex')&&!element.hasAttribute('role')))).toBe(true);
  await controls.first().focus();await page.keyboard.press('Tab');await expect(controls.nth(1)).toBeFocused();
  await page.keyboard.press('Space');await expect(controls.nth(1)).toHaveAttribute('aria-pressed','true');
  await page.keyboard.press('Enter');await expect(controls.nth(1)).toBeFocused();
  await page.keyboard.press('Escape');await expect(word).toBeFocused();
});
