const {test, expect} = require('@playwright/test');

async function openReader(page){
  await page.addInitScript(() => window.addEventListener('DOMContentLoaded', () => initializeBibleExperience()));
  await page.goto('/');
  await expect(page.locator('#readerContent .reader-verse').first()).toBeVisible();
}

test('verses retain their numbers and Scripture tokens without speech controls or trailing artifacts', async ({page}) => {
  await openReader(page);
  for(const chapter of ['1', '2']){
    await page.locator('#chapterSelect').selectOption(chapter);
    const verses = page.locator('#readerContent .reader-verse');
    await expect(page.locator('#readerContent .verse-speak, #readerContent [data-verse-speech]')).toHaveCount(0);
    await expect(page.locator('#readerContent').getByRole('button', {name:/read.*verse.*aloud/i})).toHaveCount(0);
    expect(await page.locator('#readerContent').ariaSnapshot()).not.toMatch(/read.*verse.*aloud/i);
    const rendered = await verses.evaluateAll(elements => elements.map((verse, index) => {
      const number = verse.firstElementChild;
      const copy = verse.cloneNode(true);
      copy.firstElementChild.remove();
      return {
        number:number.textContent,
        label:number.getAttribute('aria-label'),
        text:copy.textContent,
        expected:verse.getAttribute('data-verse-text'),
        onlyExistingChildren:[...verse.children].every(child => child.matches('.vnum, .word-study-token')),
        inline:getComputedStyle(verse).display,
        index:index + 1
      };
    }));
    const scripture = await page.evaluate(() => BibleData.getChapter(currentTranslation, currentBook, currentChapter).verses);
    expect(rendered.map(verse => verse.text)).toEqual(scripture);
    for(const verse of rendered){
      expect(verse.number).toBe(String(verse.index));
      expect(verse.label).toBe(`Highlight verse ${verse.index}`);
      expect(verse.text).toBe(verse.expected);
      expect(verse.onlyExistingChildren).toBe(true);
      expect(verse.inline).toBe('inline');
    }
  }
  await page.locator('#readerContent .vnum').first().click();
  await expect(page.locator('#readerContent .vnum').first()).toHaveClass(/highlighted/);
  const token = page.locator('#readerContent [data-word-study-term]').first();
  await token.focus();
  await token.press('Enter');
  await expect(page.locator('#wordStudyPanel')).toBeVisible();
  await expect(page.locator('#wordStudyHeading')).toBeFocused();
});

for(const width of [320, 375, 480]){
  test(`Reader verses and sticky controls fit ${width}px in normal and fullscreen modes`, async ({page}) => {
    await page.setViewportSize({width, height:800});
    await openReader(page);
    for(const fullscreen of [false, true]){
      if(fullscreen) await page.locator('#fullscreenBtn').click();
      await page.locator('#readerContent .reader-verse').last().scrollIntoViewIfNeeded();
      expect(await page.evaluate(() => {
        const shell = document.getElementById('view-reader');
        return document.documentElement.scrollWidth <= innerWidth && shell.scrollWidth <= shell.clientWidth &&
          [...shell.querySelectorAll('.reader-verse, .reader-verse *, .reader-toolbar')].every(element =>
            [...element.getClientRects()].every(rect => rect.left >= -1 && rect.right <= innerWidth + 1));
      })).toBe(true);
      await expect(page.locator('#readAloudPlay')).toBeVisible();
      expect(await page.locator('#readerContent').ariaSnapshot()).not.toMatch(/read.*verse.*aloud/i);
    }
  });
}
