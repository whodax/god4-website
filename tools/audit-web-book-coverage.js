'use strict';

const fs=require('node:fs');
const {createHash}=require('node:crypto');
const canon=require('../js/bible/canon');
const {audit}=require('./audit-clear-bible-alignment');
const {classify,verifyBaseline}=require('./audit-shell81-crosswalk');
const {address}=require('./scripture-crosswalk');
const {loadBibleLibrary,READER_TOKEN_PATTERN,normalizeDictionaryTerm}=require('./audit-word-study-coverage');
const {validate:validateBerean}=require('./word-study-berean');
const {validatePhrases}=require('./web-phrase-consensus');
const {provider,manuscriptMatches}=require('./import-web-alignment');
const {canonicalGroups}=require('./web-alignment-review');
const frozen=require('../docs/shell-81-web-review-v1.json');
const prior=require('../docs/shell-81-crosswalk-report.json');
const forms=require('../data/word-study/web-common-words.json').entries;

const baseline='13d94205e959d332645ba7f4cb2a4b7d3da9ea2a';
const hash=bytes=>createHash('sha256').update(bytes).digest('hex');
const measure=(dict,key,n=1)=>{dict[key]=(dict[key]||0)+n;};
const heldout=new Set(frozen.holdout.map(row=>row.passage.coordinate));
const statuses=['baselineVerified','independentPending','linguisticPending','ambiguous','rejected'];
const fresh=()=>Object.fromEntries(statuses.map(status=>[status,0]));
const selection=group=>group[0].map(span=>span.join(':')).join('|')+'@'+group[1].join(',');
const words=text=>[...text.matchAll(READER_TOKEN_PATTERN)];
const location=({bookId,chapter,verse})=>[bookId,chapter,verse].join(':');
const heldoutOriginal=new Set(frozen.holdout.flatMap(row=>row.tokens.map(location)));

function gate(context,records) {
  if(heldout.has(location(context))||records.some(token=>heldout.has(location(token))||heldoutOriginal.has(location(token)))) return 'held-out';
  if(!context.verseText?.trim()) return 'empty-reader-coordinate';
  if(!records.length) return 'missing-original-witness';
  if(records.some((token,i)=>token.status!=='authoritative'||token.tokenIndex!==i)) return 'invalid-original-positions';
  return 'reviewable';
}

function spansFor(text,spans) {
  return [...new Map(spans.flatMap(([start,end])=>words(text).filter(token=>
    token.index>=start&&token.index+token[0].length<=end).map(token=>[token.index,{
      start:token.index,end:token.index+token[0].length,text:token[0]
    }]))).values()];
}

function appendHint(candidate,positionGroup,record) {
  const hint={status:candidate.status,source:candidate.source,locator:candidate.locator,
    publisherAgrees:candidate.publisherAgrees,groups:[{
      spans:spansFor(record.text,positionGroup[0]),positions:positionGroup[1]
    }]};
  canonicalGroups(record,hint.groups);
  return hint;
}

async function prepareBook(bookId,library,lookup,hints,{translationId='web',revision=baseline}={}) {
  const rows=[],evidence=[],counts={};
  const book=library[bookId];
  for(let chapter=1;chapter<=book.chapters;chapter++) {
    for(const [index,text] of book[chapter].verses.entries()) {
      const verse=index+1;
      const context={translationId,bookId,chapter,verse,verseText:text};
      const coordinate=location(context), passage=address('reader-'+translationId,coordinate);
      const {records}=await lookup.lookupVerse(context);
      const status=gate(context,records);
      measure(counts,status);
      const id=hash(revision+'/'+coordinate).slice(0,20);
      if (status==='held-out') {
        rows.push({id,passage,status});
        continue;
      }
      const record={id,passage,status,text,tokens:records.map(({tokenIndex:index,bookId,chapter,verse,source,language,surface,lemma,morphology,strongsNumber})=>
        ({index,bookId,chapter,verse,source,language,surface,lemma,morphology,strongsNumber}))};
      rows.push(record);
      const proposals=hints.get(coordinate)||[];
      if(status==='reviewable'&&proposals.length) {
        evidence.push({id,passage,hints:proposals.map(candidate=>appendHint(candidate,candidate.group,record))});
      }
    }
  }
  return {version:1,baseline:revision,bookId,counts,rows,hints:evidence};
}

async function run(clearDir,ult,uhb,ugnt,berean,shell79,books) {
  const library=loadBibleLibrary('web.js','webLibrary'), lookup=provider(), verified=verifyBaseline();
  if(new Set(books).size!==books.length || books.some(id=>!canon.order('web').includes(id))) throw new Error('Invalid review book selection');
  const report={version:1,baseline,scope:'Entire 66-book canonical inventory and original Shell 81 candidate cohort',
    results:fresh(),publisherConsensus:{agreeingVerified:0,agreeingPending:0,agreeingAmbiguous:0,agreeingRejected:0,
      heldoutCandidateWords:0,priorityPendingWords:0},books:{},selected:{},newPublished:0};
  for(const id of canon.order('web')){
    const book=library[id], coverage={verseSlots:0,displayedVerses:0,words:0,priorityWords:0,candidateWords:fresh(),
      publisherAgreesUnverified:0};
    for(let i=1;i<=book.chapters;i++) for(const text of book[i].verses){
      coverage.verseSlots++;
      if(text?.trim()) coverage.displayedVerses++;
      const tokens=words(text||'');
      coverage.words+=tokens.length;
      coverage.priorityWords+=tokens.filter(token=>Object.hasOwn(forms,normalizeDictionaryTerm(token[0]))).length;
    }
    report.books[id]=coverage;
  }
  const requested=new Set(books),hints=new Map();
  for(const id of ['WLCM','SBLGNT']){
    await audit(id,clearDir,ult,uhb,ugnt,berean,shell79,null,{
      verse({ref,context,records,witness,evidence,clearOnly,existing,ultEvidence,consensus,table}){
        if(existing||!clearOnly?.length) return;
        const {bookId,chapter,verse,verseText}=context,coordinate=location(context);
        const old=verified.get(bookId+'/'+chapter+'.json')?.[verse]?.[2]||[];
        const ultGroups=ultEvidence?validatePhrases(verseText,ultEvidence,ultEvidence).groups||[]:[];
        const publisher=table&&validateBerean(table,witness,records,manuscriptMatches);
        const publisherGroups=publisher?.groups?
          validatePhrases(verseText,evidence,{text:table.english,groups:publisher.groups}).groups||[]:[];
        const publisherKeys=new Set(publisherGroups.map(selection));
        for(const group of clearOnly){
          const n=new Set(group[0].map(span=>span.join(':'))).size;
          const status=classify(group,old,consensus,ultGroups);
          measure(report.results,status,n);
          measure(report.books[bookId].candidateWords,status,n);
          if(gate(context,records)==='held-out') {
            report.publisherConsensus.heldoutCandidateWords+=n;
            continue;
          }
          const publisherAgrees=publisherKeys.has(selection(group));
          if (publisherAgrees) {
            const result=status==='baselineVerified'?'agreeingVerified':
              status==='ambiguous'?'agreeingAmbiguous':status==='rejected'?'agreeingRejected':'agreeingPending';
            report.publisherConsensus[result]+=n;
            if (status!=='baselineVerified') {
              report.books[bookId].publisherAgreesUnverified+=n;
              for(const [start,end] of group[0]){
                if(Object.hasOwn(forms,normalizeDictionaryTerm(verseText.slice(start,end)))) report.publisherConsensus.priorityPendingWords++;
              }
            }
          }
          if(!requested.has(bookId)||status==='baselineVerified') continue;
          if(!hints.has(coordinate)) hints.set(coordinate,[]);
          hints.get(coordinate).push({status,group,publisherAgrees,source:'clear-'+id.toLowerCase(),locator:ref});
        }
      }
    });
  }
  if(Object.values(report.results).reduce((total,n)=>total+n,0)!==27227 ||
    statuses.some(status=>report.results[status]!==prior.counts[status])) throw new Error('Shell 81 candidate cohort changed');
  const packets={};
  for(const id of books) {
    const {hints:evidence,...packet}=await prepareBook(id,library,lookup,hints);
    const bytes=Buffer.from(JSON.stringify(packet)+'\n');
    const advisory=Buffer.from(JSON.stringify({version:1,baseline,bookId:id,reviewPacketSha256:hash(bytes),
      scope:'Automated proposals for development review',rows:evidence})+'\n');
    packets[id]={review:bytes,advisory};
    report.selected[id]={counts:packet.counts,rows:packet.rows.length,versesWithHints:evidence.length,
      reviewBytes:bytes.length,reviewSha256:hash(bytes),advisoryBytes:advisory.length,advisorySha256:hash(advisory)};
  }
  return {report,packets};
}

if(require.main===module){
  const [clearDir,ult,uhb,ugnt,berean,shell79,output,...books]=process.argv.slice(2);
  if(!output||!books.length) throw new Error('Expected Clear directory, ULT, UHB, UGNT, Berean, Shell79, fresh output directory and one or more WEB book IDs');
  if(fs.existsSync(output)) throw new Error('Output directory must be fresh');
  const path=require('node:path');
  run(clearDir,ult,uhb,ugnt,berean,shell79,books).then(({report,packets})=>{
    fs.mkdirSync(output);
    fs.writeFileSync(path.join(output,'report.json'),JSON.stringify(report,null,2)+'\n');
    for(const [id,packet] of Object.entries(packets)) {
      for(const [type,bytes] of Object.entries(packet)) fs.writeFileSync(path.join(output,id+'-'+type+'.json'),bytes);
    }
  }).catch(error=>{console.error(error);process.exitCode=1;});
}

module.exports={gate,prepareBook,run};
