'use strict';

const fs=require('node:fs');
const path=require('node:path');
const vm=require('node:vm');
const {createHash}=require('node:crypto');
const {TRANSLATIONS,loadBibleLibrary,READER_TOKEN_PATTERN,normalizeDictionaryTerm}=require('./audit-word-study-coverage');
const {provider}=require('./import-web-alignment');
const canon=require('../js/bible/canon');
const root=path.resolve(__dirname,'..');
const repo=file=>path.join(root,file);
const read=file=>JSON.parse(fs.readFileSync(repo(file),'utf8'));
const editionList=TRANSLATIONS.concat({id:'dra',file:'dra.js',variable:'draLibrary'});
const priority=require('../data/word-study/web-common-words.json').entries;
const base='data/word-study/alignment/';
const baseline='99d5deb81ce7ddac555f61a5d0a8f87923e3988f';

function tokens(text){
  return [...text.matchAll(READER_TOKEN_PATTERN)].map(word=>({
    start:word.index,end:word.index+word[0].length,term:normalizeDictionaryTerm(word[0]),displayWord:word[0]
  }));
}
function counts(){return {verseSlots:0,verses:0,anyAlignedVerses:0,fullyAlignedVerses:0,eligibleWords:0,
  suppliedWords:0,verifiedWords:0,linkedContextDefinitions:0,sources:{}};}
function merge(total,chapter){
  for(const [key,value] of Object.entries(chapter)) if(typeof value==='number') total[key]+=value;
  for(const [key,n] of Object.entries(chapter.sources)) total.sources[key]=(total.sources[key]||0)+n;
}
function supplied(text,id){
  return id==='kjv'?[...text.matchAll(/\[[^\]]*\]/g)].map(word=>[word.index,word.index+word[0].length]):[];
}

function runtime(){
  const realm=vm.createContext({BibleCanon:canon,AbortController,setTimeout,clearTimeout,async fetch(file){
    const filename=repo(file.replace(/^\//,''));
    return {ok:fs.existsSync(filename),json:async()=>JSON.parse(fs.readFileSync(filename,'utf8'))};
  }});
  const code=fs.readFileSync(repo('js/word-study/alignment.js'),'utf8');
  // Collect coordinate gates from the actual production catalog without exporting them to the Reader.
  vm.runInContext(code.replace('lookup:createProvider(reviewedCatalog).lookup};',
    'catalog:reviewedCatalog,lookup:createProvider(reviewedCatalog).lookup};'),realm);
  return realm.WordStudyAlignment;
}

function dictionary(){
  const context=vm.createContext({async fetch(file){
    const filename=repo(file.replace(/^\//,''));
    return {ok:fs.existsSync(filename),json:async()=>JSON.parse(fs.readFileSync(filename,'utf8'))};
  }});
  for(const name of ['provider','local-provider','sense-selector','dictionary-provider']){
    vm.runInContext(fs.readFileSync(repo('js/word-study/'+name+'.js'),'utf8'),context);
  }
  return context.WordStudyProvider;
}
function countEnglish(text,id,summary){
  const excluded=supplied(text,id),words=tokens(text);
  const eligible=words.filter(word=>!excluded.some(([a,b])=>a<word.end&&b>word.start));
  summary.eligibleWords+=eligible.length;
  summary.suppliedWords+=words.length-eligible.length;
  return eligible;
}
function reportEthiopian(){
  const books={}, total=counts();
  for(const {id} of read('data/ethiopian-readings/books.json')){
    const metrics=counts(), sections={};
    for(const section of read('data/ethiopian-readings/'+id+'.json').sections){
      const summary=counts();
      summary.verseSlots=section.lines.length;
      for(const [,text] of section.lines) if(text.trim()){
        summary.verses++;
        countEnglish(text,'ethiopian',summary);
      }
      const label=section.id??Object.keys(sections).length+1;
      if(Object.hasOwn(sections,label)) throw Error('Duplicate Ethiopian section '+id+'/'+label);
      sections[label]=summary;
      merge(metrics,summary);
    }
    books[id]={...metrics,sections};
    merge(total,metrics);
  }
  return {...total,unit:'displayed lines, including prose entries',books};
}

async function run({includeCorpus=true,includeExtensions=true}={}){
  const engine=runtime(), lookup=provider(), definitions=dictionary();
  const key=({translationId,bookId,chapter,verse})=>[translationId,bookId,chapter,verse].join(':');
  const inline=new Set(engine.catalog.map(key));
  const indexes=Object.fromEntries(['web','kjv-tr','editions'].map(id=>[id,read(base+id+'/index.json')]));
  const scrivener=includeCorpus&&engine.lookupScrivenerWitness&&fs.existsSync(repo(base+'kjv-scrivener/index.json'))?read(base+'kjv-scrivener/index.json'):null;
  const corpus=includeCorpus&&engine.lookupCorpus&&fs.existsSync(repo(base+'corpus/index.json'))?read(base+'corpus/index.json'):null;
  const extensions=includeExtensions&&engine.lookupExtension&&fs.existsSync(repo(base+'extensions/index.json'))?read(base+'extensions/index.json'):null;
  const report={version:1,baseline:extensions?'748defc3fa1628dd79575ff3ca492a6a0836f8b0':baseline,coverageRule:'Aligned spans cover every eligible Reader word in a fully aligned verse. KJV supplied words counted separately.',
    editions:{},ethiopian:reportEthiopian(),priority:{},cohorts:{
      shell83:read('docs/shell-83-edition-publication.json').initialBreakdown,
      webReview:read('docs/shell-81-crosswalk-report.json').counts,
      kjvNT:read('docs/shell-83-kjv-residual.json').unchangedReasons}};
  for(const {id,file,variable} of editionList){
    const text=loadBibleLibrary(file,variable), result={...counts(),books:{}};
    const wordForms=Object.fromEntries(Object.keys(priority).map(form=>[form,{eligible:0,verified:0,linkedContext:0,definition:null}]));
    const examples=new Map();
    for(const book of canon.order(id)){
      const metrics=counts(),chapters={};
      for(const [label,data] of Object.entries(text[book]||{})){
        if(!Array.isArray(data?.verses)) continue;
        const chapter=Number(label),summary=counts();
        const primaryFile=base+'kjv/'+book+'/'+chapter+'.json';
        const primary= id==='kjv'&&fs.existsSync(repo(primaryFile))?read(primaryFile):{};
        summary.verseSlots=data.verses.length;
        for(const [i,verseText] of data.verses.entries()){
          if(!verseText?.trim()) continue;
          const verse=i+1, eligible=countEnglish(verseText,id,summary);
          const context={translationId:id,bookId:book,chapter,verse,verseText};
          summary.verses++;
          for(const word of eligible) if(Object.hasOwn(wordForms,word.term)){
            wordForms[word.term].eligible++;
            if(!examples.has(word.term)) examples.set(word.term,{...context,displayWord:word.displayWord,lookupTerm:word.displayWord});
          }
          if(!inline.has(key(context))&&!primary[verse]&&!(id==='web'&&indexes.web[book]?.includes(chapter))&&
            !(id==='kjv'&&indexes['kjv-tr'][book]?.[chapter]?.includes(verse))&&
            !indexes.editions[id]?.[book]?.[chapter]?.includes(verse)&&!corpus?.[id]?.[book]?.[chapter]?.includes(verse)&&
            !(id==='kjv'&&scrivener?.[book]?.[chapter]?.includes(verse))&&
            !extensions?.[id]?.[book]?.[chapter]?.includes(verse)) continue;
          let {records}=await lookup.lookupVerse(context);
          let resolved=engine.lookup(context,records);
          if(resolved?.status!=='available'&&id==='kjv'&&indexes['kjv-tr'][book]?.[chapter]?.includes(verse)){
            const alternate=await engine.lookupKjvWitness(context);
            if(alternate?.records){records=alternate.records;resolved=alternate.alignment;}
          }
          if(resolved?.status!=='available'&&(primary[verse]||id==='web'&&indexes.web[book]?.includes(chapter)))
            resolved=await engine.lookupChapter(context,records);
          if(resolved?.status!=='available'&&indexes.editions[id]?.[book]?.[chapter]?.includes(verse))
            resolved=await engine.lookupEdition(context,records);
          if(resolved?.status!=='available'&&corpus?.[id]?.[book]?.[chapter]?.includes(verse))
            resolved=await engine.lookupCorpus(context,records);
          if(resolved?.status!=='available'&&id==='kjv'&&scrivener?.[book]?.[chapter]?.includes(verse)){
            const alternate=await engine.lookupScrivenerWitness(context);
            if(alternate?.records){records=alternate.records;resolved=alternate.alignment;}
          }
          if(extensions?.[id]?.[book]?.[chapter]?.includes(verse)){
            const supplement=await engine.lookupExtension(context,records,resolved);
            if(!supplement) throw Error('Published extension unavailable for '+key(context));
            records=supplement.records;
            resolved=supplement.alignment;
          }
          if(resolved?.status!=='available') continue;
          let matched=0;
          for(const word of eligible){
            if(!resolved.groups.some(group=>group.english.some(span=>span.start<=word.start&&span.end>=word.end))) continue;
            matched++;
            const linked=engine.contextualDefinition({...context,displayWord:word.displayWord,
              englishStart:word.start,englishEnd:word.end},records,resolved);
            if(linked) summary.linkedContextDefinitions++;
            if(Object.hasOwn(wordForms,word.term)){
              wordForms[word.term].verified++;
              if(linked) wordForms[word.term].linkedContext++;
            }
          }
          if(!matched) continue;
          summary.anyAlignedVerses++;
          if(eligible.length===matched) summary.fullyAlignedVerses++;
          summary.verifiedWords+=matched;
          const origin=resolved.source.title;
          summary.sources[origin]=(summary.sources[origin]||0)+1;
        }
        chapters[chapter]=summary;
        merge(metrics,summary);
      }
      result.books[book]={...metrics,chapters};
      merge(result,metrics);
    }
    for(const [form,example] of examples){
      const hit=await definitions.lookup(example);
      wordForms[form].definition=hit.status==='available'?hit.source:null;
    }
    report.editions[id]=result;
    report.priority[id]=wordForms;
  }
  return report;
}

if(require.main===module){
  const [output]=process.argv.slice(2);
  if(!output) throw Error('Expected a coverage report filename');
  run().then(report=>fs.writeFileSync(output,JSON.stringify(report)+'\n')).catch(error=>{
    console.error(error);process.exitCode=1;
  });
}

module.exports={run,runtime,tokens,supplied};
