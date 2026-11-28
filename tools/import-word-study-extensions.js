'use strict';

const fs=require('node:fs');
const path=require('node:path');
const {createHash}=require('node:crypto');
const {gzipSync}=require('node:zlib');
const {TRANSLATIONS,loadBibleLibrary}=require('./audit-word-study-coverage');
const {runtime,tokens}=require('./audit-word-study-corpus');
const {provider,books,loadSource,readOriginal,readAlignment,validateVerse,manuscriptMatches}=require('./import-web-alignment');
const {englishAgreement,nativeKjvAgreement,properNameAgreement}=require('./import-word-study-corpus');
const {load:loadBerean,validate:validateBerean}=require('./word-study-berean');
const {readTaggedVerse,checksum,osisCodes}=require('./import-crosswire-kjv-alignment');
const {ignoreTransparentMarkup}=require('./audit-kjv-residual');
const {sharedText,terminalPunctuationProjection,nativeTuple,wholeWordGroups,selectGroups,taggedGreek,finiteSecondPerson}=require('./word-study-extension-evidence');
const {pins:scrivenerPin}=require('./audit-scrivener-witness');
const {address}=require('./scripture-crosswalk');
const canon=require('../js/bible/canon');

const baseline='748defc3fa1628dd79575ff3ca492a6a0836f8b0';
const ids=TRANSLATIONS.concat({id:'dra',file:'dra.js',variable:'draLibrary'});
const root=path.resolve(__dirname,'..');
const archive=path.join(root,'data/word-study/alignment');
const sha=bytes=>createHash('sha256').update(bytes).digest('hex');
const coordinate=({bookId,chapter,verse})=>[bookId,chapter,verse].join(':');
const witnesses={
  kjv:'76-crosswire-import','kjv-tr':'82-kjv-tr-publication',web:'80-web-alignment-report',
  editions:'83-edition-publication',corpus:'84-corpus-publication','kjv-scrivener':'84-scrivener-publication'
};
const heldout=require('../docs/shell-81-web-review-v1.json').holdout;
const protectedRefs=new Set(heldout.flatMap(row=>[row.passage.coordinate,...row.tokens.map(coordinate)]));
const priority=require('../data/word-study/web-common-words.json').entries;
const originalPins=require('./web-alignment-sources.json').slice(1);
const ultPin=require('./web-alignment-v92-source.json');
const count=(record,label,delta=1)=>{record[label]=(record[label]||0)+delta;};
const includes=(group,word)=>group[0].some(([a,b])=>a<=word.start&&b>=word.end);

function loadAccepted(includeExtensions=false){
  const inputs=includeExtensions?{...witnesses,extensions:'85-alignment-publication'}:witnesses;
  const files={};
  for(const [folder,name] of Object.entries(inputs)){
    const manifest=require('../docs/shell-'+name+'.json');
    files[folder]={};
    for(const [filename,pin] of Object.entries(manifest.files)){
      const bytes=fs.readFileSync(path.join(archive,folder,filename));
      if(sha(bytes)!==pin.sha256) throw Error('Accepted input changed: '+folder+'/'+filename);
      files[folder][filename]=JSON.parse(bytes);
    }
  }
  return files;
}
function sourceFiles(osis,scrivener,notice){
  const english=fs.readFileSync(osis), greek=fs.readFileSync(scrivener);
  if(sha(english)!==checksum||sha(greek)!==scrivenerPin.sha256||sha(fs.readFileSync(notice))!==scrivenerPin.noticeSha256)
    throw Error('CrossWire or Scrivener checksums differ');
  const rows=new Map(), alternate=new Map();
  for(const [,key,body] of english.toString('utf8').matchAll(/<verse\b[^>]*\bosisID="([^"]+)"[^>]*\bsID="[^"]+"[^>]*\/>([\s\S]*?)<verse\b[^>]*\beID="\1"[^>]*\/>/g)){
    if(rows.has(key)) throw Error('Duplicate CrossWire reference '+key);
    rows.set(key,body);
  }
  for(const {book_name_osis,chapter,verse,words} of JSON.parse(greek)){
    const key=[book_name_osis,chapter,verse].join('.');
    if(alternate.has(key)) throw Error('Duplicate Scrivener reference '+key);
    alternate.set(key,words);
  }
  if(rows.size!==31102||alternate.size!==7957) throw Error('Source population differs');
  return {rows,alternate};
}
function alternateRecords(words,context){
  const result=words?.map(({greek,strong,grammar},tokenIndex)=>({
    bookId:context.bookId,chapter:context.chapter,verse:context.verse,tokenIndex,
    surface:greek.replace(/[\u00b7\u0387.,;:!?\u1fbd\u2019']+$/u,''),
    strongsNumber:'G'+strong,morphology:grammar,language:'greek',status:'authoritative'
  }));
  if(!result?.length||result.some(row=>!/^[\p{Script=Greek}\p{Mark}]+$/u.test(row.surface)||
    !/^G[1-9]\d{0,4}$/.test(row.strongsNumber)||!(/^[A-Z][A-Z0-9-]+$/).test(row.morphology))) return null;
  return result;
}
function compact(alignment){
  return alignment?.status==='available'?alignment.groups.map(group=>[
    group.english.map(span=>[span.start,span.end]),group.original
  ]):[];
}
function testPriority({bookId}){return ['philemon','titus','ephesians'].includes(bookId);}
function authoritative(records,context){
  return records.length&&records.every((record,i)=>record.status==='authoritative'&&
    record.tokenIndex===i&&coordinate(record)===coordinate(context));
}

async function build(args){
  const {osis,scrivener,notice,ult,uhb,ugnt,berean,output,continuation=false}=args;
  if(fs.existsSync(output)) throw Error('Use a fresh directory for extension output');
  const previous=loadAccepted(continuation), engine=runtime(), original=provider();
  const {rows,alternate}=sourceFiles(osis,scrivener,notice);
  const [hebrew,greek]=[loadSource(uhb,originalPins[0]),loadSource(ugnt,originalPins[1])];
  const literal=loadSource(ult,ultPin), publisher=loadBerean(berean);
  const bibles=Object.fromEntries(ids.map(({id,file,variable})=>[id,loadBibleLibrary(file,variable)]));
  const canonById=Object.fromEntries(ids.map(({id})=>[id,new Set(canon.order(id))]));
  const inline=new Set(engine.catalog.map(row=>row.translationId+':'+coordinate(row)));
  const sourcePins={crossWire:checksum,scrivener:scrivenerPin,ult:ultPin,original:originalPins,
    berean:{sha256:sha(fs.readFileSync(berean)),license:'CC0 1.0',source:'https://bereanbible.com/downloads.htm'}};
  const report={baseline:continuation?'170063fcbb98fb7222202194ff986527032adef4':baseline,sourcePins,protectedPassages:heldout.length,screening:{},editions:{},files:{},priorityBooks:{}};
  const index={}, chapters=new Map();
  const metrics=()=>({newVerses:0,improvedVerses:0,occurrences:0,groups:0,methods:{},screening:{},priority:{},books:{}});
  for(const {id} of ids) report.editions[id]=metrics();

  async function resolve(context,file,records){
    const {translationId:id,verse}=context;
    const hasInline=inline.has(id+':'+coordinate(context));
    const hasPrimary=(id==='kjv'||id==='web')&&previous[id][file]?.[verse];
    const hasTR=id==='kjv'&&previous['kjv-tr'][file]?.verses[verse]&&!records[0]?.source?.startsWith('Textus Receptus,');
    const hasEdition=previous.editions[file]?.[id]?.[verse];
    const hasCorpus=previous.corpus[file]?.editions[id]?.[verse];
    const hasScrivener=id==='kjv'&&previous['kjv-scrivener'][file]?.verses[verse]&&!records[0]?.source?.startsWith('Textus Receptus,');
    let resolved=hasInline&&engine.lookup(context,records);
    if(resolved?.status!=='available'&&hasPrimary) resolved=await engine.lookupChapter(context,records);
    if(resolved?.status!=='available'&&hasTR){
      const hit=await engine.lookupKjvWitness(context);
      if(hit){records=hit.records;resolved=hit.alignment;}
    }
    if(resolved?.status!=='available'&&hasEdition) resolved=await engine.lookupEdition(context,records);
    if(resolved?.status!=='available'&&hasCorpus) resolved=await engine.lookupCorpus(context,records);
    if(resolved?.status!=='available'&&hasScrivener){
      const hit=await engine.lookupScrivenerWitness(context);
      if(hit){records=hit.records;resolved=hit.alignment;}
    }
    if(continuation&&previous.extensions[file]?.editions?.[id]?.[verse]){
      const hit=await engine.lookupExtension(context,records,resolved);
      if(!hit) throw Error('Accepted extension missing '+id+':'+coordinate(context));
      records=hit.records;
      resolved=hit.alignment;
    }
    return {records,groups:compact(resolved),alternate:/^(?:Scrivener 1894|Textus Receptus,)/.test(records[0]?.source||'')};
  }

  function save(context,file,records,mode,selected,existing){
    const {bookId,chapter,verse,translationId:id,verseText}=context;
    const shard=chapters.get(file)||{witnesses:[],editions:{}};
    const tuple=records.map(nativeTuple), signature=JSON.stringify(tuple);
    let witness=shard.witnesses.findIndex(row=>JSON.stringify(row)===signature);
    if(witness<0) witness=shard.witnesses.push(tuple)-1;
    const groups=selected.map(row=>row.group);
    const methods=[...new Set(selected.flatMap(row=>[...row.methods]))].sort();
    (shard.editions[id]||={})[verse]=[verseText,witness,groups,methods,mode,selected.map(row=>[...row.donors].sort()),selected.flatMap((row,i)=>row.shared?[i]:[])];
    chapters.set(file,shard);
    (((index[id]||={})[bookId]||={})[chapter]||=[]).push(verse);
    const ed=report.editions[id], book=ed.books[bookId]||=metrics();
    const delta=tokens(verseText).filter(word=>groups.some(group=>includes(group,word))&&!existing.some(group=>includes(group,word)));
    for(const scope of [ed,book]){
      count(scope,existing.length?'improvedVerses':'newVerses');
      scope.occurrences+=delta.length;
      scope.groups+=groups.length;
      for(const method of methods) count(scope.methods,method);
      for(const {term} of delta) if(Object.hasOwn(priority,term)) count(scope.priority,term);
    }
  }

  for(const [bookIndex,bookId] of canon.order('kjv').entries()){
    const code=osisCodes[bookIndex], usfm=books[bookIndex];
    for(const [chapterLabel,section] of Object.entries(bibles.kjv[bookId])){
      if(!Array.isArray(section?.verses)) continue;
      const chapter=Number(chapterLabel), file=bookId+'/'+chapter+'.json';
      const pinnedVariant=verse=>fs.existsSync(path.join(archive,'../original-language-variants',bookId+'-'+chapter+'-'+verse+'.json'));
      for(const [i,kjvText] of section.verses.entries()){
        const verse=i+1, location={bookId,chapter,verse}, ref=coordinate(location);
        if(protectedRefs.has(ref)){count(report.screening,'held-out');continue;}
        const key=chapter+':'+verse, full=code+'.'+chapter+'.'+verse;
        const entries=ids.flatMap(({id})=>{
          const verseText=bibles[id][bookId]?.[chapter]?.verses?.[i];
          return verseText?.trim()&&canonById[id].has(bookId)&&address('reader-'+id,ref)?[
            {translationId:id,...location,verseText}]:[];
        });
        if(!entries.length) continue;
        const validationContext=entries.find(entry=>entry.translationId==='kjv')||entries[0];
        const {records:native}=await original.lookupVerse(validationContext);
        if(!authoritative(native,location)){count(report.screening,'Reader witness unavailable or shifted');continue;}
        const variant=pinnedVariant(verse);
        const evaluations=[];
        for(const context of entries){
          const records=context===validationContext?native:(await original.lookupVerse(context)).records;
          if(!authoritative(records,location)){
            count(report.editions[context.translationId].screening,'edition reference or witness differs');
            continue;
          }
          const current=await resolve(context,file,records);
          evaluations.push({context,...current,candidates:[],mode:'reader'});
        }
        const kjv=evaluations.find(row=>row.context.translationId==='kjv');
        if(bookIndex>=39&&kjv&&tokens(kjvText).some(word=>!kjv.groups.some(group=>includes(group,word)))){
          const body=rows.get(full);
          const parsed=body?readTaggedVerse(ignoreTransparentMarkup(body)):null;
          let result=taggedGreek(kjvText,parsed,kjv.records);
          if(!result.groups?.length&&!kjv.groups.length&&!variant){
            const witness=alternateRecords(alternate.get(full),location);
            if(witness){
              const next=taggedGreek(kjvText,parsed,witness);
              if(next.groups?.length){result=next;kjv.records=witness;kjv.mode='scrivener';}
            }
          }
          count(report.screening,result.reason||'CrossWire positional groups passed');
          if(result.morphologyWithheld) count(report.screening,'CrossWire groups withheld for morphology',result.morphologyWithheld);
          if(result.groups) kjv.candidates.push(...result.groups.map(group=>({group,method:'crosswire-position'})));
          kjv.candidates.push(...finiteSecondPerson(kjvText,kjv.records,kjv.groups));
        }
        const raw=literal.get(usfm)?.get(key), br=publisher.get(bookId)?.get(key);
        const rawWitness=(bookIndex<39?hebrew:greek).get(usfm)?.get(key);
        // Only independent positional datasets are paired. A second copy of a
        // Berean annotation, or a Strong number by itself, is insufficient.
        if(raw&&br&&rawWitness&&!variant){
          const anchor=readOriginal(rawWitness), parsed=readAlignment(raw);
          const bereanHit=validateBerean(br,anchor,native,manuscriptMatches,continuation);
          if(!parsed.reason&&bereanHit.groups){
            const ultHit=validateVerse(parsed.english,raw,anchor,native);
            if(ultHit.alignments){
              const left={text:br.english,groups:bereanHit.groups},right={text:parsed.english,groups:ultHit.alignments};
              count(report.screening,'both external positional datasets resolved');
              for(const row of evaluations){
                if(row.alternate||row.mode!=='reader'||JSON.stringify(row.records.map(nativeTuple))!==JSON.stringify(native.map(nativeTuple))) continue;
                const text=row.context.verseText;
                if(tokens(text).every(word=>row.groups.some(group=>includes(group,word)))) continue;
                const groups=englishAgreement(text,left,right);
                if(bookIndex<39) groups.push(...properNameAgreement(text,left,right,native));
                if(bookIndex<39&&row===kjv){
                  const body=rows.get(full);
                  if(body) groups.push(...nativeKjvAgreement(text,readTaggedVerse(ignoreTransparentMarkup(body)),left,right,native));
                }
                row.candidates.push(...wholeWordGroups(text,groups).map(group=>({group,method:continuation?'berean-ult-morphology':'berean-ult'})));
              }
            }else count(report.screening,'ULT '+ultHit.reason);
          }else count(report.screening,parsed.reason?'ULT '+parsed.reason:'Berean '+bereanHit.reason);
        }
        for(const target of evaluations){
          if(!authoritative(target.records,location)) continue;
          const signature=JSON.stringify(target.records.map(nativeTuple));
          for(const donor of evaluations){
            if(donor===target||!donor.groups.length||!authoritative(donor.records,location)||
              signature!==JSON.stringify(donor.records.map(nativeTuple))) continue;
            const {groups,method}=sharedText(donor.context.verseText,target.context.verseText,donor.groups);
            target.candidates.push(...groups.map(group=>({group,method,donor:donor.context.translationId})));
          }
          if(continuation){
            for(const donor of evaluations){
              if(donor===target||!donor.groups.length||!authoritative(donor.records,location)||
                signature!==JSON.stringify(donor.records.map(nativeTuple))) continue;
              const groups=terminalPunctuationProjection(donor.context.verseText,target.context.verseText,donor.groups);
              target.candidates.push(...groups.map(group=>({group,method:'terminal-punctuation',donor:donor.context.translationId})));
            }
          }
          const {accepted,counts}=selectGroups(target.groups,target.candidates);
          const metrics=report.editions[target.context.translationId];
          for(const [category,n] of Object.entries(counts)) if(n) count(metrics.screening,category,n);
          if(accepted.length) save(target.context,file,target.records,target.mode,accepted,target.groups);
          if(target===kjv&&testPriority(location)){
            const selected=target.groups.concat(accepted.map(row=>row.group));
            const remaining=tokens(target.context.verseText).filter(word=>!selected.some(group=>includes(group,word))&&
              ![...target.context.verseText.matchAll(/\[[^\]]*\]/g)].some(mark=>mark.index<=word.start&&mark.index+mark[0].length>=word.end));
            const book=report.priorityBooks[bookId]||={verses:0,fullyAligned:0,remaining:{}};
            book.verses++;
            if(!remaining.length) book.fullyAligned++;
            else book.remaining[chapter+':'+verse]=remaining.map(word=>word.displayWord);
          }
        }
      }
    }
  }

  function write(file,value){
    const bytes=Buffer.from(JSON.stringify(value)+'\n');
    const out=path.join(output,file);
    fs.mkdirSync(path.dirname(out),{recursive:true});
    fs.writeFileSync(out,bytes);
    report.files[file]={bytes:bytes.length,gzipBytes:gzipSync(bytes).length,sha256:sha(bytes)};
  }
  for(const [file,shard] of chapters) write(file,shard);
  write('index.json',index);
  return report;
}

if(require.main===module){
  const [osis,scrivener,notice,ult,uhb,ugnt,berean,output,report,mode]=process.argv.slice(2);
  if(!report) throw Error('Expected CrossWire OSIS, Scrivener JSON and README, ULT, UHB, UGNT, Berean TSV, fresh output and report');
  build({osis,scrivener,notice,ult,uhb,ugnt,berean,output,continuation:mode==='continuation'}).then(value=>fs.writeFileSync(report,JSON.stringify(value,null,2)+'\n'))
    .catch(error=>{console.error(error);process.exitCode=1;});
}

module.exports={build,sourceFiles,alternateRecords};
