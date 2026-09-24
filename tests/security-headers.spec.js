const {test, expect} = require('@playwright/test');
const fs = require('fs');
const path = require('path');

const headersFile = path.join(__dirname, '..', '_headers');
const production = 'https://apkiqgxmfqohznxpqfcx.supabase.co';
const staging = 'https://ikzvyuvrvxemliirlfmn.supabase.co';

function parsedHeaders() {
  const lines = fs.readFileSync(headersFile, 'utf8').trim().split(/\r?\n/).map(line => line.trim());
  expect(lines[0]).toBe('/*');
  return new Map(lines.slice(1).map(line => {
    const separator = line.indexOf(':');
    expect(separator).toBeGreaterThan(0);
    return [line.slice(0, separator), line.slice(separator + 1).trim()];
  }));
}

test('Cloudflare Pages static headers keep microphone access for this site', () => {
  const headers = parsedHeaders();
  expect([...headers.keys()]).toEqual([
    'X-Content-Type-Options', 'X-Frame-Options', 'Referrer-Policy',
    'Permissions-Policy', 'Content-Security-Policy-Report-Only'
  ]);
  expect(headers.get('X-Content-Type-Options')).toBe('nosniff');
  expect(headers.get('X-Frame-Options')).toBe('DENY');
  expect(headers.get('Referrer-Policy')).toBe('strict-origin-when-cross-origin');
  expect(headers.get('Permissions-Policy')).toBe('camera=(), geolocation=(), payment=(), usb=(), microphone=(self)');
  expect(headers.has('Content-Security-Policy')).toBe(false);
  expect(headers.has('Strict-Transport-Security')).toBe(false);
});

test('strict CSP exists only as Report-Only with exact reviewed directives', () => {
  const headers = parsedHeaders();
  const policy = headers.get('Content-Security-Policy-Report-Only');
  expect(policy).toBe([
    "default-src 'self'", "script-src 'self'", "script-src-attr 'none'",
    "style-src 'self' https://fonts.googleapis.com", "style-src-attr 'none'",
    "font-src 'self' https://fonts.gstatic.com", "img-src 'self'",
    `connect-src 'self' ${production} ${staging}`, "frame-src 'none'",
    "worker-src 'none'", "media-src 'none'", "object-src 'none'",
    "base-uri 'self'", "form-action 'self'", "frame-ancestors 'none'"
  ].join('; ') + ';');
  expect(policy).not.toMatch(/unsafe-inline|unsafe-eval|(?:^|[\s;])\*|data:|blob:|report-uri|report-to/i);
  expect([...headers.keys()].filter(name => name === 'Content-Security-Policy-Report-Only')).toHaveLength(1);
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
