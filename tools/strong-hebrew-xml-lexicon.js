'use strict';

// Field-scoped Strong OSIS adapter. No writer and no DAT fallback.
const fs = require('node:fs');
const crypto = require('node:crypto');
const REVISION = '0acd2f251c2d35ff8db2dece4e0593979d3ac223';
const ARTIFACT = 'hebrew/StrongHebrewG.xml';
const FIELDS = Object.freeze({strongsNumber:'w/@ID',lemma:'w/@lemma',transliteration:'w/@xlit',
  pronunciation:'w/@POS',definition:"note[@type='explanation']/text() and plain hi/text()"});
const HASHES = new Set([
  '1f9659ea208f4c498843a0280dacb1448627c33ca77712642d8705793ab66061', // Git LF blob
  'f5a0258d39e9ae37edab27feba5301ff7db540a424e28a41a7af57b8ba5058f2' // supplied CRLF checkout
]);
const NAMESPACE = 'http://www.bibletechnologies.net/2003/OSIS/namespace';
function check(value, message) { if (!value) throw new TypeError(message); }
function decode(text) {
  check(!/&(?!amp;|lt;|gt;|quot;|apos;|#\d+;|#x[0-9a-fA-F]+;)/.test(text), 'Unsupported XML entity');
  return text.replace(/&(amp|lt|gt|quot|apos|#\d+|#x[0-9a-fA-F]+);/g, (_, entity) => {
    if (entity[0] !== '#') return {amp:'&',lt:'<',gt:'>',quot:'"',apos:"'"}[entity];
    const n = entity[1] === 'x' ? parseInt(entity.slice(2), 16) : Number(entity.slice(1));
    check(n === 9 || n === 10 || n === 13 || n >= 32 && n <= 0xd7ff || n >= 0xe000 && n <= 0xfffd || n >= 0x10000 && n <= 0x10ffff, 'Invalid XML character');
    return String.fromCodePoint(n);
  });
}

// Limited to the retained OSIS syntax, not a general XML implementation. Reject
// DTDs, custom entities, CDATA, namespace changes and unsupported markup rather
// than recovering ambiguously. No external resource resolution is possible.
function tree(xml) {
  xml = xml.replace(/^\uFEFF/, ''); // UTF-8 BOM is present in the pinned artifact.
  check(!/[\u0000-\u0008\u000b\u000c\u000e-\u001f\ufffe\uffff]/u.test(xml) && xml.isWellFormed(), 'Invalid XML character');
  const document = {name:'#document', attrs:{}, children:[]}, stack = [document];
  const tokens = /<!--[\s\S]*?-->|<\?xml\s[^?]*\?>|<(?:[^<>"']|"[^"<]*"|'[^'<]*')*>|[^<]+/g;
  let cursor = 0;
  for (const match of xml.matchAll(tokens)) {
    check(match.index === cursor, 'Unsupported XML syntax'); cursor += match[0].length;
    const token = match[0], parent = stack.at(-1);
    if (token.startsWith('<!--')) { check(!token.slice(4,-3).includes('--'), 'Invalid XML comment'); continue; }
    if (token.startsWith('<?xml')) {
      check(match.index === 0 && /^<\?xml\s+version\s*=\s*(["'])1\.0\1(?:\s+encoding\s*=\s*(["'])utf-8\2)?\s*\?>$/i.test(token), 'Unexpected XML declaration');
      continue;
    }
    if (!token.startsWith('<')) { parent.children.push(decode(token)); continue; }
    check(!token.startsWith('<!') && !token.startsWith('<?'), 'Unsupported XML declaration');
    const end = token.match(/^<\/([A-Za-z][\w-]*)\s*>$/);
    if (end) { check(stack.length > 1 && stack.pop().name === end[1], 'Mismatched XML close'); continue; }
    const start = token.match(/^<([A-Za-z][\w-]*)([\s\S]*?)(\/?)>$/);
    check(start, 'Unsupported XML element');
    const attrs = Object.create(null), rest = start[2], pattern = /\s+([A-Za-z_][\w:.-]*)\s*=\s*("[^"<]*"|'[^'<]*')/gy;
    let consumed = 0, attribute;
    while ((attribute = pattern.exec(rest))) {
      const name = attribute[1];
      check(!Object.hasOwn(attrs,name), 'Duplicate XML attribute');
      check(!name.startsWith('xmlns') || stack.length === 1 && start[1] === 'osis', 'Unexpected XML namespace declaration');
      attrs[name] = decode(attribute[2].slice(1,-1)); consumed = pattern.lastIndex;
    }
    check(!rest.slice(consumed).trim(), 'Malformed XML attributes');
    const node = {name:start[1],attrs,children:[]}; parent.children.push(node);
    if (!start[3]) stack.push(node);
  }
  check(cursor === xml.length && stack.length === 1, 'Incomplete XML');
  const roots = document.children.filter(n => typeof n !== 'string');
  check(roots.length === 1 && document.children.every(n => typeof n !== 'string' || !n.trim()), 'Invalid XML document');
  check(roots[0].name === 'osis' && roots[0].attrs.xmlns === NAMESPACE, 'Unexpected OSIS namespace');
  return roots[0];
}
const children = (node, name) => node.children.filter(n => typeof n !== 'string' && n.name === name);
function attributes(node, allowed) {
  check(Object.keys(node.attrs).every(k => allowed.includes(k)), 'Unexpected '+node.name+' attributes');
}
function structure(node, allowed) {
  check(node.children.every(n => typeof n === 'string' ? !n.trim() : allowed.includes(n.name)), 'Unexpected '+node.name+' structure');
}
function one(node, name, predicate = () => true) {
  const matches = children(node,name).filter(predicate);
  check(matches.length === 1, 'Expected one ' + name); return matches[0];
}
function textOnly(node) {
  check(node.children.every(n => typeof n === 'string'), 'Unexpected nested metadata');
  return node.children.join('').replace(/\s+/g,' ').trim();
}
function explanation(node) {
  check(Object.keys(node.attrs).join(',') === 'type', 'Unexpected explanation attributes');
  return node.children.map(n => {
    if (typeof n === 'string') return n;
    check(n.name === 'hi' && !Object.keys(n.attrs).length, 'Unreviewed explanation markup');
    check(n.children.every(child => typeof child === 'string'), 'Unexpected nested explanation markup');
    return n.children.join('');
  }).join('').replace(/\s+/g,' ').trim();
}

function parseReviewLexicon(xml) {
  const root = tree(xml), body = one(root,'osisText');
  attributes(root,['xmlns','xmlns:xsi','xmlns:xsd','xsi:schemaLocation']); structure(root,['osisText']);
  attributes(body,['osisIDWork','xml:lang']); structure(body,['header','div']);
  check(body.attrs.osisIDWork === 'Strong', 'Unexpected lexical work');
  const header = one(body,'header'), work = one(header,'work', n => n.attrs.osisWork === 'Strong');
  attributes(header,[]); structure(header,['revisionDesc','work','workPrefix']);
  attributes(work,['osisWork','xml:lang']);
  const rights = one(work,'rights'); attributes(rights,[]);
  check(textOnly(rights) === 'Public Domain', 'Strong public-domain declaration missing');
  const prefixes = children(header,'workPrefix');
  check(prefixes.length === 3, 'Unexpected field provenance declarations');
  prefixes.forEach(n => { attributes(n,['path','osisWork']); structure(n,[]); });
  for (const [field, source] of [['ID','Strong'],['src','Strong'],['gloss','TWOT']]) {
    check(prefixes.filter(n => n.attrs.path === '//w/@'+field).length === 1 &&
      prefixes.some(n => n.attrs.path === '//w/@'+field && n.attrs.osisWork === source), 'Unexpected field provenance');
  }
  const glossary = one(body,'div'), entries = new Map();
  attributes(glossary,['type']); structure(glossary,['div']);
  check(glossary.attrs.type === 'glossary','Unexpected glossary type');
  for (const entry of children(glossary,'div')) {
    check(entry.attrs.type === 'entry' && Object.keys(entry.attrs).every(k => ['type','n'].includes(k)), 'Unexpected entry metadata');
    structure(entry,['w','foreign','list','note']);
    check(children(entry,'note').every(n => ['exegesis','explanation','translation','x-typo'].includes(n.attrs.type)), 'Unknown entry note type');
    const word = one(entry,'w');
    check(Object.keys(word.attrs).every(k => ['ID','lemma','xlit','POS','gloss','morph','xml:lang'].includes(k)), 'Unexpected lexical attributes');
    check(word.children.every(n => typeof n === 'string'), 'Unexpected lexical word markup');
    const id = word.attrs.ID;
    check(typeof id === 'string' && id.trim(), 'Missing selected field strongsNumber (direct w/@ID)');
    check(/^H[1-9]\d*$/.test(id) && entry.attrs.n === id.slice(1) && !entries.has(id), 'Invalid or duplicate lexical ID');
    const definitions = children(entry,'note').filter(n => n.attrs.type === 'explanation');
    check(definitions.length === 1, 'Lexical '+id+': definition requires exactly one direct explanation');
    const record = {strongsNumber:id, lemma:word.attrs.lemma, transliteration:word.attrs.xlit,
      pronunciation:word.attrs.POS, definition:explanation(definitions[0])};
    for (const [field,value] of Object.entries(record)) check(typeof value === 'string' && value.trim(), 'Lexical '+id+': missing selected field '+field);
    entries.set(id,Object.freeze(record));
  }
  check(entries.size, 'Empty lexical source');
  return {entries, publicationEligible:false, reviewStatus:'structural-only'};
}

function parsePinnedLexicon(bytes) {
  const sha256 = crypto.createHash('sha256').update(bytes).digest('hex');
  check(HASHES.has(sha256), 'Unreviewed lexical artifact SHA-256');
  const result = parseReviewLexicon(bytes.toString('utf8'));
  check(result.entries.size === 8674 && Array.from({length:8674},(_,i) => result.entries.has('H'+(i+1))).every(Boolean), 'Incomplete pinned lexicon');
  return {...result,sha256,reviewStatus:'field-subset-reviewed',revision:REVISION,artifact:ARTIFACT};
}
function loadReviewLexicon(file) { return parsePinnedLexicon(fs.readFileSync(file)); }
module.exports = {loadReviewLexicon,parseReviewLexicon,parsePinnedLexicon,FIELDS,REVISION,ARTIFACT};
