'use strict';

const fs=require('node:fs');
const path=require('node:path');
const {createHash}=require('node:crypto');
const {assessBook}=require('./adjudicate-web-book');
const {gate}=require('./audit-web-book-coverage');
const {verifyBaseline}=require('./audit-shell81-crosswalk');
const {loadBibleLibrary}=require('./audit-word-study-coverage');
const {provider}=require('./import-web-alignment');
const {runtime}=require('./audit-word-study-corpus');

const editionPublication=require('../docs/shell-83-edition-publication.json');
const corpusPublication=require('../docs/shell-84-corpus-publication.json');

const identity=['bookId','chapter','verse','surface','language','strongsNumber','morphology','source'];

function exactWitness(packetTokens,live) {
  return Array.isArray(packetTokens)&&packetTokens.length===live.length&&live.every((token,index)=>
    packetTokens[index]?.index===token.tokenIndex&&identity.every(field=>packetTokens[index][field]===token[field]));
}

function supplement(accepted,submitted){
  const key=group=>JSON.stringify(group);
  const prior=new Set(accepted.map(key));
  const novel=submitted.filter(group=>!prior.has(key(group)));
  const conflicts=novel.some(([spans,positions])=>accepted.some(([oldSpans,oldPositions])=>
    positions.some(position=>oldPositions.includes(position)) ||
    spans.some(([a,b])=>oldSpans.some(([c,d])=>a<d&&c<b))));
  return conflicts?null:novel;
}

function pinnedIndex(folder,publication){
  const bytes=fs.readFileSync(path.join(__dirname,'../data/word-study/alignment',folder,'index.json'));
  if(createHash('sha256').update(bytes).digest('hex')!==publication.files['index.json'].sha256)
    throw new Error('Alignment index does not match its publication report: '+folder);
  return JSON.parse(bytes).web;
}
async function stage(bytes,submissions,roster) {
  const assessed=assessBook(bytes,submissions,roster);
  const packet=JSON.parse(bytes), rows=new Map(packet.rows.map(row=>[row.id,row]));
  const web=loadBibleLibrary('web.js','webLibrary'), lookup=provider(), existing=verifyBaseline();
  const editions=pinnedIndex('editions',editionPublication), corpus=pinnedIndex('corpus',corpusPublication);
  const alignment=runtime();
  const staged={version:1,bookId:packet.bookId,reviewPacketSha256:assessed.reviewPacketSha256,
    counts:{...assessed.counts,staged:0,invalidLiveWitness:0,existingVerifiedVerse:0,emptyReviewedVerse:0,conflictsWithPublished:0},chapters:{}};
  for(const decision of assessed.decisions){
    if(!['agreed','resolved'].includes(decision.status)) continue;
    if(!decision.groups.length) {staged.counts.emptyReviewedVerse++;continue;}
    const row=rows.get(decision.id);
    const {bookId,chapter,verse}=row.passage;
    const text=web[bookId]?.[chapter]?.verses?.[verse-1];
    const context={translationId:'web',bookId,chapter,verse,verseText:text};
    const {records}=await lookup.lookupVerse(context);
    if(row.passage.source!=='reader-web'||bookId!==packet.bookId||row.text!==text||
      gate(context,records)!=='reviewable'||!exactWitness(row.tokens,records)){
      staged.counts.invalidLiveWitness++;
      continue;
    }
    const hasChapter=Object.hasOwn(existing.get(bookId+'/'+chapter+'.json')||{},verse);
    const hasEdition=editions?.[bookId]?.[chapter]?.includes(verse);
    const hasCorpus=corpus?.[bookId]?.[chapter]?.includes(verse);
    let prior=alignment.lookup(context,records);
    if(prior?.status!=='available'&&hasChapter) prior=await alignment.lookupChapter(context,records);
    if(prior?.status!=='available'&&hasEdition) prior=await alignment.lookupEdition(context,records);
    if(prior?.status!=='available'&&hasCorpus) prior=await alignment.lookupCorpus(context,records);
    if((hasChapter||hasEdition||hasCorpus)&&prior?.status!=='available'){
      staged.counts.invalidLiveWitness++;
      continue;
    }
    const priorGroups=prior?.status==='available'?prior.groups.map(group=>[
      group.english.map(span=>[span.start,span.end]),Array.from(group.original)
    ]):[];
    const added=supplement(priorGroups,decision.groups);
    if(!added){
      staged.counts.conflictsWithPublished++;
      continue;
    }
    if(!added.length){
      staged.counts.existingVerifiedVerse++;
      continue;
    }
    const chapterRows=staged.chapters[chapter]||={};
    chapterRows[verse]={
      text,tokens:records.map(token=>identity.map(field=>token[field])),
      groups:added,priorGroupsSha256:createHash('sha256').update(JSON.stringify(priorGroups)).digest('hex'),
      reviewId:decision.id,reviewers:decision.reviewers,
      adjudicator:decision.adjudicator||null,decision:decision.status,
      evidence:submissions.passages[decision.id]
    };
    staged.counts.staged++;
  }
  return staged;
}

if(require.main===module){
  const [packet,submissions,roster,output]=process.argv.slice(2);
  if(!output) throw new Error('Expected frozen WEB book packet, submissions, roster and a fresh staging file');
  const target=path.resolve(output);
  const runtime=path.resolve(__dirname,'../data');
  if(target===runtime||target.startsWith(runtime+path.sep)) throw new Error('Reviewed output must stay outside published data');
  const read=file=>JSON.parse(fs.readFileSync(file,'utf8'));
  stage(fs.readFileSync(packet),read(submissions),read(roster)).then(report=>
    fs.writeFileSync(target,JSON.stringify(report,null,2)+'\n',{flag:'wx'}))
    .catch(error=>{console.error(error);process.exitCode=1;});
}

module.exports={stage,exactWitness,supplement};
