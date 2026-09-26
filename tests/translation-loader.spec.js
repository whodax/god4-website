const {test, expect} = require('@playwright/test');

const nonDefaultPaths = [
  '/js/bible/asv.js',
  '/js/bible/kjv.js',
  '/js/bible/ylt.js',
  '/js/bible/dby.js',
  '/js/bible/webster.js',
  '/js/bible/rv.js',
  '/js/bible/gnv.js'
];

function translationPath(url) {
  return new URL(url).pathname;
}

test('initial load requests only WEB and renders the default Reader', async ({page}) => {
  const requested = [];
  page.on('request', request => requested.push(translationPath(request.url())));

  await page.goto('/');

  await expect(page.locator('#readerContent')).toContainText('John 1');
  await expect(page.locator('#readerTranslation')).toHaveValue('web');
  expect(requested).toContain('/js/bible/web.js');
  expect(requested.filter(path => nonDefaultPaths.includes(path))).toEqual([]);
  expect(await page.evaluate(() => ({
    web: BibleTranslationLoader.isLoaded('web'),
    unloaded: ['asv', 'kjv', 'ylt', 'dby', 'webster', 'rv', 'gnv'].filter(id => BibleTranslationLoader.isLoaded(id))
  }))).toEqual({web:true, unloaded:[]});
});

test('Reader loads a non-default translation once and renders it', async ({page}) => {
  let requests = 0;
  page.on('request', request => {
    if(translationPath(request.url()) === '/js/bible/asv.js') requests++;
  });
  await page.goto('/');

  await Promise.all([
    page.waitForResponse(response => translationPath(response.url()) === '/js/bible/asv.js' && response.ok()),
    page.locator('#readerTranslation').selectOption('asv')
  ]);
  await expect(page.locator('#readerTranslation')).toHaveValue('asv');
  await expect(page.locator('#readerContent [data-translation-id="asv"]')).not.toHaveCount(0);

  await page.locator('#readerTranslation').selectOption('web');
  await page.locator('#readerTranslation').selectOption('asv');
  await expect(page.locator('#readerContent [data-translation-id="asv"]')).not.toHaveCount(0);
  expect(requests).toBe(1);
});

test('Search loads its selected translation on demand and returns results', async ({page}) => {
  await page.goto('/');

  await Promise.all([
    page.waitForResponse(response => translationPath(response.url()) === '/js/bible/kjv.js' && response.ok()),
    page.locator('#searchTranslation').selectOption('kjv')
  ]);
  await expect(page.locator('#searchTranslationToggle')).toContainText('KJV');
  await page.locator('#searchInput').fill('John 3:16');
  await page.getByRole('button', {name:'Search', exact:true}).click();
  await expect(page.locator('#results .result-card')).toHaveCount(1);
  await expect(page.locator('#results .ref')).toContainText('KJV');
  await expect(page.locator('#readerTranslation')).toHaveValue('web');
});

test('Compare loads selected translations only when Compare is opened or changed', async ({page}) => {
  const requested = [];
  page.on('request', request => requested.push(translationPath(request.url())));
  await page.goto('/');
  expect(requested).not.toContain('/js/bible/asv.js');

  await Promise.all([
    page.waitForResponse(response => translationPath(response.url()) === '/js/bible/asv.js' && response.ok()),
    page.getByRole('button', {name:'Compare', exact:true}).click()
  ]);
  await expect(page.locator('#compareGrid .compare-col')).toHaveCount(2);

  await Promise.all([
    page.waitForResponse(response => translationPath(response.url()) === '/js/bible/kjv.js' && response.ok()),
    page.locator('#compareGrid [data-compare-index="1"]').selectOption('kjv')
  ]);
  await expect(page.locator('#compareGrid [data-compare-index="1"]')).toHaveValue('kjv');
  expect(requested.filter(path => path === '/js/bible/asv.js')).toHaveLength(1);
  expect(requested.filter(path => path === '/js/bible/kjv.js')).toHaveLength(1);
});

test('persisted Reader and Compare translations load only when restored state needs them', async ({page}) => {
  await page.addInitScript(() => {
    localStorage.setItem('god4.translation', 'asv');
    localStorage.setItem('god4.compare', JSON.stringify({
      count: 2, selections: ['web', 'kjv', '', ''], persisted: true
    }));
  });
  const requested = [];
  page.on('request', request => requested.push(translationPath(request.url())));

  await page.goto('/');
  await expect(page.locator('#readerTranslation')).toHaveValue('asv');
  await expect(page.locator('#readerContent [data-translation-id="asv"]')).not.toHaveCount(0);
  expect(requested).toContain('/js/bible/asv.js');
  expect(requested).not.toContain('/js/bible/kjv.js');

  await Promise.all([
    page.waitForResponse(response => translationPath(response.url()) === '/js/bible/kjv.js' && response.ok()),
    page.getByRole('button', {name:'Compare', exact:true}).click()
  ]);
  await expect(page.locator('#compareGrid [data-compare-index="1"]')).toHaveValue('kjv');
});

test('concurrent ensure calls share one translation request', async ({page}) => {
  let requests = 0;
  let releaseRequest;
  const requestGate = new Promise(resolve => { releaseRequest = resolve; });
  await page.route('**/js/bible/asv.js', async route => {
    requests++;
    await requestGate;
    await route.continue();
  });
  await page.goto('/');

  const resultsPromise = page.evaluate(() => Promise.all([
    BibleTranslationLoader.ensure('asv'),
    BibleTranslationLoader.ensure('asv'),
    BibleTranslationLoader.ensure('asv')
  ]));
  await expect.poll(() => requests).toBe(1);
  releaseRequest();

  expect(await resultsPromise).toEqual([true, true, true]);
  expect(await page.evaluate(() => BibleTranslationLoader.ensure('asv'))).toBe(true);
  expect(requests).toBe(1);
});

test('failed translation load keeps Reader usable and can retry successfully', async ({page}) => {
  let requests = 0;
  const pageErrors = [];
  page.on('pageerror', error => pageErrors.push(error.message));
  await page.route('**/js/bible/asv.js', route => {
    requests++;
    return requests === 1 ? route.abort('failed') : route.continue();
  });
  await page.goto('/');

  await page.locator('#readerTranslation').selectOption('asv');
  await expect(page.locator('#readerTranslation')).toHaveValue('web');
  await expect(page.locator('#readerContent')).toContainText('John 1');
  await expect(page.locator('script[data-bible-translation="asv"]')).toHaveCount(0);
  expect(requests).toBe(1);

  await Promise.all([
    page.waitForResponse(response => translationPath(response.url()) === '/js/bible/asv.js' && response.ok()),
    page.locator('#readerTranslation').selectOption('asv')
  ]);
  await expect(page.locator('#readerTranslation')).toHaveValue('asv');
  await expect(page.locator('#readerContent [data-translation-id="asv"]')).not.toHaveCount(0);
  expect(requests).toBe(2);

  expect(await page.evaluate(() => BibleTranslationLoader.ensure('asv'))).toBe(true);
  await page.locator('#readerTranslation').selectOption('web');
  await page.locator('#readerTranslation').selectOption('asv');
  await expect(page.locator('#readerContent [data-translation-id="asv"]')).not.toHaveCount(0);
  expect(requests).toBe(2);
  expect(pageErrors).toEqual([]);
});

test('load without translation registration is retryable', async ({page}) => {
  let requests = 0;
  await page.route('**/js/bible/kjv.js', route => {
    requests++;
    if(requests === 1){
      return route.fulfill({
        status: 200,
        contentType: 'application/javascript',
        body: '/* translation intentionally not registered */'
      });
    }
    return route.continue();
  });
  await page.goto('/');

  expect(await page.evaluate(() => BibleTranslationLoader.ensure('kjv'))).toBe(false);
  await expect(page.locator('script[data-bible-translation="kjv"]')).toHaveCount(0);
  expect(requests).toBe(1);

  await Promise.all([
    page.waitForResponse(response => translationPath(response.url()) === '/js/bible/kjv.js' && response.ok()),
    page.evaluate(() => BibleTranslationLoader.ensure('kjv'))
  ]);
  expect(await page.evaluate(() => BibleTranslationLoader.isLoaded('kjv'))).toBe(true);
  expect(await page.evaluate(() => BibleTranslationLoader.ensure('kjv'))).toBe(true);
  expect(requests).toBe(2);
});