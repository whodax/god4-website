const {test, expect} = require('@playwright/test');
const fs = require('fs');
const path = require('path');
const translationManifestGenerator = require('../tools/generate-translation-manifest.js');

const root = path.resolve(__dirname, '..');
const translationPattern = /\/js\/bible\/(?:web|asv|kjv|ylt|dby|webster|rv|gnv)\.js$/;

async function installAndControl(page) {
  await page.goto('/');
  await page.evaluate(() => navigator.serviceWorker.ready.then(() => true));
  if(!await page.evaluate(() => Boolean(navigator.serviceWorker.controller))) {
    await page.reload({waitUntil: 'domcontentloaded'});
  }
  await expect.poll(() => page.evaluate(() => Boolean(navigator.serviceWorker.controller))).toBe(true);
}

async function cachedUrls(page) {
  return page.evaluate(async () => {
    const urls = [];
    for(const name of await caches.keys()) {
      const cache = await caches.open(name);
      urls.push(...(await cache.keys()).map(request => request.url));
    }
    return urls;
  });
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

test('manifest contains install metadata and correctly sized PNG icons', async ({request}) => {
  const response = await request.get('/manifest.webmanifest');
  expect(response.ok()).toBe(true);
  expect(response.headers()['content-type']).toMatch(/(?:manifest\+json|application\/json)/i);
  const manifest = await response.json();
  expect(manifest).toMatchObject({
    id: '/', start_url: '/', scope: '/', display: 'standalone',
    background_color: '#EDE3C8', theme_color: '#1B2A44'
  });
  expect(manifest.name).toContain('GOD4.us');
  expect(manifest.icons.map(icon => icon.sizes)).toEqual(['192x192', '512x512', '512x512']);
  expect(manifest.icons.some(icon => icon.purpose === 'maskable')).toBe(true);

  for(const icon of manifest.icons) {
    const iconResponse = await request.get(icon.src);
    expect(iconResponse.ok()).toBe(true);
    expect(iconResponse.headers()['content-type']).toMatch(/image\/png/i);
  }
});

test('service worker installs a versioned shell without requesting or caching translations', async ({page}) => {
  const translationRequests = [];
  page.on('request', request => {
    if(translationPattern.test(new URL(request.url()).pathname)) translationRequests.push(request.url());
  });

  await page.goto('/');
  await page.evaluate(() => navigator.serviceWorker.ready.then(() => true));

  expect(translationRequests).toEqual([]);
  const state = await page.evaluate(async () => {
    const names = await caches.keys();
    const urls = [];
    for(const name of names) {
      const cache = await caches.open(name);
      urls.push(...(await cache.keys()).map(request => new URL(request.url).pathname));
    }
    return {names, urls};
  });
  expect(state.names).toEqual(['god4-shell-33bda91-phase2c1']);
  expect(state.urls).toContain('/offline');
  expect(state.urls).toContain('/js/app.js');
  expect(state.urls.some(url => translationPattern.test(url))).toBe(false);

  const fallback = await page.evaluate(async () => {
    const response = await caches.match('/offline');
    return response && {
      ok: response.ok,
      redirected: response.redirected,
      pathname: new URL(response.url).pathname,
      body: await response.clone().text()
    };
  });
  expect(fallback).toMatchObject({ok: true, redirected: false, pathname: '/offline'});
  expect(fallback.body).toContain('You are offline');
});


test('worker translation protocol requires approved messages, promotes explicitly, and survives re-registration', async ({page}) => {
  const canonicalWeb = translationManifestGenerator.canonicalDeployBytes(
    fs.readFileSync(path.join(root, 'js', 'bible', 'web.js'))
  );
  await page.context().route('**/js/bible/web.js?god4-revision=*', route => route.fulfill({
    status:200,
    contentType:'application/javascript',
    body:canonicalWeb
  }));
  await installAndControl(page);
  const metadata = await page.evaluate(() => BibleTranslationManifest.web);
  const expectedActive = {
    id:metadata.id,
    revision:metadata.revision,
    path:metadata.path,
    integrity:metadata.integrity,
    bytes:metadata.bytes,
    structure:metadata.structure
  };

  await expect(workerMessage(page, {
    type:'BIBLE_TRANSLATION_ACQUIRE',
    id:'not-approved',
    revision:metadata.revision,
    url:'/js/bible/web.js'
  })).resolves.toMatchObject({ok:false, error:'not-approved'});
  await expect(workerMessage(page, {
    type:'BIBLE_TRANSLATION_ACQUIRE',
    id:'web',
    revision:'aaaaaaaaaaaaaaaa',
    url:'/js/bible/web.js'
  })).resolves.toMatchObject({ok:false, error:'not-approved'});

  expect(await page.evaluate(() => caches.keys())).toEqual(['god4-shell-33bda91-phase2c1']);
  expect(await page.evaluate(() => BibleData.isTranslationLoaded('web'))).toBe(false);

  const candidate = await workerMessage(page, {
    type:'BIBLE_TRANSLATION_ACQUIRE',
    id:'web',
    revision:metadata.revision,
    url:'https://example.com/not-used.js',
    method:'POST',
    authorization:'Bearer not-used'
  });
  expect(candidate).toMatchObject({
    ok:true,
    id:'web',
    revision:metadata.revision,
    state:'candidate',
    cached:false
  });
  expect(await page.evaluate(() => BibleData.isTranslationLoaded('web'))).toBe(false);

  const candidateState = await page.evaluate(async () => {
    const names = await caches.keys();
    const candidateCache = await caches.open('god4-bible-candidates-v1');
    const candidates = (await candidateCache.keys()).map(request => new URL(request.url).pathname);
    return {names, candidates};
  });
  expect(candidateState.names).toEqual([
    'god4-shell-33bda91-phase2c1',
    'god4-bible-candidates-v1'
  ]);
  expect(candidateState.candidates).toEqual([
    '/__god4/bible-cache/candidate/web/' + metadata.revision
  ]);

  await expect(workerMessage(page, {
    type:'BIBLE_TRANSLATION_STATUS',
    id:'web'
  })).resolves.toMatchObject({ok:true, activeRevision:null});

  const promotion = await workerMessage(page, {
    type:'BIBLE_TRANSLATION_PROMOTE',
    id:'web',
    revision:metadata.revision,
    url:'/not-used',
    path:'/caller-controlled.js',
    integrity:'sha256-caller-controlled',
    bytes:1,
    structure:{bookCount:999, chapterCount:999, verseCount:999, books:[]}
  });
  expect(promotion).toMatchObject({
    ok:true,
    id:'web',
    revision:metadata.revision,
    state:'ready',
    previousRevision:null
  });

  const promotedState = await page.evaluate(async () => {
    const candidates = await caches.open('god4-bible-candidates-v1');
    const ready = await caches.open('god4-bible-ready-v1');
    return {
      candidateKeys:(await candidates.keys()).map(request => new URL(request.url).pathname),
      readyKeys:(await ready.keys()).map(request => new URL(request.url).pathname).sort()
    };
  });
  expect(promotedState.candidateKeys).toEqual([]);
  expect(promotedState.readyKeys).toEqual([
    '/__god4/bible-cache/active/web',
    '/__god4/bible-cache/ready/web/' + metadata.revision
  ].sort());
  const activeStatus = await workerMessage(page, {
    type:'BIBLE_TRANSLATION_STATUS',
    id:'web'
  });
  expect(activeStatus).toEqual({
    ok:true,
    id:'web',
    activeRevision:metadata.revision,
    active:expectedActive
  });
  const storedActive = await page.evaluate(async () => {
    const ready = await caches.open('god4-bible-ready-v1');
    const response = await ready.match('/__god4/bible-cache/active/web');
    return response.json();
  });
  expect(storedActive).toEqual(expectedActive);

  const shellTranslationEntries = await page.evaluate(async () => {
    const shell = await caches.open('god4-shell-33bda91-phase2c1');
    return (await shell.keys())
      .map(request => new URL(request.url).pathname)
      .filter(pathname => /\/js\/bible\/(?:web|asv|kjv|ylt|dby|webster|rv|gnv)\.js$/.test(pathname));
  });
  expect(shellTranslationEntries).toEqual([]);

  await page.evaluate(async () => {
    const registration = await navigator.serviceWorker.getRegistration();
    await registration.unregister();
  });
  await page.reload({waitUntil:'domcontentloaded'});
  await page.evaluate(() => navigator.serviceWorker.ready.then(() => true));
  if(!await page.evaluate(() => Boolean(navigator.serviceWorker.controller))) {
    await page.reload({waitUntil:'domcontentloaded'});
  }

  await expect(workerMessage(page, {
    type:'BIBLE_TRANSLATION_STATUS',
    id:'web'
  })).resolves.toEqual({
    ok:true,
    id:'web',
    activeRevision:metadata.revision,
    active:expectedActive
  });
});

test('canonical homepage and controlled fallback remain usable offline', async ({page, context}) => {
  await installAndControl(page);
  await context.setOffline(true);

  await page.goto('/', {waitUntil: 'domcontentloaded'});
  await expect(page.getByRole('heading', {name: /Scripture, kept open/i})).toBeVisible();
  await page.evaluate(() => window.dispatchEvent(new Event('offline')));
  await expect(page.locator('#pwaStatus')).toBeVisible();
  await expect(page.locator('#pwaStatusMessage')).toContainText('offline');
  await expect(page.locator('#readerContent')).toBeEmpty();

  await page.goto('/not-available-offline', {waitUntil: 'domcontentloaded'});
  await expect(page.getByRole('heading', {name: 'You are offline'})).toBeVisible();
  await expect(page.getByRole('link', {name: 'Return home'})).toHaveAttribute('href', '/');
});

test('auth callbacks and authorized or Cloudflare traffic are never added to Cache Storage', async ({page}) => {
  await installAndControl(page);

  await page.route('**/private-probe', route => route.fulfill({status: 200, body: 'private'}));
  await page.route('**/non-get-probe', route => route.fulfill({status: 200, body: 'not cached'}));
  await page.route('**/unapproved-script.js', route => route.fulfill({
    status:200, contentType:'application/javascript', body:'/* unapproved */'
  }));
  await page.route('https://static.cloudflareinsights.com/**', route => route.fulfill({
    status:200,
    contentType:'application/javascript',
    headers:{'Access-Control-Allow-Origin':'*'},
    body:'/* analytics probe */'
  }));
  await page.route('https://apkiqgxmfqohznxpqfcx.supabase.co/**', route => route.fulfill({
    status: 200,
    contentType: 'application/json',
    headers: {'Access-Control-Allow-Origin': '*'},
    body: '{}'
  }));
  await page.evaluate(async () => {
    await fetch('/private-probe', {headers: {Authorization: 'Bearer test-only'}});
    await fetch('/non-get-probe', {method:'POST', body:'test-only'});
    await fetch('/unapproved-script.js');
    await fetch('/auth/callback/?code=test-only');
    await fetch('/cdn-cgi/challenge-platform/test-only').catch(() => {});
    await fetch('https://static.cloudflareinsights.com/test-only.js').catch(() => {});
    await fetch('https://apkiqgxmfqohznxpqfcx.supabase.co/auth/v1/user').catch(() => {});
  });

  const urls = await cachedUrls(page);
  expect(urls.some(url => /private-probe|non-get-probe|unapproved-script|auth\/callback|cdn-cgi|cloudflareinsights|supabase\.co/.test(url))).toBe(false);
});

test('authentication callback uses the network and receives only the generic fallback offline', async ({page, context}) => {
  await installAndControl(page);
  await page.goto('/auth/callback/?code=test-only', {waitUntil: 'domcontentloaded'});
  expect((await cachedUrls(page)).some(url => /auth\/callback/.test(url))).toBe(false);

  await context.setOffline(true);
  await page.goto('/auth/callback/?code=test-only', {waitUntil: 'domcontentloaded'});
  await expect(page.getByRole('heading', {name: 'You are offline'})).toBeVisible();
  expect((await cachedUrls(page)).some(url => /auth\/callback/.test(url))).toBe(false);
});

test('updates wait for explicit visitor action and the normal status is unobtrusive', async ({page}) => {
  const source = fs.readFileSync(path.join(root, 'sw.js'), 'utf8');
  const installHandler = /addEventListener\('install',[\s\S]*?\n\}\);/.exec(source)?.[0] || '';
  expect(installHandler).not.toContain('skipWaiting');
  expect(source).toContain("data.type === 'ACTIVATE_UPDATE'");
  expect(source).toContain('serveActive(activeMatch[1], activeMatch[2])');

  const loaderSource = fs.readFileSync(path.join(root, 'js', 'bible', 'translation-loader.js'), 'utf8');
  expect(loaderSource).not.toMatch(/caches\s*\.|blob:|createObjectURL|eval\s*\(|innerHTML/);
  expect(loaderSource).toContain('script.integrity = integrity');

  await page.goto('/');
  await expect(page.locator('#pwaStatus')).toBeHidden();
  await expect(page.locator('#pwaUpdateButton')).toBeHidden();
});
