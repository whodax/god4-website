const {test,expect}=require('@playwright/test');
const fs=require('node:fs');
const vm=require('node:vm');
const verses=vm.runInNewContext(fs.readFileSync('js/bible/web.js','utf8')+'\nwebLibrary.exodus[20].verses');
const groups=[[2,3],[4],[7],[8,9],[12],[13],[14],[15],[16],[17]];
test.use({serviceWorkers:'block'});

for(const width of [320,390,430,1280])test(`${width}px: all ten WEB passages and accessible arrow navigation`,async({page})=>{
  await page.setViewportSize({width,height:780});
  const requests=[];
  page.on('request',request=>requests.push(new URL(request.url()).pathname));
  await page.goto('/');
  await expect(page.getByRole('heading',{name:'GOD SPOKE ALL THESE WORDS'})).toBeVisible();
  const panel=page.getByRole('region',{name:'Exodus 20:2–17 (WEB)'});
  const region=panel.getByRole('region',{name:'Scroll through the ten commandments'});
  const items=region.getByRole('listitem');
  const position=panel.getByRole('status');
  const previous=panel.getByRole('button',{name:'Previous commandment'});
  const next=panel.getByRole('button',{name:'Next commandment'});
  const scrollbar=panel.getByRole('slider',{name:'Scroll commandments'});
  await expect(scrollbar).toBeVisible();
  const [refRect,contentRect,barRect,previousRect,positionRect,nextRect]=await Promise.all(
    [panel.getByRole('heading'),region,scrollbar,previous,position,next].map(item=>item.boundingBox())
  );
  expect(refRect.y+refRect.height).toBeLessThanOrEqual(contentRect.y);
  expect(contentRect.x+contentRect.width).toBeLessThan(barRect.x);
  expect(contentRect.y+contentRect.height).toBeLessThan(previousRect.y);
  expect(previousRect.x+previousRect.width).toBeLessThan(positionRect.x);
  expect(positionRect.x+positionRect.width).toBeLessThan(nextRect.x);
  await expect(previous).toHaveText('↑');
  await expect(next).toHaveText('↓');
  await expect(items).toHaveCount(10);
  await expect(position).toHaveText('1 of 10');
  await expect(previous).toBeDisabled();
  expect(requests).not.toContain('/js/home-commandments.js');
  for(let i=0;i<groups.length;i++){
    await expect(items.nth(i)).toHaveText(groups[i].map(verse=>verses[verse-1]).join(' '));
    await expect(position).toHaveText(`${i+1} of 10`);
    await expect(scrollbar).toHaveAttribute('aria-valuetext',`${i+1} of 10`);
    await expect.poll(()=>items.nth(i).evaluate(el=>Math.abs(el.offsetTop-el.closest('#commandmentScroll').scrollTop))).toBeLessThanOrEqual(1);
    if(i<9)await next.press('Enter');
  }
  await expect(next).toBeDisabled();
  await expect(next).toBeFocused();
  await previous.press('Space');
  await expect(position).toHaveText('9 of 10');
  await expect(previous).toBeFocused();
  await expect(region).toHaveCSS('overflow-y','scroll');
  expect(await page.evaluate(()=>document.documentElement.scrollWidth<=innerWidth)).toBe(true);
  for(const button of [previous,next]){
    const rect=await button.boundingBox();
    expect(rect.width).toBeGreaterThanOrEqual(44);
    expect(rect.height).toBeGreaterThanOrEqual(44);
  }
});

test('native scrolling updates the position without moving focus or the document',async({page})=>{
  await page.setViewportSize({width:320,height:780});
  await page.goto('/');
  const region=page.locator('#commandmentScroll');
  await region.focus();
  const before=await page.evaluate(()=>scrollY);
  await region.press('End');
  await expect(page.locator('#commandments output')).toHaveText('10 of 10');
  await region.press('Home');
  await expect(page.locator('#commandments output')).toHaveText('1 of 10');
  await expect(region).toBeFocused();
  expect(await page.evaluate(()=>scrollY)).toBe(before);
  await region.evaluate(el=>el.scrollTo(0,el.querySelectorAll('li')[3].offsetTop));
  await expect(page.locator('#commandments output')).toHaveText('4 of 10');
  await region.press('Tab');
  const bar=page.getByRole('slider',{name:'Scroll commandments'});
  await expect(bar).toBeFocused();
  await bar.press('End');
  await expect(page.locator('#commandments output')).toHaveText('10 of 10');
  await bar.press('Home');
  await expect(page.locator('#commandments output')).toHaveText('1 of 10');
  await page.keyboard.press('Tab');
  await expect(page.getByRole('button',{name:'Previous commandment'})).toBeFocused();
  await page.keyboard.press('Tab');
  await expect(page.getByRole('button',{name:'Next commandment'})).toBeFocused();
  await page.keyboard.press('Tab');
  await expect(page.getByRole('button',{name:/Another verse/i})).toBeFocused();
});

test('Another Verse still follows the Scripture panel and advances the existing card',async({page})=>{
  await page.goto('/');
  await expect(page.locator('#commandments + .leaf-wrap #leafCard')).toBeVisible();
  await expect(page.getByRole('link',{name:/Begin Reading|Browse Resources/i})).toHaveCount(0);
  const ref=page.locator('#verseRef');
  await ref.scrollIntoViewIfNeeded();
  await page.waitForFunction(()=>localStorage.getItem('god4.discovery.openingTopic'));
  const opening=await ref.textContent();
  await page.getByRole('button',{name:/Another verse/i}).click();
  await expect(ref).not.toHaveText(opening);
});

test('touch scrolling and enlarged text stay inside the panel in Dark Mode',async({page})=>{
  await page.setViewportSize({width:320,height:780});
  await page.goto('/');
  await page.locator('[data-theme-toggle]').click();
  await expect(page.locator('html')).toHaveAttribute('data-theme','dark');
  const region=page.locator('#commandmentScroll');
  const bounds=await region.boundingBox();
  const session=await page.context().newCDPSession(page);
  await session.send('Emulation.setTouchEmulationEnabled',{enabled:true,maxTouchPoints:1});
  const x=Math.round(bounds.x+bounds.width/2), y=Math.round(bounds.y+bounds.height*.8);
  await session.send('Input.dispatchTouchEvent',{type:'touchStart',touchPoints:[{x,y}]});
  for(const distance of [20,40,65,90]){
    await session.send('Input.dispatchTouchEvent',{type:'touchMove',touchPoints:[{x,y:y-distance}]});
  }
  await session.send('Input.dispatchTouchEvent',{type:'touchEnd',touchPoints:[]});
  await expect.poll(()=>region.evaluate(el=>el.scrollTop)).toBeGreaterThan(0);
  expect(await page.evaluate(()=>scrollY)).toBe(0);
  await page.addStyleTag({content:'#commandmentScroll { font-size: 200%; }'});
  const second=region.getByRole('listitem').nth(1);
  await region.evaluate(el=>el.scrollTo(0,el.querySelectorAll('li')[1].offsetTop));
  await expect(page.locator('#commandments output')).toHaveText('2 of 10');
  const geometry=await second.evaluate(el=>{
    const scroll=el.closest('#commandmentScroll');
    return {height:el.offsetHeight,viewport:scroll.clientHeight,overflow:scroll.scrollWidth>scroll.clientWidth};
  });
  expect(geometry.height).toBeGreaterThan(geometry.viewport);
  expect(geometry.overflow).toBe(false);
  await region.evaluate(el=>{
    const item=el.querySelectorAll('li')[1];
    el.scrollTo(0,item.offsetTop+item.offsetHeight-el.clientHeight);
  });
  await expect(page.locator('#commandments output')).toHaveText('2 of 10');
  await expect.poll(()=>second.evaluate(el=>el.getBoundingClientRect().bottom-el.closest('#commandmentScroll').getBoundingClientRect().bottom)).toBeLessThanOrEqual(1);
});

for(const width of [320,390,430])test.describe('Android-style '+width+'px',()=>{
  test.use({viewport:{width,height:780},isMobile:true,hasTouch:true,
    userAgent:'Mozilla/5.0 (Linux; Android 14; Pixel 7) AppleWebKit/537.36 Chrome/130.0.0.0 Mobile Safari/537.36'});
  test('persistent scrollbar responds to touch and stays in sync',async({page})=>{
    await page.goto('/');
    const bar=page.getByRole('slider',{name:'Scroll commandments'});
    const output=page.locator('#commandments output');
    await expect(bar).toHaveCSS('writing-mode','vertical-lr');
    const bounds=await bar.boundingBox();
    expect(bounds.height).toBeGreaterThan(bounds.width);
    const before=await page.evaluate(()=>scrollY);
    await page.touchscreen.tap(bounds.x+bounds.width/2,bounds.y+bounds.height-2);
    await expect(output).toHaveText('10 of 10');
    await expect(bar).toHaveAttribute('aria-valuetext','10 of 10');
    await page.getByRole('button',{name:'Previous commandment'}).tap();
    await expect(output).toHaveText('9 of 10');
    await expect(bar).toHaveValue('9');
    expect(await page.evaluate(()=>scrollY)).toBe(before);
  });
});
