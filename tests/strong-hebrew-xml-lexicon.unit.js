'use strict';
const {test} = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs'), path = require('node:path'), os = require('node:os');
const {parseReviewLexicon,loadReviewLexicon} = require('../tools/strong-hebrew-xml-lexicon');
const {defaultSourceRoot,validateLocalIsaiah} = require('../tools/validate-isaiah-original-language');
const {isaiahBookConfig,assertPublicationEligible} = require('../tools/original-language-config');
const {generateConfiguredSourceDetailed} = require('../tools/import-original-language');

// Synthetic syntax fixture: excluded content is invented, not copied from TWOT
// or the XML's unassigned definition lists. Full-source checks below use local
// pinned inputs only, with no fetching or executing upstream JavaScript.
const entry = `<div type="entry" n="1">
  <w ID="H1" lemma="lemma" xlit="xlit" POS="pron" gloss="PROHIBITED_TWOT" morph="PROHIBITED_MORPH" xml:lang="PROHIBITED_LANG">PROHIBITED_SURFACE</w>
  <foreign><w gloss="PROHIBITED_GREEK"/></foreign>
  <list><item>PROHIBITED_LIST</item></list>
  <note type="exegesis">PROHIBITED_DERIVATION<w src="PROHIBITED_SRC"/><note type="x-typo">PROHIBITED_CORRECTION</note></note>
  <note type="translation">PROHIBITED_TRANSLATION</note>
  <note type="x-typo">PROHIBITED_EDITORIAL</note>
  <note type="explanation"><hi>father </hi>and &amp; &#x61; &#98;</note>
</div>`;
function document(body = entry) {
  return `<?xml version="1.0"?><osis xmlns="http://www.bibletechnologies.net/2003/OSIS/namespace"><osisText osisIDWork="Strong"><header>
    <work osisWork="Strong"><rights>Public Domain</rights></work>
    <workPrefix path="//w/@ID" osisWork="Strong"/><workPrefix path="//w/@src" osisWork="Strong"/><workPrefix path="//w/@gloss" osisWork="TWOT"/>
    </header><div type="glossary">${body}</div></osisText></osis>`;
}
const plain = result => [...result.entries.values()];
test('projects only five approved fields; POS is pronunciation, not part of speech', () => {
  const result = parseReviewLexicon(document());
  assert.deepEqual(plain(result), [{strongsNumber:'H1',lemma:'lemma',transliteration:'xlit',pronunciation:'pron',definition:'father and & a b'}]);
  assert.equal(result.publicationEligible,false);
  assert.equal(result.reviewStatus,'structural-only');
  assert.equal(Object.hasOwn(result,'revision'),false);
  assert.equal(JSON.stringify(plain(result)).includes('PROHIBITED'),false);
});
test('changing or removing all excluded fields cannot change lexical output', () => {
  const baseline = plain(parseReviewLexicon(document()));
  assert.deepEqual(plain(parseReviewLexicon(document().replace(/PROHIBITED_[A-Z_]+/g,'DIFFERENT_EXCLUDED_VALUE'))),baseline);
  const minimal = `<div type="entry" n="1"><w ID="H1" lemma="lemma" xlit="xlit" POS="pron"/><note type="explanation"><hi>father </hi>and &amp; &#x61; &#98;</note></div>`;
  assert.deepEqual(plain(parseReviewLexicon(document(minimal))),baseline);
});
test('does not fall back to lists, derivation, translation or surface for missing fields', () => {
  for (const field of ['lemma','xlit','POS']) {
    assert.throws(() => parseReviewLexicon(document(entry.replace(`${field}="${{lemma:'lemma',xlit:'xlit',POS:'pron'}[field]}"`,''))), /missing selected field/);
  }
  assert.throws(() => parseReviewLexicon(document(entry.replace(/<note type="explanation">[\s\S]*?<\/note>/,''))), /definition requires exactly one direct explanation/);
  assert.throws(() => parseReviewLexicon(document(entry.replace('<hi>father </hi>and &amp; &#x61; &#98;',' '))), /missing selected field/);
});
test('rejects mixed or unreviewed markup and provenance overrides inside approved fields', () => {
  for (const replacement of ['<w gloss="PROHIBITED"/>','<list><item>PROHIBITED</item></list>','<note type="x-typo">PROHIBITED</note>','<hi source="TWOT">PROHIBITED</hi>','<hi><hi>PROHIBITED</hi></hi>']) {
    assert.throws(() => parseReviewLexicon(document(entry.replace('<hi>father </hi>',replacement))), /explanation markup/);
  }
  for (const replacement of ['type="explanation" source="TWOT"','type="explanation" xmlns="another-work"']) {
    assert.throws(() => parseReviewLexicon(document(entry.replace('type="explanation"',replacement))));
  }
  assert.throws(() => parseReviewLexicon(document(entry.replace('ID="H1"','ID="H1" source="TWOT"'))), /Unexpected lexical attributes/);
  assert.throws(() => parseReviewLexicon(document(entry.replace('type="entry" n="1"','type="entry" n="1" osisWork="TWOT"'))), /Unexpected entry metadata/);
});
test('requires component-specific PD declaration and retained field provenance', () => {
  assert.throws(() => parseReviewLexicon(document().replace('Public Domain','Unknown')), /public-domain declaration/);
  assert.throws(() => parseReviewLexicon(document().replace('osisIDWork="Strong"','osisIDWork="TWOT"')), /Unexpected lexical work/);
  assert.throws(() => parseReviewLexicon(document().replace('osisWork="TWOT"','osisWork="Strong"')), /field provenance/);
});
test('rejects duplicate IDs, mismatched IDs, duplicate definitions, missing entries and malformed XML', () => {
  assert.throws(() => parseReviewLexicon(document(entry+entry)), /duplicate lexical ID/);
  assert.throws(() => parseReviewLexicon(document(entry.replace('n="1"','n="2"'))), /lexical ID/);
  assert.throws(() => parseReviewLexicon(document(entry.replace('</div>','<note type="explanation">duplicate</note></div>'))), /definition requires exactly one direct explanation/);
  assert.throws(() => parseReviewLexicon(document('')), /Empty lexical source/);
  for (const bad of [document().replace('</osis>',''),document().replace('</w>','</note>'),document().replace('lemma="lemma"','lemma="lemma" lemma="other"')]) assert.throws(() => parseReviewLexicon(bad));
});
test('rejects DTDs, external entities, custom entities and namespace changes without resolution', () => {
  for (const bad of [document().replace('<osis ','<!DOCTYPE osis SYSTEM "file:///never-read"><osis '),document().replace('father','&external;'),document().replace('<hi>','<hi xmlns="urn:other">'),document().replace('http://www.bibletechnologies.net/2003/OSIS/namespace','urn:other')]) assert.throws(() => parseReviewLexicon(bad));
});
test('rejects ancestor provenance overrides and unknown structures that could shadow approved fields', () => {
  for (const bad of [
    document().replace('<osisText ', '<osisText source="TWOT" '),
    document().replace('<header>', '<header osisWork="TWOT">'),
    document().replace('<div type="glossary">','<div type="glossary" source="TWOT">'),
    document().replace('<w ID="H1"','<unknown lemma="PROHIBITED"/><w ID="H1"'),
    document().replace('<w ID="H1"','<w __proto__="PROHIBITED" ID="H1"'),
    document().replace('<rights>','<rights source="TWOT">'),
    document().replace('<note type="translation">','<note type="unknown">')
  ]) assert.throws(() => parseReviewLexicon(bad));
});
test('reports the exact missing selected field and never borrows nested lexical attributes', () => {
  assert.throws(()=>parseReviewLexicon(document(entry.replace('ID="H1"',''))),/Missing selected field strongsNumber/);
  for (const [attribute,field] of [['lemma','lemma'],['xlit','transliteration'],['POS','pronunciation']]) {
    const bad = document(entry.replace(new RegExp(attribute+'="[^"]*"'),''));
    assert.throws(() => parseReviewLexicon(bad), new RegExp('Lexical H1: missing selected field '+field));
  }
  for (const field of ['lemma','xlit','POS']) {
    const bad = document(entry.replace(`${field}="${{lemma:'lemma',xlit:'xlit',POS:'pron'}[field]}"`,''))
      .replace('<foreign>','<foreign><w lemma="PROHIBITED" xlit="PROHIBITED" POS="PROHIBITED"/>');
    assert.throws(() => parseReviewLexicon(bad), /missing selected field/);
  }
});
test('selected attribute values are data, never executable markup or source-derived fallbacks', () => {
  const xml = document(entry.replace('lemma="lemma"','lemma="&lt;list&gt;literal&lt;/list&gt;"')
    .replace('xlit="xlit"','xlit="literal &gt; value"').replace('POS="pron"','POS="process.exit(99)"'));
  const row = plain(parseReviewLexicon(xml))[0];
  assert.equal(row.lemma,'<list>literal</list>');
  assert.equal(row.transliteration,'literal > value');
  assert.equal(row.pronunciation,'process.exit(99)');
});
test('rejects malformed characters and entity encodings rather than recovering selected text', () => {
  for(const text of ['\u0000','\ud800','&#0;','&#xD800;','&#1114112;','&unknown;']) {
    assert.throws(()=>parseReviewLexicon(document(entry.replace('lemma="lemma"','lemma="'+text+'"'))),/XML character|XML entity/);
  }
  for(const declaration of ['<?xmlBad?>','<?xml version="1.1"?>','<?xml version="1.0" encoding="external"?>']) {
    assert.throws(()=>parseReviewLexicon(document().replace('<?xml version="1.0"?>',declaration)),/XML declaration/);
  }
});
test('file loader rejects unpinned bytes and has no output/publication option', () => {
  const dir = fs.mkdtempSync(path.join(os.tmpdir(),'god4-lexical-audit-'));
  try {
    const file = path.join(dir,'source.xml'); fs.writeFileSync(file,document());
    assert.throws(() => loadReviewLexicon(file), /SHA-256/);
    assert.deepEqual(fs.readdirSync(dir),['source.xml']);
    assert.throws(() => assertPublicationEligible(isaiahBookConfig()));
  } finally { fs.rmSync(dir,{recursive:true,force:true}); }
});

const sourceRoot = process.env.GOD4_ORIGINAL_LANGUAGE_SOURCES || defaultSourceRoot;
const file = path.join(sourceRoot,'strongs/hebrew/StrongHebrewG.xml');
const skip = fs.existsSync(file) ? false : 'Pinned local XML required; no network fallback';
test('full pinned XML has 8,674 complete entries and deterministic five-field output', {skip}, () => {
  const a = loadReviewLexicon(file), b = loadReviewLexicon(file);
  assert.equal(a.reviewStatus,'field-subset-reviewed');
  assert.equal(a.revision,'0acd2f251c2d35ff8db2dece4e0593979d3ac223');
  assert.equal(a.entries.size,8674); assert.deepEqual(plain(a),plain(b));
  for (const row of a.entries.values()) {
    assert.deepEqual(Object.keys(row),['strongsNumber','lemma','transliteration','pronunciation','definition']);
    assert.ok(Object.values(row).every(v => typeof v === 'string' && v.trim()));
  }
  assert.equal(a.entries.get('H1').definition,'father, in a literal and immediate, or figurative and remote application');
  assert.equal(a.entries.get('H1').lemma,'אָב');
  assert.equal(a.entries.get('H1').transliteration,'ʼâb');
  assert.equal(a.entries.get('H1').pronunciation,'awb');
  assert.equal(a.entries.get('H65').definition,'Abel-Mecholah, a place in Palestine');
  assert.equal(a.publicationEligible,false);
});
const isaiahAvailable = ['morphhb/wlc/Isa.xml','strongs/hebrew/StrongHebrewG.xml'].every(p => fs.existsSync(path.join(sourceRoot,p)));
test('all 2,443 Isaiah numeric lexical IDs join without enabling or altering Isaiah publication', {skip:skip || (!isaiahAvailable && 'Pinned local Isaiah and XML required')}, () => {
  const lexicon = loadReviewLexicon(file).entries;
  const source = fs.readFileSync(path.join(sourceRoot,'morphhb/wlc/Isa.xml'),'utf8');
  const lexical = fs.readFileSync(path.join(sourceRoot,'strongs/hebrew/StrongHebrewG.xml'),'utf8');
  const {records} = generateConfiguredSourceDetailed(source,lexical,isaiahBookConfig());
  const ids = new Set(records.map(r => r.strongsNumber).filter(Boolean));
  assert.equal(ids.size,2443);
  assert.deepEqual([...ids].filter(id => !lexicon.has(id)),[]);
  assert.equal(validateLocalIsaiah(sourceRoot).summary.publicationEligible,false);
  assert.equal(isaiahBookConfig().lexicalJoinStrategy,'strongs-hebrew-xml-subset');
});
