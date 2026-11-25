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

function readGreekLexicon(root, config){
  const artifact = config.source.lexicalSource;
  const bytes = readBlob(root,'strongs',artifact.revision,artifact.artifact);
  // The prior Romans manifest pins working-copy line endings. This pins the Git blob.
  if(sha256(bytes) !== 'df928f01b37632f8af9f16289ce58d10b958014cb5dbd1e1ea715a8d311a0625') throw new Error('Greek lexicon checksum mismatch');
  return parseStrongGreekXml(bytes.toString('utf8'));
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
  const hebrewDictionary = readBlob(root,'strongs',hebrewLexical.revision,hebrewLexical.artifact);
  const lexicons = [parsePinnedLexicon(hebrewDictionary).entries,readGreekLexicon(root,greek)];
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

function publishGreekVariants(root,trRepository,output){
  if(fs.existsSync(output)) throw new Error('Output directory must be fresh: '+output);
  const lexicon = readGreekLexicon(root,romansBookConfig());
  const revision = '33af6e9361f8db0afd353714d05c75f44e5555b9';
  const source = "Textus Receptus, Maurice A. Robinson's parsed edition, public domain. https://github.com/byztxt/greektext-textus-receptus";
  const letters = Object.fromEntries(Array.from('abgdezhqiklmncoprstufxywv',(char,index) =>
    [char, 'αβγδεζηθικλμνχοπρστυφξψως'[index]]));
  const files = [
    ['acts','parsed/AC.UTR',[[8,37,23],[15,34,6],[24,7,13]]],
    ['luke','parsed/LU.UTR',[[17,36,12]]]
  ];
  fs.mkdirSync(output,{recursive:true});
  for(const [bookId,artifact,references] of files){
    const bytes = readBlob(path.dirname(trRepository),path.basename(trRepository),revision,artifact);
    const text = bytes.toString('utf8').replace(/\r\n/g,'\n');
    for(const [chapter,verse,count] of references){
      const lines = text.match(new RegExp('^'+chapter+':'+verse+' [^\\n]*(?:\\n[ \\t][^\\n]*)*','m'));
      if(!lines) throw new Error('Missing Textus Receptus verse '+bookId+' '+chapter+':'+verse);
      const body = lines[0].replace(/^\d+:\d+ /,'').replace(/\|/g,'');
      const tokenPattern = /([a-z]+)\s+(\d+)(?:\s+\d+)?\s+\{([A-Z][A-Z0-9-]+)\}/g;
      const tokens = [...body.matchAll(tokenPattern)];
      if(tokens.length !== count || body.replace(tokenPattern,'').trim()) throw new Error('Unexpected Textus Receptus token sequence');
      const records = tokens.map(([,word,id,morphology],tokenIndex) => {
        const strongsNumber = 'G'+Number(id);
        const {lemma,transliteration,definition} = lexicon.get(strongsNumber);
        const surface = Array.from(word,char=>letters[char]).join('');
        if(surface.length !== word.length) throw new Error('Unsupported transliteration character');
        return {status:'authoritative',strongsNumber,language:'greek',lemma,transliteration,pronunciation:null,partOfSpeech:null,
          definition,morphology,source,bookId,chapter,verse,tokenIndex,surface};
      });
      const data = {revision,artifact,sourceSha256:sha256(bytes),records:normalizeRecords(records)};
      fs.writeFileSync(path.join(output,bookId+'-'+chapter+'-'+verse+'.json'),JSON.stringify(data)+'\n');
    }
  }
}

if(require.main === module){
  const [root,output,variants,trRepository] = process.argv.slice(2);
  if(!root || !output || variants && (variants !== '--variants' || !trRepository)){
    throw new Error('Usage: node tools/publish-bible-original-language.js <source-repositories> <fresh-output-directory> [--variants <Textus Receptus repository>]');
  }
  if(variants) publishGreekVariants(root,trRepository,output);
  else console.log(JSON.stringify(publish(root,output),null,2));
}

module.exports = {publish,publishGreekVariants};
