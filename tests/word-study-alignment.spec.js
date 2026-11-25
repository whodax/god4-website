const {toggleReaderFullscreen}=require('./reader-navigation-test-helper');
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
      let word=await open(page,translationId,bookId,chapter,verse);
      if(bookId==='john')word=page.locator('#readerContent [data-verse-number="1"] [data-word-study-term="the"]').first();
      if(fullscreen)await toggleReaderFullscreen(page);
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

for(const [bookId,chapter,verse] of [['isaiah',53,5],['genesis',1,2],['genesis',35,18],['1-john',2,23],['genesis',14,8]]){
  test(`KJV canonical offsets preserve supplied wording and punctuation in ${bookId} ${chapter}:${verse}`,async({page})=>{
    await open(page,'kjv',bookId,chapter,verse);
    const row=page.locator(`#readerContent [data-verse-number="${verse}"]`);
    const source=await row.getAttribute('data-verse-text');
    const offsets=await row.evaluate(node=>{
      const text=node.getAttribute('data-verse-text'),words=WordStudyAlignment.wordSpans(node);
      return {count:words.length,invalid:words.filter(word=>text.slice(Number(word.dataset.wordStudyStart),Number(word.dataset.wordStudyEnd))!==word.textContent).length,
        ordered:words.every((word,index)=>!index || Number(word.dataset.wordStudyStart)>=Number(words[index-1].dataset.wordStudyEnd))};
    });
    expect(offsets.count).toBe(await row.locator('[data-word-study-term]').count());
    expect(offsets.count).toBeGreaterThan(0);expect(offsets.invalid).toBe(0);expect(offsets.ordered).toBe(true);
    expect(await page.evaluate(({bookId,chapter,verse})=>BibleData.getVerse('kjv',bookId,chapter,verse).text,{bookId,chapter,verse})).toBe(source);
    const words=row.locator('[data-word-study-term]'),supplied=row.locator('i [data-word-study-term]');
    for(const word of [words.first(),...(await supplied.count()?[supplied.first()]:[]),words.last()]){
      const text=await word.textContent();await word.press('Enter');
      await expect(page.locator('#wordStudyVerse [data-selected="true"]')).toHaveText(text);
      await expect(page.locator('#wordStudyVerse')).toHaveText(source);
      await expect(page.locator('#wordStudyAlignmentStatus')).toContainText('Exact word alignment is unavailable');
      await expect(page.locator('#wordStudyOriginalTokens [data-aligned="true"]')).toHaveCount(0);
      await page.keyboard.press('Escape');await expect(word).toBeFocused();
    }
  });
}

for(const drift of ['word','italic marker'])test(`KJV ${drift} drift rejects canonical offsets and verified fixtures`,async({page})=>{
  const word=await open(page,'kjv','isaiah',53,5,true);
  await word.press('Enter');await expect(page.locator('#wordStudyOriginalTokens [data-aligned="true"]')).toHaveCount(2);
  await page.keyboard.press('Escape');
  await page.locator('#readerContent [data-verse-number="5"]').evaluate((node,drift)=>{
    const italic=node.querySelector('i');
    if(drift==='word')italic.querySelector('[data-word-study-term]').textContent='Altered';
    else italic.replaceWith(...italic.childNodes);
  },drift);
  await word.press('Enter');
  await expect(page.locator('#wordStudyAlignmentStatus')).toContainText('Exact word alignment is unavailable');
  await expect(page.locator('#wordStudyOriginalTokens [data-aligned="true"]')).toHaveCount(0);
  await expect(page.locator('#readerContent [data-word-study-start]')).toHaveCount(0);
  await expect(page.locator('#wordStudyVerse [data-selected="true"]')).toHaveCount(0);
});

test('WEB Genesis 1:1 aligns God with the published Hebrew token in both directions',async({page})=>{
  await open(page,'web','genesis',1,1);
  const verse=page.locator('#readerContent [data-verse-number="1"]');
  const god=verse.locator('[data-word-study-term="god"]');
  const hebrew=page.locator('#wordStudyOriginalTokens [data-original-language-token-index="2"]');
  const status=page.locator('#wordStudyAlignmentStatus');

  await god.press('Enter');
  await expect(status).toContainText('Verified phrase alignment');
  await expect(hebrew).toHaveText('אֱלֹהִ֑ים');
  await expect(hebrew).toHaveAttribute('data-aligned','true');
  await expect(page.locator('#wordStudyOriginalTokens [data-aligned="true"]')).toHaveCount(1);
  await expect(verse.locator('[data-aligned="true"]')).toHaveText('God');

  await page.getByRole('button',{name:'Identify aligned phrase created'}).press('Enter');
  await expect(status).toContainText('Verified phrase alignment');
  await expect(verse.locator('[data-aligned="true"]')).toHaveText('created');
  await hebrew.press('Enter');
  await expect(verse.locator('[data-aligned="true"]')).toHaveText('God');
  await expect(page.locator('#wordStudyVerse [data-aligned="true"]')).toHaveText('God');
  await expect(hebrew).toBeFocused();
});

test('a cold Word Study selection uses alignment that arrives before the Hebrew tokens',async({page})=>{
  let alignmentRequest, hebrewRequest;
  await page.route('**/js/word-study/alignment.js',route=>{alignmentRequest=route;});
  await page.route('**/data/word-study/original-language/genesis/1.json',route=>{hebrewRequest=route;});
  await open(page,'web','genesis',1,1,false,false);
  const god=page.locator('#readerContent [data-verse-number="1"] [data-word-study-term="god"]');
  await god.press('Enter');
  await expect.poll(()=>Boolean(alignmentRequest && hebrewRequest)).toBe(true);
  await alignmentRequest.continue();
  await page.waitForFunction(()=>Boolean(window.WordStudyAlignment));
  await hebrewRequest.continue();
  await expect(page.locator('#wordStudyAlignmentStatus')).toContainText('Verified phrase alignment');
  await expect(god).toHaveAttribute('data-aligned','true');
});

test('WEB Genesis 1:1 explains created and links the Hebrew verb',async({page})=>{
  await open(page,'web','genesis',1,1);
  const word=page.locator('#readerContent [data-verse-number="1"] [data-word-study-term="created"]');
  await word.press('Enter');
  await expect(page.locator('#wordStudyDefinition')).toHaveText('Made or brought into existence. In this verse, God made the heavens and the earth.');
  await expect(page.locator('#wordStudyPartOfSpeech')).toHaveText('verb');
  const hebrew=page.locator('#wordStudyOriginalTokens [data-original-language-token-index="1"]');
  await expect(hebrew).toHaveAttribute('data-aligned','true');
  await hebrew.press('Enter');
  await expect(page.locator('#wordStudyOriginalDetails')).toContainText('H1254');
});

test('WEB Mark 2:7 shows God’s verified Greek match and biblical sense',async({page})=>{
  await open(page,'web','mark',2,7);
  const word=page.locator('#readerContent [data-verse-number="7"] [data-word-study-term="god"]');
  const greek=page.locator('#wordStudyOriginalTokens [data-original-language-token-index="13"]');
  await word.press('Enter');
  await expect(page.locator('#wordStudyDefinition')).toContainText('The Supreme Being');
  await expect(page.locator('#wordStudySource')).toHaveText('Bible usage · Matched to this verse');
  await expect(page.locator('#wordStudyRelated')).toBeEmpty();
  await expect(greek).toHaveAttribute('data-aligned','true');
  await greek.press('Enter');
  const details=page.locator('#wordStudyOriginalDetails');
  await expect(details.locator('dt').first()).toHaveText('In this verse');
  await expect(details.locator('dd').first()).toHaveText('God');
  await expect(details).toContainText('G2316');
  await expect(details).toContainText('A deity, especially the supreme Divinity');
});

test('WEB Exodus 10 identifies LORD as the divine name and aligns it in verse 1',async({page})=>{
  await open(page,'web','exodus',10,2);
  const word=page.locator('#readerContent [data-verse-number="1"] [data-word-study-term="lord"]');
  const hebrew=page.locator('#wordStudyOriginalTokens [data-original-language-token-index="1"]');
  await word.press('Enter');
  await expect(page.locator('#wordStudyReference')).toHaveText('Exodus 10:1');
  await expect(page.locator('#wordStudyDefinition')).toContainText('YHWH (Yahweh), the personal name of God');
  await expect(page.locator('#wordStudyRelated')).toBeEmpty();
  await expect(hebrew).toHaveAttribute('data-aligned','true');
  await expect(page.locator('#wordStudyOriginalTokens [data-aligned="true"]')).toHaveCount(1);
  await hebrew.press('Enter');
  await expect(page.locator('#wordStudyOriginalDetails')).toContainText('H3068');
  await expect(page.locator('#wordStudyVerse [data-aligned="true"]')).toHaveText('LORD');
});

for(const [book,chapter,verse,title] of [['genesis',18,12,'lord'],['john',20,28,'Lord']]){
  test('WEB '+book+' '+chapter+':'+verse+' explains '+title+' as a title',async({page})=>{
    await open(page,'web',book,chapter,verse);
    const word=page.locator('#readerContent [data-verse-number="'+verse+'"] [data-word-study-term="lord"]');
    await expect(word).toHaveText(title);
    await word.press('Enter');
    await expect(page.locator('#wordStudyDefinition')).toContainText('A title expressing authority or respect');
  });
}

test('WEB Exodus 10 identifies Moses as a person and aligns his name in verse 1',async({page})=>{
  await open(page,'web','exodus',10,2);
  const moses=page.locator('#readerContent [data-verse-number="1"] [data-word-study-term="moses"]');
  const tokens=page.locator('#wordStudyOriginalTokens button');
  const hebrew=page.locator('#wordStudyOriginalTokens [data-original-language-token-index="3"]');
  await moses.press('Enter');
  await expect(page.locator('#wordStudyReference')).toHaveText('Exodus 10:1');
  await expect(page.locator('#wordStudyPartOfSpeech')).toHaveText('proper noun');
  await expect(page.locator('#wordStudyDefinition')).toHaveText('The man God called to lead the Israelites out of Egypt.');
  await expect(page.locator('#wordStudyRelated')).toBeEmpty();
  await expect(moses).toHaveAttribute('data-aligned','true');
  await expect(hebrew).toHaveAttribute('data-aligned','true');
  await hebrew.press('Enter');
  await expect(page.locator('#wordStudyOriginalDetails')).toContainText('H4872');
  await tokens.nth(16).press('Enter');
  await expect(page.locator('#wordStudyOriginalDetails')).toContainText('H7896');
  await expect(moses).toHaveAttribute('data-aligned','false');
  await expect(page.locator('#wordStudyDefinition')).toHaveText('The man God called to lead the Israelites out of Egypt.');
});

test('KJV Moses receives the biblical name definition without an exact alignment',async({page})=>{
  await open(page,'kjv','exodus',3,4);
  const moses=page.locator('#readerContent [data-verse-number="4"] [data-word-study-term="moses"]').first();
  await moses.press('Enter');
  await expect(page.locator('#wordStudyDefinition')).toHaveText('The man God called to lead the Israelites out of Egypt.');
  await expect(page.locator('#wordStudyAlignmentStatus')).toContainText('Exact word alignment is unavailable');
});

test('WEB John 1:1 highlights beginning and each occurrence of Word and God in Greek',async({page})=>{
  await open(page,'web','john',1,1);
  const verse=page.locator('#readerContent [data-verse-number="1"]');
  const matched=page.locator('#wordStudyOriginalTokens [data-aligned="true"]');
  const select=(term,index=0)=>verse.locator('[data-word-study-term="'+term+'"]').nth(index);
  await select('beginning').press('Enter');
  await expect(matched).toHaveAttribute('data-original-language-token-index','1');
  await matched.press('Enter');
  await expect(page.locator('#wordStudyOriginalDetails')).toContainText('G746');
  await expect(page.locator('#wordStudyVerse [data-aligned="true"]')).toHaveText('beginning');
  for(const [term,index,token] of [['Word',0,4],['Word',1,7],['Word',2,16],['God',0,11],['God',1,13]]){
    await page.getByRole('button',{name:'Identify aligned phrase '+term,exact:true}).nth(index).press('Enter');
    await expect(matched).toHaveCount(1);
    await expect(matched).toHaveAttribute('data-original-language-token-index',String(token));
  }
  await page.keyboard.press('Escape');
  await select('the').press('Enter');
  await expect(page.locator('#wordStudyAlignmentStatus')).toContainText('Exact word alignment is unavailable');
  await expect(matched).toHaveCount(0);
});

test('WEB John 1:3 highlights both Greek words for nothing in either direction',async({page})=>{
  await open(page,'web','john',1,3);
  const nothing=page.locator('#readerContent [data-verse-number="3"] [data-word-study-term="nothing"]');
  await nothing.press('Enter');
  const matched=page.locator('#wordStudyOriginalTokens [data-aligned="true"]');
  await expect(matched).toHaveText(['ουδε','εν']);
  await matched.last().press('Enter');
  await expect(page.locator('#wordStudyOriginalDetails')).toContainText('G1520');
  await expect(page.locator('#wordStudyVerse [data-aligned="true"]')).toHaveText('nothing');
  await expect(matched).toHaveText(['ουδε','εν']);
});

test('WEB Genesis 1:1 highlights the Hebrew for heavens',async({page})=>{
  await open(page,'web','genesis',1,1);
  await page.locator('#readerContent [data-verse-number="1"] [data-word-study-term="heavens"]').press('Enter');
  const matched=page.locator('#wordStudyOriginalTokens [data-aligned="true"]');
  await expect(matched).toHaveCount(1);
  await expect(matched).toHaveAttribute('data-original-language-token-index','4');
  await matched.press('Enter');
  await expect(page.locator('#wordStudyOriginalDetails')).toContainText('H8064');
});

test('lexical definitions never create inferred alignment',async({page})=>{
  await open(page,'web','john',1,1);
  const word=page.locator('#readerContent [data-verse-number="1"] [data-word-study-term="the"]').first();
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
    if(bookId==='genesis')await expect(page.locator('#wordStudyDefinition')).toHaveText('The start of something.');
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
