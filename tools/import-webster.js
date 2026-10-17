const fs = require('fs');
const path = require('path');

const sourceFile = path.resolve(process.argv[2] || 'vendor/webster/engwebster_vpl.txt');
const outputFile = path.resolve(__dirname, '..', 'js', 'bible', 'webster.js');
const books = require('../js/bible/canon.js').sourceBooks('web','vpl');

if(!fs.existsSync(sourceFile)) throw new Error(`Webster VPL source file not found: ${sourceFile}`);
const validIds = new Set(books.map((book) => book[0]));
const records = new Map();
for(const line of fs.readFileSync(sourceFile, 'utf8').replace(/^\uFEFF/, '').split(/\r?\n/)){
  const match = /^(\S+) (\d+):(\d+)\s+(.*)$/.exec(line);
  if(!match || !validIds.has(match[1])) continue;
  const key = `${match[1]}:${match[2]}`;
  if(!records.has(key)) records.set(key, []);
  records.get(key).push({ number: Number(match[3]), text: match[4].replace(/^¶\s*/, '').trim() });
}

const library = {};
for(const [sourceId, id, name] of books){
  const book = { name, chapters: 0 };
  const chapters = [...new Set([...records.keys()].filter((key) => key.startsWith(`${sourceId}:`)).map((key) => Number(key.split(':')[1])))].sort((a, b) => a - b);
  if(!chapters.length) throw new Error(`Missing Webster book: ${sourceId}`);
  for(const chapterNumber of chapters){
    const sourceVerses = records.get(`${sourceId}:${chapterNumber}`);
    const verses = [];
    sourceVerses.forEach((verse) => {
      while(verses.length < verse.number - 1) verses.push('');
      verses.push(verse.text);
    });
    book[chapterNumber] = { title: '', verses };
    book.chapters = chapterNumber;
  }
  library[id] = book;
}

if(Object.keys(library).length !== 66) throw new Error(`Expected 66 Webster books, found ${Object.keys(library).length}`);
fs.writeFileSync(outputFile, `/* Generated from eBible.org engwebster_vpl.zip by tools/import-webster.js. */\nconst websterLibrary = ${JSON.stringify(library)};\n`);
console.log(`Imported ${Object.keys(library).length} Webster books into ${path.relative(process.cwd(), outputFile)}.`);
