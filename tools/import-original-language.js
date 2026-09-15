'use strict';

const fs = require('fs');
const path = require('path');

const SCHEMA_FIELDS = [
  'status', 'strongsNumber', 'language', 'lemma', 'transliteration',
  'pronunciation', 'partOfSpeech', 'definition', 'morphology', 'source',
  'bookId', 'chapter', 'verse', 'tokenIndex', 'surface'
];
const REQUIRED_TEXT_FIELDS = [
  'status', 'strongsNumber', 'language', 'lemma', 'transliteration',
  'pronunciation', 'partOfSpeech', 'definition', 'morphology', 'source',
  'bookId', 'surface'
];

function invalid(index, message) {
  throw new TypeError(`Invalid original-language record ${index}: ${message}`);
}

function normalizeRecord(record, index = 0) {
  if (!record || typeof record !== 'object' || Array.isArray(record)) invalid(index, 'expected an object');
  REQUIRED_TEXT_FIELDS.forEach((field) => {
    if (typeof record[field] !== 'string' || !record[field].trim()) invalid(index, `${field} must be a non-empty string`);
  });
  ['chapter', 'verse', 'tokenIndex'].forEach((field) => {
    if (!Number.isInteger(record[field]) || record[field] < 1 && field !== 'tokenIndex' || record[field] < 0 && field === 'tokenIndex') {
      invalid(index, `${field} must be a non-negative integer${field === 'tokenIndex' ? '' : ' greater than zero'}`);
    }
  });
  return SCHEMA_FIELDS.reduce((normalized, field) => {
    normalized[field] = field === 'bookId' ? record[field].trim().toLowerCase() : record[field];
    return normalized;
  }, {});
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
  const source = JSON.parse(fs.readFileSync(path.resolve(sourceFile), 'utf8'));
  const result = importOriginalLanguage(source, path.resolve(outputDirectory));
  console.log(`Imported ${result.records} original-language fixture record(s) into ${result.shards.length} shard(s).`);
}

module.exports = { SCHEMA_FIELDS, normalizeRecord, normalizeRecords, writeStaticData, importOriginalLanguage };
