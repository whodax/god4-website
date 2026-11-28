'use strict';

const fs = require('node:fs');
const path = require('node:path');
const canon = require('../js/bible/canon');
const {books, manuscriptMatches} = require('./import-web-alignment');
const {osisCodes} = require('./import-crosswire-kjv-alignment');
const clear = require('./clear-bible-shell80-sources.json');
const unfoldingWord = require('./web-alignment-sources.json');
const ult = require('./web-alignment-v92-source.json');

const version = 1;
const baseline = '82042e8cc29875d3d69aeea241c1a131368ec15b';
const sources = Object.freeze({
  'reader-web': baseline,
  'reader-kjv': baseline,
  'reader-asv': baseline,
  'reader-ylt': baseline,
  'reader-dby': baseline,
  'reader-webster': baseline,
  'reader-rv': baseline,
  'reader-gnv': baseline,
  'reader-dra': baseline,
  'reader-ethiopian': baseline,
  'reader-hebrew-aramaic': baseline,
  'reader-greek-byzantine': baseline,
  'reader-greek-tr': baseline,
  'clear-wlcm': clear.revision,
  'clear-sblgnt': clear.revision,
  'clear-bgnt': clear.revision,
  'clear-bsb-ot': clear.revision,
  'clear-bsb-nt': clear.revision,
  uhb: unfoldingWord[1].contentsSha256,
  ugnt: unfoldingWord[2].contentsSha256,
  ult: ult.contentsSha256,
  'berean-publisher': 'aa2a9a0f004d015738cd1839c7c56c3be2549e0d4f4537090c2017268c223c60',
  'crosswire-kjv': 'd490be7e34762deb2c76cb2c1306d4808e27890d'
});
const webBooks = canon.order('web');
const byUsfm = new Map(books.map((book, index) => [book, webBooks[index]]));
const byOsis = new Map(osisCodes.map((book, index) => [book, webBooks[index]]));

function address(source, coordinate) {
  if (!Object.hasOwn(sources, source) || typeof coordinate !== 'string') return null;
  let match, bookId;
  if (source.startsWith('clear-')) {
    match = coordinate.match(/^(\d{2})(\d{3})(\d{3})([a-z])?$/);
    bookId = webBooks[Number(match?.[1])-1];
    const ot = ['clear-wlcm','clear-bsb-ot'].includes(source);
    if (ot !== (Number(match?.[1]) <= 39)) return null;
  } else if (['uhb','ugnt','ult'].includes(source)) {
    match = coordinate.match(/^([A-Z0-9]{3}) (\d+):(\d+)([a-z])?$/);
    bookId = byUsfm.get(match?.[1]);
    const ot = webBooks.indexOf(bookId) < 39;
    if ((source==='uhb' && !ot) || (source==='ugnt' && ot)) return null;
  } else if (source==='reader-ethiopian') {
    match = coordinate.match(/^([a-z0-9-]+):(\d+)([A-Z]?):(\d+)$/);
    if (!match) return null;
    bookId=match[1];
    const section=match[2]+match[3], line=Number(match[4]);
    if (!Number.isSafeInteger(line) || line<1) return null;
    const file=path.resolve(__dirname,'../data/ethiopian-readings',bookId+'.json');
    if (!fs.existsSync(file)) return null;
    const chapters=JSON.parse(fs.readFileSync(file,'utf8')).sections;
    if (!chapters?.some(row=>row.id===section && row.lines.some(([n])=>n===line))) return null;
    return {source,revision:sources[source],coordinate,bookId,section,line};
  } else if (source==='crosswire-kjv') {
    match = coordinate.match(/^([a-zA-Z0-9]+)\.(\d+)\.(\d+)([a-z])?$/);
    bookId = byOsis.get(match?.[1]);
  } else {
    match = coordinate.match(/^([a-z0-9-]+):(\d+):(\d+)([a-z])?$/);
    bookId = match?.[1];

    if (source==='reader-dra' ? !canon.order('dra').includes(bookId) : !webBooks.includes(bookId)) return null;
    if (source==='reader-hebrew-aramaic' && webBooks.indexOf(bookId)>=39) return null;
    if (source.startsWith('reader-greek-') && webBooks.indexOf(bookId)<39) return null;
  }
  if (!match || !bookId) return null;
  const chapter=Number(match[2]), verse=Number(match[3]), part=match[4] || '';
  if (!Number.isSafeInteger(chapter) || chapter<1 || !Number.isSafeInteger(verse) ||
    (verse===0 && !['clear-wlcm','clear-bsb-ot','uhb'].includes(source))) return null;
  return {source, revision:sources[source], coordinate, bookId, chapter, verse, part};
}

function key(ref) { return ref.source+'@'+ref.revision+'/'+ref.coordinate; }
function checked(ref) {
  const parsed=ref && address(ref.source,ref.coordinate);
  return parsed && Object.keys(parsed).every(field=>parsed[field]===ref[field]);
}

function referenceLink(from, to, evidence) {
  if (!Array.isArray(from) || !Array.isArray(to) || !from.length || !to.length ||
    ![...from,...to].every(checked) || !evidence?.locator ||
    !['declared-numbering','ordered-witness','human-review'].includes(evidence.kind)) return null;
  const ordered = (a,b) => a.source==='reader-ethiopian' ?
    a.section.localeCompare(b.section,'en',{numeric:true})<0 || (a.section===b.section && a.line<b.line) :
    a.chapter<b.chapter || (a.chapter===b.chapter && (a.verse<b.verse || (a.verse===b.verse && a.part<b.part)));
  const side = refs => refs.every((ref,index)=>ref.source===refs[0].source &&
    ref.bookId===refs[0].bookId && (!index || ordered(refs[index-1],ref)));
  if (from[0].source===to[0].source || from[0].bookId!==to[0].bookId || !side(from) || !side(to)) return null;
  const unresolvedCanon=[...from,...to].some(ref=>ref.source==='reader-ethiopian' ||
    (ref.source==='reader-dra' && canon.catholicOnly(ref.bookId,ref.chapter,ref.verse)));
  if (unresolvedCanon && evidence.kind!=='human-review') return null;
  const relation = from.length===1 ? (to.length===1?'one-to-one':'one-to-many') :
    (to.length===1?'many-to-one':'many-to-many');
  return {version,from,to,relation,evidence};
}

function resolveReference(index, ref, targetSource) {
  if (!checked(ref)) return {status:'unavailable'};
  const matches=index.filter(link=>link.from.some(member=>key(member)===key(ref)) &&
    link.to[0].source===targetSource);
  if (matches.length!==1) return {status:matches.length?'ambiguous':'unavailable'};
  const link=matches[0];
  return {status:link.evidence.kind==='declared-numbering'?'coordinate-only':'witnessed',link};
}

function orderedWitness(ref, target, native, reader) {
  const link=referenceLink([ref],[target],{kind:'ordered-witness',locator:'Pinned ordered USFM and Reader source tokens'});
  if (!link || !reader.length || native.length!==reader.length || reader.some((record,index)=>
    record.status!=='authoritative' || record.tokenIndex!==index ||
    record.bookId!==target.bookId || record.chapter!==target.chapter || record.verse!==target.verse ||
    !manuscriptMatches(native[index],record,record.language))) return null;
  return link;
}

// Atom IDs are supplied by a pinned adapter. Compound groups must account for every atom once.
function tokenLinks(link, left, right, evidence) {
  if (!link || link.version!==version || link.evidence.kind==='declared-numbering' ||
    !referenceLink(link.from,link.to,link.evidence) || !evidence?.locator || !Array.isArray(evidence.groups)) return null;
  const index = atoms => new Map(atoms.map((atom,i)=>[atom.id,{...atom,i}]));
  const a=index(left), b=index(right);
  if (a.size!==left.length || b.size!==right.length) return null;
  const usedA=new Set(), usedB=new Set();
  const result=[];
  for (const group of evidence.groups) {
    if (!Array.isArray(group?.from) || !Array.isArray(group?.to)) return null;
    const rowsA=group.from.map(id=>a.get(id)), rowsB=group.to.map(id=>b.get(id));
    const consecutive = rows => rows.length && rows.every((row,i)=>row && row.form &&
      row.lemma && row.morphology && row.language && row.i===rows[0].i+i);
    if (!consecutive(rowsA) || !consecutive(rowsB)) return null;
    // The adapter decomposes each token into stable linguistic atoms before this comparison.
    const atoms = rows => rows.flatMap(row=>row.atoms || [[row.language,row.form,row.lemma,row.morphology]]);
    const aa=atoms(rowsA), bb=atoms(rowsB);
    const validAtoms = items => items.length && items.every(item=>Array.isArray(item) && item.length===4 &&
      item.every(field=>typeof field==='string' && field.length));
    if (!validAtoms(aa) || !validAtoms(bb) || JSON.stringify(aa)!==JSON.stringify(bb)) return null;
    if (group.from.some(id=>usedA.has(id)) || group.to.some(id=>usedB.has(id))) return null;
    if (result.length && (rowsA[0].i<=result.at(-1).endA || rowsB[0].i<=result.at(-1).endB)) return null;
    group.from.forEach(id=>usedA.add(id));
    group.to.forEach(id=>usedB.add(id));
    result.push({...group,endA:rowsA.at(-1).i,endB:rowsB.at(-1).i});
  }
  if (!result.length) return null;
  return result.map(({from,to})=>({from,to,
    relation:from.length===1?(to.length===1?'one-to-one':'one-to-many'):(to.length===1?'many-to-one':'many-to-many'),
    locator:evidence.locator}));
}

function mapVerifiedPositions(ref, source, evidence, records) {
  if (!checked(ref) || !source?.length || !records.length || source.length!==records.length ||
    !evidence || evidence.kind!=='validated-package' || !evidence.locator) return null;
  const parts = new Map();
  for (const [position, ids] of source.entries()) {
    if (!ids.length || records[position].tokenIndex!==position) return null;
    for(const [part,id] of ids.entries()) {
      const hebrew=ref.source==='clear-wlcm';
      const expected=(hebrew?'o':'n')+ref.coordinate+String(position+1).padStart(3,'0')+(hebrew?part+1:'');
      if (id!==expected || parts.has(id)) return null;
      parts.set(id,position);
    }
  }
  return parts;
}

module.exports={version,baseline,sources,address,referenceLink,resolveReference,orderedWitness,tokenLinks,mapVerifiedPositions};
