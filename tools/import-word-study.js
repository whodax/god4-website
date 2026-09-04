const fs = require('fs');
const path = require('path');
const PREFERRED_SHARD_BYTES = 500 * 1024;
const MAX_SHARD_BYTES = 1024 * 1024;

function normalizeWord(value) {
  return String(value || '').toLowerCase().replace(/[^a-z0-9']/g, '').replace(/^'+|'+$/g, '');
}

function stripGutenbergBoilerplate(source) {
  const start = source.indexOf('*** START OF THE PROJECT GUTENBERG EBOOK');
  const end = source.indexOf('*** END OF THE PROJECT GUTENBERG EBOOK');
  if (start < 0) return source.trim();
  const contentStart = source.indexOf('\n', start);
  if (contentStart < 0) return '';
  return source.slice(contentStart + 1, end > contentStart ? end : undefined).trim();
}

function normalizePartOfSpeech(value) {
  const labels = { 'n.': 'noun', 'v.': 'verb', 'v.t.': 'transitive verb', 'v.i.': 'intransitive verb', 'a.': 'adjective', 'adv.': 'adverb', 'pron.': 'pronoun', 'prep.': 'preposition', 'conj.': 'conjunction', 'interj.': 'interjection' };
  return labels[String(value || '').toLowerCase()] || '';
}

function parseWebster(source) {
  const lines = stripGutenbergBoilerplate(source).replace(/\r/g, '').split('\n');
  const entries = new Map();
  let current = null;
  let skippedEntries = 0;
  let mergedEntries = 0;

  function saveCurrent() {
    if (!current) return;
    const definitions = current.definitions.map((definition) => definition.replace(/\s+/g, ' ').trim()).filter(Boolean);
    if (!current.key || !definitions.length) {
      skippedEntries++;
      return;
    }
    const existing = entries.get(current.key);
    if (existing) {
      existing.definitions.push(...definitions.map((text) => ({ text, partOfSpeech: current.partOfSpeech })));
      mergedEntries++;
    } else {
      entries.set(current.key, { word: current.word, definitions: definitions.map((text) => ({ text, partOfSpeech: current.partOfSpeech })) });
    }
  }

  function startEntry(word, partOfSpeech, definition) {
    saveCurrent();
    current = { word, key: normalizeWord(word), partOfSpeech: normalizePartOfSpeech(partOfSpeech), definitions: definition ? [definition] : [], definitionIndex: definition ? 0 : -1, awaitingSourceLine: !definition };
  }

  function nextNonEmptyLine(index) {
    for (let next = index + 1; next < lines.length; next++) {
      if (lines[next].trim()) return lines[next].trim();
    }
    return '';
  }

  function looksLikeHeading(value, followingValue) {
    if (!/^[A-Za-z][A-Za-z0-9 .,';:&!?()/-]{0,80}$/.test(value)) return false;
    if (/^[A-Z][A-Z0-9 .,';:&!?()/-]{0,80}$/.test(value)) return true;
    return /(?:^|,\s*)(v\.t\.|v\.i\.|n\.|v\.|a\.|adv\.|pron\.|prep\.|conj\.|interj\.)/i.test(followingValue);
  }

  for (let index = 0; index < lines.length; index++) {
    const line = lines[index];
    const trimmed = line.trim();
    const inlineMatch = /^([A-Za-z][A-Za-z' -]{0,60})\s+\\[^\\]*\\,?\s*((?:v\.t\.|v\.i\.|n\.|v\.|a\.|adv\.|pron\.|prep\.|conj\.|interj\.))?\s*(.*)$/.exec(trimmed);
    const headingMatch = looksLikeHeading(trimmed, nextNonEmptyLine(index));
    if (inlineMatch) {
      startEntry(inlineMatch[1].trim(), inlineMatch[2], inlineMatch[3].replace(/^\d+\.\s*/, ''));
      continue;
    }
    if (headingMatch) {
      startEntry(trimmed, '', '');
      continue;
    }
    if (!current || !trimmed) continue;
    if (current.awaitingSourceLine) {
      const partOfSpeech = /(?:^|,\s*)(v\.t\.|v\.i\.|n\.|v\.|a\.|adv\.|pron\.|prep\.|conj\.|interj\.)/i.exec(trimmed);
      if (partOfSpeech) current.partOfSpeech = normalizePartOfSpeech(partOfSpeech[1]);
      current.awaitingSourceLine = false;
      continue;
    }
    const numbered = /^\d+\.\s+(.+)$/.exec(trimmed);
    const definition = /^Defn:\s*(.+)$/i.exec(trimmed);
    if (numbered || definition) {
      current.definitions.push((numbered || definition)[1]);
      current.definitionIndex = current.definitions.length - 1;
    } else if (current.definitionIndex >= 0 && !/^(?:Syn\.|Note:|Etym:|\[Obs\.\]|--)/.test(trimmed)) {
      current.definitions[current.definitionIndex] += ' ' + trimmed;
    }
  }
  saveCurrent();
  Object.defineProperty(entries, 'stats', { value: { skippedEntries, mergedEntries } });
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

function createShard() {
  return { version: 'v1', entries: {} };
}

function shardSize(data) {
  return Buffer.byteLength(`${JSON.stringify(data, null, 2)}\n`);
}

function splitShard(data, parent, prefixLength) {
  const shards = new Map();
  Object.keys(data.entries).sort().forEach((key) => {
    const shard = key.length >= prefixLength ? key.slice(0, prefixLength) : parent;
    if (!shards.has(shard)) shards.set(shard, createShard());
    shards.get(shard).entries[key] = data.entries[key];
  });
  return shards;
}

function buildShards(webster, moby, preferredShardBytes = PREFERRED_SHARD_BYTES, maxShardBytes = MAX_SHARD_BYTES) {
  const parentShards = new Map();
  const keys = new Set([...webster.keys(), ...moby.keys()]);
  keys.forEach((key) => {
    const entry = webster.get(key);
    if (!entry) return;
    const shard = key.slice(0, 2);
    if (!shard) return;
    if (!parentShards.has(shard)) parentShards.set(shard, createShard());
    parentShards.get(shard).entries[key] = { word: entry.word, definitions: entry.definitions, relatedWords: moby.get(key) || [] };
  });
  const shards = new Map();
  [...parentShards.keys()].sort().forEach((parent) => {
    const parentShard = parentShards.get(parent);
    if (shardSize(parentShard) <= preferredShardBytes) {
      shards.set(parent, parentShard);
      return;
    }
    splitShard(parentShard, parent, 3).forEach((childShard, child) => {
      if (child.length === 3 && shardSize(childShard) > maxShardBytes) {
        splitShard(childShard, child, 4).forEach((grandchildShard, grandchild) => shards.set(grandchild, grandchildShard));
      } else {
        shards.set(child, childShard);
      }
    });
  });
  return shards;
}

function importWordStudy(websterFile, mobyFile, outputDirectory) {
  const webster = parseWebster(fs.readFileSync(websterFile, 'utf8'));
  const moby = parseMoby(fs.readFileSync(mobyFile, 'utf8'));
  const shards = buildShards(webster, moby);
  fs.mkdirSync(outputDirectory, { recursive: true });
  shards.forEach((data, shard) => fs.writeFileSync(path.join(outputDirectory, `${shard}.json`), `${JSON.stringify(data, null, 2)}\n`));
  const oversizedShards = [...shards.entries()].filter(([, data]) => shardSize(data) > MAX_SHARD_BYTES).map(([shard]) => shard);
  return { websterEntries: webster.size, mobyEntries: moby.size, shards: [...shards.keys()].sort(), oversizedShards, websterStats: webster.stats };
}

if (require.main === module) {
  const [websterFile, mobyFile, outputDirectory = 'data/word-study'] = process.argv.slice(2);
  if (!websterFile || !mobyFile) throw new Error('Usage: node tools/import-word-study.js <webster-file> <moby-file> [output-directory]');
  const result = importWordStudy(path.resolve(websterFile), path.resolve(mobyFile), path.resolve(outputDirectory));
  console.log(`Imported ${result.websterEntries} Webster entries and ${result.mobyEntries} Moby records into ${result.shards.length} shard(s).`);
  console.log(`Webster merged ${result.websterStats.mergedEntries} repeated entries and skipped ${result.websterStats.skippedEntries} entries without definitions.`);
  if (result.oversizedShards.length) console.log(`Shard(s) still over 1 MB: ${result.oversizedShards.join(', ')}.`);
}

module.exports = { PREFERRED_SHARD_BYTES, MAX_SHARD_BYTES, normalizeWord, stripGutenbergBoilerplate, parseWebster, parseMoby, buildShards, importWordStudy };