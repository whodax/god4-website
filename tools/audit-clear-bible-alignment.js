'use strict';

const fs=require('node:fs');
const path=require('node:path');
const {createHash}=require('node:crypto');
const {gzipSync}=require('node:zlib');
const canon=require('../js/bible/canon');
const alignment=require('../js/word-study/alignment');
const {loadBibleLibrary,TRANSLATIONS,READER_TOKEN_PATTERN,normalizeDictionaryTerm}=require('./audit-word-study-coverage');
const {loadSource,readOriginal,readAlignment,validateVerse,projection,projectGroups,provider,books,manuscriptMatches}=require('./import-web-alignment');
const {loadPackage,validatePackageVerse,targetVerse}=require('./clear-bible-alignment');
const {load:loadBerean,validate:validateBerean}=require('./word-study-berean');
const {validatePhrases}=require('./web-phrase-consensus');
const clearPins=require('./clear-bible-shell80-sources.json');
const baselinePins=require('../docs/shell-79-web-alignment-report.json');
const witnessPins=require('./web-alignment-sources.json');
const unresolved="don't,says,didn't,spoke,brothers,around,doesn't,comes,tent,listen,today,king's,everyone,won't,does,philistines,whoever,show,can't,inhabitants,let's,loving,families,news,moab,isn't,whatever".split(',');
const ids=canon.order('web');
const normalization=text=>text.trim().replace(/\s+/g,' ').replace(/[\u201c\u201d]/g,'"').replace(/[\u2018\u2019]/g,"'");
const wordCount=text=>[...text.matchAll(READER_TOKEN_PATTERN)].length;
const bump=(counts,key)=>{counts[key]=(counts[key]||0)+1;};
const count=()=>({verses:0,occurrences:0,groups:0,newVerses:0,newOccurrences:0});
const modeNames=['exactOrSentence','clearOnlyPhrase','clearAndUlt','threeWay'];

function getBaseline(directory) {
  const byFile=new Map();
  for (const [relative,pin] of Object.entries(baselinePins.files)) {
    const data=fs.readFileSync(path.join(directory,relative));
    if(createHash('sha256').update(data).digest('hex')!==pin.sha256) throw new Error('Shell 79 baseline checksum mismatch: '+relative);
    byFile.set(relative,JSON.parse(data));
  }
  return byFile;
}

function recordResult(report,name,book,verseText,groups,existing) {
  if (!groups?.length) return;
  const counts=report.methods[name], scope=report.books[book].methods[name];
  const spans=new Set(groups.flatMap(group=>group[0].map(span=>span.join(':'))));
  for (const item of [counts,scope]) {
    item.verses++;
    item.occurrences+=spans.size;
    item.groups+=groups.length;
    if (!existing) {
      item.newVerses++;
      item.newOccurrences+=spans.size;
    }
  }
  for (const span of spans) {
    const [start,end]=span.split(':').map(Number);
    const term=normalizeDictionaryTerm(verseText.slice(start,end));
    if (Object.hasOwn(report.priority,term)) report.priority[term][name]++;
  }
}

function keys(groups) {
  return new Set(groups.map(([spans,positions])=>JSON.stringify([
    spans.slice().sort((a,b)=>a[0]-b[0]),positions.slice().sort((a,b)=>a-b)
  ])));
}

function compareHeldout(report,bookId,chapter,verse,prior,projected) {
  if (prior?.[3]!=='dual-phrase' || !projected?.length) return;
  const compare=keys(projected);
  const overlap=new Set(projected.flatMap(group=>group[0].map(span=>span.join(':'))));
  for (const group of prior[2]) {
    const agreement=compare.has([...keys([group])][0])?'exactGroup':
      group[0].some(span=>overlap.has(span.join(':')))?'overlapDifferentGroup':'noCoverage';
    bump(report.heldout,agreement);
    const samples=report.samples.heldout;
    if (samples.filter(item=>item.agreement===agreement).length<4) {
      samples.push({bookId,chapter,verse,agreement,previous:group,clear:projected});
    }
  }
}

async function audit(id,directory,ultDir,uhb,ugnt,bereanInput,baselineDirectory,candidateOutput) {
  const dataset=loadPackage(directory,id,clearPins.sha256);
  const hebrew=dataset.hebrew;
  const source=loadSource(hebrew?uhb:ugnt,witnessPins[hebrew?1:2]);
  const ult=loadSource(ultDir,require('./web-alignment-v92-source.json'));
  const berean=loadBerean(bereanInput);
  const baseline=getBaseline(baselineDirectory);
  const original=provider();
  const versions=Object.fromEntries(TRANSLATIONS.map(({id,file,variable})=>[id,loadBibleLibrary(file,variable)]));
  versions.dra=loadBibleLibrary('dra.js','draLibrary');
  const report={id,creator:dataset.creator,schemes:dataset.schemes,rawRecords:dataset.records,
    rawVerses:dataset.alignments.size,rawBooks:{},matchedReferences:0,validated:0,rejected:0,ambiguous:0,reasons:{},
    groupScreen:{available:0,rejected:0,ambiguous:0,missingReference:0},
    targetAgreement:{sameReference:0,exact:0},
    compatibility:Object.fromEntries(Object.keys(versions).map(version=>[version,{exactVerses:0,exactWords:0,sentenceVerses:0}])),
    methods:Object.fromEntries(modeNames.map(name=>[name,count()])),books:{},
    priority:Object.fromEntries(unresolved.map(form=>[form,Object.fromEntries(modeNames.map(mode=>[mode,0]))])),
    heldout:{}, samples:{heldout:[],priority:[],threeWay:[]},dualCandidateSize:{bytes:0,gzipBytes:0,chapters:0}};
  const chapterRows=new Map();
  for (const [ref,rawGroups] of dataset.alignments) {
    const bookId=ids[Number(ref.slice(0,2))-1], chapter=Number(ref.slice(2,5)),verse=Number(ref.slice(5));
    if (!bookId) throw new Error('Unrecognized book ID '+ref);
    bump(report.rawBooks,bookId);
    const book=report.books[bookId]||={validated:0,rejected:0,ambiguous:0,methods:Object.fromEntries(modeNames.map(name=>[name,count()]))};
    const verseText=versions.web[bookId]?.[chapter]?.verses?.[verse-1];
    const targetRows=dataset.targets.get(ref);
    const target=targetRows&&targetVerse(targetRows,ref);
    const table=berean.get(bookId)?.get(chapter+':'+verse);
    if (target&&!target.reason) {
      if (table) {
        report.targetAgreement.sameReference++;
        if(normalization(target.text)===normalization(table.english)) report.targetAgreement.exact++;
      }
      for (const [version,library] of Object.entries(versions)) {
        const text=library[bookId]?.[chapter]?.verses?.[verse-1];
        if (!text?.trim()) continue;
        const mapping=projection(target.text,text);
        if (mapping.mode==='verse'||mapping.mode==='period') {
          report.compatibility[version].exactVerses++;
          report.compatibility[version].exactWords+=wordCount(text);
        } else if (mapping.mode==='sentence') report.compatibility[version].sentenceVerses++;
      }
    }
    const code=books[ids.indexOf(bookId)], label=chapter+':'+verse;
    const body=source.get(code)?.get(label);
    if (!verseText?.trim() || !body || !targetRows || !dataset.sources.has(ref)) {
      report.groupScreen.missingReference+=rawGroups.length;
      continue;
    }
    report.matchedReferences++;
    const context={translationId:'web',bookId,chapter,verse,verseText};
    const records=(await original.lookupVerse(context)).records;
    const witness=readOriginal(body);
    const evidence=records.some(record=>record.bookId!==bookId||record.chapter!==chapter||record.verse!==verse)?
      {reason:'remapped Reader original reference'}:validatePackageVerse(dataset,ref,witness,records);
    if (evidence.reason) {
      const category=evidence.ambiguous?'ambiguous':'rejected';
      book[category]++;
      report[category]++;
      report.groupScreen[category]+=rawGroups.length;
      bump(report.reasons,evidence.reason);
      continue;
    }
    book.validated++;
    report.validated++;
    report.groupScreen.available+=evidence.groups.length;
    report.groupScreen.rejected+=rawGroups.length-evidence.groups.length;
    const prior=baseline.get(bookId+'/'+chapter+'.json')?.[verse];
    const existing=Boolean(prior||alignment.lookup(context,records).status==='available');
    const mapping=projection(evidence.text,verseText);
    const projected=mapping.reason?null:projectGroups(evidence.text,verseText,evidence.groups,mapping).alignments;
    const clearOnly=validatePhrases(verseText,evidence,evidence).groups;
    recordResult(report,'exactOrSentence',bookId,verseText,projected,existing);
    recordResult(report,'clearOnlyPhrase',bookId,verseText,clearOnly,existing);
    compareHeldout(report,bookId,chapter,verse,prior,clearOnly);
    const tagged=ult.get(code)?.get(label);
    const parsed=tagged&&readAlignment(tagged);
    const verified=parsed&&!parsed.reason&&validateVerse(parsed.english,tagged,witness,records);
    const clearAndUlt=verified&&!verified.reason&&validatePhrases(verseText,{text:parsed.english,groups:verified.alignments},evidence).groups;
    recordResult(report,'clearAndUlt',bookId,verseText,clearAndUlt,existing);
    if (!clearAndUlt?.length) continue;
    const third=table&&validateBerean(table,witness,records,manuscriptMatches);
    const thirdLinks=third&&!third.reason?
      validatePhrases(verseText,{text:parsed.english,groups:verified.alignments},{text:table.english,groups:third.groups}).groups:null;
    const thirdKeys=thirdLinks&&keys(thirdLinks);
    const three=thirdKeys?clearAndUlt.filter(group=>thirdKeys.has([...keys([group])][0])):[];
    recordResult(report,'threeWay',bookId,verseText,three,existing);
    if (three.length&&report.samples.threeWay.length<6) report.samples.threeWay.push({bookId,chapter,verse,groups:three});
    if (existing || id==='BGNT') continue;
    const chapterKey=bookId+'/'+chapter;
    if (!chapterRows.has(chapterKey)) chapterRows.set(chapterKey,{});
    chapterRows.get(chapterKey)[verse]=[verseText,records.map(record=>[record.surface,record.strongsNumber,record.morphology,record.language]),clearAndUlt,id==='WLCM'?'clear-hebrew-dual':'clear-greek-dual'];
    const terms=clearAndUlt.flatMap(group=>group[0].map(([start,end])=>normalizeDictionaryTerm(verseText.slice(start,end))))
      .filter(term=>unresolved.includes(term));
    if (terms.length) report.samples.priority.push({bookId,chapter,verse,terms:[...new Set(terms)],groups:clearAndUlt});
  }
  for (const rows of chapterRows.values()) {
    const bytes=Buffer.from(JSON.stringify(rows)+'\n');
    report.dualCandidateSize.bytes+=bytes.length;
    report.dualCandidateSize.gzipBytes+=gzipSync(bytes).length;
  }
  report.dualCandidateSize.chapters=chapterRows.size;
  if (candidateOutput) fs.writeFileSync(candidateOutput,JSON.stringify(Object.fromEntries(chapterRows))+'\n');
  return report;
}

if (require.main===module) {
  const [id,directory,ult,uhb,ugnt,berean,baseline,output,candidates]=process.argv.slice(2);
  if (!['WLCM','SBLGNT','BGNT'].includes(id)||!output) throw new Error('Pass package ID, source directory, ULT, UHB, UGNT, Berean TSV, Shell 79 directory and report path');
  audit(id,directory,ult,uhb,ugnt,berean,baseline,candidates).then(report=>fs.writeFileSync(output,JSON.stringify(report,null,2)+'\n'))
    .catch(error=>{console.error(error);process.exitCode=1;});
}

module.exports={audit};
