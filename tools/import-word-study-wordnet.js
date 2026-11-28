'use strict';

const fs = require('node:fs');
const path = require('node:path');
const vm = require('node:vm');
const {TRANSLATIONS, loadBibleLibrary, normalizeDictionaryTerm, tokenizeVerseText} = require('./audit-word-study-coverage');
const root = path.resolve(__dirname, '..');

const [source, destination] = process.argv.slice(2);
if(!source || !destination) throw new Error('Usage: node tools/import-word-study-wordnet.js <extracted Open English Wordnet JSON> <output directory>');

const runtime = vm.createContext({});
for(const script of ['provider.js', 'dictionary-provider.js']){
  vm.runInContext(fs.readFileSync(path.join(root,'js/word-study',script),'utf8'),runtime);
}
const {getInflectionCandidates} = runtime.DictionaryWordStudyProvider;
const forms = new Set();
for(const {file,variable} of [...TRANSLATIONS,{file:'dra.js',variable:'draLibrary'}]){
  const library = loadBibleLibrary(file,variable);
  for(const book of Object.values(library)) for(const chapter of Object.values(book)){
    if(!Array.isArray(chapter.verses)) continue;
    for(const verse of chapter.verses) for(const word of tokenizeVerseText(verse)){
      const form = normalizeDictionaryTerm(word);
      if(form) forms.add(form);
    }
  }
}
const terms = new Set(forms);
for(const form of forms) for(const candidate of getInflectionCandidates(form)) terms.add(candidate);

const shards = new Map();
const definitions = new Map();
const files = fs.readdirSync(source).filter(file => file.endsWith('.json')).sort();
for(const file of files.filter(file => !file.startsWith('entries-'))){
  for(const [id,sense] of Object.entries(JSON.parse(fs.readFileSync(path.join(source,file),'utf8')))){
    if(sense.definition?.[0]?.trim()) definitions.set(id,sense);
  }
}
for(const file of files.filter(file => file.startsWith('entries-'))){
  for(const [lemma,parts] of Object.entries(JSON.parse(fs.readFileSync(path.join(source,file),'utf8')))){
    if(!/^[A-Za-z]+(?:['-][A-Za-z]+)*$/.test(lemma)) continue;
    const form = normalizeDictionaryTerm(lemma);
    if(!terms.has(form)) continue;
    const letter = form[0];
    if(!shards.has(letter)) shards.set(letter,new Map());
    const entries = shards.get(letter);
    if(!entries.has(form)) entries.set(form,[]);
    const senses = entries.get(form);
    for(const item of Object.values(parts).flatMap(part => part.sense || [])){
      const source = definitions.get(item.synset);
      if(!source || senses.some(sense => sense[0] === item.synset && sense[3] === lemma)) continue;
      senses.push([item.synset,source.partOfSpeech,source.definition[0],lemma]);
    }
  }
}
fs.mkdirSync(destination,{recursive:true});
for(const letter of 'abcdefghijklmnopqrstuvwxyz'){
  const ordered = [...(shards.get(letter) || [])].filter(([,senses]) => senses.length).sort(([a],[b])=>a<b?-1:a>b?1:0);
  fs.writeFileSync(path.join(destination,letter+'.json'),'{"entries":{\n'+ordered.map(([form,senses])=>
    JSON.stringify(form)+':'+JSON.stringify(senses)).join(',\n')+'\n}}\n');
}
const covered = [...forms].filter(form => [form,...getInflectionCandidates(form)].some(term => shards.get(term[0])?.get(term)?.length));
console.log(JSON.stringify({forms:forms.size,covered:covered.length,shards:shards.size,entries:[...shards.values()].reduce((sum,entries)=>sum+entries.size,0)}));
