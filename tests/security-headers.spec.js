const {test, expect} = require('@playwright/test');
const fs = require('fs');
const path = require('path');

const headersFile = path.join(__dirname, '..', '_headers');

test('Cloudflare Pages static headers keep microphone access for this site', () => {
  const source = fs.readFileSync(headersFile, 'utf8');
  const lines = source.trim().split(/\r?\n/).map(line => line.trim());
  expect(lines).toEqual([
    '/*',
    'X-Content-Type-Options: nosniff',
    'X-Frame-Options: DENY',
    'Referrer-Policy: strict-origin-when-cross-origin',
    'Permissions-Policy: camera=(), geolocation=(), payment=(), usb=(), microphone=(self)'
  ]);
  expect(source).not.toMatch(/Content-Security-Policy|Strict-Transport-Security/i);
  expect(source).not.toMatch(/microphone=\(\)|microphone=\(\*\)/i);
});

test('local account JavaScript and CSS have MIME types compatible with nosniff', async ({request}) => {
  for(const [url, mime] of [
    ['/js/auth/account-ui.js?v=20260924-1', /(?:javascript|ecmascript)/i],
    ['/js/auth/callback.js?v=20260924-1', /(?:javascript|ecmascript)/i],
    ['/css/account.css?v=20260924-1', /text\/css/i]
  ]){
    const response = await request.get(url);
    expect(response.ok()).toBe(true);
    expect(response.headers()['content-type']).toMatch(mime);
  }
});
