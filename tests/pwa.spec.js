const {expectPlanFocusVisible}=require('./plan-focus-helpers');
const {test, expect} = require('@playwright/test');
const fs = require('fs');
const path = require('path');
const translationManifestGenerator = require('../tools/generate-translation-manifest.js');

const root = path.resolve(__dirname, '..');
const translationPattern = /\/js\/bible\/(?:web|asv|kjv|ylt|dby|webster|rv|gnv|dra)\.js$/;
const shellCacheName = 'god4-shell-compact-reader-38';

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
  expect(state.names).toEqual([shellCacheName]);
  expect(state.urls).toContain('/offline');
  expect(state.urls).toContain('/js/app.js');
  expect(state.urls).toContain('/js/bible/cloud-tts.js');
  expect(state.urls.some(url => url.startsWith('/api/tts') || url.startsWith('/__god4/tts/'))).toBe(false);
  expect(state.urls).toContain('/js/pwa/offline-translations-loader.js');
  expect(state.urls).toContain('/js/pwa/offline-translations.js');
  expect(state.urls).not.toContain('/js/vendor/supabase-js-2.117.0.min.js');
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

test('new Reader shell replaces the prior shell while retaining an Offline Bible', async ({page}) => {
  const canonicalWeb = translationManifestGenerator.canonicalDeployBytes(
    fs.readFileSync(path.join(root, 'js', 'bible', 'web.js'))
  );
  await page.context().route('**/js/bible/web.js?god4-revision=*', route => route.fulfill({
    status:200, contentType:'application/javascript', body:canonicalWeb
  }));
  await installAndControl(page);
  const revision = await page.evaluate(() => BibleTranslationManifest.web.revision);
  await expect(workerMessage(page, {type:'BIBLE_TRANSLATION_ACQUIRE', id:'web', revision}))
    .resolves.toMatchObject({ok:true, state:'candidate'});
  await expect(workerMessage(page, {type:'BIBLE_TRANSLATION_PROMOTE', id:'web', revision}))
    .resolves.toMatchObject({ok:true, state:'ready'});

  await page.evaluate(async () => {
    const oldShell = await caches.open('god4-shell-compact-reader-28');
    await oldShell.put('/', new Response('prior shell'));
    const registration = await navigator.serviceWorker.getRegistration();
    await registration.unregister();
  });
  await page.reload({waitUntil:'domcontentloaded'});
  await page.evaluate(() => navigator.serviceWorker.ready.then(() => true));
  if(!await page.evaluate(() => Boolean(navigator.serviceWorker.controller))){
    await page.reload({waitUntil:'domcontentloaded'});
  }
  await expect.poll(() => page.evaluate(() => caches.keys())).toEqual([
    shellCacheName, 'god4-bible-candidates-v1', 'god4-bible-ready-v1'
  ]);
  const cachedShell = await page.evaluate(async () => {
    const shell = await caches.open('god4-shell-compact-reader-38');
    const css = await (await shell.match('/css/components.css')).text();
    const html = await (await shell.match('/')).text();
    const reader = await (await shell.match('/js/bible/reader.js')).text();
    const study = await (await shell.match('/js/word-study/controller.js')).text();
    return {searchReflow:css.includes('min-width:0'), sharedFullscreen:html.includes('id="fullscreenBtn"'),
      senseSelector:Boolean(await shell.match('/js/word-study/sense-selector.js')),
      emptyVerseHandling:reader.includes('function isRenderableVerseText(text)'),
      navigationPosition:reader.includes('function scrollReaderStartIntoView()'),
      studyInvalidation:study.includes('function invalidate()')};
  });
  expect(cachedShell).toEqual({searchReflow:true, sharedFullscreen:true, senseSelector:true, emptyVerseHandling:true,
    navigationPosition:true, studyInvalidation:true});
  await page.evaluate(()=>WordStudyLoader.ensure());
  expect(await page.evaluate(() => OriginalLanguageWordStudyProvider.resolveOriginalLanguageReference({
    translationId:'web', bookId:'romans', chapter:14, verse:24
  }))).toEqual({bookId:'romans', chapter:16, verse:25});
  expect(await page.evaluate(() => OriginalLanguageWordStudyProvider.lookup({
    lookupTerm:'constructor', displayWord:'constructor'
  }))).toMatchObject({status:'unavailable', strongsNumber:null});
  await expect(workerMessage(page, {type:'BIBLE_TRANSLATION_STATUS', id:'web'}))
    .resolves.toMatchObject({ok:true, activeRevision:revision});
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

  const freshList = await workerMessage(page, {
    type:'BIBLE_TRANSLATION_LIST',
    revision:'caller-controlled',
    path:'/caller-controlled.js',
    url:'https://example.com/not-used.js',
    method:'POST',
    authorization:'Bearer not-used'
  });
  expect(freshList.ok).toBe(true);
  expect(freshList.items.map(item => item.id)).toEqual([
    'web', 'asv', 'kjv', 'ylt', 'dby', 'webster', 'rv', 'gnv', 'dra'
  ]);
  expect(freshList.items.every(item => item.state === 'not-retained' && item.active === null)).toBe(true);
  expect(await page.evaluate(() => caches.keys())).toEqual([shellCacheName]);
  await expect(workerMessage(page, {
    type:'BIBLE_TRANSLATION_REMOVE',
    id:'not-approved'
  })).resolves.toMatchObject({ok:false, error:'not-approved'});

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

  expect(await page.evaluate(() => caches.keys())).toEqual([shellCacheName]);
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
    shellCacheName,
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
    const shell = await caches.open('god4-shell-compact-reader-38');
    return (await shell.keys())
      .map(request => new URL(request.url).pathname)
      .filter(pathname => /\/js\/bible\/(?:web|asv|kjv|ylt|dby|webster|rv|gnv|dra)\.js$/.test(pathname));
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

  const retainedList = await workerMessage(page, {type:'BIBLE_TRANSLATION_LIST'});
  expect(retainedList.items.find(item => item.id === 'web')).toEqual({
    id:'web',
    currentRevision:metadata.revision,
    currentBytes:metadata.bytes,
    active:expectedActive,
    state:'current'
  });

  await expect(workerMessage(page, {
    type:'BIBLE_TRANSLATION_REMOVE',
    id:'web',
    revision:'caller-controlled',
    path:'/caller-controlled.js',
    url:'https://example.com/not-used.js',
    method:'POST',
    authorization:'Bearer not-used'
  })).resolves.toEqual({
    ok:true,
    id:'web',
    state:'not-retained',
    removedRevision:metadata.revision,
    cleanupWarnings:[]
  });
  await expect(workerMessage(page, {
    type:'BIBLE_TRANSLATION_STATUS',
    id:'web'
  })).resolves.toMatchObject({activeRevision:null, active:null});
  const postRemovalState = await page.evaluate(async () => {
    const shell = await caches.open('god4-shell-compact-reader-38');
    const ready = await caches.open('god4-bible-ready-v1');
    return {
      shellHasApp:Boolean(await shell.match('/js/app.js')),
      readyKeys:(await ready.keys()).map(request => new URL(request.url).pathname)
    };
  });
  expect(postRemovalState).toEqual({shellHasApp:true, readyKeys:[]});
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
  expect(source).toContain("data.type === 'BIBLE_TRANSLATION_LIST'");
  expect(source).toContain("data.type === 'BIBLE_TRANSLATION_REMOVE'");
  expect(source).toContain('serveActive(activeMatch[1], activeMatch[2])');

  const loaderSource = fs.readFileSync(path.join(root, 'js', 'bible', 'translation-loader.js'), 'utf8');
  expect(loaderSource).not.toMatch(/caches\s*\.|blob:|createObjectURL|eval\s*\(|innerHTML/);
  expect(loaderSource).toContain('script.integrity = integrity');

  await page.goto('/');
  await expect(page.locator('#pwaStatus')).toBeHidden();
  await expect(page.locator('#pwaUpdateButton')).toBeHidden();
});

test('first-ever Offline Bibles activation works offline after shell installation without online activation', async ({page, context}) => {
  await page.addInitScript(() => {
    window.IntersectionObserver = class { observe() {} unobserve() {} disconnect() {} };
  });
  await installAndControl(page);
  expect(await page.evaluate(() => typeof OfflineBiblesRuntime)).toBe('undefined');
  expect(await page.locator('.offline-bibles-row').count()).toBe(0);
  const assets = await page.evaluate(async () => {
    const cache = await caches.open('god4-shell-compact-reader-38');
    return Promise.all(['/js/pwa/offline-translations-loader.js', '/js/pwa/offline-translations.js'].map(async key => Boolean(await cache.match(key))));
  });
  expect(assets).toEqual([true, true]);
  await context.setOffline(true);
  await page.reload({waitUntil:'domcontentloaded'});
  expect(await page.evaluate(() => typeof OfflineBiblesRuntime)).toBe('undefined');
  await page.evaluate(() => document.getElementById('offlineBiblesTrigger').click());
  await expect(page.locator('.offline-bibles-row-status')).toHaveText(Array(9).fill('Not downloaded'));
  await expect(page.locator('#offlineBiblesTitle')).toBeFocused();
  const resource = await page.evaluate(() => {
    const entry = performance.getEntriesByType('resource').find(value => value.name.endsWith('/js/pwa/offline-translations.js'));
    return {workerStart:entry.workerStart, transfer:entry.transferSize};
  });
  expect(resource.workerStart).toBeGreaterThan(0);
  expect(resource.transfer).toBe(0);
  await page.keyboard.press('Escape');
  await expect(page.locator('#offlineBiblesTrigger')).toBeFocused();
});

test('active Offline Bibles waits for explicit shell 37 to 38 acceptance and preserves Bible/vendor caches', async ({page}) => {
  test.setTimeout(60000);
  const http = require('http');
  let version = 37;
  const priorShellSource = require('child_process').execFileSync('git', ['show', '27952a4be229a7f324e75a5e985093774e6df2d3:sw.js'], {encoding:'utf8'});
  const types = {'.html':'text/html', '.js':'application/javascript', '.css':'text/css', '.json':'application/json', '.webmanifest':'application/manifest+json', '.png':'image/png'};
  const server = http.createServer((request, response) => {
    const pathname = new URL(request.url, 'http://localhost').pathname;
    const relative = pathname === '/' ? '/index.html' : pathname === '/offline' ? '/offline.html' : pathname;
    const file = path.resolve(root, '.' + relative);
    if(!file.startsWith(root + path.sep)){ response.writeHead(403).end(); return; }
    try {
      let body = fs.readFileSync(file);
      if(pathname === '/sw.js') body = Buffer.from(version === 37 ? priorShellSource : body);
      if(translationPattern.test(pathname)) body = translationManifestGenerator.canonicalDeployBytes(body);
      response.writeHead(200, {'content-type':types[path.extname(file)] || 'application/octet-stream', 'cache-control':'no-store'});
      response.end(body);
    } catch(error){ response.writeHead(404).end(); }
  });
  await new Promise(resolve => server.listen(0, '127.0.0.1', resolve));
  const origin = 'http://127.0.0.1:' + server.address().port;
  try {
    await page.addInitScript(() => {
      window.IntersectionObserver = class { observe() {} unobserve() {} disconnect() {} };
    });
    await page.goto(origin);
    await page.evaluate(() => navigator.serviceWorker.ready.then(() => true));
    await page.reload({waitUntil:'domcontentloaded'});
    expect(await page.evaluate(() => BibleTranslationLoader.retain('web'))).toMatchObject({ok:true});
    await page.evaluate(() => fetch('/js/vendor/supabase-js-2.117.0.min.js').then(response => response.arrayBuffer()));
    await expect.poll(() => page.evaluate(() => caches.keys())).toContain('god4-auth-vendor-supabase-js-2.117.0');
    await page.evaluate(() => document.getElementById('offlineBiblesTrigger').click());
    await expect(page.locator('[data-translation-id="web"] .offline-bibles-action')).toHaveText('Remove');
    version = 38;
    await page.evaluate(async () => { const registration = await navigator.serviceWorker.getRegistration(); await registration.update(); });
    await expect(page.locator('#pwaStatusMessage')).toHaveText('A GOD4.us update is ready.');
    await expect(page.locator('#offlineBiblesDialog')).toBeVisible();
    expect(await page.evaluate(() => caches.keys())).toContain('god4-shell-compact-reader-37');
    expect(await page.evaluate(async () => (await (await caches.open('god4-shell-compact-reader-37')).keys()).map(request => new URL(request.url).pathname))).toContain('/js/bible/scripture-picker.js');
    await page.keyboard.press('Escape');
    // The actionable update notice must also coexist with the Plan return control.
    await page.setViewportSize({width:320,height:720});
    await page.getByRole('button',{name:'Plan',exact:true}).click();
    expect(await page.evaluate(()=>openJourneyDay(1))).toBe(true);
    await page.evaluate(()=>scrollReaderTargetIntoView(document.querySelector('#readerContent [data-verse-number="20"]'),'instant'));
    await expect(page.locator('#readerBackToPlan')).toBeInViewport();
    await page.locator('#readerBackToPlan').click();
    await expect(page.locator('#view-plan')).toHaveClass(/active/);
    await expect(page.locator('#pwaUpdateButton')).toBeVisible();
    await Promise.all([page.waitForEvent('load'), page.locator('#pwaUpdateButton').click()]);
    await expect.poll(() => page.evaluate(() => caches.keys())).not.toContain('god4-shell-compact-reader-37');
    const keys = await page.evaluate(() => caches.keys());
    expect(keys).toContain('god4-shell-compact-reader-38');
    expect(await page.evaluate(async () => (await (await caches.open('god4-shell-compact-reader-38')).keys()).map(request => new URL(request.url).pathname))).toContain('/js/bible/scripture-picker.js');
    expect(keys).toContain('god4-bible-ready-v1');
    expect(keys).toContain('god4-auth-vendor-supabase-js-2.117.0');
    await expect(workerMessage(page, {type:'BIBLE_TRANSLATION_STATUS', id:'web'})).resolves.toMatchObject({ok:true, active:{id:'web'}});
    expect(await page.evaluate(() => typeof OfflineBiblesRuntime)).toBe('undefined');
    await page.evaluate(() => document.getElementById('offlineBiblesTrigger').click());
    await expect(page.locator('[data-translation-id="web"] .offline-bibles-action')).toHaveText('Remove');
  } finally {
    await page.goto('about:blank');
    await new Promise(resolve => server.close(resolve));
  }
});

for(const retained of [false,true])test('first offline Plan day '+(retained?'uses retained Scripture':'fails accessibly without Scripture'),async({page,context})=>{
  await page.addInitScript(()=>{window.IntersectionObserver=class {observe(){} unobserve(){} disconnect(){}};});
  await installAndControl(page);
  if(retained) expect(await page.evaluate(()=>BibleTranslationLoader.retain('web'))).toMatchObject({ok:true});
  await page.reload({waitUntil:'domcontentloaded'});
  expect(await page.evaluate(()=>bibleExperienceReady)).toBe(false);
  const assets=await cachedUrls(page);
  expect(assets.some(url=>new URL(url).pathname==='/js/bible/plans.js')).toBe(true);
  expect(assets.some(url=>new URL(url).pathname==='/js/bible/reading-journey.js')).toBe(true);
  await context.setOffline(true);
  await page.getByRole('button',{name:'Plan',exact:true}).click();
  const navigated=await page.evaluate(()=>openJourneyDay(1));
  expect(navigated).toBe(retained);
  if(retained){
    await expect(page.locator('#readerContent h2')).toHaveText('Matthew 1');
    expect(await page.evaluate(()=>activePlanReadingSession)).toMatchObject({day:1,translationId:'web'});
    expect(await page.evaluate(()=>UserData.journey.load().plans[0])).toEqual([1]);
    await page.locator('#readerBackToPlan').click();
    await expect(page.locator('[data-plan-day="2"]')).toBeFocused();
  }else{
    await expect(page.locator('#view-plan')).toHaveClass(/active/);
    await expect(page.locator('#journeyStatus')).toContainText('Reading unavailable');
    expect(await page.evaluate(()=>activePlanReadingSession)).toBeNull();
    expect(await page.evaluate(()=>UserData.journey.load().plans[0])).toEqual([]);
    expect(await page.evaluate(()=>history.state?.god4PlanReaderSession)).toBeFalsy();
  }
});

test('missing preferred offline translation does not complete a Plan day using fallback Scripture',async({page,context})=>{
  await page.addInitScript(()=>{window.IntersectionObserver=class {observe(){} unobserve(){} disconnect(){}};});
  await installAndControl(page);
  expect(await page.evaluate(()=>BibleTranslationLoader.retain('web'))).toMatchObject({ok:true});
  await page.evaluate(()=>UserData.translation.save('asv'));
  await page.reload({waitUntil:'domcontentloaded'});
  expect(await page.evaluate(()=>currentTranslation)).toBe('asv');
  await context.setOffline(true);
  await page.getByRole('button',{name:'Plan',exact:true}).click();
  expect(await page.evaluate(()=>openJourneyDay(1))).toBe(false);
  await expect(page.locator('#view-plan')).toHaveClass(/active/);
  await expect(page.locator('#journeyStatus')).toContainText('Reading unavailable');
  expect(await page.evaluate(()=>activePlanReadingSession)).toBeNull();
  expect(await page.evaluate(()=>UserData.journey.load().plans[0])).toEqual([]);
});

for(const width of [390,320])for(const retained of [true,false])test('offline Plan '+(retained?'cold return':'failure')+' keeps full focus visible at '+width+'x720',async({page,context})=>{
  await page.setViewportSize({width,height:720});
  await page.addInitScript(()=>{window.IntersectionObserver=class {observe(){} unobserve(){} disconnect(){}};});
  await installAndControl(page);
  if(retained) expect(await page.evaluate(()=>BibleTranslationLoader.retain('web'))).toMatchObject({ok:true});
  await context.setOffline(true);
  await page.reload({waitUntil:'domcontentloaded'});
  await page.evaluate(()=>document.fonts.ready);
  await page.getByRole('button',{name:'Plan',exact:true}).press('Enter');
  await page.keyboard.press('Tab');
  await expect(page.locator('#offlineBiblesTrigger')).toBeFocused();
  await page.keyboard.press('Tab');
  await expectPlanFocusVisible(page,page.locator('[data-plan-day="1"]'));
  await page.keyboard.press(width===390?'Enter':'Space');
  if(retained){
    await expect(page.locator('#readerContent h2')).toHaveText('Matthew 1');
    await page.locator('#readerBackToPlan').press(width===390?'Enter':'Space');
    await expectPlanFocusVisible(page,page.locator('[data-plan-day="2"]'));
    expect(await page.evaluate(()=>journeyState.plans[0])).toEqual([1]);
  }else{
    await expect(page.locator('#journeyStatus')).toContainText('Reading unavailable');
    await expectPlanFocusVisible(page,page.locator('[data-plan-day="1"]'));
    expect(await page.evaluate(()=>journeyState.plans[0])).toEqual([]);
    expect(await page.evaluate(()=>activePlanReadingSession)).toBeNull();
  }
});
