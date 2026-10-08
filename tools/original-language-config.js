'use strict';

const {loadBibleLibrary} = require('./audit-word-study-coverage');
let readerLibrary;
function readerBook(bookId){
  if(!readerLibrary) readerLibrary = loadBibleLibrary('kjv.js', 'kjvLibrary');
  if(!Object.hasOwn(readerLibrary, bookId)) throw new TypeError('Unknown canonical Reader book: ' + bookId);
  return readerLibrary[bookId];
}

// Labels come from deployed record attribution. No upstream revision is recorded.
const SOURCES = {
  oshb: {
    dataset:'Open Scriptures Hebrew Bible (OSHB)', license:'CC BY 4.0',
    upstreamIdentifier:'Open Scriptures Hebrew Bible', revision:null, verification:'unknown/unverified',
    language:'hebrew', morphologyFormat:'OSHB', sourceFormat:'oshb-osis', parserStrategy:'oshb',
    lexicalJoinStrategy:'strongs-hebrew-dat',
    lexicalSource:{dataset:"Strong's 1890 Hebrew dictionary; Weston Ruter corrected edition", license:'public domain; MIT', revision:null, verification:'unknown/unverified'},
    textSource:{dataset:'Westminster Leningrad Codex', license:'public domain', revision:null, verification:'unknown/unverified'},
    attribution:"Open Scriptures Hebrew Bible (OSHB) CC BY 4.0; Westminster Leningrad Codex public domain; Strong's 1890 dictionary public domain; corrected edition by Weston Ruter MIT License"
  },
  byzantine: {
    dataset:'Robinson-Pierpont Byzantine Majority Text', license:'public domain',
    upstreamIdentifier:'Robinson-Pierpont Byzantine Majority Text', revision:null, verification:'unknown/unverified',
    language:'greek', morphologyFormat:'Robinson', sourceFormat:'byzantine-csv', parserStrategy:'byzantine',
    lexicalJoinStrategy:'strongs-greek-xml',
    lexicalSource:{dataset:"Strong's 1890 Greek dictionary; Weston Ruter corrected edition", license:'public domain; MIT', revision:null, verification:'unknown/unverified'},
    attribution:"Robinson-Pierpont Byzantine Majority Text public domain; Strong's 1890 dictionary public domain; corrected edition by Weston Ruter MIT License"
  }
};

function createBookConfig(bookId, sourceId, sourceBookId){
  const book = readerBook(bookId), profile = SOURCES[sourceId];
  if(!profile) throw new TypeError('Unknown source profile');
  const ids = Object.keys(readerLibrary);
  const verseCounts = Array.from({length:book.chapters}, (_, i) => book[i + 1].verses.length);
  return {
    bookId, readerBookId:bookId, sourceBookId,
    testament:ids.indexOf(bookId) < ids.indexOf('matthew') ? 'OT' : 'NT',
    chapterCount:book.chapters, language:profile.language,
    sourceFormat:profile.sourceFormat, parserStrategy:profile.parserStrategy,
    lexicalJoinStrategy:profile.lexicalJoinStrategy, morphologyFormat:profile.morphologyFormat,
    source:JSON.parse(JSON.stringify(profile)), sourceVerseCounts:verseCounts,
    referenceMapping:{strategy:'identity', verified:false, evidence:'unknown/unverified'}
  };
}

function mapReference(config, chapter, verse){
  if(!Number.isInteger(chapter) || !Number.isInteger(verse) || chapter < 1 || verse < 1 ||
      !config.sourceVerseCounts[chapter - 1] || verse > config.sourceVerseCounts[chapter - 1]){
    throw new TypeError('Unmapped source reference: ' + chapter + ':' + verse);
  }
  const mapping = config.referenceMapping, key = chapter + ':' + verse;
  let target = mapping.overrides && Object.hasOwn(mapping.overrides, key) ? mapping.overrides[key] : null;
  const matches = (mapping.ranges || []).filter(r => r.sourceChapter === chapter && verse >= r.sourceStart && verse <= r.sourceEnd);
  if(matches.length > 1 || (target && matches.length)) throw new TypeError('Overlapping reference mappings: ' + key);
  if(matches.length){
    const r = matches[0]; target = {chapter:r.readerChapter, verse:r.readerStart + verse - r.sourceStart};
  }
  if(!target && mapping.strategy !== 'explicit') target = {chapter, verse};
  const book = readerBook(config.readerBookId);
  if(!target || !Number.isInteger(target.chapter) || !Number.isInteger(target.verse) || target.verse < 1 ||
      !book[target.chapter] || target.verse > book[target.chapter].verses.length){
    throw new TypeError('Unmapped or invalid Reader reference: ' + key);
  }
  return {bookId:config.readerBookId, chapter:target.chapter, verse:target.verse};
}

function validateBookConfig(config){
  if(!config || typeof config !== 'object') throw new TypeError('Book configuration is required');
  const book = readerBook(config.bookId), reader = readerBook(config.readerBookId);
  if(config.readerBookId !== config.bookId || config.chapterCount !== book.chapters) throw new TypeError('Canonical book/chapter configuration mismatch');
  const ids = Object.keys(readerLibrary), testament = ids.indexOf(config.bookId) < ids.indexOf('matthew') ? 'OT' : 'NT';
  if(config.testament !== testament || typeof config.sourceBookId !== 'string' || !/^[A-Za-z0-9-]+$/.test(config.sourceBookId)) throw new TypeError('Invalid testament/source book identifier');
  const profile = Object.values(SOURCES).find(s => s.parserStrategy === config.parserStrategy);
  if(!profile || ['language','sourceFormat','lexicalJoinStrategy','morphologyFormat'].some(k => config[k] !== profile[k])) throw new TypeError('Unsupported parser/language/lexical/morphology combination');
  if(config.alternateAnalysisPolicy !== undefined && (config.parserStrategy !== 'byzantine' || config.alternateAnalysisPolicy !== 'first-source-analysis')) throw new TypeError('Unsupported alternate-analysis policy');
  const source = config.source;
  if(!source || ['dataset','license','upstreamIdentifier','verification','attribution'].some(k => typeof source[k] !== 'string' || !source[k].trim()) ||
      !(source.revision === null || typeof source.revision === 'string') ||
      ['language','sourceFormat','parserStrategy','lexicalJoinStrategy','morphologyFormat'].some(k => source[k] !== config[k]) ||
      !source.lexicalSource || ['dataset','license','verification'].some(k => typeof source.lexicalSource[k] !== 'string' || !source.lexicalSource[k].trim()) ||
      !(source.lexicalSource.revision === null || typeof source.lexicalSource.revision === 'string')) throw new TypeError('Invalid source provenance');
  if(config.parserStrategy === 'oshb' && (!source.textSource || ['dataset','license','verification'].some(k => typeof source.textSource[k] !== 'string' || !source.textSource[k].trim()) ||
      !(source.textSource.revision === null || typeof source.textSource.revision === 'string'))) throw new TypeError('Invalid text source provenance');
  if(!Array.isArray(config.sourceVerseCounts) || config.sourceVerseCounts.length !== config.chapterCount || config.sourceVerseCounts.some(n => !Number.isInteger(n) || n < 1)) throw new TypeError('Source verse counts are required');
  const mapping = config.referenceMapping;
  if(!mapping || !['identity','identity-with-exceptions','explicit'].includes(mapping.strategy) || typeof mapping.verified !== 'boolean' || typeof mapping.evidence !== 'string' || !mapping.evidence.trim()) throw new TypeError('Explicit reference mapping strategy/evidence is required');
  if(mapping.verified && /^unknown(?:\/unverified)?$/i.test(mapping.evidence.trim())) throw new TypeError('Verified mapping needs reference evidence');
  if(mapping.strategy === 'identity' && (mapping.overrides || mapping.ranges)) throw new TypeError('Identity mapping cannot contain exceptions');
  if(mapping.overrides && (typeof mapping.overrides !== 'object' || Array.isArray(mapping.overrides))) throw new TypeError('Invalid mapping overrides');
  for(const key of Object.keys(mapping.overrides || {})){
    if(!/^[1-9]\d*:[1-9]\d*$/.test(key)) throw new TypeError('Invalid source mapping key');
    if(!mapping.overrides[key] || typeof mapping.overrides[key] !== 'object' || Array.isArray(mapping.overrides[key])) throw new TypeError('Invalid reference mapping target');
    const [ch, v] = key.split(':').map(Number); mapReference(config, ch, v);
  }
  if(mapping.ranges && !Array.isArray(mapping.ranges)) throw new TypeError('Invalid mapping ranges');
  for(const r of mapping.ranges || []){
    if(['sourceChapter','sourceStart','sourceEnd','readerChapter','readerStart'].some(k => !Number.isInteger(r[k]) || r[k] < 1) || r.sourceEnd < r.sourceStart) throw new TypeError('Invalid mapping range');
    mapReference(config, r.sourceChapter, r.sourceStart); mapReference(config, r.sourceChapter, r.sourceEnd);
  }
  const targets = new Set();
  config.sourceVerseCounts.forEach((count, i) => {
    for(let verse = 1; verse <= count; verse++){
      const target = mapReference(config, i + 1, verse), key = target.chapter + ':' + target.verse;
      if(targets.has(key)) throw new TypeError('Reference mapping collision: ' + key);
      targets.add(key);
    }
  });
  for(let ch = 1; ch <= reader.chapters; ch++) for(let v = 1; v <= reader[ch].verses.length; v++){
    if(!targets.has(ch + ':' + v)) throw new TypeError('Missing Reader mapping: ' + ch + ':' + v);
  }
  return config;
}

function existingBookConfig(bookId){
  const config = createBookConfig(bookId, bookId === 'genesis' ? 'oshb' : 'byzantine', bookId === 'genesis' ? 'Gen' : 'John');
  if(!['genesis','john'].includes(bookId)) throw new TypeError('No verified existing-book mapping');
  config.referenceMapping = {strategy:'identity', verified:true, evidence:'Existing John 1–21 records match repository KJV chapter/verse locations; see docs/original-language-import.md'};
  if(bookId === 'genesis'){
    config.sourceVerseCounts[30] = 54; config.sourceVerseCounts[31] = 33;
    config.referenceMapping = {
      strategy:'identity-with-exceptions', verified:true,
      evidence:'Deployed Genesis 32:1 Laban departure = Reader 31:55; 32:2 Jacob/angels = Reader 32:1; 32:33 sinew prohibition = Reader 32:32. See docs/original-language-import.md',
      overrides:{'32:1':{chapter:31, verse:55}},
      ranges:[{sourceChapter:32, sourceStart:2, sourceEnd:33, readerChapter:32, readerStart:1}]
    };
  }
  return validateBookConfig(config);
}

function romansBookConfig(){
  const config = createBookConfig('romans','byzantine','ROM');
  config.sourceVerseCounts = [32,29,31,25,21,23,25,39,33,21,36,21,14,26,33,24];
  config.alternateAnalysisPolicy = 'first-source-analysis';
  config.referenceMapping = {
    strategy:'identity-with-exceptions', verified:true,
    evidence:'Pinned ROM.csv and 06_ROM.BP5 doxology at 14:24–26 matches repository KJV 16:25–27; see docs/romans-source-compatibility.md',
    ranges:[{sourceChapter:14,sourceStart:24,sourceEnd:26,readerChapter:16,readerStart:25}]
  };
  // Artifact-specific metadata: do not change the historical John attribution.
  config.source = Object.assign({},config.source,{
    dataset:'Robinson-Pierpont Byzantine Textform / RP2018',
    license:'public domain / Unlicense',
    upstreamIdentifier:'https://github.com/byztxt/byzantine-majority-text',
    revision:'27a45ff1b7be6c17ccbfeac414f3f55732ae8e28',
    version:'v3.3.2', date:'2024-12-31', verification:'verified selected local artifacts',
    artifact:'csv-unicode/strongs/with-parsing/ROM.csv',
    primaryArtifact:'source/Strongs/06_ROM.BP5',
    credits:['Maurice A. Robinson','Pierpont','byztxt maintainers'],
    lexicalSource:{
      dataset:"Strong's Greek dictionary XML; Ulrik Petersen edition",
      upstreamIdentifier:'https://github.com/openscriptures/strongs',
      artifact:'greek/StrongsGreekDictionaryXML_1.4/strongsgreek.xml',
      license:'public domain', copyingNotice:'Public Domain -- Copy Freely',
      version:'1.4',date:'2007-09-14',revision:'0acd2f251c2d35ff8db2dece4e0593979d3ac223',
      verification:'verified selected XML prologue and release notes',
      credits:['James Strong (1890)','Michael Grier','Ulrik Petersen','Open Scriptures']
    },
    attribution:"Robinson-Pierpont Byzantine Textform RP2018, byztxt v3.3.2 (27a45ff1b7be6c17ccbfeac414f3f55732ae8e28), public domain / Unlicense; Strong's Greek Dictionary (1890), Ulrik Petersen XML 1.4 (2007-09-14), Open Scriptures snapshot 0acd2f251c2d35ff8db2dece4e0593979d3ac223, public domain"
  });
  return validateBookConfig(config);
}

module.exports = {SOURCES, readerBook, createBookConfig, validateBookConfig, mapReference, existingBookConfig, romansBookConfig};
