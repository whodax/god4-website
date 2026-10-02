const { test, expect } = require('@playwright/test');

async function openReader(page){
  await page.addInitScript(() => {
    window.addEventListener('DOMContentLoaded', () => initializeBibleExperience());
  });
  await page.goto('/');
}

test('fullscreen keeps the exact toolbar and passage nodes with unique Reader controls', async ({ page }) => {
  await openReader(page);
  await page.evaluate(() => {
    window.__readerNodes = {
      toolbar: document.querySelector('.reader-toolbar'),
      passage: document.getElementById('readerContent'),
      navigation: document.getElementById('readerVerseNavigation')
    };
  });
  const shell = page.locator('#view-reader');
  const button = page.locator('#fullscreenBtn');
  await expect(button).toHaveAccessibleName('Enter Fullscreen');
  await button.click();
  await expect(shell).toHaveClass(/reader-fullscreen/);
  await expect(shell).toHaveAttribute('aria-modal', 'true');
  await expect(button).toHaveAccessibleName('Exit Fullscreen');
  await expect(button).toHaveAttribute('aria-pressed', 'true');
  expect(await page.evaluate(() => {
    const ids = ['bookSelect', 'chapterSelect', 'readerTranslation', 'readAloudPlay', 'readerMoreTrigger', 'fullscreenBtn', 'readerContent'];
    return {
      same: window.__readerNodes.toolbar === document.querySelector('.reader-toolbar') &&
        window.__readerNodes.passage === document.getElementById('readerContent') &&
        window.__readerNodes.navigation === document.getElementById('readerVerseNavigation'),
      counts: ids.map(id => document.querySelectorAll(`#${id}`).length),
      oldPassage: document.querySelectorAll('#fsOverlay, #fsContent').length
    };
  })).toEqual({same:true, counts:Array(7).fill(1), oldPassage:0});
  await button.click();
  await expect(shell).not.toHaveClass(/reader-fullscreen/);
  await expect(button).toHaveAccessibleName('Enter Fullscreen');
});

test('fullscreen keeps navigation, translation, More, and verse controls in one shell', async ({ page }) => {
  await openReader(page);
  await page.locator('#fullscreenBtn').click();
  await page.locator('#bookSelect').selectOption('psalms');
  await page.locator('#chapterSelect').selectOption('2');
  await page.locator('#readerTranslation').selectOption('web');
  await expect(page.locator('#readerContent h2')).toHaveText('Psalms 2');
  await expect(page.locator('#view-reader')).toHaveClass(/reader-fullscreen/);
  const more = page.locator('#readerMoreTrigger');
  await more.click();
  await expect(page.locator('#readerSecondaryControls')).toBeVisible();
  await expect(page.locator('[data-voice-command-button]')).toBeVisible();
  await page.locator('#readAloudSpeed').selectOption('1.25');
  await page.locator('#verseSelect').selectOption('2');
  await expect(page.locator('#readerContent [data-verse-number="2"]')).toHaveClass(/verse-focused/);
  await page.locator('[data-reader-action="next-verse"]').click();
  await expect(page.locator('#verseSelect')).toHaveValue('3');
  await more.click();
  await expect(page.locator('#readerSecondaryControls')).toBeHidden();
});

test('fullscreen traps focus, restores background attributes, and gives More first Escape', async ({ page }) => {
  await openReader(page);
  const header = page.locator('.bs-header');
  const button = page.locator('#fullscreenBtn');
  await button.click();
  await expect(button).toBeFocused();
  await expect(header).toHaveAttribute('inert', '');
  await expect(header).toHaveAttribute('aria-hidden', 'true');
  const first = page.locator('#bookSelect');
  const last = page.locator('#readerContent .verse-speak').last();
  await first.focus();
  await first.press('Shift+Tab');
  await expect(last).toBeFocused();
  await last.press('Tab');
  await expect(first).toBeFocused();
  await page.locator('#readerMoreTrigger').click();
  await page.locator('#readAloudSpeed').focus();
  await page.keyboard.press('Escape');
  await expect(page.locator('#readerMoreTrigger')).toHaveAttribute('aria-expanded', 'false');
  await expect(page.locator('#readerMoreTrigger')).toBeFocused();
  await expect(page.locator('#view-reader')).toHaveClass(/reader-fullscreen/);
  await page.keyboard.press('Escape');
  await expect(page.locator('#view-reader')).not.toHaveClass(/reader-fullscreen/);
  await expect(button).toBeFocused();
  await expect(header).not.toHaveAttribute('inert', '');
  await expect(header).not.toHaveAttribute('aria-hidden', 'true');
});

test('fullscreen restores each background sibling’s prior accessibility state', async ({ page }) => {
  await openReader(page);
  await page.evaluate(() => {
    const header = document.querySelector('.bs-header');
    const compare = document.getElementById('view-compare');
    header.setAttribute('aria-hidden', 'false');
    compare.inert = true;
    compare.setAttribute('aria-hidden', 'false');
  });
  await page.locator('#fullscreenBtn').click();
  await expect(page.locator('.bs-header')).toHaveAttribute('aria-hidden', 'true');
  await expect(page.locator('#view-compare')).toHaveAttribute('aria-hidden', 'true');
  await page.locator('#fullscreenBtn').click();
  expect(await page.evaluate(() => ({
    headerAria:document.querySelector('.bs-header').getAttribute('aria-hidden'),
    headerInert:document.querySelector('.bs-header').inert,
    compareAria:document.getElementById('view-compare').getAttribute('aria-hidden'),
    compareInert:document.getElementById('view-compare').inert
  }))).toEqual({headerAria:'false', headerInert:false, compareAria:'false', compareInert:true});
});

test('Word Study handles Escape inside fullscreen before the shell exits', async ({ page }) => {
  await openReader(page);
  await page.locator('#fullscreenBtn').click();
  await page.locator('#readerContent [data-word-study-term]').first().click();
  await expect(page.locator('#wordStudyHeading')).toBeFocused();
  expect(await page.evaluate(() => {
    const toolbar = document.querySelector('.reader-toolbar').getBoundingClientRect();
    const heading = document.getElementById('wordStudyHeading').getBoundingClientRect();
    return heading.top > toolbar.bottom && heading.bottom < innerHeight;
  })).toBe(true);
  await page.locator('#wordStudyHeading').press('Escape');
  await expect(page.locator('#wordStudyPanel')).toBeHidden();
  await expect(page.locator('#view-reader')).toHaveClass(/reader-fullscreen/);
  await page.keyboard.press('Escape');
  await expect(page.locator('#view-reader')).not.toHaveClass(/reader-fullscreen/);
});

test('fullscreen toolbar stays on the single scroll surface at desktop, 480px, and 320px', async ({ page }) => {
  await openReader(page);
  for(const width of [1440, 480, 320]){
    await page.setViewportSize({width, height:700});
    await page.locator('#fullscreenBtn').click();
    await page.locator('#view-reader').evaluate(shell => { shell.scrollTop = shell.scrollHeight; });
    const geometry = await page.evaluate(() => {
      const shell = document.getElementById('view-reader');
      const toolbar = shell.querySelector('.reader-toolbar');
      const a = shell.getBoundingClientRect();
      const b = toolbar.getBoundingClientRect();
      const primaryRows = ['#bookSelect', '.reader-controls-top', '#readerTranslation', '#readAloudPlay', '#readerMoreTrigger', '#fullscreenBtn']
        .map(selector => Math.round(document.querySelector(selector).getBoundingClientRect().top));
      return {
        shellScroll:shell.scrollTop,
        toolbarTop:b.top,
        toolbarBottom:b.bottom,
        shellTop:a.top,
        shellRight:a.right,
        rows:new Set(primaryRows).size,
        overflow:[...shell.querySelectorAll('*')].some(element => {
          const rect = element.getBoundingClientRect();
          return rect.left < -1 || rect.right > innerWidth + 1;
        })
      };
    });
    expect(geometry.shellScroll).toBeGreaterThan(0);
    expect(geometry.toolbarTop).toBeGreaterThanOrEqual(geometry.shellTop - 1);
    expect(geometry.toolbarTop).toBeLessThanOrEqual(geometry.shellTop + (width === 1440 ? 21 : 13));
    expect(geometry.shellRight).toBe(width);
    expect(geometry.rows).toBe(width === 1440 ? 1 : 2);
    expect(geometry.overflow).toBe(false);
    await page.locator('#readerMoreTrigger').click();
    expect(await page.evaluate(() => [...document.querySelectorAll('#readerSecondaryControls *')].every(element => {
      const rect = element.getBoundingClientRect();
      return rect.left >= -1 && rect.right <= innerWidth + 1;
    }))).toBe(true);
    await page.locator('#readerMoreTrigger').click();
    await page.locator('#fullscreenBtn').click();
  }
});

test('More remains directly below the fullscreen toolbar after deep shell scrolling at three widths', async ({ page }) => {
  await openReader(page);
  for(const width of [1440, 480, 320]){
    await page.setViewportSize({width, height:700});
    await page.locator('#fullscreenBtn').click();
    await page.locator('#view-reader').evaluate(shell => { shell.scrollTop = shell.scrollHeight; });
    const beforeOpen = await page.locator('#view-reader').evaluate(shell => shell.scrollTop);
    await page.locator('#readerMoreTrigger').click();
    expect(await page.locator('#view-reader').evaluate(shell => shell.scrollTop)).toBeGreaterThan(beforeOpen / 2);
    const geometry = await page.evaluate(() => {
      const shell = document.getElementById('view-reader');
      const toolbar = shell.querySelector('.reader-toolbar').getBoundingClientRect();
      const panel = document.getElementById('readerSecondaryControls').getBoundingClientRect();
      const primaryBottom = Math.max(...['bookSelect', 'chapterSelect', 'readerTranslation', 'readAloudPlay', 'readerMoreTrigger', 'fullscreenBtn']
        .map(id => document.getElementById(id).getBoundingClientRect().bottom));
      return {toolbarTop:toolbar.top, toolbarBottom:toolbar.bottom, panelTop:panel.top, panelBottom:panel.bottom,
        primaryBottom, shellTop:shell.getBoundingClientRect().top,
        overflow:[...document.querySelectorAll('#readerSecondaryControls *')].some(element => {
          const rect = element.getBoundingClientRect();
          return rect.left < -1 || rect.right > innerWidth + 1;
        })};
    });
    expect(geometry.toolbarTop).toBeGreaterThanOrEqual(geometry.shellTop - 1);
    expect(geometry.panelTop).toBeGreaterThanOrEqual(geometry.primaryBottom - 1);
    expect(geometry.panelBottom).toBeLessThanOrEqual(Math.min(geometry.toolbarBottom + 1, 700));
    expect(geometry.overflow).toBe(false);
    await page.locator('#readAloudSpeed').selectOption('1.25');
    const previousVerse = Number(await page.locator('#verseSelect').inputValue());
    await page.locator('#readerVerseNavigation [data-reader-action="next-verse"]').click();
    await expect(page.locator('#verseSelect')).toHaveValue(String(previousVerse + 1));
    await page.locator('#readerMoreTrigger').click();
    await expect(page.locator('#view-reader')).toHaveClass(/reader-fullscreen/);
    await page.locator('#fullscreenBtn').click();
  }
});

test('mobile Fullscreen icon changes visually with the same control and accessible name', async ({ page }) => {
  await openReader(page);
  await page.setViewportSize({width:320, height:700});
  const button = page.locator('#fullscreenBtn');
  const inactiveIcon = await button.evaluate(element => getComputedStyle(element, '::after').content);
  await expect(button).toHaveAccessibleName('Enter Fullscreen');
  await button.click();
  const activeIcon = await button.evaluate(element => getComputedStyle(element, '::after').content);
  expect(activeIcon).not.toBe(inactiveIcon);
  await expect(button).toHaveAccessibleName('Exit Fullscreen');
  await button.click();
  await expect(button).toHaveAccessibleName('Enter Fullscreen');
});

test('fullscreen Play and Stop share the resume cursor across a chapter boundary', async ({ page }) => {
  await page.addInitScript(() => {
    window.__utterances = [];
    window.SpeechSynthesisUtterance = function(text){ this.text = text; };
    Object.defineProperty(window, 'speechSynthesis', {configurable:true, value:{
      speak(utterance){ window.__utterances.push(utterance); if(utterance.onstart) utterance.onstart(); },
      cancel(){}, pause(){}, resume(){}, getVoices(){ return []; }
    }});
  });
  await openReader(page);
  await page.locator('#readerMoreTrigger').click();
  await page.locator('#verseSelect').selectOption('51');
  await page.locator('#readerMoreTrigger').click();
  await page.locator('#readAloudPlay').click();
  await page.locator('#fullscreenBtn').click();
  await expect(page.locator('#readAloudPlay')).toHaveText('Stop');
  const passage = await page.locator('#readerContent').elementHandle();
  await page.evaluate(() => window.__utterances[0].onend());
  await expect(page.locator('#chapterSelect')).toHaveValue('2');
  await expect(page.locator('#readerContent h2')).toHaveText('John 2');
  expect(await page.locator('#readerContent').evaluate((element, original) => element === original, passage)).toBe(true);
  await page.locator('#readAloudPlay').click();
  await expect(page.locator('#readAloudPlay')).toHaveText('Play');
  expect(await page.evaluate(() => getPlaybackResumeCursor())).toMatchObject({bookId:'john', chapter:2, verse:1});
  await expect(page.locator('#view-reader')).toHaveClass(/reader-fullscreen/);
});
