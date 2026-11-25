'use strict';

const fs = require('node:fs');
const {createHash} = require('node:crypto');
const canon = require('../js/bible/canon');
const {READER_TOKEN_PATTERN} = require('./audit-word-study-coverage');
const checksum = 'aa2a9a0f004d015738cd1839c7c56c3be2549e0d4f4537090c2017268c223c60';
const bookNames = new Map(canon.order('web').map(id=>[canon.book(id).name,id]));
bookNames.set('Psalm','psalms');
const reject = (reason,ambiguous=false) => ({reason,ambiguous});

function load(file) {
  const raw = fs.readFileSync(file);
  if (createHash('sha256').update(raw).digest('hex') !== checksum) throw new Error('Berean TSV checksum mismatch');
  const books = new Map();
  let verse;
  for (const line of raw.toString('utf8').split(/\r?\n/).slice(1)) {
    const [hebrewSort,greekSort,englishSort,,language,form,, ,morph,,hebrewId,greekId,reference,
      ,,,,opening,english,punctuation,closing] = line.split('\t');
    if (reference) {
      const match = reference.match(/^(.+) (\d+:\d+)$/);
      const book = bookNames.get(match?.[1]);
      if (!book) throw new Error('Unknown Berean reference '+reference);
      if (!books.has(book)) books.set(book,new Map());
      const bookVerses = books.get(book);
      if (bookVerses.has(match[2])) throw new Error('Duplicate Berean reference '+reference);
      verse = {english:'',rows:[]};
      bookVerses.set(match[2],verse);
    }
    if (!verse || !form && !english?.trim()) continue;
    const words = english?.trim();
    if (words && words !== '-') {
      if (verse.english) verse.english += ' ';
      verse.english += opening || '';
    }
    const start = verse.english.length;
    if (words && words !== '-') verse.english += words;
    const end = verse.english.length;
    if (end>start) verse.english += (punctuation || '') + (closing || '');
    verse.rows.push({order:Number(language==='Greek'?greekSort:hebrewSort),englishOrder:Number(englishSort),
      language:language.toLowerCase(),form,id:hebrewId || greekId,morph,words,start,end});
  }
  return books;
}

function form(text, language) {
  const folded = text.normalize('NFD');
  return language==='greek' ? folded.replace(/\p{Mark}|['’]/gu,'').toLowerCase().replace(/ς/g,'σ') :
    folded.replace(/[\u0591-\u05af\u05bd\u05be\u05c0\u05c3\u2060/]/g,'');
}

function morphology(source, record) {
  if (source.language==='greek') {
    const fixed = {Prep:'PREP',Conj:'CONJ',Adv:'ADV',Interj:'INJ'};
    if (Object.hasOwn(fixed,source.morph)) return fixed[source.morph]===record.morphology;
    const nominal = source.morph.match(/^(N|Art|Adj)-([NGDAV])([MFN])([SPD])$/);
    if (nominal) return ({N:'N',Art:'T',Adj:'A'}[nominal[1]]+'-'+nominal[2]+nominal[4]+nominal[3])===record.morphology;
    return /^V-[A-Z]{3}-[1-3][SP]$/.test(source.morph) && source.morph===record.morphology;
  }
  const language = source.language==='hebrew'?'H':'A';
  const fields = source.morph.split(' | ');
  const lexical = fields.pop();
  const affixCodes = {'Conj-w':'C','Art':'Td','Prep-b':'R','Prep-l':'R','Prep-k':'R','Prep-m':'R'};
  if (fields.some(field=>!Object.hasOwn(affixCodes,field))) return false;
  const prefix = language + fields.map(field=>affixCodes[field]+'/').join('');
  if (/^N-proper-[mf][sp]$/.test(lexical)) return prefix+'Np'===record.morphology;
  const noun = lexical.match(/^N-([mf])([spd])(c?)$/);
  if (noun) return new RegExp('^'+prefix+'N[c]'+noun[1]+noun[2]+(noun[3]||'[a]')+'$').test(record.morphology);
  return false;
}

function validate(verse, witness, records, manuscriptMatches) {
  if (verse.rows.some((row,index)=>index && row.englishOrder<=verse.rows[index-1].englishOrder)) return reject('ambiguous Berean English positions',true);
  const native = verse.rows.filter(row=>row.form).sort((a,b)=>a.order-b.order);
  if (!records?.length || native.length!==records.length || witness.length!==records.length) return reject('Berean witness token count differs');
  if (native.some((row,index)=>row.order<1 || (index && row.order<=native[index-1].order))) return reject('ambiguous Berean original positions',true);
  const groups = [];
  for (const [index,entry] of native.entries()) {
    const record = records[index];
    if (record.status!=='authoritative' || record.tokenIndex!==index || entry.language!==record.language ||
      !manuscriptMatches(witness[index],record,record.language) ||
      form(entry.form,entry.language)!==form(witness[index].form,entry.language) ||
      !/^\d+$/.test(entry.id) || (entry.language==='greek'?'G':'H')+Number(entry.id)!==record.strongsNumber) {
      return reject('Berean witness order, identity, surface or morphology differs');
    }
    if (entry.start===entry.end || /[\[\]{}<>]/.test(entry.words) || !morphology(entry,record)) continue;
    const spans = [...entry.words.matchAll(READER_TOKEN_PATTERN)].map(word=>[entry.start+word.index,entry.start+word.index+word[0].length]);
    if (spans.length) groups.push([spans,[index]]);
  }
  return groups.length ? {groups} : reject('Berean has no nonsupplied group with supported morphology');
}

module.exports = {load,validate};
