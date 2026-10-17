const fs = require('fs');
const path = require('path');

const sourceDirectory = path.resolve(process.argv[2] || 'vendor/ylt-usfm');
const outputFile = path.resolve(__dirname, '..', 'js', 'bible', 'ylt.js');
const canonicalIds = Object.fromEntries(require('../js/bible/canon.js').books.filter(book => book.canons.includes('protestant')).map(book => [book.usfm, book.id]));

const {parseBook} = require('./usfm.js');

if(!fs.existsSync(sourceDirectory)) throw new Error(`YLT USFM source directory not found: ${sourceDirectory}`);
const files = fs.readdirSync(sourceDirectory).filter((file) => /^\d+-(?:[A-Z0-9]+)engylt\.usfm$/i.test(file));
const library = {};
for(const file of files){
  const fileMatch = /^(\d+)-([A-Z0-9]+)engylt\.usfm$/i.exec(file);
  const sourceId = fileMatch[2].toUpperCase();
  if(!canonicalIds[sourceId]) continue;
  const book = parseBook(fs.readFileSync(path.join(sourceDirectory,file),'utf8'),sourceId,{strict:false,allowGaps:false});
  library[canonicalIds[sourceId]] = book;
}

if(Object.keys(library).length !== 66) throw new Error(`Expected 66 YLT books, found ${Object.keys(library).length}`);
const orderedLibrary = Object.fromEntries(Object.entries(library).sort((first, second) => Object.keys(canonicalIds).indexOf(Object.keys(canonicalIds).find((sourceId) => canonicalIds[sourceId] === first[0])) - Object.keys(canonicalIds).indexOf(Object.keys(canonicalIds).find((sourceId) => canonicalIds[sourceId] === second[0]))));
fs.writeFileSync(outputFile, `/* Generated from eBible.org engylt_usfm.zip by tools/import-ylt.js. */\nconst yltLibrary = ${JSON.stringify(orderedLibrary)};\n`);
console.log(`Imported ${Object.keys(orderedLibrary).length} YLT books into ${path.relative(process.cwd(), outputFile)}.`);