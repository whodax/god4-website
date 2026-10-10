const {test, expect} = require('@playwright/test');

async function startGeometry(page){
  return page.evaluate(()=>({top:document.querySelector('#readerContent h2').getBoundingClientRect().top,
    boundary:readerVisibleTop()+16, height:innerHeight}));
}
async function expectStart(page){
  await expect.poll(async()=>{const g=await startGeometry(page);return Math.abs(g.top-g.boundary);}).toBeLessThan(2);
  const geometry=await startGeometry(page);
  expect(Math.abs(geometry.top-geometry.boundary)).toBeLessThan(2);
  expect(geometry.top).toBeLessThan(geometry.height);
  await expect(page.locator('#verseSelect')).toHaveValue('');
}
async function expectVerse(page, verse){
  const target=page.locator(`#readerContent [data-verse-number="${verse}"]`);
  await expect(target).toBeFocused();
  await expect.poll(()=>target.evaluate(el=>el.getBoundingClientRect().bottom<=innerHeight && el.getBoundingClientRect().top>=readerVisibleTop())).toBe(true);
  const geometry=await target.evaluate(el=>({top:el.getBoundingClientRect().top,
    bottom:el.getBoundingClientRect().bottom,boundary:readerVisibleTop(),height:innerHeight}));
  expect(geometry.top).toBeGreaterThanOrEqual(geometry.boundary);
  expect(geometry.bottom).toBeLessThanOrEqual(geometry.height);
}
for(const [name,viewport] of [['desktop',{width:1280,height:900}],['mobile',{width:390,height:844}]]){
  test.describe(name,()=>{
    test.use({viewport,reducedMotion:'reduce'});
    test.beforeEach(async({page})=>{
      await page.emulateMedia({reducedMotion:'reduce'});
      page.errors=[];
      page.on('pageerror',error=>page.errors.push(error.message));
      await page.goto('/');
      await page.evaluate(async()=>{await initializeBibleExperience();await changeTranslation('web');});
      await page.evaluate(()=>document.fonts.ready);
    });
    test.afterEach(async({page})=>expect(page.errors).toEqual([]));

    test('six chapter targets from top, middle and bottom have deterministic sticky geometry',async({page})=>{
      for(const [book,chapter] of [['psalms',23],['psalms',150],['genesis',1],['genesis',32],['john',1],['romans',8]]){
        const positions=[];
        for(const fraction of [0,0.5,1]){
          await page.evaluate(async({book,chapter,fraction})=>{
            await navigateReaderToPassage('genesis',24,67);
            window.scrollTo({top:(document.documentElement.scrollHeight-innerHeight)*fraction,behavior:'instant'});
            const selector=document.getElementById('bookSelect');
            selector.value=book; selector.dispatchEvent(new Event('change'));
            const chapters=document.getElementById('chapterSelect');
            chapters.value=String(chapter); chapters.dispatchEvent(new Event('change'));
          },{book,chapter,fraction});
          await expectStart(page);
          positions.push((await startGeometry(page)).top);
        }
        expect(Math.max(...positions)-Math.min(...positions)).toBeLessThan(2);
      }
    });

    test('selectors, previous/next and voice retain controls and clear old verses',async({page})=>{
      await page.evaluate(()=>navigateReaderToPassage('genesis',24,20));
      for(const action of ['next','previous']){
        await page.locator(`[data-reader-action="${action}"]`).focus();
        await page.locator(`[data-reader-action="${action}"]`).click();
        await expectStart(page);
        await expect(page.locator(`[data-reader-action="${action}"]`)).toBeFocused();
      }
      await page.locator('#bookSelect').focus();
      await page.locator('#bookSelect').selectOption('psalms');
      await expectStart(page); await expect(page.locator('#bookSelect')).toBeFocused();
      await page.locator('#chapterSelect').focus();
      await page.locator('#chapterSelect').selectOption('23');
      await expectStart(page); await expect(page.locator('#chapterSelect')).toBeFocused();
      await page.evaluate(()=>handleVoiceCommand('Open Romans 8'));
      await expectStart(page);
      await page.evaluate(()=>handleVoiceCommand('Romans 8:28'));
      await expectVerse(page,28);
    });

    test('cold and warm translations position chapter or retain valid explicit verse',async({page})=>{
      await page.evaluate(()=>navigateReaderToPassage('genesis',24));
      for(const translation of ['asv','web','asv']){
        await page.evaluate(async translation=>{
          window.scrollTo({top:document.documentElement.scrollHeight,behavior:'instant'});
          await changeTranslation(translation);
        },translation);
        await expectStart(page);
      }
      await page.evaluate(async()=>{await navigateReaderToPassage('romans',8,28);await changeTranslation('web');});
      await expect(page.locator('#verseSelect')).toHaveValue('28');
      const rect=await page.locator('#readerContent [data-verse-number="28"]').boundingBox();
      expect(rect.y).toBeGreaterThanOrEqual(await page.evaluate(()=>readerVisibleTop()));
      expect(rect.y+rect.height).toBeLessThanOrEqual(viewport.height);
    });

    test('explicit targets retain focus and positioning',async({page})=>{
      await page.evaluate(()=>{
        window.scrollBehaviors=[];
        const scrollBy=window.scrollBy.bind(window);
        window.scrollBy=options=>{scrollBehaviors.push(options.behavior);scrollBy(options);};
      });
      for(const [book,chapter,verse] of [['genesis',24,67],['psalms',23,6],['romans',8,28]]){
        expect(await page.evaluate(({book,chapter,verse})=>navigateReaderToPassage(book,chapter,verse),{book,chapter,verse})).toBe(true);
        await expectVerse(page,verse);
      }
      expect(await page.evaluate(()=>scrollBehaviors)).toEqual(['instant','instant','instant']);
    });

    test('pending translation uses the latest chapter and normal motion Search settles at its verse',async({page})=>{
      await page.evaluate(()=>{
        const ensure=BibleTranslationLoader.ensure.bind(BibleTranslationLoader);
        BibleTranslationLoader.ensure=id=>id==='asv'
          ? new Promise(resolve=>window.releaseTranslation=()=>ensure(id).then(resolve)) : ensure(id);
        window.translationChange=changeTranslation('asv');
      });
      await page.evaluate(()=>navigateReaderToPassage('psalms',23));
      await page.evaluate(async()=>{releaseTranslation();await translationChange;});
      await expect(page.locator('#readerContent h2')).toHaveText('Psalms 23');
      await expectStart(page);
      await page.emulateMedia({reducedMotion:'no-preference'});
      await page.evaluate(()=>navigateSearchResult({translationId:'web',bookId:'genesis',chapter:24,verse:67}));
      await expectVerse(page,67);
      const position=await page.evaluate(()=>scrollY);
      await page.evaluate(async()=>{await new Promise(requestAnimationFrame);await new Promise(requestAnimationFrame);});
      expect(await page.evaluate(()=>scrollY)).toBe(position);
    });

    test('startup and hidden or missing Reader helpers do not scroll',async({page})=>{
      await page.evaluate(()=>navigateReaderToPassage('genesis',24,67));
      await page.addInitScript(()=>{
        window.applicationScrolls=0;
        const scrollBy=window.scrollBy.bind(window);
        window.scrollBy=options=>{window.applicationScrolls++;scrollBy(options);};
      });
      await page.reload();await page.evaluate(()=>initializeBibleExperience());
      expect(await page.evaluate(()=>applicationScrolls)).toBe(0);
      await expect(page.locator('#verseSelect')).toHaveValue('67');
      await expect(page.locator('#readerContent [data-verse-number="67"]')).not.toBeFocused();
      await page.evaluate(()=>{
        switchView('compare',document.querySelector('[aria-controls="view-compare"]'));
        // Compare may keep its sticky navigation visible after document-height clamping.
        window.applicationScrolls=0;
        scrollReaderStartIntoView();
        document.querySelector('#readerContent h2').remove();scrollReaderStartIntoView();
      });
      expect(await page.evaluate(()=>applicationScrolls)).toBe(0);
    });

    test('Search from Reader and Compare ends at its chapter or explicit verse',async({page})=>{
      await page.evaluate(()=>{
        window.companionScrolls=0;
        document.getElementById('companion').scrollIntoView=()=>window.companionScrolls++;
      });
      for(const view of ['reader','compare']){
        await page.evaluate(view=>switchView(view,document.querySelector(`[aria-controls="view-${view}"]`)),view);
        await page.locator('#searchInput').fill('Genesis 24:67');
        await page.getByRole('button',{name:'Search',exact:true}).click();
        await page.locator('#results .result-card').first().click();
        await expect(page.locator('#view-reader')).toHaveClass(/active/);
        await expectVerse(page,67);
        await page.locator('#searchInput').fill('Psalms 23');
        await page.getByRole('button',{name:'Search',exact:true}).click();
        await page.locator('#results .result-card').first().click();
        await expectStart(page);
      }
      expect(await page.evaluate(()=>window.companionScrolls)).toBe(0);
    });

    test('delayed English and original-language callbacks cannot mutate or focus obsolete study',async({page})=>{
      await page.evaluate(()=>{
        window.realLookup=WordStudyProvider.lookup;
        window.realOriginal=OriginalLanguageWordStudyProvider.lookupVerse;
        WordStudyProvider.lookup=()=>new Promise(resolve=>window.finishOldEnglish=resolve);
        OriginalLanguageWordStudyProvider.lookupVerse=()=>new Promise(resolve=>window.finishOldOriginal=resolve);
      });
      await page.locator('#readerContent [data-word-study-term]').first().click();
      await expect(page.locator('#wordStudyPanel')).toBeVisible();
      await page.evaluate(()=>navigateReaderToPassage('psalms',23,6));
      await expectVerse(page,6);
      const position=await page.evaluate(()=>scrollY);
      await page.evaluate(async()=>{
        finishOldEnglish({status:'available',definition:'OBSOLETE',relatedWords:[]});
        finishOldOriginal({status:'available',records:[{surface:'OBSOLETE',language:'greek',tokenIndex:0}]});
        await Promise.resolve();await Promise.resolve();
      });
      await expect(page.locator('#wordStudyPanel')).toBeHidden();
      await expect(page.locator('#wordStudyHeading')).not.toBeFocused();
      await expect(page.locator('#wordStudyDefinition')).not.toContainText('OBSOLETE');
      await expect(page.locator('#wordStudyOriginalTokens')).not.toContainText('OBSOLETE');
      expect(await page.evaluate(()=>scrollY)).toBe(position);
      await expectVerse(page,6);
      await page.evaluate(()=>{
        WordStudyProvider.lookup=realLookup;OriginalLanguageWordStudyProvider.lookupVerse=realOriginal;
      });
      const word=page.locator('#readerContent [data-verse-number="6"] [data-word-study-term]').first();
      await word.click();
      await expect(page.locator('#wordStudyDefinition')).not.toHaveText('Looking up this word...');
      await page.locator('#wordStudyHeading').press('Escape');
      await expect(word).toBeFocused();
    });

    test('unchanged Reader return, fullscreen, history and reload preserve intent',async({page})=>{
      await page.evaluate(()=>navigateReaderToPassage('genesis',24,67));
      const position=await page.evaluate(()=>scrollY);
      await page.evaluate(()=>{
        switchView('compare',document.querySelector('[aria-controls="view-compare"]'));
        switchView('reader',document.querySelector('[aria-controls="view-reader"]'));
      });
      expect(await page.evaluate(()=>scrollY)).toBe(position);
      const historyLength=await page.evaluate(()=>history.length);
      await page.evaluate(()=>navigateReaderToPassage('psalms',23));
      expect(await page.evaluate(()=>history.length)).toBe(historyLength);
      expect(await page.evaluate(()=>history.scrollRestoration)).toBe('auto');
      await page.evaluate(()=>toggleFullscreen());
      await page.evaluate(()=>navigateReaderToPassage('genesis',1));
      await expectStart(page);
      await page.evaluate(()=>toggleFullscreen());
      await page.goto('/?history-probe=1');
      await page.goBack(); await page.evaluate(()=>initializeBibleExperience());
      await expect(page.locator('#readerContent h2')).toHaveText('Genesis 1');
      await page.goForward(); await page.evaluate(()=>initializeBibleExperience());
      await expect(page.locator('#readerContent h2')).toHaveText('Genesis 1');
      await page.reload(); await page.evaluate(()=>initializeBibleExperience());
      await expect(page.locator('#readerContent h2')).toHaveText('Genesis 1');
      await expect(page.locator('#readerContent h2')).not.toBeFocused();
      expect(await page.evaluate(()=>history.scrollRestoration)).toBe('auto');
    });
  });
}
