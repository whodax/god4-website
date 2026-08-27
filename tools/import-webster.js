const fs = require('fs');
const path = require('path');

const sourceFile = path.resolve(process.argv[2] || 'vendor/webster/engwebster_vpl.txt');
const outputFile = path.resolve(__dirname, '..', 'js', 'bible', 'webster.js');
const books = [
  ['GEN', 'genesis', 'Genesis'], ['EXO', 'exodus', 'Exodus'], ['LEV', 'leviticus', 'Leviticus'], ['NUM', 'numbers', 'Numbers'], ['DEU', 'deuteronomy', 'Deuteronomy'],
  ['JOS', 'joshua', 'Joshua'], ['JDG', 'judges', 'Judges'], ['RUT', 'ruth', 'Ruth'], ['1SA', '1-samuel', '1 Samuel'], ['2SA', '2-samuel', '2 Samuel'],
  ['1KI', '1-kings', '1 Kings'], ['2KI', '2-kings', '2 Kings'], ['1CH', '1-chronicles', '1 Chronicles'], ['2CH', '2-chronicles', '2 Chronicles'], ['EZR', 'ezra', 'Ezra'],
  ['NEH', 'nehemiah', 'Nehemiah'], ['EST', 'esther', 'Esther'], ['JOB', 'job', 'Job'], ['PSA', 'psalms', 'Psalms'], ['PRO', 'proverbs', 'Proverbs'],
  ['ECC', 'ecclesiastes', 'Ecclesiastes'], ['SOL', 'song-of-solomon', 'Song of Solomon'], ['ISA', 'isaiah', 'Isaiah'], ['JER', 'jeremiah', 'Jeremiah'], ['LAM', 'lamentations', 'Lamentations'],
  ['EZE', 'ezekiel', 'Ezekiel'], ['DAN', 'daniel', 'Daniel'], ['HOS', 'hosea', 'Hosea'], ['JOE', 'joel', 'Joel'], ['AMO', 'amos', 'Amos'], ['OBA', 'obadiah', 'Obadiah'],
  ['JON', 'jonah', 'Jonah'], ['MIC', 'micah', 'Micah'], ['NAH', 'nahum', 'Nahum'], ['HAB', 'habakkuk', 'Habakkuk'], ['ZEP', 'zephaniah', 'Zephaniah'], ['HAG', 'haggai', 'Haggai'],
  ['ZEC', 'zechariah', 'Zechariah'], ['MAL', 'malachi', 'Malachi'], ['MAT', 'matthew', 'Matthew'], ['MAR', 'mark', 'Mark'], ['LUK', 'luke', 'Luke'], ['JOH', 'john', 'John'],
  ['ACT', 'acts', 'Acts'], ['ROM', 'romans', 'Romans'], ['1CO', '1-corinthians', '1 Corinthians'], ['2CO', '2-corinthians', '2 Corinthians'], ['GAL', 'galatians', 'Galatians'],
  ['EPH', 'ephesians', 'Ephesians'], ['PHI', 'philippians', 'Philippians'], ['COL', 'colossians', 'Colossians'], ['1TH', '1-thessalonians', '1 Thessalonians'], ['2TH', '2-thessalonians', '2 Thessalonians'],
  ['1TI', '1-timothy', '1 Timothy'], ['2TI', '2-timothy', '2 Timothy'], ['TIT', 'titus', 'Titus'], ['PHM', 'philemon', 'Philemon'], ['HEB', 'hebrews', 'Hebrews'],
  ['JAM', 'james', 'James'], ['1PE', '1-peter', '1 Peter'], ['2PE', '2-peter', '2 Peter'], ['1JO', '1-john', '1 John'], ['2JO', '2-john', '2 John'], ['3JO', '3-john', '3 John'],
  ['JUD', 'jude', 'Jude'], ['REV', 'revelation', 'Revelation']
];

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
