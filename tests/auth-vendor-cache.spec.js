const {test, expect} = require('@playwright/test');
const fs = require('fs');
const vm = require('vm');
const http = require('http');
const path = require('path');
const {webcrypto} = require('crypto');
const {execFileSync} = require('child_process');

const source = fs.readFileSync(require.resolve('../sw.js'), 'utf8');
const vendorBytes = fs.readFileSync(require.resolve('../js/vendor/supabase-js-2.117.0.min.js'));
const origin = 'http://127.0.0.1:4173';
const vendorPath = '/js/vendor/supabase-js-2.117.0.min.js';
const vendorCache = 'god4-auth-vendor-supabase-js-2.117.0';
const shell = 'god4-shell-compact-reader-48';
const previousShell = 'god4-shell-compact-reader-24';

function copy(response) {
  const clone = response.clone();
  Object.defineProperties(clone, {
    url:{value:response.url}, redirected:{value:response.redirected}
  });
  return clone;
}

function vendorResponse(options = {}) {
  const response = new Response(options.body || vendorBytes, {
    status:options.status || 200, headers:{'content-type':options.mime || 'application/javascript'}
  });
  Object.defineProperties(response, {
    url:{value:options.url || origin + vendorPath}, redirected:{value:Boolean(options.redirected)}
  });
  return response;
}

function worker() {
  const handlers = new Map(), storage = new Map(), requests = [];
  const state = {failPut:false, failKeys:false, networkFailure:false, response:null};
  const key = request => new URL(typeof request === 'string' ? request : request.url, origin).href;
  const caches = {
    async keys() { if(state.failKeys) throw new Error('Denied cache enumeration'); return [...storage.keys()]; },
    async delete(name) { return storage.delete(name); },
    async open(name) {
      if(!storage.has(name)) storage.set(name, new Map());
      const entries = storage.get(name);
      return {
        async match(request) { const response = entries.get(key(request)); return response && copy(response); },
        async put(request, response) {
          if(name === vendorCache && state.failPut) throw new Error('Vendor quota failure');
          entries.set(key(request), copy(response));
        },
        async delete(request) { return entries.delete(key(request)); },
        async addAll(paths) {
          const responses = await Promise.all(paths.map(path => fetchResponse(new Request(origin + path))));
          if(responses.some(response => !response.ok)) throw new Error('Install failure');
          paths.forEach((path, index) => entries.set(key(path), responses[index]));
        }
      };
    }
  };
  async function fetchResponse(request) {
    requests.push(request.url);
    if(new URL(request.url).pathname === vendorPath) {
      if(state.networkFailure) throw new TypeError('Controlled network failure');
      return state.response ? copy(state.response) : vendorResponse();
    }
    return new Response('current shell', {headers:{'content-type':'application/javascript'}});
  }
  const context = vm.createContext({
    self:{location:new URL(origin), addEventListener:(type, fn) => handlers.set(type, fn), skipWaiting() {}},
    importScripts() {}, BibleTranslationManifest:{}, BibleTranslationCacheProtocol:{create:() => ({})},
    caches, fetch:fetchResponse, URL, Request, Response, TextDecoder, TextEncoder,
    crypto:webcrypto, Uint8Array
  });
  vm.runInContext(source, context);
  return {
    state, requests, caches, storage,
    assets:vm.runInContext('SHELL_ASSETS', context),
    async event(type) { let work; handlers.get(type)({waitUntil:promise => work = promise}); await work; },
    async request(url = vendorPath, options = {}) {
      let work;
      handlers.get('fetch')({request:new Request(new URL(url, origin), options), respondWith:promise => work = promise});
      return work ? await work : null;
    },
    async seed(name, path, response) { await (await caches.open(name)).put(path, response); }
  };
}

test('current shell preserves vendor exclusion and precaches activation loaders', async () => {
  const h = worker();
  const baseline = execFileSync('git', ['show', 'aa082bca88e8e7a1e155041a567f40414069bd8e:sw.js'], {encoding:'utf8'});
  const oldAssets = vm.runInNewContext(baseline.match(/const SHELL_ASSETS = (\[[\s\S]*?\]);/)[1], {HOME_URL:'/', OFFLINE_URL:'/offline'});
  const expected=[...oldAssets].filter(path=>path!==vendorPath);expected.splice(expected.indexOf('/js/word-study/provider.js'),0,'/js/word-study/loader.js');expected.splice(expected.indexOf('/js/bible/compare.js'),0,'/js/bible/compare-loader.js');expected.splice(expected.indexOf('/js/pwa/offline-translations.js'),0,'/js/pwa/offline-translations-loader.js');
  expected.splice(expected.indexOf('/js/bible/reader.js')+1,0,'/js/bible/scripture-picker.js');
  expected.splice(expected.indexOf('/js/bible/data.js'),0,'/js/bible/canon.js');
  expected.splice(expected.indexOf('/js/word-study/controller.js')+1,0,'/js/word-study/alignment.js');
  expected.splice(expected.indexOf('/js/bible/reader.js')+1,0,'/js/bible/translation-picker.js');
  expected.splice(expected.indexOf('/js/bible/library.js'),0,'/css/theme.css','/js/theme.js');
  expect([...h.assets]).toEqual(expected);
  expect(h.assets).toHaveLength(49);
  h.state.networkFailure = true;
  await h.event('install');
  await h.event('activate');
  expect(h.requests).toHaveLength(49);
  expect(h.requests).not.toContain(origin + vendorPath);
  expect([...h.storage.keys()]).toEqual([shell]);
});

test('first fetch populates the dedicated cache, concurrent callers deduplicate, and later offline reads reuse it', async () => {
  const h = worker();
  const responses = await Promise.all([h.request(), h.request()]);
  expect(h.requests).toEqual([origin + vendorPath]);
  for(const response of responses) expect(Buffer.from(await response.arrayBuffer())).toEqual(vendorBytes);
  h.state.networkFailure = true;
  expect((await h.request()).status).toBe(200);
  expect(h.requests).toHaveLength(1);
  expect(await (await h.caches.open(vendorCache)).match(vendorPath)).toBeTruthy();
});

test('cold failure rejects normally and a later request retries', async () => {
  const h = worker();
  h.state.networkFailure = true;
  await expect(h.request()).rejects.toThrow('Controlled network failure');
  h.state.networkFailure = false;
  expect((await h.request()).status).toBe(200);
  expect(h.requests).toHaveLength(2);
});

const invalidResponses = [
  ['failed status', {status:404}],
  ['HTML MIME', {mime:'text/html'}],
  ['small script', {body:'/* incomplete */'}],
  ['different content under the same filename', {body:Buffer.alloc(218180, 32)}],
  ['older filename', {url:origin + '/js/vendor/supabase-js-2.116.0.min.js'}],
  ['cross-origin response', {url:'https://other.example' + vendorPath}],
  ['unexpected query', {url:origin + vendorPath + '?version=old'}],
  ['redirect', {redirected:true}]
];
for(const [reason, options] of invalidResponses) {
  test(`network ${reason} is returned but never cached`, async () => {
    const h = worker(); h.state.response = vendorResponse(options);
    expect(await h.request()).toBeTruthy();
    expect(h.storage.has(vendorCache)).toBe(false);
  });
  test(`cache-24 ${reason} is not promoted`, async () => {
    const h = worker();
    await h.seed(previousShell, vendorPath, vendorResponse(options));
    await h.event('activate');
    expect(h.storage.has(vendorCache)).toBe(false);
    expect(h.storage.has(previousShell)).toBe(false);
    expect(h.requests).toEqual([]);
  });
}

test('invalid runtime entry is replaced; text/javascript and CRLF copies are valid', async () => {
  const h = worker();
  await h.seed(vendorCache, vendorPath, vendorResponse({mime:'text/html'}));
  h.state.response = vendorResponse({mime:'text/javascript; charset=utf-8', body:vendorBytes.toString().replace(/\r?\n/g, '\r\n')});
  await h.request();
  expect(h.requests).toHaveLength(1);
  h.state.networkFailure = true;
  expect((await h.request()).status).toBe(200);
});

test('cache-24 migration uses no network and preserves current shell, translations and unrelated caches', async () => {
  const h = worker();
  await h.seed(previousShell, vendorPath, vendorResponse());
  for(const name of [shell, 'god4-bible-candidates-v1', 'god4-bible-ready-v1', 'unrelated-cache', 'god4-auth-vendor-supabase-js-2.116.0']) {
    await h.seed(name, '/probe', new Response('keep'));
  }
  h.state.networkFailure = true;
  await h.event('activate');
  expect(h.requests).toEqual([]);
  expect([...h.storage.keys()].sort()).toEqual([shell, vendorCache, 'god4-bible-candidates-v1', 'god4-bible-ready-v1', 'unrelated-cache'].sort());
  expect((await h.request()).status).toBe(200);
  expect(h.requests).toEqual([]);
});

test('filename mismatch is not discovered or promoted from the old shell', async () => {
  const h = worker();
  await h.seed(previousShell, '/js/vendor/supabase-js-2.116.0.min.js', vendorResponse());
  await h.event('activate');
  expect(h.storage.has(vendorCache)).toBe(false);
});

test('migration quota failure activates, retains the source, isolates shell reads, and retries promotion without network', async () => {
  const h = worker();
  await h.seed(previousShell, vendorPath, vendorResponse());
  await h.seed(previousShell, '/js/app.js', new Response('old shell'));
  await h.seed(shell, '/js/app.js', new Response('new shell'));
  h.state.failPut = true; h.state.networkFailure = true;
  await h.event('activate');
  expect(h.storage.has(previousShell)).toBe(true);
  expect(await (await h.request('/js/app.js')).text()).toBe('new shell');
  expect((await h.request()).status).toBe(200);
  expect(h.storage.has(previousShell)).toBe(true);
  h.state.failPut = false;
  expect((await h.request()).status).toBe(200);
  expect(h.storage.has(previousShell)).toBe(false);
  expect(h.requests).toEqual([]);
});

test('cache inspection failure cannot block activation or online vendor use', async () => {
  const h = worker(); h.state.failKeys = true;
  await h.event('activate');
  expect((await h.request()).status).toBe(200);
});

test('runtime quota failure does not discard a successful network response', async () => {
  const h = worker(); h.state.failPut = true;
  expect((await h.request()).status).toBe(200);
  h.state.failPut = false;
  expect((await h.request()).status).toBe(200);
  expect(h.requests).toHaveLength(2);
});

for(const [name, url, options] of [
  ['Authorization', vendorPath, {headers:{authorization:'Bearer synthetic-test-only'}}],
  ['POST', vendorPath, {method:'POST'}],
  ['cross-origin vendor', 'https://other.example' + vendorPath, {}],
  ['Supabase API', 'https://example.supabase.co/auth/v1/token', {}],
  ['callback controller', '/js/auth/callback.js?v=20260924-1', {}],
  ['query variant', vendorPath + '?version=old', {}],
  ['older SDK path', '/js/vendor/supabase-js-2.116.0.min.js', {}]
]) test(`${name} bypasses vendor caching`, async () => {
  const h = worker();
  expect(await h.request(url, options)).toBeNull();
  expect(h.storage.size).toBe(0);
});

async function install(page) {
  await page.goto('/');
  await page.evaluate(() => navigator.serviceWorker.ready.then(() => true));
  if(!await page.evaluate(() => Boolean(navigator.serviceWorker.controller))) await page.reload();
  await expect.poll(() => page.evaluate(() => Boolean(navigator.serviceWorker.controller))).toBe(true);
}

async function vendorPresent(page) {
  return page.evaluate(async ({name, path}) => {
    if(!(await caches.keys()).includes(name)) return false;
    return Boolean(await (await caches.open(name)).match(path));
  }, {name:vendorCache, path:vendorPath});
}

async function enableFixture(page) {
  await page.evaluate(async () => {
    const config = `var God4AuthConfig={enabled:true,authStorageKey:'sb-runtime-cache-test',supabaseUrl:'https://example.supabase.co',publishableKey:'test-public',allowedHosts:['127.0.0.1'],allowedOrigins:['http://127.0.0.1:4173'],callbackPath:'/auth/callback/'};`;
    await (await caches.open('god4-shell-compact-reader-48')).put('/js/auth/config.js', new Response(config, {headers:{'content-type':'application/javascript'}}));
  });
  await page.reload();
}

test('real worker install ignores vendor failure; cold offline Account remains accessible and reconnect retries', async ({page, context}) => {
  let blocked = true, requests = 0;
  await context.route('**/js/vendor/supabase-js-2.117.0.min.js', route => {
    requests++; return blocked ? route.abort() : route.continue();
  });
  await install(page);
  await enableFixture(page);
  expect(requests).toBe(0); expect(await vendorPresent(page)).toBe(false);
  expect(await page.evaluate(() => typeof God4Auth)).toBe('undefined');
  await context.setOffline(true);
  await page.locator('#accountTrigger').press('Enter');
  await expect(page.locator('#accountUnavailable')).toBeVisible();
  await expect(page.locator('#accountUnavailable')).toHaveAttribute('role', 'status');
  await expect(page.locator('#accountClose')).toBeFocused();
  await page.keyboard.press('Escape'); await expect(page.locator('#accountTrigger')).toBeFocused();
  blocked = false; await context.setOffline(false);
  await page.locator('#accountTrigger').press('Space');
  await page.evaluate(() => God4AuthLoader.ensure());
  await expect.poll(() => vendorPresent(page)).toBe(true);
  await expect(page.locator('#accountSignInForm')).toBeVisible();
});

test('real worker caches first Account vendor use and warm offline reload reuses it', async ({page, context}) => {
  let requests = 0;
  context.on('request', request => { if(request.serviceWorker() && new URL(request.url()).pathname === vendorPath) requests++; });
  await install(page); expect(await vendorPresent(page)).toBe(false);
  await page.locator('#accountTrigger').click(); await page.evaluate(() => God4AuthLoader.ensure());
  await expect.poll(() => vendorPresent(page)).toBe(true);
  expect(requests).toBe(1);
  await page.reload(); await page.locator('#accountTrigger').click(); await page.evaluate(() => God4AuthLoader.ensure());
  expect(requests).toBe(1);
  await context.setOffline(true); await page.reload();
  await page.locator('#accountTrigger').click(); await page.evaluate(() => God4AuthLoader.ensure());
  expect(await page.evaluate(() => typeof supabase.createClient)).toBe('function');
  expect(requests).toBe(1);
});

test('returning-session hint warms the vendor cache and an unexpired SDK fixture identity renders offline with one client/listener', async ({page, context}) => {
  await install(page);
  await page.evaluate(async () => {
    const config = `var God4AuthConfig={enabled:true,authStorageKey:'sb-runtime-cache-test',supabaseUrl:'https://example.supabase.co',publishableKey:'test-public',allowedHosts:['127.0.0.1'],allowedOrigins:['http://127.0.0.1:4173'],callbackPath:'/auth/callback/'};`;
    await (await caches.open('god4-shell-compact-reader-48')).put('/js/auth/config.js', new Response(config, {headers:{'content-type':'application/javascript'}}));
    localStorage.setItem('sb-runtime-cache-test', 'null');
  });
  await page.addInitScript(() => {
    window.clientCount = 0; window.subscriptionCount = 0;
    document.addEventListener('load', event => {
      if(event.target.tagName !== 'SCRIPT' || !event.target.src.includes('/vendor/supabase') || !window.supabase) return;
      const create = supabase.createClient;
      supabase.createClient = function(...args) {
        clientCount++;
        const client = create.apply(this, args), subscribe = client.auth.onAuthStateChange;
        client.auth.onAuthStateChange = function(...values) { subscriptionCount++; return subscribe.apply(this, values); };
        return client;
      };
    }, true);
  });
  await page.reload();
  await expect.poll(() => vendorPresent(page)).toBe(true);
  await expect.poll(() => page.evaluate(() => window.God4Auth?.getState().status)).toBe('guest');
  expect(await page.evaluate(() => [clientCount, subscriptionCount])).toEqual([1, 1]);
  await page.locator('#accountTrigger').click(); await page.evaluate(() => Promise.all([God4AuthLoader.ensure(), God4AuthLoader.ensure()]));
  expect(await page.evaluate(() => [clientCount, subscriptionCount])).toEqual([1, 1]);
  await page.evaluate(() => {
    const now = Math.floor(Date.now() / 1000);
    const encode = value => btoa(JSON.stringify(value)).replaceAll('=', '').replaceAll('+', '-').replaceAll('/', '_');
    const token = encode({alg:'HS256', typ:'JWT'}) + '.' + encode({sub:'offline-fixture', iat:now, exp:now + 3600}) + '.offline-fixture';
    localStorage.setItem('sb-runtime-cache-test', JSON.stringify({access_token:token, refresh_token:'offline-only-fixture', expires_at:now + 3600,
      expires_in:3600, token_type:'bearer', user:{id:'offline-fixture', email:'offline-fixture@invalid.test'}}));
  });
  await context.setOffline(true); await page.reload();
  await expect.poll(() => page.evaluate(() => window.God4Auth?.getState().status)).toBe('signed-in');
  expect(await page.evaluate(() => [clientCount, subscriptionCount])).toEqual([1, 1]);
  await page.locator('#accountTrigger').click(); await expect(page.locator('#accountSignedIn')).toBeVisible();
});

test('real cache-24 vendor migrates before cleanup without requesting the network', async ({page, context}) => {
  await page.goto('/'); await page.evaluate(() => navigator.serviceWorker.ready.then(() => true));
  const bytes = [...vendorBytes];
  await page.evaluate(async ({bytes, path}) => {
    const registration = await navigator.serviceWorker.getRegistration(); await registration.unregister();
    await (await caches.open('god4-shell-compact-reader-24')).put(path, new Response(new Uint8Array(bytes), {headers:{'content-type':'application/javascript'}}));
  }, {bytes, path:vendorPath});
  let vendorRequests = 0;
  await context.route('**/js/vendor/supabase-js-2.117.0.min.js', route => { vendorRequests++; return route.abort(); });
  await page.reload(); await page.evaluate(() => navigator.serviceWorker.ready.then(() => true));
  await expect.poll(() => vendorPresent(page)).toBe(true);
  expect(await page.evaluate(() => caches.keys())).not.toContain(previousShell);
  if(!await page.evaluate(() => Boolean(navigator.serviceWorker.controller))) await page.reload();
  await page.evaluate(() => God4AuthLoader.ensure());
  expect(vendorRequests).toBe(0);
});

async function updateServer() {
  const baseline = execFileSync('git', ['show', 'aa082bca88e8e7a1e155041a567f40414069bd8e:sw.js'], {encoding:'utf8'});
  const state = {current:false, vendorRequests:0};
  const root = path.resolve(__dirname, '..');
  const server = http.createServer((request, response) => {
    const url = new URL(request.url, origin);
    if(url.pathname === vendorPath) state.vendorRequests++;
    const file = url.pathname === '/' ? 'index.html' : url.pathname === '/offline' ? 'offline.html' : url.pathname.slice(1);
    if(file.includes('..')) return response.writeHead(400).end();
    try {
      const body = file === 'sw.js' ? state.current ? source : baseline : fs.readFileSync(path.join(root, file));
      const mime = file.endsWith('.js') ? 'application/javascript' : file.endsWith('.css') ? 'text/css' : file.endsWith('.html') ? 'text/html' : file.endsWith('.png') ? 'image/png' : 'application/json';
      response.writeHead(200, {'content-type':mime, 'cache-control':'no-store'}).end(body);
    } catch { response.writeHead(404).end(); }
  });
  await new Promise(resolve => server.listen(0, '127.0.0.1', resolve));
  return {state, server, origin:`http://127.0.0.1:${server.address().port}`};
}

test('real cache-24 worker waits for acceptance; cache 25 migrates vendor and both old/new tabs remain compatible offline', async ({browser}) => {
  const fixture = await updateServer(), context = await browser.newContext();
  try {
    const page = await context.newPage();
    await page.goto(fixture.origin); await page.evaluate(() => navigator.serviceWorker.ready.then(() => true)); await page.reload();
    expect(await page.evaluate(() => caches.keys())).toContain(previousShell);
    expect(fixture.state.vendorRequests).toBe(1);
    const other = await context.newPage(); await other.goto(fixture.origin);
    fixture.state.current = true;
    await page.evaluate(async () => (await navigator.serviceWorker.getRegistration()).update());
    await expect(page.locator('#pwaUpdateButton')).toBeVisible();
    expect(await vendorPresent(page)).toBe(false);
    expect(await page.evaluate(() => caches.keys())).toContain(previousShell);
    const reloaded = page.waitForEvent('load'); await page.locator('#pwaUpdateButton').click(); await reloaded;
    await expect.poll(() => vendorPresent(page)).toBe(true);
    expect(await page.evaluate(() => caches.keys())).toEqual([shell, vendorCache]);
    expect(fixture.state.vendorRequests).toBe(1);
    await context.setOffline(true);
    for(const tab of [page, other]) {
      await tab.locator('#accountTrigger').click(); await tab.evaluate(() => God4AuthLoader.ensure());
      expect(await tab.evaluate(() => typeof supabase.createClient)).toBe('function');
    }
    expect(fixture.state.vendorRequests).toBe(1);
  } finally {
    await context.close(); await new Promise(resolve => fixture.server.close(resolve));
  }
});

test('measured cache-24/current installs retain vendor byte savings less the Word Study loader', async ({browser}) => {
  const fixture = await updateServer(), measurements = [];
  try {
    for(const current of [false, true]) {
      fixture.state.current = current;
      const context = await browser.newContext(), page = await context.newPage();
      await page.goto(fixture.origin); await page.evaluate(() => navigator.serviceWorker.ready.then(() => true));
      const entries = await context.serviceWorkers()[0].evaluate(() => performance.getEntriesByType('resource').filter(e => e.initiatorType === 'fetch')
        .map(e => ({path:new URL(e.name).pathname + new URL(e.name).search, transfer:e.transferSize, encoded:e.encodedBodySize, decoded:e.decodedBodySize})));
      const urls = await page.evaluate(async () => { const cache = await caches.open((await caches.keys())[0]); return (await cache.keys()).map(r => new URL(r.url).pathname + new URL(r.url).search); });
      const repositoryBytes = urls.reduce((sum, url) => sum + fs.statSync(path.join(__dirname, '..', url === '/' ? 'index.html' : url === '/offline' ? 'offline.html' : url.split('?')[0].slice(1))).size, 0);
      const total = entries.reduce((sum, entry) => ({transfer:sum.transfer + entry.transfer, encoded:sum.encoded + entry.encoded, decoded:sum.decoded + entry.decoded}), {transfer:0, encoded:0, decoded:0});
      measurements.push({current, assets:urls.length, fetches:entries.length, repositoryBytes, ...total});
      await context.close();
    }
    console.log('Local uncompressed worker installation measurements:', JSON.stringify(measurements));
    expect(measurements.map(m => [m.assets, m.fetches])).toEqual([[41, 41], [49, 49]]);
    // Both fixtures use current HTML/files; current membership adds the loaders, Scripture picker, canon and theme assets while excluding the vendor.
    const loaderBytes=fs.statSync(path.join(__dirname,'..','js/word-study/loader.js')).size + fs.statSync(path.join(__dirname,'..','js/bible/compare-loader.js')).size + fs.statSync(path.join(__dirname,'..','js/pwa/offline-translations-loader.js')).size + fs.statSync(path.join(__dirname,'..','js/bible/scripture-picker.js')).size + fs.statSync(path.join(__dirname,'..','js/bible/canon.js')).size + fs.statSync(path.join(__dirname,'..','js/word-study/alignment.js')).size + fs.statSync(path.join(__dirname,'..','js/bible/translation-picker.js')).size;
    const themeBytes=fs.statSync(path.join(__dirname,'..','js/theme.js')).size+fs.statSync(path.join(__dirname,'..','css/theme.css')).size;
    expect(measurements[0].repositoryBytes - measurements[1].repositoryBytes).toBe(vendorBytes.length-loaderBytes-themeBytes);
    expect(measurements[0].decoded - measurements[1].decoded).toBe(vendorBytes.length-loaderBytes-themeBytes);
  } finally { await new Promise(resolve => fixture.server.close(resolve)); }
});
