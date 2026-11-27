'use strict';

const fs=require('node:fs');
const path=require('node:path');
const {createHash}=require('node:crypto');
const {audit}=require('./audit-clear-bible-alignment');
const {address,version,baseline,sources,referenceLink,orderedWitness,mapVerifiedPositions}=require('./scripture-crosswalk');
const {manuscriptMatches, provider}=require('./import-web-alignment');
const {loadBibleLibrary, READER_TOKEN_PATTERN,normalizeDictionaryTerm}=require('./audit-word-study-coverage');
const {readTaggedVerse,checksum}=require('./import-crosswire-kjv-alignment');
const {validate:validateBerean}=require('./word-study-berean');
const {validatePhrases}=require('./web-phrase-consensus');
const pins=require('../docs/shell-80-web-alignment-report.json');

const root=path.resolve(__dirname,'..');
const forms="don't,says,didn't,spoke,brothers,doesn't,comes,listen,today,king's,everyone,won't,does,philistines,whoever,show,can't,inhabitants,let's,loving,families,news,moab,isn't,whatever".split(',');
const hash=bytes=>createHash('sha256').update(bytes).digest('hex');
const bump=(dict,key,n=1)=>{dict[key]=(dict[key]||0)+n;};
const groupKey=([spans,positions])=>JSON.stringify([spans,positions]);
const spanKey=span=>span.join(':');
const candidateStatuses=['baselineVerified','independentPending','linguisticPending','ambiguous','rejected'];
const empty=()=>Object.fromEntries(candidateStatuses.map(key=>[key,0]));
const inventory={
  'genesis:18:1':'proper-names',
  'job:19:12':'possessive',
  'proverbs:6:21':'possessive',
  'numbers:22:3':'proper-names',
  '1-samuel:17:1':'proper-names',
  'ezra:4:8':'aramaic-boundary',
  'daniel:2:4':'aramaic-boundary',
  'daniel:2:21':'aramaic-common-verbs',
  'matthew:9:34':'greek-multiword',
  'matthew:23:13':'manuscript-numbering',
  'romans:8:6':'greek-multiword',
  'romans:14:24':'manuscript-numbering',
  'acts:8:37':'manuscript-gap',
  'john:1:1':'repeated-greek',
  'john:7:52':'negation',
  'genesis:4:9':'hebrew-contraction'
};

function verifyBaseline() {
  const byChapter=new Map();
  for (const [relative,pin] of Object.entries(pins.files)) {
    const data=fs.readFileSync(path.join(root,'data/word-study/alignment/web',relative));
    if (hash(data)!==pin.sha256) throw new Error('Shell 80 shard changed: '+relative);
    byChapter.set(relative,JSON.parse(data.toString('utf8')));
  }
  return byChapter;
}

function targetCoordinates(dataset) {
  const candidates=new Map();
  let rows=0, unusable=0;
  const targetSource=dataset.hebrew?'clear-bsb-ot':'clear-bsb-nt';
  const originalSource='clear-'+dataset.id.toLowerCase();
  for (const [ref,words] of dataset.targets) {
    const from=address(targetSource,ref);
    if (!from) continue;
    for (const [,native,, , ,idRange,verseRange] of words) {
      if (native===ref && !idRange && !verseRange) continue;
      rows++;
      const to=address(originalSource,native);
      if (!to || idRange || verseRange) {unusable++;continue;}
      if (!candidates.has(ref)) candidates.set(ref,new Map());
      candidates.get(ref).set(native,to);
    }
  }
  const links=[];
  for (const [coordinate,targets] of candidates) {
    const link=referenceLink([address(targetSource,coordinate)],[...targets.values()],
      {kind:'declared-numbering',locator:'Pinned BSB target TSV source_verse'});
    if (link) links.push(link);
  }
  return {rows,unusable,coordinateLinks:links.length,
    relationCounts:links.reduce((counts,row)=>(bump(counts,row.relation),counts),{}),
    examples:links.slice(0,5)};
}

async function acceptedNumbering(web,kjv,crosswire) {
  const original=provider();
  const links=[], stats={addressed:0,readerPresent:0,exactKjvText:0,ambiguous:0};
  const byRef=new Map();
  const xml=fs.readFileSync(crosswire);
  if (hash(xml)!==checksum) throw new Error('CrossWire KJV OSIS checksum mismatch');
  for (const [,ref,body] of xml.toString('utf8').matchAll(/<verse\b[^>]*\bosisID="([^"]+)"[^>]*\bsID="[^"]+"[^>]*\/>([\s\S]*?)<verse\b[^>]*\beID="\1"[^>]*\/>/g)) {
    byRef.set(ref,byRef.has(ref)?null:body);
  }
  for (const [ref,body] of byRef) {
    const from=address('crosswire-kjv',ref);
    if (!from) continue;
    stats.addressed++;
    if (!body) {stats.ambiguous++;continue;}
    const text=kjv[from.bookId]?.[from.chapter]?.verses?.[from.verse-1];
    if (!text?.trim()) continue;
    stats.readerPresent++;
    if (readTaggedVerse(body).text===text) stats.exactKjvText++;
  }
  for (const coordinate of ['matthew:23:13','matthew:23:14','romans:14:24','romans:14:25','romans:14:26']) {
    const from=address('reader-web',coordinate), {bookId,chapter,verse}=from;
    const context={bookId,chapter,verse,translationId:'web',verseText:web[bookId]?.[chapter]?.verses?.[verse-1]};
    const ref=original.resolveOriginalLanguageReference(context);
    const to=address('reader-greek-byzantine',[ref.bookId,ref.chapter,ref.verse].join(':'));
    links.push(referenceLink([from],[to],{kind:'declared-numbering',locator:'Shell 80 Reader original-language provider reviewed verse coordinates'}));
  }
  for (const coordinate of ['acts:8:37','acts:15:34','acts:24:7','luke:17:36']) {
    links.push(referenceLink([address('reader-kjv',coordinate)],[address('reader-greek-tr',coordinate)],
      {kind:'declared-numbering',locator:'Shell 80 Reader explicitly names Textus Receptus variant for this KJV text'}));
  }
  for (const coordinate of ['numbers:13:1','numbers:30:1','matthew:5:4','mark:8:39']) {
    const from=address('reader-dra',coordinate), {bookId,chapter,verse}=from;
    const ref=original.resolveOriginalLanguageReference({bookId,chapter,verse,translationId:'dra'});
    const to=address(['matthew','mark'].includes(bookId)?'reader-greek-byzantine':'reader-hebrew-aramaic',
      [ref.bookId,ref.chapter,ref.verse].join(':'));
    links.push(referenceLink([from],[to],{kind:'declared-numbering',locator:'Shell 80 Reader original-language provider reviewed DRA coordinates'}));
  }
  return {crosswire:stats,readerExceptions:links};
}

function touches(left,right) {
  return left[0].some(span=>right[0].some(other=>span[0]<other[1]&&other[0]<span[1]));
}

function classify(group,prior,consensus,independent) {
  if (prior.some(row=>groupKey(row)===groupKey(group))) return 'baselineVerified';
  if (consensus?.groups?.some(row=>groupKey(row)===groupKey(group))) return 'independentPending';
  if (prior.some(row=>touches(row,group) && row[0].some(span=>group[0].some(other=>spanKey(span)===spanKey(other))) &&
    row[1].every(position=>!group[1].includes(position)))) return 'rejected';
  if (consensus?.ambiguous || independent.some(row=>touches(row,group) && groupKey(row)!==groupKey(group))) return 'ambiguous';
  return 'linguisticPending';
}

function originalTokens(records,nativeIds=[]) {
  return records.map((record,index)=>{
    const {tokenIndex,surface,language,lemma,morphology,strongsNumber,bookId,chapter,verse,source}=record;
    return {index:tokenIndex,surface,language,lemma,morphology,strongsNumber,bookId,chapter,verse,source,nativeIds:nativeIds[index]};
  });
}

function reviewItem(stratum,group,context,records,nativeIds,reference,status) {
  const {bookId,chapter,verse,verseText}=context;
  const coordinate=[bookId,chapter,verse].join(':');
  const spans=group[0].map(([start,end])=>({start,end,text:verseText.slice(start,end)}));
  const tokens=originalTokens(records,nativeIds);
  return {
    id:hash(JSON.stringify({coordinate,group})).slice(0,20),stratum,
    passage:address('reader-web',coordinate),text:verseText,spans,tokens,proposedPositions:group[1],
    evidence:[reference],automatedFinding:status,reviews:[],adjudication:null
  };
}

async function run(clearDir,ult,uhb,ugnt,berean,crosswire,shell79) {
  const web=loadBibleLibrary('web.js','webLibrary'), kjv=loadBibleLibrary('kjv.js','kjvLibrary');
  const chapters=verifyBaseline();
  const report={version,baseline,sources,referenceInventory:await acceptedNumbering(web,kjv,crosswire),
    screens:{},counts:empty(),groups:empty(),comparison:{},priority:Object.fromEntries(forms.map(form=>[form,empty()])),
    coordinateReconciliation:{newlyResolvedReferences:0,newlyResolvedTokens:0,validatedVersePairs:0,
      bereanWitnessCompatible:0,byLanguage:{},explicitNativePositions:0,groupsWithMultipleNativeMorphemes:0},publishedAdditions:0};
  const proposals=new Map();
  for (const id of ['WLCM','SBLGNT']) {
    const counts=empty(), groups=empty(), byBook={};
    const auditResult=await audit(id,clearDir,ult,uhb,ugnt,berean,shell79,null,{
      package(dataset){ report.referenceInventory[id]=targetCoordinates(dataset); },
      verse({ref,code,label,context,records,witness,evidence,clearOnly,existing,ultEvidence,consensus,table}){
        if (existing || !clearOnly?.length) return;
        const {bookId,chapter,verse,verseText}=context;
        const coordinate=[bookId,chapter,verse].join(':');
        const readerAddress=address(id==='WLCM'?'reader-hebrew-aramaic':'reader-greek-byzantine',coordinate);
        const witnessAddress=address(id==='WLCM'?'uhb':'ugnt',code+' '+label);
        const nativeRef=address(id==='WLCM'?'clear-wlcm':'clear-sblgnt',ref);
        if (!orderedWitness(witnessAddress,readerAddress,witness,records)) throw new Error('Unwitnessed candidate reference '+coordinate);
        const reference=referenceLink([nativeRef],[readerAddress],{kind:'ordered-witness',locator:id+' position validation against '+witnessAddress.coordinate});
        const nativePositions=mapVerifiedPositions(nativeRef,evidence.positionIds,{kind:'validated-package',locator:id},records);
        if (!reference || !nativePositions) throw new Error('Unwitnessed candidate positions '+coordinate);
        report.coordinateReconciliation.validatedVersePairs++;
        report.coordinateReconciliation.explicitNativePositions+=nativePositions.size;
        if (table && !validateBerean(table,witness,records,manuscriptMatches).reason) report.coordinateReconciliation.bereanWitnessCompatible++;
        const loaded=chapters.get(bookId+'/'+chapter+'.json')?.[verse];
        if (loaded && loaded[0]!==verseText) throw new Error('Mismatched Reader text '+coordinate);
        const prior=loaded?.[2]||[];
        const independent=ultEvidence?validatePhrases(verseText,ultEvidence,ultEvidence).groups||[]:[];
        const counted=new Set();
        for (const group of clearOnly) {
          const languages=new Set(group[1].map(index=>records[index].language));
          for (const language of languages) bump(report.coordinateReconciliation.byLanguage,language);
          if (group[1].some(index=>evidence.positionIds[index].length>1)) report.coordinateReconciliation.groupsWithMultipleNativeMorphemes++;
          const status=classify(group,prior,consensus,independent);
          const comparable=independent.filter(candidate=>touches(candidate,group));
          const finding=comparable.some(candidate=>groupKey(candidate)===groupKey(group))?'exact':
            comparable.some(candidate=>candidate[1].some(position=>group[1].includes(position)))?'partial':
              comparable.length?'disagreement':'noComparableIndependentProjection';
          bump(report.comparison,finding);
          bump(groups,status);
          const book=byBook[bookId]||=empty();
          const priority=[];
          for (const span of group[0]) {
            const key=spanKey(span);
            if(counted.has(key)) throw new Error('Duplicate English candidate span '+coordinate);
            counted.add(key);
            bump(counts,status);bump(book,status);
            const form=normalizeDictionaryTerm(verseText.slice(...span));
            if (Object.hasOwn(report.priority,form)) {
              bump(report.priority[form],status);priority.push(form);
            }
          }
          const shape=group[0].length>1||group[1].length>1?'phrase':'single';
          const strata=[...priority.map(form=>'priority:'+form),...Array.from(languages,language=>language+':'+shape)];
          if (inventory[coordinate]) strata.push(inventory[coordinate]);
          for (const stratum of strata) {
            const item=reviewItem(stratum,group,context,records,evidence.positionIds,reference,status);
            const rank=hash('shell81-review-v1/'+coordinate+'/'+item.id+'/'+stratum);
            if (!proposals.has(stratum)) proposals.set(stratum,[]);
            const entries=proposals.get(stratum);
            entries.push({rank,item});
            entries.sort((a,b)=>a.rank.localeCompare(b.rank));
            if (entries.length>8) entries.pop();
          }
        }
      }
    });
    const words=Object.values(counts).reduce((sum,n)=>sum+n,0);
    if (words!==auditResult.methods.clearOnlyPhrase.newOccurrences) throw new Error('Candidate cohort changed '+id);
    report.screens[id]={words,verses:auditResult.methods.clearOnlyPhrase.newVerses,counts,groups,byBook};
    for(const key of candidateStatuses){bump(report.counts,key,counts[key]);bump(report.groups,key,groups[key]);}
  }
  if (Object.values(report.counts).reduce((sum,n)=>sum+n,0)!==27227) throw new Error('Unexpected Shell 80 candidate count');
  const development=[],holdout=[],used=new Set();
  const strata=[...proposals].sort(([a],[b])=>(a.startsWith('priority:')?0:1)-(b.startsWith('priority:')?0:1)||a.localeCompare(b));
  const passages=new Set();
  const original=provider();
  async function challenge(coordinate,stratum) {
    const passage=address('reader-web',coordinate);
    const {bookId,chapter,verse}=passage;
    const text=web[bookId]?.[chapter]?.verses?.[verse-1]||'';
    const result=await original.lookupVerse({translationId:'web',bookId,chapter,verse,verseText:text});
    return {id:hash('challenge/'+coordinate).slice(0,20),stratum,passage,text,
      tokens:originalTokens(result.records),reviews:[],adjudication:null};
  }
  for (const [coordinate,stratum] of Object.entries({
    'matthew:5:17':'greek-contraction-negation',
    'luke:17:36':'manuscript-gap',
    'john:1:5':'greek-negation',
    'daniel:4:17':'aramaic-grammatical-context'
  })) {
    holdout.push(await challenge(coordinate,stratum));
    passages.add(coordinate);
  }
  for (const [,items] of strata) {
    const selected=items.find(({item})=>!passages.has(item.passage.coordinate));
    if (!selected) continue;
    passages.add(selected.item.passage.coordinate);
    const {id,stratum,passage,text,tokens}=selected.item;
    holdout.push({id,stratum,passage,text,tokens:tokens.map(({nativeIds,...token})=>token),reviews:[],adjudication:null});
    used.add(id);
  }
  for (const [coordinate,stratum] of Object.entries(inventory)) {
    if (passages.has(coordinate)) continue;
    const item=await challenge(coordinate,stratum);
    development.push({...item,
      selectable:[...item.text.matchAll(READER_TOKEN_PATTERN)].map(match=>({start:match.index,end:match.index+match[0].length,text:match[0]})),
      spans:[],evidence:[{kind:'reader-baseline',locator:coordinate}],automatedFinding:'unlabeled-challenge'});
    passages.add(coordinate);
  }
  for (const [,items] of strata) {
    const selected=items.find(({item})=>!used.has(item.id)&&!passages.has(item.passage.coordinate));
    if (!selected) continue;
    development.push(selected.item);used.add(selected.item.id);passages.add(selected.item.passage.coordinate);
  }
  const dataset={version,baseline,license:'See docs/shell-81-word-study.md',
    scope:'Unadjudicated development proposals and a separate passage-level evaluation input set',
    selection:'One stable SHA-256-ranked unseen passage per available stratum, evaluation selected first; challenge passages predeclared',
    development,holdout};
  report.review={development:development.length,holdout:holdout.length,humanReviewed:0,adjudicated:0};
  return {report,dataset};
}

if(require.main===module){
  const [clearDir,ult,uhb,ugnt,berean,crosswire,shell79,reportFile,datasetFile]=process.argv.slice(2);
  if (!datasetFile) throw new Error('Expected Clear, ULT, UHB, UGNT, Berean, CrossWire, Shell 79, report and review dataset paths');
  run(clearDir,ult,uhb,ugnt,berean,crosswire,shell79).then(({report,dataset})=>{
    fs.writeFileSync(reportFile,JSON.stringify(report,null,2)+'\n');
    fs.writeFileSync(datasetFile,JSON.stringify(dataset,null,2)+'\n');
  }).catch(error=>{console.error(error);process.exitCode=1;});
}

module.exports={run,classify,verifyBaseline};
