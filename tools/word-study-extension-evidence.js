'use strict';

const {tokens}=require('./audit-word-study-corpus');
const {projectExactTypography}=require('./audit-kjv-expansion');
const {READER_TOKEN_PATTERN}=require('./audit-word-study-coverage');

const marked=/[\[\]{}<>]/;
const sensitive=/\b(?:not|no|none|never|neither|nor|without|unless|except|if|lest|only|cannot|nothing|nobody|whoever|whatever)\b|n['\u2019]t\b/i;
const adverseBoundary=/["\u201c\u201d:]|^\s*(?:but|or|for|because|therefore|then|so|that|which|who)\b/i;
const normalize=text=>text.replace(/[\u2018\u2019]/g,"'").replace(/\s+/g,' ').trim();
const nativeTuple=({surface,strongsNumber,morphology,language})=>[surface,strongsNumber,morphology,language];
const overlap=([a,b],[c,d])=>a<d&&c<b;
const englishOverlap=(a,b)=>a[0].some(span=>b[0].some(other=>overlap(span,other)));
const conflict=(a,b)=>englishOverlap(a,b)||a[1].some(position=>b[1].includes(position));
const key=([spans,positions])=>JSON.stringify([[...spans].sort((a,b)=>a[0]-b[0]),[...positions].sort((a,b)=>a-b)]);

function wholeWordGroups(text,groups){
  const words=tokens(text);
  const supplied=[...text.matchAll(/\[[^\[\]{}<>]*\]/g)].map(entry=>[entry.index,entry.index+entry[0].length]);
  return groups.filter(([spans])=>spans.every(([a,b])=>
    !supplied.some(boundary=>overlap([a,b],boundary)) && words.some(word=>word.start>=a&&word.end<=b) &&
    !words.some(word=>overlap([a,b],[word.start,word.end])&&(word.start<a||word.end>b))));
}

function clauses(text){
  return [...text.matchAll(/[^.;!?]+[.;!?]|[^.;!?]+$/g)].map(match=>{
    const leading=match[0].length-match[0].trimStart().length, body=match[0].trim();
    return {body,start:match.index+leading,end:match.index+leading+body.length};
  });
}

function sharedText(source,target,groups){
  const whole=projectExactTypography(source,target,groups);
  if(whole) return {groups:wholeWordGroups(target,whole),method:'exact-edition'};
  if([source,target].some(text=>marked.test(text)||sensitive.test(text)||/["\u201c\u201d:]/.test(text))) return {groups:[]};
  const a=clauses(source),b=clauses(target);
  const accepted=[];
  // Only intact, self-contained clauses in the same ordered slot with the same
  // boundary punctuation. Reject repeated fragments and groups spanning a boundary.
  if(a.length!==b.length||a.length<2) return {groups:[]};
  for(const [i,from] of a.entries()){
    const to=b[i], frame=normalize(from.body);
    if(frame!==normalize(to.body)||!/^[.;!?]$/.test(from.body.at(-1))||adverseBoundary.test(from.body)||
      [...from.body.matchAll(READER_TOKEN_PATTERN)].length<4||
      [a,b].some(rows=>rows.filter(row=>normalize(row.body)===frame).length!==1)) continue;
    const local=groups.filter(([spans])=>spans.every(([start,end])=>start>=from.start&&end<=from.end))
      .map(([spans,positions])=>[spans.map(([start,end])=>[start-from.start,end-from.start]),positions]);
    const mapped=projectExactTypography(from.body,to.body,local)||[];
    accepted.push(...mapped.map(([spans,p])=>[spans.map(([start,end])=>[start+to.start,end+to.start]),p]));
  }
  return {groups:wholeWordGroups(target,accepted),method:'exact-clause'};
}

function selectGroups(prior,candidates){
  const grouped=new Map();
  const existing=new Set(prior.map(key));
  const counts={alreadyCovered:0,overlap:0,ambiguous:0};
  for(const candidate of candidates){
    const signature=key(candidate.group);
    if(existing.has(signature)){counts.alreadyCovered++;continue;}
    if(prior.some(group=>englishOverlap(group,candidate.group)||!candidate.shared&&conflict(group,candidate.group))){counts.overlap++;continue;}
    if(!grouped.has(signature)) grouped.set(signature,{group:candidate.group,methods:new Set(),donors:new Set(),shared:candidate.shared===true});
    const row=grouped.get(signature);
    row.methods.add(candidate.method);
    if(candidate.donor) row.donors.add(candidate.donor);
  }
  const distinct=[...grouped.values()];
  const accepted=distinct.filter((row,i)=>{
    const disputed=distinct.some((other,j)=>i!==j&&conflict(row.group,other.group));
    if(disputed) counts.ambiguous++;
    return !disputed;
  });
  return {accepted,counts};
}

const fold=word=>word.normalize('NFD').replace(/\p{Mark}/gu,'').toLowerCase().replace(/ς/g,'σ');
const movableNu=new Map([
  ['G1510',new Set(['εστι','εστιν'])],
  ['G3956',new Set(['πασι','πασιν'])],
  ['G1107',new Set(['εγνωρισε','εγνωρισεν'])]
]);
function spellingMatches(tagForm,surface,id){
  const expected=fold(tagForm), actual=fold(surface);
  if(expected===actual) return true;
  // Paired inflections are enumerated. A trailing nu or apostrophe is never
  // removed from arbitrary words.
  const pair=movableNu.get(id);
  if(pair?.has(expected)&&pair.has(actual)) return true;
  return id==='G5123'&&new Set(['τουτ','τουτ᾽',"τουτ'"]).has(expected)&&
    new Set(['τουτ','τουτ᾽',"τουτ'"]).has(actual);
}

// These exceptions describe differences in how the pinned witnesses label
// identical inflections. None allows a position, surface or lemma to move.
const grammarReadings={
  'philemon:1:12':{
    8:['G3588','τα','T-NPN','T-APN'],
    9:['G1699','εμα','S-1SNPN','S-1SAPN'],
    10:['G4698','σπλαγχνα','N-NPN','N-APN']
  },
  'titus:2:1':{4:['G3739','α','R-APN','R-NPN']},
  'ephesians:3:3':{11:['G3641','ολιγω','A-DSM','A-DSN']},
  'ephesians:4:16':{
    18:['G1520','ενοσ','A-GSM','A-GSN'],
    19:['G1538','εκαστου','A-GSM','A-GSN'],
    28:['G1438','εαυτου','F-3GSM','F-3GSN']
  },
  'ephesians:5:12':{1:['G3588','τα','T-NPN','T-APN']}
};

function grammarMatches(record,expected){
  if(record.morphology===expected) return true;
  const form=fold(record.surface);
  if(expected==='ADV'&&record.morphology==='PREP'&&
    ((record.strongsNumber==='G5484'&&form==='χαριν')||(record.strongsNumber==='G2714'&&form==='κατενωπιον'))) return true;
  const ref=[record.bookId,record.chapter,record.verse].join(':');
  const reading=grammarReadings[ref]?.[record.tokenIndex+1];
  return Boolean(reading&&reading.every((field,i)=>field===[record.strongsNumber,form,expected,record.morphology][i]));
}

function lexicalMatches(record,expected,tagForm){
  if(record.strongsNumber===expected) return true;
  return record.bookId==='ephesians'&&record.chapter===6&&record.verse===10&&record.tokenIndex===1&&
    expected==='G3063'&&record.strongsNumber==='G3062'&&fold(tagForm)==='λοιπον'&&fold(record.surface)==='λοιπον'&&
    record.morphology==='A-ASN';
}

function taggedGreek(text,parsed,records){
  if(parsed?.reason||typeof parsed?.text!=='string') return {reason:parsed?.reason||'missing English tags'};
  if(!records.length||records.some((record,i)=>record.tokenIndex!==i||record.language!=='greek'||record.status!=='authoritative'))
    return {reason:'missing Greek witness'};
  const tags=new Map(), owners=new Map();
  for(const tag of parsed.tags){
    const {indexes,ids,forms,morphology,split}=tag;
    if(!indexes.length||indexes.length!==new Set(indexes).size||
      [ids,forms,morphology].some(values=>values.length!==indexes.length)) return {reason:'missing position metadata'};
    const positions=indexes.map(n=>n-1), groupKey=positions.join(',');
    const entry=tags.get(groupKey)||{spans:[],positions,split,safe:true};
    for(const [j,position] of positions.entries()){
      const token=records[position];
      if(!token||!lexicalMatches(token,ids[j],forms[j])||!spellingMatches(forms[j],token.surface,ids[j]))
        return {reason:'ordered Greek witness differs'};
      if(owners.has(position)&&(owners.get(position)!==groupKey||entry.split!==split||!/^x-split-\d+$/.test(split)))
        return {reason:'ambiguous native ownership'};
      owners.set(position,groupKey);
      if(!grammarMatches(token,morphology[j])) entry.safe=false;
    }
    if(tag.start<tag.end) entry.spans.push([tag.start,tag.end]);
    tags.set(groupKey,entry);
  }
  if(owners.size!==records.length) return {reason:'incomplete Greek witness'};
  const groups=[...tags.values()].filter(row=>row.safe&&row.spans.length).map(row=>[row.spans,row.positions]);
  const eligible=wholeWordGroups(parsed.text,groups);
  const mapped=projectExactTypography(parsed.text,text,eligible);
  if(!mapped) return {reason:'KJV English or supplied-word boundaries differ'};
  return {groups:wholeWordGroups(text,mapped),morphologyWithheld:[...tags.values()].filter(row=>!row.safe).length};
}

function finiteSecondPerson(text,records,groups){
  const row=records[0];
  if(row?.bookId!=='philemon'||row.chapter!==1||row.verse!==21) return [];
  const verb=records[12];
  if(verb?.strongsNumber!=='G4160'||verb.morphology!=='V-FAI-2S'||fold(verb.surface)!=='ποιησεισ') return [];
  // English spells out the subject and future tense expressed by the Greek
  // inflection. “Also” belongs to its own aligned group.
  const phrase=/\bknowing that (thou wilt) (also) (do) more than I say\.$/d.exec(text);
  if(!phrase||!groups.some(([spans,positions])=>positions.length===1&&positions[0]===12&&spans.some(span=>
    span[0]===phrase.indices[3][0]&&span[1]===phrase.indices[3][1]))) return [];
  return [{group:[[phrase.indices[1]],[12]],method:'greek-inflection',shared:true}];
}

module.exports={nativeTuple,key,conflict,wholeWordGroups,sharedText,selectGroups,taggedGreek,finiteSecondPerson};
