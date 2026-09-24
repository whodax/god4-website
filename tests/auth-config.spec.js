const {test, expect} = require('@playwright/test');
const fs = require('fs');
const path = require('path');
const vm = require('vm');

const root = path.join(__dirname, '..');
const configSource = fs.readFileSync(path.join(root, 'js/auth/config.js'), 'utf8');
const providerSource = fs.readFileSync(path.join(root, 'js/auth/supabase-provider.js'), 'utf8');

function loadAt(origin, runtime){
  const url = new URL(origin);
  const context = {window: {location: {origin: url.origin, hostname: url.hostname}}};
  if(runtime) context.window.supabase = runtime;
  vm.createContext(context);
  vm.runInContext(configSource, context);
  vm.runInContext(providerSource, context);
  return context;
}

test('stable staging alias alone creates the provider and uses exact callback and return URLs', () => {
  const calls = [];
  const preview = 'https://feature-optional-user-accoun.god4-us.pages.dev';
  const context = loadAt(preview, {createClient(url, key){
    calls.push({url, publishable: key.startsWith('sb_publishable_')});
    return {auth: {}};
  }});
  const config = context.God4AuthConfig;
  expect(config.enabled).toBe(true);
  expect(Array.from(config.allowedHosts)).toEqual(['feature-optional-user-accoun.god4-us.pages.dev']);
  expect(Array.from(config.allowedOrigins)).toEqual([preview, 'http://127.0.0.1:4173']);
  expect(config.callbackPath).toBe('/auth/callback/');
  expect(context.SupabaseAuthProvider.create(config)).not.toBeNull();
  expect(calls).toEqual([{url: 'https://ikzvyuvrvxemliirlfmn.supabase.co', publishable: true}]);
  expect(context.God4AuthUrls.callbackUrl(config)).toBe(preview + '/auth/callback/');
  expect(context.God4AuthUrls.returnUrl(config)).toBe(preview + '/');
});

test('production and unapproved Pages deployments cannot create a provider or callback redirect', () => {
  for(const origin of ['https://god4.us', 'https://19ed50af.god4-us.pages.dev',
    'https://fcfb63df.god4-us.pages.dev', 'https://random.god4-us.pages.dev', 'https://evil.example']){
    let creations = 0;
    const context = loadAt(origin, {createClient(){ creations++; return {auth: {}}; }});
    expect(context.SupabaseAuthProvider.create(context.God4AuthConfig)).toBeNull();
    expect(context.God4AuthUrls.callbackUrl(context.God4AuthConfig)).toBeNull();
    expect(creations).toBe(0);
  }
});

test('stable staging alias remains unavailable without the browser runtime', () => {
  const context = loadAt('https://feature-optional-user-accoun.god4-us.pages.dev');
  expect(context.SupabaseAuthProvider.create(context.God4AuthConfig)).toBeNull();
});

test('both pages load the same pinned browser client before the adapter', () => {
  for(const file of ['index.html', 'auth/callback/index.html']){
    const html = fs.readFileSync(path.join(root, file), 'utf8');
    const config = html.indexOf('js/auth/config.js');
    const bundle = html.indexOf('js/vendor/supabase-js-2.117.0.min.js');
    const provider = html.indexOf('js/auth/supabase-provider.js');
    const auth = html.indexOf('js/auth/auth.js');
    expect(config).toBeGreaterThan(-1);
    expect(config).toBeLessThan(bundle);
    expect(bundle).toBeLessThan(provider);
    expect(provider).toBeLessThan(auth);
  }
});

test('local guest Reader works with the real browser bundle and auth leaves site keys alone', async ({page}) => {
  await page.goto('/');
  await expect(page.locator('#readerContent [data-verse-number]')).not.toHaveCount(0);
  await expect(page.locator('#planDays .plan-day')).toHaveCount(30);
  const result = await page.evaluate(async () => {
    const keys = ['god4.savedVerses', 'god4.plan.completedDays', 'god4.translation',
      'god4.compare', 'god4.reader.position', 'god4.speech.speed', 'god4.speech.voice'];
    keys.forEach((key, index) => localStorage.setItem(key, 'keep-' + index));
    const before = keys.map(key => localStorage.getItem(key));
    await God4Auth.initialize();
    return {runtime: typeof window.supabase?.createClient, status: God4Auth.getState().status,
      before, after: keys.map(key => localStorage.getItem(key))};
  });
  expect(result.runtime).toBe('function');
  expect(result.status).toBe('unavailable');
  expect(result.after).toEqual(result.before);
});
