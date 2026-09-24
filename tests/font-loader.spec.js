const { test, expect } = require('@playwright/test');
const fs = require('fs');
const path = require('path');

const html = fs.readFileSync(path.join(__dirname, '..', 'index.html'), 'utf8');
const fontUrl = 'https://fonts.googleapis.com/css2?family=Cormorant+Garamond:ital,wght@0,400;0,500;0,600;1,400;1,500&family=EB+Garamond:ital,wght@0,400;0,500;1,400&family=Inter:wght@400;500;600&display=swap';

test('Google Fonts link retains the print-loading pattern and noscript fallback', async ({ page }) => {
  await page.route('https://fonts.googleapis.com/**', (route) => route.abort());
  await page.goto('/');
  const link = page.locator('#googleFontsStylesheet');
  await expect(link).toHaveAttribute('rel', 'stylesheet');
  await expect(link).toHaveAttribute('href', fontUrl);
  expect(html).toContain('id="googleFontsStylesheet"');
  expect(html).toMatch(/id="googleFontsStylesheet"[^>]*media="print"|media="print"[^>]*id="googleFontsStylesheet"/);
  expect(html).toContain('<noscript><link href="' + fontUrl + '" rel="stylesheet"></noscript>');
});

test('Google Fonts loader handles both load events and already-loaded stylesheets', async ({ page }) => {
  await page.route('https://fonts.googleapis.com/**', (route) => route.abort());
  await page.goto('/');
  const result = await page.evaluate(() => {
    const link = document.getElementById('googleFontsStylesheet');
    link.media = 'print';
    Object.defineProperty(link, 'sheet', { configurable: true, value: null });
    initializeGoogleFonts();
    const beforeLoad = link.media;
    link.dispatchEvent(new Event('load'));
    const afterLoad = link.media;

    link.media = 'print';
    Object.defineProperty(link, 'sheet', { configurable: true, value: {} });
    initializeGoogleFonts();
    return { beforeLoad, afterLoad, alreadyLoaded: link.media };
  });
  expect(result).toEqual({ beforeLoad: 'print', afterLoad: 'all', alreadyLoaded: 'all' });
});
test('Google Fonts stays nonblocking until a controlled stylesheet response loads', async ({ page }) => {
  let releaseStylesheet;
  const stylesheetGate = new Promise((resolve) => { releaseStylesheet = resolve; });
  await page.route('https://fonts.googleapis.com/**', async (route) => {
    await stylesheetGate;
    await route.fulfill({ status: 200, contentType: 'text/css', body: '/* deterministic font CSS */' });
  });
  try {
    await page.goto('/', { waitUntil: 'domcontentloaded' });
    const link = page.locator('#googleFontsStylesheet');
    await expect(link).toHaveAttribute('media', 'print');
    releaseStylesheet();
    await expect(link).toHaveAttribute('media', 'all');
  } finally {
    releaseStylesheet();
  }
});
