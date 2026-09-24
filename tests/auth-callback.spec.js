const {test, expect} = require('@playwright/test');
const fs = require('fs');
const path = require('path');

const authSource = fs.readFileSync(path.join(__dirname, '..', 'js', 'auth', 'auth.js'), 'utf8');

async function useFakeCallback(page, overrides = ''){
  await page.route('**/js/auth/auth.js', route => route.fulfill({
    contentType: 'text/javascript',
    body: authSource + `
window.callbackFake = {calls: []};
God4Auth = createGod4Auth({
  initialize: async () => null,
  subscribe: listener => { window.callbackFake.listener = listener; return () => {}; },
  completePasswordReset: async () => null,
  ${overrides}
});`
  }));
}

const recovery = `initialize: async () => {
  window.callbackFake.listener({type: 'recovery', user: {id: 'recover-user', email: 'reader@example.test'}});
  return null;
}`;

test('recovery callback shows a labeled new-password form and scrubs URL values', async ({page}) => {
  await useFakeCallback(page, recovery);
  await page.goto('/auth/callback/?code=private-code&type=recovery#access_token=private-token');
  await expect(page).toHaveTitle('Account callback — GOD4.us');
  await expect(page.locator('#callbackStatus')).toHaveText('Checking your account link…');
  await expect(page.getByRole('heading', {name: 'Set new password'})).toBeVisible();
  await expect(page.locator('#callbackResetTitle')).toBeFocused();
  await expect(page.locator('#callbackPassword')).toHaveAttribute('autocomplete', 'new-password');
  await expect(page.locator('#callbackPasswordConfirm')).toHaveAttribute('autocomplete', 'new-password');
  await expect.poll(() => page.url()).toBe('http://127.0.0.1:4173/auth/callback/');
  await expect(page.locator('body')).not.toContainText('private-code');
  await expect(page.locator('body')).not.toContainText('private-token');
  await expect(page.locator('#callbackContinue')).toHaveAttribute('href', 'http://127.0.0.1:4173/');
});

test('password mismatch is blocked before provider completion', async ({page}) => {
  await useFakeCallback(page, recovery + `, completePasswordReset: async () => {
    window.callbackFake.calls.push('complete');
    return {id: 'recover-user'};
  }`);
  await page.goto('/auth/callback/?code=one&type=recovery');
  await page.locator('#callbackPassword').fill('first-password');
  await page.locator('#callbackPasswordConfirm').fill('different-password');
  await page.locator('#callbackResetForm button[type=submit]').click();
  await expect(page.locator('#callbackFormError')).toHaveText('Passwords must match.');
  await expect(page.locator('#callbackPasswordConfirm')).toBeFocused();
  expect(await page.evaluate(() => window.callbackFake.calls)).toEqual([]);
});

test('password completion calls the provider once, preserves local data, and shows success', async ({page}) => {
  await useFakeCallback(page, recovery + `, completePasswordReset: async password => {
    window.callbackFake.calls.push(['complete', password]);
    return {id: 'recover-user', email: 'reader@example.test'};
  }`);
  await page.goto('/auth/callback/?code=one&type=recovery');
  const before = await page.evaluate(() => {
    const keys = ['god4.savedVerses', 'god4.plan.completedDays', 'god4.translation',
      'god4.compare', 'god4.reader.position', 'god4.speech.speed', 'god4.speech.voice'];
    keys.forEach((key, index) => localStorage.setItem(key, 'preserve-' + index));
    return Object.fromEntries(keys.map(key => [key, localStorage.getItem(key)]));
  });
  await page.locator('#callbackPassword').fill('new-password');
  await page.locator('#callbackPasswordConfirm').fill('new-password');
  await page.locator('#callbackResetForm button[type=submit]').click();
  await expect(page.getByRole('heading', {name: 'Password updated'})).toBeVisible();
  await expect(page.locator('#callbackResetSuccess')).toContainText('Your password has been updated.');
  await expect(page.locator('#callbackResetSuccessTitle')).toBeFocused();
  expect(await page.evaluate(() => window.callbackFake.calls)).toEqual([['complete', 'new-password']]);
  expect(await page.evaluate(keys => Object.fromEntries(keys.map(key => [key, localStorage.getItem(key)])), Object.keys(before))).toEqual(before);
  await expect(page.locator('#callbackContinue')).toHaveAttribute('href', 'http://127.0.0.1:4173/');
});

test('password completion failure stays controlled and can be retried', async ({page}) => {
  await useFakeCallback(page, recovery + `, completePasswordReset: async () => {
    window.callbackFake.calls.push('complete');
    if(window.callbackFake.calls.length === 1) throw new Error('raw provider token secret');
    return {id: 'recover-user'};
  }`);
  await page.goto('/auth/callback/?code=one&type=recovery');
  await page.locator('#callbackPassword').fill('new-password');
  await page.locator('#callbackPasswordConfirm').fill('new-password');
  await page.locator('#callbackResetForm button[type=submit]').click();
  await expect(page.locator('#callbackFormError')).toContainText('Could not update your password');
  await expect(page.locator('#callbackFormError')).not.toContainText('provider');
  await expect(page.locator('#callbackFormError')).toBeFocused();
  await page.locator('#callbackPassword').fill('new-password');
  await page.locator('#callbackPasswordConfirm').fill('new-password');
  await page.locator('#callbackResetForm button[type=submit]').click();
  await expect(page.getByRole('heading', {name: 'Password updated'})).toBeVisible();
  expect(await page.evaluate(() => window.callbackFake.calls.length)).toBe(2);
});

test('pending completion disables a duplicate submit', async ({page}) => {
  await useFakeCallback(page, recovery + `, completePasswordReset: () => {
    window.callbackFake.calls.push('complete');
    return new Promise(resolve => { window.callbackFake.finish = resolve; });
  }`);
  await page.goto('/auth/callback/?code=one&type=recovery');
  await page.locator('#callbackPassword').fill('new-password');
  await page.locator('#callbackPasswordConfirm').fill('new-password');
  await page.locator('#callbackResetForm button[type=submit]').click();
  await expect(page.locator('#callbackResetForm button[type=submit]')).toBeDisabled();
  await page.locator('#callbackResetForm').evaluate(form => form.requestSubmit());
  expect(await page.evaluate(() => window.callbackFake.calls.length)).toBe(1);
  await page.evaluate(() => window.callbackFake.finish({id: 'recover-user'}));
  await expect(page.getByRole('heading', {name: 'Password updated'})).toBeVisible();
});

test('normal email confirmation shows success without a reset form', async ({page}) => {
  await useFakeCallback(page, `initialize: async () => ({id: 'confirmed-user', email: 'reader@example.test'})`);
  await page.goto('/auth/callback/?code=confirmation-code&type=signup');
  await expect(page.getByRole('heading', {name: 'Account confirmed'})).toBeVisible();
  await expect(page.locator('#callbackResetForm')).toBeHidden();
  await expect(page.locator('#callbackConfirmedTitle')).toBeFocused();
});

test('expired and malformed callbacks show safe errors without token display', async ({page}) => {
  await useFakeCallback(page);
  await page.goto('/auth/callback/?error=access_denied&error_code=otp_expired&return=https://evil.example/#access_token=private-token');
  await expect(page.getByRole('heading', {name: 'Link unavailable'})).toBeVisible();
  await expect(page.locator('#callbackErrorTitle')).toBeFocused();
  await expect(page.locator('body')).not.toContainText('private-token');
  await expect.poll(() => page.url()).toBe('http://127.0.0.1:4173/auth/callback/');
  await page.goto('/auth/callback/?nonsense=one');
  await expect(page.getByRole('heading', {name: 'Link unavailable'})).toBeVisible();
});

test('missing recovery state cannot expose the password form', async ({page}) => {
  await useFakeCallback(page, `initialize: async () => ({id: 'existing-user'})`);
  await page.goto('/auth/callback/?code=unverified&type=recovery');
  await expect(page.getByRole('heading', {name: 'Link unavailable'})).toBeVisible();
  await expect(page.locator('#callbackResetForm')).toBeHidden();
});

test('untrusted return parameter is ignored in favor of an allowlisted home URL', async ({page}) => {
  await useFakeCallback(page, `initialize: async () => ({id: 'confirmed-user'})`);
  await page.goto('/auth/callback/?code=valid&type=email&return=https://evil.example/steal');
  await expect(page.getByRole('heading', {name: 'Account confirmed'})).toBeVisible();
  await expect(page.locator('#callbackContinue')).toHaveAttribute('href', 'http://127.0.0.1:4173/');
  await expect.poll(() => page.url()).toBe('http://127.0.0.1:4173/auth/callback/');
});

test('callback with disabled auth remains a safe error page', async ({page}) => {
  await page.goto('/auth/callback/?code=unused&type=recovery');
  await expect(page.getByRole('heading', {name: 'Link unavailable'})).toBeVisible();
  await expect(page.locator('#callbackContinue')).toHaveAttribute('href', 'http://127.0.0.1:4173/');
});

test('newer sign-out prevents a stale password completion from reporting success', async ({page}) => {
  await useFakeCallback(page, recovery + `, completePasswordReset: () => {
    return new Promise(resolve => { window.callbackFake.finish = resolve; });
  }`);
  await page.goto('/auth/callback/?code=one&type=recovery');
  await page.locator('#callbackPassword').fill('new-password');
  await page.locator('#callbackPasswordConfirm').fill('new-password');
  await page.locator('#callbackResetForm button[type=submit]').click();
  await expect(page.locator('#callbackResetForm button[type=submit]')).toBeDisabled();
  await page.evaluate(() => window.callbackFake.listener({type: 'signed-out'}));
  await page.evaluate(() => window.callbackFake.finish({id: 'stale-user'}));
  await expect(page.getByRole('heading', {name: 'Link unavailable'})).toBeVisible();
  await expect(page.locator('#callbackResetSuccess')).toBeHidden();
  await expect(page.locator('#callbackResetForm')).toBeHidden();
});

test('recovery is consumed after completion and a late recovery event cannot reopen the form', async ({page}) => {
  await useFakeCallback(page, recovery + `, completePasswordReset: async () => ({id: 'recover-user'})`);
  await page.goto('/auth/callback/?code=one&type=recovery');
  await page.locator('#callbackPassword').fill('new-password');
  await page.locator('#callbackPasswordConfirm').fill('new-password');
  await page.locator('#callbackResetForm button[type=submit]').click();
  await expect(page.getByRole('heading', {name: 'Password updated'})).toBeVisible();
  await page.evaluate(() => window.callbackFake.listener({type: 'recovery', user: {id: 'recover-user'}}));
  expect(await page.evaluate(() => God4Auth.getState().recovery)).toBe(false);
  await expect(page.locator('#callbackResetForm')).toBeHidden();
});
