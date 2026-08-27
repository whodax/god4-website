const fs = require('fs');
const path = require('path');

const sourceDirectory = path.resolve(process.argv[2] || 'vendor/gnv-usfm');
const outputFile = path.resolve(__dirname, '..', 'js', 'bible', 'gnv.js');
const canonicalIds = {
  GEN: 'genesis', EXO: 'exodus', LEV: 'leviticus', NUM: 'numbers', DEU: 'deuteronomy', JOS: 'joshua', JDG: 'judges', RUT: 'ruth', '1SA': '1-samuel', '2SA': '2-samuel', '1KI': '1-kings', '2KI': '2-kings', '1CH': '1-chronicles', '2CH': '2-chronicles', EZR: 'ezra', NEH: 'nehemiah', EST: 'esther', JOB: 'job', PSA: 'psalms', PRO: 'proverbs', ECC: 'ecclesiastes', SNG: 'song-of-solomon', ISA: 'isaiah', JER: 'jeremiah', LAM: 'lamentations', EZK: 'ezekiel', DAN: 'daniel', HOS: 'hosea', JOL: 'joel', AMO: 'amos', OBA: 'obadiah', JON: 'jonah', MIC: 'micah', NAM: 'nahum', HAB: 'habakkuk', ZEP: 'zephaniah', HAG: 'haggai', ZEC: 'zechariah', MAL: 'malachi', MAT: 'matthew', MRK: 'mark', LUK: 'luke', JHN: 'john', ACT: 'acts', ROM: 'romans', '1CO': '1-corinthians', '2CO': '2-corinthians', GAL: 'galatians', EPH: 'ephesians', PHP: 'philippians', COL: 'colossians', '1TH': '1-thessalonians', '2TH': '2-thessalonians', '1TI': '1-timothy', '2TI': '2-timothy', TIT: 'titus', PHM: 'philemon', HEB: 'hebrews', JAS: 'james', '1PE': '1-peter', '2PE': '2-peter', '1JN': '1-john', '2JN': '2-john', '3JN': '3-john', JUD: 'jude', REV: 'revelation'
};

function cleanUsfm(value){
  return value
    .replace(/\\(?:f|x|fe|fig)\b[\s\S]*?\\(?:f|x|fe|fig)\*/g, '')
    .replace(/\\\+?w\s+([\s\S]*?)\|[^\\]*?\\\+?w\*/g, '$1')
    .replace(/\\[A-Za-z][A-Za-z0-9-]*\*/g, '')
    .replace(/\\[A-Za-z][A-Za-z0-9-]*\s?/g, '')
    .replace(/\s+/g, ' ')
    .trim();
}

if(!fs.existsSync(sourceDirectory)) throw new Error(`GNV USFM source directory not found: ${sourceDirectory}`);
const files = fs.readdirSync(sourceDirectory).filter((file) => /^\d+-(?:[A-Z0-9]+)enggnv\.usfm$/i.test(file));
const library = {};
for(const file of files){
  const match = /^(\d+)-([A-Z0-9]+)enggnv\.usfm$/i.exec(file);
  const sourceId = match[2].toUpperCase();
  if(!canonicalIds[sourceId]) continue;
  const lines = fs.readFileSync(path.join(sourceDirectory, file), 'utf8').replace(/^\uFEFF/, '').split(/\r?\n/);
  let bookName = '';
  let chapter = null;
  let verse = null;
  const book = { name: '', chapters: 0 };
  const flushVerse = () => {
    if(!chapter || !verse) return;
    const text = cleanUsfm(verse.text);
    while(chapter.verses.length < verse.number - 1) chapter.verses.push('');
    chapter.verses.push(text);
  };
  for(const line of lines){
    const header = /^\x5ch\s+(.+)$/.exec(line);
    if(header && !bookName) bookName = cleanUsfm(header[1]);
    const chapterMarker = /^\x5cc\s+(\d+)/.exec(line);
    if(chapterMarker){ flushVerse(); chapter = { title: '', verses: [] }; book[Number(chapterMarker[1])] = chapter; book.chapters = Math.max(book.chapters, Number(chapterMarker[1])); verse = null; continue; }
    const verseMarker = /^\x5cv\s+(\d+)(?:-\d+)?\s*(.*)$/.exec(line);
    if(verseMarker){ flushVerse(); verse = { number: Number(verseMarker[1]), text: verseMarker[2] }; }
    else if(verse) verse.text += ' ' + line;
  }
  flushVerse();
  if(!bookName || !book.chapters) throw new Error(`Missing GNV book metadata in ${file}`);
  book.name = bookName;
  library[canonicalIds[sourceId]] = book;
}
if(Object.keys(library).length !== 66) throw new Error(`Expected 66 GNV books, found ${Object.keys(library).length}`);
const ordered = Object.fromEntries(Object.entries(library).sort((a, b) => Object.values(canonicalIds).indexOf(a[0]) - Object.values(canonicalIds).indexOf(b[0])));
fs.writeFileSync(outputFile, `/* Generated from eBible.org enggnv_usfm.zip by tools/import-gnv.js. */\nconst gnvLibrary = ${JSON.stringify(ordered)};\n`);
console.log(`Imported ${Object.keys(ordered).length} GNV books into ${path.relative(process.cwd(), outputFile)}.`);
