const {test, expect} = require('@playwright/test');
const fs = require('fs');
const path = require('path');

const authSource = fs.readFileSync(path.join(__dirname, '..', 'js', 'auth', 'auth.js'), 'utf8');

async function useFakeAuth(page, overrides = ''){
  await page.route('**/js/auth/auth.js', route => route.fulfill({
    contentType: 'text/javascript',
    body: authSource + `
window.accountFake = {calls: []};
God4Auth = createGod4Auth({
  initialize: async () => null,
  subscribe: listener => { window.accountFake.listener = listener; return () => {}; },
  signUp: async () => ({user: null, signedIn: false, needsConfirmation: true}),
  signIn: async () => null,
  signOut: async () => {},
  ${overrides}
});`
  }));
}

test('guest Account dialog traps focus, switches forms, closes on Escape, and restores focus', async ({page}) => {
  await useFakeAuth(page);
  await page.goto('/');
  await expect.poll(() => page.evaluate(() => God4Auth.getState().status)).toBe('guest');
  const trigger = page.getByRole('button', {name: 'Account', exact: true});
  await expect(trigger).toBeVisible();
  await trigger.click();
  const dialog = page.getByRole('dialog', {name: 'Sign In'});
  await expect(dialog).toBeVisible();
  await expect(page.locator('#accountSignInEmail')).toBeFocused();
  await page.getByRole('button', {name: 'Create Account'}).click();
  await expect(page.getByRole('dialog', {name: 'Create Account'})).toBeVisible();
  await expect(page.locator('#accountSignUpEmail')).toBeFocused();
  await page.getByRole('button', {name: 'Sign In'}).click();
  await expect(page.locator('#accountSignInEmail')).toBeFocused();
  await page.locator('#accountShowSignUp').focus();
  await page.keyboard.press('Tab');
  await expect(page.locator('#accountClose')).toBeFocused();
  await page.keyboard.press('Shift+Tab');
  await expect(page.locator('#accountShowSignUp')).toBeFocused();
  await page.keyboard.press('Escape');
  await expect(dialog).not.toBeVisible();
  await expect(trigger).toBeFocused();
});

test('Sign In success updates account identity without a page reload', async ({page}) => {
  await useFakeAuth(page, `signIn: async (email, password) => {
    window.accountFake.calls.push(['signIn', email, password]);
    return {id: 'user-1', email};
  }`);
  await page.goto('/');
  await page.locator('#accountTrigger').click();
  await page.locator('#accountSignInEmail').fill('reader@example.test');
  await page.locator('#accountSignInPassword').fill('secret');
  await page.locator('#accountSignInForm button[type=submit]').click();
  await expect(page.locator('#accountDialog')).not.toBeVisible();
  await expect(page.locator('#accountTrigger')).toContainText('reader@example.test');
  await expect(page.locator('#readerContent [data-verse-number]')).not.toHaveCount(0);
  await expect.poll(() => page.evaluate(() => window.accountFake.calls.length)).toBe(1);
});

test('Sign In validates email and hides raw provider failures', async ({page}) => {
  await useFakeAuth(page, `signIn: async () => {
    throw Object.assign(new Error('raw provider token secret'), {access_token: 'hidden'});
  }`);
  await page.goto('/');
  await page.locator('#accountTrigger').click();
  await page.locator('#accountSignInEmail').fill('bad-email');
  await page.locator('#accountSignInPassword').fill('secret');
  await page.locator('#accountSignInForm button[type=submit]').click();
  await expect(page.locator('#accountError')).toHaveText('Enter a valid email address.');
  await expect(page.locator('#accountSignInEmail')).toBeFocused();
  await expect(page.locator('#accountSignInEmail')).toHaveAttribute('aria-invalid', 'true');
  await page.locator('#accountSignInEmail').fill('reader@example.test');
  await page.locator('#accountSignInForm button[type=submit]').click();
  await expect(page.locator('#accountError')).toContainText('Sign in failed');
  await expect(page.locator('#accountError')).not.toContainText('raw provider');
  await expect(page.locator('#accountError')).not.toContainText('token');
  await expect(page.locator('#accountError')).toBeFocused();
  await page.keyboard.press('Tab');
  await expect(page.locator('#accountClose')).toBeFocused();
});

test('Create Account with an immediate session becomes signed in', async ({page}) => {
  await useFakeAuth(page, `signUp: async (email) => {
    window.accountFake.calls.push('signUp');
    return {user: {id: 'user-2', email}, signedIn: true, needsConfirmation: false};
  }`);
  await page.goto('/');
  await page.locator('#accountTrigger').click();
  await page.locator('#accountShowSignUp').click();
  await page.locator('#accountSignUpEmail').fill('new@example.test');
  await page.locator('#accountSignUpPassword').fill('secret');
  await page.locator('#accountSignUpForm button[type=submit]').click();
  await expect(page.locator('#accountDialog')).not.toBeVisible();
  await expect(page.locator('#accountTrigger')).toContainText('new@example.test');
  await expect.poll(() => page.evaluate(() => window.accountFake.calls.length)).toBe(1);
});

test('Create Account without a session shows confirmation instead of signed-in status', async ({page}) => {
  await useFakeAuth(page, `signUp: async () => ({user: {id: 'unconfirmed'}, signedIn: false, needsConfirmation: true})`);
  await page.goto('/');
  await page.locator('#accountTrigger').click();
  await page.locator('#accountShowSignUp').click();
  await page.locator('#accountSignUpEmail').fill('new@example.test');
  await page.locator('#accountSignUpPassword').fill('secret');
  await page.locator('#accountSignUpForm button[type=submit]').click();
  await expect(page.getByRole('heading', {name: 'Check your email'})).toBeVisible();
  await expect(page.locator('#accountConfirmationTitle')).toBeFocused();
  await expect(page.locator('#accountTrigger')).toHaveText('Account');
  expect(await page.evaluate(() => God4Auth.getState().status)).toBe('guest');
});

test('Sign Out returns to guest without clearing local GOD4.us data', async ({page}) => {
  await useFakeAuth(page, `initialize: async () => ({id: 'user-3', email: 'reader@example.test'}),
    signOut: async () => { window.accountFake.calls.push('signOut'); }`);
  await page.goto('/');
  await expect(page.locator('#accountTrigger')).toContainText('reader@example.test');
  await page.locator('#heroFav').click();
  const before = await page.evaluate(() => {
    const keys = ['god4.savedVerses', 'god4.plan.completedDays', 'god4.translation',
      'god4.compare', 'god4.reader.position', 'god4.speech.speed', 'god4.speech.voice'];
    keys.forEach((key, index) => { if(localStorage.getItem(key) === null) localStorage.setItem(key, 'sentinel-' + index); });
    return Object.fromEntries(keys.map(key => [key, localStorage.getItem(key)]));
  });
  await page.locator('#accountTrigger').click();
  await page.locator('#accountSignOut').click();
  await expect(page.locator('#accountTrigger')).toHaveText('Account');
  await expect(page.locator('#accountDialog')).not.toBeVisible();
  await expect(page.locator('#savedCount')).toHaveText('1');
  await expect(page.locator('#readerContent [data-verse-number]')).not.toHaveCount(0);
  expect(await page.evaluate(keys => Object.fromEntries(keys.map(key => [key, localStorage.getItem(key)])), Object.keys(before))).toEqual(before);
  expect(await page.evaluate(() => window.accountFake.calls)).toEqual(['signOut']);
});

test('disabled auth reports unavailable while Reader and Saved Verses remain usable', async ({page}) => {
  await page.goto('/');
  await page.locator('#accountTrigger').click();
  await expect(page.locator('#accountUnavailable')).toContainText('Accounts are unavailable');
  await page.keyboard.press('Escape');
  await page.locator('#heroFav').click();
  await expect(page.locator('#savedCount')).toHaveText('1');
  await expect(page.locator('#readerContent [data-verse-number]')).not.toHaveCount(0);
});

test('pending Sign In disables duplicate submission', async ({page}) => {
  await useFakeAuth(page, `signIn: () => {
    window.accountFake.calls.push('signIn');
    return new Promise(resolve => { window.accountFake.finishSignIn = resolve; });
  }`);
  await page.goto('/');
  await page.locator('#accountTrigger').click();
  await page.locator('#accountSignInEmail').fill('reader@example.test');
  await page.locator('#accountSignInPassword').fill('secret');
  await page.locator('#accountSignInForm button[type=submit]').click();
  await expect(page.locator('#accountSignInForm button[type=submit]')).toBeDisabled();
  await page.locator('#accountSignInForm').evaluate(form => form.requestSubmit());
  expect(await page.evaluate(() => window.accountFake.calls)).toEqual(['signIn']);
  await page.evaluate(() => window.accountFake.finishSignIn({id: 'user-4', email: 'reader@example.test'}));
  await expect(page.locator('#accountDialog')).not.toBeVisible();
});

test('Account control and dialog fit a narrow viewport', async ({page}) => {
  await page.setViewportSize({width: 375, height: 700});
  await useFakeAuth(page);
  await page.goto('/');
  const trigger = page.locator('#accountTrigger');
  const saved = page.locator('.saved-pill');
  await expect(trigger).toBeVisible();
  await expect(saved).toBeVisible();
  const rects = await page.evaluate(() => {
    const account = document.getElementById('accountTrigger').getBoundingClientRect();
    const saved = document.querySelector('.saved-pill').getBoundingClientRect();
    return {account: {left: account.left, right: account.right, top: account.top},
      saved: {left: saved.left, right: saved.right, top: saved.top}};
  });
  expect(rects.account.right).toBeLessThanOrEqual(375);
  expect(rects.saved.right).toBeLessThanOrEqual(rects.account.left);
  await trigger.click();
  await expect(page.getByRole('dialog', {name: 'Sign In'})).toBeVisible();
  const dialogBounds = await page.locator('#accountDialog').boundingBox();
  expect(dialogBounds.x).toBeGreaterThanOrEqual(0);
  expect(dialogBounds.x + dialogBounds.width).toBeLessThanOrEqual(375);
  await expect(page.locator('#accountSignInEmail')).toBeFocused();
});

test('Forgot Password opens a labeled email form and returns to Sign In with focus', async ({page}) => {
  await useFakeAuth(page);
  await page.goto('/');
  await page.locator('#accountTrigger').click();
  await page.locator('#accountShowReset').click();
  await expect(page.getByRole('dialog', {name: 'Reset Password'})).toBeVisible();
  await expect(page.locator('#accountResetEmail')).toBeFocused();
  await expect(page.locator('#accountResetEmail')).toHaveAttribute('type', 'email');
  await page.locator('#accountResetBack').click();
  await expect(page.locator('#accountSignInEmail')).toBeFocused();
  await page.keyboard.press('Escape');
  await expect(page.locator('#accountTrigger')).toBeFocused();
});

test('reset request sends one generic response and preserves local data', async ({page}) => {
  await useFakeAuth(page, `requestPasswordReset: async email => {
    window.accountFake.calls.push(['reset', email]);
  }`);
  await page.goto('/');
  await page.evaluate(() => localStorage.setItem('god4.savedVerses', '[{"ref":"John 3:16","text":"Saved"}]'));
  await page.locator('#accountTrigger').click();
  await page.locator('#accountShowReset').click();
  await page.locator('#accountResetEmail').fill('reader@example.test');
  await page.locator('#accountResetForm button[type=submit]').click();
  await expect(page.locator('#accountResetSent')).toContainText(
    'If an account exists for that email, a reset link has been sent.');
  await expect(page.locator('#accountResetSentTitle')).toBeFocused();
  expect(await page.evaluate(() => window.accountFake.calls)).toEqual([['reset', 'reader@example.test']]);
  expect(await page.evaluate(() => localStorage.getItem('god4.savedVerses'))).toContain('John 3:16');
  await page.keyboard.press('Escape');
  await page.locator('#accountTrigger').click();
  await expect(page.locator('#accountSignInEmail')).toBeFocused();
});

test('reset request failure is controlled and retry succeeds', async ({page}) => {
  await useFakeAuth(page, `requestPasswordReset: async email => {
    window.accountFake.calls.push(email);
    if(window.accountFake.calls.length === 1) throw new Error('raw provider token secret');
  }`);
  await page.goto('/');
  await page.locator('#accountTrigger').click();
  await page.locator('#accountShowReset').click();
  await page.locator('#accountResetEmail').fill('reader@example.test');
  await page.locator('#accountResetForm button[type=submit]').click();
  await expect(page.locator('#accountError')).toContainText('Could not send a reset link');
  await expect(page.locator('#accountError')).not.toContainText('provider');
  await expect(page.locator('#accountError')).toBeFocused();
  await page.locator('#accountResetForm button[type=submit]').click();
  await expect(page.locator('#accountResetSent')).toBeVisible();
  expect(await page.evaluate(() => window.accountFake.calls.length)).toBe(2);
});

test('pending reset request prevents duplicate submissions and ignores a late close response', async ({page}) => {
  await useFakeAuth(page, `requestPasswordReset: email => {
    window.accountFake.calls.push(email);
    return new Promise(resolve => { window.accountFake.finishReset = resolve; });
  }`);
  await page.goto('/');
  await page.locator('#accountTrigger').click();
  await page.locator('#accountShowReset').click();
  await page.locator('#accountResetEmail').fill('reader@example.test');
  await page.locator('#accountResetForm button[type=submit]').click();
  await expect(page.locator('#accountResetForm button[type=submit]')).toBeDisabled();
  await page.locator('#accountResetForm').evaluate(form => form.requestSubmit());
  expect(await page.evaluate(() => window.accountFake.calls.length)).toBe(1);
  await page.keyboard.press('Escape');
  await page.evaluate(() => window.accountFake.finishReset());
  await page.locator('#accountTrigger').click();
  await expect(page.locator('#accountSignInEmail')).toBeFocused();
  await expect(page.locator('#accountResetSent')).toBeHidden();
});
