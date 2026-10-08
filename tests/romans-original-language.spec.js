const {test, expect} = require('@playwright/test');
const fs = require('node:fs');
const path = require('node:path');

async function openWord(page, book, chapter, verse, term, translation = 'kjv'){
  await page.goto('/');
  await page.evaluate(async ({book, chapter, translation}) => {
    await BibleTranslationLoader.ensure(translation);
    currentTranslation = translation; currentBook = book; currentChapter = chapter;
    renderPassage(book, chapter);
  }, {book, chapter, translation});
  const words = page.locator(`#readerContent [data-verse-number="${verse}"] [data-word-study-term]`);
  const word = term ? words.filter({hasText:new RegExp('^' + term + '$', 'i')}).first() : words.first();
  await word.focus(); await word.press('Enter');
  await expect(page.locator('#wordStudyPanel')).not.toHaveAttribute('data-word-study-state', 'loading');
  await expect(page.locator('#wordStudyDefinition')).not.toHaveText('');
  await expect(page.locator('#wordStudyHeading')).toBeFocused();
  return word;
}

for(const [translation, chapter, verse, canonicalChapter, canonicalVerse, count] of [
  ['web',14,24,16,25,20], ['web',14,25,16,26,20], ['web',14,26,16,27,13],
  ['web',14,23,14,23,18], ['kjv',16,25,16,25,20], ['asv',16,25,16,25,20],
  ['web',8,28,8,28,16]
]){
  test(`Word Study ${translation} Romans ${chapter}:${verse} preserves English reference with canonical Greek ${canonicalChapter}:${canonicalVerse}`, async ({page}) => {
    const errors = [], consoleErrors = [], shards = [];
    page.on('pageerror', error => errors.push(error.message));
    page.on('console', message => {if(message.type() === 'error' && /romans/i.test(message.text() + message.location().url)) consoleErrors.push(message.text());});
    page.on('request', request => {if(request.url().includes('/original-language/romans/')) shards.push(new URL(request.url()).pathname);});
    const word = await openWord(page, 'romans', chapter, verse, undefined, translation);
    await expect(page.locator('#wordStudyReference')).toHaveText(`Romans ${chapter}:${verse}`);
    const section = page.locator('#wordStudyOriginalLanguage');
    await expect(section).toBeVisible();
    const tokens = section.locator('.word-study-original-token');
    await expect(tokens).toHaveCount(count);
    const rows = await tokens.evaluateAll(elements => elements.map(e => e.__originalLanguageRecord));
    expect(rows.every(r => r.chapter === canonicalChapter && r.verse === canonicalVerse && r.language === 'greek')).toBe(true);
    expect(shards).toEqual([`/data/word-study/original-language/romans/${canonicalChapter}.json`]);
    const index = chapter === 8 ? 7 : 0;
    if(chapter === 8){
      expect(rows.filter(r => r.surface === 'παντα')).toHaveLength(1);
      expect(rows[7]).toMatchObject({surface:'παντα', strongsNumber:'G3956', morphology:'A-APN'});
    }
    await tokens.nth(index).press('Enter');
    for(const key of ['strongsNumber','lemma','transliteration','morphology','definition']) await expect(page.locator('#wordStudyOriginalDetails')).toContainText(rows[index][key]);
    await tokens.nth(index).press('Escape');
    await expect(word).toBeFocused();
    expect(errors).toEqual([]); expect(consoleErrors).toEqual([]);
  });
}

test('Word Study WEB mapping leaves the empty Romans 16:25 marker and verse inventory unchanged', async ({page}) => {
  await page.goto('/');
  await page.evaluate(async () => {
    await BibleTranslationLoader.ensure('web');
    currentTranslation='web'; currentBook='romans'; currentChapter=16; renderPassage('romans',16);
  });
  const empty = page.locator('#readerContent [data-verse-number="25"]');
  await expect(empty).toHaveAttribute('data-verse-text', '');
  await expect(empty.locator('.vnum')).toHaveText('25');
  await expect(empty.locator('[data-word-study-term]')).toHaveCount(0);
  await expect(page.locator('#verseSelect option[value="25"]')).toHaveCount(1);
  for(const verse of [26,27]){
    await expect(page.locator(`#readerContent [data-verse-number="${verse}"]`)).toHaveCount(0);
    await expect(page.locator(`#verseSelect option[value="${verse}"]`)).toHaveCount(0);
  }
  expect(await page.evaluate(() => BibleData.getVerse('web','romans',16,25).text)).toBe('');
});

for(const [chapter, verse, term] of [[1,1,'servant'], [8,13,'Spirit'], [8,28,'know'], [16,25,'power'], [16,26,'prophets'], [16,27,'wise']]){
  test(`Word Study Romans ${chapter}:${verse} discovers published Greek and preserves English and keyboard behavior`, async ({page}) => {
    const errors = [], failed = [], consoleErrors = [];
    page.on('pageerror', error => errors.push(error.message));
    page.on('requestfailed', request => {if(request.url().includes('/original-language/romans/')) failed.push(request.url());});
    page.on('console', message => {
      if(message.type() === 'error' && /romans/i.test(message.text() + message.location().url)) consoleErrors.push(message.text());
    });
    const responsePromise = page.waitForResponse(r => r.url().endsWith(`/original-language/romans/${chapter}.json`));
    const word = await openWord(page, 'romans', chapter, verse, term);
    expect((await responsePromise).status()).toBe(200);
    const rows = JSON.parse(fs.readFileSync(path.join(__dirname, `../data/word-study/original-language/romans/${chapter}.json`))).records.filter(r => r.verse === verse);
    const section = page.locator('#wordStudyOriginalLanguage');
    await expect(section).toBeVisible();
    const tokens = section.locator('.word-study-original-token');
    await expect(tokens).toHaveText(rows.map(r => r.surface));
    await expect(page.locator('#wordStudyOriginalTokens')).toHaveAttribute('dir', 'ltr');
    await expect(tokens.first()).toHaveAttribute('lang', 'grc');
    const index = chapter === 8 && verse === 28 ? 7 : 0;
    const english = await page.locator('#wordStudyDefinition').textContent();
    await expect(page.locator('#wordStudyPanel')).toHaveAttribute('data-word-study-state', 'available');
    await tokens.nth(index).press('Enter');
    await expect(tokens.nth(index)).toHaveAttribute('aria-pressed', 'true');
    const details = page.locator('#wordStudyOriginalDetails');
    for(const key of ['strongsNumber', 'lemma', 'transliteration', 'morphology', 'definition']) await expect(details).toContainText(rows[index][key]);
    await expect(page.locator('#wordStudyDefinition')).toHaveText(english);
    await tokens.nth(index).press('Escape');
    await expect(page.locator('#wordStudyPanel')).toBeHidden(); await expect(word).toBeFocused();
    expect(errors).toEqual([]); expect(consoleErrors).toEqual([]); expect(failed).toEqual([]);
  });
}

for(const [book, chapter, verse, language] of [['genesis',1,1,'he'], ['john',1,1,'grc'], ['isaiah',11,3,null]]){
  test(`Word Study Romans publication preserves ${book} ${chapter}:${verse} coverage`, async ({page}) => {
    const word = await openWord(page, book, chapter, verse);
    const result = await page.evaluate(({book, chapter, verse}) => OriginalLanguageWordStudyProvider.lookupVerse({bookId:book, chapter, verse}), {book, chapter, verse});
    const section = page.locator('#wordStudyOriginalLanguage');
    if(language){
      await expect(section).toBeVisible();
      await expect(section.locator('.word-study-original-token')).toHaveCount(result.records.length);
      await expect(section.locator('.word-study-original-token').first()).toHaveAttribute('lang', language);
    }else{
      expect(result.records).toEqual([]); await expect(section).toBeHidden();
    }
    await page.locator('#wordStudyHeading').press('Escape'); await expect(word).toBeFocused();
  });
}

for(const width of [320,375,480]){
  test(`Word Study Romans Greek row and details fit ${width}px with existing typography`, async ({page}) => {
    await page.setViewportSize({width, height:900});
    await openWord(page, 'romans', 8, 28, 'know');
    const token = page.locator('#wordStudyOriginalTokens .word-study-original-token').nth(7);
    await expect(token).toHaveText('παντα'); await token.press('Enter');
    const geometry = await page.evaluate(() => {
      const panel = document.getElementById('wordStudyPanel');
      const tokens = document.getElementById('wordStudyOriginalTokens');
      return {viewport:innerWidth, document:document.documentElement.scrollWidth,
        panelClient:panel.clientWidth, panelScroll:panel.scrollWidth,
        tokensClient:tokens.clientWidth, tokensScroll:tokens.scrollWidth,
        font:getComputedStyle(tokens.querySelector('button')).fontFamily};
    });
    expect(geometry.document).toBeLessThanOrEqual(width);
    expect(geometry.panelScroll).toBeLessThanOrEqual(geometry.panelClient);
    expect(geometry.tokensScroll).toBeLessThanOrEqual(geometry.tokensClient);
    expect(geometry.font).not.toBe('');
  });
}
