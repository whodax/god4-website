'use strict';

const fs=require('node:fs');
const path=require('node:path');
const {createHash}=require('node:crypto');
const {gzipSync}=require('node:zlib');
const {run}=require('./audit-kjv-expansion');
const {READER_TOKEN_PATTERN,normalizeDictionaryTerm}=require('./audit-word-study-coverage');
const canon=require('../js/bible/canon');

const root=path.resolve(__dirname,'..');
const audit=require('../docs/shell-82-kjv-witness-audit.json');
const primary=require('../docs/shell-76-crosswire-import.json');
const oldForms=require('../docs/shell-81-crosswalk-report.json').priority;
const words=text=>[...text.matchAll(READER_TOKEN_PATTERN)];
const sha=bytes=>createHash('sha256').update(bytes).digest('hex');
const sourceRevision=audit.trExperiment.revision;

function verifiedPrimary() {
  const verses=new Set();
  for(const [file,pin] of Object.entries(primary.files)){
    const data=fs.readFileSync(path.join(root,'data/word-study/alignment/kjv',file));
    if(sha(data)!==pin.sha256) throw new Error('Accepted KJV shard changed: '+file);
    for(const verse of Object.keys(JSON.parse(data))) verses.add(file.replace('.json','')+'/'+verse);
  }
  return verses;
}

function lexicalEntries() {
  const entries=new Map(), sources=[];
  for(const book of canon.order('kjv').slice(39)){
    const folder=path.join(root,'data/word-study/original-language',book);
    for(const filename of fs.readdirSync(folder).sort()){
      if(!/^\d+\.json$/.test(filename)) continue;
      const bytes=fs.readFileSync(path.join(folder,filename));
      const {lexicon,records}=JSON.parse(bytes);
      for(const [id,entry] of Object.entries(lexicon||{})){
        if(!entries.has(id)) entries.set(id,new Map());
        if(!entries.get(id).has(JSON.stringify(entry))) entries.get(id).set(JSON.stringify(entry),entry);
      }
      for(const record of records||[]){
        if(!record.strongsNumber||!record.lemma) continue;
        const id=record.strongsNumber, entry=[record.lemma,record.transliteration,record.pronunciation,record.definition];
        if(!entries.has(id)) entries.set(id,new Map());
        if(!entries.get(id).has(JSON.stringify(entry))) entries.get(id).set(JSON.stringify(entry),entry);
      }
      sources.push(book+'/'+filename+' '+sha(bytes));
    }
  }
  // Ambiguous lexical fields are omitted. Source disagreements do not change identity or position.
  const lexicon=new Map([...entries].filter(([,choices])=>choices.size===1)
    .map(([id,choices])=>[id,[...choices.values()][0]]));
  return {lexicon,checksum:sha(sources.join('\n'))};
}

function spanIntersectsSupplied(text,groups){
  return [...text.matchAll(/\[[^\]]*\]/g)].some(supplied=>{
    const suppliedWords=words(supplied[0]);
    return suppliedWords.some(word=>groups.some(([spans])=>spans.some(([start,end])=>
      start<supplied.index+word.index+word[0].length&&end>supplied.index+word.index)));
  });
}

async function generate(osis,trRepository,output){
  if(fs.existsSync(output)) throw new Error('Output directory must be fresh');
  const accepted=verifiedPrimary(), {lexicon,checksum}=lexicalEntries();
  const chapters=new Map();
  const report={version:1,baseline:audit.baseline,revision:sourceRevision,crosswire:audit.source,
    lexicalSourceChecksum:checksum,files:{},books:{},forms:{},remainingPriority:{},
    accepted:0,occurrences:0,publishedCoverage:null,excluded:{},coverageMissingLexiconTokens:0};
  const actual=await run(osis,trRepository,({bookId,chapter,verse,text,witness,groups})=>{
    const key=bookId+'/'+chapter,reference=key+'/'+verse;
    if(accepted.has(reference)||fs.existsSync(path.join(root,'data/word-study/original-language-variants',
      [bookId,chapter,verse].join('-')+'.json'))) throw new Error('Alternate path overlaps accepted KJV verse '+reference);
    if(spanIntersectsSupplied(text,groups)){
      report.excluded.suppliedWordOverlap=(report.excluded.suppliedWordOverlap||0)+1;
      return;
    }
    if(!chapters.has(key)) chapters.set(key,{bookId,chapter,revision:sourceRevision,lexicon:{},verses:{}});
    const shard=chapters.get(key);
    const tokens=witness.map(({surface,strongsNumber,morphology})=>{
      if(lexicon.has(strongsNumber)) shard.lexicon[strongsNumber]=lexicon.get(strongsNumber);
      else report.coverageMissingLexiconTokens++;
      return [surface,strongsNumber,morphology];
    });
    shard.verses[verse]=[text,tokens,groups];
    const book=report.books[bookId]||={verses:0,occurrences:0};
    book.verses++;
    report.accepted++;
    for(const word of words(text)){
      if(!groups.some(([spans])=>spans.some(([start,end])=>word.index>=start&&word.index+word[0].length<=end))) continue;
      const term=normalizeDictionaryTerm(word[0]);
      report.forms[term]=(report.forms[term]||0)+1;
      report.occurrences++;
      book.occurrences++;
    }
  });
  if(JSON.stringify(actual)!==JSON.stringify(audit)) throw new Error('Pinned KJV witness audit no longer reproduces');
  report.remainingPriority=Object.fromEntries(Object.keys(oldForms).map(form=>[form,report.forms[form]||0]));
  report.publishedCoverage={verses:5933+report.accepted,occurrences:124702+report.occurrences,
    priorityForms:475+Object.values(report.remainingPriority).filter(Boolean).length};
  const index={};
  function write(relative,data){
    const file=path.join(output,relative),bytes=Buffer.from(JSON.stringify(data)+'\n');
    fs.mkdirSync(path.dirname(file),{recursive:true});
    fs.writeFileSync(file,bytes);
    report.files[relative]={bytes:bytes.length,gzipBytes:gzipSync(bytes).length,sha256:sha(bytes)};
  }
  for(const [key,chapter] of chapters){
    (index[chapter.bookId]||={})[chapter.chapter]=Object.keys(chapter.verses).map(Number);
    write(key+'.json',chapter);
  }
  write('index.json',index);
  return report;
}

if(require.main===module){
  const [osis,trRepository,output,report]=process.argv.slice(2);
  if(!report) throw new Error('Expected pinned OSIS, TR repository, fresh output and report');
  generate(osis,trRepository,output).then(data=>fs.writeFileSync(report,JSON.stringify(data,null,2)+'\n'))
    .catch(error=>{console.error(error);process.exitCode=1;});
}

module.exports={generate,spanIntersectsSupplied};
