'use strict';

const fs = require('fs');
const path = require('path');
const crypto = require('node:crypto');
const {SOURCES, readerBook, validateBookConfig, mapReference, sourceTargets, assertPublicationEligible, existingBookConfig} = require('./original-language-config');
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
const SUPPORTED_LANGUAGES = new Set(['hebrew', 'aramaic', 'greek']);

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
  if(!['fixture','authoritative'].includes(record.status)) invalid(index, 'unsupported record status');
  if (!SUPPORTED_LANGUAGES.has(record.language) && !isFixture) invalid(index, `unsupported language ${record.language}`);
  if (record.strongsNumber !== null && !/^[HG]\d{1,5}$/.test(record.strongsNumber) && !(isFixture && /^fixture-/.test(record.strongsNumber))) invalid(index, 'strongsNumber must match H#### or G####');
  if(!isFixture && record.strongsNumber && !record.strongsNumber.startsWith(record.language === 'greek' ? 'G' : 'H')) invalid(index, 'Strong\'s identifier language mismatch');
  if(!/^[a-z0-9]+(?:-[a-z0-9]+)*$/i.test(record.bookId.trim())) invalid(index, 'invalid bookId');
  if (typeof record.morphology !== 'string' || !record.morphology.trim()) invalid(index, 'morphology must be a non-empty string');
  ['lemma', 'definition', 'transliteration', 'pronunciation', 'partOfSpeech'].forEach((field) => {
    if (record[field] !== null && typeof record[field] !== 'string') invalid(index, `${field} must be a string or null`);
  });
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
  const chapters = values.map((chapter) => Number(chapter));
  if(chapters.some(chapter => !Number.isInteger(chapter) || chapter < 1)) throw new TypeError('Invalid chapter selection');
  if (!chapters.length) throw new TypeError('Chapter selection must contain at least one positive integer');
  return new Set(chapters);
}

function oshbWords(text){
  return [...text.matchAll(/<w\s+([^>]+)>([\s\S]*?)<\/w>/g)].map(word => {
    const attributes = Object.fromEntries([...word[1].matchAll(/([\w:-]+)="([^"]*)"/g)].map(item => [item[1],decodeXml(item[2])]));
    return {attributes,surface:decodeXml(word[2])};
  });
}

function runningOshbText(text, diagnostics, reference){
  // The supported OSHB format has inline note/rdg apparatus. Scan its nesting
  // before extracting words; a non-greedy note regex could leak nested readings.
  text = text.replace(/<!--[\s\S]*?-->/g,'');
  const stack = [], chunks = [];
  let cursor = 0, start = 0;
  for(const match of text.matchAll(/<[^>]*>/g)){
    const tag = match[0].match(/^<\s*(\/?)\s*(note|app|rdg)\b/i);
    if(!tag) continue;
    const name = tag[2].toLowerCase(), closing = Boolean(tag[1]), selfClosing = /\/\s*>$/.test(match[0]);
    if(!closing){
      if(!stack.length){start=match.index;chunks.push(text.slice(cursor,start));}
      if(!selfClosing) stack.push(name);
    }else if(stack.pop() !== name) throw new TypeError('Malformed OSHB apparatus nesting');
    if(!stack.length){
      cursor = match.index + match[0].length;
      const xml = text.slice(start,cursor), words = oshbWords(xml);
      if(words.length){
        diagnostics.excludedVariantNotes++;
        diagnostics.excludedVariantWords += words.length;
        diagnostics.excludedApparatus.push({...reference,kind:name,xml,words:words.map(w => ({id:w.attributes.id || null,surface:w.surface,lemma:w.attributes.lemma || null,morphology:w.attributes.morph || null}))});
      }
    }
  }
  if(stack.length) throw new TypeError('Unclosed OSHB apparatus');
  return chunks.join('') + text.slice(cursor);
}

function parseOshb(text, hebrewLexicon, config, chapters, diagnostics) {
  const records = [];
  const chapterSelection = selectedChapters(chapters);
  const versePattern = /<verse\s+osisID="([A-Za-z0-9-]+)\.(\d+)\.(\d+)"[^>]*>([\s\S]*?)<\/verse>/g;
  let verseMatch;
  while ((verseMatch = versePattern.exec(text))) {
    if(verseMatch[1] !== config.sourceBookId) continue;
    const chapter = Number(verseMatch[2]);
    if(config.sourceVerseCounts) sourceTargets(config, chapter, Number(verseMatch[3]));
    if (!chapterSelection.has(chapter)) continue;
    const body = diagnostics ? runningOshbText(verseMatch[4],diagnostics,{sourceBookId:config.sourceBookId,chapter,verse:Number(verseMatch[3])}) : verseMatch[4];
    const words = oshbWords(body);
    words.forEach((word, tokenIndex) => {
      const attributes = word.attributes;
      const strongsNumber = strongsId('hebrew', attributes.lemma);
      const lexical = hebrewLexicon.get(strongsNumber);
      records.push({ status: 'authoritative', strongsNumber, language: 'hebrew', lemma: attributes.lemma, transliteration: null, pronunciation: null, partOfSpeech: null, definition: lexical || null, morphology: attributes.morph, source: config.source.attribution, bookId: config.bookId, chapter, verse: Number(verseMatch[3]), tokenIndex, surface: word.surface });
    });
  }
  return records;
}

function parseByzantineTokens(text){
  // One nonnumeric surface followed by one or more complete analysis pairs.
  // Match the entire running text; detached numbers/tags must never become words.
  const pattern = /([^\s{}\d,]+)\s+(\d{1,5})\s+\{([A-Z][A-Z0-9]*(?:-[A-Z0-9]+)*)\}((?:\s+\d{1,5}\s+\{[A-Z][A-Z0-9]*(?:-[A-Z0-9]+)*\})*)/g;
  const matches = [...text.matchAll(pattern)];
  if(text.replace(pattern,'').trim()) throw new TypeError('Malformed Byzantine verse tokens');
  for(let i=1;i<matches.length;i++) if(matches[i].index === matches[i-1].index + matches[i-1][0].length) throw new TypeError('Missing Byzantine token separator');
  return matches.map(match => {
    const primary = {strongsNumber:'G'+Number(match[2]),morphology:match[3]};
    const analyses = [primary,...[...match[4].matchAll(/(\d{1,5})\s+\{([A-Z][A-Z0-9]*(?:-[A-Z0-9]+)*)\}/g)].map(a => ({strongsNumber:'G'+Number(a[1]),morphology:a[2]}))];
    const keys = analyses.map(a => a.strongsNumber+':'+a.morphology);
    if(new Set(keys).size !== keys.length) throw new TypeError('Duplicate Byzantine analysis');
    return {surface:match[1],analyses};
  });
}

function parseByzantine(text, greekLexicon, config, chapters, diagnostics) {
  const records = [];
  const chapterSelection = selectedChapters(chapters);
  text.split(/\r?\n/).forEach((line) => {
    const match = line.match(/^\s*(\d+),(\d+),(.*)$/);
    const chapter = Number(match && match[1]);
    if(match && config.sourceVerseCounts) mapReference(config, chapter, Number(match[2]));
    if (!match || !chapterSelection.has(chapter)) return;
    const tokens = parseByzantineTokens(match[3]);
    tokens.forEach((token, tokenIndex) => {
      if(token.analyses.length > 1){
        if(config.alternateAnalysisPolicy !== 'first-source-analysis' || !diagnostics) throw new TypeError('Alternate analyses require explicit policy and detailed diagnostics');
        for(const analysis of token.analyses) if(!greekLexicon.has(analysis.strongsNumber)) throw new TypeError('Missing alternate-analysis lexical join');
        diagnostics.alternateAnalyses.push({sourceBookId:config.sourceBookId,chapter,verse:Number(match[2]),tokenIndex,surface:token.surface,primary:token.analyses[0],alternates:token.analyses.slice(1)});
      }
      const strongsNumber = token.analyses[0].strongsNumber;
      const lexical = greekLexicon.get(strongsNumber) || {};
      records.push({ status: 'authoritative', strongsNumber, language: 'greek', lemma: lexical.lemma || null, transliteration: lexical.transliteration || null, pronunciation: null, partOfSpeech: null, definition: lexical.definition || null, morphology: token.analyses[0].morphology, source: config.source.attribution, bookId: config.bookId, chapter, verse: Number(match[2]), tokenIndex, surface: token.surface });
    });
  });
  return records;
}

// Historical extraction helpers preserve source coordinates and record metadata.
// They do not constitute a validated deployment pipeline.
function parseOshbGenesis(text, lexicon, chapters = [1]){
  return parseOshb(text, lexicon, {bookId:'genesis', sourceBookId:'Gen', source:SOURCES.oshb}, chapters);
}
function parseByzantineJohn(text, lexicon, chapters = [1]){
  const diagnostics = {serializationPolicy:'first-source-analysis',alternateAnalyses:[]};
  const records = parseByzantine(text, lexicon, {bookId:'john', sourceBookId:'John', source:SOURCES.byzantine,alternateAnalysisPolicy:'first-source-analysis'}, chapters, diagnostics);
  if(diagnostics.alternateAnalyses.length){
    Object.defineProperty(records,'importDiagnostics',{value:diagnostics});
    process.emitWarning('Historical Greek extraction has alternate analyses; review records.importDiagnostics. Use detailed APIs for configured generation.');
  }
  return records;
}

function mapSourceRecords(records, config, options = {}){
  validateBookConfig(config);
  if(!config.referenceMapping.verified) throw new TypeError('Reference mapping is unknown/unverified; review source/Reader evidence before importing');
  const chapters = selectedChapters(options.chapters, Array.from({length:config.chapterCount}, (_, i) => i + 1));
  if([...chapters].some(ch => ch > config.chapterCount)) throw new TypeError('Chapter selection exceeds configured book');
  const expected = new Set();
  records = normalizeRecords(records);
  for(const r of records){
    if(r.bookId !== config.bookId) throw new TypeError('Source record book mismatch');
    mapReference(config, r.chapter, r.verse, r.tokenIndex);
  }
  for(const [key,split] of Object.entries(config.referenceMapping.tokenSplits || {})){
    const [chapter,verse] = key.split(':').map(Number);
    if(chapters.has(chapter) && records.filter(r => r.chapter === chapter && r.verse === verse).length !== split.tokenCount) throw new TypeError('Split source token count mismatch: ' + key);
  }
  for(const ch of chapters) for(let verse = 1; verse <= config.sourceVerseCounts[ch - 1]; verse++){
    for(const r of sourceTargets(config,ch,verse)) expected.add(r.chapter + ':' + r.verse);
  }
  const mapped = records.filter(r => chapters.has(r.chapter)).map(r => {
    if(r.bookId !== config.bookId || r.status !== 'authoritative') throw new TypeError('Source record book/status mismatch');
    const target = mapReference(config, r.chapter, r.verse, r.tokenIndex);
    const split = config.referenceMapping.tokenSplits?.[r.chapter + ':' + r.verse];
    const segment = split?.segments.find(s => r.tokenIndex >= s.start && r.tokenIndex <= s.end);
    let language = config.language;
    if(config.parserStrategy === 'oshb'){
      if(typeof r.morphology !== 'string' || !/^[HA]/.test(r.morphology)) throw new TypeError('Invalid OSHB morphology language');
      language = r.morphology[0] === 'A' ? 'aramaic' : 'hebrew';
    }else if(r.language !== 'greek') throw new TypeError('Greek source record language mismatch');
    return Object.assign({}, r, target, {tokenIndex:segment ? r.tokenIndex - segment.start : r.tokenIndex,language, source:config.source.attribution});
  });
  const normalized = normalizeRecords(mapped), present = new Set(normalized.map(r => r.chapter + ':' + r.verse));
  const missing = [...expected].filter(key => !present.has(key));
  if(missing.length) throw new TypeError('Missing Reader coverage: ' + missing.join(', '));
  return normalized.sort((a, b) => a.chapter - b.chapter || a.verse - b.verse || a.tokenIndex - b.tokenIndex);
}

function parseConfiguredSourceDetailed(text, lexicon, config, options = {}){
  validateBookConfig(config);
  const chapters = options.chapters == null ? Array.from({length:config.chapterCount}, (_, i) => i + 1) : options.chapters;
  const parser = config.parserStrategy === 'oshb' ? parseOshb : parseByzantine;
  const diagnostics = {serializationPolicy:config.alternateAnalysisPolicy || null,alternateAnalyses:[],
    oshbWordPolicy:config.parserStrategy === 'oshb' ? 'main-text-only' : null,
    excludedVariantNotes:0,excludedVariantWords:0,excludedApparatus:[]};
  const sourceRecords = parser(text, lexicon, config, chapters, diagnostics);
  const records = mapSourceRecords(sourceRecords, config, {chapters});
  diagnostics.mapping = {sourceVerses:new Set(sourceRecords.map(r=>r.chapter+':'+r.verse)).size,sourceTokens:sourceRecords.length,
    readerVerses:new Set(records.map(r=>r.chapter+':'+r.verse)).size,
    splitSourceVerses:Object.keys(config.referenceMapping.tokenSplits || {}).filter(key => selectedChapters(chapters).has(Number(key.split(':')[0])))};
  return {records,diagnostics};
}

function parseConfiguredSource(text, lexicon, config, options = {}){
  const result = parseConfiguredSourceDetailed(text,lexicon,config,options);
  if(result.diagnostics.alternateAnalyses.length || result.diagnostics.excludedVariantWords) throw new TypeError('Use detailed import API to retain alternate/apparatus diagnostics');
  return result.records;
}

function generateConfiguredSourceDetailed(text, lexicalText, config, options = {}){
  validateBookConfig(config);
  if(config.publication?.enabled){
    for(const [bytes,component] of [[text,config.source],[lexicalText,config.source.lexicalSource]]){
      if(crypto.createHash('sha256').update(bytes,'utf8').digest('hex') !== component.sha256) throw new TypeError('Publication input SHA-256 mismatch');
    }
  }
  const lexicon = config.lexicalJoinStrategy === 'strongs-hebrew-dat' ? parseStrongDat(lexicalText, 'hebrew') : parseStrongGreekXml(lexicalText);
  return parseConfiguredSourceDetailed(text, lexicon, config, options);
}

function generateConfiguredSource(text, lexicalText, config, options = {}){
  const result = generateConfiguredSourceDetailed(text,lexicalText,config,options);
  if(result.diagnostics.alternateAnalyses.length || result.diagnostics.excludedVariantWords) throw new TypeError('Use detailed import API to retain alternate/apparatus diagnostics');
  return result.records;
}

function importAuthoritativeSources(genesisFile, johnFile, hebrewFile, greekFile, outputDirectory, options = {}) {
  const hebrewLexicon = parseStrongDat(fs.readFileSync(hebrewFile, 'utf8'), 'hebrew');
  const greekLexicon = parseStrongGreekXml(fs.readFileSync(greekFile, 'utf8'));
  const records = parseConfiguredSource(fs.readFileSync(genesisFile, 'utf8'), hebrewLexicon, existingBookConfig('genesis'), {chapters:options.genesisChapters || [1]}).concat(parseConfiguredSource(fs.readFileSync(johnFile, 'utf8'), greekLexicon, existingBookConfig('john'), {chapters:options.johnChapters || [1]}));
  if(options.dryRun) return {records, shards:[]};
  return writeStaticData(records, outputDirectory, [existingBookConfig('genesis'),existingBookConfig('john')]);
}

function normalizeRecords(sourceRecords) {
  const records = Array.isArray(sourceRecords) ? sourceRecords : sourceRecords && sourceRecords.records;
  if (!Array.isArray(records)) throw new TypeError('Original-language source must be an array or an object with a records array');
  const locations = new Set();
  const tokens = new Map();
  const normalizedRecords = records.map((record, index) => {
    const normalized = normalizeRecord(record, index);
    const location = [normalized.bookId, normalized.chapter, normalized.verse, normalized.tokenIndex].join(':');
    if (locations.has(location)) invalid(index, `duplicate location ${location}`);
    locations.add(location);
    const verseKey = [normalized.bookId, normalized.chapter, normalized.verse].join(':');
    if(!tokens.has(verseKey)) tokens.set(verseKey, []);
    tokens.get(verseKey).push(normalized.tokenIndex);
    return normalized;
  });
  for(const [key, indices] of tokens){
    indices.sort((a, b) => a - b);
    if(indices.some((n, i) => n !== i)) throw new TypeError('Noncontiguous token indexes: ' + key);
  }
  return normalizedRecords;
}

function shardName(record) {
  return path.join(record.bookId, `${record.chapter}.json`);
}

function writeStaticData(records, outputDirectory, configurations = []) {
  records = normalizeRecords(records);
  const shards = new Map();
  records.forEach((record) => {
    const name = shardName(record);
    if (!shards.has(name)) shards.set(name, []);
    shards.get(name).push(record);
  });
  // Chapter files replace existing files. A mapped source chapter can cross a
  // Reader boundary; refuse incomplete authoritative chapters before any write.
  for(const shardRecords of shards.values()){
    if(shardRecords.some(r => r.status === 'authoritative')){
      if(shardRecords.some(r => r.status !== 'authoritative')) throw new TypeError('Mixed fixture/authoritative chapter');
      const first = shardRecords[0], book = readerBook(first.bookId), verses = book[first.chapter]?.verses;
      const present = new Set(shardRecords.map(r => r.verse));
      if(!verses || [...present].some(v => v > verses.length)) throw new TypeError('Invalid Reader chapter output');
      const missing = verses.map((_, i) => i + 1).filter(v => !present.has(v));
      if(missing.length) throw new TypeError('Incomplete Reader chapter output: ' + first.bookId + ' ' + first.chapter + ':' + missing.join(','));
    }
  }
  // Every authoritative write path, including this low-level writer, is gated.
  // Fixture writes and read-only parse/map validation remain available.
  for(const bookId of new Set(records.filter(r => r.status === 'authoritative').map(r => r.bookId))){
    const config = configurations.find(c => c.bookId === bookId);
    if(!config) throw new TypeError('Authoritative writes require publication-eligible source configuration');
    validateBookConfig(config);
    assertPublicationEligible(config);
    if(records.some(r => r.bookId === bookId && r.source !== config.source.attribution)) throw new TypeError('Publication source attribution mismatch');
  }
  shards.forEach((shardRecords, name) => {
    const file = path.join(outputDirectory, name);
    fs.mkdirSync(path.dirname(file), { recursive: true });
    fs.writeFileSync(file, `${JSON.stringify({ records: shardRecords }, null, 2)}\n`, 'utf8');
  });
  return { records: records.length, shards: [...shards.keys()].sort() };
}

function importOriginalLanguage(sourceRecords, outputDirectory) {
  const records = normalizeRecords(sourceRecords);
  if(records.some(r => r.status !== 'fixture')) throw new TypeError('Authoritative data requires a configured source import');
  fs.mkdirSync(outputDirectory, { recursive: true });
  return writeStaticData(records, outputDirectory);
}

if (require.main === module) {
  const [sourceFile, outputDirectory = 'data/word-study/original-language'] = process.argv.slice(2);
  if (!sourceFile) throw new Error('Usage: node tools/import-original-language.js <source-json> [output-directory]');
  if(sourceFile === '--config'){
    const args = process.argv.slice(3), configFile = args.shift(), flags = {};
    while(args.length){
      const flag = args.shift();
      if(flag === '--dry-run') flags.dryRun = true;
      else if(['--source','--lexicon','--output','--chapters'].includes(flag)){
        if(!args.length || args[0].startsWith('--') || flags[flag]) throw new TypeError('Missing/duplicate option: ' + flag);
        flags[flag] = args.shift();
      }else throw new TypeError('Unknown option: ' + flag);
    }
    if(!configFile || !flags['--source'] || !flags['--lexicon'] || (!flags.dryRun && !flags['--output'])) throw new TypeError('Configured import requires --source, --lexicon and --output or --dry-run');
    const config = JSON.parse(fs.readFileSync(configFile, 'utf8'));
    if(!flags.dryRun){validateBookConfig(config);assertPublicationEligible(config);}
    const {records,diagnostics} = generateConfiguredSourceDetailed(fs.readFileSync(flags['--source'], 'utf8'), fs.readFileSync(flags['--lexicon'], 'utf8'), config, {chapters:flags['--chapters']});
    if(diagnostics.alternateAnalyses.length || diagnostics.excludedVariantWords || diagnostics.mapping.splitSourceVerses.length) console.log('Import diagnostics: '+JSON.stringify(diagnostics));
    if(!flags.dryRun) writeStaticData(records, path.resolve(flags['--output']), [config]);
    console.log((flags.dryRun ? 'Validated dry-run: ' : 'Imported: ') + records.length + ' original-language records.');
  }else if (sourceFile === '--authoritative') {
    const authoritativeArguments = process.argv.slice(3);
    const options = {};
    const positionalArguments = [];
    for (let index = 0; index < authoritativeArguments.length; index += 1) {
      const argument = authoritativeArguments[index];
      const option = argument.match(/^--(genesis-chapters|john-chapters)(?:=(.*))?$/);
      if(argument === '--dry-run') options.dryRun = true;
      else if (option) {
        options[option[1].replace('-', '')] = option[2] || authoritativeArguments[++index];
      } else {
        positionalArguments.push(argument);
      }
    }
    options.genesisChapters = options.genesischapters;
    options.johnChapters = options.johnchapters;
    const [genesisFile, johnFile, hebrewFile, greekFile, authoritativeOutput = 'data/word-study/original-language'] = positionalArguments;
    const result = importAuthoritativeSources(genesisFile, johnFile, hebrewFile, greekFile, path.resolve(authoritativeOutput), options);
    console.log(options.dryRun ? `Validated dry-run: ${result.records.length} authoritative original-language records.` : `Imported ${result.records} authoritative original-language record(s) into ${result.shards.length} shard(s).`);
  } else {
    const source = JSON.parse(fs.readFileSync(path.resolve(sourceFile), 'utf8'));
    const result = importOriginalLanguage(source, path.resolve(outputDirectory));
    console.log(`Imported ${result.records} original-language fixture record(s) into ${result.shards.length} shard(s).`);
  }
}

module.exports = { SCHEMA_FIELDS, normalizeRecord, normalizeRecords, writeStaticData, importOriginalLanguage, parseStrongDat, parseStrongGreekXml, parseOshbGenesis, parseByzantineJohn, importAuthoritativeSources, selectedChapters, mapSourceRecords, parseConfiguredSource, generateConfiguredSource, parseByzantineTokens, parseConfiguredSourceDetailed, generateConfiguredSourceDetailed };
