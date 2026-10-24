const {test,expect}=require('@playwright/test');

// Long Saved Verses lists must scroll inside the drawer, not behind it.
test.use({serviceWorkers:'block'});

for(const {width,height,mobile,colorScheme} of [
  {width:320,height:568,mobile:true,colorScheme:'light'},
  {width:390,height:844,mobile:true,colorScheme:'dark'},
  {width:1280,height:800,mobile:false,colorScheme:'light'},
  {width:1280,height:800,mobile:false,colorScheme:'dark'}
]){
  test.describe((mobile?'touch':'desktop')+' '+width+'x'+height+' '+colorScheme,()=>{
    test.use({viewport:{width,height},hasTouch:mobile,isMobile:mobile,colorScheme});

    test('every saved verse remains reachable without moving the heading',async({page})=>{
      await page.goto('/');
      const entries=await page.evaluate(()=>{
        const values=Array.from({length:24},(_,i)=>({
          ref:'John 1:'+(i+1)+' (WEB)',
          text:'Saved passage '+(i+1)+'. '+('A longer Scripture excerpt wraps onto multiple lines. ').repeat(3),
          location:{translationId:'web',bookId:'john',chapter:1,verse:i+1}
        }));
        if(!UserData.savedVerses.save(values))throw new Error('Could not seed saved passages');
        return values;
      });
      await page.reload();
      await page.locator('.saved-pill').click();
      const tray=page.locator('#tray'),list=page.locator('#trayList'),close=page.locator('#closeTray');
      const rows=list.locator('.saved-verse-row'),last=rows.last().getByRole('button',{name:'Open',exact:true});
      await expect(tray).toHaveAttribute('aria-hidden','false');
      await expect(rows).toHaveCount(24);
      await expect(close).toBeFocused();
      await expect.poll(()=>tray.evaluate(node=>Math.abs(node.getBoundingClientRect().right-innerWidth))).toBeLessThan(2);
      const before=await page.evaluate(()=>{
        const tray=document.getElementById('tray'),list=document.getElementById('trayList');
        return {scrollHeight:list.scrollHeight,clientHeight:list.clientHeight,
          overflow:getComputedStyle(list).overflowY,
          trayBottom:tray.getBoundingClientRect().bottom,
          closeTop:document.getElementById('closeTray').getBoundingClientRect().top,
          pageScroll:scrollY};
      });
      expect(before.overflow).toBe('auto');
      expect(before.scrollHeight).toBeGreaterThan(before.clientHeight+100);
      expect(before.trayBottom).toBeLessThanOrEqual(height+2);
      if(mobile){
        await list.evaluate(node=>{node.scrollTop=node.scrollHeight;});
      }else{
        const bounds=await list.boundingBox();
        await page.mouse.move(bounds.x+bounds.width/2,bounds.y+Math.min(bounds.height/2,80));
        await page.mouse.wheel(0,10000);
      }
      await expect.poll(()=>list.evaluate(node=>node.scrollTop)).toBeGreaterThan(0);
      await expect(last).toBeInViewport();
      await expect(close).toBeInViewport();
      const after=await page.evaluate(()=>({
        closeTop:document.getElementById('closeTray').getBoundingClientRect().top,
        pageScroll:scrollY
      }));
      expect(Math.abs(after.closeTop-before.closeTop)).toBeLessThan(2);
      expect(Math.abs(after.pageScroll-before.pageScroll)).toBeLessThan(2);

      // Keyboard focus must also bring the final actions into the scrollport.
      await list.evaluate(node=>{node.scrollTop=0;});
      await last.focus();
      await expect(last).toBeInViewport();
      await expect.poll(()=>list.evaluate(node=>node.scrollTop)).toBeGreaterThan(0);
      const remove=rows.last().getByRole('button',{name:'Remove',exact:true});
      await page.keyboard.press('Tab');
      await expect(remove).toBeFocused();
      await page.keyboard.press('Tab');
      await expect(close).toBeFocused();

      if(mobile)await last.tap();else await last.click();
      await expect(tray).toHaveAttribute('aria-hidden','true');
      await expect(page.locator('#readerContent .verse-focused')).toHaveAttribute('data-verse-number','24');
      await expect(page.locator('#readerContent .verse-focused')).toHaveAttribute('data-book-id','john');
      expect(await page.evaluate(()=>UserData.savedVerses.load())).toEqual(entries);
      await expect(page.locator('#savedCount')).toHaveText('24');
    });
  });
}

test('empty Saved Verses drawer keeps its help text and Close button visible',async({page})=>{
  await page.setViewportSize({width:320,height:568});
  await page.goto('/');
  await page.locator('.saved-pill').click();
  await expect(page.locator('#trayEmpty')).toBeVisible();
  await expect(page.locator('#closeTray')).toBeInViewport();
  await expect(page.locator('#trayEmpty')).toBeInViewport();
  await page.keyboard.press('Escape');
  await expect(page.locator('#tray')).toHaveAttribute('aria-hidden','true');
  await expect(page.locator('.saved-pill')).toBeFocused();
});
