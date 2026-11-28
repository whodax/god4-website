'use strict';

const fs=require('node:fs');
const path=require('node:path');
const {createHash}=require('node:crypto');
const {gzipSync}=require('node:zlib');
const {sourceFiles,alternateRecords}=require('./import-word-study-extensions');
const {loadBibleLibrary}=require('./audit-word-study-coverage');
const {nativeTuple,wholeWordGroups}=require('./word-study-extension-evidence');
const {readTaggedVerse}=require('./import-crosswire-kjv-alignment');
const {ignoreTransparentMarkup}=require('./audit-kjv-residual');
const {pins}=require('./audit-scrivener-witness');
const holdout=require('../docs/shell-81-web-review-v1.json').holdout;
const root=path.join(__dirname,'../data/word-study/alignment');
const sha=bytes=>createHash('sha256').update(bytes).digest('hex');
const read=file=>JSON.parse(fs.readFileSync(file,'utf8'));

// Each record is an explicit boundary decision, backed by pinned positional
// witnesses, rather than an inference from lexical identifiers.
const boundaries=[{bookId:'ephesians',osisBook:'Eph',chapter:1,englishVerse:10,nativeVerse:11,
  regex:/;\s+\[even\]\s+(in him):$/d,
  native:[['\u1f10\u03bd','G1722','PREP'],['\u03b1\u1f50\u03c4\u1ff7','G846','P-DSM']],
  continuationPrefix:'In whom also ',positions:[0,1]}];
function fold(value){return value.normalize('NFD').replace(/\p{Mark}/gu,'').toLowerCase();}
function sameWord(left,right){
  return fold(left[0])===fold(right[0])&&left[1]===right[1]&&left[2]===right[2];
}
function oldChapter(folder,file,manifest){
  const bytes=fs.readFileSync(path.join(root,folder,file));
  if(sha(bytes)!==manifest.files[file]?.sha256) throw Error('Accepted witness digest changed: '+file);
  return JSON.parse(bytes);
}
function publish(osis,scrivener,notice,output,reportPath){
  const {rows,alternate}=sourceFiles(osis,scrivener,notice);
  const bible=loadBibleLibrary('kjv.js','kjvLibrary');
  const report=read(reportPath),index=read(path.join(output,'index.json'));
  const protectedRefs=new Set(holdout.flatMap(row=>[row.passage.coordinate,...row.tokens.map(t=>
    [t.bookId,t.chapter,t.verse].join(':'))]));
  const acceptedPrimary=require('../docs/shell-76-crosswire-import.json');
  const acceptedScrivener=require('../docs/shell-84-scrivener-publication.json');
  const ownership=new Set();
  function write(file,value){
    const bytes=Buffer.from(JSON.stringify(value)+'\n');
    const filename=path.join(output,file);
    fs.mkdirSync(path.dirname(filename),{recursive:true});
    fs.writeFileSync(filename,bytes);
    report.files[file]={bytes:bytes.length,gzipBytes:gzipSync(bytes).length,sha256:sha(bytes)};
  }
  report.crossVerse=[];
  for(const example of boundaries){
    const {bookId,osisBook,chapter,englishVerse,nativeVerse,positions}=example;
    const ref=verse=>[bookId,chapter,verse].join(':');
    if([englishVerse,nativeVerse].some(verse=>protectedRefs.has(ref(verse)))) throw Error('Protected cross-verse address');
    const osisRef=verse=>[osisBook,chapter,verse].join('.');
    const text=bible[bookId][chapter].verses[englishVerse-1];
    const neighbor=bible[bookId][chapter].verses[nativeVerse-1];
    const file=bookId+'/'+chapter+'.json';
    const primary=oldChapter('kjv',file,acceptedPrimary)[nativeVerse];
    const local=oldChapter('kjv-scrivener',file,acceptedScrivener).verses[englishVerse];
    const declared=example.regex.exec(text);
    const group=declared?[ [declared.indices[1]], positions ]:null;
    const parsed=readTaggedVerse(ignoreTransparentMarkup(rows.get(osisRef(englishVerse))));
    if(!group||wholeWordGroups(text,[group]).length!==1||parsed.text!==text||local[0]!==text||
      !neighbor.startsWith(example.continuationPrefix)||primary[0]!==neighbor||
      parsed.tags.some(tag=>tag.start<tag.end&&tag.start<group[0][0][1]&&tag.end>group[0][0][0])||
      local[2].some(([spans])=>spans.some(([a,b])=>a<group[0][0][1]&&b>group[0][0][0])))
      throw Error('English split or known span ownership changed at '+ref(englishVerse));
    const getNative=verse=>alternateRecords(alternate.get(osisRef(verse)),{bookId,chapter,verse})?.map(nativeTuple);
    const localNative=getNative(englishVerse),neighborNative=getNative(nativeVerse);
    if(!localNative||local[1].length!==localNative.length||
      local[1].some((token,i)=>token.some((value,c)=>value!==localNative[i][c]))||
      !neighborNative||neighborNative.length!==primary[1].length||
      !neighborNative.every((token,i)=>sameWord(token,primary[1][i]))||
      !positions.every((pos,i)=>sameWord(example.native[i],neighborNative[pos]))||
      primary[2].some(([,p])=>p.some(pos=>positions.includes(pos))))
      throw Error('Witness sequence or native ownership changed at '+ref(nativeVerse));
    for(const pos of positions){
      const coordinate=ref(nativeVerse)+':'+pos;
      if(ownership.has(coordinate)) throw Error('Duplicate cross-verse Greek position '+coordinate);
      ownership.add(coordinate);
    }
    const chapterRows=fs.existsSync(path.join(output,file))?read(path.join(output,file)):{witnesses:[],editions:{}};
    (chapterRows.crossVerse||={})[englishVerse]={
      text,revision:pins.revision,local:localNative,targets:[{chapter,verse:nativeVerse,
        length:neighborNative.length,tokens:positions.map(pos=>[pos,...neighborNative[pos]])}],
      groups:[{english:group[0],native:positions.map(pos=>[chapter,nativeVerse,pos])}]
    };
    const verses=(((index.kjv||={})[bookId]||={})[chapter]||=[]);
    if(!verses.includes(englishVerse)) verses.push(englishVerse);
    verses.sort((a,b)=>a-b);
    write(file,chapterRows);
    report.crossVerse.push({bookId,chapter,englishVerse,nativeVerse,positions,eligibleWords:2});
  }
  // The apparent Matthew boundary lead is a diagnostic false positive.
  // Scrivener and the installed Greek both end 2:4 with a single passive verb.
  const matthewFile='matthew/2.json';
  const installed=oldChapter('extensions',matthewFile,require('../docs/shell-85-alignment-publication.json'));
  const matthew=installed.editions.kjv[4], text=bible.matthew[2].verses[3];
  const witness=installed.witnesses[matthew[1]];
  const matthewContext={bookId:'matthew',chapter:2,verse:4};
  const native=alternateRecords(alternate.get('Matt.2.4'),matthewContext)?.map(nativeTuple);
  const question=/\bwhere Christ (should be born)\.$/d.exec(text);
  const position=witness.length-1, span=question?.indices[1];
  if(!span||matthew[0]!==text||matthew[4]!=='reader'||native?.length!==witness.length||
    !sameWord(witness[position],native[position])||!sameWord(['\u03b3\u03b5\u03bd\u03bd\u1fb6\u03c4\u03b1\u03b9','G1080','V-PPI-3S'],native[position])||
    protectedRefs.has('matthew:2:4')||matthew[2].some(([spans,p])=>
      p.includes(position)||spans.some(([a,b])=>a<span[1]&&b>span[0])))
    throw Error('Matthew indirect-question evidence or ownership changed');
  const matthewChapter=fs.existsSync(path.join(output,matthewFile))?read(path.join(output,matthewFile)):{witnesses:[],editions:{}};
  const kjv=matthewChapter.editions.kjv||={};
  const addition=[[span],[position]];
  const existing=kjv[4];
  if(existing){
    if(existing[0]!==text||existing[4]!=='reader'||JSON.stringify(matthewChapter.witnesses[existing[1]])!==JSON.stringify(witness)||
      existing[2].some(([spans,p])=>p.includes(position)||spans.some(([a,b])=>a<span[1]&&b>span[0])))
      throw Error('Matthew indirect-question span conflicts with another continuation');
    existing[6].push(existing[2].length);
    existing[2].push(addition);
    existing[3].push('greek-inflection');
    existing[5].push([]);
  }else{
    kjv[4]=[text,matthewChapter.witnesses.length,[addition],['greek-inflection'],'reader',[[]],[0]];
    matthewChapter.witnesses.push(witness);
  }
  const matthewIndex=(((index.kjv||={}).matthew||={})[2]||=[]);
  if(!matthewIndex.includes(4)) matthewIndex.push(4);
  matthewIndex.sort((a,b)=>a-b);
  write(matthewFile,matthewChapter);
  report.grammatical=[{bookId:'matthew',chapter:2,verse:4,position,eligibleWords:3,
    evidence:'Greek present passive finite verb within an indirect question'}];
  write('index.json',index);
  fs.writeFileSync(reportPath,JSON.stringify(report,null,2)+'\n');
}
if(require.main===module) publish(...process.argv.slice(2));
module.exports={publish};
