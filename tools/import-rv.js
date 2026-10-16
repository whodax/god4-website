const fs = require('fs');
const path = require('path');

const sourceDirectory = path.resolve(process.argv[2] || 'vendor/rv-usfm');
const outputFile = path.resolve(__dirname, '..', 'js', 'bible', 'rv.js');
const canonicalIds = Object.fromEntries(require('../js/bible/canon.js').books.filter(book => book.canons.includes('protestant')).map(book => [book.usfm, book.id]));

const {parseBook} = require('./usfm.js');

if(!fs.existsSync(sourceDirectory)) throw new Error(`RV USFM source directory not found: ${sourceDirectory}`);
const files = fs.readdirSync(sourceDirectory).filter((file) => /^\d+-(?:[A-Z0-9]+)eng-rv\.usfm$/i.test(file));
const library = {};
for(const file of files){
  const match = /^(\d+)-([A-Z0-9]+)eng-rv\.usfm$/i.exec(file);
  const sourceId = match[2].toUpperCase();
  if(!canonicalIds[sourceId]) continue;
  const book = parseBook(fs.readFileSync(path.join(sourceDirectory,file),'utf8'),sourceId,{strict:false,allowGaps:true});
  library[canonicalIds[sourceId]] = book;
}
if(Object.keys(library).length !== 66) throw new Error(`Expected 66 RV books, found ${Object.keys(library).length}`);
const order = Object.values(canonicalIds);
const ordered = Object.fromEntries(Object.entries(library).sort((a, b) => order.indexOf(a[0]) - order.indexOf(b[0])));
fs.writeFileSync(outputFile, `/* Generated from eBible.org eng-rv_usfm.zip by tools/import-rv.js. */\nconst rvLibrary = ${JSON.stringify(ordered)};\n`);
console.log(`Imported ${Object.keys(ordered).length} RV books into ${path.relative(process.cwd(), outputFile)}.`);
