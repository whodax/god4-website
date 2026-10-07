const {test, expect} = require('@playwright/test');
const fs = require('fs');
const path = require('path');

const root = path.resolve(__dirname, '..');
const ids = ['web', 'asv', 'kjv', 'ylt', 'dby', 'webster', 'rv', 'gnv'];
const names = [
  'World English Bible Protestant Edition',
  'American Standard Version (1901)',
  'King James Version',
  'Young’s Literal Translation',
  'Darby Translation',
  'Webster Bible (1833)',
  'Revised Version (1895)',
  'Geneva Bible 1599'
];

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

async function openDialog(page) {
  // Avoid scrolling the Study Desk into view: that independently triggers the
  // Reader's visibility-based translation loading and is unrelated to this UI.
  await page.evaluate(() => document.getElementById('offlineBiblesTrigger').click());
  await expect(page.locator('#offlineBiblesDialog')).toBeVisible();
  await expect(page.locator('#offlineBiblesList .offline-bibles-row')).toHaveCount(8);
  await expect(page.locator('#offlineBiblesList .offline-bibles-row-status').first()).not.toHaveText('Checking availability');
}

async function installListMock(page, states, retainResult) {
  await page.evaluate(({states, retainResult}) => {
    const original = ServiceWorker.prototype.postMessage;
    window.__managementMessages = [];
    ServiceWorker.prototype.postMessage = function(message, transfer){
      if(message && message.type === 'BIBLE_TRANSLATION_LIST') {
        window.__managementMessages.push(message.type);
        const items = Object.keys(BibleTranslationManifest).map(id => {
          const entry = BibleTranslationManifest[id];
          const state = states[id] || 'not-retained';
          return {
            id,
            currentRevision:entry.revision,
            currentBytes:entry.bytes,
            active:state === 'not-retained' ? null : {
              id,
              revision:state === 'update-available' ? 'aaaaaaaaaaaaaaaa' : entry.revision,
              path:entry.path,
              integrity:entry.integrity,
              bytes:entry.bytes,
              structure:entry.structure
            },
            state
          };
        });
        transfer[0].postMessage({ok:true, items});
        return;
      }
      return original.call(this, message, transfer);
    };
    if(retainResult) BibleTranslationLoader.retain = async function(){ return retainResult; };
  }, {states, retainResult});
}

test.beforeEach(async ({page}) => {
  page.runtimeErrors = [];
  page.on('pageerror', error => page.runtimeErrors.push(error.message));
  await page.addInitScript(() => {
    window.__cspViolations = [];
    window.addEventListener('securitypolicyviolation', event => {
      window.__cspViolations.push({directive:event.effectiveDirective, blockedURI:event.blockedURI});
    });
  });
});

test.afterEach(async ({page}) => {
  expect(page.runtimeErrors).toEqual([]);
  expect(await page.evaluate(() => window.__cspViolations || [])).toEqual([]);
});

test('dialog lists fresh translations without downloading and provides modal keyboard behavior', async ({page}) => {
  await page.addInitScript(() => {
    // Keep the Reader's independent visibility prefetch out of this management-only test.
    window.IntersectionObserver = class {
      observe() {}
      unobserve() {}
      disconnect() {}
      takeRecords() { return []; }
    };
  });
  const requested = [];
  page.on('request', request => {
    if(/\/js\/bible\/(?:web|asv|kjv|ylt|dby|webster|rv|gnv)\.js$/.test(new URL(request.url()).pathname)) {
      requested.push(request.url());
    }
  });
  await installAndControl(page);
  await page.evaluate(() => {
    const original = ServiceWorker.prototype.postMessage;
    window.__managementMessages = [];
    ServiceWorker.prototype.postMessage = function(message, transfer){
      window.__managementMessages.push(message.type);
      return original.call(this, message, transfer);
    };
  });
  const trigger = page.locator('#offlineBiblesTrigger');
  await expect(trigger).toHaveAttribute('aria-haspopup', 'dialog');
  await expect(trigger).toHaveAttribute('aria-controls', 'offlineBiblesDialog');
  await expect(trigger).toHaveAttribute('aria-expanded', 'false');
  await expect(trigger.locator('xpath=parent::*')).toHaveClass(/bs-nav/);
  await expect(page.locator('#view-reader .reader-toolbar > #fullscreenBtn')).toHaveCount(1);

  await openDialog(page);
  await expect(trigger).toHaveAttribute('aria-expanded', 'true');
  await expect(page.locator('#offlineBiblesTitle')).toBeFocused();
  await expect(page.locator('.offline-bibles-name')).toHaveText(names);
  await expect(page.locator('.offline-bibles-row-status')).toHaveText(Array(8).fill('Not downloaded'));
  await expect(page.locator('.offline-bibles-action')).toHaveText(Array(8).fill('Download'));
  await expect(page.getByRole('button', {name:'Download American Standard Version (1901) for offline reading'})).toBeVisible();
  await expect(page.locator('#offlineBiblesStorage')).toHaveText('Offline Bibles: 0.0 MiB');
  expect(requested).toEqual([]);
  expect(await page.evaluate(() => window.__managementMessages)).toEqual(['BIBLE_TRANSLATION_LIST']);
  expect(await page.evaluate(() => caches.keys())).toEqual(['god4-shell-compact-reader-15']);

  await page.keyboard.press('Shift+Tab');
  await expect(page.getByRole('button', {name:'Download Geneva Bible 1599 for offline reading'})).toBeFocused();
  await page.keyboard.press('Tab');
  await expect(page.locator('#offlineBiblesClose')).toBeFocused();
  await page.keyboard.press('Escape');
  await expect(page.locator('#offlineBiblesDialog')).toBeHidden();
  await expect(trigger).toBeFocused();
  await expect(trigger).toHaveAttribute('aria-expanded', 'false');

  await page.evaluate(() => document.getElementById('offlineBiblesTrigger').click());
  await page.locator('#offlineBiblesClose').click();
  await expect(trigger).toBeFocused();
  expect(requested).toEqual([]);
  expect(await page.evaluate(() => window.__managementMessages)).toEqual([
    'BIBLE_TRANSLATION_LIST',
    'BIBLE_TRANSLATION_LIST'
  ]);
});

test('dialog and Study Desk controls fit a 320px viewport', async ({page}) => {
  await page.setViewportSize({width:320, height:720});
  await installAndControl(page);
  await openDialog(page);
  const sizes = await page.evaluate(() => ({
    navigationFits:document.querySelector('.bs-nav').scrollWidth <=
      document.querySelector('.bs-nav').clientWidth,
    dialogFits:document.querySelector('#offlineBiblesDialog').scrollWidth <=
      document.querySelector('#offlineBiblesDialog').clientWidth,
    rowFits:[...document.querySelectorAll('.offline-bibles-row')].every(row =>
      row.scrollWidth <= row.clientWidth)
  }));
  expect(sizes).toEqual({navigationFits:true, dialogFits:true, rowFits:true});
});

test('Download shows a per-row busy state, deduplicates clicks, and updates exact storage', async ({page}) => {
  test.setTimeout(60000);
  const requested = [];
  page.on('request', request => {
    if(new URL(request.url()).pathname === '/js/bible/web.js') requested.push(request.url());
  });
  await installAndControl(page);
  await openDialog(page);
  const webRow = page.locator('.offline-bibles-row[data-translation-id="web"]');
  const webAction = webRow.locator('.offline-bibles-action');
  await webAction.click();
  await expect(webRow).toHaveAttribute('aria-busy', 'true');
  await expect(webRow.locator('.offline-bibles-row-status')).toHaveText('Downloading.');
  await expect(webAction).toBeDisabled();
  await expect(page.locator('[data-translation-id="asv"] .offline-bibles-action')).toBeEnabled();
  await webAction.dispatchEvent('click');

  await expect(webRow.locator('.offline-bibles-row-status')).toHaveText('Available offline');
  await expect(page.locator('#offlineBiblesStatus')).toContainText('is available offline');
  await expect(page.locator('#offlineBiblesStorage')).toHaveText('Offline Bibles: 4.0 MiB');
  expect(requested).toHaveLength(1);
  await expect(page.locator('script[data-bible-translation="web"]')).toHaveCount(1);
  await page.locator('#offlineBiblesClose').click();
  await openDialog(page);
  expect(requested).toHaveLength(1);
});

test('Update uses retain and preserves Update available after a failure', async ({page}) => {
  await installAndControl(page);
  await installListMock(page, {web:'update-available'}, {
    ok:false, id:'web', state:'update-available', error:'active-write'
  });
  await openDialog(page);
  const row = page.locator('[data-translation-id="web"]');
  await expect(row.locator('.offline-bibles-row-status')).toHaveText('Update available');
  await expect(row.locator('.offline-bibles-action')).toHaveText('Update');
  await expect(row.locator('.offline-bibles-action')).toHaveAttribute(
    'aria-label', 'Update World English Bible Protestant Edition for offline reading'
  );
  await row.locator('.offline-bibles-action').click();
  await expect(row.locator('.offline-bibles-row-status')).toHaveText('Update available');
  await expect(page.locator('#offlineBiblesStatus')).toContainText('browser storage');
  await expect(row.locator('.offline-bibles-action')).toBeEnabled();
});

test('successful Update moves to Available offline', async ({page}) => {
  await installAndControl(page);
  await page.evaluate(() => {
    let current = false;
    const original = ServiceWorker.prototype.postMessage;
    ServiceWorker.prototype.postMessage = function(message, transfer){
      if(message && message.type === 'BIBLE_TRANSLATION_LIST') {
        const items = Object.keys(BibleTranslationManifest).map(id => {
          const entry = BibleTranslationManifest[id];
          const state = id === 'web' ? (current ? 'current' : 'update-available') : 'not-retained';
          return {id, currentRevision:entry.revision, currentBytes:entry.bytes,
            active:state === 'not-retained' ? null : {id, revision:current ? entry.revision : 'aaaaaaaaaaaaaaaa', bytes:entry.bytes}, state};
        });
        transfer[0].postMessage({ok:true, items});
        return;
      }
      return original.call(this, message, transfer);
    };
    BibleTranslationLoader.retain = async function(){
      current = true;
      return {ok:true, id:'web', state:'current'};
    };
  });
  await openDialog(page);
  const row = page.locator('[data-translation-id="web"]');
  await row.locator('.offline-bibles-action').click();
  await expect(row.locator('.offline-bibles-row-status')).toHaveText('Available offline');
  await expect(page.locator('#offlineBiblesStatus')).toContainText('is available offline');
});

test('Remove isolates one translation, works offline, and leaves the current session usable', async ({page, context}) => {
  await installAndControl(page);
  expect(await page.evaluate(() => Promise.all([
    BibleTranslationLoader.retain('web'),
    BibleTranslationLoader.retain('asv')
  ]))).toEqual([
    {ok:true, id:'web', state:'current'},
    {ok:true, id:'asv', state:'current'}
  ]);
  await openDialog(page);
  await expect(page.locator('#offlineBiblesStorage')).toHaveText('Offline Bibles: 8.1 MiB');
  await context.setOffline(true);
  await page.evaluate(() => window.dispatchEvent(new Event('offline')));
  await expect(page.locator('[data-translation-id="web"] .offline-bibles-action'))
    .toHaveAttribute('aria-label', 'Remove World English Bible Protestant Edition from offline storage');
  await expect(page.locator('[data-translation-id="web"] .offline-bibles-action')).toBeEnabled();
  await page.locator('[data-translation-id="web"] .offline-bibles-action').click();
  await expect(page.locator('[data-translation-id="web"] .offline-bibles-row-status')).toHaveText('Not downloaded');
  await expect(page.locator('[data-translation-id="asv"] .offline-bibles-row-status')).toHaveText('Available offline');
  await expect(page.locator('#offlineBiblesStatus')).toContainText('current reading session may continue');
  expect(await page.evaluate(() => BibleTranslationLoader.isLoaded('web'))).toBe(true);
  await page.locator('#offlineBiblesClose').click();
  await page.reload({waitUntil:'domcontentloaded'});
  expect(await page.evaluate(() => BibleTranslationLoader.ensure('web'))).toBe(false);
  expect(await page.evaluate(() => BibleTranslationLoader.ensure('asv'))).toBe(true);
});

test('offline disables Download and Update while Remove remains available and reconnect does not start work', async ({page, context}) => {
  await installAndControl(page);
  await installListMock(page, {web:'current', asv:'update-available'}, null);
  await openDialog(page);
  await context.setOffline(true);
  await page.evaluate(() => window.dispatchEvent(new Event('offline')));
  await expect(page.locator('[data-translation-id="web"] .offline-bibles-action')).toBeEnabled();
  await expect(page.locator('[data-translation-id="asv"] .offline-bibles-action')).toBeDisabled();
  await expect(page.locator('[data-translation-id="kjv"] .offline-bibles-action')).toBeDisabled();
  await expect(page.locator('#offlineBiblesStatus')).toContainText('require a connection');
  await context.setOffline(false);
  await page.evaluate(() => window.dispatchEvent(new Event('online')));
  await expect(page.locator('[data-translation-id="asv"] .offline-bibles-action')).toBeEnabled();
  await expect(page.locator('[data-translation-id="kjv"] .offline-bibles-action')).toBeEnabled();
  expect(await page.evaluate(() => window.__managementMessages)).toEqual(['BIBLE_TRANSLATION_LIST']);
});

test('storage estimate succeeds and falls back when unavailable or rejected', async ({page}) => {
  await page.addInitScript(() => {
    Object.defineProperty(navigator, 'storage', {
      configurable:true,
      value:{estimate:() => Promise.resolve({usage:13 * 1024 * 1024, quota:1024 * 1024 * 1024})}
    });
  });
  await installAndControl(page);
  await openDialog(page);
  await expect(page.locator('#offlineSiteStorage')).toHaveText('Site storage: 13.0 MiB of 1.0 GiB');

  await page.evaluate(() => {
    Object.defineProperty(navigator, 'storage', {
      configurable:true,
      value:{estimate:() => Promise.reject(new Error('unavailable'))}
    });
  });
  await page.locator('#offlineBiblesClose').click();
  await openDialog(page);
  await expect(page.locator('#offlineSiteStorage')).toHaveText('Browser storage estimate unavailable.');

  await page.evaluate(() => {
    Object.defineProperty(navigator, 'storage', {configurable:true, value:undefined});
  });
  await page.locator('#offlineBiblesClose').click();
  await openDialog(page);
  await expect(page.locator('#offlineSiteStorage')).toHaveText('Browser storage estimate unavailable.');
});

test('unsupported LIST preserves the explicit update lifecycle', async ({page}) => {
  await installAndControl(page);
  await page.evaluate(() => {
    const original = ServiceWorker.prototype.postMessage;
    window.__messages = [];
    ServiceWorker.prototype.postMessage = function(message, transfer){
      window.__messages.push(message.type);
      if(message.type === 'BIBLE_TRANSLATION_LIST') {
        transfer[0].postMessage(null);
        return;
      }
      return original.call(this, message, transfer);
    };
  });
  await openDialog(page);
  await expect(page.locator('#offlineBiblesStatus')).toHaveText(
    'Offline Bible controls will be available after the app update is applied.'
  );
  expect(await page.evaluate(() => window.__messages)).toEqual(['BIBLE_TRANSLATION_LIST']);
});

test('download failures are concise, mapped, and retryable', async ({page}) => {
  await installAndControl(page);
  await installListMock(page, {}, {ok:false, id:'web', state:'not-retained', error:'network'});
  await openDialog(page);
  const action = page.locator('[data-translation-id="web"] .offline-bibles-action');
  const cases = [
    ['network', 'A connection is required to download this Bible.'],
    ['service-worker-unavailable', 'Offline Bible controls are unavailable right now. Please try again.'],
    ['validation', 'That Bible could not be verified. Please try again.'],
    ['active-write', 'That Bible could not be saved. Check browser storage and try again.'],
    ['quota', "There isn't enough browser storage to save this Bible. Free some space and try again."]
  ];
  for(const [error, message] of cases) {
    await page.evaluate(error => {
      BibleTranslationLoader.retain = async function(){
        return {ok:false, id:'web', state:'not-retained', error};
      };
    }, error);
    await action.click();
    await expect(page.locator('#offlineBiblesStatus')).toHaveText(message);
    await expect(action).toBeEnabled();
    await expect(action).toHaveText('Download');
  }
});

test('removal failure preserves the retained state and remains retryable', async ({page}) => {
  await installAndControl(page);
  await installListMock(page, {web:'current'}, null);
  await page.evaluate(() => {
    const previous = ServiceWorker.prototype.postMessage;
    ServiceWorker.prototype.postMessage = function(message, transfer){
      if(message && message.type === 'BIBLE_TRANSLATION_REMOVE') {
        transfer[0].postMessage({ok:false, id:message.id, error:'active-delete'});
        return;
      }
      return previous.call(this, message, transfer);
    };
  });
  await openDialog(page);
  const action = page.locator('[data-translation-id="web"] .offline-bibles-action');
  await action.click();
  await expect(page.locator('[data-translation-id="web"] .offline-bibles-row-status')).toHaveText('Available offline');
  await expect(page.locator('#offlineBiblesStatus')).toHaveText(
    'That offline Bible could not be removed. Please try again.'
  );
  await expect(action).toBeEnabled();
  await expect(action).toHaveText('Remove');
});

test('management module has no page Cache Storage, blob, eval, or inline fallback', async () => {
  const source = fs.readFileSync(path.join(root, 'js', 'pwa', 'offline-translations.js'), 'utf8');
  expect(source).not.toMatch(/caches\s*\.|blob:|createObjectURL|eval\s*\(|innerHTML/);
  expect(source).not.toMatch(/skipWaiting|location\.reload/);
  expect(source).toContain("workerMessage('BIBLE_TRANSLATION_LIST')");
  expect(source).toContain("BibleTranslationLoader.retain(translationId)");
  expect(source).toContain("workerMessage('BIBLE_TRANSLATION_REMOVE', translationId)");
});
