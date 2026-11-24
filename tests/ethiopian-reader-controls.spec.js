const {test, expect} = require('@playwright/test');

test.use({serviceWorkers:'block', viewport:{width:390,height:844}, reducedMotion:'reduce'});

test('main menu opens the Ethiopian Bible guide while Study Desk is loading', async ({page}) => {
  let releaseTranslation;
  let translationStarted;
  const pendingTranslation = new Promise(resolve => {releaseTranslation = resolve;});
  const translationRequest = new Promise(resolve => {translationStarted = resolve;});
  await page.route('**/js/bible/web.js*', async route => {
    translationStarted();
    await pendingTranslation;
    await route.continue();
  });
  await page.goto('/');
  await expect(page.locator('#companion + #ethiopian + #resources')).toHaveCount(1);
  await page.evaluate(() => {window.pendingBible = initializeBibleExperience();});
  await translationRequest;
  try {
    await page.locator('#headerMenuTrigger').click();
    await page.getByRole('button', {name:'Ethiopian Bible', exact:true}).click();
    await expect(page).toHaveURL(/\/guides\/ethiopian-bible(?:\.html)?$/);
    await expect(page.getByRole('heading',{name:'The Ethiopian Bible'})).toBeVisible();
  } finally {
    releaseTranslation();
  }
  await page.getByRole('link',{name:'Open the English reading collection'}).click();
  await expect(page.getByRole('heading',{name:'Ethiopian Readings'})).toBeVisible();
});

test('Ethiopian Read Aloud starts at the selected verse, advances chapters, and stops', async ({page}) => {
  await page.route('**/js/bible/cloud-tts.js', route => route.fulfill({contentType:'application/javascript', body:`
    window.ethiopianCalls = [];
    window.BibleCloudTTS = {
      available: () => true,
      prepare() {},
      cancel() {},
      speak(text, voice, rate, callbacks) {
        ethiopianCalls.push({text, voice, rate, callbacks});
        return true;
      }
    };
  `}));
  await page.goto('/guides/ethiopian-readings.html?book=genesis&chapter=1');
  const play = page.getByRole('button',{name:'Play Read Aloud',exact:true});
  const stop = page.getByRole('button',{name:'Stop Read Aloud',exact:true});
  const spoken = page.locator('#eth-passage [aria-current="true"]');
  await page.getByRole('button',{name:'Verse: 1',exact:true}).click();
  await page.getByRole('dialog',{name:'Choose verse'}).getByRole('button',{name:'31',exact:true}).click();
  await page.getByLabel('Voice',{exact:true}).selectOption('female');
  await page.getByLabel('Speed',{exact:true}).selectOption('2');
  await play.click();
  await expect(spoken).toHaveCount(0);
  const preference = await page.evaluate(() => {
    const {voice, rate, callbacks} = ethiopianCalls[0];
    callbacks.onstart();
    return {voice, rate};
  });
  expect(preference).toEqual({voice:'female', rate:2});
  await expect(spoken.locator('sup')).toHaveText('31');
  await page.evaluate(() => ethiopianCalls[0].callbacks.onend());
  await expect(page.getByRole('button',{name:'Chapter: 2',exact:true})).toBeVisible();
  await expect.poll(() => page.evaluate(() => ethiopianCalls.length)).toBe(2);
  await page.evaluate(() => ethiopianCalls[1].callbacks.onstart());
  await expect(spoken.locator('sup')).toHaveText('1');
  await stop.click();
  await page.evaluate(() => ethiopianCalls[1].callbacks.onend());
  await expect(spoken).toHaveCount(0);
  await expect(play).toBeEnabled();
});

test('Ethiopian Fullscreen retains the controls and the footer returns to the passage top', async ({page}) => {
  await page.goto('/guides/ethiopian-readings.html?book=psalms&chapter=119&verse=120');
  const pane = page.getByRole('region',{name:/Psalms 119/});
  await expect.poll(() => pane.evaluate(el => el.scrollTop)).toBeGreaterThan(0);
  await page.getByRole('button',{name:'Fullscreen',exact:true}).click();
  const dialog = page.getByRole('dialog',{name:'Fullscreen Ethiopian Reader'});
  await expect(dialog.getByRole('button',{name:'Verse: 120',exact:true})).toBeVisible();
  await dialog.getByRole('button',{name:'Verse: 120',exact:true}).click();
  await expect(page.getByRole('dialog',{name:'Choose verse'})).toBeVisible();
  await page.keyboard.press('Escape');
  await dialog.getByRole('button',{name:'Top',exact:true}).click();
  await expect.poll(() => pane.evaluate(el => el.scrollTop)).toBe(0);
  await expect(dialog.getByRole('link',{name:'Home',exact:true})).toHaveAttribute('href','/');
  await page.keyboard.press('Escape');
  await expect(dialog).not.toBeVisible();
  await expect(page.getByRole('button',{name:'Fullscreen',exact:true})).toBeFocused();
  await expect(page.getByRole('banner').getByRole('link',{name:'Home',exact:true})).toHaveAttribute('href','/');
});

test('Book, Chapter and Verse pickers use the page theme and return focus', async ({page}) => {
  await page.goto('/guides/ethiopian-readings.html');
  const book = page.getByRole('button',{name:'Book: Genesis',exact:true});
  await book.click();
  const picker = page.getByRole('dialog',{name:'Choose book'});
  const day = await picker.evaluate(el => getComputedStyle(el).backgroundColor);
  await picker.getByRole('searchbox',{name:'Find a book'}).fill('jubilees');
  await picker.getByRole('button',{name:'Jubilees',exact:true}).click();
  await expect(page.getByRole('button',{name:'Book: Jubilees',exact:true})).toBeFocused();
  await page.getByRole('button',{name:'Switch to Dark Mode'}).click();
  const chapter = page.getByRole('button',{name:'Chapter: 1',exact:true});
  await chapter.click();
  const darkPicker = page.getByRole('dialog',{name:'Choose chapter'});
  expect(await darkPicker.evaluate(el => getComputedStyle(el).backgroundColor)).not.toBe(day);
  await expect(darkPicker.getByRole('button',{name:'1',exact:true})).toBeFocused();
  await page.keyboard.press('ArrowRight');
  await page.keyboard.press('Enter');
  await expect(page.getByRole('button',{name:'Chapter: 2',exact:true})).toBeFocused();
  await expect(page.getByRole('heading',{name:/Jubilees 2/})).toBeVisible();
});
