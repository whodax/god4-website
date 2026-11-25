'use strict';

// Read-only Shell audit. Reuses the production lookups and coverage tokenizer.
const fs = require('node:fs');
const path = require('node:path');
const vm = require('node:vm');
const {execFileSync} = require('node:child_process');
const {TRANSLATIONS, READER_TOKEN_PATTERN, normalizeLookupTerm, normalizeDictionaryTerm, loadBibleLibrary} = require('./audit-word-study-coverage');
const root = path.resolve(__dirname, '..');
const canon = require('../js/bible/canon');
const editions = [...TRANSLATIONS, {id:'dra', abbreviation:'DRA', file:'dra.js', variable:'draLibrary'}];
const usage = require('../data/word-study/web-common-words.json').entries;
const priority = new Set(Object.keys(usage));
const productionSource = name => fs.readFileSync(path.join(root, 'js/word-study', name+'.js'), 'utf8');
const sourceCache = new Map(['original-language-provider','provider','local-provider','sense-selector','dictionary-provider']
  .map(name => [name, new vm.Script(productionSource(name))]));
const alignment = require('../js/word-study/alignment');
// Expose the private production inventory in an audit-only VM.
const catalog = vm.runInNewContext(productionSource('alignment').replace(
  'lookup:createProvider(reviewedCatalog).lookup};', 'catalog:reviewedCatalog};'
) + '\nWordStudyAlignment.catalog;');
const key = ({translationId,bookId,chapter,verse}) => JSON.stringify([translationId, bookId, chapter, verse]);
const catalogKeys = new Set(catalog.map(key));

function sandbox(scripts){
  const context = vm.createContext({
    BibleCanon: canon,
    async fetch(url){
      const file = path.join(root,url);
      return {ok:fs.existsSync(file), json:async () => JSON.parse(fs.readFileSync(file,'utf8'))};
    }
  });
  for(const name of scripts) sourceCache.get(name).runInContext(context);
  return context;
}

function tokens(text){
  return Array.from(text.matchAll(new RegExp(READER_TOKEN_PATTERN.source,'g')), match => ({
    start:match.index, end:match.index+match[0].length, displayWord:match[0],
    lookupTerm:normalizeLookupTerm(match[0]), term:normalizeDictionaryTerm(match[0])
  })).filter(token => token.term);
}

function summarizeDefinition(result){
  if(result.status!=='available') return 'unavailable';
  const source = result.source || '';
  if(source.includes('Context uncertain')) return 'ambiguous';
  if(/Matched to this verse|Genesis 1:1|Exodus 3:7-10|^Scripture usage$/.test(source)) return 'scriptureContext';
  if(/Common Bible usage/.test(source)) return 'commonBibleUsage';
  if(/Context match/.test(source)) return 'dictionaryContext';
  return 'general';
}

function bump(object, name){ object[name]=(object[name] || 0)+1; }

async function auditEdition(edition,dictionary){
  const library = loadBibleLibrary(edition.file,edition.variable);
  const examples = new Map(), alignedTerms = new Set(), alignedPriority = new Set();
  const result = {id:edition.id,books:0,chapters:0,verseSlots:0,verses:0,sourceVerses:0,words:0,
    alignedWords:0,priorityWords:0,alignedPriorityWords:0,priorityDistinct:0,versesWithAlignment:[],
    priorityDefinitions:{},firstOccurrencesWithoutDefinition:[],webPriorityOccurrences:{},webPriorityUnresolved:{},
    sourceMissingByBook:{},catholicOnlyVerses:0};
  for(const [bookId,book] of Object.entries(library)){
    const chapters = Object.entries(book).filter(([,entry])=>Array.isArray(entry.verses));
    if(!chapters.length) continue;
    result.books++;
    const original = sandbox(['original-language-provider']).OriginalLanguageWordStudyProvider;
    for(const [chapter,chapterData] of chapters){
      result.chapters++;
      result.verseSlots+=chapterData.verses.length;
      for(const [index,verseText] of chapterData.verses.entries()){
        if(!verseText || !verseText.trim()) continue;
        const context={translationId:edition.id,bookId,chapter:Number(chapter),verse:index+1,verseText};
        result.verses++;
        if(edition.id==='dra' && canon.catholicOnly(bookId,context.chapter,context.verse)) result.catholicOnlyVerses++;
        const {status,records}=await original.lookupVerse(context);
        if(status==='available') result.sourceVerses++;
        else bump(result.sourceMissingByBook,bookId);
        const verified=catalogKeys.has(key(context)) ? alignment.lookup(context,records) : null;
        const row = {book:bookId, chapter:Number(chapter), verse:index+1, aligned:0, words:0, groups:verified?.groups.length || 0};
        for(const token of tokens(verseText)){
          const word={...context,displayWord:token.displayWord,lookupTerm:token.lookupTerm,englishStart:token.start};
          if(!examples.has(token.term)) examples.set(token.term,word);
          const isPriority=priority.has(token.term);
          result.words++;
          row.words++;
          if(isPriority){
            result.priorityWords++;
            if(edition.id==='web'){
              const classification=summarizeDefinition(await dictionary.lookup(word));
              bump(result.webPriorityOccurrences,classification);
              if(classification==='unavailable') bump(result.webPriorityUnresolved,token.term);
            }
          }
          if(verified?.status==='available' && alignment.matchingGroups(verified,token).length){
            result.alignedWords++;
            row.aligned++;
            alignedTerms.add(token.term);
            if(isPriority){
              result.alignedPriorityWords++;
              alignedPriority.add(token.term);
            }
          }
        }
        if(verified?.status==='available') result.versesWithAlignment.push(row);
      }
    }
  }
  for(const term of priority){
    if(!examples.has(term)) continue;
    result.priorityDistinct++;
    const example=examples.get(term);
    const classification=summarizeDefinition(await dictionary.lookup(example));
    bump(result.priorityDefinitions,classification);
    if(classification==='unavailable') result.firstOccurrencesWithoutDefinition.push({term,lookup:example.lookupTerm});
  }
  result.alignedDistinct=alignedTerms.size;
  result.alignedPriorityDistinct=alignedPriority.size;
  result.alignedPriorityTerms=[...alignedPriority].sort();
  return result;
}

function auditEthiopian(){
  const dataDir=path.join(root,'data/ethiopian-readings');
  const books=JSON.parse(fs.readFileSync(path.join(dataDir,'books.json'),'utf8'));
  const result={books:books.length,sections:0,lines:0,words:0,priorityWords:0,alignedWords:0,wordStudyIntegrated:false};
  for(const {id} of books){
    const {sections}=JSON.parse(fs.readFileSync(path.join(dataDir,id+'.json'),'utf8'));
    result.sections+=sections.length;
    for(const {lines} of sections) for(const [,text] of lines){
      if(!text.trim()) continue;
      result.lines++;
      for(const token of tokens(text)){
        result.words++;
        if(priority.has(token.term)) result.priorityWords++;
      }
    }
  }
  return result;
}

async function main(){
  const dictionary=sandbox(['provider','local-provider','sense-selector','dictionary-provider']).WordStudyProvider;
  const reports=[];
  for(const edition of editions) reports.push(await auditEdition(edition,dictionary));
  const live=reports.reduce((total,report)=>total+report.versesWithAlignment.length,0);
  if(live!==catalog.length) throw new Error('Some declared catalog entries did not pass runtime validation');
  const output={commit:execFileSync('git',['rev-parse','HEAD'],{cwd:root,encoding:'utf8'}).trim(),
    verifiedCatalogEntries:catalog.length,priorityForms:priority.size,editions:reports,ethiopian:auditEthiopian()};
  console.log(JSON.stringify(output,null,2));
}

main().catch(error=>{console.error(error);process.exitCode=1;});
