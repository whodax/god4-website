const fs = require('fs');
const path = require('path');

const sourceDirectory = path.resolve(process.argv[2] || 'vendor/asv-usfm');
const outputFile = path.resolve(__dirname, '..', 'js', 'bible', 'asv.js');
const sourcePattern = /^(\d+)-(.+)eng-asv\.usfm$/i;

const bookIds = {
  FRT: 'front-matter', INT: 'introduction', GEN: 'genesis', EXO: 'exodus', LEV: 'leviticus', NUM: 'numbers', DEU: 'deuteronomy',
  JOS: 'joshua', JDG: 'judges', RUT: 'ruth', '1SA': '1-samuel', '2SA': '2-samuel', '1KI': '1-kings', '2KI': '2-kings',
  '1CH': '1-chronicles', '2CH': '2-chronicles', EZR: 'ezra', NEH: 'nehemiah', EST: 'esther', JOB: 'job', PSA: 'psalms', PRO: 'proverbs',
  ECC: 'ecclesiastes', SNG: 'song-of-solomon', ISA: 'isaiah', JER: 'jeremiah', LAM: 'lamentations', EZK: 'ezekiel', DAN: 'daniel',
  HOS: 'hosea', JOL: 'joel', AMO: 'amos', OBA: 'obadiah', JON: 'jonah', MIC: 'micah', NAM: 'nahum', HAB: 'habakkuk', ZEP: 'zephaniah',
  HAG: 'haggai', ZEC: 'zechariah', MAL: 'malachi', MAT: 'matthew', MRK: 'mark', LUK: 'luke', JHN: 'john', ACT: 'acts', ROM: 'romans',
  '1CO': '1-corinthians', '2CO': '2-corinthians', GAL: 'galatians', EPH: 'ephesians', PHP: 'philippians', COL: 'colossians', '1TH': '1-thessalonians',
  '2TH': '2-thessalonians', '1TI': '1-timothy', '2TI': '2-timothy', TIT: 'titus', PHM: 'philemon', HEB: 'hebrews', JAS: 'james', '1PE': '1-peter',
  '2PE': '2-peter', '1JN': '1-john', '2JN': '2-john', '3JN': '3-john', JUD: 'jude', REV: 'revelation'
};

function cleanUsfm(value){
  return value
    .replace(/\\(?:f|x|fe|fig)\b[\s\S]*?\\(?:f|x|fe|fig)\*/g, '')
    .replace(/\\w\s+([\s\S]*?)\|[^\\]*?\\w\*/g, '$1')
    .replace(/\\[A-Za-z][A-Za-z0-9-]*\s?/g, '')
    .replace(/\\[A-Za-z][A-Za-z0-9-]*\*/g, '')
    .replace(/\s+/g, ' ')
    .trim();
}

function parseBook(file){
  const match = sourcePattern.exec(file);
  if(!match || !bookIds[match[2]] || match[2] === 'FRT' || match[2] === 'INT') return null;
  const lines = fs.readFileSync(path.join(sourceDirectory, file), 'utf8').replace(/^\uFEFF/, '').split(/\r?\n/);
  const book = { name: '', chapters: 0 };
  let chapter = null;
  let verse = null;
  const flushVerse = () => {
    if(!chapter || !verse) return;
    const text = cleanUsfm(verse.text);
    if(text === undefined) throw new Error(`Invalid verse ${verse.number} in ${file}`);
    if(verse.number !== chapter.verses.length + 1) throw new Error(`Unexpected verse numbering in ${file}: ${verse.number}`);
    chapter.verses.push(text);
  };
  for(const line of lines){
    const header = /^\\h\s+(.+)$/.exec(line);
    if(header && !book.name) book.name = cleanUsfm(header[1]);
    const chapterMarker = /^\\c\s+(\d+)/.exec(line);
    if(chapterMarker){
      flushVerse();
      chapter = { title: '', verses: [] };
      book[Number(chapterMarker[1])] = chapter;
      book.chapters = Math.max(book.chapters, Number(chapterMarker[1]));
      verse = null;
      continue;
    }
    const verseMarker = /^\\v\s+(\d+)(?:-\d+)?\s*(.*)$/.exec(line);
    if(verseMarker){
      flushVerse();
      verse = { number: Number(verseMarker[1]), text: verseMarker[2] };
    } else if(verse){
      verse.text += ' ' + line;
    }
  }
  flushVerse();
  if(!book.name || !book.chapters) throw new Error(`Missing book metadata in ${file}`);
  return { order: Number(match[1]), id: bookIds[match[2]], value: book };
}

if(!fs.existsSync(sourceDirectory)) throw new Error(`ASV USFM source directory not found: ${sourceDirectory}`);
const books = fs.readdirSync(sourceDirectory).map(parseBook).filter(Boolean);
if(books.length !== 66) throw new Error(`Expected 66 ASV books, found ${books.length}`);
books.sort((first, second) => first.order - second.order);
const library = Object.fromEntries(books.map((book) => [book.id, book.value]));
const output = `/* Generated from eBible.org eng-asv_usfm.zip by tools/import-asv.js. */\nconst asvLibrary = ${JSON.stringify(library)};\n`;
fs.writeFileSync(outputFile, output + '\n');
console.log(`Imported ${books.length} ASV books into ${path.relative(process.cwd(), outputFile)}.`);