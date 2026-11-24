const { test, expect } = require('@playwright/test');

test.use({ serviceWorkers: 'block', reducedMotion: 'reduce' });

for (const width of [320, 1280]) {
  test(`${width}px Study Desk scrolls independently and follows verse navigation`, async ({ page }) => {
    await page.setViewportSize({ width, height: 844 });
    await page.goto('/');
    await page.evaluate(() => initializeBibleExperience());
    await page.evaluate(() => navigateReaderToPassage('psalms', 119, 1));
    const pane = page.getByRole('region', { name: 'Scripture passage' });
    await expect(pane.locator('h2')).toHaveText('Psalms 119');
    await expect(pane).toHaveCSS('overflow-y', 'scroll');
    const checkScroll = () => pane.evaluate(element => ({ inner: element.scrollTop, outer: window.scrollY }));
    await pane.focus();
    const before = await checkScroll();
    await page.keyboard.press('PageDown');
    await expect.poll(async () => (await checkScroll()).inner).toBeGreaterThan(before.inner);
    expect((await checkScroll()).outer).toBe(before.outer);
    await page.evaluate(() => navigateReaderToPassage('psalms', 119, 145));
    await expect(pane.locator('[data-verse-number="145"]')).toBeInViewport();
    const fullscreen = page.locator('#fullscreenBtn');
    if (await fullscreen.isHidden()) await page.locator('#readerMoreTrigger').click();
    await fullscreen.click();
    await expect(page.locator('#view-reader')).toHaveClass(/reader-fullscreen/);
    await expect(pane).not.toHaveCSS('overflow-y', 'scroll');
    await expect(pane.locator('[data-verse-number="145"]')).toBeInViewport();
    await fullscreen.click();
    await expect(pane).toHaveCSS('overflow-y', 'scroll');
    await expect(pane.locator('[data-verse-number="145"]')).toBeInViewport();
  });

  test(`${width}px Ethiopian Readings scrolls independently and resets for the next chapter`, async ({ page }) => {
    await page.setViewportSize({ width, height: 844 });
    await page.goto('/guides/ethiopian-readings.html?book=psalms&chapter=119');
    const pane = page.getByRole('region', { name: 'Psalms 119' });
    await expect(pane).toHaveCSS('overflow-y', 'scroll');
    await pane.focus();
    const before = await page.evaluate(() => window.scrollY);
    await page.keyboard.press('PageDown');
    await expect.poll(() => pane.evaluate(element => element.scrollTop)).toBeGreaterThan(0);
    expect(await page.evaluate(() => window.scrollY)).toBe(before);
    await page.getByRole('button', { name: 'Chapter: 119', exact: true }).click();
    await page.getByRole('dialog', { name: 'Choose chapter' }).getByRole('button', { name: '118', exact: true }).click();
    const next = page.getByRole('region', { name: 'Psalms 118' });
    await expect(next).toBeVisible();
    expect(await next.evaluate(element => element.scrollTop)).toBe(0);
  });
}
