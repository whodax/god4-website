const {test, expect} = require('@playwright/test');

const translationPaths = [
  '/js/bible/web.js',
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

function watchTranslationRequests(page) {
  const requested = [];
  page.on('request', request => {
    const path = translationPath(request.url());
    if (translationPaths.includes(path)) requested.push(path);
  });
  return requested;
}

async function installAndControl(page) {
  await page.goto('/');
  await page.evaluate(() => navigator.serviceWorker.ready.then(() => true));
  if(!await page.evaluate(() => Boolean(navigator.serviceWorker.controller))) {
    await page.reload({waitUntil:'domcontentloaded'});
  }
  await expect.poll(() => page.evaluate(() => Boolean(navigator.serviceWorker.controller))).toBe(true);
}

async function workerMessage(page, message) {
  return page.evaluate(async value => {
    const registration = await navigator.serviceWorker.ready;
    return new Promise((resolve, reject) => {
      const channel = new MessageChannel();
      const timeout = setTimeout(() => reject(new Error('Service-worker message timed out')), 20000);
      channel.port1.onmessage = event => {
        clearTimeout(timeout);
        resolve(event.data);
      };
      registration.active.postMessage(value, [channel.port2]);
    });
  }, message);
}

test.beforeEach(async ({page}) => {
  page.runtimeErrors = [];
  page.on('pageerror', error => page.runtimeErrors.push(error.message));
  await page.addInitScript(() => {
    window.__cspViolations = [];
    window.addEventListener('securitypolicyviolation', event => {
      window.__cspViolations.push({
        directive: event.effectiveDirective,
        blockedURI: event.blockedURI
      });
    });
  });
});

test.afterEach(async ({page}) => {
  expect(page.runtimeErrors).toEqual([]);
  expect(await page.evaluate(() => window.__cspViolations || [])).toEqual([]);
});

test('ordinary homepage load requests no Bible translation and non-Bible content remains usable', async ({page}) => {
  const requested = watchTranslationRequests(page);

  await page.goto('/');
  await page.waitForLoadState('networkidle');

  expect(requested).toEqual([]);
  await expect(page.getByRole('heading', {name:/Scripture, kept open/i})).toBeVisible();
  await expect(page.locator('#verseRef')).toHaveText('John 3:16');
  await page.locator('.saved-pill').click();
  await expect(page.locator('#tray')).toHaveAttribute('aria-hidden', 'false');
  expect(await page.evaluate(() => ['web', 'asv', 'kjv', 'ylt', 'dby', 'webster', 'rv', 'gnv'].filter(id => BibleTranslationLoader.isLoaded(id)))).toEqual([]);
});

test('generated metadata validates a loaded translation deterministically', async ({page}) => {
  await page.goto('/');

  const metadata = await page.evaluate(() => ({
    ids: Object.keys(BibleTranslationManifest),
    web: BibleTranslationManifest.web,
    unloaded: BibleData.validateTranslation('web'),
    unknown: BibleData.validateTranslation('not-allowlisted'),
    demo: BibleData.validateTranslation('demo-local')
  }));
  expect(metadata.ids).toEqual(['web', 'asv', 'kjv', 'ylt', 'dby', 'webster', 'rv', 'gnv']);
  expect(metadata.web.path).toBe('/js/bible/web.js');
  expect(metadata.web.revision).toMatch(/^[a-f0-9]{16}$/);
  expect(metadata.web.integrity).toMatch(/^sha256-[A-Za-z0-9+/]+={0,2}$/);
  expect(metadata.web.bytes).toBeGreaterThan(4_000_000);
  expect(metadata.web.structure).toMatchObject({bookCount: 66, chapterCount: 1190});
  expect(metadata.unloaded).toBe(false);
  expect(metadata.unknown).toBe(false);
  expect(metadata.demo).toBe(false);

  expect(await page.evaluate(() => BibleTranslationLoader.ensure('web'))).toBe(true);
  expect(await page.evaluate(() => BibleData.validateTranslation('web'))).toBe(true);
  expect(await page.evaluate(() => webLibrary.john[1].verses.pop())).toBeTruthy();
  expect(await page.evaluate(() => BibleData.validateTranslation('web'))).toBe(false);
});

test('entering Reader loads WEB once and renders the default passage', async ({page}) => {
  const requested = watchTranslationRequests(page);
  await page.goto('/');

  await Promise.all([
    page.waitForResponse(response => translationPath(response.url()) === '/js/bible/web.js' && response.ok()),
    page.locator('nav a[href="#companion"]').click()
  ]);

  await expect(page.locator('#readerTranslation')).toHaveValue('web');
  await expect(page.locator('#readerContent')).toContainText('John 1');
  await expect(page.locator('#readerContent [data-translation-id="web"]')).not.toHaveCount(0);
  await page.getByRole('button', {name:'Reader', exact:true}).click();
  await expect(page.locator('#readerContent')).toContainText('John 1');
  expect(requested.filter(path => path === '/js/bible/web.js')).toHaveLength(1);
  expect(requested.filter(path => path !== '/js/bible/web.js')).toEqual([]);
});

test('Search loads WEB on submit and returns results', async ({page}) => {
  const requested = watchTranslationRequests(page);
  await page.goto('/');

  await page.locator('#searchInput').fill('John 3:16');
  await Promise.all([
    page.waitForResponse(response => translationPath(response.url()) === '/js/bible/web.js' && response.ok()),
    page.getByRole('button', {name:'Search', exact:true}).click()
  ]);

  await expect(page.locator('#results .result-card')).toHaveCount(1);
  await expect(page.locator('#results .ref')).toContainText('WEB');
  expect(requested).toEqual(['/js/bible/web.js']);
});

test('Compare loads only the translations required by its visible columns', async ({page}) => {
  const requested = watchTranslationRequests(page);
  await page.goto('/');

  await Promise.all([
    page.waitForResponse(response => translationPath(response.url()) === '/js/bible/web.js' && response.ok()),
    page.waitForResponse(response => translationPath(response.url()) === '/js/bible/asv.js' && response.ok()),
    page.getByRole('button', {name:'Compare', exact:true}).click()
  ]);

  await expect(page.locator('#compareGrid .compare-col')).toHaveCount(2);
  await expect(page.locator('#compareGrid [data-compare-index="0"]')).toHaveValue('web');
  await expect(page.locator('#compareGrid [data-compare-index="1"]')).toHaveValue('asv');
  expect(requested.sort()).toEqual(['/js/bible/asv.js', '/js/bible/web.js']);
});

test('persisted non-default Reader translation loads without loading WEB', async ({page}) => {
  await page.addInitScript(() => localStorage.setItem('god4.translation', 'asv'));
  const requested = watchTranslationRequests(page);
  await page.goto('/');

  expect(requested).toEqual([]);
  await page.evaluate(() => initializeBibleExperience());

  await expect(page.locator('#readerTranslation')).toHaveValue('asv');
  await expect(page.locator('#readerContent [data-translation-id="asv"]')).not.toHaveCount(0);
  expect(requested).toEqual(['/js/bible/asv.js']);
});

test('persisted Compare selections load without forcing WEB', async ({page}) => {
  await page.addInitScript(() => {
    localStorage.setItem('god4.translation', 'asv');
    localStorage.setItem('god4.compare', JSON.stringify({
      count: 2, selections: ['asv', 'kjv', '', ''], persisted: true
    }));
  });
  const requested = watchTranslationRequests(page);
  await page.goto('/');

  await Promise.all([
    page.waitForResponse(response => translationPath(response.url()) === '/js/bible/asv.js' && response.ok()),
    page.waitForResponse(response => translationPath(response.url()) === '/js/bible/kjv.js' && response.ok()),
    page.getByRole('button', {name:'Compare', exact:true}).click()
  ]);

  await expect(page.locator('#compareGrid [data-compare-index="0"]')).toHaveValue('asv');
  await expect(page.locator('#compareGrid [data-compare-index="1"]')).toHaveValue('kjv');
  expect(requested.sort()).toEqual(['/js/bible/asv.js', '/js/bible/kjv.js']);
});

test('concurrent WEB ensure calls share one network request', async ({page}) => {
  let requests = 0;
  let releaseRequest;
  const requestGate = new Promise(resolve => { releaseRequest = resolve; });
  await page.route('**/js/bible/web.js*', async route => {
    requests++;
    await requestGate;
    await route.continue();
  });
  await page.goto('/');

  const resultsPromise = page.evaluate(() => Promise.all([
    BibleTranslationLoader.ensure('web'),
    BibleTranslationLoader.ensure('web'),
    BibleTranslationLoader.ensure('web')
  ]));
  await expect.poll(() => requests).toBe(1);
  releaseRequest();

  expect(await resultsPromise).toEqual([true, true, true]);
  expect(await page.evaluate(() => BibleTranslationLoader.ensure('web'))).toBe(true);
  expect(requests).toBe(1);
});

test('failed WEB load leaves the homepage usable and can retry successfully', async ({page}) => {
  let requests = 0;
  await page.route('**/js/bible/web.js*', route => {
    requests++;
    return requests === 1 ? route.abort('failed') : route.continue();
  });
  await page.goto('/');

  expect(await page.evaluate(() => initializeBibleExperience())).toBe(false);
  await expect(page.locator('#readerContent')).toBeEmpty();
  await expect(page.locator('script[data-bible-translation="web"]')).toHaveCount(0);
  await expect(page.locator('#verseRef')).toHaveText('John 3:16');
  await page.locator('.saved-pill').click();
  await expect(page.locator('#tray')).toHaveAttribute('aria-hidden', 'false');
  expect(requests).toBe(1);

  await Promise.all([
    page.waitForResponse(response => translationPath(response.url()) === '/js/bible/web.js' && response.ok()),
    page.evaluate(() => initializeBibleExperience())
  ]);
  await expect(page.locator('#readerContent [data-translation-id="web"]')).not.toHaveCount(0);
  expect(requests).toBe(2);

  expect(await page.evaluate(() => initializeBibleExperience())).toBe(true);
  expect(await page.evaluate(() => BibleTranslationLoader.ensure('web'))).toBe(true);
  expect(requests).toBe(2);
});

test('Reader still loads a non-default translation once and renders it', async ({page}) => {
  const requested = watchTranslationRequests(page);
  await page.goto('/');

  await Promise.all([
    page.waitForResponse(response => translationPath(response.url()) === '/js/bible/asv.js' && response.ok()),
    page.locator('#readerTranslation').selectOption('asv')
  ]);
  await expect(page.locator('#readerContent [data-translation-id="asv"]')).not.toHaveCount(0);

  await page.locator('#readerTranslation').selectOption('web');
  await expect(page.locator('#readerContent [data-translation-id="web"]')).not.toHaveCount(0);
  await page.locator('#readerTranslation').selectOption('asv');
  await expect(page.locator('#readerContent [data-translation-id="asv"]')).not.toHaveCount(0);
  expect(requested.filter(path => path === '/js/bible/asv.js')).toHaveLength(1);
  expect(requested.filter(path => path === '/js/bible/web.js')).toHaveLength(1);
});

test('a script load without translation registration remains retryable', async ({page}) => {
  let requests = 0;
  await page.route('**/js/bible/web.js*', route => {
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

  expect(await page.evaluate(() => BibleTranslationLoader.ensure('web'))).toBe(false);
  await expect(page.locator('script[data-bible-translation="web"]')).toHaveCount(0);
  expect(requests).toBe(1);

  expect(await page.evaluate(() => BibleTranslationLoader.ensure('web'))).toBe(true);
  expect(await page.evaluate(() => BibleTranslationLoader.isLoaded('web'))).toBe(true);
  expect(await page.evaluate(() => BibleTranslationLoader.ensure('web'))).toBe(true);
  expect(requests).toBe(2);
});

test('controlled online load validates and promotes WEB after one acquisition', async ({page}) => {
  const requested = watchTranslationRequests(page);
  await installAndControl(page);

  expect(await page.evaluate(() => BibleTranslationLoader.ensure('web'))).toBe(true);
  const metadata = await page.evaluate(() => BibleTranslationManifest.web);
  await expect(workerMessage(page, {type:'BIBLE_TRANSLATION_STATUS', id:'web'})).resolves.toMatchObject({
    ok:true,
    activeRevision:metadata.revision,
    active:{id:'web', revision:metadata.revision, integrity:metadata.integrity, bytes:metadata.bytes}
  });
  expect(await page.evaluate(() => BibleData.validateTranslation('web'))).toBe(true);
  expect(requested.filter(path => path === '/js/bible/web.js')).toHaveLength(1);
  await expect(page.locator('script[data-bible-translation="web"]')).toHaveAttribute('integrity', metadata.integrity);
});

test('retained translations support offline Reader, Search, and Compare while missing KJV retries online', async ({page, context}) => {
  await installAndControl(page);
  expect(await page.evaluate(() => Promise.all([
    BibleTranslationLoader.ensure('web'),
    BibleTranslationLoader.ensure('asv')
  ]))).toEqual([true, true]);

  await context.setOffline(true);
  await page.reload({waitUntil:'domcontentloaded'});
  expect(await page.evaluate(() => BibleTranslationLoader.ensure('web'))).toBe(true);
  expect(await page.evaluate(() => initializeBibleExperience())).toBe(true);
  await expect(page.locator('#readerContent')).toContainText('John 1');

  await page.locator('#searchInput').fill('John 3:16');
  await page.getByRole('button', {name:'Search', exact:true}).click();
  await expect(page.locator('#results .result-card')).toHaveCount(1);
  await page.getByRole('button', {name:'Compare', exact:true}).click();
  await expect(page.locator('#compareGrid [data-compare-index="0"]')).toHaveValue('web');
  await expect(page.locator('#compareGrid [data-compare-index="1"]')).toHaveValue('asv');

  expect(await page.evaluate(() => BibleTranslationLoader.ensure('kjv'))).toBe(false);
  await expect(page.locator('script[data-bible-translation="kjv"]')).toHaveCount(0);
  await context.setOffline(false);
  expect(await page.evaluate(() => BibleTranslationLoader.ensure('kjv'))).toBe(true);
});

test('SRI failure is controlled and retryable', async ({page}) => {
  let requests = 0;
  await page.route('**/js/bible/web.js*', route => {
    requests++;
    if(requests === 1) return route.fulfill({
      status:200,
      contentType:'application/javascript',
      body:'var webLibrary = {};'
    });
    return route.continue();
  });
  await page.goto('/');

  expect(await page.evaluate(() => BibleTranslationLoader.ensure('web'))).toBe(false);
  await expect(page.locator('script[data-bible-translation="web"]')).toHaveCount(0);
  expect(await page.evaluate(() => BibleTranslationLoader.ensure('web'))).toBe(true);
  expect(requests).toBe(2);
});

test('promotion failure does not break online reading and retention retries without reloading', async ({page}) => {
  await installAndControl(page);
  await page.evaluate(() => {
    const original = ServiceWorker.prototype.postMessage;
    let failed = false;
    ServiceWorker.prototype.postMessage = function(message, transfer){
      if(message && message.type === 'BIBLE_TRANSLATION_PROMOTE' && !failed){
        failed = true;
        transfer[0].postMessage({ok:false, error:'test-promotion-failure'});
        return;
      }
      return original.call(this, message, transfer);
    };
  });

  expect(await page.evaluate(() => BibleTranslationLoader.ensure('web'))).toBe(true);
  expect(await page.evaluate(() => BibleData.validateTranslation('web'))).toBe(true);
  await expect(workerMessage(page, {type:'BIBLE_TRANSLATION_STATUS', id:'web'})).resolves.toMatchObject({
    activeRevision:null
  });

  expect(await page.evaluate(() => BibleTranslationLoader.ensure('web'))).toBe(true);
  await expect.poll(() => workerMessage(page, {type:'BIBLE_TRANSLATION_STATUS', id:'web'})).toMatchObject({
    activeRevision:'e05fd1ce8dd85087'
  });
  await expect(page.locator('script[data-bible-translation="web"]')).toHaveCount(1);
});

test('active last-known-good WEB loads when current revision acquisition fails', async ({page, context}) => {
  await installAndControl(page);
  expect(await page.evaluate(() => BibleTranslationLoader.ensure('web'))).toBe(true);
  const active = await workerMessage(page, {type:'BIBLE_TRANSLATION_STATUS', id:'web'});
  expect(active.active.structure).toEqual(
    await page.evaluate(() => BibleTranslationManifest.web.structure)
  );
  await page.reload({waitUntil:'domcontentloaded'});
  await page.evaluate(() => {
    BibleTranslationManifest.web.revision = 'aaaaaaaaaaaaaaaa';
    BibleTranslationManifest.web.integrity = 'sha256-AAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAA=';
    BibleTranslationManifest.web.structure = {
      bookCount:1,
      chapterCount:1,
      verseCount:1,
      books:[['john', 1, 1]]
    };
  });
  await context.setOffline(true);

  expect(await page.evaluate(() => BibleTranslationLoader.ensure('web'))).toBe(true);
  expect(await page.evaluate(() => BibleData.validateTranslation('web'))).toBe(false);
  expect(await page.evaluate(async () => {
    const status = await new Promise(resolve => {
      const channel = new MessageChannel();
      channel.port1.onmessage = event => resolve(event.data);
      navigator.serviceWorker.controller.postMessage({
        type:'BIBLE_TRANSLATION_STATUS', id:'web'
      }, [channel.port2]);
    });
    return BibleData.validateTranslation('web', status.active.structure);
  })).toBe(true);
  await expect(page.locator('script[data-bible-translation="web"]')).toHaveAttribute(
    'src', /\/__god4\/bible-cache\/active-script\/web\/e05fd1ce8dd85087\.js$/
  );
});
