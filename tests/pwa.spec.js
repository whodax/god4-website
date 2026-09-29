const {test, expect} = require('@playwright/test');
const fs = require('fs');
const path = require('path');

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
  expect(state.names).toEqual(['god4-shell-230d01a-pwa2']);
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
  await page.route('https://apkiqgxmfqohznxpqfcx.supabase.co/**', route => route.fulfill({
    status: 200,
    contentType: 'application/json',
    headers: {'Access-Control-Allow-Origin': '*'},
    body: '{}'
  }));
  await page.evaluate(async () => {
    await fetch('/private-probe', {headers: {Authorization: 'Bearer test-only'}});
    await fetch('/auth/callback/?code=test-only');
    await fetch('/cdn-cgi/challenge-platform/test-only').catch(() => {});
    await fetch('https://apkiqgxmfqohznxpqfcx.supabase.co/auth/v1/user').catch(() => {});
  });

  const urls = await cachedUrls(page);
  expect(urls.some(url => /private-probe|auth\/callback|cdn-cgi|supabase\.co/.test(url))).toBe(false);
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
  expect(source).toContain("event.data.type === 'ACTIVATE_UPDATE'");

  await page.goto('/');
  await expect(page.locator('#pwaStatus')).toBeHidden();
  await expect(page.locator('#pwaUpdateButton')).toBeHidden();
});
