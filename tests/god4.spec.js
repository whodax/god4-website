const { test, expect } = require('@playwright/test');

test('homepage and primary navigation load without browser errors', async ({ page }, testInfo) => {
  const errors = [];
  const failedLocalRequests = [];
  const localOrigin = new URL(testInfo.project.use.baseURL).origin;
  page.on('console', (message) => {
    if (message.type() === 'error' && !message.text().includes('Failed to load resource')) {
      errors.push(`console: ${message.text()}`);
    }
  });
  page.on('pageerror', (error) => errors.push(`page: ${error.message}`));
  page.on('requestfailed', (request) => {
    if (request.url().startsWith(`${localOrigin}/`)) {
      failedLocalRequests.push(`${request.url()}: ${request.failure().errorText}`);
    }
  });

  await page.goto('/');
  await expect(page).toHaveTitle(/GOD4\.US/);
  await expect(page.locator('nav')).toContainText('Open Bibles');
  await expect(page.locator('nav')).toContainText('Sacred Verses');
  await expect(page.locator('nav')).toContainText('Study');
  await expect(page.locator('#readerContent')).toContainText('John 1');
  expect([...errors, ...failedLocalRequests], [...errors, ...failedLocalRequests].join('\n')).toEqual([]);
});

test('hero verse can be saved, unsaved, and shown in the saved-verses tray', async ({ page }) => {
  await page.goto('/');
  const saveButton = page.locator('#heroFav');
  await saveButton.click();
  await expect(page.locator('#savedCount')).toHaveText('1');
  await expect(saveButton).toHaveText('♥');

  await page.locator('.saved-pill').click();
  await expect(page.locator('#tray')).toHaveCSS('right', '0px');
  await expect(page.locator('#trayList')).toContainText('John 3:16');

  await page.locator('#tray button[onclick="toggleTray()"]').click();
  await saveButton.click();
  await expect(page.locator('#savedCount')).toHaveText('0');
});

test('verse rotation and Scripture search work', async ({ page }) => {
  await page.goto('/');
  const reference = page.locator('#verseRef');
  const initial = await reference.textContent();
  await page.getByRole('button', { name: 'Another verse' }).click();
  await expect(reference).not.toHaveText(initial);

  await page.locator('#searchInput').fill('faith');
  await page.getByRole('button', { name: 'Search' }).click();
  await expect.poll(() => page.locator('#results .result-card').count()).toBeGreaterThan(0);
  await expect(page.locator('#results')).toContainText('Hebrews 11:1');
});

test('Bible data interface exposes the current local dataset', async ({ page }) => {
  await page.goto('/');
  expect(await page.evaluate(() => ({
    translations: BibleData.listTranslations().map((translation) => translation.id),
    books: BibleData.listBooks('demo-local').map((book) => book.id),
    chapterCount: BibleData.getChapterCount('demo-local', 'john'),
    verse: BibleData.getVerse('demo-local', 'john', 1, 1).text
  }))).toEqual({
    translations: ['demo-local', 'web'],
    books: ['john', 'psalms', 'romans', 'genesis', 'matthew', 'philippians'],
    chapterCount: 3,
    verse: 'In the beginning was the Word, and the Word was with God, and the Word was God.'
  });
});

test('WEB data is complete, attributed, searchable, and selectable', async ({ page }) => {
  await page.goto('/');
  expect(await page.evaluate(() => ({
    metadata: BibleData.listTranslations().find((translation) => translation.id === 'web'),
    bookCount: BibleData.listBooks('web').length,
    chapterCount: BibleData.getChapterCount('web', 'john'),
    verse: BibleData.getVerse('web', 'john', 3, 16).text,
    searchMatch: BibleData.search('web', 'only born Son').some((match) => match.bookId === 'john' && match.chapter === 3 && match.verse === 16)
  }))).toMatchObject({
    metadata: {
      abbreviation: 'WEB',
      copyrightStatus: 'Public domain',
      provider: 'web-library'
    },
    bookCount: 66,
    chapterCount: 21,
    verse: 'For God so loved the world, that he gave his only born Son, that whoever believes in him should not perish, but have eternal life.',
    searchMatch: true
  });

  await page.locator('#readerTranslation').selectOption('web');
  await expect(page.locator('#readerContent')).toContainText('John 1');
  await expect(page.locator('#readerContent')).toContainText('In the beginning was the Word');

  await page.getByRole('button', { name: 'Compare' }).click();
  await page.locator('#compareGrid select').first().selectOption('web');
  await expect(page.locator('#compareGrid .compare-col').first()).toContainText('For God so loved the world');
});

test('reader read-aloud controls speak only chapter verses and manage playback', async ({ page }) => {
  await page.addInitScript(() => {
    window.__speech = { spoken: [], pauses: 0, resumes: 0, cancels: 0 };
    const utterance = function(text) {
      this.text = text;
    };
    Object.defineProperty(window, 'SpeechSynthesisUtterance', { configurable: true, value: utterance });
    const synthesis = {
      speaking: false,
      paused: false,
      speak(utterance) {
        this.speaking = true;
        this.lastUtterance = utterance;
        window.__speech.spoken.push(utterance.text);
      },
      pause() {
        this.paused = true;
        window.__speech.pauses++;
      },
      resume() {
        this.paused = false;
        window.__speech.resumes++;
      },
      cancel() {
        this.speaking = false;
        this.paused = false;
        window.__speech.cancels++;
      }
    };
    Object.defineProperty(window, 'speechSynthesis', { configurable: true, value: synthesis });
  });
  await page.goto('/');

  await page.locator('#readAloudPlay').click();
  await expect(page.locator('#readAloudStatus')).toHaveText('Reading aloud.');
  expect(await page.evaluate(() => window.__speech.spoken[0])).toBe('In the beginning was the Word, and the Word was with God, and the Word was God.');
  expect(await page.evaluate(() => window.__speech.spoken[0])).not.toContain('John 1');

  await page.getByRole('button', { name: 'Pause reading aloud' }).click();
  await expect(page.locator('#readAloudStatus')).toHaveText('Reading aloud paused.');
  await page.getByRole('button', { name: 'Resume reading aloud' }).click();
  await expect(page.locator('#readAloudStatus')).toHaveText('Reading aloud.');
  await page.locator('#readAloudStop').click();
  await expect(page.locator('#readAloudStatus')).toHaveText('Ready to read aloud.');

  await page.locator('#readAloudPlay').click();
  const cancelsBeforeNavigation = await page.evaluate(() => window.__speech.cancels);
  await page.locator('#chapterSelect').selectOption('2');
  expect(await page.evaluate(() => window.__speech.cancels)).toBeGreaterThan(cancelsBeforeNavigation);
  await expect(page.locator('#readAloudStatus')).toHaveText('Ready to read aloud.');
});

test('reader read-aloud controls are disabled when Web Speech API is unavailable', async ({ page }) => {
  await page.addInitScript(() => {
    Object.defineProperty(window, 'speechSynthesis', { configurable: true, value: undefined });
    Object.defineProperty(window, 'SpeechSynthesisUtterance', { configurable: true, value: undefined });
  });
  await page.goto('/');
  await expect(page.locator('#readAloudStatus')).toHaveText('Read aloud is unavailable in this browser.');
  await expect(page.locator('#readAloudPlay')).toBeDisabled();
  await expect(page.locator('#readAloudStop')).toBeDisabled();
});

test('verse read-aloud shares chapter speech and applies persisted speed and voice', async ({ page }) => {
  await page.addInitScript(() => {
    window.__speech = { spoken: [], cancels: 0, voices: [
      { name: 'Samantha', lang: 'en-US', localService: true },
      { name: 'Daniel', lang: 'en-GB', localService: true },
      { name: 'Extra One', lang: 'en-US', localService: true },
      { name: 'Extra Two', lang: 'en-US', localService: true },
      { name: 'Extra Three', lang: 'en-US', localService: true },
      { name: 'Extra Four', lang: 'en-US', localService: true },
      { name: 'Extra Five', lang: 'en-US', localService: true }
    ] };
    const utterance = function(text) {
      this.text = text;
    };
    Object.defineProperty(window, 'SpeechSynthesisUtterance', { configurable: true, value: utterance });
    const synthesis = {
      getVoices() { return window.__speech.voices; },
      addEventListener(type, handler) { this.voiceChangedHandler = handler; },
      speak(value) { this.lastUtterance = value; window.__speech.spoken.push(value); },
      pause() {},
      resume() {},
      cancel() { window.__speech.cancels++; }
    };
    Object.defineProperty(window, 'speechSynthesis', { configurable: true, value: synthesis });
  });
  await page.goto('/');

  await expect(page.locator('#readAloudSpeed option')).toHaveText(['50%', '75%', '100%', '125%', '150%', '175%', '200%', '225%', '250%']);
  await expect(page.locator('#readAloudSpeed')).toHaveValue('1');
  await expect(page.locator('#readAloudVoice option')).toHaveCount(7);
  await page.evaluate(() => {
    window.__speech.voices = [
      { name: 'Samantha', lang: 'en-US', localService: true },
      { name: 'Daniel', lang: 'en-GB', localService: true },
      { name: 'Refreshed Voice', lang: 'en-US', localService: true },
      { name: 'Extra One', lang: 'en-US', localService: true },
      { name: 'Extra Two', lang: 'en-US', localService: true },
      { name: 'Extra Three', lang: 'en-US', localService: true },
      { name: 'Extra Four', lang: 'en-US', localService: true }
    ];
    window.speechSynthesis.voiceChangedHandler();
  });
  await expect(page.locator('#readAloudVoice option')).toHaveText(['Automatic', 'Samantha', 'Daniel', 'Refreshed Voice', 'Extra One', 'Extra Two', 'Extra Three']);
  await page.locator('#readAloudVoice').selectOption('Samantha');
  await page.locator('#readAloudSpeed').selectOption('1.5');
  await page.locator('#readAloudPlay').click();
  expect(await page.evaluate(() => ({ text: window.__speech.spoken[0].text, rate: window.__speech.spoken[0].rate, voice: window.__speech.spoken[0].voice.name }))).toEqual({
    text: 'In the beginning was the Word, and the Word was with God, and the Word was God.',
    rate: 1.5,
    voice: 'Samantha'
  });

  const cancelsBeforeVerse = await page.evaluate(() => window.__speech.cancels);
  await page.locator('#readerContent [data-verse-speech="2"]').click();
  expect(await page.evaluate(() => ({
    utterance: window.__speech.spoken[1],
    cancels: window.__speech.cancels,
    storedSpeed: localStorage.getItem('god4.speech.speed'),
    storedVoice: localStorage.getItem('god4.speech.voice')
  }))).toEqual({
    utterance: expect.objectContaining({ text: 'He was with God in the beginning.' }),
    cancels: cancelsBeforeVerse + 1,
    storedSpeed: '1.5',
    storedVoice: 'Samantha'
  });
  expect(await page.evaluate(() => window.__speech.spoken[1].text)).not.toContain('Read aloud');
  await page.locator('#readAloudStop').click();
  await page.locator('#readAloudSpeed').selectOption('0.5');
  await page.locator('#readAloudPlay').click();
  expect(await page.evaluate(() => window.__speech.spoken[2].rate)).toBe(0.5);
  await page.locator('#readAloudSpeed').selectOption('2.5');
  await page.locator('#readerContent [data-verse-speech="1"]').click();
  expect(await page.evaluate(() => window.__speech.spoken[3].rate)).toBe(2.5);
});

test('voice commands use the shared BibleSpeech engine', async ({ page }) => {
  await page.addInitScript(() => {
    window.__speech = { spoken: [], pauses: 0, resumes: 0, cancels: 0 };
    const utterance = function(text) { this.text = text; };
    Object.defineProperty(window, 'SpeechSynthesisUtterance', { configurable: true, value: utterance });
    const synthesis = {
      speak(value) { this.lastUtterance = value; window.__speech.spoken.push(value); },
      pause() { window.__speech.pauses++; },
      resume() { window.__speech.resumes++; },
      cancel() { window.__speech.cancels++; }
    };
    Object.defineProperty(window, 'speechSynthesis', { configurable: true, value: synthesis });
  });
  await page.goto('/');
  await page.evaluate(() => handleVoiceCommand('read'));
  await page.evaluate(() => handleVoiceCommand('pause'));
  await page.evaluate(() => handleVoiceCommand('resume'));
  await page.evaluate(() => handleVoiceCommand('stop'));
  expect(await page.evaluate(() => window.__speech.spoken[0].text)).toContain('In the beginning was the Word');
  expect(await page.evaluate(() => ({ pauses: window.__speech.pauses, resumes: window.__speech.resumes, cancels: window.__speech.cancels }))).toEqual({ pauses: 1, resumes: 1, cancels: 3 });
});

test('reader controls, highlighting, fullscreen, compare, and plan views work', async ({ page }) => {
  await page.goto('/');
  const reader = page.locator('#view-reader');
  await expect(reader).toHaveClass(/active/);

  await page.locator('#bookSelect').selectOption('psalms');
  await expect(page.locator('#readerContent')).toContainText('Psalms 1');
  await page.locator('#chapterSelect').selectOption('2');
  await expect(page.locator('#readerContent')).toContainText('Psalms 2');
  await page.locator('.reader-controls-bottom').getByRole('button', { name: 'Next' }).click();
  await expect(page.locator('#readerContent')).toContainText('Psalms 3');
  await page.locator('.reader-controls-bottom').getByRole('button', { name: 'Previous' }).click();
  await expect(page.locator('#readerContent')).toContainText('Psalms 2');

  const verseNumber = page.locator('#readerContent .vnum').first();
  await verseNumber.click();
  await expect(verseNumber).toHaveClass(/highlighted/);

  await page.getByRole('button', { name: 'Fullscreen' }).click();
  await expect(page.locator('#fsOverlay')).toHaveClass(/active/);
  await page.getByRole('button', { name: 'Exit Fullscreen' }).click();
  await expect(page.locator('#fsOverlay')).not.toHaveClass(/active/);

  await page.getByRole('button', { name: 'Compare' }).click();
  await expect(page.locator('#view-compare')).toHaveClass(/active/);
  await page.locator('#compareBook').selectOption('psalm23');
  await expect(page.locator('#compareGrid .compare-col')).toHaveCount(2);
  await expect(page.locator('#compareGrid')).toContainText('The LORD is my shepherd');

  await page.getByRole('button', { name: 'Plan' }).click();
  await expect(page.locator('#view-plan')).toHaveClass(/active/);
  await expect(page.locator('#planDays .plan-day')).toHaveCount(30);
  await expect(page.locator('#planDone')).toHaveText(/\d+ of 30 days/);

  await page.getByRole('button', { name: 'Reader' }).click();
  await expect(reader).toHaveClass(/active/);
});

test('Compare supports passage and independent version changes with aligned verses', async ({ page }) => {
  const errors = [];
  page.on('console', (message) => {
    if (message.type() === 'error' && !message.text().includes('Failed to load resource')) {
      errors.push(message.text());
    }
  });
  page.on('pageerror', (error) => errors.push(error.message));

  await page.goto('/');
  await page.getByRole('button', { name: 'Compare' }).click();
  await expect(page.locator('#view-compare')).toHaveClass(/active/);
  await expect(page.locator('#compareGrid .compare-col')).toHaveCount(2);
  await expect(page.locator('#compareGrid select')).toHaveCount(2);
  await expect(page.locator('#compareGrid select').first()).toHaveAccessibleName('Left translation');
  await expect(page.locator('#compareGrid select').nth(1)).toHaveAccessibleName('Right translation');

  await page.locator('#compareBook').selectOption('romans8');
  await expect(page.locator('#compareGrid .compare-col').first().locator('.vnum')).toHaveText(['28', '29', '30']);

  await page.locator('#compareGrid select').first().selectOption('web');
  await expect(page.locator('#compareGrid .compare-col').first()).toContainText('all things work together for good');
  await expect(page.locator('#compareGrid .compare-col').first().locator('.vnum')).toHaveText(['28', '29', '30']);

  await page.locator('#compareGrid select').nth(1).selectOption('kjv');
  await expect(page.locator('#compareGrid .compare-col').nth(1)).toContainText('all things work together for good');
  await expect(page.locator('#compareGrid .compare-col').nth(1).locator('.vnum')).toHaveText(['28', '29', '30']);
  expect(errors).toEqual([]);
});

test('Compare versions stack on smaller screens', async ({ page }) => {
  await page.setViewportSize({ width: 600, height: 800 });
  await page.goto('/');
  await page.getByRole('button', { name: 'Compare' }).click();
  await expect.poll(() => page.locator('#compareGrid').evaluate((grid) => {
    return getComputedStyle(grid).gridTemplateColumns.trim().split(/\s+/).length;
  })).toBe(1);
});

test('top and bottom Reader controls stay synchronized', async ({ page }) => {
  await page.goto('/');
  const topControls = page.locator('.reader-controls-top');
  const bottomControls = page.locator('.reader-controls-bottom');

  await expect(page.locator('[data-reader-controls]')).toHaveCount(2);
  await expect(topControls.getByRole('button', { name: 'Previous' })).toBeDisabled();
  await expect(bottomControls.getByRole('button', { name: 'Previous' })).toBeDisabled();
  await topControls.getByRole('button', { name: 'Next' }).click();
  await expect(page.locator('#readerContent')).toContainText('John 2');
  await expect(topControls.getByRole('button', { name: 'Previous' })).toBeEnabled();
  await expect(bottomControls.getByRole('button', { name: 'Previous' })).toBeEnabled();

  await page.evaluate(() => {
    window.SpeechRecognition = function FakeRecognition() {};
    window.SpeechRecognition.prototype.start = function() {};
    window.SpeechRecognition.prototype.stop = function() {};
  });
  await topControls.getByRole('button', { name: 'Voice Commands' }).click();
  await expect(topControls.getByRole('button', { name: 'Voice Commands' })).toHaveAttribute('aria-pressed', 'true');
  await expect(bottomControls.getByRole('button', { name: 'Voice Commands' })).toHaveAttribute('aria-pressed', 'true');
  await expect(page.locator('#voiceStatusTop')).toHaveText('Listening...');
  await expect(page.locator('#voiceStatus')).toHaveText('Listening...');
});

test('blocked microphone access is reported without breaking the Reader', async ({ page }) => {
  await page.goto('/');
  await page.evaluate(() => {
    function FakeRecognition() { window.fakeRecognition = this; }
    FakeRecognition.prototype.start = function() {};
    FakeRecognition.prototype.stop = function() {};
    Object.defineProperty(window, 'SpeechRecognition', { configurable: true, value: FakeRecognition });
    Object.defineProperty(window, 'webkitSpeechRecognition', { configurable: true, value: FakeRecognition });
  });
  await page.locator('.reader-controls-top').getByRole('button', { name: 'Voice Commands' }).click();
  await page.evaluate(() => window.eval("voiceRecognition.onerror({ error: 'not-allowed' })"));
  await expect(page.locator('#voiceStatus')).toHaveText('Microphone access is blocked. Allow microphone access in your browser to use Voice Commands.');
  await page.locator('#bookSelect').selectOption('psalms');
  await expect(page.locator('#readerContent')).toContainText('Psalms 1');
});
