'use strict';

const fs = require('node:fs');
const path = require('node:path');
const crypto = require('node:crypto');
const {execFileSync} = require('node:child_process');
const canon = require('../js/bible/canon');
const {loadBibleLibrary} = require('./audit-word-study-coverage');
const {parsePinnedLexicon} = require('./strong-hebrew-xml-lexicon');
const {parseSourceRecords, parseStrongGreekXml, normalizeRecords} = require('./import-original-language');
const {isaiahBookConfig, romansBookConfig} = require('./original-language-config');

const oldBooks = new Set(['genesis','exodus','leviticus','numbers','deuteronomy','isaiah','matthew','mark','luke','john','romans']);
const hebrewCodes = 'Gen Exod Lev Num Deut Josh Judg Ruth 1Sam 2Sam 1Kgs 2Kgs 1Chr 2Chr Ezra Neh Esth Job Ps Prov Eccl Song Isa Jer Lam Ezek Dan Hos Joel Amos Obad Jonah Mic Nah Hab Zeph Hag Zech Mal'.split(' ');
const greekCodes = {'1-john':'1JO','2-john':'2JO','3-john':'3JO',philippians:'PHP',philemon:'PHM',james:'JAM',jude:'JUD'};
// The pinned OSHB's inline KJV notes mark these token boundaries.
const hebrewSplits = {
  '1Kgs.18.34': [10,'1Kgs.18.33','1Kgs.18.34'],
  '1Kgs.20.3': [6,'1Kgs.20.2','1Kgs.20.3'],
  '1Kgs.22.21': [8,'1Kgs.22.21','1Kgs.22.22'],
  'Ps.13.6': [6,'Ps.13.5','Ps.13.6']
};
const sha256 = bytes => crypto.createHash('sha256').update(bytes).digest('hex');

function readBlob(root, repository, revision, artifact){
  return execFileSync('git', ['-C',path.join(root,repository),'show',revision+':'+artifact], {maxBuffer:16*1024*1024});
}

function readVerseMap(text){
  const mappings = new Map();
  for(const [,source,target,type] of text.matchAll(/<verse wlc="([^"]+)" kjv="([^"]+)" type="([^"]+)"\/>/g)){
    const verse = source.split('!')[0];
    if(!mappings.has(verse)) mappings.set(verse,[]);
    mappings.get(verse).push({target:target.split('!')[0], partial:type !== 'full'});
  }
  if(mappings.size < 1900) throw new Error('Incomplete Westminster verse map');
  return mappings;
}

function compactChapters(records, book, attribution, excludedEditions){
  const chapters = Array.from({length:book.chapters}, (_, index) => ({
    source:attribution, excludedEditions:excludedEditions[index],
    verses:Array(book[index+1].verses.length).fill(null), lexicon:{}
  }));
  for(const record of normalizeRecords(records)){
    const chapter = chapters[record.chapter-1];
    const index = record.verse-1;
    const tokens = chapter.verses[index] ||= [];
    if(record.tokenIndex !== tokens.length) throw new Error('Out-of-order token at '+record.bookId+' '+record.chapter+':'+record.verse);
    const {surface,strongsNumber,morphology,lemma,transliteration,pronunciation,definition} = record;
    const tuple = [surface,strongsNumber,morphology];
    if(strongsNumber) chapter.lexicon[strongsNumber] = [lemma,transliteration,pronunciation,definition];
    else if(lemma) tuple.push(lemma);
    tokens.push(tuple);
  }
  return chapters;
}

function mapBook(records, bookId, code, isHebrew, book, verseMap){
  const mapped = [];
  const offsets = new Map();
  for(const record of records){
    const reference = code+'.'+record.chapter+'.'+record.verse;
    const remap = isHebrew ? verseMap.get(reference) : null;
    const split = isHebrew && hebrewSplits[reference];
    if(remap?.some(item => item.partial) && !split && reference !== '1Kgs.22.44') throw new Error('Unreviewed source split '+reference);
    // The entire Hebrew 1 Kings 22:44 continues Reader 22:43.
    const target = split ? split[record.tokenIndex < split[0] ? 1 : 2] : remap?.[0].target || reference;
    const [targetCode,chapter,verse] = target.split('.');
    const verses = book[chapter]?.verses;
    if(targetCode !== code || !verses || !Number.isInteger(Number(verse)) || Number(verse) < 1 || Number(verse) > verses.length){
      throw new Error('Invalid Reader reference '+target);
    }
    const tokenIndex = offsets.get(target) || 0;
    offsets.set(target,tokenIndex+1);
    const language = isHebrew ? (record.morphology.startsWith('A') ? 'aramaic' : 'hebrew') : 'greek';
    if(isHebrew && !/^[HA]/.test(record.morphology)) throw new Error('Unknown morphology language '+reference);
    mapped.push({...record,bookId,chapter:Number(chapter),verse:Number(verse),tokenIndex,language});
  }
  return mapped;
}

function publish(root, output){
  if(fs.existsSync(output)) throw new Error('Output directory must be fresh: '+output);
  const kjv = loadBibleLibrary('kjv.js','kjvLibrary');
  const editions = {gnv:loadBibleLibrary('gnv.js','gnvLibrary'),dra:loadBibleLibrary('dra.js','draLibrary')};
  const hebrew = isaiahBookConfig();
  const greek = romansBookConfig();
  const hebrewLexical = hebrew.source.lexicalSource;
  const greekLexical = greek.source.lexicalSource;
  const hebrewDictionary = readBlob(root,'strongs',hebrewLexical.revision,hebrewLexical.artifact);
  const greekDictionary = readBlob(root,'strongs',greekLexical.revision,greekLexical.artifact);
  // The prior Romans manifest pins working-copy line endings. This pins the Git blob.
  if(sha256(greekDictionary) !== 'df928f01b37632f8af9f16289ce58d10b958014cb5dbd1e1ea715a8d311a0625') throw new Error('Greek lexicon checksum mismatch');
  const lexicons = [parsePinnedLexicon(hebrewDictionary).entries,parseStrongGreekXml(greekDictionary.toString('utf8'))];
  const verseMapBytes = readBlob(root,'morphhb',hebrew.source.revision,'wlc/VerseMap.xml');
  const verseMap = readVerseMap(verseMapBytes.toString('utf8'));
  const manifest = {hebrewRevision:hebrew.source.revision, greekRevision:greek.source.revision,
    verseMapSha256:sha256(verseMapBytes), books:{}};
  const ids = canon.order('kjv');
  for(const [index,bookId] of ids.entries()){
    if(oldBooks.has(bookId)) continue;
    const isHebrew = index < hebrewCodes.length;
    const profile = isHebrew ? hebrew : greek;
    const code = isHebrew ? hebrewCodes[index] : greekCodes[bookId] || canon.book(bookId).usfm;
    const book = kjv[bookId];
    const artifact = isHebrew ? 'wlc/'+code+'.xml' : 'csv-unicode/strongs/with-parsing/'+code+'.csv';
    const raw = readBlob(root,isHebrew?'morphhb':'byzantine-majority-text',profile.source.revision,artifact);
    const text = raw.toString('utf8');
    const chapters = [...new Set(Array.from(text.matchAll(isHebrew ? /<verse\s+osisID="[^".]+\.(\d+)\./g : /^(\d+),\d+,/gm),match => Number(match[1])))];
    if(!chapters.length) throw new Error('No source chapters '+bookId);
    const attribution = profile.source.attribution + (isHebrew ? '; adapted with KJV verse numbering and without variant notes. License https://creativecommons.org/licenses/by/4.0/' : '');
    const parsing = {...profile,bookId,sourceBookId:code,sourceVerseCounts:undefined,allowDuplicateAnalyses:!isHebrew,
      source:{...profile.source,attribution}};
    const {records} = parseSourceRecords(text,lexicons[isHebrew?0:1],parsing,chapters);
    const mapped = mapBook(records,bookId,code,isHebrew,book,verseMap);
    const excluded = Array.from({length:book.chapters}, (_, index) => {
      const chapter = index+1;
      return Object.entries(editions).filter(([id,edition]) =>
        edition[bookId]?.[chapter]?.verses?.length !== book[chapter].verses.length ||
        id === 'dra' && ['psalms','daniel','esther'].includes(bookId)
      ).map(([id]) => id);
    });
    const shards = compactChapters(mapped,book,attribution,excluded);
    const entry = {artifact,sourceSha256:sha256(raw),chapters:book.chapters,tokens:mapped.length,missing:[],sha256:{}};
    fs.mkdirSync(path.join(output,bookId),{recursive:true});
    shards.forEach((shard,index) => {
      const chapter = index+1;
      shard.verses.forEach((tokens,verse) => {if(!tokens) entry.missing.push(chapter+':'+(verse+1));});
      const bytes = Buffer.from(JSON.stringify(shard)+'\n');
      entry.sha256[chapter] = sha256(bytes);
      fs.writeFileSync(path.join(output,bookId,chapter+'.json'),bytes);
    });
    manifest.books[bookId] = entry;
  }
  return manifest;
}

if(require.main === module){
  const [root,output] = process.argv.slice(2);
  if(!root || !output) throw new Error('Usage: node tools/publish-bible-original-language.js <source-repositories> <fresh-output-directory>');
  console.log(JSON.stringify(publish(root,output),null,2));
}

module.exports = {publish};
