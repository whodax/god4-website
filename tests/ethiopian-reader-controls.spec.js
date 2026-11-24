const {test, expect} = require('@playwright/test');

test.use({serviceWorkers:'block', viewport:{width:390,height:844}, reducedMotion:'reduce'});

test('main menu opens the Ethiopian Bible section between Study Desk and Bible Resources', async ({page}) => {
  await page.goto('/');
  await expect(page.locator('#companion + #ethiopian + #resources')).toHaveCount(1);
  await page.locator('#headerMenuTrigger').click();
  await page.getByRole('button', {name:'Ethiopian Bible', exact:true}).click();
  await expect(page.locator('#ethiopian')).toBeFocused();
  await expect(page.getByRole('heading',{name:'The Ethiopian Bible'})).toBeInViewport();
  await page.getByRole('link',{name:'Read the Ethiopian collection'}).click();
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
  await page.getByLabel('Verse',{exact:true}).selectOption({label:'31'});
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
  await expect(page.getByLabel('Chapter',{exact:true})).toHaveValue('2');
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
  await expect(dialog.getByLabel('Verse',{exact:true})).toBeVisible();
  await dialog.getByRole('button',{name:'Top',exact:true}).click();
  await expect.poll(() => pane.evaluate(el => el.scrollTop)).toBe(0);
  await expect(dialog.getByRole('link',{name:'Home',exact:true})).toHaveAttribute('href','/');
  await page.keyboard.press('Escape');
  await expect(dialog).not.toBeVisible();
  await expect(page.getByRole('button',{name:'Fullscreen',exact:true})).toBeFocused();
  await expect(page.getByRole('banner').getByRole('link',{name:'Home',exact:true})).toHaveAttribute('href','/');
});
