'use strict';

const fs=require('node:fs');
const path=require('node:path');
const {createHash}=require('node:crypto');
const {gzipSync}=require('node:zlib');
const {loadBibleLibrary,TRANSLATIONS,READER_TOKEN_PATTERN,normalizeDictionaryTerm}=require('./audit-word-study-coverage');
const {provider}=require('./import-web-alignment');
const {address}=require('./scripture-crosswalk');
const {projectExactTypography}=require('./audit-kjv-expansion');
const {validatePhrases}=require('./web-phrase-consensus');
const inline=require('../js/word-study/alignment');
const primary=require('../docs/shell-76-crosswire-import.json');
const alternate=require('../docs/shell-82-kjv-tr-publication.json');
const web=require('../docs/shell-80-web-alignment-report.json');
const audit=require('../docs/shell-82-edition-matrix.json');
const heldout=require('../docs/shell-81-web-review-v1.json').holdout;
const priority=require('../data/word-study/web-common-words.json').entries;

const root=path.resolve(__dirname,'..');
const sha=bytes=>createHash('sha256').update(bytes).digest('hex');
const acceptedBaseline='cce89e56de5fe07b40207928128e3d735f41ef1d';
const protectedRefs=new Set(heldout.flatMap(row=>[row.passage.coordinate,...row.tokens.map(t=>[t.bookId,t.chapter,t.verse].join(':'))]));
const unresolved=Object.keys(alternate.remainingPriority).filter(form=>!alternate.remainingPriority[form]);
const tokenize=text=>[...text.matchAll(READER_TOKEN_PATTERN)];
const bump=(obj,key,n=1)=>{obj[key]=(obj[key]||0)+n;};

function sources(edition,pins){
  const rows=new Map();
  for(const [file,pin] of Object.entries(pins)){
    const raw=fs.readFileSync(path.join(root,'data/word-study/alignment',edition,file));
    if(sha(raw)!==pin.sha256) throw new Error('Input shard checksum mismatch '+edition+'/'+file);
    if(file==='index.json') continue;
    const parsed=JSON.parse(raw);
    const [bookId,chapterId]=file.slice(0,-5).split('/');
    const chapter=Number(chapterId);
    for(const [verseId,[text,tokens,groups,origin]] of Object.entries(parsed.verses||parsed)){
      const verse=Number(verseId);
      rows.set([bookId,chapter,verse].join(':'),{edition,bookId,chapter,verse,text,tokens,groups,origin:origin||edition});
    }
  }
  return rows;
}
const scoped=(text)=>typeof text==='string'&&text.trim()&&!/[[\]{}<>]/.test(text);

function sameWitness(row,records){
  return records.length===row.tokens.length&&records.length>0&&records.every((token,index)=>{
    const [surface,id,morphology,language='greek']=row.tokens[index];
    return token.status==='authoritative'&&token.bookId===row.bookId&&token.chapter===row.chapter&&token.verse===row.verse&&
      token.tokenIndex===index&&token.language===language&&token.surface===surface&&
      token.strongsNumber===id&&token.morphology===morphology;
  });
}

function validGroups(text,groups,originalCount){
  const words=tokenize(text);
  return groups.length>0&&groups.every(([spans,indices])=>spans.length&&indices.length&&
    new Set(indices).size===indices.length&&indices.every(i=>Number.isInteger(i)&&i>=0&&i<originalCount)&&
    spans.every(([start,end])=>Number.isInteger(start)&&Number.isInteger(end)&&start>=0&&start<end&&end<=text.length&&
      words.some(word=>start<=word.index&&end>=word.index+word[0].length)&&
      words.every(word=>word.index>=end||word.index+word[0].length<=start||
        (word.index>=start&&word.index+word[0].length<=end))));
}

function unitGroups(row){
  const words=tokenize(row.text);
  return row.groups.map(([spans,ids])=>[
    words.filter(word=>spans.some(([start,end])=>word.index>=start&&word.index+word[0].length<=end))
      .map(word=>[word.index,word.index+word[0].length]),ids]);
}

function choose(text,rows){
  if(!scoped(text)) return null;
  const candidates=rows.filter(row=>scoped(row.text)&&validGroups(row.text,row.groups,row.tokens.length));
  for(const row of candidates){
    if(row.text===text) return {row,mode:'exact',groups:row.groups};
    const groups=projectExactTypography(row.text,text,row.groups);
    if(groups) return {row,mode:'typography',groups};
  }
  const kjv=candidates.find(row=>row.edition==='kjv'), web=candidates.find(row=>row.edition==='web');
  if(kjv&&web&&kjv.text!==web.text){
    const result=validatePhrases(text,{text:kjv.text,groups:unitGroups(kjv)},{text:web.text,groups:unitGroups(web)});
    if(result.groups?.length) return {row:kjv,mode:'independent-phrase',groups:result.groups};
  }
  return null;
}
const empty=()=>({verses:0,words:0,modes:{},sources:{},newPriorityOccurrences:0,excluded:{},books:{}});

async function generate(output){
  if(fs.existsSync(output)) throw new Error('Output directory must be fresh');
  const standard=sources('kjv',primary.files), tr=sources('kjv-tr',alternate.files), webRows=sources('web',web.files);
  const coordinates=new Set([...standard.keys(),...webRows.keys()]);
  const lookup=provider(), chapters={}, index={}, files={};
  const report={version:1,baseline:acceptedBaseline,initialCandidates:0,initialBreakdown:{},published:{},newPriority:{},
    protectedEvaluation:33,files};
  for(const edition of TRANSLATIONS.concat({id:'dra',file:'dra.js',variable:'draLibrary'})){
    const {id,file,variable}=edition, bible=loadBibleLibrary(file,variable);
    const counts=report.published[id]=empty();
    const originalScreen=report.initialBreakdown[id]={audited:0,accepted:0,rejected:{}};
    for(const key of coordinates){
      const fromKjv=standard.get(key), fromWeb=webRows.get(key);
      const {bookId,chapter,verse}=fromKjv||fromWeb;
      const text=bible[bookId]?.[chapter]?.verses?.[verse-1];
      if(!text||!address('reader-'+id,key)) continue;
      const context={translationId:id,bookId,chapter,verse,verseText:text};
      const {records}=await lookup.lookupVerse(context);
      const exactInitial=id!=='kjv'&&fromKjv?.text===text&&sameWitness(fromKjv,records);
      if(exactInitial){originalScreen.audited++;report.initialCandidates++;}
      let exclusion;
      if(protectedRefs.has(key)||records.some(token=>protectedRefs.has([token.bookId,token.chapter,token.verse].join(':'))))
        exclusion='held-out evaluation';
      else if((id==='kjv'&&(fromKjv||tr.has(key)))||(id==='web'&&fromWeb)||inline.lookup(context,records).status==='available')
        exclusion='existing verified verse';
      else if(id==='kjv'&&records[0]?.source?.startsWith('Textus Receptus,')) exclusion='KJV variant override';
      else if(!scoped(text)) exclusion='uncertain supplied or editorial markup';
      const evidence=[fromKjv,fromWeb].filter(row=>row&&row.edition!==id&&sameWitness(row,records));
      const result=!exclusion&&choose(text,evidence);
      if(!result||!validGroups(text,result.groups,records.length)){
        const reason=exclusion||'no confirmed complete or independent local group';
        bump(counts.excluded,reason);
        if(exactInitial) bump(originalScreen.rejected,reason);
        continue;
      }
      if(exactInitial) originalScreen.accepted++;
      const {row,mode,groups}=result;
      const chapterKey=bookId+'/'+chapter;
      const chapterRows=chapters[chapterKey]||={};
      (chapterRows[id]||={})[verse]=mode==='exact'?[row.edition,mode]:[row.edition,mode,text,groups];
      const editionIndex=index[id]||={};
      (editionIndex[bookId]||={})[chapter]??=[];
      editionIndex[bookId][chapter].push(verse);
      const book=counts.books[bookId]||={verses:0,words:0};
      counts.verses++;book.verses++;
      bump(counts.modes,mode);bump(counts.sources,row.origin);
      for(const word of tokenize(text)){
        if(!groups.some(([spans])=>spans.some(([start,end])=>word.index>=start&&word.index+word[0].length<=end))) continue;
        counts.words++;book.words++;
        const form=normalizeDictionaryTerm(word[0]);
        if(Object.hasOwn(priority,form)) counts.newPriorityOccurrences++;
        if(unresolved.includes(form)) bump(report.newPriority,form);
      }
    }
    if(id!=='kjv'&&originalScreen.audited!==audit.editions[id]['byzantine-or-explicit-override'].exactNativeAtReaderReference)
      throw new Error('Shell 82 candidate count changed for '+id);
  }
  if(report.initialCandidates!==2237) throw new Error('Unexpected Shell 82 total cohort');
  for(const edition of Object.values(index)) for(const book of Object.values(edition)) for(const rows of Object.values(book)) rows.sort((a,b)=>a-b);
  const write=(file,value)=>{
    const bytes=Buffer.from(JSON.stringify(value)+'\n');
    const target=path.join(output,file);
    fs.mkdirSync(path.dirname(target),{recursive:true});
    fs.writeFileSync(target,bytes);
    files[file]={sha256:sha(bytes),bytes:bytes.length,gzipBytes:gzipSync(bytes).length};
  };
  for(const [key,chapter] of Object.entries(chapters)) write(key+'.json',chapter);
  write('index.json',index);
  return report;
}

if(require.main===module){
  const [output,report]=process.argv.slice(2);
  if(!report) throw new Error('Expected a fresh output directory and report path');
  generate(output).then(value=>fs.writeFileSync(report,JSON.stringify(value,null,2)+'\n'))
    .catch(error=>{console.error(error);process.exitCode=1;});
}
module.exports={generate,choose,sameWitness,validGroups};
