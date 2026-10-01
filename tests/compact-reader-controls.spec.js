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
  await expect(reader.locator('#readerTranslation')).toBeVisible();
  await expect(reader.locator('#readAloudPlay')).toHaveText('Play');
  await expect(reader.locator('#readAloudPause, #readAloudStop')).toHaveCount(0);
  await expect(reader.getByRole('button', { name:/^Pause|^Resume|^Stop reading aloud/ })).toHaveCount(0);
  await expect(reader.locator('#readerMoreTrigger')).toHaveAttribute('aria-expanded', 'false');
  await expect(reader.locator('#readerSecondaryControls')).toBeHidden();
  await expect(page.locator('#fullscreenBtn + #offlineBiblesTrigger')).toHaveCount(1);
  expect(await reader.locator('.reader-toolbar').evaluate(toolbar =>
    [...toolbar.children].filter(element => element.matches('select, button, .reader-controls-top'))
      .map(element => element.id || 'chapter-group')
  )).toEqual(['bookSelect', 'chapter-group', 'readerTranslation', 'readAloudPlay', 'readerMoreTrigger']);
  for(const id of ['bookSelect', 'chapterSelect', 'readerTranslation']){
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
  await expect(page.locator('[data-voice-command-button]')).toBeVisible();
  await expect(page.locator('#readAloudVoice')).toBeVisible();
  await expect(page.locator('#readAloudSpeed')).toBeVisible();
  await more.click();
  await expect(more).toHaveAttribute('aria-expanded', 'false');
  await expect(page.locator('#readerSecondaryControls')).toBeHidden();
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
      const positions = ['#bookSelect', '.reader-controls-top', '#readerTranslation', '#readAloudPlay', '#readerMoreTrigger']
        .map(selector => Math.round(document.querySelector(selector).getBoundingClientRect().top));
      const verse = document.querySelector('#readerContent .reader-verse').getBoundingClientRect();
      const overflow = [...document.querySelectorAll('#view-reader *')].filter(element => {
        const bounds = element.getBoundingClientRect();
        return bounds.right > innerWidth + 1 || bounds.left < -1;
      }).map(element => element.id || element.className);
      return { toolbarHeight:toolbar.height, firstVerseOffset:verse.top - view.top, overflow, positions };
    });
    expect(geometry.overflow, `${width}px Reader overflow`).toEqual([]);
    expect(geometry.toolbarHeight).toBeLessThanOrEqual(width === 1440 ? 64 : 100);
    if(width === 1440) expect(new Set(geometry.positions).size).toBe(1);
    else {
      expect(geometry.positions[0]).toBe(geometry.positions[1]);
      expect(geometry.positions[2]).toBe(geometry.positions[3]);
      expect(geometry.positions[3]).toBe(geometry.positions[4]);
      expect(geometry.positions[2]).toBeGreaterThan(geometry.positions[0]);
    }
    expect(geometry.firstVerseOffset).toBeLessThan(width === 320 ? 500 : width === 480 ? 450 : 500);
  }
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
