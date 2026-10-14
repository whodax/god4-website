const {test, expect} = require('@playwright/test');
const fs = require('fs');
const path = require('path');
const {startCspServer} = require('./csp-server');
const runtimePath = '**/js/pwa/offline-translations.js';
const runtimeSource = fs.readFileSync(path.join(__dirname, '..', 'js/pwa/offline-translations.js'), 'utf8');

test.use({serviceWorkers:'block'});
test.beforeEach(async ({page}) => {
  page.errors = [];
  page.on('pageerror', error => page.errors.push(error.message));
  await page.addInitScript(() => {
    window.IntersectionObserver = class { observe() {} unobserve() {} disconnect() {} };
    window.__cspViolations = [];
    window.addEventListener('securitypolicyviolation', event => __cspViolations.push(event.effectiveDirective));
  });
});
test.afterEach(async ({page}) => {
  expect(page.errors).toEqual([]);
  expect(await page.evaluate(() => __cspViolations)).toEqual([]);
});

async function mockWorker(page, states = {}) {
  await page.evaluate(states => {
    window.__states = states;
    window.__lists = [];
    window.__holdList = false;
    window.__removes = 0;
    window.__listResponse = function(states = __states){
      return {ok:true, items:Object.keys(BibleTranslationManifest).map(id => {
        const entry = BibleTranslationManifest[id], state = states[id] || 'not-retained';
        return {id, currentRevision:entry.revision, currentBytes:entry.bytes, state,
          active:state === 'not-retained' ? null : {id, bytes:entry.bytes, revision:entry.revision}};
      })};
    };
    Object.defineProperty(navigator.serviceWorker, 'controller', {configurable:true, value:{
      postMessage(message, ports){
        if(message.type === 'BIBLE_TRANSLATION_LIST'){
          __lists.push(ports[0]);
          if(!__holdList) ports[0].postMessage(__listResponse());
        } else if(message.type === 'BIBLE_TRANSLATION_REMOVE'){
          __removes++;
          __states[message.id] = 'not-retained';
          ports[0].postMessage({ok:true});
        }
      }
    }});
  }, states);
}
async function activate(page) {
  await page.evaluate(() => document.getElementById('offlineBiblesTrigger').click());
  await expect(page.locator('.offline-bibles-row')).toHaveCount(8);
  await expect(page.locator('.offline-bibles-row-status').first()).not.toHaveText('Checking availability');
}
async function dismiss(page, escape = false) {
  if(escape) await page.keyboard.press('Escape');
  else await page.locator('#offlineBiblesClose').click();
  await expect(page.locator('#offlineBiblesTrigger')).toBeFocused();
  await expect(page.locator('#offlineBiblesDialog')).toBeHidden();
}
async function delayedRuntime(page) {
  let release;
  const gate = new Promise(resolve => { release = resolve; });
  let requests = 0;
  await page.route(runtimePath, async route => { requests++; await gate; await route.continue(); });
  return {release, requests:() => requests};
}

test('document eagerly loads only the facade; unrelated interaction does not load runtime', async ({page}) => {
  const requested = [];
  page.on('request', request => requested.push(new URL(request.url()).pathname));
  await page.goto('/');
  await page.locator('#offlineBiblesTrigger').focus();
  await page.locator('#offlineBiblesTrigger').hover();
  await page.evaluate(() => {
    window.dispatchEvent(new Event('online'));
    window.dispatchEvent(new Event('offline'));
    document.getElementById('readerMoreTrigger').click();
    document.getElementById('readerTranslation').dispatchEvent(new Event('change'));
  });
  expect(requested).toContain('/js/pwa/offline-translations-loader.js');
  expect(requested).not.toContain('/js/pwa/offline-translations.js');
  expect(await page.evaluate(() => typeof OfflineBiblesRuntime)).toBe('undefined');
});

for(const input of ['click', 'Enter', 'Space', 'programmatic']){
  test(`${input} preserves first activation while runtime is delayed`, async ({page}) => {
    const load = await delayedRuntime(page);
    await page.goto('/');
    await mockWorker(page);
    const trigger = page.locator('#offlineBiblesTrigger');
    if(input === 'click') await trigger.click();
    else if(input === 'programmatic') await trigger.evaluate(element => element.click());
    else { await trigger.focus(); await page.keyboard.press(input); }
    await expect(page.locator('#offlineBiblesDialog')).toBeVisible();
    await expect(page.locator('#offlineBiblesTitle')).toBeFocused();
    await expect(page.locator('#offlineBiblesDialog')).toHaveAttribute('aria-busy', 'true');
    await expect(page.locator('#offlineBiblesStatus')).toHaveText('Loading offline Bible controls.');
    load.release();
    await expect(page.locator('.offline-bibles-row')).toHaveCount(8);
    await expect(page.locator('.offline-bibles-action').first()).toBeEnabled();
    await expect(page.locator('#offlineBiblesDialog')).toHaveAttribute('aria-busy', 'false');
    await expect(page.locator('#offlineBiblesTitle')).toBeFocused();
    expect(load.requests()).toBe(1);
  });
}

test('shared readiness and repeated activation initialize catalog/listeners once', async ({page}) => {
  const load = await delayedRuntime(page);
  await page.goto('/');
  await mockWorker(page);
  await page.evaluate(() => {
    const list = BibleData.listTranslations;
    window.__catalogReads = 0;
    BibleData.listTranslations = function(){ __catalogReads++; return list(); };
    document.getElementById('offlineBiblesTrigger').click();
    document.getElementById('offlineBiblesTrigger').click();
  });
  expect(await page.evaluate(() => OfflineBiblesLoader.ensure() === OfflineBiblesLoader.ensure())).toBe(true);
  load.release();
  await expect(page.locator('.offline-bibles-action').first()).toBeEnabled();
  await page.evaluate(() => { OfflineBiblesRuntime.initialize(); OfflineBiblesRuntime.initialize(); });
  expect(await page.evaluate(() => __catalogReads)).toBe(1);
  expect(await page.evaluate(() => __lists.length)).toBe(1);
  expect(load.requests()).toBe(1);
  await expect(page.locator('script[src="/js/pwa/offline-translations.js"]')).toHaveCount(1);
  await dismiss(page);
  await activate(page);
  expect(load.requests()).toBe(1);
  expect(await page.evaluate(() => __catalogReads)).toBe(1);
});

for(const escape of [false, true]){
  test(`${escape ? 'Escape' : 'Close'} before readiness prevents late open and focus steal`, async ({page}) => {
    const load = await delayedRuntime(page);
    await page.goto('/');
    await mockWorker(page);
    await page.locator('#offlineBiblesTrigger').evaluate(element => element.click());
    await dismiss(page, escape);
    await page.locator('#searchInput').focus();
    load.release();
    await page.evaluate(() => OfflineBiblesLoader.ensure());
    await expect(page.locator('#offlineBiblesDialog')).toBeHidden();
    await expect(page.locator('#searchInput')).toBeFocused();
    expect(await page.evaluate(() => __lists.length)).toBe(0);
    await activate(page);
    expect(load.requests()).toBe(1);
  });
}

test('rapid open close open keeps the latest activation including queued close events', async ({page}) => {
  const load = await delayedRuntime(page);
  await page.goto('/');
  await mockWorker(page);
  await page.evaluate(() => {
    document.getElementById('offlineBiblesTrigger').click();
    document.getElementById('offlineBiblesClose').click();
    document.getElementById('offlineBiblesTrigger').click();
  });
  load.release();
  await expect(page.locator('.offline-bibles-action').first()).toBeEnabled();
  await expect(page.locator('#offlineBiblesDialog')).toBeVisible();
  await expect(page.locator('#offlineBiblesTitle')).toBeFocused();
  expect(await page.evaluate(() => __lists.length)).toBe(1);
  expect(load.requests()).toBe(1);
});

for(const invalid of [false, true]){
  test(`${invalid ? 'invalid API' : 'network failure'} is accessible and retryable`, async ({page}) => {
    let requests = 0;
    await page.route(runtimePath, route => {
      if(++requests === 1) return invalid ? route.fulfill({contentType:'application/javascript', body:'window.__incompleteRuntime = true;'}) : route.abort();
      return route.continue();
    });
    await page.goto('/');
    await mockWorker(page);
    await page.locator('#offlineBiblesTrigger').evaluate(element => element.click());
    await expect(page.locator('#offlineBiblesStatus')).toContainText('could not be loaded');
    await expect(page.locator('#offlineBiblesDialog')).toHaveAttribute('aria-busy', 'false');
    await expect(page.locator('script[src="/js/pwa/offline-translations.js"]')).toHaveCount(0);
    await dismiss(page);
    await activate(page);
    expect(requests).toBe(2);
    await expect(page.locator('script[src="/js/pwa/offline-translations.js"]')).toHaveCount(1);
  });
}

test('retry preserves a loaded API when initialization was temporarily unavailable', async ({page}) => {
  let requests = 0;
  await page.route(runtimePath, route => {
    requests++;
    return route.fulfill({contentType:'application/javascript', body:runtimeSource + `
      var originalInitialize = OfflineBiblesRuntime.initialize, failedOnce = false;
      OfflineBiblesRuntime.initialize = function(){
        if(!failedOnce){ failedOnce = true; return false; }
        return originalInitialize();
      };`});
  });
  await page.goto('/');
  await mockWorker(page);
  await page.locator('#offlineBiblesTrigger').evaluate(element => element.click());
  await expect(page.locator('#offlineBiblesStatus')).toContainText('could not be loaded');
  await dismiss(page);
  await activate(page);
  expect(requests).toBe(1);
  await expect(page.locator('script[src="/js/pwa/offline-translations.js"]')).toHaveCount(1);
});

test('initialization uses current connectivity and retained state without replay or work', async ({page}) => {
  const load = await delayedRuntime(page);
  await page.goto('/');
  await mockWorker(page, {web:'current', asv:'update-available'});
  await page.evaluate(() => {
    window.dispatchEvent(new Event('online'));
    Object.defineProperty(navigator, 'onLine', {configurable:true, value:false});
    window.dispatchEvent(new Event('offline'));
    document.getElementById('offlineBiblesTrigger').click();
  });
  load.release();
  await expect(page.locator('[data-translation-id="web"] .offline-bibles-action')).toBeEnabled();
  await expect(page.locator('.offline-bibles-action:disabled')).toHaveCount(7);
  await expect(page.locator('#offlineBiblesStatus')).toContainText('require a connection');
  expect(await page.evaluate(() => __lists.length)).toBe(1);
  expect(await page.evaluate(() => __removes)).toBe(0);
});

test('close reopen during LIST ignores old response and keeps heading focus', async ({page}) => {
  await page.goto('/');
  await mockWorker(page);
  await page.evaluate(() => { __holdList = true; document.getElementById('offlineBiblesTrigger').click(); });
  await expect.poll(() => page.evaluate(() => __lists.length)).toBe(1);
  await dismiss(page);
  await page.locator('#offlineBiblesTrigger').evaluate(element => element.click());
  await expect.poll(() => page.evaluate(() => __lists.length)).toBe(2);
  await page.evaluate(() => __lists[0].postMessage(__listResponse({web:'current'})));
  await expect(page.locator('.offline-bibles-row-status').first()).toHaveText('Checking availability');
  await page.evaluate(() => __lists[1].postMessage(__listResponse()));
  await expect(page.locator('.offline-bibles-row-status').first()).toHaveText('Not downloaded');
  await expect(page.locator('#offlineBiblesTitle')).toBeFocused();
});

test('older action refresh can supersede opening LIST without leaving checking status or announcing success', async ({page}) => {
  await page.goto('/');
  await mockWorker(page);
  await page.evaluate(() => {
    BibleTranslationLoader.retain = () => new Promise(resolve => { window.__finishRetain = resolve; });
  });
  await activate(page);
  await page.locator('[data-translation-id="web"] .offline-bibles-action').click();
  await dismiss(page);
  await page.evaluate(() => { __holdList = true; document.getElementById('offlineBiblesTrigger').click(); });
  await expect.poll(() => page.evaluate(() => __lists.length)).toBe(2);
  await page.evaluate(() => { __states.web = 'current'; __finishRetain({ok:true}); });
  await expect.poll(() => page.evaluate(() => __lists.length)).toBe(3);
  await page.evaluate(() => __lists[2].postMessage(__listResponse()));
  await expect(page.locator('[data-translation-id="web"] .offline-bibles-action')).toHaveText('Remove');
  await expect(page.locator('#offlineBiblesStatus')).toHaveText('');
  await page.evaluate(() => __lists[1].postMessage(__listResponse({web:'not-retained'})));
  await expect(page.locator('[data-translation-id="web"] .offline-bibles-action')).toHaveText('Remove');
  await expect(page.locator('#offlineBiblesTitle')).toBeFocused();
});

test('rerender preserves logical action focus or falls back to Close when disabled', async ({page}) => {
  await page.goto('/');
  await mockWorker(page, {web:'current'});
  await activate(page);
  const web = page.locator('[data-translation-id="web"] .offline-bibles-action');
  const asv = page.locator('[data-translation-id="asv"] .offline-bibles-action');
  await web.focus();
  await page.evaluate(() => window.dispatchEvent(new Event('online')));
  await expect(web).toBeFocused();
  await asv.focus();
  await page.evaluate(() => {
    Object.defineProperty(navigator, 'onLine', {configurable:true, value:false});
    window.dispatchEvent(new Event('offline'));
  });
  await expect(page.locator('#offlineBiblesClose')).toBeFocused();
  await expect(asv).toBeDisabled();
});

for(const reopen of [false, true]){
  test(`download survives dismissal${reopen ? ' and reopen' : ''} without stale announcement or focus`, async ({page}) => {
    await page.goto('/');
    await mockWorker(page);
    await page.evaluate(() => {
      window.__retains = 0;
      BibleTranslationLoader.retain = () => { __retains++; return new Promise(resolve => { window.__finishRetain = resolve; }); };
    });
    await activate(page);
    const action = page.locator('[data-translation-id="web"] .offline-bibles-action');
    await action.click();
    await action.dispatchEvent('click');
    await expect(action).toBeDisabled();
    await expect(page.locator('#offlineBiblesClose')).toBeFocused();
    await dismiss(page);
    if(reopen){
      await page.evaluate(() => { __states.web = 'current'; });
      await activate(page);
      await expect(action).toBeDisabled();
      await action.dispatchEvent('click');
      expect(await page.evaluate(() => __removes)).toBe(0);
      await page.locator('#offlineBiblesClose').focus();
      await page.evaluate(() => window.dispatchEvent(new Event('online')));
    } else await page.locator('#searchInput').focus();
    const previous = await page.locator('#offlineBiblesStatus').textContent();
    await page.evaluate(() => { __states.web = 'current'; __finishRetain({ok:true, id:'web', state:'current'}); });
    if(reopen) await expect(action).toBeEnabled();
    else await page.evaluate(() => new Promise(resolve => setTimeout(resolve, 50)));
    expect(await page.locator('#offlineBiblesStatus').textContent()).toBe(previous);
    await expect(page.locator(reopen ? '#offlineBiblesClose' : '#searchInput')).toBeFocused();
    expect(await page.evaluate(() => __retains)).toBe(1);
  });
}

test('same-origin classic activation works under unchanged enforcing CSP at 320px', async ({page}) => {
  const server = await startCspServer();
  try {
    await page.setViewportSize({width:320, height:720});
    await page.goto(server.origin);
    await mockWorker(page);
    await activate(page);
    expect(await page.locator('#offlineBiblesDialog').evaluate(element => element.scrollWidth <= element.clientWidth)).toBe(true);
    await expect(page.locator('#offlineBiblesDialog')).toHaveAttribute('aria-labelledby', 'offlineBiblesTitle');
    await expect(page.locator('#offlineBiblesStatus')).toHaveAttribute('aria-atomic', 'true');
    await page.keyboard.press('Shift+Tab');
    await expect(page.locator('[data-translation-id="gnv"] .offline-bibles-action')).toBeFocused();
    await page.keyboard.press('Tab');
    await expect(page.locator('#offlineBiblesClose')).toBeFocused();
    await dismiss(page, true);
    await expect(page.locator('script[src="/js/pwa/offline-translations.js"]')).toHaveAttribute('src', '/js/pwa/offline-translations.js');
  } finally { await server.close(); }
});
