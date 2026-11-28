'use strict';
const {test} = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const {createHash} = require('node:crypto');
const {readerBook} = require('../tools/original-language-config');
const {expansionConfig} = require('../tools/publish-expanded-original-language');
const {mapSourceRecords, normalizeRecords} = require('../tools/import-original-language');
const manifest = require('../docs/expanded-original-language-manifest.json');

for (const [bookId, entry] of Object.entries(manifest)) {
  test(bookId + ' has all reviewed chapter shards and the expected Reader verse coverage', () => {
    const directory = path.join(__dirname, '../data/word-study/original-language', bookId);
    const config = expansionConfig(bookId);
    const book = readerBook(bookId);
    assert.equal(Object.keys(entry.sha256).length, book.chapters);
    assert.deepEqual(fs.readdirSync(directory).sort(), Object.keys(entry.sha256).sort());
    let verses = 0, tokens = 0;
    for (let chapter = 1; chapter <= book.chapters; chapter++) {
      const name = chapter + '.json';
      const bytes = fs.readFileSync(path.join(directory, name));
      assert.equal(createHash('sha256').update(bytes).digest('hex'), entry.sha256[name], name);
      const records = normalizeRecords(JSON.parse(bytes).records);
      assert.ok(records.every(record => record.bookId === bookId && record.chapter === chapter &&
        record.status === 'authoritative' && record.source === config.source.attribution &&
        (!record.strongsNumber || (record.lemma && record.transliteration && record.definition))));
      const coverage = Array.from(new Set(records.map(record => record.verse)));
      const expected = Array.from(book[chapter].verses, (_,i) => i + 1)
        .filter(verse => !Object.hasOwn(config.referenceMapping.omittedReaderVerses || {}, chapter + ':' + verse));
      assert.deepEqual(coverage, expected, name);
      verses += coverage.length;
      tokens += records.length;
    }
    assert.equal(verses, entry.readerVerses);
    assert.equal(tokens, entry.sourceTokens);
  });
}

test('Numbers cannot import half of the Hebrew source for Reader 26:1', () => {
  assert.throws(() => mapSourceRecords([], expansionConfig('numbers'), {chapters:[25]}), /Incomplete merged source verses/);
});

test('Luke cannot silently use replacement tokens at the declared source omission', () => {
  const sample = require('../data/word-study/original-language/luke/17.json').records.find(record => record.verse === 37);
  assert.throws(() => mapSourceRecords([{...sample, verse:36}], expansionConfig('luke'), {chapters:[17]}),
    /Source contains a declared omission: 17:36/);
});
