'use strict';
const fs = require('node:fs');
const path = require('node:path');
const vm = require('node:vm');
const zlib = require('node:zlib');
const crypto = require('node:crypto');
const root = path.resolve(__dirname, '..');
const fixture = path.join(root, 'tests/fixtures/web-psalms');
const baseline = require('../tests/fixtures/web-psalms/baseline.json');
const normalize = text => text.replace(/\s+/gu, ' ').trim();
const sha256 = bytes => crypto.createHash('sha256').update(bytes).digest('hex');
function check(condition, message){ if(!condition) throw new Error(message); }
function readLibrary(source){
  return vm.runInNewContext(source + ';webLibrary', Object.create(null), {timeout:30000});
}
function parseChapter(html, chapter){
  check(html.includes(`<title>World English Bible Psalms ${chapter}</title>`), `Wrong source title: ${chapter}`);
  const labels = [...html.matchAll(/<div class='chapterlabel' id="V0">Psalm (\d+)<\/div>/g)];
  check(labels.length === 1 && Number(labels[0][1]) === chapter, `Wrong/duplicate source chapter: ${chapter}`);
  const start = labels[0].index + labels[0][0].length;
  const end = html.indexOf("<ul class='tnav'>", start);
  check(end > start, `Missing source footer boundary: ${chapter}`);
  // Drop notes, including their popup text; retain poetry continuations and
  // Psalm 119 alphabet headings in the project's existing verse placement.
  const body = html.slice(start, end).replace(/<a\b[^>]*class="notemark"[^>]*>[\s\S]*?<\/a>/g, '');
  const markers = [...body.matchAll(/<span class="verse" id="V(\d+)">(\d+)&#160;<\/span>/g)];
  check(markers.length > 0, `Missing source verses: ${chapter}`);
  check((body.match(/class="verse"/g) || []).length === markers.length, `Unexpected verse markup: ${chapter}`);
  const verses = markers.map((marker, index) => {
    check(Number(marker[1]) === index + 1 && marker[1] === marker[2], `Duplicate/missing verse number: ${chapter}:${marker[1]}`);
    const fragment = body.slice(marker.index + marker[0].length, markers[index + 1]?.index ?? body.length);
    const text = normalize(fragment.replace(/<[^>]*>/g, ' ').replace(/&#160;/g, ' '));
    check(text && !/&(?:#\d+|#x[\da-f]+|\w+);/i.test(text), `Empty verse/unhandled entity: ${chapter}:${index + 1}`);
    return text;
  });
  check(verses.length === baseline.psalms[chapter - 1].verseCount, `Unexpected verse count: ${chapter}`);
  return {chapter, numbers:markers.map(marker => Number(marker[1])), verses};
}
function readSource(){
  const bytes = zlib.gunzipSync(fs.readFileSync(path.join(fixture, 'engwebp-psalms-html.json.gz')));
  check(sha256(bytes) === baseline.sourceJsonSha256, 'Retained source hash mismatch');
  const pages = JSON.parse(bytes);
  check(Object.keys(pages).length === 150, 'Expected exactly 150 source pages');
  return Array.from({length:150}, (_, i) => {
    const key = `PSA${String(i + 1).padStart(3, '0')}.htm`;
    check(typeof pages[key] === 'string', `Missing source chapter: ${key}`);
    return parseChapter(pages[key], i + 1);
  });
}
function verify(book, source){
  check(book.chapters === 150 && Object.keys(book).filter(k => /^\d+$/.test(k)).length === 150 && !book[151], 'Expected exactly chapters 1–150');
  for(const row of source){
    const verses = book[row.chapter]?.verses;
    check(Array.isArray(verses) && verses.length === row.verses.length, `Missing chapter/verse slots: ${row.chapter}`);
    for(let i = 0; i < verses.length; i++) check(typeof verses[i] === 'string' && normalize(verses[i]) === row.verses[i], `Source text mismatch: ${row.chapter}:${i + 1}`);
  }
  check(new Set(source.map(row => JSON.stringify(book[row.chapter].verses))).size === 150, 'Duplicate Psalm bodies');
}
function repair(input){
  const library = readLibrary(input), old = library.psalms, source = readSource();
  check([150,151].includes(old.chapters), 'Unexpected stored chapter count');
  check(Object.keys(old).filter(k => /^\d+$/.test(k)).length === old.chapters, 'Unexpected stored chapter keys');
  if(old.chapters === 150){ verify(old, source); return {output:input, repairedFinalVerses:0}; }
  check(old[1]?.verses.length === 0, 'Missing expected empty leading chapter');
  const book = {};
  let repairedFinalVerses = 0;
  for(const row of source){
    const chapter = old[row.chapter + 1], verses = chapter?.verses;
    check(verses?.length === row.verses.length, `Unexpected baseline chapter: ${row.chapter}`);
    for(let i = 0; i < verses.length - 1; i++) check(normalize(verses[i]) === row.verses[i], `Unexpected nonfinal text difference: ${row.chapter}:${i + 1}`);
    check(verses.at(-1) === baseline.psalms[row.chapter - 1].finalVerse, `Unexpected baseline final verse: ${row.chapter}`);
    const previous = normalize(verses.at(-1)), final = row.verses.at(-1);
    check(final.startsWith(previous), `Final verse is not a continuation: ${row.chapter}`);
    if(previous !== final) repairedFinalVerses++;
    // Preserve every existing nonfinal verse byte, including whitespace.
    book[row.chapter] = {...chapter, verses:[...verses.slice(0, -1), final]};
  }
  check(repairedFinalVerses === 147, 'Expected exactly 147 truncated final verses');
  book.name = old.name; book.chapters = 150;
  verify(book, source);
  const serialized = JSON.stringify(old);
  const offset = input.indexOf('"psalms":' + serialized);
  check(offset >= 0 && input.indexOf('"psalms":' + serialized, offset + 1) < 0, 'Psalms serialization is not unique');
  const start = offset + '"psalms":'.length;
  const output = input.slice(0, start) + JSON.stringify(book) + input.slice(start + serialized.length);
  const after = readLibrary(output);
  for(const [id, value] of Object.entries(library)) if(id !== 'psalms') check(JSON.stringify(value) === JSON.stringify(after[id]), `Changed non-Psalms book: ${id}`);
  return {output, repairedFinalVerses};
}
if(require.main === module){
  const args = process.argv.slice(2);
  check(args.length <= 1 && args.every(arg => arg === '--check'), 'Only --check is supported');
  const file = path.join(root, 'js/bible/web.js');
  const input = fs.readFileSync(file, 'utf8');
  if(args.includes('--check')){
    verify(readLibrary(input).psalms, readSource());
    console.log('WEB Psalms: all 150 chapters and 2,461 full numbered verses match retained source.');
  } else {
    const result = repair(input);
    fs.writeFileSync(file, result.output, 'utf8');
    console.log(`WEB Psalms: 150 chapters; ${result.repairedFinalVerses} final verses repaired.`);
  }
}
module.exports = {baseline, normalize, sha256, readLibrary, parseChapter, readSource, verify, repair};
