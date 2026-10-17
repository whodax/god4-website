const fs = require('fs');
const path = require('path');
function cleanUsfm(value){
  return value
    .replace(/\x5c(?:f|x|fe|fig)\b[\s\S]*?\x5c(?:f|x|fe|fig)\*/g, '')
    .replace(/\x5c\+?w\s+([\s\S]*?)\|[^\x5c]*?\x5c\+?w\*/g, '$1')
    .replace(/\x5c[A-Za-z][A-Za-z0-9-]*\*/g, '')
    .replace(/\x5c[A-Za-z][A-Za-z0-9-]*\s?/g, '')
    .replace(/\s+/g, ' ')
    .trim();
}


// Strict coordinates for verified editions. Legacy importers keep their explicit gap policies.
function parseBook(source, expectedId, options={}){
  const strict=options.strict!==false;
  const allowGaps=options.allowGaps===true;
  const book={name:'',chapters:0}; let chapter=null,verse=null, id=null;
  function flush(){
    if(!verse) return;
    if(!chapter) throw new Error('Verse before chapter');
    if(verse.number<=chapter.verses.length || (!allowGaps && verse.number!==chapter.verses.length+1)) throw new Error('Duplicate or non-contiguous verse '+verse.number);
    while(chapter.verses.length<verse.number-1) chapter.verses.push('');
    const text=cleanUsfm(verse.text);
    if((strict && !text) || /\\|strong="/.test(text)) throw new Error('Empty verse or residual markup');
    chapter.verses.push(text); verse=null;
  }
  for(const line of source.replace(/^\uFEFF/,'').split(/\r?\n/)){
    let match;
    if((match=/^\\id\s+(\S+)/.exec(line))){ if(id) throw new Error('Duplicate book ID'); id=match[1]; }
    else if((match=/^\\h\s+(.+)/.exec(line))) book.name=cleanUsfm(match[1]);
    else if(/^\\c\b/.test(line)){
      flush(); match=/^\\c\s+([1-9]\d*)\s*$/.exec(line);
      if(!match || Number(match[1])!==book.chapters+1 || (chapter && !chapter.verses.length)) throw new Error('Duplicate or non-contiguous chapter');
      chapter={title:'',verses:[]};book[++book.chapters]=chapter;
    } else if(/^\\v\b/.test(line)){
      flush();match=(strict ? /^\\v\s+([1-9]\d*)\s+(.*)$/ : /^\\v\s+([1-9]\d*)(?:-\d+)?\s*(.*)$/).exec(line);
      if(!match) throw new Error('Malformed verse coordinate');
      verse={number:Number(match[1]),text:match[2]};
    } else if(verse) verse.text+=' '+line;
  }
  flush();
  if(id!==expectedId || !book.name || !book.chapters || !chapter.verses.length) throw new Error('Invalid book metadata '+expectedId);
  return book;
}
function importDirectory(directory,edition){
  const canon=require('../js/bible/canon.js'); const found=new Map();
  const hashes={};const crypto=require('crypto');
  for(const file of fs.readdirSync(directory).sort()){
    if(!file.endsWith('.usfm')) continue;
    const match=/^\d+-([A-Z0-9]+)(engDRA)\.usfm$/.exec(file);
    const metadata=match && canon.books.find(book=>book.usfm===match[1]);
    if(!metadata || !canon.order(edition).includes(metadata.id)) throw new Error('Unexpected Bible file '+file);
    if(found.has(metadata.id)) throw new Error('Duplicate book '+metadata.id);
    const bytes=fs.readFileSync(path.join(directory,file));
    hashes[file]=crypto.createHash('sha256').update(bytes).digest('hex');
    found.set(metadata.id,parseBook(bytes.toString('utf8'),metadata.usfm));
  }
  const result={};
  for(const id of canon.order(edition)){
    if(!found.has(id)) throw new Error('Missing book '+id);
    result[id]=found.get(id);
    if(edition==='dra') result[id].name=id==='song-of-solomon'?'Song of Songs':canon.book(id).name;
  }
  return {library:result,hashes};
}
module.exports={cleanUsfm,parseBook,importDirectory};
