const {test, expect} = require('@playwright/test');
const fs = require('fs');
const path = require('path');
const {startCspServer, reportOnly} = require('./csp-server');

const authSource = fs.readFileSync(path.join(__dirname, '..', 'js/auth/auth.js'), 'utf8');
const production = 'https://apkiqgxmfqohznxpqfcx.supabase.co';
const staging = 'https://ikzvyuvrvxemliirlfmn.supabase.co';
let server;

test.beforeAll(async () => { server = await startCspServer(); });
test.afterAll(async () => { await server.close(); });

async function captureViolations(page) {
  const consoleViolations = [];
  page.on('console', message => {
    if (/content security policy|content-security-policy|violates the following.*policy|refused to (?:load|connect|execute|apply)/i.test(message.text()) &&
      /violat|refused|blocked/i.test(message.text())) consoleViolations.push(message.text());
  });
  await page.addInitScript(() => {
    window.__cspViolations = [];
    document.addEventListener('securitypolicyviolation', event => {
      window.__cspViolations.push({
        effectiveDirective: event.effectiveDirective,
        blockedURI: event.blockedURI,
        disposition: event.disposition,
        sourceFile: event.sourceFile || '',
        lineNumber: event.lineNumber || 0
      });
    });
  });
  return consoleViolations;
}

async function expectCleanPolicy(page, consoleViolations, flow) {
  const violations = await page.evaluate(() => window.__cspViolations || []);
  expect(violations, `${flow}: securitypolicyviolation events`).toEqual([]);
  expect(consoleViolations, `${flow}: CSP console violations`).toEqual([]);
}

async function interceptFonts(page, css = '') {
  await page.route('https://fonts.googleapis.com/**', route => route.fulfill({
    status: 200, contentType: 'text/css', body: css,
    headers: {'access-control-allow-origin': '*', 'content-type': 'text/css'}
  }));
}

async function proxyHost(page, origin) {
  await page.route(`${origin}/**`, async route => {
    const url = new URL(route.request().url());
    const response = await page.request.get(server.origin + url.pathname + url.search);
    await route.fulfill({response});
  });
}

const mockSupabase = `
window.supabase = {createClient: function(url){
  window.__authOrigin = url;
  var listener;
  var user = {id:'mock-user', email:'reader@example.test'};
  function request(path){ return fetch(url + '/auth/v1/' + path).then(function(response){
    if(!response.ok) throw new Error('Mock auth request failed');
  }); }
  return {auth: {
    onAuthStateChange: function(next){ listener = next; return {data:{subscription:{unsubscribe:function(){}}}}; },
    initialize: async function(){
      await request('verify');
      if(new URLSearchParams(location.search).get('type') === 'recovery')
        queueMicrotask(function(){ listener('PASSWORD_RECOVERY', {user:user}); });
      return {error:null};
    },
    getSession: async function(){
      await request('session');
      var callback = location.pathname === '/auth/callback/' && new URLSearchParams(location.search).has('code');
      return {data:{session:callback ? {user:user} : null}, error:null};
    },
    signInWithPassword: async function(){ await request('token'); return {data:{user:user}, error:null}; },
    signUp: async function(){ await request('signup'); return {data:{user:user, session:null}, error:null}; },
    signOut: async function(){ await request('logout'); listener('SIGNED_OUT', null); return {error:null}; },
    resetPasswordForEmail: async function(){ await request('recover'); return {error:null}; },
    updateUser: async function(){ await request('user'); return {data:{user:user}, error:null}; }
  }};
}};`;

async function mockApprovedAuth(page, siteOrigin, apiOrigin) {
  const apiPaths = [];
  await proxyHost(page, siteOrigin);
  await page.route(`${siteOrigin}/js/vendor/supabase-js-2.117.0.min.js`, route => route.fulfill({
    contentType:'text/javascript', body:mockSupabase
  }));
  await page.route(`${apiOrigin}/**`, route => {
    apiPaths.push(new URL(route.request().url()).pathname);
    return route.fulfill({status:200, contentType:'application/json', body:'{}',
      headers:{'access-control-allow-origin':'*', 'content-type':'application/json'}});
  });
  await interceptFonts(page);
  return apiPaths;
}

test('test server applies the exact Report-Only header and preserves asset MIME', async ({request}) => {
  for(const [name, mime] of [['/', /text\/html/], ['/js/app.js', /javascript/], ['/css/components.css', /text\/css/], ['/auth/callback/', /text\/html/]]) {
    const response = await request.get(server.origin + name);
    expect(response.ok()).toBe(true);
    expect(response.headers()['content-type']).toMatch(mime);
    expect(response.headers()['content-security-policy-report-only']).toBe(reportOnly);
    expect(response.headers()['content-security-policy']).toBeUndefined();
  }
});

test('main application flows stay functional without CSP violations', async ({page}) => {
  test.setTimeout(60_000);
  const consoleViolations = await captureViolations(page);
  await interceptFonts(page);
  await page.route('**/js/auth/auth.js', route => route.fulfill({
    contentType:'text/javascript', body:authSource + '\nGod4Auth = createGod4Auth({initialize:async()=>null,subscribe:()=>()=>{}});'
  }));
  const resourceTypes = [];
  const workers = [];
  page.on('request', request => resourceTypes.push(request.resourceType()));
  page.on('worker', worker => workers.push(worker.url()));
  await page.goto(server.origin + '/');
  await expect(page.locator('#readerContent')).toContainText('John 1');
  await page.locator('.refresh-btn').click();
  const searchInput = page.locator('#searchInput');
  const searchResults = page.locator('#results');
  await expect(searchInput).toBeVisible();
  await expect(searchInput).toBeEditable();
  await searchInput.fill('Genesis 1');
  await expect(searchInput).toHaveValue('Genesis 1');
  await searchInput.press('Enter');
  await expect(searchResults.locator('.result-card')).toHaveCount(10);
  await expect(searchResults.locator('.search-status')).toContainText(/Showing 10 of \d+ matches/);
  await expect(searchResults.locator('.search-more')).toBeVisible();
  await searchResults.locator('.search-more').click();
  await expect(searchResults.locator('.result-card')).toHaveCount(20);
  await page.locator('#heroFav').click();
  await page.locator('.saved-pill').click();
  await expect(page.locator('#trayList .saved-verse-row')).toHaveCount(1);
  await page.locator('#closeTray').click();
  await page.locator('#chapterSelect').selectOption('2');
  await page.locator('[data-reader-action="next-verse"]').click();
  await expect(page.locator('#readerContent [data-verse-number="1"]')).toHaveClass(/verse-focused/);
  await page.locator('#readerContent [data-word-study-term]').first().click();
  await expect(page.locator('#wordStudyPanel')).toBeVisible();
  await page.locator('#wordStudyClose').click();
  await page.getByRole('button', {name:'Compare', exact:true}).click();
  await expect(page.locator('#compareGrid .compare-col')).toHaveCount(2);
  await page.getByRole('button', {name:'Plan', exact:true}).click();
  await page.locator('[data-plan-day="1"]').click();
  await expect(page.locator('#planFill')).toHaveClass(/plan-progress-days-1/);
  await page.getByRole('button', {name:'Reader', exact:true}).click();
  await page.getByRole('button', {name:'Fullscreen'}).click();
  await expect(page.locator('#fsOverlay')).toHaveClass(/active/);
  await page.getByRole('button', {name:'Exit Fullscreen'}).click();
  await page.locator('#accountTrigger').click();
  await expect(page.locator('#accountDialog')).toBeVisible();
  await page.locator('#accountSignInPassword').fill('example-only');
  await page.locator('#accountSignInShowPassword').check();
  await expect(page.locator('#accountSignInPassword')).toHaveAttribute('type','text');
  await page.locator('#accountSignInShowPassword').uncheck();
  await expect(page.locator('#accountSignInPassword')).toHaveAttribute('type','password');
  expect(workers).toEqual([]);
  expect(resourceTypes).not.toContain('media');
  expect(resourceTypes).not.toContain('iframe');
  expect(await page.locator('iframe, frame, object, embed, audio, video').count()).toBe(0);
  await expectCleanPolicy(page, consoleViolations, 'main application');
});

test('Google stylesheet and font origins are allowed and font loader activates', async ({page}) => {
  const consoleViolations = await captureViolations(page);
  let stylesheetRequests = 0;
  let fontRequests = 0;
  await page.route('https://fonts.googleapis.com/**', route => {
    stylesheetRequests++;
    return route.fulfill({status:200, contentType:'text/css',
      body:'@font-face{font-family:"CSP Probe";src:url("https://fonts.gstatic.com/probe.woff2") format("woff2")}' });
  });
  await page.route('https://fonts.gstatic.com/**', route => {
    fontRequests++;
    return route.fulfill({status:200, contentType:'font/woff2', body:Buffer.from('mock-font')});
  });
  await page.goto(server.origin + '/');
  await expect.poll(() => page.locator('#googleFontsStylesheet').evaluate(link => link.media)).toBe('all');
  await page.evaluate(() => document.fonts.load('16px "CSP Probe"').catch(() => []));
  expect(stylesheetRequests).toBeGreaterThan(0);
  expect(fontRequests).toBeGreaterThan(0);
  await expectCleanPolicy(page, consoleViolations, 'Google Fonts');
});

for(const [label, site, api] of [
  ['production', 'https://god4.us', production],
  ['staging', 'https://feature-optional-user-accoun.god4-us.pages.dev', staging]
]) {
  test(`${label} auth adapter uses its approved connect-src origin without violations`, async ({page}) => {
    const consoleViolations = await captureViolations(page);
    const apiPaths = await mockApprovedAuth(page, site, api);
    await page.goto(site + '/');
    await expect.poll(() => page.evaluate(() => God4Auth.getState().status)).toBe('guest');
    expect(await page.evaluate(() => window.__authOrigin)).toBe(api);
    await page.evaluate(async () => {
      await God4Auth.signIn('reader@example.test', 'example-only');
      await God4Auth.signOut();
      await God4Auth.signUp('reader@example.test', 'example-only');
      await God4Auth.requestPasswordReset('reader@example.test');
    });
    expect(apiPaths).toEqual(expect.arrayContaining([
      '/auth/v1/session', '/auth/v1/token', '/auth/v1/logout', '/auth/v1/signup', '/auth/v1/recover'
    ]));
    await expectCleanPolicy(page, consoleViolations, `${label} auth`);
  });
}

test('callback confirmation, recovery, and expired states remain CSP-clean', async ({page}) => {
  const site = 'https://god4.us';
  const consoleViolations = await captureViolations(page);
  const apiPaths = await mockApprovedAuth(page, site, production);
  await page.goto(site + '/auth/callback/?code=example&type=signup');
  await expect(page.locator('#callbackConfirmed')).toBeVisible();
  await expectCleanPolicy(page, consoleViolations, 'confirmation callback');
  await page.goto(site + '/auth/callback/?code=example&type=recovery');
  await expect(page.locator('#callbackResetForm')).toBeVisible();
  await page.locator('#callbackPassword').fill('example-only');
  await page.locator('#callbackPasswordConfirm').fill('example-only');
  await page.locator('#callbackShowPassword').check();
  await expect(page.locator('#callbackPassword')).toHaveAttribute('type','text');
  await page.locator('#callbackResetForm button[type="submit"]').click();
  await expect(page.locator('#callbackResetSuccess')).toBeVisible();
  await expectCleanPolicy(page, consoleViolations, 'recovery callback');
  await page.goto(site + '/auth/callback/?error=access_denied&error_code=otp_expired');
  await expect(page.locator('#callbackError')).toBeVisible();
  await expectCleanPolicy(page, consoleViolations, 'expired callback');
  expect(apiPaths).toEqual(expect.arrayContaining(['/auth/v1/verify', '/auth/v1/session', '/auth/v1/user']));
});

test('Read Aloud, voice commands, and same-origin Word Study work without CSP violations', async ({page}) => {
  const consoleViolations = await captureViolations(page);
  await interceptFonts(page);
  await page.addInitScript(() => {
    window.__spoken = [];
    window.SpeechSynthesisUtterance = function(text){this.text = text;};
    Object.defineProperty(window, 'speechSynthesis', {configurable:true, value:{
      speaking:false, paused:false,
      speak(utterance){this.speaking=true;window.__spoken.push(utterance);},
      cancel(){this.speaking=false;}, pause(){this.paused=true;}, resume(){this.paused=false;},
      getVoices(){return [{name:'Mock Voice', lang:'en-US'}];}
    }});
    function Recognition(){window.__recognition=this;}
    Recognition.prototype.start=function(){window.__recognitionStarted=true;};
    Recognition.prototype.stop=function(){};
    window.SpeechRecognition=Recognition;
    window.webkitSpeechRecognition=Recognition;
  });
  const fetched = [];
  page.on('request', request => {if(request.url().startsWith(server.origin)) fetched.push(request.url());});
  await page.goto(server.origin + '/');
  const policy = (await page.request.get(server.origin + '/')).headers()['permissions-policy'];
  expect(policy).toContain('microphone=(self)');
  await page.locator('#readAloudVoice').selectOption({label:'Mock Voice'});
  await page.locator('#readAloudSpeed').selectOption('1.25');
  await page.locator('#readAloudPlay').click();
  await expect(page.locator('#readAloudStatus')).toHaveText('Reading aloud.');
  await page.locator('#readerContent [data-verse-speech="2"]').click();
  expect(await page.evaluate(() => window.__spoken.length)).toBeGreaterThan(0);
  await page.locator('#readAloudStop').click();
  await page.locator('[data-voice-command-button]').click();
  await expect(page.locator('[data-voice-command-button]')).toHaveAttribute('aria-pressed','true');
  expect(await page.evaluate(() => window.__recognitionStarted)).toBe(true);
  await page.locator('[data-voice-command-button]').click();
  const [originalLanguageResponse] = await Promise.all([
    page.waitForResponse(response => new URL(response.url()).pathname === '/data/word-study/original-language/john/1.json'),
    page.locator('#readerContent [data-word-study-term]').first().click()
  ]);
  expect(originalLanguageResponse.ok()).toBe(true);
  await expect(page.locator('#wordStudyPanel')).toBeVisible();
  await expect(page.locator('#wordStudyDefinition')).not.toHaveText('');
  await expect(page.locator('#wordStudyOriginalLanguage')).toBeVisible();
  expect(fetched.some(url => /\/data\/word-study\/[^/]+\.json$/.test(new URL(url).pathname))).toBe(true);
  expect(fetched.some(url => /\/data\/word-study\/original-language\/john\/1\.json$/.test(new URL(url).pathname))).toBe(true);
  await expectCleanPolicy(page, consoleViolations, 'speech, voice, Word Study');
});
