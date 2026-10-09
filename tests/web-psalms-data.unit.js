'use strict';
const {test} = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const vm = require('node:vm');
const zlib = require('node:zlib');
const {execFileSync} = require('node:child_process');
const repair = require('../tools/repair-web-psalms');
const generator = require('../tools/generate-translation-manifest');
const root = path.resolve(__dirname, '..');
const input = fs.readFileSync(path.join(root, 'js/bible/web.js'), 'utf8');
const library = repair.readLibrary(input), source = repair.readSource();
const original = execFileSync('git', ['show', repair.baseline.commit + ':js/bible/web.js'], {cwd:root, maxBuffer:16000000, encoding:'utf8'});
const oldLibrary = repair.readLibrary(original);
const pages = JSON.parse(zlib.gunzipSync(fs.readFileSync(path.join(__dirname, 'fixtures/web-psalms/engwebp-psalms-html.json.gz'))));

test('WEB contains exactly nonempty chapters 1–150 and no duplicate Psalm bodies', () => {
  assert.equal(library.psalms.chapters, 150);
  assert.deepEqual(Object.keys(library.psalms).filter(k => /^\d+$/.test(k)), Array.from({length:150}, (_, i) => String(i + 1)));
  assert.equal(library.psalms[1].verses.length, 6);
  assert.equal(library.psalms[151], undefined);
  assert.equal(new Set(source.map(row => JSON.stringify(library.psalms[row.chapter].verses))).size, 150);
});
for(const row of source) test(`WEB Psalm ${row.chapter}: identity, count, contiguous numbers and every full verse match source`, () => {
  const actual = library.psalms[row.chapter].verses;
  assert.equal(actual.length, row.verses.length);
  assert.deepEqual(row.numbers, Array.from({length:actual.length}, (_, i) => i + 1));
  assert.deepEqual(Array.from(actual, repair.normalize), row.verses);
  assert.equal(repair.normalize(actual.at(-1)), row.verses.at(-1));
});
test('exactly 147 final verses were repaired; 35, 72 and 130 were already complete', () => {
  const changed = source.filter(row => repair.normalize(repair.baseline.psalms[row.chapter - 1].finalVerse) !== row.verses.at(-1));
  assert.equal(changed.length, 147);
  assert.deepEqual(source.filter(row => !changed.includes(row)).map(row => row.chapter), [35,72,130]);
  for(const row of changed) assert.ok(row.verses.at(-1).startsWith(repair.normalize(repair.baseline.psalms[row.chapter - 1].finalVerse)));
});
test('repair reproduces output from pinned baseline and preserves bytes surrounding Psalms', () => {
  const result = repair.repair(original);
  assert.equal(result.repairedFinalVerses, 147);
  assert.equal(generator.canonicalDeployBytes(result.output).toString(), generator.canonicalDeployBytes(input).toString());
  const outside = s => s.replace(JSON.stringify(repair.readLibrary(s).psalms), '<PSALMS>');
  assert.equal(outside(result.output), outside(original));
  assert.equal(repair.repair(input).output, input);
});
test('all 65 other WEB books and all preexisting nonfinal Psalms strings are unchanged', () => {
  for(const [id, hash] of Object.entries(repair.baseline.nonPsalmsHashes)){
    assert.equal(repair.sha256(JSON.stringify(library[id])), hash, id);
    assert.equal(JSON.stringify(library[id]), JSON.stringify(oldLibrary[id]), id);
  }
  for(const row of source) assert.deepEqual(Array.from(library.psalms[row.chapter].verses.slice(0,-1)), Array.from(oldLibrary.psalms[row.chapter + 1].verses.slice(0,-1)));
});
test('source parser rejects wrong or duplicate chapters and missing/duplicate verse numbers', () => {
  const html = pages['PSA001.htm'];
  for(const changed of [html.replace('Psalm 1</div>', 'Psalm 2</div>'), html.replace('id="V2">2', 'id="V1">1'), html.replace('id="V2">2', 'id="V3">3'), html.replace('Psalm 1</div>', 'Psalm 1</div><div class=\'chapterlabel\' id="V0">Psalm 1</div>')]) assert.throws(() => repair.parseChapter(changed, 1));
  assert.throws(() => repair.parseChapter(html.replace(/<ul class='tnav'>/g, '<ul>'), 1), /boundary/);
});
test('repair fails on unexpected stored counts, chapter keys or a missing source verse slot', () => {
  assert.throws(() => repair.repair(original.replace('"chapters":151', '"chapters":152')), /count/);
  const clone = JSON.parse(JSON.stringify(library.psalms)); delete clone[23];
  assert.throws(() => repair.verify(clone, source));
  clone[23] = library.psalms[22]; assert.throws(() => repair.verify(clone, source));
});
test('manifest is generated correctly, WEB changes as expected and all other metadata is preserved', () => {
  generator.checkOutput();
  const manifest = generator.buildManifest();
  assert.notEqual(manifest.web.revision, repair.baseline.manifest.web.revision);
  assert.notEqual(manifest.web.integrity, repair.baseline.manifest.web.integrity);
  assert.equal(manifest.web.structure.chapterCount, repair.baseline.manifest.web.structure.chapterCount - 1);
  assert.equal(manifest.web.structure.verseCount, repair.baseline.manifest.web.structure.verseCount);
  for(const id of Object.keys(manifest).filter(id => id !== 'web')) assert.deepEqual(manifest[id], repair.baseline.manifest[id]);
});
test('BibleData accepts corrected WEB and returns correct Psalm identities, verse slots and boundaries', () => {
  const context = vm.createContext({});
  vm.runInContext(input + '\n' + fs.readFileSync(path.join(root, 'js/bible/translation-manifest.js'), 'utf8') + '\n' + fs.readFileSync(path.join(root, 'js/bible/data.js'), 'utf8') + ';globalThis.data = BibleData;', context);
  assert.equal(context.data.validateTranslation('web'), true);
  assert.equal(context.data.getChapterCount('web','psalms'),150);
  assert.equal(context.data.getChapter('web','psalms',151),null);
  for(const row of source) assert.equal(context.data.getVerse('web','psalms',row.chapter,1).text, library.psalms[row.chapter].verses[0]);
  assert.match(context.data.getVerse('web','psalms',22,1).text, /^My God, my God, why have you forsaken me\?/);
  assert.match(context.data.getVerse('web','psalms',23,1).text, /^The LORD is my shepherd/);
  assert.match(context.data.getVerse('web','psalms',24,1).text, /^The earth is the LORD’s/);
});
