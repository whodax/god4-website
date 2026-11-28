'use strict';

const fs=require('node:fs');
const path=require('node:path');
const {createHash}=require('node:crypto');
const {gzipSync}=require('node:zlib');
const {loadBibleLibrary,TRANSLATIONS,READER_TOKEN_PATTERN,normalizeDictionaryTerm}=require('./audit-word-study-coverage');
const {provider,projection,projectGroups}=require('./import-web-alignment');
const {audit}=require('./audit-clear-bible-alignment');
const {validatePhrases}=require('./web-phrase-consensus');
const {ignoreTransparentMarkup,run:auditResidual}=require('./audit-kjv-residual');
const {readTaggedVerse,checksum,osisCodes}=require('./import-crosswire-kjv-alignment');
const {projectExactTypography}=require('./audit-kjv-expansion');
const {address}=require('./scripture-crosswalk');
const canon=require('../js/bible/canon');
const inline=require('../js/word-study/alignment');
const accepted=require('../docs/shell-83-edition-publication.json');
const baseline='99d5deb81ce7ddac555f61a5d0a8f87923e3988f';
const heldout=require('../docs/shell-81-web-review-v1.json').holdout;
const priority=require('../data/word-study/web-common-words.json').entries;
const remaining=Object.entries(require('../docs/shell-82-kjv-tr-publication.json').remainingPriority)
  .filter(([,count])=>!count).map(([form])=>form);
const sha=value=>createHash('sha256').update(value).digest('hex');
const root=path.resolve(__dirname,'..');
const edits=TRANSLATIONS.concat({id:'dra',file:'dra.js',variable:'draLibrary'});
const protectedRefs=new Set(heldout.flatMap(row=>[row.passage.coordinate,...row.tokens.map(coordinate)]));
const markers=/[\[\]{}<>]/;
const sensitive=/\b(?:not|no|none|never|neither|nor|without|unless|except|if|lest|only|cannot|nothing|nobody|nowhere)\b|n['\u2019]t\b/i;

function coordinate({bookId,chapter,verse}){return [bookId,chapter,verse].join(':');}
function bump(bucket,key){bucket[key]=(bucket[key]||0)+1;}
function words(text){
  return [...text.matchAll(READER_TOKEN_PATTERN)].map(match=>[match.index,match.index+match[0].length,match[0]]);
}
function groupKey([spans,positions]){
  return JSON.stringify([[...spans].sort((a,b)=>a[0]-b[0]),[...positions].sort((a,b)=>a-b)]);
}
function joint(first,second){
  const keys=new Set(second.map(groupKey));
  return first.filter(group=>keys.has(groupKey(group)));
}

function projected(target,source){
  const map=projection(source.text,target);
  return map.reason?[]:projectGroups(source.text,target,source.groups,map).alignments||[];
}

function englishAgreement(text,left,right){
  if(markers.test(text)||markers.test(left.text)||markers.test(right.text)) return [];
  const complete=joint(projected(text,left),projected(text,right));
  return complete.length?complete:validatePhrases(text,left,right).groups||[];
}

function signatures(source){
  const tokens=words(source.text);
  const signatures=new Map();
  for(const [spans,positions] of source.groups){
    if(positions.length!==1 || spans.length===0 ||
      source.groups.filter(([,p])=>p.includes(positions[0])).length!==1) continue;
    const selected=spans.map(([start,end])=>tokens.findIndex(([a,b])=>a===start&&b===end));
    if(selected.some((p,i)=>p<0||p!==selected[0]+i)) continue;
    const raw=source.text.slice(spans[0][0],spans.at(-1)[1]);
    if(!/^[a-z]+(?: [a-z]+)*$/i.test(raw)) continue;
    const phrase=raw.toLowerCase();
    if(tokens.filter((token,i)=>token[2].toLowerCase()===phrase.split(' ')[0] &&
      selected.every((_,j)=>tokens[i+j]?.[2].toLowerCase()===phrase.split(' ')[j])).length!==1) continue;
    signatures.set(positions[0],phrase);
  }
  return signatures;
}

function properNameAgreement(text,left,right,records){
  if(markers.test(text)) return [];
  const a=signatures(left),b=signatures(right),target=words(text);
  const hits=[];
  for(const [index,spelling] of a){
    if(b.get(index)!==spelling || !/^[a-z]+$/.test(spelling) ||
      !/^H(?:[^/]+\/)*Np$/.test(records[index].morphology)) continue;
    const candidates=target.filter(([, ,word])=>word.toLowerCase()===spelling);
    if(candidates.length!==1 || !/^[A-Z][a-z]+$/.test(candidates[0][2])) continue;
    // Reject independent claims that would link two native names to the same English occurrence.
    const [start,end]=candidates[0];
    hits.push([[[start,end]],[index]]);
  }
  return hits.filter(([[[start]]],i)=>hits.filter(([[[other]]])=>other===start).length===1);
}

function confirmedOutsideSupplied(text,groups){
  if(!/\[[^\[\]{}<>]+\]/.test(text)||markers.test(text.replace(/\[[^\[\]{}<>]+\]/g,''))) return [];
  const supplied=[...text.matchAll(/\[[^\[\]{}<>]+\]/g)];
  const touches=([start,end])=>supplied.some(word=>word.index<end&&word.index+word[0].length>start);
  const removed=groups.filter(([spans])=>spans.some(touches));
  const linked=new Set(removed.flatMap(([,ids])=>ids));
  return groups.filter(([spans,ids])=>!spans.some(touches)&&!ids.some(id=>linked.has(id)));
}
// Each accepted occurrence has two independently authored positional annotations, plus
// an exact KJV span in its own CrossWire lexical tag. Repeated English phrases are rejected.
function nativeKjvAgreement(text,parsed,left,right,records){
  if(parsed?.reason||!parsed?.text||[text,left.text,right.text].some(x=>sensitive.test(x))) return [];
  const english=words(text);
  const leftPhrases=signatures(left),rightPhrases=signatures(right);
  const accepted=[];
  for(const [position,phrase] of leftPhrases){
    if(rightPhrases.get(position)!==phrase) continue;
    const terms=phrase.split(' ');
    if(terms.every(term=>/^(?:a|an|and|as|at|but|by|for|from|in|into|of|on|or|the|to|with)$/.test(term))) continue;
    const matches=english.flatMap(([,,term],i)=>term.toLowerCase()===terms[0] &&
      terms.every((part,j)=>english[i+j]?.[2].toLowerCase()===part)?[i]:[]);
    if(matches.length!==1) continue;
    const i=matches[0],selected=english.slice(i,i+terms.length);
    const start=selected[0][0],end=selected.at(-1)[1];
    if(text.slice(start,end).toLowerCase()!==phrase) continue;
    const tags=parsed.tags.filter(tag=>tag.hebrewIds.length===1&&tag.hebrewIds[0]===records[position].strongsNumber);
    if(!tags.length) continue;
    const normalized=parsed.text===text?tags.map(tag=>[[[tag.start,tag.end]],[]]):
      projectExactTypography(parsed.text,text,tags.map(tag=>[[[tag.start,tag.end]],[]]));
    if(!normalized?.some(([[[low,high]]])=>low<=start&&high>=end)) continue;
    // A supplied word remains visible but cannot acquire an original-language edge.
    if([...text.matchAll(/\[[^\]]*\]/g)].some(word=>word.index<end&&word.index+word[0].length>start)) continue;
    accepted.push([selected.map(([a,b])=>[a,b]),[position]]);
  }
  return accepted.filter(([spans],i)=>!accepted.some(([other],j)=>i!==j&&spans.some(([a,b])=>other.some(([c,d])=>a<d&&c<b))));
}

function openOsis(file){
  const raw=fs.readFileSync(file);
  if(sha(raw)!==checksum) throw Error('CrossWire source checksum mismatch');
  const result=new Map();
  for(const [,ref,body] of raw.toString('utf8').matchAll(/<verse\b[^>]*\bosisID="([^"]+)"[^>]*\bsID="[^"]+"[^>]*\/>([\s\S]*?)<verse\b[^>]*\beID="\1"[^>]*\/>/g)){
    if(result.has(ref)) throw Error('Duplicate CrossWire reference '+ref);
    result.set(ref,body);
  }
  if(result.size!==31102) throw Error('Unexpected CrossWire reference count');
  return result;
}

function installedIndex(name,report){
  const input=fs.readFileSync(path.join(root,'data/word-study/alignment',name,'index.json'));
  if(sha(input)!==report.files['index.json'].sha256) throw Error('Accepted alignment index changed: '+name);
  return JSON.parse(input);
}
function publishedRows(name,report){
  const output=new Map();
  for(const [file,pin] of Object.entries(report.files)){
    const bytes=fs.readFileSync(path.join(root,'data/word-study/alignment',name,file));
    if(sha(bytes)!==pin.sha256) throw Error('Accepted alignment source changed: '+name+'/'+file);
    if(file!=='index.json') output.set(file,JSON.parse(bytes));
  }
  return output;
}

async function build(args){
  const {osis,clear,ult,uhb,ugnt,berean,shell79,tr,output}=args;
  if(fs.existsSync(output)) throw Error('Use a fresh output directory');
  const osisRows=openOsis(osis);
  const reports={
    kjv:require('../docs/shell-76-crosswire-import.json'),
    'kjv-tr':require('../docs/shell-82-kjv-tr-publication.json'),
    web:require('../docs/shell-80-web-alignment-report.json')
  };
  const previous=Object.fromEntries(Object.entries(reports).map(([name,report])=>[name,publishedRows(name,report)]));
  const last=installedIndex('editions',accepted);
  const target=Object.fromEntries(edits.map(({id,file,variable})=>[id,loadBibleLibrary(file,variable)]));
  const original=provider();
  const verseEvidence=[];
  const report={baseline,protectedPassages:33,sourcePins:{
    crossWire:{checksum},clear:require('./clear-bible-shell80-sources.json'),
    ult:require('./web-alignment-v92-source.json'),original:require('./web-alignment-sources.json').slice(1)},
    editions:{},files:{},ntResidual:null,examinedCandidateCoordinates:0};
  const stats=()=>({verses:0,occurrences:0,groups:0,methods:{},books:{},priority:Object.fromEntries(remaining.map(x=>[x,0])),
    candidateResults:{},screenByBook:{},markup:{examined:0,accepted:0}});
  for(const {id} of edits) report.editions[id]=stats();
  const shards=new Map(),index={};
  function screened(metrics,{bookId,chapter},category){
    bump(metrics.candidateResults,category);
    const chapters=metrics.screenByBook[bookId]||={};
    bump(chapters[chapter]||={},category);
  }
  function installed(id,{bookId,chapter,verse},records,text){
    const file=bookId+'/'+chapter+'.json';
    return last[id]?.[bookId]?.[chapter]?.includes(verse) ||
      (id==='kjv'&&(previous.kjv.get(file)?.[verse]||previous['kjv-tr'].get(file)?.verses[verse])) ||
      (id==='web'&&previous.web.get(file)?.[verse]) ||
      inline.lookup({translationId:id,bookId,chapter,verse,verseText:text},records).status==='available';
  }
  function save(id,{bookId,chapter,verse},text,records,groups,method){
    const file=bookId+'/'+chapter+'.json';
    const shard=shards.get(file)||{witnesses:{},editions:{}};
    if(shard.editions[id]?.[verse]) throw Error('Duplicate candidate output '+id+':'+coordinate({bookId,chapter,verse}));
    const tokens=records.map(record=>[record.surface,record.strongsNumber,record.morphology,record.language]);
    if(shard.witnesses[verse]&&JSON.stringify(shard.witnesses[verse])!==JSON.stringify(tokens))
      throw Error('Witness disagreement for shared file '+file+'/'+verse);
    shard.witnesses[verse]=tokens;
    (shard.editions[id]||={})[verse]=[text,groups,method];
    shards.set(file,shard);
    (((index[id]||={})[bookId]||={})[chapter]||=[]).push(verse);
    const ed=report.editions[id],book=ed.books[bookId]||={verses:0,occurrences:0,groups:0};
    const occurrences=words(text).filter(([a,b])=>groups.some(([spans])=>spans.some(([c,d])=>c<=a&&d>=b)));
    for(const scope of [ed,book]){scope.verses++;scope.occurrences+=occurrences.length;scope.groups+=groups.length;}
    for(const [, ,word] of occurrences){
      const form=normalizeDictionaryTerm(word);
      if(Object.hasOwn(ed.priority,form)) ed.priority[form]++;
    }
    bump(ed.methods,method);
  }
  for(const id of ['WLCM','SBLGNT']){
    await audit(id,clear,ult,uhb,ugnt,berean,shell79,null,{
      verse(row){if(row.ultEvidence) verseEvidence.push(row);}
    });
  }
  for(const {id,ref,context,records,evidence,ultEvidence} of verseEvidence){
    const key=coordinate(context);
    if(protectedRefs.has(key)||records.some(record=>protectedRefs.has(coordinate(record)))) continue;
    report.examinedCandidateCoordinates++;
    const {bookId,chapter,verse}=context;
    const bookCode=osisCodes[Number(ref.slice(0,2))-1];
    for(const {id:edition} of edits){
      const metrics=report.editions[edition];
      const text=target[edition][bookId]?.[chapter]?.verses?.[verse-1];
      if(!text||!address('reader-'+edition,key)) continue;
      if(installed(edition,context,records,text)){screened(metrics,context,'already verified');continue;}
      const native=edition==='web'?records:(await original.lookupVerse({...context,verseText:text,translationId:edition})).records;
      if(records.length!==native.length||!records.every((token,i)=>['bookId','chapter','verse','tokenIndex','surface','strongsNumber','language','morphology','source'].every(field=>token[field]===native[i][field]))){
        screened(metrics,context,'witness mismatch');continue;
      }
      const annotated=markers.test(text);
      if(annotated) metrics.markup.examined++;
      let groups=englishAgreement(text,evidence,ultEvidence),method=id==='WLCM'?'dual-hebrew':'dual-greek';
      if(!groups.length&&edition==='kjv'&&id==='WLCM'){
        const parsed=readTaggedVerse(ignoreTransparentMarkup(osisRows.get(bookCode+'.'+chapter+'.'+verse)));
        groups=nativeKjvAgreement(text,parsed,evidence,ultEvidence,native);
        method='crosswire-hebrew';
      }
      if(id==='WLCM'&&!annotated){
        const names=properNameAgreement(text,evidence,ultEvidence,native);
        const novel=names.filter(([[[a,b]],positions])=>!groups.some(([spans,linked])=>
          linked.includes(positions[0])||spans.some(([c,d])=>a<d&&c<b)));
        if(novel.length){
          groups=groups.concat(novel);
          method=method==='crosswire-hebrew'?'crosswire-and-names':(groups.length===novel.length?'dual-names':'dual-hebrew-and-names');
        }
      }
      if(!groups.length){screened(metrics,context,'no concordant verified spans');continue;}
      if(annotated) metrics.markup.accepted++;
      screened(metrics,context,'verified');
      save(edition,context,text,native,groups,method);
    }
  }
  // Revisit the Shell 83 punctuation-marked cases using only byte-identical KJV
  // verses and complete witness matches. Retain only groups outside supplied words.
  for(const [file,chapterRows] of previous.kjv){
    const [bookId,label]=file.slice(0,-5).split('/'),chapter=Number(label);
    for(const [verseKey,[sourceText,sourceTokens,groups]] of Object.entries(chapterRows)){
      if(!markers.test(sourceText)) continue;
      const verse=Number(verseKey),context={bookId,chapter,verse,verseText:sourceText};
      if(protectedRefs.has(coordinate(context))) continue;
      const safe=confirmedOutsideSupplied(sourceText,groups);
      if(!safe.length) continue;
      for(const {id} of edits){
        if(id==='kjv'||target[id][bookId]?.[chapter]?.verses?.[verse-1]!==sourceText) continue;
        const {records}=await original.lookupVerse({...context,translationId:id});
        if(installed(id,context,records,sourceText)||shards.get(file)?.editions[id]?.[verse]) continue;
        report.editions[id].markup.examined++;
        if(records.length!==sourceTokens.length||records.some((token,i)=>token.status!=='authoritative'||
          coordinate(token)!==coordinate(context)||token.tokenIndex!==i||token.language!=='greek'||
          token.surface!==sourceTokens[i][0]||token.strongsNumber!==sourceTokens[i][1]||
          token.morphology!==sourceTokens[i][2])) continue;
        report.editions[id].markup.accepted++;
        screened(report.editions[id],context,'verified');
        save(id,context,sourceText,records,safe,'crosswire-supplied');
      }
    }
  }
  report.ntResidual=await auditResidual(osis,tr,row=>{
    if(!protectedRefs.has(coordinate(row.context))&&!installed('kjv',row.context,row.records,row.context.verseText)){
      const groups=row.groups.filter(([spans])=>!spans.some(([a,b])=>[...row.context.verseText.matchAll(/\[[^\]]*\]/g)]
        .some(word=>word.index<b&&word.index+word[0].length>a)));
      if(groups.length){
        screened(report.editions.kjv,row.context,'verified');
        save('kjv',row.context,row.context.verseText,row.records,groups,'crosswire-title');
      }
    }
  });
  function write(file,value){
    const bytes=Buffer.from(JSON.stringify(value)+'\n');
    const filename=path.join(output,file);
    fs.mkdirSync(path.dirname(filename),{recursive:true});
    fs.writeFileSync(filename,bytes);
    report.files[file]={sha256:sha(bytes),bytes:bytes.length,gzipBytes:gzipSync(bytes).length};
  }
  for(const [file,shard] of shards) write(file,shard);
  write('index.json',index);
  return report;
}

if(require.main===module){
  const [osis,clear,ult,uhb,ugnt,berean,shell79,tr,output,report]=process.argv.slice(2);
  if(!report) throw Error('Expected pinned OSIS, Clear folder, ULT, UHB, UGNT, Berean TSV, Shell 79 folder, parsed TR repo, fresh output and report');
  build({osis,clear,ult,uhb,ugnt,berean,shell79,tr,output}).then(result=>fs.writeFileSync(report,JSON.stringify(result,null,2)+'\n'))
    .catch(error=>{console.error(error);process.exitCode=1;});
}

module.exports={build,englishAgreement,nativeKjvAgreement,properNameAgreement,confirmedOutsideSupplied};
