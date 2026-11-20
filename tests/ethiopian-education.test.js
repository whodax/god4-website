// Static smoke checks for the Ethiopian educational pages.
// Run: node tests/ethiopian-education.test.js
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const root = path.resolve(__dirname, '..');
const read = (name) => fs.readFileSync(path.join(root, name), 'utf8');
const home = read('index.html');
const guide = read('ethiopian-bible.html');
const enoch = read('books-of-enoch.html');
const css = read('css/ethiopian-guide.css');
assert.match(home, /id="ethiopian"/);
assert.match(home, /href="\/ethiopian-bible\.html"/);
assert.match(home, /href="\/books-of-enoch\.html"/);
assert.doesNotMatch(home.match(/<section class="ethiopian"[\s\S]*?<\/section>/)?.[0] || '', /<h3>/);
for (const page of [guide, enoch]) {
  assert.match(page, /<main\b/);
  assert.match(page, /<h1>/);
  assert.match(page, /href="\/css\/ethiopian-guide\.css"/);
  assert.match(page, /src="\/js\/theme\.js"/);
  assert.match(page, /data-theme-toggle/);
  assert.match(page, /href="\/"/);
  assert.doesNotMatch(page, /<script[^>]*>\s*[^<\s]/);
}
assert.match(guide, /4 Baruch is excluded/);
assert.match(guide, /Ethiopic Didascalia/);
assert.match(enoch, /id="enoch-1"/);
assert.match(enoch, /id="enoch-2"/);
assert.match(enoch, /id="enoch-3"/);
assert.match(enoch, /Book of the Watchers/);
assert.match(css, /focus-visible/);
assert.match(home, /id="view-reader"/);
assert.match(home, /id="readerTranslation"/);
console.log('Ethiopian education static checks passed.');
