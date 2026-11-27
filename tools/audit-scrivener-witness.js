'use strict';

const fs=require('node:fs');
const {createHash}=require('node:crypto');
const path=require('node:path');
const {loadBibleLibrary}=require('./audit-word-study-coverage');
const {validateVerse,checksum,osisCodes}=require('./import-crosswire-kjv-alignment');
const {ignoreTransparentMarkup}=require('./audit-kjv-residual');
const canon=require('../js/bible/canon');
const edition=require('../docs/shell-83-edition-publication.json');
const primary=require('../docs/shell-76-crosswire-import.json');
const alternate=require('../docs/shell-82-kjv-tr-publication.json');
const holdout=require('../docs/shell-81-web-review-v1.json').holdout;
const root=path.resolve(__dirname,'..');
const pins={revision:'2bac2dae4a0961c84d6d544a40cbef8b8d8c4e32',
  sha256:'e61655e16e3c2d4078d4d0ae2fe063c3b9f90b109ede894a08d5f825b67f0b0b',
  noticeSha256:'f49cb4a21b5ed937c6163faa4e12bb1c21b839c43c7c59be615b376d10bc38e6'};
const sha=bytes=>createHash('sha256').update(bytes).digest('hex');
const count=(stats,reason)=>{stats[reason]=(stats[reason]||0)+1;};
const heldout=new Set(holdout.flatMap(row=>[row.passage.coordinate,...row.tokens.map(tok=>[tok.bookId,tok.chapter,tok.verse].join(':'))]));

function accepted(folder,files){
  const result=new Map();
  for(const [file,pin] of Object.entries(files)){
    const bytes=fs.readFileSync(path.join(root,'data/word-study/alignment',folder,file));
    if(sha(bytes)!==pin.sha256) throw Error('Prior accepted shard changed: '+folder+'/'+file);
    if(file!=='index.json') result.set(file,JSON.parse(bytes));
  }
  return result;
}
function run(osis,json,notice,accept){
  const english=fs.readFileSync(osis), native=fs.readFileSync(json),terms=fs.readFileSync(notice);
  if(sha(english)!==checksum||sha(native)!==pins.sha256||sha(terms)!==pins.noticeSha256)
    throw Error('Source checksum mismatch');
  const rows=new Map(),witness=new Map();
  for(const [,ref,body] of english.toString('utf8').matchAll(/<verse\b[^>]*\bosisID="([^"]+)"[^>]*\bsID="[^"]+"[^>]*\/>([\s\S]*?)<verse\b[^>]*\beID="\1"[^>]*\/>/g)){
    if(rows.has(ref)) throw Error('Duplicate CrossWire reference '+ref);
    rows.set(ref,body);
  }
  for(const row of JSON.parse(native)){
    const key=[row.book_name_osis,row.chapter,row.verse].join('.');
    if(witness.has(key)) throw Error('Duplicate Scrivener reference '+key);
    witness.set(key,row.words);
  }
  if(rows.size!==31102||witness.size!==7957) throw Error('Source population changed');
  const library=loadBibleLibrary('kjv.js','kjvLibrary'), old=accepted('kjv',primary.files), tr=accepted('kjv-tr',alternate.files);
  const editions=accepted('editions',edition.files);
  const revised=require('../docs/shell-84-corpus-publication.json');
  const corpus=accepted('corpus',revised.files);
  const report={pins,examined:0,strict:0,publishable:0,missing:0,reasons:{},books:{},sample:[]};
  for(const [index,bookId] of canon.order('kjv').entries()){
    if(index<39) continue;
    const book=library[bookId],code=osisCodes[index];
    for(let chapter=1;chapter<=book.chapters;chapter++){
      const file=bookId+'/'+chapter+'.json';
      for(const [i,text] of book[chapter].verses.entries()){
        const verse=i+1,reference=code+'.'+chapter+'.'+verse;
        if(old.get(file)?.[verse]||tr.get(file)?.verses[verse]||editions.get(file)?.kjv?.[verse]||
          corpus.get(file)?.editions?.kjv?.[verse]) continue;
        report.examined++;
        const raw=witness.get(reference)?.map(word=>({...word,greek:word.greek.replace(/[\u00b7\u0387.,;:!?]+$/,'')}));
        if(!raw){report.missing++;continue;}
        if(raw.some(word=>!Number.isInteger(word.strong)||word.strong<1||!word.grammar||
          !/^[\p{Script=Greek}\p{Mark}]+$/u.test(word.greek))){
          count(report.reasons,'unsupported Scrivener native word');continue;
        }
        const records=raw.map((word,tokenIndex)=>({surface:word.greek,strongsNumber:'G'+word.strong,morphology:word.grammar,
          language:'greek',tokenIndex,status:'authoritative',bookId,chapter,verse}));
        const result=validateVerse(text,ignoreTransparentMarkup(rows.get(reference)),records);
        if(!result.alignments){count(report.reasons,result.reason);continue;}
        report.strict++;
        if(heldout.has([bookId,chapter,verse].join(':'))||
          fs.existsSync(path.join(root,'data/word-study/original-language-variants',bookId+'-'+chapter+'-'+verse+'.json'))){
          count(report.reasons,'protected evaluation or existing override');continue;
        }
        const brackets=[...text.matchAll(/\[[^\]]*\]/g)];
        const groups=result.alignments.filter(([spans])=>!spans.some(([a,b])=>
          brackets.some(w=>a<w.index+w[0].length&&b>w.index)));
        if(!groups.length){count(report.reasons,'no nonsupplied group');continue;}
        report.publishable++;
        count(report.books,bookId);
        if(report.sample.length<6) report.sample.push({bookId,chapter,verse});
        accept?.({bookId,chapter,verse,text,groups,records});
      }
    }
  }
  return report;
}

if(require.main===module){
  const [osis,json,notice,output]=process.argv.slice(2);
  if(!output) throw Error('Expected the pinned CrossWire, Scrivener data, Scrivener notice and report filename');
  fs.writeFileSync(output,JSON.stringify(run(osis,json,notice),null,2)+'\n');
}
module.exports={run,pins};
