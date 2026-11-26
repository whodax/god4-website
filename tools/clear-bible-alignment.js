'use strict';

const fs = require('node:fs');
const path = require('node:path');
const {createHash} = require('node:crypto');
const {READER_TOKEN_PATTERN} = require('./audit-word-study-coverage');
const {manuscriptMatches} = require('./import-web-alignment');

const normalizeHebrew = value => value.normalize('NFD').replace(/[\u0591-\u05af\u05bd\u05be\u05c0\u05c3\u2060/]/g,'');
const normalizeGreek = value => value.normalize('NFD').replace(/\p{Mark}|[\u2019']/gu,'').toLowerCase().replace(/\u03c2/g,'\u03c3');
const reject = (reason,ambiguous=false) => ({reason,ambiguous});
const bcv = /^[0-9]{8}$/;
const pos = {R:'preposition',N:'noun',V:'verb',T:'particle',C:'conjunction',A:'adjective',D:'adverb',S:'suffix',P:'pronoun'};

function input(directory,file,pins) {
  const raw=fs.readFileSync(path.join(directory,'shell80-'+file));
  const checksum=createHash('sha256').update(raw).digest('hex');
  if (checksum!==pins[file]) throw new Error('Clear.Bible checksum mismatch: '+file);
  return raw.toString('utf8');
}

function groupedTsv(text,referenceFor,width) {
  const verses=new Map(), seen=new Set();
  for (const line of text.split(/\r?\n/).slice(1)) {
    if (!line) continue;
    const fields=line.split('\t');
    const ref=referenceFor(fields[0]);
    if (!bcv.test(ref) || fields.length!==width || seen.has(fields[0])) throw new Error('Invalid or duplicate Clear.Bible TSV ID: '+fields[0]);
    seen.add(fields[0]);
    if (!verses.has(ref)) verses.set(ref,[]);
    verses.get(ref).push(fields);
  }
  return verses;
}

function loadPackage(directory,id,pins) {
  const hebrew=id==='WLCM';
  const raw=JSON.parse(input(directory,id+'-BSB-manual.json',pins));
  input(directory,id+'-BSB-manual.toml',pins); // Pin the source metadata even where its declarations disagree with the records.
  if (raw.documents?.[0]?.docid!==id || raw.documents?.[1]?.docid!=='BSB' || !Array.isArray(raw.records)) {
    throw new Error('Unexpected Clear.Bible alignment documents');
  }
  const sources=groupedTsv(input(directory,id+'.tsv',pins),word=>word.slice(1,9),hebrew?8:9);
  const targets=groupedTsv(input(directory,(hebrew?'ot':'nt')+'_BSB.tsv',pins),word=>word.slice(0,8),7);
  const alignments=new Map();
  for (const row of raw.records) {
    const ref=row.meta?.id?.split('.')[0];
    if (!bcv.test(ref) || (row.meta.origin!=='manual' && row.meta.process!=='manual')) throw new Error('Unverifiable Clear.Bible manual row');
    if (!alignments.has(ref)) alignments.set(ref,[]);
    alignments.get(ref).push(row);
  }
  return {id,hebrew,creator:raw.meta?.creator,schemes:raw.documents.map(doc=>doc.scheme),sources,targets,alignments,records:raw.records.length};
}

function targetVerse(rows,ref) {
  let text='', skip=true;
  const offsets=new Map();
  for (const [index,[id,sourceVerse,token,noSpace,exclude,idRange,verseRange]] of rows.entries()) {
    if (sourceVerse!==ref || idRange || verseRange) return reject('target verse bridge or remap');
    if (id!==ref+String(index+1).padStart(3,'0')) return reject('target positions are reordered or incomplete',true);
    if (!skip) text+=' ';
    const start=text.length;
    text+=token;
    skip=noSpace==='y';
    const word=[...token.matchAll(READER_TOKEN_PATTERN)];
    // Retain punctuation and typography in the text, but never project it as an English word.
    if (!exclude && word.length===1 && word[0].index===0 && word[0][0].length===token.length) offsets.set(id,[start,text.length]);
  }
  return {text,offsets};
}

function originalWords(rows,hebrew,ref) {
  const groups=new Map();
  for (const row of rows) {
    const id=row[0];
    const shape=hebrew?/^o(\d{8})(\d{3})([1-9])$/:/^n(\d{8})(\d{3})$/;
    const match=id.match(shape);
    if (match?.[1]!==ref) return null;
    const word=Number(match[2]),part=Number(match[3]||1);
    if (!groups.has(word)) groups.set(word,[]);
    const parts=groups.get(word);
    if (part!==parts.length+1) return null;
    parts.push({id,form:row[2],strong:row[3],pos:row[6],morph:row[8]});
  }
  const ordered=[...groups];
  return ordered.every(([word],index)=>word===index+1)?ordered.map(([,parts])=>parts):null;
}

function hebrewWordMatches(parts,witness,record) {
  if (!['hebrew','aramaic'].includes(record.language)) return false;
  const form=witness.form.split('\u2060');
  const classes=witness.morph.replace(/^(?:He|Ar),/,'').split(':');
  if (parts.length!==form.length || parts.length!==classes.length) return false;
  if (!parts.every((part,index)=>part.form && normalizeHebrew(part.form)===normalizeHebrew(form[index]) &&
    pos[classes[index][0]]===part.pos)) return false;
  const lexical=witness.strong.split(':').findIndex(code=>/^H\d/.test(code));
  const stem=parts[lexical];
  return Boolean(stem && /^\d+[a-z]?$/.test(stem.strong) && 'H'+parseInt(stem.strong,10)===record.strongsNumber);
}

function greekWordMatches(parts,record,id) {
  const token=parts[0];
  if (record.language!=='greek' || parts.length!==1 ||
    normalizeGreek(token.form)!==normalizeGreek(record.surface) ||
    !/^G\d+$/.test(token.strong) || 'G'+Number(token.strong.slice(1))!==record.strongsNumber) return false;
  if (id==='SBLGNT') return token.morph===record.morphology;
  const fixed={Prep:'PREP',Conj:'CONJ',Adv:'ADV',Interj:'INJ'};
  const noun=token.morph?.match(/^(N|Adj|Art)-([NGDAV])([MFN])([SPD])$/);
  const verb=token.morph?.match(/^V-([A-Z])([A-Z])([A-Z])-([1-3][SP])$/);
  const canonical=noun?({N:'N',Adj:'A',Art:'T'}[noun[1]]+'-'+noun[2]+noun[4]+noun[3]):
    verb?'V-'+verb[1]+verb[3]+verb[2]+'-'+verb[4]:fixed[token.morph];
  return canonical===record.morphology;
}

function validatePackageVerse(dataset,ref,witness,records) {
  const source=dataset.sources.get(ref), targetRows=dataset.targets.get(ref), links=dataset.alignments.get(ref);
  if (!source || !targetRows || !links) return reject('missing same-reference source, target or alignment');
  const target=targetVerse(targetRows,ref);
  if (target.reason) return target;
  const words=originalWords(source,dataset.hebrew,ref);
  if (!words || !records.length || words.length!==records.length || witness.length!==records.length) return reject('original word boundaries or token counts differ');
  for (const [index,parts] of words.entries()) {
    const record=records[index];
    if (record.status!=='authoritative' || record.tokenIndex!==index || !manuscriptMatches(witness[index],record,record.language) ||
      !(dataset.hebrew?hebrewWordMatches(parts,witness[index],record):greekWordMatches(parts,record,dataset.id))) {
      return reject('original position, spelling, morphology or identity differs');
    }
  }
  const sourcePositions=new Map(words.flatMap((parts,index)=>parts.map(part=>[part.id,index])));
  const targetIds=new Set(targetRows.map(row=>row[0]));
  const incomplete=new Set(), blockedSpans=new Set(), candidates=[];
  const edges=new Set();
  for (const row of links) {
    if (!Array.isArray(row.source) || !Array.isArray(row.target)) return reject('missing explicit position edges',true);
    const englishIds=row.target.map(id=>dataset.id==='BGNT'&&/^\d{11}1$/.test(id)?id.slice(0,-1):id);
    if (row.source.some(id=>!sourcePositions.has(id)) || englishIds.some(id=>!targetIds.has(id))) return reject('unresolvable explicit position edges',true);
    if (!row.source.length || !englishIds.length) continue;
    if (new Set(row.source).size!==row.source.length || new Set(englishIds).size!==englishIds.length) return reject('duplicate explicit position within a group',true);
    const indices=[...new Set(row.source.map(id=>sourcePositions.get(id)))].sort((a,b)=>a-b);
    const span=englishIds.map(id=>target.offsets.get(id));
    const sourceParts=new Set(row.source);
    for (const native of row.source) for (const english of englishIds) {
      const key=native+':'+english;
      if (edges.has(key)) return reject('duplicate explicit link',true);
      edges.add(key);
    }
    if (span.some(entry=>!entry) || indices.some(index=>words[index].some(part=>!sourceParts.has(part.id)))) {
      for (const index of indices) incomplete.add(index);
      for (const entry of span) if (entry) blockedSpans.add(entry[0]);
      continue;
    }
    candidates.push([span,indices]);
  }
  let changed=true;
  while (changed) {
    changed=false;
    for (const [spans,indices] of candidates) {
      if (!indices.some(index=>incomplete.has(index)) && !spans.some(([start])=>blockedSpans.has(start))) continue;
      for (const index of indices) if (!incomplete.has(index)) { incomplete.add(index); changed=true; }
      for (const [start] of spans) if (!blockedSpans.has(start)) { blockedSpans.add(start); changed=true; }
    }
  }
  const groups=candidates.filter(([,indices])=>indices.every(index=>!incomplete.has(index)));
  return groups.length?{text:target.text,groups,incompleteWords:incomplete.size}:reject('no complete original word groups');
}

module.exports={loadPackage,targetVerse,validatePackageVerse};
