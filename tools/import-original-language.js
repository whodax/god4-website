'use strict';

const fs = require('fs');
const path = require('path');
const XML_ENTITIES = { amp: '&', apos: "'", gt: '>', lt: '<', quot: '"' };

const SCHEMA_FIELDS = [
  'status', 'strongsNumber', 'language', 'lemma', 'transliteration',
  'pronunciation', 'partOfSpeech', 'definition', 'morphology', 'source',
  'bookId', 'chapter', 'verse', 'tokenIndex', 'surface'
];
const REQUIRED_TEXT_FIELDS = [
  'status', 'language', 'morphology', 'source',
  'bookId', 'surface'
];
const SUPPORTED_LANGUAGES = new Set(['hebrew', 'greek']);

function invalid(index, message) {
  throw new TypeError(`Invalid original-language record ${index}: ${message}`);
}

function decodeXml(value) {
  return value.replace(/&(#x[0-9a-f]+|#\d+|[a-z]+);/gi, (match, entity) => {
    if (entity.toLowerCase().startsWith('#x')) return String.fromCodePoint(parseInt(entity.slice(2), 16));
    if (entity.startsWith('#')) return String.fromCodePoint(parseInt(entity.slice(1), 10));
    return XML_ENTITIES[entity] || match;
  });
}

function nullableText(value) {
  return value == null || value === '' ? null : String(value);
}

function normalizeRecord(record, index = 0) {
  if (!record || typeof record !== 'object' || Array.isArray(record)) invalid(index, 'expected an object');
  REQUIRED_TEXT_FIELDS.forEach((field) => {
    if (typeof record[field] !== 'string' || !record[field].trim()) invalid(index, `${field} must be a non-empty string`);
  });
  const isFixture = record.status === 'fixture';
  if (!SUPPORTED_LANGUAGES.has(record.language) && !isFixture) invalid(index, `unsupported language ${record.language}`);
  if (record.strongsNumber !== null && !/^[HG]\d{1,5}$/.test(record.strongsNumber) && !(isFixture && /^fixture-/.test(record.strongsNumber))) invalid(index, 'strongsNumber must match H#### or G####');
  if (typeof record.morphology !== 'string' || !record.morphology.trim()) invalid(index, 'morphology must be a non-empty string');
  ['lemma', 'definition', 'transliteration', 'pronunciation', 'partOfSpeech'].forEach((field) => {
    if (record[field] !== null && typeof record[field] !== 'string') invalid(index, `${field} must be a string or null`);
  });
  if (!isFixture && !record.source.includes('source') && !record.source.includes('Open Scriptures') && !record.source.includes('Robinson-Pierpont')) invalid(index, 'source attribution is missing');
  ['chapter', 'verse', 'tokenIndex'].forEach((field) => {
    if (!Number.isInteger(record[field]) || record[field] < 1 && field !== 'tokenIndex' || record[field] < 0 && field === 'tokenIndex') {
      invalid(index, `${field} must be a non-negative integer${field === 'tokenIndex' ? '' : ' greater than zero'}`);
    }
  });
  return SCHEMA_FIELDS.reduce((normalized, field) => {
    normalized[field] = field === 'bookId' ? record[field].trim().toLowerCase() : field === 'transliteration' || field === 'pronunciation' || field === 'partOfSpeech' ? nullableText(record[field]) : record[field];
    return normalized;
  }, {});
}

function strongsId(language, value) {
  const match = String(value || '').match(/[0-9]+/g);
  if (!match) return null;
  return `${language === 'hebrew' ? 'H' : 'G'}${match[match.length - 1]}`;
}

function parseStrongDat(text, language) {
  const entries = new Map();
  const pattern = /\\(\d{5})\\([\s\S]*?)(?=\$\$T|$)/g;
  let match;
  while ((match = pattern.exec(text))) {
    const id = `${language === 'hebrew' ? 'H' : 'G'}${Number(match[1])}`;
    const body = match[2].replace(/\s+/g, ' ').trim();
    entries.set(id, body);
  }
  return entries;
}

function parseStrongGreekXml(text) {
  const entries = new Map();
  const entryPattern = /<entry\s+strongs="(\d+)"[^>]*>([\s\S]*?)<\/entry>/g;
  let match;
  while ((match = entryPattern.exec(text))) {
    const body = match[2];
    const definitions = [...body.matchAll(/<strongs_def[^>]*>([\s\S]*?)<\/strongs_def>/g)];
    const fallbackDefinitions = [...body.matchAll(/<kjv_def[^>]*>([\s\S]*?)<\/kjv_def>/g)];
    const definition = (definitions.length ? definitions : fallbackDefinitions).map((item) => decodeXml(item[1].replace(/<[^>]+>/g, ' '))).join(' ').replace(/\s+/g, ' ').trim();
    const greek = body.match(/<greek\s+[^>]*unicode="([^"]+)"[^>]*translit="([^"]*)"/);
    entries.set(`G${Number(match[1])}`, { definition: definition || null, lemma: greek ? decodeXml(greek[1]) : null, transliteration: greek ? decodeXml(greek[2]) : null });
  }
  return entries;
}

function selectedChapters(value, defaultChapters = [1]) {
  const values = value == null ? defaultChapters : Array.isArray(value) ? value : String(value).split(',');
  const chapters = values.map((chapter) => Number(chapter)).filter((chapter) => Number.isInteger(chapter) && chapter > 0);
  if (!chapters.length) throw new TypeError('Chapter selection must contain at least one positive integer');
  return new Set(chapters);
}

function parseOshbGenesis(text, hebrewLexicon, chapters = [1]) {
  const records = [];
  const chapterSelection = selectedChapters(chapters);
  const versePattern = /<verse\s+osisID="Gen\.(\d+)\.(\d+)"[^>]*>([\s\S]*?)<\/verse>/g;
  let verseMatch;
  while ((verseMatch = versePattern.exec(text))) {
    const chapter = Number(verseMatch[1]);
    if (!chapterSelection.has(chapter)) continue;
    const words = [...verseMatch[3].matchAll(/<w\s+([^>]+)>([\s\S]*?)<\/w>/g)];
    words.forEach((word, tokenIndex) => {
      const attributes = Object.fromEntries([...word[1].matchAll(/([\w:-]+)="([^"]*)"/g)].map((item) => [item[1], decodeXml(item[2])]));
      const lemmaMatch = word[1].match(/(?:^|\s)lemma="([^"]+)"/);
      if (lemmaMatch) attributes.lemma = decodeXml(lemmaMatch[1]);
      const strongsNumber = strongsId('hebrew', attributes.lemma);
      const lexical = hebrewLexicon.get(strongsNumber);
      records.push({ status: 'authoritative', strongsNumber, language: 'hebrew', lemma: attributes.lemma, transliteration: null, pronunciation: null, partOfSpeech: null, definition: lexical || null, morphology: attributes.morph, source: 'Open Scriptures Hebrew Bible (OSHB) CC BY 4.0; Westminster Leningrad Codex public domain; Strong\'s 1890 dictionary public domain; corrected edition by Weston Ruter MIT License', bookId: 'genesis', chapter, verse: Number(verseMatch[2]), tokenIndex, surface: decodeXml(word[2]) });
    });
  }
  return records;
}

function parseByzantineJohn(text, greekLexicon, chapters = [1]) {
  const records = [];
  const chapterSelection = selectedChapters(chapters);
  text.split(/\r?\n/).forEach((line) => {
    const match = line.match(/^\s*(\d+),(\d+),(.*)$/);
    const chapter = Number(match && match[1]);
    if (!match || !chapterSelection.has(chapter)) return;
    const tokens = [...match[3].matchAll(/([^\s]+)\s+(\d+)\s+\{([^}]+)\}/g)];
    tokens.forEach((token, tokenIndex) => {
      const strongsNumber = `G${Number(token[2])}`;
      const lexical = greekLexicon.get(strongsNumber) || {};
      records.push({ status: 'authoritative', strongsNumber, language: 'greek', lemma: lexical.lemma, transliteration: lexical.transliteration, pronunciation: null, partOfSpeech: null, definition: lexical.definition, morphology: token[3], source: 'Robinson-Pierpont Byzantine Majority Text public domain; Strong\'s 1890 dictionary public domain; corrected edition by Weston Ruter MIT License', bookId: 'john', chapter, verse: Number(match[2]), tokenIndex, surface: token[1] });
    });
  });
  return records;
}

function importAuthoritativeSources(genesisFile, johnFile, hebrewFile, greekFile, outputDirectory, options = {}) {
  const hebrewLexicon = parseStrongDat(fs.readFileSync(hebrewFile, 'utf8'), 'hebrew');
  const greekLexicon = parseStrongGreekXml(fs.readFileSync(greekFile, 'utf8'));
  const records = normalizeRecords(parseOshbGenesis(fs.readFileSync(genesisFile, 'utf8'), hebrewLexicon, options.genesisChapters).concat(parseByzantineJohn(fs.readFileSync(johnFile, 'utf8'), greekLexicon, options.johnChapters)));
  return writeStaticData(records, outputDirectory);
}

function normalizeRecords(sourceRecords) {
  const records = Array.isArray(sourceRecords) ? sourceRecords : sourceRecords && sourceRecords.records;
  if (!Array.isArray(records)) throw new TypeError('Original-language source must be an array or an object with a records array');
  const locations = new Set();
  return records.map((record, index) => {
    const normalized = normalizeRecord(record, index);
    const location = [normalized.bookId, normalized.chapter, normalized.verse, normalized.tokenIndex].join(':');
    if (locations.has(location)) invalid(index, `duplicate location ${location}`);
    locations.add(location);
    return normalized;
  });
}

function shardName(record) {
  return path.join(record.bookId, `${record.chapter}.json`);
}

function writeStaticData(records, outputDirectory) {
  const shards = new Map();
  records.forEach((record) => {
    const name = shardName(record);
    if (!shards.has(name)) shards.set(name, []);
    shards.get(name).push(record);
  });
  shards.forEach((shardRecords, name) => {
    const file = path.join(outputDirectory, name);
    fs.mkdirSync(path.dirname(file), { recursive: true });
    fs.writeFileSync(file, `${JSON.stringify({ records: shardRecords }, null, 2)}\n`, 'utf8');
  });
  return { records: records.length, shards: [...shards.keys()].sort() };
}

function importOriginalLanguage(sourceRecords, outputDirectory) {
  const records = normalizeRecords(sourceRecords);
  fs.mkdirSync(outputDirectory, { recursive: true });
  return writeStaticData(records, outputDirectory);
}

if (require.main === module) {
  const [sourceFile, outputDirectory = 'data/word-study/original-language'] = process.argv.slice(2);
  if (!sourceFile) throw new Error('Usage: node tools/import-original-language.js <source-json> [output-directory]');
  if (sourceFile === '--authoritative') {
    const authoritativeArguments = process.argv.slice(3);
    const options = {};
    const positionalArguments = [];
    for (let index = 0; index < authoritativeArguments.length; index += 1) {
      const argument = authoritativeArguments[index];
      const option = argument.match(/^--(genesis-chapters|john-chapters)(?:=(.*))?$/);
      if (option) {
        options[option[1].replace('-', '')] = option[2] || authoritativeArguments[++index];
      } else {
        positionalArguments.push(argument);
      }
    }
    options.genesisChapters = options.genesischapters;
    options.johnChapters = options.johnchapters;
    const [genesisFile, johnFile, hebrewFile, greekFile, authoritativeOutput = 'data/word-study/original-language'] = positionalArguments;
    const result = importAuthoritativeSources(genesisFile, johnFile, hebrewFile, greekFile, path.resolve(authoritativeOutput), options);
    console.log(`Imported ${result.records} authoritative original-language record(s) into ${result.shards.length} shard(s).`);
  } else {
    const source = JSON.parse(fs.readFileSync(path.resolve(sourceFile), 'utf8'));
    const result = importOriginalLanguage(source, path.resolve(outputDirectory));
    console.log(`Imported ${result.records} original-language fixture record(s) into ${result.shards.length} shard(s).`);
  }
}

module.exports = { SCHEMA_FIELDS, normalizeRecord, normalizeRecords, writeStaticData, importOriginalLanguage, parseStrongDat, parseStrongGreekXml, parseOshbGenesis, parseByzantineJohn, importAuthoritativeSources, selectedChapters };
