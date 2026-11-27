'use strict';

const fs = require('node:fs');
const path = require('node:path');
const {createHash} = require('node:crypto');
const {loadBibleLibrary, READER_TOKEN_PATTERN, normalizeDictionaryTerm} = require('./audit-word-study-coverage');
const canon = require('../js/bible/canon');
const priority = require('../data/word-study/web-common-words.json').entries;
const root = path.resolve(__dirname,'..');
const revision = 'd490be7e34762deb2c76cb2c1306d4808e27890d';
const checksum = '4bcbfe45722fca396adbeac9c81025bbb173cb1e30296da90864f0400cb0e3f5';
const osisCodes = 'Gen Exod Lev Num Deut Josh Judg Ruth 1Sam 2Sam 1Kgs 2Kgs 1Chr 2Chr Ezra Neh Esth Job Ps Prov Eccl Song Isa Jer Lam Ezek Dan Hos Joel Amos Obad Jonah Mic Nah Hab Zeph Hag Zech Mal Matt Mark Luke John Acts Rom 1Cor 2Cor Gal Eph Phil Col 1Thess 2Thess 1Tim 2Tim Titus Phlm Heb Jas 1Pet 2Pet 1John 2John 3John Jude Rev'.split(' ');
const words = text => [...text.matchAll(READER_TOKEN_PATTERN)];
const surface = text => text.normalize('NFD').replace(/\p{Mark}/gu,'').toLowerCase().replace(/ς/g,'σ');
const decode = text => text.replace(/&([^;]+);/g,(_,entity)=>{
  const named = {amp:'&',lt:'<',gt:'>',quot:'"',apos:"'"};
  if(Object.hasOwn(named,entity)) return named[entity];
  if(/^#x[\da-f]+$/i.test(entity)) return String.fromCodePoint(parseInt(entity.slice(2),16));
  if(/^#\d+$/.test(entity)) return String.fromCodePoint(Number(entity.slice(1)));
  throw new Error('Unknown XML entity '+entity);
});
const attr = (tag,name) => tag.match(new RegExp('(?:^|\\s)'+name+'="([^"]*)"'))?.[1] || '';
const reject = (reason, ambiguous=false) => ({reason,ambiguous});

function readTaggedVerse(body){
  let text='', pendingSpace=false;
  const tags=[], stack=[];
  body=body.replace(/<note\b[^>]*(?<!\/)>([\s\S]*?)<\/note>/g,'');
  const append=value=>{
    for(const part of decode(value).match(/\s+|\S+/g) || []){
      if(/^\s/.test(part)){pendingSpace=true;continue;}
      if(pendingSpace && text.length) text+=' ';
      pendingSpace=false;
      text+=part;
    }
  };
  for(const item of body.match(/<[^>]+>|[^<]+/g) || []){
    if(!item.startsWith('<')){append(item);continue;}
    const element=item.match(/^<(\/?)([\w:-]+)\b/);
    if(!element) return reject('unsupported markup');
    const [,closing,name]=element;
    // CrossWire uses markerless quotes for red letters, sometimes across verses.
    if(name==='q' && (closing || /\bmarker=""/.test(item))) continue;
    if(closing){
      const open=stack.pop();
      if(open?.name!==name) return reject('unbalanced markup');
      if(name==='w'){open.tag.end=text.length;tags.push(open.tag);}
      if(open.added) append(']');
      continue;
    }
    const selfClosing=item.endsWith('/>');
    if(name==='w'){
      const tag={
        start:text.length+(pendingSpace && text.length ? 1 : 0),end:text.length,
        indexes:attr(item,'src').trim().split(/\s+/).filter(Boolean).map(Number),
        ids:[...attr(item,'lemma').matchAll(/(?:^|\s)strong:G0*(\d+)/g)].map(match=>'G'+Number(match[1])),
        forms:[...attr(item,'lemma').matchAll(/(?:^|\s)lemma\.TR:([^\s]+)/g)].map(match=>surface(decode(match[1]))),
        morphology:[...attr(item,'morph').matchAll(/(?:^|\s)robinson:([^\s]+)/g)].map(match=>match[1]),
        split:attr(item,'type')
      };
      if(stack.some(open=>open.name==='w')) return reject('overlapping word tags',true);
      if(selfClosing) tags.push(tag);
      else stack.push({name,tag});
    }else if(name==='transChange' && attr(item,'type')==='added' && !selfClosing){
      append('[');
      stack.push({name,added:true});
    }else if(selfClosing && ['lb','milestone','note'].includes(name)){
      if(name==='lb') pendingSpace=true;
    }else return reject('unsupported markup');
  }
  return stack.length ? reject('unbalanced markup') : {text,tags};
}

function validateVerse(verseText,body,records){
  const parsed=readTaggedVerse(body);
  if(parsed.reason) return parsed;
  if(parsed.text!==verseText) return reject('English text or supplied-word boundary differs');
  if(!records.length || !records.every((record,index)=>record.tokenIndex===index && record.language==='greek' && record.status==='authoritative')){
    return reject('Greek source verse unavailable');
  }
  const selectedWords=words(verseText);
  const groups=new Map(), owners=new Map();
  for(const tag of parsed.tags){
    const {start,end,indexes,ids,forms,morphology,split}=tag;
    if(!indexes.length || indexes.length!==new Set(indexes).size || ![ids,forms,morphology].every(list=>list.length===indexes.length)){
      return reject('missing or ambiguous position metadata',true);
    }
    const original=indexes.map(index=>index-1);
    for(const [position,index] of original.entries()){
      const actual=records[index];
      if(!actual || surface(actual.surface)!==forms[position] || actual.strongsNumber!==ids[position]){
        return reject('Greek position, surface or Strong identity differs');
      }
      if(actual.morphology!==morphology[position]) return reject('Greek morphology differs');
    }
    const visible=start<end;
    if(visible && (!selectedWords.some(word=>word.index>=start && word.index+word[0].length<=end) ||
      selectedWords.some(word=>word.index<end && word.index+word[0].length>start &&
        (word.index<start || word.index+word[0].length>end)))) return reject('English span splits selectable word',true);
    const groupKey=original.join(',');
    for(const index of original){
      if(owners.has(index) && (owners.get(index)!==groupKey || !/^x-split-\d+$/.test(split) ||
        groups.get(groupKey).split!==split)) return reject('ambiguous reuse of Greek position',true);
      owners.set(index,groupKey);
    }
    if(!groups.has(groupKey)) groups.set(groupKey,{spans:[],original,split});
    if(visible) groups.get(groupKey).spans.push([start,end]);
  }
  if(owners.size!==records.length) return reject('Greek source sequence incomplete');
  const alignments=[...groups.values()].filter(group=>group.spans.length)
    .map(({spans,original})=>[spans,original]);
  return alignments.length ? {alignments} : reject('no English spans');
}

function readerRecords(bookId,chapter,verse,shard){
  const alternate=path.join(root,'data/word-study/original-language-variants',bookId+'-'+chapter+'-'+verse+'.json');
  if(fs.existsSync(alternate)) return JSON.parse(fs.readFileSync(alternate,'utf8')).records;
  if(shard.records) return shard.records.filter(record=>record.verse===verse);
  return (shard.verses[verse-1] || []).map(([surface,strongsNumber,morphology],tokenIndex)=>({
    status:'authoritative',language:'greek',bookId,chapter,verse,tokenIndex,surface,strongsNumber,morphology
  }));
}

function sha(bytes){return createHash('sha256').update(bytes).digest('hex');}

// Reproduce the Shell 75 screening predicate for comparison with the strict import.
function passedPreliminaryScreen(text, body, records){
  const markup=body.replace(/<note\b[^>]*(?<!\/)>([\s\S]*?)<\/note>/g,'');
  const sourceWords=words(decode(markup.replace(/<[^>]*>/g,'')));
  const readerWords=words(text);
  if(sourceWords.length!==readerWords.length || sourceWords.some((word,index)=>word[0]!==readerWords[index][0])) return false;
  const indexed=[...markup.matchAll(/<w\b([^>]*)>([\s\S]*?)<\/w>/g)];
  return indexed.length>0 && indexed.every(([,tag])=>{
    const indexes=attr(tag,'src').split(/\s+/).map(Number);
    const forms=[...attr(tag,'lemma').matchAll(/lemma\.TR:([^\s]+)/g)].map(match=>surface(decode(match[1])));
    return indexes.length>0 && indexes.length===forms.length &&
      indexes.every((index,position)=>records[index-1] && surface(records[index-1].surface)===forms[position]);
  });
}

function generate(input,output){
  if(fs.existsSync(output)) throw new Error('Output directory must be fresh');
  const bytes=fs.readFileSync(input);
  if(sha(bytes)!==checksum) throw new Error('CrossWire KJV OSIS checksum mismatch');
  const xml=bytes.toString('utf8');
  const source=new Map(), duplicate=new Set();
  for(const [,ref,body] of xml.matchAll(/<verse\b[^>]*\bosisID="([^"]+)"[^>]*\bsID="[^"]+"[^>]*\/>([\s\S]*?)<verse\b[^>]*\beID="\1"[^>]*\/>/g)){
    if(source.has(ref)) duplicate.add(ref);
    else source.set(ref,body);
  }
  if(source.size!==31102) throw new Error('Unexpected CrossWire reference count: '+source.size);
  const library=loadBibleLibrary('kjv.js','kjvLibrary');
  const summary={revision,checksum,books:{},reasons:{},priorityForms:[],files:{},
    preliminary:{accepted:0,rejected:0,ambiguous:0,strictAcceptedOutsideScreen:0},
    oldTestament:{verses:0,anyPositionAttributes:0,aligned:0}};
  const priorityForms=new Set();
  fs.mkdirSync(output);
  for(const [bookIndex,bookId] of canon.order('kjv').entries()){
    const code=osisCodes[bookIndex];
    const book=library[bookId];
    const counts={accepted:0,rejected:0,ambiguous:0,words:0,alignedWords:0,priorityWords:0,alignedPriorityWords:0};
    summary.books[bookId]=counts;
    for(let chapter=1;chapter<=book.chapters;chapter++){
      const entries={};
      const original=bookIndex>=39 ? JSON.parse(fs.readFileSync(path.join(root,'data/word-study/original-language',bookId,chapter+'.json'),'utf8')) : null;
      for(const [index,text] of book[chapter].verses.entries()){
        const verse=index+1, ref=code+'.'+chapter+'.'+verse;
        const terms=words(text);
        const isPriority=word=>Object.hasOwn(priority,normalizeDictionaryTerm(word[0]));
        counts.words+=terms.length;
        counts.priorityWords+=terms.filter(isPriority).length;
        if(!original){
          summary.oldTestament.verses++;
          if(/<w\b[^>]*\bsrc="/.test(source.get(ref) || '')) summary.oldTestament.anyPositionAttributes++;
          continue;
        }
        const records=readerRecords(bookId,chapter,verse,original);
        const outcome=duplicate.has(ref) ? reject('duplicate source reference',true) :
          !source.has(ref) ? reject('missing CrossWire reference') :
          records.some(record=>record.bookId!==bookId || record.chapter!==chapter || record.verse!==verse) ?
            reject('original verse identity differs') : validateVerse(text,source.get(ref),records);
        if(source.has(ref) && passedPreliminaryScreen(text,source.get(ref),records)){
          summary.preliminary[outcome.ambiguous?'ambiguous':outcome.reason?'rejected':'accepted']++;
        }else if(!outcome.reason) summary.preliminary.strictAcceptedOutsideScreen++;
        if(outcome.reason){
          counts[outcome.ambiguous?'ambiguous':'rejected']++;
          summary.reasons[outcome.reason]=(summary.reasons[outcome.reason] || 0)+1;
          continue;
        }
        counts.accepted++;
        entries[verse]=[text,records.map(({surface,strongsNumber,morphology})=>[surface,strongsNumber,morphology]),outcome.alignments];
        for(const word of terms){
          if(!outcome.alignments.some(([spans])=>spans.some(([start,end])=>word.index<end && word.index+word[0].length>start))) continue;
          counts.alignedWords++;
          if(isPriority(word)){
            counts.alignedPriorityWords++;
            priorityForms.add(normalizeDictionaryTerm(word[0]));
          }
        }
      }
      if(!Object.keys(entries).length) continue;
      const folder=path.join(output,bookId);
      fs.mkdirSync(folder,{recursive:true});
      const data=JSON.stringify(entries)+'\n';
      fs.writeFileSync(path.join(folder,chapter+'.json'),data);
      summary.files[bookId+'/'+chapter+'.json']={bytes:Buffer.byteLength(data),sha256:sha(data)};
    }
  }
  summary.priorityForms=[...priorityForms].sort();
  return summary;
}

if(require.main===module){
  const [input,output]=process.argv.slice(2);
  if(!input || !output) throw new Error('Usage: node tools/import-crosswire-kjv-alignment.js <pinned-osis.xml> <fresh-output-directory>');
  console.log(JSON.stringify(generate(input,output),null,2));
}
module.exports={readTaggedVerse,validateVerse,generate,revision,checksum,osisCodes};
