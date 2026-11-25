'use strict';

const fs = require('node:fs');
const path = require('node:path');
const vm = require('node:vm');
const {createHash} = require('node:crypto');
const {loadBibleLibrary, READER_TOKEN_PATTERN, normalizeDictionaryTerm} = require('./audit-word-study-coverage');
const canon = require('../js/bible/canon');
const priority = require('../data/word-study/web-common-words.json').entries;
const root = path.resolve(__dirname, '..');
const sources = require('./web-alignment-sources.json');
const books = 'GEN EXO LEV NUM DEU JOS JDG RUT 1SA 2SA 1KI 2KI 1CH 2CH EZR NEH EST JOB PSA PRO ECC SNG ISA JER LAM EZK DAN HOS JOL AMO OBA JON MIC NAM HAB ZEP HAG ZEC MAL MAT MRK LUK JHN ACT ROM 1CO 2CO GAL EPH PHP COL 1TH 2TH 1TI 2TI TIT PHM HEB JAS 1PE 2PE 1JN 2JN 3JN JUD REV'.split(' ');
const words = text => [...text.matchAll(READER_TOKEN_PATTERN)];
const sha = data => createHash('sha256').update(data).digest('hex');
const fail = (reason, ambiguous = false) => ({reason, ambiguous});
const plain = text => text.normalize('NFC').replace(/\u2060/g, '');
const greek = text => text.normalize('NFD').replace(/\p{Mark}|['’]/gu, '').toLowerCase().replace(/ς/g, 'σ');
const hebrew = text => plain(text).normalize('NFD').replace(/[\u0591-\u05af\u05bd/]/g, '');
const typography = text => text.trim().replace(/\s+/g, ' ').replace(/[“”]/g, '"').replace(/[‘’]/g, "'");

function loadSource(directory, pin) {
  const filenames = fs.readdirSync(directory).filter(name => /\.usfm$|^(LICENSE.md|manifest.yaml)$/.test(name)).sort();
  const hash = createHash('sha256');
  const byBook = new Map();
  for (const name of filenames) {
    const bytes = fs.readFileSync(path.join(directory, name));
    hash.update(name + '\0').update(bytes).update('\0');
    const code = name.match(/-([A-Z0-9]{3})\.usfm$/)?.[1];
    if (!books.includes(code)) continue;
    if (byBook.has(code)) throw new Error('Duplicate source book ' + code);
    byBook.set(code, readBook(bytes.toString('utf8')));
  }
  if (hash.digest('hex') !== pin.contentsSha256) throw new Error('Input checksum mismatch for ' + pin.version);
  return byBook;
}

function readBook(text) {
  const markers = [...text.matchAll(/^[ \t]*(?:\\(?:q\d*|p|m|li\d+|pm|pmo|pmc) +)?\\(c|v) (\d+)(?=\s|[-a-z])/gm)];
  const verses = new Map();
  let chapter = 0;
  for (const [index, marker] of markers.entries()) {
    if (marker[1] === 'c') {
      chapter = Number(marker[2]);
      continue;
    }
    // Skip verse bridges and suffixes. A repeat is deliberately ambiguous.
    const start = marker.index + marker[0].length;
    if (!/\s/.test(text[start] || '')) continue;
    const key = chapter + ':' + Number(marker[2]);
    verses.set(key, verses.has(key) ? null : text.slice(start, markers[index + 1]?.index));
  }
  return verses;
}

function readOriginal(body) {
  const tokens = [];
  for (const [, form, attrs] of withoutNotes(body).matchAll(/\\w ([^|\\]+)\|([^\\]*)\\w\*/g)) {
    tokens.push({form, strong:attribute(attrs, 'strong'), lemma:attribute(attrs, 'lemma'), morph:attribute(attrs, 'x-morph')});
  }
  return tokens;
}

function withoutNotes(text) {
  return text.replace(/\\(f|x) [\s\S]*?\\\1\*/g, '');
}

function attribute(text, name) {
  return text.match(new RegExp('(?:^|\\s|\\|)' + name + '="([^"]*)"'))?.[1] || '';
}

function readAlignment(body) {
  const milestones = [], active = [], tags = [];
  let english = '', cursor = 0;
  function append(value) {
    // Paragraphs and indentation do not alter selectable text.
    english += value.replace(/\r?\n[ \t]*/g, ' ');
  }
  body = withoutNotes(body).replace(/\\ts\\\*/g, '').split(/\r?\n/).filter(line =>
    !/^\\(?:s\d*|r|d|sp|ms\d*|mr|cl|mt\d*|mte\d*|rem)(?:\s|$)/.test(line))
    .join('\n').replace(/(?:^|\n)\\(?:p|m|b|q\d*|li\d*|pi\d*|nb|pm|pmo|pmc|pmr)(?=\s|$)/g, '\n');
  for (const match of body.matchAll(/\\zaln-s\s+([^\\]*)\\\*|\\zaln-e\\\*|\\w ([^|\\]+)\|([^\\]*)\\w\*/g)) {
    append(body.slice(cursor, match.index));
    cursor = match.index + match[0].length;
    if (match[1] !== undefined) {
      const attrs = match[1];
      const milestone = {
        form:attribute(attrs, 'x-content'), strong:attribute(attrs, 'x-strong'),
        morph:attribute(attrs, 'x-morph'), lemma:attribute(attrs, 'x-lemma'),
        occurrence:attribute(attrs, 'x-occurrence'), occurrences:attribute(attrs, 'x-occurrences')
      };
      milestones.push(milestone);
      active.push(milestone);
    } else if (match[2] !== undefined) {
      append(match[2]);
      tags.push({form:match[2], start:english.length - match[2].length, end:english.length,
        occurrence:attribute(match[3], 'x-occurrence'), occurrences:attribute(match[3], 'x-occurrences'), active:active.slice()});
    } else if (!active.pop()) {
      return fail('unbalanced alignment', true);
    }
  }
  append(body.slice(cursor));
  if (active.length) return fail('unbalanced alignment', true);
  if (english.includes('\\')) return fail('unsupported English markup');
  return {english, tags, milestones};
}

// Only code pairs whose shared grammatical features can be verified are supported.
function greekMorph(code) {
  // The CSV layout is two POS characters plus mood, tense, voice, person, case, gender, number and degree.
  const fields = code.startsWith('Gr,') ? code.slice(3).replace(/,/g, '') : '';
  const indeclinable = {'P':'PREP','PI':'PREP','CC':'CONJ','CS':'CONJ','D':'ADV','I':'INJ'};
  if (Object.hasOwn(indeclinable, fields)) return indeclinable[fields];
  if (/^P[I]?[GDA]$/.test(fields)) return 'PREP';
  const nominal = fields.match(/^(N|EA|AA|RD|RP|RI|RR|NS)([NGDAV])([MFN])([SPD])$/);
  if (nominal) {
    const pos = {N:'N',EA:'T',AA:'A',RD:'D',RP:'P',RI:'X',RR:'R',NS:'A'}[nominal[1]];
    return pos + '-' + nominal[2] + nominal[4] + nominal[3];
  }
  const finite = fields.match(/^V([ISOM])([PIAFEL])([AMP])([123])([SPD])$/);
  if (finite) return 'V-' + finite[2] + finite[3] + finite[1] + '-' + finite[4] + finite[5];
  const infinitive = fields.match(/^VN([PAFE])([AMP])$/);
  if (infinitive) return 'V-' + infinitive[1] + infinitive[2] + 'N';
  const participle = fields.match(/^VP([PAFE])([AMP])([NGDAV])([MFN])([SPD])$/);
  if (participle) return 'V-' + participle[1] + participle[2] + 'P-' + participle[3] + participle[5] + participle[4];
  return null;
}

function manuscriptMatches(source, record, language) {
  if (language === 'greek') {
    const strong = source.strong.match(/^G(\d{4})0$/);
    return strong && record.strongsNumber === 'G' + Number(strong[1]) &&
      greek(source.form) === greek(record.surface) &&
      greekMorph(source.morph) === record.morphology;
  }
  const prefix = {hebrew:'He,',aramaic:'Ar,'}[language];
  if (!prefix || !source.morph.startsWith(prefix)) return false;
  const strong = source.strong.match(/^(?:[a-z]:)*H(\d{4})[a-z]?$/);
  return strong && record.strongsNumber === 'H' + Number(strong[1]) &&
    hebrew(source.form) === hebrew(record.surface) &&
    prefix[0] + source.morph.slice(prefix.length).replace(/:/g, '/') === record.morphology;
}

function indexOccurrences(entries, keyFor) {
  const index = new Map();
  for (const [position, entry] of entries.entries()) {
    const key = keyFor(entry.form);
    if (!index.has(key)) index.set(key, []);
    index.get(key).push(position);
  }
  return index;
}

function occurrence(item, positions) {
  if (!positions || !/^[1-9]\d*$/.test(item.occurrence) || String(positions.length) !== item.occurrences) return undefined;
  return positions[Number(item.occurrence) - 1];
}

function validateVerse(verseText, body, original, records) {
  const parsed = readAlignment(body);
  if (parsed.reason) return parsed;
  if (typography(parsed.english) !== typography(verseText)) return fail('English wording or punctuation differs');
  if (!records.length || original.length !== records.length) return fail('original verse missing or token count differs');
  for (const [index, token] of original.entries()) {
    const record = records[index];
    if (record.status !== 'authoritative' || record.tokenIndex !== index ||
      !manuscriptMatches(token, record, record.language)) return fail('original position, spelling, identity or morphology differs');
  }

  // Milestone positions come from the independent ordered witness, not English order or Strong's IDs.
  const nativeOccurrences = indexOccurrences(original, plain);
  const positions = new Map();
  const used = new Set();
  for (const milestone of parsed.milestones) {
    const index = occurrence(milestone, nativeOccurrences.get(plain(milestone.form)));
    if (index === undefined || used.has(index)) return fail('ambiguous original occurrence', true);
    const token = original[index];
    if (!token.strong || !token.lemma || !token.morph || token.strong !== milestone.strong ||
      plain(token.lemma) !== plain(milestone.lemma) || token.morph !== milestone.morph) {
      return fail('explicit milestone identity or morphology differs');
    }
    positions.set(milestone, index);
    used.add(index);
  }
  const englishWords = words(parsed.english);
  const webWords = words(verseText);
  const englishOccurrences = indexOccurrences(parsed.tags, typography);
  const groups = new Map();
  const taggedWords = new Set();
  let cursor = 0;
  if (englishWords.length !== webWords.length || englishWords.some((word, index) =>
    typography(word[0]) !== typography(webWords[index][0]))) return fail('English selectable words differ');
  for (const [index, tag] of parsed.tags.entries()) {
    const declared = occurrence(tag, englishOccurrences.get(typography(tag.form)));
    if (declared !== index) return fail('ambiguous English occurrence', true);
    while (cursor < englishWords.length && englishWords[cursor].index < tag.start) cursor++;
    const start = cursor;
    while (cursor < englishWords.length && englishWords[cursor].index < tag.end) cursor++;
    const selected = englishWords.slice(start, cursor);
    if (!selected.length || selected[0].index !== tag.start ||
      selected.at(-1).index + selected.at(-1)[0].length !== tag.end ||
      (start && englishWords[start - 1].index + englishWords[start - 1][0].length > tag.start)) {
      return fail('English tag splits or lacks selectable words', true);
    }
    if (!tag.active.length) continue; // Supplied English remains explicitly unaligned.
    const indexes = tag.active.map(token => positions.get(token)).sort((left, right) => left - right);
    const key = indexes.join(',');
    if (!groups.has(key)) groups.set(key, [[], indexes]);
    for (let wordIndex = start; wordIndex < cursor; wordIndex++) {
      const word = webWords[wordIndex];
      groups.get(key)[0].push([word.index, word.index + word[0].length]);
      taggedWords.add(wordIndex);
    }
  }
  if (!groups.size) return fail('no verified English spans');
  return {alignments:[...groups.values()], taggedWords};
}

function provider() {
  const context = vm.createContext({BibleCanon:canon, async fetch(url) {
    const file = path.join(root, url);
    return {ok:fs.existsSync(file), json:async () => JSON.parse(fs.readFileSync(file,'utf8'))};
  }});
  vm.runInContext(fs.readFileSync(path.join(root,'js/word-study/original-language-provider.js'),'utf8'),context);
  return context.OriginalLanguageWordStudyProvider;
}

async function generate(inputDirectories, output) {
  if (fs.existsSync(output)) throw new Error('Output directory must be fresh');
  const [english, old, modern] = inputDirectories.map((input,index) => loadSource(input,sources[index]));
  const originalProvider = provider();
  const library = loadBibleLibrary('web.js','webLibrary');
  const report = {webTextSha256:sha(fs.readFileSync(path.join(root,'js/bible/web.js'),'utf8').replace(/\r\n/g,'\n')),
    sourceBooks:english.size, books:{}, reasons:{}, files:{}, priorityForms:[]};
  const priorityForms = new Set();
  const chapterIndex = {};
  fs.mkdirSync(output);
  for (const [bookIndex, bookId] of canon.order('web').entries()) {
    const code = books[bookIndex];
    const taggedBook = english.get(code);
    const witness = (bookIndex < 39 ? old : modern).get(code);
    const book = library[bookId];
    const totals = {verses:0, candidates:0, accepted:0, rejected:0, ambiguous:0, missing:0,
      words:0, alignedWords:0, priorityWords:0, alignedPriorityWords:0};
    report.books[bookId] = totals;
    for (let chapter = 1; chapter <= book.chapters; chapter++) {
      const rows = {};
      for (const [index, verseText] of book[chapter].verses.entries()) {
        if (!verseText.trim()) continue;
        const verse = index + 1;
        const reference = chapter + ':' + verse;
        const selectedWords = words(verseText);
        totals.verses++;
        totals.words += selectedWords.length;
        totals.priorityWords += selectedWords.filter(word => Object.hasOwn(priority, normalizeDictionaryTerm(word[0]))).length;
        if (!taggedBook?.has(reference) || !witness?.has(reference)) {
          totals.missing++;
          continue;
        }
        const tagged = taggedBook.get(reference);
        const original = witness.get(reference);
        totals.candidates++;
        let result = !tagged || !original ? fail('duplicate or empty source verse', true) : readAlignment(tagged);
        if (!result.reason && typography(result.english) !== typography(verseText)) result = fail('English wording or punctuation differs');
        let records;
        if (!result.reason) {
          const loaded = await originalProvider.lookupVerse({translationId:'web',bookId,chapter,verse});
          records = loaded.records;
          if (records.some(record => record.bookId !== bookId || record.chapter !== chapter || record.verse !== verse)) {
            result = fail('remapped original reference requires independent verification');
          } else {
            result = validateVerse(verseText, tagged, readOriginal(original), records);
          }
        }
        if (result.reason) {
          totals[result.ambiguous ? 'ambiguous' : 'rejected']++;
          report.reasons[result.reason] = (report.reasons[result.reason] || 0) + 1;
          continue;
        }
        totals.accepted++;
        rows[verse] = [verseText, records.map(record => [record.surface,record.strongsNumber,record.morphology,record.language]), result.alignments];
        for (const wordIndex of result.taggedWords) {
          totals.alignedWords++;
          const term = normalizeDictionaryTerm(selectedWords[wordIndex][0]);
          if (!Object.hasOwn(priority, term)) continue;
          totals.alignedPriorityWords++;
          priorityForms.add(term);
        }
      }
      if (!Object.keys(rows).length) continue;
      const relative = bookId + '/' + chapter + '.json';
      fs.mkdirSync(path.join(output,bookId),{recursive:true});
      const data = JSON.stringify(rows) + '\n';
      fs.writeFileSync(path.join(output,relative),data);
      report.files[relative] = {sha256:sha(data),bytes:Buffer.byteLength(data)};
      (chapterIndex[bookId] ||= []).push(chapter);
    }
  }
  report.priorityForms = [...priorityForms].sort();
  const index = JSON.stringify(chapterIndex) + '\n';
  fs.writeFileSync(path.join(output,'index.json'),index);
  report.files['index.json'] = {sha256:sha(index),bytes:Buffer.byteLength(index)};
  return report;
}

if (require.main === module) {
  const args = process.argv.slice(2);
  if (args.length !== 5) throw new Error('Usage: node tools/import-web-alignment.js <ULT dir> <UHB dir> <UGNT dir> <new output dir> <report.json>');
  generate(args.slice(0,3), args[3]).then(report => fs.writeFileSync(args[4],JSON.stringify(report,null,2) + '\n'))
    .catch(error => { console.error(error); process.exitCode = 1; });
}

module.exports = {readBook, readOriginal, validateVerse, generate};
