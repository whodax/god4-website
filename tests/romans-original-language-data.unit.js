'use strict';
const {test} = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const crypto = require('node:crypto');
const {SCHEMA_FIELDS, normalizeRecords} = require('../tools/import-original-language');
const {readerBook, romansBookConfig, mapReference} = require('../tools/original-language-config');
const root = path.resolve(__dirname, '..');
const directory = path.join(root, 'data/word-study/original-language/romans');
const chapters = Array.from({length:16}, (_, i) => {
  const bytes = fs.readFileSync(path.join(directory, (i + 1) + '.json'));
  return {chapter:i + 1, bytes, records:JSON.parse(bytes).records};
});
const records = chapters.flatMap(c => c.records);
const verse = (chapter, number) => records.filter(r => r.chapter === chapter && r.verse === number);

test('Romans production has exactly 16 reviewed shards, 7210 tokens and 5596598 bytes', () => {
  assert.deepEqual(fs.readdirSync(directory).sort(), chapters.map(c => c.chapter + '.json').sort());
  assert.equal(records.length, 7210);
  assert.equal(chapters.reduce((n, c) => n + c.bytes.length, 0), 5596598);
});

test('every Romans record preserves the populated authoritative 15-field contract', () => {
  assert.deepEqual(normalizeRecords(records), records);
  for(const c of chapters) for(const r of c.records){
    assert.deepEqual(Object.keys(r), SCHEMA_FIELDS);
    assert.equal(r.bookId, 'romans'); assert.equal(r.language, 'greek');
    assert.equal(r.status, 'authoritative'); assert.equal(r.chapter, c.chapter);
    assert.match(r.strongsNumber, /^G\d+$/);
    for(const key of ['lemma', 'transliteration', 'definition', 'morphology', 'surface', 'source']){
      assert.equal(typeof r[key], 'string'); assert.ok(r[key].trim());
    }
    assert.equal(r.pronunciation, null); assert.equal(r.partOfSpeech, null);
    assert.match(r.source, /27a45ff1b7be6c17ccbfeac414f3f55732ae8e28/);
    assert.match(r.source, /0acd2f251c2d35ff8db2dece4e0593979d3ac223/);
  }
});

test('all 433 Reader verses have contiguous unique tokens and no unexpected references', () => {
  const expected = [], reader = readerBook('romans');
  for(let ch = 1; ch <= 16; ch++) for(let v = 1; v <= reader[ch].verses.length; v++){
    expected.push(ch + ':' + v);
    const rows = verse(ch, v); assert.ok(rows.length);
    assert.deepEqual(rows.map(r => r.tokenIndex), rows.map((_, i) => i));
  }
  assert.equal(expected.length, 433);
  assert.deepEqual([...new Set(records.map(r => r.chapter + ':' + r.verse))], expected);
});

test('Romans 8:28 serializes one παντα with its reviewed primary analysis', () => {
  const rows = verse(8, 28).filter(r => r.surface === 'παντα');
  assert.equal(rows.length, 1);
  assert.equal(rows[0].tokenIndex, 7); assert.equal(rows[0].strongsNumber, 'G3956');
  assert.equal(rows[0].morphology, 'A-APN');
});

test('Romans 14 stops at 23 and 16:24 retains its reviewed identity tokens', () => {
  assert.equal(Math.max(...chapters[13].records.map(r => r.verse)), 23);
  assert.equal(verse(14, 23).length, 18);
  assert.deepEqual(mapReference(romansBookConfig(), 16, 24), {bookId:'romans', chapter:16, verse:24});
  const rows = verse(16, 24); assert.equal(rows.length, 11);
  assert.equal(rows[0].surface, 'η'); assert.equal(rows.at(-1).surface, 'αμην');
});

for(const [source, target, count, first, last, strongs] of [
  [24, 25, 20, 'τω', 'σεσιγημενου', 'G3588'],
  [25, 26, 20, 'φανερωθεντος', 'γνωρισθεντος', 'G5319'],
  [26, 27, 13, 'μονω', 'αμην', 'G3441']
]) test(`reviewed source 14:${source} populates Reader 16:${target} without collision`, () => {
  assert.deepEqual(mapReference(romansBookConfig(), 14, source), {bookId:'romans', chapter:16, verse:target});
  assert.equal(verse(14, source).length, 0);
  const rows = verse(16, target); assert.equal(rows.length, count);
  assert.equal(rows[0].surface, first); assert.equal(rows.at(-1).surface, last);
  assert.equal(rows[0].strongsNumber, strongs);
});

test('every production shard matches the retained pilot checksums documented for publication', () => {
  const doc = fs.readFileSync(path.join(root, 'docs/romans-original-language-publication.md'), 'utf8');
  const manifest = [...doc.matchAll(/^\| (\d+) \| (\d+) \| ([a-f0-9]{64}) \|$/gm)];
  assert.equal(manifest.length, 16);
  for(const [i, row] of manifest.entries()){
    assert.equal(Number(row[1]), chapters[i].chapter);
    assert.equal(Number(row[2]), chapters[i].bytes.length);
    assert.equal(crypto.createHash('sha256').update(chapters[i].bytes).digest('hex'), row[3]);
  }
});
