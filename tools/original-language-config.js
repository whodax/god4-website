'use strict';

const {loadBibleLibrary} = require('./audit-word-study-coverage');
const {FIELDS,REVISION,ARTIFACT} = require('./strong-hebrew-xml-lexicon');
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
    referenceMapping:{strategy:'identity', verified:false, evidence:'unknown/unverified'},
    publication:{enabled:false}
  };
}

function sourceTargets(config, chapter, verse){
  if(!Number.isInteger(chapter) || !Number.isInteger(verse) || chapter < 1 || verse < 1 ||
      !config.sourceVerseCounts[chapter - 1] || verse > config.sourceVerseCounts[chapter - 1]){
    throw new TypeError('Unmapped source reference: ' + chapter + ':' + verse);
  }
  const mapping = config.referenceMapping, key = chapter + ':' + verse;
  const split = mapping.tokenSplits && Object.hasOwn(mapping.tokenSplits, key) ? mapping.tokenSplits[key] : null;
  if(split) return split.segments.map(segment => readerTarget(config, key, segment));
  let target = mapping.overrides && Object.hasOwn(mapping.overrides, key) ? mapping.overrides[key] : null;
  const matches = (mapping.ranges || []).filter(r => r.sourceChapter === chapter && verse >= r.sourceStart && verse <= r.sourceEnd);
  if(matches.length > 1 || (target && matches.length)) throw new TypeError('Overlapping reference mappings: ' + key);
  if(matches.length){
    const r = matches[0]; target = {chapter:r.readerChapter, verse:r.readerStart + verse - r.sourceStart};
  }
  if(!target && mapping.strategy !== 'explicit') target = {chapter, verse};
  return [readerTarget(config, key, target)];
}

function readerTarget(config, key, target){
  const book = readerBook(config.readerBookId);
  if(!target || !Number.isInteger(target.chapter) || !Number.isInteger(target.verse) || target.verse < 1 ||
      !book[target.chapter] || target.verse > book[target.chapter].verses.length){
    throw new TypeError('Unmapped or invalid Reader reference: ' + key);
  }
  return {bookId:config.readerBookId, chapter:target.chapter, verse:target.verse};
}

function mapReference(config, chapter, verse, tokenIndex){
  const targets = sourceTargets(config, chapter, verse);
  const split = config.referenceMapping.tokenSplits?.[chapter + ':' + verse];
  if(!split) return targets[0];
  if(!Number.isInteger(tokenIndex) || tokenIndex < 0 || tokenIndex >= split.tokenCount) throw new TypeError('Split reference requires a valid source token index');
  const segment = split.segments.find(s => tokenIndex >= s.start && tokenIndex <= s.end);
  if(!segment) throw new TypeError('Uncovered split token');
  return readerTarget(config, chapter + ':' + verse, segment);
}

function assertPublicationEligible(config){
  if(config.publication?.enabled !== true) throw new TypeError('Publication is disabled for this configuration');
  if(!config.referenceMapping?.verified) throw new TypeError('Publication requires verified reference mapping');
  for(const component of [config.source, config.source?.lexicalSource, ...(config.parserStrategy === 'oshb' ? [config.source?.textSource] : [])]){
    const proof = component?.licenseVerification;
    if(proof?.status !== 'verified' || typeof proof.evidence !== 'string' || !proof.evidence.trim() ||
        typeof component.license !== 'string' || !component.license.trim() || /unknown|unresolved|unverified/i.test(component.license) ||
        typeof component.revision !== 'string' || !component.revision.trim() ||
        typeof component.artifact !== 'string' || !component.artifact.trim() || !/^[a-f0-9]{64}$/.test(component.sha256 || '')){
      throw new TypeError('Publication requires artifact-specific verified license evidence, revision and SHA-256');
    }
  }
  return config;
}

function validateBookConfig(config){
  if(!config || typeof config !== 'object') throw new TypeError('Book configuration is required');
  const book = readerBook(config.bookId), reader = readerBook(config.readerBookId);
  if(config.readerBookId !== config.bookId || config.chapterCount !== book.chapters) throw new TypeError('Canonical book/chapter configuration mismatch');
  const ids = Object.keys(readerLibrary), testament = ids.indexOf(config.bookId) < ids.indexOf('matthew') ? 'OT' : 'NT';
  if(config.testament !== testament || typeof config.sourceBookId !== 'string' || !/^[A-Za-z0-9-]+$/.test(config.sourceBookId)) throw new TypeError('Invalid testament/source book identifier');
  const profile = Object.values(SOURCES).find(s => s.parserStrategy === config.parserStrategy);
  if(!profile || ['language','sourceFormat','morphologyFormat'].some(k => config[k] !== profile[k]) ||
      !(config.lexicalJoinStrategy === profile.lexicalJoinStrategy || config.parserStrategy === 'oshb' && config.lexicalJoinStrategy === 'strongs-hebrew-xml-subset')) throw new TypeError('Unsupported parser/language/lexical/morphology combination');
  if(config.lexicalJoinStrategy === 'strongs-hebrew-xml-subset'){
    const lexical = config.source?.lexicalSource, proof = lexical?.fieldProvenance;
    if(lexical?.revision !== REVISION || lexical.artifact !== ARTIFACT || proof?.status !== 'verified' ||
        typeof proof.evidence !== 'string' || !proof.evidence.trim() ||
        !proof.fields || Object.keys(proof.fields).length !== Object.keys(FIELDS).length ||
        Object.entries(FIELDS).some(([field,node]) => proof.fields[field] !== node)) throw new TypeError('XML lexical strategy requires reviewed field-level provenance');
  }
  if(config.alternateAnalysisPolicy !== undefined && (config.parserStrategy !== 'byzantine' || config.alternateAnalysisPolicy !== 'first-source-analysis')) throw new TypeError('Unsupported alternate-analysis policy');
  if(config.oshbWordPolicy !== undefined && (config.parserStrategy !== 'oshb' || config.oshbWordPolicy !== 'main-text-only')) throw new TypeError('Unsupported authoritative OSHB word policy');
  if(config.publication !== undefined && (!config.publication || typeof config.publication.enabled !== 'boolean')) throw new TypeError('Invalid publication policy');
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
  if(mapping.strategy === 'identity' && (mapping.overrides || mapping.ranges || mapping.tokenSplits)) throw new TypeError('Identity mapping cannot contain exceptions');
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
  if(mapping.tokenSplits && (typeof mapping.tokenSplits !== 'object' || Array.isArray(mapping.tokenSplits))) throw new TypeError('Invalid token splits');
  for(const [key, split] of Object.entries(mapping.tokenSplits || {})){
    if(!/^[1-9]\d*:[1-9]\d*$/.test(key)) throw new TypeError('Invalid split source key');
    const [ch,v] = key.split(':').map(Number);
    if(mapping.overrides && Object.hasOwn(mapping.overrides,key) || (mapping.ranges || []).some(r => r.sourceChapter === ch && v >= r.sourceStart && v <= r.sourceEnd)) throw new TypeError('Overlapping reference mappings: ' + key);
    if(!split || !Number.isSafeInteger(split.tokenCount) || split.tokenCount < 2 || !Array.isArray(split.segments) || split.segments.length < 2) throw new TypeError('Invalid token split');
    let next = 0;
    for(const s of split.segments){
      if(!s || !Number.isSafeInteger(s.start) || !Number.isSafeInteger(s.end) || s.start < 0 || s.end < s.start || s.end >= split.tokenCount) throw new TypeError('Invalid split token range');
      if(s.start !== next) throw new TypeError('Overlapping or uncovered split token ranges');
      next = s.end + 1;
      readerTarget(config,key,s);
    }
    if(next !== split.tokenCount) throw new TypeError('Uncovered split tokens');
    sourceTargets(config,ch,v);
  }
  const targets = new Set();
  config.sourceVerseCounts.forEach((count, i) => {
    for(let verse = 1; verse <= count; verse++){
      for(const target of sourceTargets(config, i + 1, verse)){
        const key = target.chapter + ':' + target.verse;
        if(targets.has(key)) throw new TypeError('Reference mapping collision: ' + key);
        targets.add(key);
      }
    }
  });
  for(let ch = 1; ch <= reader.chapters; ch++) for(let v = 1; v <= reader[ch].verses.length; v++){
    if(!targets.has(ch + ':' + v)) throw new TypeError('Missing Reader mapping: ' + ch + ':' + v);
  }
  if(config.publication?.enabled) assertPublicationEligible(config);
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

function isaiahBookConfig(){
  const config = createBookConfig('isaiah','oshb','Isa');
  config.lexicalJoinStrategy = 'strongs-hebrew-xml-subset';
  config.oshbWordPolicy = 'main-text-only';
  config.sourceVerseCounts[7] = 23;
  config.sourceVerseCounts[8] = 20;
  config.sourceVerseCounts[63] = 11;
  config.referenceMapping = {
    strategy:'identity-with-exceptions', verified:true,
    evidence:'Pinned OSHB Isa.xml: all 1291 source coordinates and 33 inline KJV notes reviewed against all 1292 repository KJV verses. 63:19 has KJV:Isa.64.1 immediately before word 23sJ1, source token 9. See docs/isaiah-original-language-validation.md.',
    overrides:{'8:23':{chapter:9,verse:1}},
    ranges:[{sourceChapter:9,sourceStart:1,sourceEnd:20,readerChapter:9,readerStart:2},
      {sourceChapter:64,sourceStart:1,sourceEnd:11,readerChapter:64,readerStart:2}],
    tokenSplits:{'63:19':{tokenCount:16,segments:[{start:0,end:8,chapter:63,verse:19},{start:9,end:15,chapter:64,verse:1}]}}
  };
  config.source = {...config.source,
    upstreamIdentifier:'https://github.com/openscriptures/morphhb',
    revision:'3d15126fb1ef74867fc1434be1942e837932691f',artifact:'wlc/Isa.xml',
    sha256:'ce039243b56e4de55b85a635f17343fe9cac7176123fbde5f72af623f9c8f0a5',
    verification:'verified selected local artifact and notices',
    licenseVerification:{status:'verified',evidence:'Pinned README.md, LICENSE.md and Isa.xml header identify OSHB CC BY 4.0; original attribution retained.'},
    lexicalSource:{
      dataset:"Strong's Hebrew OSIS dictionary, reviewed five-field subset",upstreamIdentifier:'https://github.com/openscriptures/strongs',
      revision:REVISION,artifact:ARTIFACT,
      sha256:'f5a0258d39e9ae37edab27feba5301ff7db540a424e28a41a7af57b8ba5058f2',
      license:'public domain (Strong component; five-field subset only)',verification:'verified retained component notices and transformation history',
      fieldProvenance:{status:'verified',fields:{...FIELDS},evidence:'StrongHebrewG.xml Strong work header lines 26–38 and workPrefix lines 58–60; StrongJson.xslt lines 31–40 and 57–65; full pinned XML structural audit. See docs/hebrew-xml-lexical-provenance.md.'},
      licenseVerification:{status:'verified',evidence:'Pinned XML declares Strong component public domain, credits James Strong (1894), David Instone-Brewer and David Troidl; retained XSLT identifies the five selected Strong fields. TWOT glosses, lists and all other notes are excluded. Not a whole-file license claim. See docs/hebrew-xml-lexical-provenance.md.'}
    },
    textSource:{...config.source.textSource,revision:'3d15126fb1ef74867fc1434be1942e837932691f',artifact:'wlc/Isa.xml',
      sha256:'ce039243b56e4de55b85a635f17343fe9cac7176123fbde5f72af623f9c8f0a5',verification:'verified local WLC header',
      licenseVerification:{status:'verified',evidence:'Pinned OSHB README, LICENSE and WLC work header state public domain.'}},
    lexicalJoinStrategy:config.lexicalJoinStrategy,
    attribution:"Original work of the Open Scriptures Hebrew Bible available at https://github.com/openscriptures/morphhb (CC BY 4.0), revision 3d15126fb1ef74867fc1434be1942e837932691f; Westminster Leningrad Codex public domain; James Strong, A Concise Dictionary of the Words in the Hebrew Bible, Hunt & Eaton, 1894; electronic editing by David Instone-Brewer and David Troidl; Strong work declared public domain in Open Scriptures StrongHebrewG.xml, selected ID/headword/transliteration/pronunciation/explanation fields only, revision 0acd2f251c2d35ff8db2dece4e0593979d3ac223; TWOT and other lexical fields excluded"
  };
  return validateBookConfig(config);
}

module.exports = {SOURCES, readerBook, createBookConfig, validateBookConfig, mapReference, sourceTargets, assertPublicationEligible, existingBookConfig, romansBookConfig, isaiahBookConfig};
