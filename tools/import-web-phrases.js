'use strict';

const fs = require('node:fs');
const path = require('node:path');
const {createHash}=require('node:crypto');
const canon=require('../js/bible/canon');
const alignment=require('../js/word-study/alignment');
const {loadBibleLibrary,READER_TOKEN_PATTERN,normalizeDictionaryTerm}=require('./audit-word-study-coverage');
const {loadSource,readOriginal,readAlignment,validateVerse,manuscriptMatches,provider,books}=require('./import-web-alignment');
const {load:loadBerean,validate:validateBerean}=require('./word-study-berean');
const {lexicalCandidates,validatePhrases}=require('./web-phrase-consensus');
const pins=require('./web-alignment-sources.json');
const baselineReport=require('../docs/shell-78-web-alignment-report.json');
const priority=require('../data/word-study/web-common-words.json').entries;
const sha=value=>createHash('sha256').update(value).digest('hex');
const empty=()=>({screened:0,accepted:0,rejected:0,ambiguous:0,missing:0,prior:0,wordsBefore:0,priorityWordsBefore:0,words:0,groups:0,priorityWords:0});

async function generate({ult,uhb,ugnt,berean,baseline,output}) {
  if (output && fs.existsSync(output)) throw new Error('Output directory must be fresh');
  const originalLookup=provider();
  const source=loadSource(ult,require('./web-alignment-v92-source.json'));
  const originals=[loadSource(uhb,pins[1]),loadSource(ugnt,pins[2])];
  const bsb=loadBerean(berean);
  const published=new Map();
  for (const [file,pin] of Object.entries(baselineReport.files)) {
    const content=fs.readFileSync(path.join(baseline,file));
    if (sha(content)!==pin.sha256) throw new Error('Shell 78 baseline checksum mismatch: '+file);
    published.set(file,JSON.parse(content));
  }
  const web=loadBibleLibrary('web.js','webLibrary');
  const report={totals:empty(),books:{},reasons:{},methods:{wordOverlap:0,ultOnly:0,bereanOnly:0,dual:0},
    forms:Object.fromEntries(Object.keys(priority).map(form=>[form,{before:0,added:0,webOccurrences:0,ultOnly:0,bereanOnly:0}])),files:{}};
  const index={};
  if (output) fs.mkdirSync(output);
  for (const [bookIndex,bookId] of canon.order('web').entries()) {
    const code=books[bookIndex],ultBook=source.get(code),bsbBook=bsb.get(bookId);
    const originalBook=originals[bookIndex<39?0:1].get(code);
    const book=web[bookId], totals=report.books[bookId]=empty();
    for (let chapter=1;chapter<=book.chapters;chapter++) {
      const file=bookId+'/'+chapter+'.json';
      const rows=published.get(file)||{};
      for (const [offset,verseText] of book[chapter].verses.entries()) {
        if (!verseText.trim()) continue;
        const verse=offset+1,ref=chapter+':'+verse;
        const context={translationId:'web',bookId,chapter,verse,verseText};
        for (const match of verseText.matchAll(READER_TOKEN_PATTERN)) {
          const form=normalizeDictionaryTerm(match[0]);
          if (Object.hasOwn(report.forms,form)) report.forms[form].webOccurrences++;
        }
        const current=alignment.hasReviewedVerse(context)?(await originalLookup.lookupVerse(context)).records:null;
        const inline=current&&alignment.lookup(context,current);
        const existing=inline?.status==='available'?
          inline.groups.map(group=>[group.english.map(span=>[span.start,span.end]),group.original]):rows[verse]?.[2];
        if (existing) {
          totals.prior++;
          const counted=countTerms(verseText,existing,report.forms,'before');
          totals.wordsBefore+=counted.words;
          totals.priorityWordsBefore+=counted.priority;
          continue;
        }
        if (!ultBook?.has(ref) || !bsbBook?.has(ref) || !originalBook?.has(ref)) {
          totals.missing++;
          continue;
        }
        const tagged=ultBook.get(ref),table=bsbBook.get(ref),original=originalBook.get(ref);
        totals.screened++;
        if (!tagged || !table || !original) {
          totals.ambiguous++;
          const code='duplicate or empty source reference';
          report.reasons[code]=(report.reasons[code]||0)+1;
          continue;
        }
        const parsed=readAlignment(tagged);
        let outcome;
        if (parsed.reason) outcome={code:'ULT '+parsed.reason,ambiguous:parsed.ambiguous};
        else if (!lexicalCandidates(parsed.english,table.english,verseText)) outcome={code:'no shared English word'};
        else {
          report.methods.wordOverlap++;
          const records=current||(await originalLookup.lookupVerse(context)).records;
          if (records.some(record=>record.bookId!==bookId||record.chapter!==chapter||record.verse!==verse)) {
            outcome={code:'remapped original reference'};
          } else {
            const native=readOriginal(original);
            const first=validateVerse(parsed.english,tagged,native,records);
            const second=validateBerean(table,native,records,manuscriptMatches);
            const left={text:parsed.english,groups:first.alignments},right={text:table.english,groups:second.groups};
            const controls=[['ultOnly',first,left],['bereanOnly',second,right]];
            for (const [key,validation,input] of controls) {
              if (validation.reason) continue;
              const trial=validatePhrases(verseText,input,input);
              if (!trial.groups) continue;
              report.methods[key]++;
              countTerms(verseText,trial.groups,report.forms,key);
            }
            if (first.reason || second.reason) {
              const failure=first.reason?first:second;
              outcome={code:(first.reason?'ULT ':'')+failure.reason,ambiguous:failure.ambiguous};
            } else {
              outcome=validatePhrases(verseText,left,right);
              if (outcome.groups) {
                report.methods.dual++;
                rows[verse]=[verseText,records.map(record=>[record.surface,record.strongsNumber,record.morphology,record.language]),outcome.groups,'dual-phrase'];
              }
            }
          }
        }
        if (!outcome.groups) {
          totals[outcome.ambiguous?'ambiguous':'rejected']++;
          report.reasons[outcome.code]=(report.reasons[outcome.code]||0)+1;
          continue;
        }
        totals.accepted++;
        totals.groups+=outcome.components;
        const counted=countTerms(verseText,outcome.groups,report.forms,'added');
        totals.words+=counted.words;
        totals.priorityWords+=counted.priority;
      }
      if (!Object.keys(rows).length) continue;
      (index[bookId]||=[]).push(chapter);
      write(file,rows,output,report.files);
    }
    for (const field of Object.keys(totals)) report.totals[field]+=totals[field];
  }
  write('index.json',index,output,report.files);
  return report;
}

function countTerms(text,groups,forms,field) {
  const spans=groups.flatMap(group=>group[0]);
  let words=0,priority=0;
  for (const match of text.matchAll(READER_TOKEN_PATTERN)) {
    if (!spans.some(([start,end])=>match.index<end && match.index+match[0].length>start)) continue;
    words++;
    const form=normalizeDictionaryTerm(match[0]);
    if (!Object.hasOwn(forms,form)) continue;
    forms[form][field]++;
    priority++;
  }
  return {words,priority};
}

function write(relative,rows,output,files) {
  const data=JSON.stringify(rows)+'\n';
  files[relative]={sha256:sha(data),bytes:Buffer.byteLength(data)};
  if (!output) return;
  const file=path.join(output,relative);
  fs.mkdirSync(path.dirname(file),{recursive:true});
  fs.writeFileSync(file,data);
}

if (require.main===module) {
  const [ult,uhb,ugnt,berean,baseline,report,output]=process.argv.slice(2);
  if (!report) throw new Error('Usage: node tools/import-web-phrases.js <ULT-v92> <UHB> <UGNT> <Berean-TSV> <Shell-78-output> <report.json> [fresh-output]');
  generate({ult,uhb,ugnt,berean,baseline,output}).then(results=>fs.writeFileSync(report,JSON.stringify(results,null,2)+'\n'))
    .catch(error=>{console.error(error);process.exitCode=1;});
}

module.exports={generate};
