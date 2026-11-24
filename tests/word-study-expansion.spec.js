const {test, expect} = require('@playwright/test');

test.use({serviceWorkers:'block', contextOptions:{reducedMotion:'reduce'}});

async function study(page, translationId, bookId, chapter, verse){
  await page.goto('/');
  await page.evaluate(async context => {
    await initializeBibleExperience();
    await changeTranslation(context.translationId);
    await navigateReaderToPassage(context.bookId, context.chapter, context.verse);
  }, {translationId, bookId, chapter, verse});
  const row = page.locator('#readerContent [data-verse-number="' + verse + '"]');
  await expect(row).toHaveAttribute('data-book-id', bookId);
  await expect(row).toHaveAttribute('data-chapter', String(chapter));
  const word = row.locator('[data-word-study-term]').first();
  await word.press('Enter');
  await page.evaluate(() => WordStudyLoader.ensure());
  return {word, tokens:page.locator('#wordStudyOriginalTokens button')};
}

const passages = [
  ['exodus', 3, 14, 'he', 'H1961'],
  ['leviticus', 19, 18, 'he', 'H157'],
  ['numbers', 6, 24, 'he', 'H1288'],
  ['deuteronomy', 6, 4, 'he', 'H8085'],
  ['matthew', 5, 9, 'grc', 'G1518'],
  ['mark', 1, 1, 'grc', 'G2098'],
  ['luke', 10, 34, 'grc', 'G2022']
];

for(const [book, chapter, verse, lang, strongs] of passages){
  test(book + ' opens the verse’s original-language study', async ({page}) => {
    await page.setViewportSize({width:390, height:844});
    const {word, tokens} = await study(page, 'web', book, chapter, verse);
    await expect(tokens.first()).toHaveAttribute('lang', lang);
    const index = await tokens.evaluateAll((buttons, number) =>
      buttons.findIndex(button => button.__originalLanguageRecord.strongsNumber === number), strongs);
    expect(index).toBeGreaterThanOrEqual(0);
    await tokens.nth(index).press('Enter');
    const details = page.locator('#wordStudyOriginalDetails');
    await expect(details).toContainText(strongs);
    await expect(details).toContainText('Lexical definition');
    if(strongs === 'G2022') await expect(details).toContainText('to pour upon');
    await page.keyboard.press('Escape');
    await expect(word).toBeFocused();
  });
}

for(const [translation, book, chapter, verse, sourceChapter, sourceVerse, firstStrongs] of [
  ['web', 'numbers', 26, 1, 26, 1, 'H1961'],
  ['gnv', 'numbers', 13, 1, 12, 16, 'H310'],
  ['dra', 'mark', 8, 39, 9, 1, 'G2532'],
  ['kjv', 'luke', 17, 37, 17, 37, 'G2532']
]){
  test(translation + ' uses the reviewed Word Study reference for ' + book + ' ' + chapter + ':' + verse, async ({page}) => {
    const {tokens} = await study(page, translation, book, chapter, verse);
    await expect(tokens.first()).toBeVisible();
    const entries = await tokens.evaluateAll(buttons => buttons.map(button => button.__originalLanguageRecord));
    expect(entries[0]).toMatchObject({chapter:sourceChapter, verse:sourceVerse, strongsNumber:firstStrongs});
    if(book === 'numbers' && chapter === 26){
      expect(entries.map(entry => entry.strongsNumber).slice(0,5)).toEqual(['H1961','H310','H4046','H559','H3068']);
      expect(entries.map(entry => entry.tokenIndex)).toEqual(entries.map((_,index) => index));
    }
  });
}

for(const [translation, chapter, verse, strongs] of [
  ['web', 23, 13, 'G2719'], ['kjv', 23, 13, 'G2808'], ['dra', 5, 4, 'G4239']
]){
  test(translation + ' Matthew ' + chapter + ':' + verse + ' uses the correct Greek clause', async ({page}) => {
    const {tokens} = await study(page, translation, 'matthew', chapter, verse);
    await expect(tokens.first()).toBeVisible();
    const numbers = await tokens.evaluateAll(buttons => buttons.map(button => button.__originalLanguageRecord.strongsNumber));
    expect(numbers).toContain(strongs);
  });
}

for(const [translation, book, chapter, verse] of [['kjv','luke',17,36], ['dra','matthew',17,14]]){
  test(translation + ' keeps dictionary lookup for ' + book + ' ' + chapter + ':' + verse, async ({page}) => {
    await study(page, translation, book, chapter, verse);
    const result = await page.evaluate(context => OriginalLanguageWordStudyProvider.lookupVerse(context),
      {translationId:translation, bookId:book, chapter, verse});
    expect(result).toEqual({status:'unavailable', records:[]});
    await expect(page.locator('#wordStudyOriginalLanguage')).toBeHidden();
    await expect(page.locator('#wordStudyPanel')).toBeVisible();
  });
}
