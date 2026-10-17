'use strict';

// Explicit historical comparison only. The normal Isaiah validator never reads
// DAT. No shard writer, network access or automatic fallback exists here.
const fs = require('node:fs'), path = require('node:path'), crypto = require('node:crypto');
const {isaiahBookConfig} = require('./original-language-config');
const {generateConfiguredSourceDetailed} = require('./import-original-language');
const {validateIsaiahText,defaultSourceRoot} = require('./validate-isaiah-original-language');
const sha = value => crypto.createHash('sha256').update(value).digest('hex');
const DAT_SHA256 = 'eb6190cf487eae8bfa073900333d331f8ffbe1973a0fa9420cf94030c21cc865';
function historicalDatConfig() {
  const config = isaiahBookConfig();
  config.lexicalJoinStrategy = 'strongs-hebrew-dat';
  config.source = {...config.source,lexicalJoinStrategy:config.lexicalJoinStrategy,
    lexicalSource:{dataset:"Strong's Hebrew DAT corrected edition (historical audit only)",
      upstreamIdentifier:'https://github.com/openscriptures/strongs',revision:config.source.lexicalSource.revision,
      artifact:'hebrew/strongshebrew.dat',sha256:DAT_SHA256,
      license:'unresolved: GPL 3.0 statement with MIT-style grant',verification:'license unresolved',
      licenseVerification:{status:'unresolved',evidence:'Historical DAT prologue and build/XHTML GPL notices conflict with its MIT-style grant; replay only.'}},
    attribution:"Original work of the Open Scriptures Hebrew Bible available at https://github.com/openscriptures/morphhb (CC BY 4.0), revision 3d15126fb1ef74867fc1434be1942e837932691f; Westminster Leningrad Codex public domain; Strong's 1890 dictionary and Michael Grier e-text public domain; corrected Hebrew DAT, Open Scriptures revision 0acd2f251c2d35ff8db2dece4e0593979d3ac223: corrected-edition license unresolved; dry validation only"};
  return config;
}
function compareIsaiahLexicalSources(text,xml,dat) {
  const validation = validateIsaiahText(text,xml), config = isaiahBookConfig();
  if(sha(dat) !== DAT_SHA256) throw new TypeError('Historical DAT SHA-256 mismatch');
  const current = generateConfiguredSourceDetailed(text,xml,config);
  const old = generateConfiguredSourceDetailed(text,dat,historicalDatConfig());
  if(current.records.length !== old.records.length) throw new TypeError('Lexical comparison changed token count');
  for(const field of Object.keys(old.diagnostics)) {
    if(JSON.stringify(current.diagnostics[field]) !== JSON.stringify(old.diagnostics[field])) throw new TypeError('Lexical comparison changed source/mapping diagnostics: '+field);
  }
  const fieldChanges = {lemma:0,transliteration:0,pronunciation:0,definition:0,source:0}, definitions = new Map();
  let unchangedFields = 0;
  current.records.forEach((row,i) => {
    const before = old.records[i];
    for(const field of Object.keys(row)) {
      if(Object.hasOwn(fieldChanges,field)) { if(row[field] !== before[field]) fieldChanges[field]++; }
      else { if(row[field] !== before[field]) throw new TypeError('Lexical comparison changed nonlexical field: '+field); unchangedFields++; }
    }
    if(!row.strongsNumber) return;
    const detail = [row.strongsNumber,0,sha(before.definition),sha(row.definition),Buffer.byteLength(before.definition),Buffer.byteLength(row.definition)];
    if(!definitions.has(row.strongsNumber)) definitions.set(row.strongsNumber,detail);
    const retained = definitions.get(row.strongsNumber);
    if(retained.slice(2).join(',') !== detail.slice(2).join(',')) throw new TypeError('Inconsistent per-ID definition');
    retained[1]++;
  });
  const rows = [...definitions.values()].sort((a,b) => Number(a[0].slice(1))-Number(b[0].slice(1)));
  return {
    formatVersion:1,publicationEligible:false,sourceRevision:config.source.revision,lexicalRevision:config.source.lexicalSource.revision,
    sourceSha256:sha(text),xmlSha256:sha(xml),historicalDatSha256:sha(dat),
    totals:validation.summary,mappingDiagnostics:current.diagnostics.mapping,
    unchangedDiagnostics:Object.keys(old.diagnostics),fieldChanges,unchangedNonlexicalFieldValues:unchangedFields,
    distinctDefinitionsCompared:rows.length,distinctDefinitionsDifferent:rows.filter(r => r[2] !== r[3]).length,
    comparisonPolicy:'Exact UTF-8 strings; no Unicode or prose normalization. Historical DAT definitions are represented by hashes and byte lengths, not republished prose. Null numeric IDs retain OSHB lemma and null lexical fields.',
    definitionColumns:['strongsNumber','tokenOccurrences','datDefinitionSha256','xmlDefinitionSha256','datDefinitionUtf8Bytes','xmlDefinitionUtf8Bytes'],
    definitions:rows
  };
}
function compareLocalIsaiah(sourceRoot=process.env.GOD4_ORIGINAL_LANGUAGE_SOURCES || defaultSourceRoot) {
  return compareIsaiahLexicalSources(fs.readFileSync(path.join(sourceRoot,'morphhb/wlc/Isa.xml'),'utf8'),
    fs.readFileSync(path.join(sourceRoot,'strongs/hebrew/StrongHebrewG.xml'),'utf8'),
    fs.readFileSync(path.join(sourceRoot,'strongs/hebrew/strongshebrew.dat'),'utf8'));
}
// One detail per line keeps the complete report reviewable without copying DAT
// prose. Output contains no timestamps, absolute paths or machine-specific data.
function serializeComparison(result) {
  const {definitions,...summary} = result;
  return JSON.stringify(summary,null,2).slice(0,-2)+',\n  "definitions": [\n'+definitions.map(r => '    '+JSON.stringify(r)).join(',\n')+'\n  ]\n}\n';
}
if(require.main === module) {
  if(process.argv.length > 3 || process.argv[2]?.startsWith('--')) throw new TypeError('Usage: node tools/compare-isaiah-lexical-sources.js [local-source-root] (read-only)');
  process.stdout.write(serializeComparison(compareLocalIsaiah(process.argv[2])));
}
module.exports={compareIsaiahLexicalSources,compareLocalIsaiah,serializeComparison,historicalDatConfig};
