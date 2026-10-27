const {test,expect}=require('@playwright/test');
const {toggleReaderFullscreen}=require('./reader-navigation-test-helper');
test.use({hasTouch:true});
const labels=['World English Bible Protestant Edition','World English Bible'];
const editions=['web','asv','kjv','ylt','dby','webster','rv','gnv','dra'];

async function open(page,width=390,dark=false,fullscreen=false){
  await page.setViewportSize({width,height:844});await page.emulateMedia({reducedMotion:'reduce'});
  await page.addInitScript(dark=>{localStorage.setItem('god4.theme',dark?'dark':'light');window.IntersectionObserver=class{observe(){}unobserve(){}disconnect(){}};},dark);
  await page.goto('/');await page.evaluate(()=>initializeBibleExperience());await page.evaluate(()=>ReaderTranslationLoader.ensure());await page.evaluate(()=>document.fonts.ready);
  if(fullscreen)await toggleReaderFullscreen(page);
}

for(const width of [320,360,390,430])for(const dark of [false,true])for(const fullscreen of [false,true]){
  test(`${width}px dark=${dark} fullscreen=${fullscreen}: WEB labels retain accessibility while Scripture gains their entire layout space`,async({page})=>{
    await open(page,width,dark,fullscreen);
    await expect(page.locator('#readerContent h2')).toHaveText('John 1');
    const nodes=page.locator('#readerContent > .reader-web-edition-label');await expect(nodes).toHaveCount(2);await expect(nodes).toHaveText(labels);
    for(const node of await nodes.all()){
      const styles=await node.evaluate(e=>{const s=getComputedStyle(e),r=e.getBoundingClientRect();return {position:s.position,width:r.width,height:r.height,overflow:s.overflow,clip:s.clip};});
      expect(styles).toMatchObject({position:'absolute',width:1,height:1,overflow:'hidden'});expect(styles.clip).not.toBe('auto');
      expect(await node.ariaSnapshot()).toContain(await node.textContent());
    }
    const geometry=await page.evaluate(()=>{
      const nodes=[...document.querySelectorAll('#readerContent > .reader-web-edition-label')];
      const gap=()=>document.querySelector('#readerContent .reader-verse').getBoundingClientRect().top-document.querySelector('#readerContent h2').getBoundingClientRect().bottom;
      const compact=gap();nodes.forEach(n=>n.classList.remove('reader-web-edition-label'));
      const original=gap(),labelSpace=nodes.reduce((sum,n)=>{const s=getComputedStyle(n);return sum+n.getBoundingClientRect().height+parseFloat(s.marginTop)+parseFloat(s.marginBottom);},0);
      nodes.forEach(n=>n.classList.add('reader-web-edition-label'));
      return {compact,original,reclaimed:original-compact,labelSpace,restored:gap(),overflow:document.documentElement.scrollWidth>innerWidth};
    });
    console.log('WEB reading-space geometry:',JSON.stringify({width,dark,fullscreen,...geometry}));
    expect(geometry.reclaimed).toBeGreaterThan(80);expect(Math.abs(geometry.reclaimed-geometry.labelSpace)).toBeLessThan(1);
    expect(Math.abs(geometry.restored-geometry.compact)).toBeLessThan(1);expect(geometry.overflow).toBe(false);
    const trigger=page.locator('#readerTranslationTrigger');await expect(trigger).toHaveAccessibleName(/Bible translation: WEB.*World English Bible/);
    expect((await trigger.boundingBox()).height).toBeGreaterThanOrEqual(44);
    await trigger.click();const picker=page.locator('#readerTranslationPicker');
    await expect(picker.locator('[data-translation]')).toHaveCount(9);await expect(picker.locator('[data-translation="web"]')).toHaveAttribute('aria-pressed','true');
    await expect(picker.locator('[data-translation="web"]')).toHaveAccessibleName(/WEB.*World English Bible/);
    await page.keyboard.press('Escape');await expect(trigger).toBeFocused();
  });
}

for(const dark of [false,true])test(`desktop dark=${dark}: both WEB labels and their original spacing remain visible`,async({page})=>{
  await open(page,1280,dark);const nodes=page.locator('#readerContent > .reader-web-edition-label');await expect(nodes).toHaveText(labels);
  for(const node of await nodes.all()){await expect(node).toBeVisible();await expect(node).toHaveCSS('position','static');}
  await expect(nodes.first()).toHaveCSS('margin-bottom','22px');await expect(nodes.last()).toHaveCSS('margin-bottom','20px');
});

test('620px boundary responds in both directions without stale visibility or metadata',async({page})=>{
  await open(page,621);const label=page.locator('#readerContent .subtitle');await expect(label).toHaveCSS('position','static');
  await page.setViewportSize({width:620,height:844});await expect(label).toHaveCSS('position','absolute');
  await page.setViewportSize({width:621,height:844});await expect(label).toHaveCSS('position','static');await expect(label).toHaveText(labels[0]);
});

test('all nine editions remain available; DRA Catholic labels and chapter distinctions stay visible',async({page})=>{
  await open(page);
  for(const id of editions){
    await page.locator('#readerTranslationTrigger').click();const choice=page.locator('#readerTranslationPicker [data-translation="'+id+'"]');
    await choice.click();await expect(page.locator('#readerTranslation')).toHaveValue(id);await expect(page.locator('#readerContent h2')).toHaveText('John 1');
    if(id!=='web'){
      await expect(page.locator('#readerContent .reader-web-edition-label')).toHaveCount(0);
      await expect(page.locator('#readerContent .reader-chapter-caption')).toHaveCSS('position','static');
    }
  }
  await expect(page.locator('#readerTranslationTrigger')).toHaveAccessibleName('Bible translation: DRA — Douay-Rheims — Catholic');
  await page.evaluate(()=>navigateReaderToPassage('daniel',13,1));
  await expect(page.locator('#readerContent h2')).toHaveText('Daniel 13');await expect(page.locator('#readerContent .reader-chapter-caption')).toBeVisible();
  await page.locator('#readerTranslationTrigger').click();await page.locator('#readerTranslationPicker [data-translation="web"]').click();
  await expect(page.locator('#readerContent .reader-web-edition-label')).toHaveCount(2);
});

test('meaningful subtitles and canon notices are not mistaken for the two redundant labels',async({page})=>{
  await open(page);await page.evaluate(()=>{
    const get=BibleData.getChapter;BibleData.getChapter=function(...args){const chapter=get(...args);return {...chapter,subtitle:'To the chief Musician',title:'A Psalm of David'};};renderPassage('psalms',3);
  });
  await expect(page.locator('#readerContent .subtitle')).toHaveText('To the chief Musician');await expect(page.locator('#readerContent .subtitle')).toHaveCSS('position','static');
  await expect(page.locator('#readerContent .reader-chapter-caption')).toHaveText('A Psalm of David');await expect(page.locator('#readerContent .reader-web-edition-label')).toHaveCount(0);
  await page.reload();await page.evaluate(()=>initializeBibleExperience());await page.evaluate(()=>{window.BibleCanon={...BibleCanon,passageLabel:()=> 'Required canon distinction'};renderPassage('john',1);});
  await expect(page.locator('#readerContent .reader-chapter-caption')).toHaveText('World English Bible — Required canon distinction');
  await expect(page.locator('#readerContent .reader-chapter-caption')).toHaveCSS('position','static');
});
