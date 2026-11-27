'use strict';

const fs=require('node:fs');
const {execFileSync}=require('node:child_process');
const {createHash}=require('node:crypto');
const canon=require('../js/bible/canon');
const {loadBibleLibrary,READER_TOKEN_PATTERN,normalizeDictionaryTerm}=require('./audit-word-study-coverage');
const {readTaggedVerse,validateVerse,checksum,revision,osisCodes}=require('./import-crosswire-kjv-alignment');
const {provider}=require('./import-web-alignment');
const prior=require('../docs/shell-76-crosswire-import.json');
const priority=require('../data/word-study/web-common-words.json').entries;
const baseline='13d94205e959d332645ba7f4cb2a4b7d3da9ea2a';
const trRevision='33af6e9361f8db0afd353714d05c75f44e5555b9';
const trFiles='MT MR LU JOH AC RO 1CO 2CO GA EPH PHP COL 1TH 2TH 1TI 2TI TIT PHM HEB JAS 1PE 2PE 1JO 2JO 3JO JUDE RE'.split(' ');
const trLetters=Object.fromEntries(Array.from('abgdezhqiklmncoprstufxywv',(char,index)=>
  [char,'αβγδεζηθικλμνξοπρστυφχψως'[index]]));

const sha=bytes=>createHash('sha256').update(bytes).digest('hex');
const words=text=>[...text.matchAll(READER_TOKEN_PATTERN)];
const bump=(object,key)=>{object[key]=(object[key]||0)+1;};
const typography=text=>text.replace(/[\u2018\u2019]/g,"'").replace(/[\u201c\u201d]/g,'"').replace(/\s+/g,' ').trim();

function tokenFrames(text) {
  const tokens=words(text);
  const frames=tokens.map((token,index)=>{
    const end=token.index+token[0].length;
    return [token.index,end,typography(token[0]),typography(text.slice(index?tokens[index-1].index+tokens[index-1][0].length:0,token.index))];
  });
  return {frames,trailing:typography(text.slice(frames.at(-1)?.[1]||0))};
}

function projectExactTypography(source,text,groups) {
  if (!Array.isArray(groups)||typography(source)!==typography(text)) return null;
  const left=tokenFrames(source),right=tokenFrames(text);
  if (left.trailing!==right.trailing || left.frames.length!==right.frames.length ||
    left.frames.some((row,i)=>row[2]!==right.frames[i][2]||row[3]!==right.frames[i][3])) return null;
  const projected=[];
  for (const [spans,positions] of groups) {
    const next=[];
    for (const [start,end] of spans) {
      const indexes=[];
      for (const [index,[leftStart,leftEnd]] of left.frames.entries()) {
        if(leftStart>=end||leftEnd<=start) continue;
        if(leftStart<start||leftEnd>end) return null;
        indexes.push(index);
      }
      if(!indexes.length) return null;
      next.push([right.frames[indexes[0]][0],right.frames[indexes.at(-1)][1]]);
    }
    projected.push([next,positions]);
  }
  return projected;
}

function assess(text,body,records) {
  const strict=validateVerse(text,body,records);
  if (!strict.reason) return {state:'baseline',strict};
  const parsed=readTaggedVerse(body);
  if (parsed.reason) return {state:'markup',strict};
  // The original importer still validates all source positions, forms, morphology and span ownership.
  const native=validateVerse(parsed.text,body,records);
  if (native.reason) return {state:native.ambiguous?'ambiguous':'original-evidence-mismatch',strict,native};
  if (typography(parsed.text)===typography(text)) {
    const groups=projectExactTypography(parsed.text,text,native.alignments);
    if (groups) return {state:'typography-only',strict,groups};
  }
  if (JSON.stringify(words(parsed.text).map(row=>row[0]))===JSON.stringify(words(text).map(row=>row[0]))) {
    return {state:'punctuation-or-supplied-boundaries',strict};
  }
  return {state:'english-wording',strict};
}

function hebrewEvidence(body,records) {
  const tagged=[...body.matchAll(/<w\b([^>]+)>/g)];
  const sourcePositions=tagged.some(([,attrs])=>/\bsrc="/.test(attrs));
  const counts=new Map();
  for (const record of records) counts.set(record.strongsNumber,(counts.get(record.strongsNumber)||0)+1);
  let unique=0,repeated=0,absent=0;
  for (const [,attrs] of tagged) {
    for (const [,id] of attrs.matchAll(/(?:lemma="|\s)strong:H0*(\d+)/g)) {
      const n=counts.get('H'+Number(id))||0;
      if(n===1) unique++;
      else if(n>1) repeated++;
      else absent++;
    }
  }
  return {sourcePositions,unique,repeated,absent};
}

function loadXml(input) {
  const bytes=fs.readFileSync(input);
  if (sha(bytes)!==checksum) throw new Error('CrossWire KJV OSIS checksum mismatch');
  const verses=new Map();
  for (const [,ref,body] of bytes.toString('utf8').matchAll(/<verse\b[^>]*\bosisID="([^"]+)"[^>]*\bsID="[^"]+"[^>]*\/>([\s\S]*?)<verse\b[^>]*\beID="\1"[^>]*\/>/g)) {
    if(verses.has(ref)) throw new Error('Duplicate pinned CrossWire reference '+ref);
    verses.set(ref,body);
  }
  if(verses.size!==31102) throw new Error('Unexpected pinned CrossWire inventory');
  return verses;
}

function readTr(text,bookId) {
  const verses=new Map(), issues={};
  const matches=[...text.matchAll(/^(\d+):(\d+) ([^\r\n]*(?:\r?\n[ \t][^\r\n]*)*)/gm)];
  for(const [,chapter,verse,body] of matches){
    const label=chapter+':'+verse;
    if(verses.has(label)) throw new Error('Duplicate TR coordinate '+bookId+':'+label);
    const wordPattern=/([a-z]+)\s+(\d+)(?:\s+\d+)?\s+\{([A-Z][A-Z0-9-]+)\}/g;
    const tokens=[...body.matchAll(wordPattern)];
    if(!tokens.length||body.replace(wordPattern,'').replace(/\|/g,'').trim()){
      bump(issues,'unsupported TR markup');continue;
    }
    const records=tokens.map(([,surface,strong,morphology],tokenIndex)=>({
      status:'authoritative',language:'greek',bookId,chapter:Number(chapter),verse:Number(verse),tokenIndex,
      surface:[...surface].map(char=>trLetters[char]).join(''),strongsNumber:'G'+Number(strong),morphology
    }));
    if(records.some((row,index)=>row.surface.length!==tokens[index][1].length)){
      bump(issues,'unsupported TR surface');continue;
    }
    verses.set(label,records);
  }
  return {verses,issues};
}

async function run(input,trRepository) {
  const osis=loadXml(input), bible=loadBibleLibrary('kjv.js','kjvLibrary'),original=provider();
  const trSummary=trRepository?{revision:trRevision,files:{},findings:{},byBook:{},words:0,priorityWords:0}:null;
  const report={version:1,baseline,source:{revision,checksum},trExperiment:trSummary,nt:{verses:0,strictReasons:{},findings:{},originalFindings:{},
    typographyOccurrences:0,priorityOccurrences:0,examples:{}},ot:{verses:0,versesWithNativePositions:0,versesWithoutWitness:0,
    strongTagLeadsUnique:0,strongTagLeadsRepeated:0,strongTagLeadsAbsent:0},books:{},publishedAdditions:0};
  for (const [bookNumber,bookId] of canon.order('kjv').entries()) {
    const book=bible[bookId],ot=bookNumber<39;
    const counts=report.books[bookId]={verses:0,findings:{},typographyOccurrences:0,priorityOccurrences:0,
      strongTagLeadsUnique:0,strongTagLeadsRepeated:0,strongTagLeadsAbsent:0};
    let tr=null;
    if(!ot&&trRepository){
      const file='parsed/'+trFiles[bookNumber-39]+'.UTR';
      const bytes=execFileSync('git',['-C',trRepository,'show',trRevision+':'+file]);
      tr=readTr(bytes.toString('utf8'),bookId);
      trSummary.files[file]={sha256:sha(bytes),parsedVerses:tr.verses.size,issues:tr.issues};
      trSummary.byBook[bookId]={};
    }
    for(let chapter=1;chapter<=book.chapters;chapter++) {
      for(const [index,text] of book[chapter].verses.entries()) {
        const verse=index+1,ref=osisCodes[bookNumber]+'.'+chapter+'.'+verse;
        const body=osis.get(ref);
        if(body===undefined) throw new Error('Missing pinned CrossWire location '+ref);
        const {records}=await original.lookupVerse({translationId:'kjv',bookId,chapter,verse,verseText:text});
        counts.verses++;
        if(ot) {
          report.ot.verses++;
          if(!records.length) report.ot.versesWithoutWitness++;
          const leads=hebrewEvidence(body,records);
          if(leads.sourcePositions) report.ot.versesWithNativePositions++;
          for(const [key,n] of Object.entries({strongTagLeadsUnique:leads.unique,strongTagLeadsRepeated:leads.repeated,strongTagLeadsAbsent:leads.absent})) {
            counts[key]+=n;report.ot[key]+=n;
          }
          continue;
        }
        report.nt.verses++;
        if(records.some(record=>record.bookId!==bookId||record.chapter!==chapter||record.verse!==verse)) {
          throw new Error('Unexpected KJV original reference '+ref);
        }
        const result=assess(text,body,records);
        for(const row of [counts.findings,report.nt.findings]) bump(row,result.state);
        if(result.strict.reason) bump(report.nt.strictReasons,result.strict.reason);
        if(result.native?.reason) bump(report.nt.originalFindings,result.native.reason);
        if(result.state!=='baseline') {
          const examples=report.nt.examples[result.state]||=[];
          if(examples.length<3) examples.push(ref);
        }
        if(tr&&result.strict.reason){
          const witness=tr.verses.get(chapter+':'+verse);
          const fit=witness&&validateVerse(text,body,witness);
          const state=fit?.reason||(!fit?'TR reference missing':'fully position-compatible with TR');
          for(const target of [trSummary.findings,trSummary.byBook[bookId]]) bump(target,state);
          if(fit?.alignments){
            for(const word of words(text)){
              if(!fit.alignments.some(([spans])=>spans.some(([start,end])=>word.index>=start&&word.index+word[0].length<=end))) continue;
              trSummary.words++;
              if(Object.hasOwn(priority,normalizeDictionaryTerm(word[0]))) trSummary.priorityWords++;
            }
          }
        }
        if(!result.groups) continue;
        for(const word of words(text)) {
          if(!result.groups.some(([spans])=>spans.some(([start,end])=>word.index>=start&&word.index+word[0].length<=end))) continue;
          for(const row of [counts,report.nt]) {
            row.typographyOccurrences++;
            if(Object.hasOwn(priority,normalizeDictionaryTerm(word[0]))) row.priorityOccurrences++;
          }
        }
      }
    }
  }
  if (report.nt.findings.baseline!==5933 || report.ot.verses!==23145 ||
    Object.keys({...prior.reasons,...report.nt.strictReasons}).some(key=>prior.reasons[key]!==report.nt.strictReasons[key])) {
    throw new Error('Strict Shell 76 result drifted');
  }
  return report;
}

if(require.main===module) {
  const [input,out,trRepository]=process.argv.slice(2);
  if(!out) throw new Error('Expected pinned KJV OSIS input and report path');
  run(input,trRepository).then(report=>fs.writeFileSync(out,JSON.stringify(report,null,2)+'\n'))
    .catch(error=>{console.error(error);process.exitCode=1;});
}

module.exports={assess,hebrewEvidence,projectExactTypography,readTr,run};
