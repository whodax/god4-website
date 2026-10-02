const {test, expect} = require('@playwright/test');

async function openReader(page){
  await page.addInitScript(() => window.addEventListener('DOMContentLoaded', () => initializeBibleExperience()));
  await page.goto('/');
}

test('whole document, Search, and Saved Verses fit narrow viewports', async ({page}) => {
  await page.goto('/');
  for(const width of [320, 375, 480]){
    await page.setViewportSize({width, height:800});
    const closed = await page.evaluate(() => {
      const root = document.documentElement;
      return {
        width:root.clientWidth,
        scrollWidth:root.scrollWidth,
        search:document.querySelector('.search-box').getBoundingClientRect().toJSON(),
        searchChildren:[...document.querySelector('.search-box').children].map(element => ({name:element.id || element.className, rect:element.getBoundingClientRect().toJSON()})),
        tray:document.getElementById('tray').getBoundingClientRect().toJSON(),
        overflowing:[...document.querySelectorAll('body *')].filter(element => {
          const rect = element.getBoundingClientRect();
          return rect.right > innerWidth + 1 && rect.left < root.scrollWidth;
        }).slice(0, 12).map(element => element.id || element.className)
      };
    });
    expect(closed.scrollWidth, `${width}px closed: ${JSON.stringify(closed)}`).toBeLessThanOrEqual(closed.width);
    await page.locator('.saved-pill').click();
    await expect(page.locator('#tray')).toHaveAttribute('aria-hidden', 'false');
    await expect(page.locator('#closeTray')).toBeFocused();
    const open = await page.evaluate(() => ({
      width:document.documentElement.clientWidth,
      scrollWidth:document.documentElement.scrollWidth,
      tray:document.getElementById('tray').getBoundingClientRect().toJSON()
    }));
    expect(open.scrollWidth, `${width}px open: ${JSON.stringify(open)}`).toBeLessThanOrEqual(open.width);
    expect(open.tray.left).toBeGreaterThanOrEqual(-1);
    await page.locator('#closeTray').press('Escape');
    await expect(page.locator('#tray')).toHaveAttribute('aria-hidden', 'true');
    await expect(page.locator('.saved-pill')).toBeFocused();
  }
});

test('Search and a populated Saved Verses tray remain usable at 320px', async ({page}) => {
  await page.setViewportSize({width:320, height:800});
  await openReader(page);
  await page.locator('#readerContent .reader-verse').first().waitFor();
  await page.locator('#searchInput').fill('faith');
  await page.locator('.search-box > button:not(#searchClear)').click();
  await expect(page.locator('#results .result-card').first()).toBeVisible();
  await page.locator('#searchTranslationToggle').click();
  await expect(page.locator('#searchTranslationMenu')).toBeVisible();
  expect(await page.locator('#searchTranslationMenu').evaluate(element => {
    const rect = element.getBoundingClientRect();
    return rect.left >= 0 && rect.right <= innerWidth;
  })).toBe(true);
  await page.locator('#searchTranslationToggle').click();
  await page.locator('#heroFav').click();
  await page.locator('.saved-pill').click();
  await expect(page.locator('#trayList .saved-verse-row')).toHaveCount(1);
  await page.locator('#closeTray').press('Escape');
  expect(await page.evaluate(() => document.documentElement.scrollWidth <= document.documentElement.clientWidth)).toBe(true);
});

test('Reader toolbar and More reflow from desktop through 320px', async ({page}) => {
  await openReader(page);
  for(const width of [1440, 1024, 768, 480, 375, 320]){
    await page.setViewportSize({width, height:800});
    await page.locator('#readerContent [data-verse-number="45"]').scrollIntoViewIfNeeded();
    const geometry = await page.evaluate(() => {
      const toolbar = document.querySelector('.reader-toolbar');
      const controls = ['bookSelect', 'chapterSelect', 'verseSelect', 'readerTranslation', 'readAloudPlay', 'readerMoreTrigger', 'fullscreenBtn']
        .map(id => document.getElementById(id).getBoundingClientRect());
      return {rows:new Set(controls.map(rect => Math.round(rect.top))).size,
        overflow:controls.some(rect => rect.left < 0 || rect.right > innerWidth),
        toolbarHeight:toolbar.getBoundingClientRect().height};
    });
    expect(geometry.rows).toBe(width > 620 ? 1 : 2);
    expect(geometry.overflow).toBe(false);
    await page.locator('#readerMoreTrigger').click();
    expect(await page.evaluate(() => {
      const panel = document.getElementById('readerSecondaryControls').getBoundingClientRect();
      return panel.left >= 0 && panel.right <= innerWidth && panel.bottom < innerHeight;
    })).toBe(true);
    await page.locator('#readerMoreTrigger').click();
  }
});

test('200 percent equivalent reflow keeps Reader, Word Study, Search, Saved, and Offline controls usable', async ({page}) => {
  await page.setViewportSize({width:320, height:800});
  await openReader(page);
  await page.locator('#readerMoreTrigger').click();
  await expect(page.locator('#readAloudSpeed')).toBeVisible();
  await page.locator('#readerMoreTrigger').click();
  await page.locator('#readerContent [data-word-study-term]').first().click();
  await expect(page.locator('#wordStudyHeading')).toBeFocused();
  await expect(page.locator('#wordStudyPanel')).toBeVisible();
  await page.locator('#wordStudyHeading').press('Escape');
  await page.locator('#fullscreenBtn').click();
  await page.locator('#readerMoreTrigger').click();
  expect(await page.evaluate(() => {
    const panel = document.getElementById('readerSecondaryControls').getBoundingClientRect();
    const toolbar = document.querySelector('.reader-toolbar').getBoundingClientRect();
    return panel.right <= innerWidth && panel.bottom < innerHeight && innerHeight - toolbar.bottom > 250;
  })).toBe(true);
  await page.locator('#readerMoreTrigger').click();
  await page.locator('#fullscreenBtn').click();
  await page.locator('#offlineBiblesTrigger').click();
  await expect(page.locator('#offlineBiblesDialog')).toBeVisible();
  expect(await page.locator('#offlineBiblesDialog').evaluate(element => {
    const rect = element.getBoundingClientRect();
    return rect.left >= 0 && rect.right <= innerWidth && element.scrollWidth <= element.clientWidth;
  })).toBe(true);
  await page.locator('#offlineBiblesDialog').press('Escape');
  await page.locator('.saved-pill').click();
  await expect(page.locator('#closeTray')).toBeFocused();
  await page.locator('#closeTray').press('Escape');
  await page.locator('#searchInput').focus();
  await expect(page.locator('#searchInput')).toBeFocused();
  expect(await page.evaluate(() => document.documentElement.scrollWidth <= document.documentElement.clientWidth)).toBe(true);
});

test('Reader primary controls follow native keyboard order and hidden More controls stay out of Tab order', async ({page}) => {
  await openReader(page);
  await page.locator('#chapterSelect').selectOption('2');
  const order = ['bookSelect', 'previous', 'chapterSelect', 'next', 'verseSelect', 'readerTranslation', 'readAloudPlay', 'readerMoreTrigger', 'fullscreenBtn'];
  await page.locator('#bookSelect').focus();
  for(let index = 0; index < order.length; index++){
    const actual = await page.evaluate(() => document.activeElement.id || document.activeElement.getAttribute('data-reader-action'));
    expect(actual).toBe(order[index]);
    if(index + 1 < order.length) await page.keyboard.press('Tab');
  }
  await expect(page.locator('#readerSecondaryControls')).toBeHidden();
  await page.locator('#readerMoreTrigger').click();
  await page.locator('#readerMoreTrigger').press('Tab');
  await expect(page.locator('#fullscreenBtn')).toBeFocused();
  await page.keyboard.press('Tab');
  await expect(page.locator('#readerVerseNavigation [data-reader-action="next-verse"]')).toBeFocused();
  await page.keyboard.press('Escape');
  await expect(page.locator('#readerMoreTrigger')).toBeFocused();
});

test('Reader semantics remain unique and status regions stay available', async ({page}) => {
  await openReader(page);
  const ids = ['bookSelect', 'chapterSelect', 'readerTranslation', 'readAloudPlay', 'readerMoreTrigger',
    'fullscreenBtn', 'verseSelect', 'readAloudVoice', 'readAloudSpeed', 'readerContent'];
  expect(await page.evaluate(ids => ids.map(id => document.querySelectorAll(`#${id}`).length), ids)).toEqual(ids.map(() => 1));
  await expect(page.locator('.reader-toolbar')).toHaveAttribute('role', 'group');
  await expect(page.locator('.reader-controls-top')).toHaveAttribute('aria-label', 'Chapter navigation');
  await expect(page.locator('#readerMoreTrigger')).toHaveAttribute('aria-controls', 'readerSecondaryControls');
  await expect(page.locator('#readerMoreTrigger')).toHaveAttribute('aria-expanded', 'false');
  await expect(page.locator('#voiceStatusTop')).toHaveAttribute('aria-live', 'polite');
  await expect(page.locator('#readAloudStatus')).toHaveAttribute('aria-live', 'polite');
  await expect(page.locator('#fsOverlay, #fsContent')).toHaveCount(0);
  await expect(page.locator('#readerContent')).toHaveCount(1);
});

test('focused per-verse controls stay clear of sticky toolbars in normal and fullscreen Reader', async ({page}) => {
  await openReader(page);
  const speak = page.locator('#readerContent [data-verse-number="45"] .verse-speak');
  await page.evaluate(() => window.scrollTo(0, 0));
  await speak.focus();
  await expect(speak).toBeFocused();
  expect(await page.evaluate(() => {
    const toolbar = document.querySelector('.reader-toolbar').getBoundingClientRect();
    const target = document.querySelector('#readerContent [data-verse-number="45"] .verse-speak').getBoundingClientRect();
    return target.top > toolbar.bottom && target.bottom < innerHeight;
  })).toBe(true);
  await page.locator('#fullscreenBtn').click();
  await page.locator('#view-reader').evaluate(shell => { shell.scrollTop = 0; });
  await speak.focus();
  await expect(speak).toBeFocused();
  expect(await page.evaluate(() => {
    const toolbar = document.querySelector('.reader-toolbar').getBoundingClientRect();
    const target = document.querySelector('#readerContent [data-verse-number="45"] .verse-speak').getBoundingClientRect();
    return target.top > toolbar.bottom && target.bottom < innerHeight;
  })).toBe(true);
});
