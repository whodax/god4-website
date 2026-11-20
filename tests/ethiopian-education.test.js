// Static smoke checks for the Ethiopian educational pages.
// Run: node tests/ethiopian-education.test.js
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const root = path.resolve(__dirname, '..');
const read = (name) => fs.readFileSync(path.join(root, name), 'utf8');
const home = read('index.html');
const guide = read('guides/ethiopian-bible.html');
const enoch = read('books-of-enoch.html');
const css = read('css/ethiopian-guide.css');
assert.match(home, /id="ethiopian"/);
for (const page of [home, guide, enoch]) {
  assert.match(page, /href="\/guides\/ethiopian-bible\.html"/);
}
for (const page of [home, enoch]) {
  assert.doesNotMatch(page, /href="\/ethiopian-bible(?:\.html)?"/);
}
for (const [url, label] of [
  ['https://online.fliphtml5.com/ekjsx/blhe/', 'Open the Ethiopian Bible flipbook on FlipHTML5'],
  ['https://www.bible.com/bible/3177/MAT.1.%E1%88%90%E1%8A%AA%E1%8C%8D', 'Read the Ge’ez New Testament from Matthew 1'],
  ['https://ccel.org/ccel/c/charles/otpseudepig/files/jubilee/1.htm', 'Read Jubilees from chapter 1'],
]) {
  assert.ok(guide.includes('<a href="' + url + '">' + label + '</a>'), label + ' links directly to the text');
}
assert.match(guide, /rel="canonical" href="https:\/\/god4\.us\/guides\/ethiopian-bible"/);
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
for (const [id, url, label] of [
  ['enoch-1', 'https://en.wikisource.org/wiki/The_Book_of_Enoch_(Charles)/Chapter_01', 'Read 1 Enoch, chapter 1 on Wikisource'],
  ['enoch-2', 'https://scriptura.si/works/enoch-2-morfill-1896/2/', 'Read 2 Enoch, chapter 1 on Scriptura'],
  ['enoch-3', 'https://margins.bible/3-enoch/chapter-1/', 'Read 3 Enoch, chapter 1 on Margins'],
]) {
  const section = enoch.match(new RegExp('<section[^>]*id="' + id + '"[\\s\\S]*?</section>'))?.[0];
  assert.ok(section?.includes('<a href="' + url + '">' + label + '</a>'), id + ' links to its own reading source');
}
assert.match(enoch, /Book of the Watchers/);
assert.match(css, /focus-visible/);
assert.match(home, /id="view-reader"/);
assert.match(home, /id="readerTranslation"/);
console.log('Ethiopian education static checks passed.');
