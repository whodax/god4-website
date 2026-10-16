const fs = require('fs');
const path = require('path');

const sourceFile = path.resolve(process.argv[2] || 'vendor/kjv/eng-kjv_vpl.txt');
const outputFile = path.resolve(__dirname, '..', 'js', 'bible', 'kjv.js');

const books = require('../js/bible/canon.js').sourceBooks('web','vpl');

if(!fs.existsSync(sourceFile)) throw new Error(`KJV VPL source file not found: ${sourceFile}`);
const source = fs.readFileSync(sourceFile, 'utf8').replace(/^\uFEFF/, '');
const records = new Map();
const validIds = new Set(books.map((book) => book[0]));
for(const line of source.split(/\r?\n/)){
  const match = /^(\S+) (\d+):(\d+)\s+(.*)$/.exec(line);
  if(!match || !validIds.has(match[1])) continue;
  const key = `${match[1]}:${match[2]}`;
  if(!records.has(key)) records.set(key, []);
  records.get(key).push({ number: Number(match[3]), text: match[4].replace(/^¶\s*/, '').trim() });
}

const library = {};
for(const [bookId, id, name] of books){
  const book = { name, chapters: 0 };
  const chapterNumbers = [...records.keys()].filter((key) => key.startsWith(`${bookId}:`)).map((key) => Number(key.split(':')[1]));
  if(!chapterNumbers.length) throw new Error(`Missing KJV book: ${bookId}`);
  for(const chapterNumber of [...new Set(chapterNumbers)].sort((a, b) => a - b)){
    const verses = records.get(`${bookId}:${chapterNumber}`);
    for(let index = 0; index < verses.length; index++){
      if(verses[index].number !== index + 1) throw new Error(`Unexpected KJV verse numbering in ${bookId} ${chapterNumber}:${verses[index].number}`);
    }
    book[chapterNumber] = { title: '', verses: verses.map((verse) => verse.text) };
    book.chapters = chapterNumber;
  }
  library[id] = book;
}

if(Object.keys(library).length !== 66) throw new Error(`Expected 66 KJV books, found ${Object.keys(library).length}`);
fs.writeFileSync(outputFile, `/* Generated from eBible.org eng-kjv_vpl.zip by tools/import-kjv.js. */\nconst kjvLibrary = ${JSON.stringify(library)};\n`);
console.log(`Imported ${Object.keys(library).length} KJV books into ${path.relative(process.cwd(), outputFile)}.`);