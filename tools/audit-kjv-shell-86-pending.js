'use strict';

const fs=require('node:fs');
const path=require('node:path');
const {runtime,tokens,supplied}=require('./audit-word-study-corpus');
const {loadBibleLibrary}=require('./audit-word-study-coverage');
const {sourceFiles,alternateRecords}=require('./import-word-study-extensions');
const {provider}=require('./import-web-alignment');
const {readTaggedVerse,osisCodes}=require('./import-crosswire-kjv-alignment');
const {ignoreTransparentMarkup}=require('./audit-kjv-residual');
const {taggedGreek}=require('./word-study-extension-evidence');
const canon=require('../js/bible/canon');
const root=path.resolve(__dirname,'../data/word-study/alignment');
const read=(folder,file)=>JSON.parse(fs.readFileSync(path.join(root,folder,file),'utf8'));
const count=(map,key)=>map[key]=(map[key]||0)+1;

async function audit(osis,scrivener,notice){
  const input=sourceFiles(osis,scrivener,notice);
  const bible=loadBibleLibrary('kjv.js','kjvLibrary'), engine=runtime(), original=provider();
  const names=['kjv-tr','editions','corpus','kjv-scrivener','extensions','continuations'];
  const indexes=Object.fromEntries(names.map(folder=>[folder,read(folder,'index.json')]));
  const report={missing:[],partial:[],full:0,reasons:{},boundaryLeads:[]};
  for(const [i,bookId] of canon.order('kjv').entries()){
    if(i<39) continue;
    for(const [label,{verses}] of Object.entries(bible[bookId])){
      if(!Array.isArray(verses)) continue;
      const chapter=Number(label);
      const file=bookId+'/'+chapter+'.json';
      const primary=fs.existsSync(path.join(root,'kjv',file))?read('kjv',file):{};
      for(const [j,verseText] of verses.entries()){
        if(!verseText?.trim()) continue;
        const verse=j+1, context={translationId:'kjv',bookId,chapter,verse,verseText};
        const coordinate=chapter+':'+verse, ref=[osisCodes[i],chapter,verse].join('.');
        const available=folder=>{
          const index=indexes[folder];
          return (index.kjv||index)[bookId]?.[chapter]?.includes(verse);
        };
        let {records}=await original.lookupVerse(context);
        let result=engine.lookup(context,records);
        if(result?.status!=='available'&&primary[verse]) result=await engine.lookupChapter(context,records);
        if(result?.status!=='available'&&available('kjv-tr')&&!records[0]?.source?.startsWith('Textus Receptus,')){
          const hit=await engine.lookupKjvWitness(context);
          if(hit){records=hit.records;result=hit.alignment;}
        }
        if(result?.status!=='available'&&available('editions')) result=await engine.lookupEdition(context,records);
        if(result?.status!=='available'&&available('corpus')) result=await engine.lookupCorpus(context,records);
        if(result?.status!=='available'&&available('kjv-scrivener')&&!records[0]?.source?.startsWith('Textus Receptus,')){
          const hit=await engine.lookupScrivenerWitness(context);
          if(hit){records=hit.records;result=hit.alignment;}
        }
        for(const [folder,method] of [['extensions','lookupExtension'],['continuations','lookupContinuation']]){
          if(!available(folder)) continue;
          const hit=await engine[method](context,records,result);
          if(!hit) throw Error('Published '+folder+' missing at '+bookId+' '+coordinate);
          records=hit.records;result=hit.alignment;
        }
        const brackets=supplied(verseText,'kjv'), groups=result?.groups||[];
        const unaligned=tokens(verseText).filter(word=>
          !brackets.some(([a,b])=>a<=word.start&&b>=word.end)&&
          !groups.some(group=>group.english.some(span=>span.start<=word.start&&span.end>=word.end)));
        if(!unaligned.length){report.full++;continue;}
        const body=input.rows.get(ref), parsed=body&&readTaggedVerse(ignoreTransparentMarkup(body));
        if(!groups.length){
          const fallback=alternateRecords(input.alternate.get(ref),context);
          const tryNative=fallback||records, trial=taggedGreek(verseText,parsed,tryNative);
          const reason=trial.reason||'no compatible nonconflicting publishable group';
          report.missing.push({bookId,chapter,verse,eligible:unaligned.length,reason});
          count(report.reasons,reason);
        }else{
          report.partial.push({bookId,chapter,verse,remaining:unaligned.length});
          const lastOwned=groups.reduce((n,g)=>Math.max(n,...g.english.map(span=>span.end)),0);
          const next=[osisCodes[i],chapter,verse+1].join('.'), nextBody=input.rows.get(next);
          if(!nextBody||unaligned.some(word=>word.start<lastOwned)) continue;
          const nextTags=readTaggedVerse(ignoreTransparentMarkup(nextBody));
          const firstVisible=nextTags.tags?.filter(tag=>tag.start<tag.end).flatMap(tag=>tag.indexes);
          if(!firstVisible?.length||Math.min(...firstVisible)<=1) continue;
          report.boundaryLeads.push({bookId,chapter,verse,uncoveredTail:unaligned.map(word=>word.displayWord),
            nextVerse:verse+1,unclaimedLeadingPositions:Math.min(...firstVisible)-1,status:'requires positional and clause evidence'});
        }
      }
    }
  }
  return report;
}
if(require.main===module){
  const [osis,scrivener,notice,output]=process.argv.slice(2);
  if(!output) throw Error('Expected pinned CrossWire OSIS, Scrivener JSON and notice, and report filename');
  audit(osis,scrivener,notice).then(report=>fs.writeFileSync(output,JSON.stringify(report)+'\n')).catch(error=>{
    console.error(error);process.exitCode=1;
  });
}
module.exports={audit};
