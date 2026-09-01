const fs = require('fs');
const path = require('path');

function normalizeWord(value) {
  return String(value || '').toLowerCase().replace(/[^a-z0-9']/g, '').replace(/^'+|'+$/g, '');
}

function stripGutenbergBoilerplate(source) {
  const start = source.indexOf('*** START OF THE PROJECT GUTENBERG EBOOK');
  const end = source.indexOf('*** END OF THE PROJECT GUTENBERG EBOOK');
  if (start < 0 || end < 0 || end <= start) return source.trim();
  return source.slice(source.indexOf('\n', start) + 1, end).trim();
}

function normalizePartOfSpeech(value) {
  const labels = { 'n.': 'noun', 'v.': 'verb', 'v.t.': 'transitive verb', 'v.i.': 'intransitive verb', 'a.': 'adjective', 'adv.': 'adverb', 'pron.': 'pronoun', 'prep.': 'preposition', 'conj.': 'conjunction', 'interj.': 'interjection' };
  return labels[String(value || '').toLowerCase()] || '';
}

function parseWebster(source) {
  const lines = stripGutenbergBoilerplate(source).replace(/\r/g, '').split('\n');
  const entries = new Map();
  let current = null;
  function saveCurrent() {
    if (!current) return;
    const text = current.lines.join(' ').replace(/\s+/g, ' ').trim();
    const definitions = text.replace(/^\d+\.\s*/, '').split(/\s+(?=\d+\.\s)/).map((definition) => definition.trim()).filter(Boolean);
    if (current.key && definitions.length) entries.set(current.key, { word: current.word, definitions: definitions.map((text) => ({ text, partOfSpeech: current.partOfSpeech })) });
  }
  for (const line of lines) {
    const match = /^([A-Za-z][A-Za-z' -]{0,60})\s+\\[^\\]*\\,?\s*((?:v\.t\.|v\.i\.|n\.|v\.|a\.|adv\.|pron\.|prep\.|conj\.|interj\.))?\s*(.*)$/.exec(line.trim());
    if (match) {
      saveCurrent();
      current = { word: match[1].trim(), key: normalizeWord(match[1]), partOfSpeech: normalizePartOfSpeech(match[2]), lines: [match[3]] };
    } else if (current && line.trim()) {
      current.lines.push(line.trim());
    }
  }
  saveCurrent();
  return entries;
}

function parseMoby(source) {
  const entries = new Map();
  stripGutenbergBoilerplate(source).replace(/\r/g, '').split('\n').forEach((line) => {
    const words = line.split(',').map((word) => word.trim()).filter(Boolean);
    const key = normalizeWord(words[0]);
    if (key && words.length > 1) entries.set(key, [...new Set(words.slice(1))]);
  });
  return entries;
}

function buildShards(webster, moby) {
  const shards = new Map();
  const keys = new Set([...webster.keys(), ...moby.keys()]);
  keys.forEach((key) => {
    const entry = webster.get(key);
    if (!entry) return;
    const shard = key.slice(0, 2);
    if (!shard) return;
    if (!shards.has(shard)) shards.set(shard, { version: 'v1', entries: {} });
    shards.get(shard).entries[key] = { word: entry.word, definitions: entry.definitions, relatedWords: moby.get(key) || [] };
  });
  return shards;
}

function importWordStudy(websterFile, mobyFile, outputDirectory) {
  const webster = parseWebster(fs.readFileSync(websterFile, 'utf8'));
  const moby = parseMoby(fs.readFileSync(mobyFile, 'utf8'));
  const shards = buildShards(webster, moby);
  fs.mkdirSync(outputDirectory, { recursive: true });
  shards.forEach((data, shard) => fs.writeFileSync(path.join(outputDirectory, `${shard}.json`), `${JSON.stringify(data, null, 2)}\n`));
  return { websterEntries: webster.size, mobyEntries: moby.size, shards: [...shards.keys()].sort() };
}

if (require.main === module) {
  const [websterFile, mobyFile, outputDirectory = 'data/word-study'] = process.argv.slice(2);
  if (!websterFile || !mobyFile) throw new Error('Usage: node tools/import-word-study.js <webster-file> <moby-file> [output-directory]');
  const result = importWordStudy(path.resolve(websterFile), path.resolve(mobyFile), path.resolve(outputDirectory));
  console.log(`Imported ${result.websterEntries} Webster entries and ${result.mobyEntries} Moby records into ${result.shards.length} shard(s).`);
}

module.exports = { normalizeWord, stripGutenbergBoilerplate, parseWebster, parseMoby, buildShards, importWordStudy };