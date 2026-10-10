const { test, expect } = require('@playwright/test');

test.beforeEach(async ({ page }) => {
  await page.addInitScript(() => {
    window.addEventListener('DOMContentLoaded', () => initializeBibleExperience());
  });
  await page.goto('/');
});

test('Reader starts with one compact primary toolbar and a closed More disclosure', async ({ page }) => {
  const reader = page.locator('#view-reader');
  await expect(reader.locator('.reader-toolbar')).toHaveCount(1);
  await expect(reader.locator('#bookSelect')).toBeVisible();
  await expect(reader.locator('#chapterSelect')).toBeVisible();
  await expect(reader.locator('.reader-toolbar > #verseSelect')).toBeVisible();
  await expect(reader.locator('#readerTranslation')).toBeVisible();
  await expect(reader.locator('#readAloudPlay')).toHaveText('Play');
  await expect(reader.locator('#readAloudPause, #readAloudStop')).toHaveCount(0);
  await expect(reader.getByRole('button', { name:/^Pause|^Resume|^Stop reading aloud/ })).toHaveCount(0);
  await expect(reader.locator('#readerMoreTrigger')).toHaveAttribute('aria-expanded', 'false');
  await expect(reader.locator('#readerSecondaryControls')).toBeHidden();
  await expect(reader.locator('.reader-toolbar > #fullscreenBtn')).toHaveCount(1);
  await expect(page.locator('.bs-nav > #offlineBiblesTrigger')).toHaveCount(1);
  expect(await reader.locator('.reader-toolbar').evaluate(toolbar =>
    [...toolbar.children].filter(element => element.matches('select, button, .reader-controls-top'))
      .map(element => element.id || 'chapter-group')
  )).toEqual(['bookSelect', 'chapter-group', 'verseSelect', 'readerTranslation', 'readAloudPlay', 'readerMoreTrigger', 'fullscreenBtn']);
  for(const id of ['bookSelect', 'chapterSelect', 'verseSelect', 'readerTranslation']){
    await expect(reader.locator(`#${id}`)).toHaveCount(1);
  }
  await expect(reader.locator('#readAloudPlay')).toHaveCount(1);
  await reader.locator('#readerMoreTrigger').focus();
  await page.keyboard.press('Tab');
  expect(await page.evaluate(() => document.activeElement.closest('#readerSecondaryControls'))).toBeNull();
});

test('More opens secondary controls and closes them with the trigger', async ({ page }) => {
  const more = page.locator('#readerMoreTrigger');
  await more.click();
  await expect(more).toHaveAttribute('aria-expanded', 'true');
  await expect(page.locator('#verseSelect')).toBeVisible();
  await expect(page.locator('#readerSecondaryControls #verseSelect')).toHaveCount(0);
  await expect(page.locator('#readerVerseNavigation [data-reader-action="previous-verse"]')).toBeVisible();
  await expect(page.locator('#readerVerseNavigation [data-reader-action="next-verse"]')).toBeVisible();
  await expect(page.locator('#readerVerseNavigation')).toHaveCSS('position', 'static');
  await expect(page.locator('[data-voice-command-button]')).toBeVisible();
  await expect(page.locator('#readAloudVoice')).toBeVisible();
  await expect(page.locator('#readAloudSpeed')).toBeVisible();
  await more.click();
  await expect(more).toHaveAttribute('aria-expanded', 'false');
  await expect(page.locator('#readerSecondaryControls')).toBeHidden();
});

test('Verse selection works from the primary toolbar while More stays closed at 320px', async ({ page }) => {
  await page.setViewportSize({width:320, height:700});
  await page.locator('#verseSelect').selectOption('2');
  await expect(page.locator('#readerContent [data-verse-number="2"]')).toHaveClass(/verse-focused/);
  await expect(page.locator('#readerMoreTrigger')).toHaveAttribute('aria-expanded', 'false');
  await expect(page.locator('#readerSecondaryControls')).toBeHidden();
});

test('More remains immediately usable after deep Reader scrolling at three widths', async ({ page }) => {
  for(const width of [1440, 480, 320]){
    await page.setViewportSize({width, height:700});
    await page.locator('#readerContent [data-verse-number="45"]').scrollIntoViewIfNeeded();
    const before = await page.evaluate(() => window.scrollY);
    await page.locator('#readerMoreTrigger').click();
    const geometry = await page.evaluate(() => {
      const toolbar = document.querySelector('.reader-toolbar').getBoundingClientRect();
      const panel = document.getElementById('readerSecondaryControls').getBoundingClientRect();
      const primaryBottom = Math.max(...['bookSelect', 'chapterSelect', 'verseSelect', 'readerTranslation', 'readAloudPlay', 'readerMoreTrigger', 'fullscreenBtn']
        .map(id => document.getElementById(id).getBoundingClientRect().bottom));
      return {toolbarTop:toolbar.top, toolbarBottom:toolbar.bottom, panelTop:panel.top, panelBottom:panel.bottom,
        primaryBottom, navBottom:document.querySelector('nav').getBoundingClientRect().bottom,
        overflow:[...document.querySelectorAll('#readerSecondaryControls *')].some(element => {
          const rect = element.getBoundingClientRect();
          return rect.left < -1 || rect.right > innerWidth + 1;
        })};
    });
    expect(geometry.toolbarTop).toBeGreaterThanOrEqual(geometry.navBottom - 1);
    expect(geometry.panelTop).toBeGreaterThanOrEqual(geometry.primaryBottom - 1);
    expect(geometry.panelBottom).toBeLessThanOrEqual(Math.min(geometry.toolbarBottom + 1, 700));
    expect(geometry.overflow).toBe(false);
    await page.locator('#readAloudSpeed').selectOption('1.25');
    await page.locator('#readerMoreTrigger').click();
    expect(Math.abs(await page.evaluate(() => window.scrollY) - before)).toBeLessThan(100);
  }
});

test('Escape closes More from its trigger and keeps focus there', async ({ page }) => {
  const more = page.locator('#readerMoreTrigger');
  await more.click();
  await more.press('Escape');
  await expect(more).toHaveAttribute('aria-expanded', 'false');
  await expect(page.locator('#readerSecondaryControls')).toBeHidden();
  await expect(more).toBeFocused();
});

test('Escape closes More from inside its panel and returns focus', async ({ page }) => {
  const more = page.locator('#readerMoreTrigger');
  await more.click();
  await page.locator('#readAloudVoice').focus();
  await page.keyboard.press('Escape');
  await expect(more).toHaveAttribute('aria-expanded', 'false');
  await expect(page.locator('#readerSecondaryControls')).toBeHidden();
  await expect(more).toBeFocused();
});

test('Reader toolbar fits 1440, 480, and 320 pixels with Scripture higher on mobile', async ({ page }) => {
  for(const width of [1440, 480, 320]){
    await page.setViewportSize({ width, height:900 });
    await page.locator('#readerContent .reader-verse').first().waitFor();
    const geometry = await page.evaluate(() => {
      const view = document.getElementById('view-reader').getBoundingClientRect();
      const toolbar = document.querySelector('.reader-toolbar').getBoundingClientRect();
      const positions = ['#bookSelect', '.reader-controls-top', '#verseSelect', '#readerTranslation', '#readAloudPlay', '#readerMoreTrigger', '#fullscreenBtn']
        .map(selector => Math.round(document.querySelector(selector).getBoundingClientRect().top));
      const verse = document.querySelector('#readerContent .reader-verse').getBoundingClientRect();
      const overflow = [...document.querySelectorAll('#view-reader *')].filter(element => {
        const bounds = element.getBoundingClientRect();
        return bounds.right > innerWidth + 1 || bounds.left < -1;
      }).map(element => element.id || element.className);
      return { toolbarHeight:toolbar.height, firstVerseOffset:verse.top - view.top, overflow, positions };
    });
    expect(geometry.overflow, `${width}px Reader overflow`).toEqual([]);
    expect(geometry.toolbarHeight).toBeLessThanOrEqual(width === 1440 ? 64 : 110);
    if(width === 1440) expect(new Set(geometry.positions).size).toBe(1);
    else {
      expect(new Set(geometry.positions.slice(0, 3)).size).toBe(1);
      expect(new Set(geometry.positions.slice(3)).size).toBe(1);
      expect(geometry.positions[3]).toBeGreaterThan(geometry.positions[0]);
    }
    expect(geometry.firstVerseOffset).toBeLessThan(width === 320 ? 500 : width === 480 ? 450 : 500);
  }
});

test('the same Reader toolbar sticks below the measured site navigation at three widths', async ({ page }) => {
  for(const width of [1440, 480, 320]){
    await page.setViewportSize({width, height:900});
    await page.evaluate(() => { window.scrollTo(0, 0); window.__readerToolbar = document.querySelector('.reader-toolbar'); });
    const originalHeight = await page.locator('.reader-toolbar').evaluate(element => element.getBoundingClientRect().height);
    await page.locator('#readerContent [data-verse-number="20"]').scrollIntoViewIfNeeded();
    const geometry = await page.evaluate(() => {
      const nav = document.querySelector('nav').getBoundingClientRect();
      const toolbar = document.querySelector('.reader-toolbar');
      const bounds = toolbar.getBoundingClientRect();
      const verse = document.querySelector('#readerContent [data-verse-number="20"]').getBoundingClientRect();
      return {
        sameNode:toolbar === window.__readerToolbar,
        toolbarCount:document.querySelectorAll('.reader-toolbar').length,
        position:getComputedStyle(toolbar).position,
        navBottom:nav.bottom,
        stackBottom:nav.bottom + parseFloat(getComputedStyle(document.getElementById('bibleApp')).getPropertyValue('--reader-tabs-height')),
        toolbarTop:bounds.top,
        toolbarBottom:bounds.bottom,
        toolbarHeight:bounds.height,
        verseTop:verse.top,
        overflow:[...document.querySelectorAll('#view-reader *')].some(element => {
          const rect = element.getBoundingClientRect();
          return rect.right > innerWidth + 1 || rect.left < -1;
        })
      };
    });
    expect(geometry.sameNode).toBe(true);
    expect(geometry.toolbarCount).toBe(1);
    expect(geometry.position).toBe('sticky');
    expect(geometry.toolbarTop).toBeGreaterThanOrEqual(geometry.stackBottom - 1);
    expect(geometry.toolbarTop).toBeLessThanOrEqual(geometry.stackBottom + 1);
    expect(geometry.toolbarHeight).toBeCloseTo(originalHeight, 0);
    expect(geometry.verseTop).toBeGreaterThan(geometry.toolbarBottom);
    expect(geometry.overflow).toBe(false);
  }
});

test('More and focused verse and Word Study targets remain clear of the sticky toolbar', async ({ page }) => {
  await page.locator('#readerContent [data-verse-number="20"]').scrollIntoViewIfNeeded();
  const more = page.locator('#readerMoreTrigger');
  await more.focus();
  await expect(more).toBeFocused();
  await more.click();
  await page.locator('#verseSelect').selectOption('20');
  await expect.poll(() => page.evaluate(() => {
    const toolbar = document.querySelector('.reader-toolbar').getBoundingClientRect();
    const verse = document.querySelector('#readerContent [data-verse-number="20"]').getBoundingClientRect();
    return verse.top > toolbar.bottom + 8;
  })).toBe(true);
  await page.locator('#readerContent [data-word-study-term]').first().click();
  await expect(page.locator('#wordStudyHeading')).toBeFocused();
  await expect.poll(() => page.evaluate(() => {
    const toolbar = document.querySelector('.reader-toolbar').getBoundingClientRect();
    const heading = document.getElementById('wordStudyHeading').getBoundingClientRect();
    return heading.top > toolbar.bottom + 8;
  })).toBe(true);
});

test('Compare and Plan hide the Reader toolbar and returning restores sticky behavior', async ({ page }) => {
  await page.locator('#readerContent [data-verse-number="20"]').scrollIntoViewIfNeeded();
  const toolbar = page.locator('.reader-toolbar');
  await page.getByRole('button', {name:'Compare', exact:true}).click();
  await expect(toolbar).toBeHidden();
  await page.getByRole('button', {name:'Plan', exact:true}).click();
  await expect(toolbar).toBeHidden();
  await page.getByRole('button', {name:'Reader', exact:true}).click();
  await page.locator('#readerContent [data-verse-number="20"]').scrollIntoViewIfNeeded();
  await expect(toolbar).toBeVisible();
  expect(await toolbar.evaluate(element => getComputedStyle(element).position)).toBe('sticky');
});

test('one playback button changes from Play to Stop and back', async ({ page }) => {
  await page.addInitScript(() => {
    window.SpeechSynthesisUtterance = function(text){ this.text = text; };
    Object.defineProperty(window, 'speechSynthesis', { configurable:true, value:{
      speak(){}, cancel(){}, pause(){}, resume(){}, getVoices(){ return []; }
    }});
  });
  await page.reload();
  const control = page.locator('#readAloudPlay');
  await expect(control).toHaveAccessibleName('Play reading aloud');
  await control.click();
  await expect(control).toHaveText('Stop');
  await expect(control).toHaveAccessibleName('Stop reading aloud');
  const cursor = await page.evaluate(() => getPlaybackResumeCursor());
  await control.click();
  await expect(control).toHaveText('Play');
  await expect(control).toHaveAccessibleName('Play reading aloud');
  expect(await page.evaluate(() => getPlaybackResumeCursor())).toEqual(cursor);
  await control.click();
  await expect(control).toHaveText('Stop');
});

test('voice-paused playback shows Play and resumes the same session', async ({ page }) => {
  await page.addInitScript(() => {
    window.__speechCalls = { speak:0, resume:0 };
    window.SpeechSynthesisUtterance = function(text){ this.text = text; };
    Object.defineProperty(window, 'speechSynthesis', { configurable:true, value:{
      speak(){ window.__speechCalls.speak++; }, cancel(){}, pause(){},
      resume(){ window.__speechCalls.resume++; }, getVoices(){ return []; }
    }});
  });
  await page.reload();
  const control = page.locator('#readAloudPlay');
  await control.click();
  await page.evaluate(() => BibleSpeech.pauseResume());
  await expect(control).toHaveText('Play');
  await expect(control).toHaveAccessibleName('Play reading aloud');
  const spoken = await page.evaluate(() => window.__speechCalls.speak);
  await control.click();
  await expect(control).toHaveText('Stop');
  expect(await page.evaluate(() => window.__speechCalls)).toEqual({ speak:spoken, resume:1 });
});
