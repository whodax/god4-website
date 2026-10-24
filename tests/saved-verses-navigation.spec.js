const {test,expect}=require('@playwright/test');

// Exercise the visible Open buttons rather than calling openSavedVerse directly.
for(const mobile of [true,false])for(const colorScheme of ['light','dark'])for(const mixed of [false,true]){
  test.describe(`${mobile?'Android-sized':'desktop'} ${colorScheme} ${mixed?'mixed translations':'WEB'}`,()=>{
    test.use({viewport:{width:mobile?390:1280,height:844},hasTouch:mobile,isMobile:mobile,colorScheme});
    test('saved passages reopen in any order after saving and reloading',async({page})=>{
      const errors=[];page.on('pageerror',error=>errors.push(error.message));
      await page.goto('/');await page.evaluate(()=>initializeBibleExperience());
      const locations=[
        {translationId:'web',bookId:'john',chapter:1,verse:2},
        {translationId:mixed?'kjv':'web',bookId:'john',chapter:3,verse:16},
        {translationId:mixed?'dra':'web',bookId:mixed?'tobit':'genesis',chapter:2,verse:3}
      ];
      for(const location of locations){
        expect(await page.evaluate(async location=>{
          if(!await BibleTranslationLoader.ensure(location.translationId))return false;
          return navigateSearchResult(location);
        },location)).toBe(true);
        if(await page.locator('#readerMoreTrigger').getAttribute('aria-expanded')!=='true')await page.locator('#readerMoreTrigger').click();
        await page.locator('#readerSaveVerse').click();
        await expect(page.locator('#readerSaveStatus')).toContainText('saved.');
      }
      const saved=await page.evaluate(()=>UserData.savedVerses.load());
      expect(saved.map(entry=>entry.location)).toEqual(locations);
      for(const reload of [false,true]){
        if(reload)await page.reload();
        for(const index of [0,1,0,2,1,2,2,0]){
        const location=locations[index];
        await page.locator('.saved-pill').click();
        await expect(page.locator('#tray')).toHaveAttribute('aria-hidden','false');
        await expect(page.locator('#closeTray')).toBeFocused();
        const open=page.locator('.saved-verse-row').nth(index).getByRole('button',{name:'Open',exact:true});
        if(mobile)await open.tap();else await open.click();
        await expect(page.locator('#tray')).toHaveAttribute('aria-hidden','true');
        await expect(page.locator('.saved-pill')).toHaveAttribute('aria-expanded','false');
        const selected=page.locator('#readerContent .verse-focused');
        for(const [attribute,value] of [['translation-id',location.translationId],['book-id',location.bookId],['chapter',location.chapter],['verse-number',location.verse]]){
          await expect(selected).toHaveAttribute('data-'+attribute,String(value));
        }
        await expect(selected).toBeFocused();
        await expect.poll(()=>page.evaluate(()=>UserData.readerPosition.load())).toEqual({bookId:location.bookId,chapter:location.chapter,verse:location.verse});
        expect(await page.evaluate(()=>UserData.savedVerses.load())).toEqual(saved);
        await expect(page.locator('#savedCount')).toHaveText('3');
        }
      }
      // Closing normally still restores focus; removing one entry preserves the others.
      await page.locator('.saved-pill').click();await page.keyboard.press('Escape');
      await expect(page.locator('.saved-pill')).toBeFocused();
      await page.locator('.saved-pill').click();
      await page.locator('.saved-verse-row').nth(1).getByRole('button',{name:'Remove',exact:true}).click();
      expect(await page.evaluate(()=>UserData.savedVerses.load())).toEqual([saved[0],saved[2]]);
      await expect(page.locator('#closeTray')).toBeFocused();
      expect(errors).toEqual([]);
    });
  });
}
