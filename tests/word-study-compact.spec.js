const {test,expect}=require('@playwright/test');

test.use({contextOptions:{reducedMotion:'reduce'},serviceWorkers:'block'});

test.afterEach(async({page},info)=>{
  if(info.status!==info.expectedStatus){
    console.log('Focused compact geometry',JSON.stringify(await page.evaluate(()=>({height:innerHeight,top:readerVisibleTop(),active:document.activeElement?.getBoundingClientRect().toJSON(),header:document.querySelector('.word-study-header')?.getBoundingClientRect().toJSON(),context:document.getElementById('wordStudyContext')?.getBoundingClientRect().toJSON(),classes:document.getElementById('wordStudyPanel')?.className}))));
    await page.screenshot({path:info.outputPath('compact-failure.png')});
  }
});

const passages=[['kjv','isaiah',1,1,'he'],['kjv','isaiah',64,1,'he'],['web','john',1,1,'grc'],['dra','isaiah',1,1,'he'],['dra','isaiah',64,1,'he']];
const modes=[
  ['desktop',1280,900,false,false,1],['desktop fullscreen',1280,900,true,false,1],
  ['mobile',390,844,false,true,1],['mobile fullscreen',390,844,true,true,1],
  ['narrow',320,844,false,true,1],['narrow fullscreen',320,844,true,true,1],
  ['200% equivalent',640,450,false,false,2],['200% narrow equivalent',320,422,false,false,2],
  ['200% fullscreen equivalent',320,422,true,false,2]
];

async function open(page,passage,fullscreen,deferred=false){
  const [translationId,bookId,chapter,verse]=passage;
  await page.goto('/');
  expect(await page.evaluate(()=>matchMedia('(prefers-reduced-motion: reduce)').matches)).toBe(true);
  await page.evaluate(async context=>{
    await initializeBibleExperience();await changeTranslation(context.translationId);
    await navigateReaderToPassage(context.bookId,context.chapter,context.verse);
    await WordStudyLoader.ensure();await document.fonts.ready;
    if(context.deferred)WordStudyProvider.lookup=()=>new Promise(resolve=>{window.finishCompactDefinition=resolve;});
  },{translationId,bookId,chapter,verse,deferred});
  await page.waitForFunction(()=>Boolean(window.WordStudyAlignment));
  if(fullscreen)await page.locator('#fullscreenBtn').click();
  const word=page.locator(`#readerContent [data-verse-number="${verse}"] [data-word-study-term]`).first();
  const excerpt=await word.evaluate(element=>element.closest('.reader-verse').getAttribute('data-verse-text'));
  await word.press('Enter');
  await expect(page.locator('#wordStudyOriginalTokens button').first()).toBeVisible();
  if(!deferred)await expect(page.locator('#wordStudyPanel')).not.toHaveAttribute('data-word-study-state','loading');
  await page.evaluate(async()=>{await document.fonts.ready;await new Promise(requestAnimationFrame);await new Promise(requestAnimationFrame);});
  await expect(page.locator('#wordStudyVerse')).toHaveText(excerpt);
  return word;
}

async function visibleClearance(button){
  return button.evaluate(element=>{
    const rect=element.getBoundingClientRect(),context=document.getElementById('wordStudyContext');
    const header=document.querySelector('.word-study-header');
    const closing=element.id==='wordStudyClose',inset=closing?5:4;
    const top=Math.max(!closing&&getComputedStyle(context).position==='sticky'?context.getBoundingClientRect().bottom:0,!closing&&getComputedStyle(header).position==='sticky'?header.getBoundingClientRect().bottom:0,readerVisibleTop());
    const points=[[rect.left+2,rect.top+2],[rect.right-2,rect.top+2],[rect.left+2,rect.bottom-2],[rect.right-2,rect.bottom-2]];
    return rect.top>=top+inset&&rect.bottom<=innerHeight-inset&&points.every(([left,above])=>element.contains(document.elementFromPoint(left,above)));
  });
}

async function metrics(page){
  return page.evaluate(()=>{
    const bounds=id=>document.getElementById(id).getBoundingClientRect();
    const panel=document.getElementById('wordStudyPanel'),tokens=document.getElementById('wordStudyOriginalTokens');
    const style=getComputedStyle(panel),tokenStyle=getComputedStyle(tokens.querySelector('button'));
    function luminance(color){const parts=color.match(/\d+/g).slice(0,3).map(Number).map(value=>{value/=255;return value<=.04045?value/12.92:Math.pow((value+.055)/1.055,2.4);});return parts[0]*.2126+parts[1]*.7152+parts[2]*.0722;}
    function contrast(color,background){const foreground=luminance(color),back=luminance(background);return (Math.max(foreground,back)+.05)/(Math.min(foreground,back)+.05);}
    const contrasts=['wordStudyVerse','wordStudyAlignmentStatus','wordStudyOriginalHeading'].map(id=>contrast(getComputedStyle(document.getElementById(id)).color,style.backgroundColor));
    contrasts.push(contrast(tokenStyle.color,tokenStyle.backgroundColor));
    return {padding:[style.paddingTop,style.paddingRight],headerHeight:document.querySelector('.word-study-header').getBoundingClientRect().height,
      contextHeight:bounds('wordStudyContext').height,contextGap:tokens.getBoundingClientRect().top-bounds('wordStudyContext').bottom,
      statusGap:tokens.getBoundingClientRect().top-bounds('wordStudyAlignmentStatus').bottom,
      verseBottom:bounds('wordStudyVerse').bottom,headingTop:bounds('wordStudyOriginalHeading').top,
      verseFont:getComputedStyle(document.getElementById('wordStudyVerse')).fontSize,chipFont:tokenStyle.fontSize,
      chipLineHeight:tokenStyle.lineHeight,gap:getComputedStyle(tokens).gap,dir:tokens.dir,
      panelFits:panel.getBoundingClientRect().left>=0&&panel.getBoundingClientRect().right<=innerWidth,
      overflow:panel.scrollWidth>panel.clientWidth,clipped:Array.from(tokens.querySelectorAll('button')).some(button=>button.scrollWidth>button.clientWidth||button.scrollHeight>button.clientHeight),
      contrast:Math.min(...contrasts),minWidth:Math.min(...Array.from(tokens.children,button=>button.getBoundingClientRect().width)),minHeight:Math.min(...Array.from(tokens.children,button=>button.getBoundingClientRect().height)),
      scrollY,readerScroll:document.getElementById('view-reader').scrollTop};
  });
}

for(const [mode,width,height,fullscreen,touch,scale]of modes)test.describe(mode,()=>{
  test.use({viewport:{width,height},hasTouch:touch,deviceScaleFactor:scale});
  for(const passage of passages)test(`${passage[0]} ${passage[1]} ${passage[2]}:${passage[3]} compacts context without hiding words`,async({page},info)=>{
    const errors=[];page.on('pageerror',error=>errors.push(error.message));
    const word=await open(page,passage,fullscreen);
    const before=await metrics(page);
    await info.attach('compact-geometry',{body:JSON.stringify(before),contentType:'application/json'});
    expect(before.padding).toEqual(['14px','16px']);expect(before.headerHeight).toBeLessThan(57);
    expect(before.contextGap).toBe(4);expect(before.statusGap).toBe(12);
    expect(before.headingTop).toBeGreaterThanOrEqual(before.verseBottom);
    expect(before.verseFont).toBe('16px');expect(before.chipFont).toBe('18px');expect(before.chipLineHeight).toBe('27px');
    expect(before.gap).toBe('4px');expect(before.dir).toBe(passage[4]==='he'?'rtl':'ltr');
    expect(before.panelFits).toBe(true);expect(before.overflow).toBe(false);expect(before.clipped).toBe(false);
    expect(before.minWidth).toBeGreaterThanOrEqual(touch?44:32);expect(before.minHeight).toBeGreaterThanOrEqual(touch?44:32);
    expect(before.contrast).toBeGreaterThanOrEqual(4.5);
    expect(await page.evaluate(()=>devicePixelRatio)).toBe(scale);
    await expect(page.locator('#wordStudyAlignmentStatus')).toContainText('Exact word alignment is unavailable');
    await expect(page.locator('#wordStudyOriginalTokens [data-aligned="true"]')).toHaveCount(0);
    const buttons=page.locator('#wordStudyOriginalTokens button');
    await page.locator('#wordStudyClose').focus();
    await expect.poll(()=>visibleClearance(page.locator('#wordStudyClose'))).toBe(true);
    for(let index=0;index<Math.min(3,await buttons.count());index++){
      await page.keyboard.press('Tab');await expect(buttons.nth(index)).toBeFocused();
      await expect.poll(()=>visibleClearance(buttons.nth(index))).toBe(true);
      await expect(buttons.nth(index)).toHaveAttribute('lang',passage[4]);
    }
    const last=buttons.last();await last.evaluate(element=>element.focus({preventScroll:true}));
    await expect.poll(()=>visibleClearance(last)).toBe(true);
    await last.press('Space');await expect(last).toBeFocused();await expect(last).toHaveAttribute('aria-pressed','true');
    await expect(page.locator('#wordStudyOriginalDetails')).toBeVisible();
    await expect.poll(()=>visibleClearance(last)).toBe(true);
    const position=await metrics(page);
    await page.evaluate(async()=>{await new Promise(requestAnimationFrame);await new Promise(requestAnimationFrame);});
    const after=await metrics(page);expect(after.scrollY).toBe(position.scrollY);expect(after.readerScroll).toBe(position.readerScroll);
    await page.screenshot({path:info.outputPath('compact-word-study.png')});
    await page.keyboard.press('Escape');await expect(word).toBeFocused();expect(errors).toEqual([]);
  });
});

for(const fullscreen of [false,true])test('delayed long definitions preserve focus and scroll '+fullscreen,async({page})=>{
  await page.setViewportSize({width:390,height:844});
  const word=await open(page,passages[0],fullscreen,true);
  const selected=page.locator('#wordStudyOriginalTokens button').last();
  await selected.press('Enter');await expect.poll(()=>visibleClearance(selected)).toBe(true);
  const before=await metrics(page);
  await page.evaluate(()=>finishCompactDefinition({status:'available',definition:'Long readable definition. '.repeat(300)}));
  await expect(page.locator('#wordStudyDefinition')).toContainText('Long readable definition.');await expect(selected).toBeFocused();
  await page.evaluate(async()=>{await new Promise(requestAnimationFrame);await new Promise(requestAnimationFrame);});
  const after=await metrics(page);expect(after.scrollY).toBe(before.scrollY);expect(after.readerScroll).toBe(before.readerScroll);
  expect(await page.locator('#wordStudyPanel').evaluate(element=>getComputedStyle(element).overflowY)).toBe('visible');
  await page.keyboard.press('Escape');await expect(word).toBeFocused();
});

for(const fullscreen of [false,true])test('long words and increased text spacing wrap without clipping '+fullscreen,async({page})=>{
  await page.setViewportSize({width:320,height:844});await open(page,passages[1],fullscreen);
  await page.addStyleTag({content:'#wordStudyPanel p{line-height:1.5!important;letter-spacing:.12em!important;word-spacing:.16em!important;margin-bottom:2em!important}'});
  const chip=page.locator('#wordStudyOriginalTokens button').first();
  await chip.evaluate(element=>{element.textContent='בְּרֵאשִׁית'.repeat(24);});
  expect(await chip.evaluate(element=>({fits:element.scrollWidth<=element.clientWidth&&element.scrollHeight<=element.clientHeight,grows:element.getBoundingClientRect().height>44,overflow:getComputedStyle(element).overflowY}))).toEqual({fits:true,grows:true,overflow:'visible'});
  expect(await page.locator('#wordStudyPanel').evaluate(element=>element.scrollWidth<=element.clientWidth)).toBe(true);
});
