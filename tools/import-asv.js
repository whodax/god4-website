const fs = require('fs');
const path = require('path');

const sourceDirectory = path.resolve(process.argv[2] || 'vendor/asv-usfm');
const outputFile = path.resolve(__dirname, '..', 'js', 'bible', 'asv.js');
const sourcePattern = /^(\d+)-(.+)eng-asv\.usfm$/i;

const bookIds = Object.fromEntries(require('../js/bible/canon.js').books.filter(book => book.canons.includes('protestant')).map(book => [book.usfm, book.id]));

const {parseBook: parseUsfmBook} = require('./usfm.js');

function parseBook(file){
  const match = sourcePattern.exec(file);
  if(!match || !bookIds[match[2]] || match[2] === 'FRT' || match[2] === 'INT') return null;
  const book=parseUsfmBook(fs.readFileSync(path.join(sourceDirectory,file),'utf8'),match[2],{strict:false});
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