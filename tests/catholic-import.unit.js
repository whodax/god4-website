const {test}=require('node:test');
const assert=require('node:assert/strict');
const fs=require('fs');
const path=require('path');
const vm=require('vm');
const crypto=require('crypto');
const canon=require('../js/bible/canon');
const {parseBook,cleanUsfm,importDirectory}=require('../tools/usfm');
const generator=require('../tools/generate-translation-manifest');
const inventory=require('../data/dra-chapter-inventory.json');
const bundle=fs.readFileSync(path.join(__dirname,'../js/bible/dra.js'),'utf8');
const context=vm.createContext({});vm.runInContext(bundle+';this.library=draLibrary;',context);const library=context.library;
const valid='\\id TOB\n\\h Tobit\n\\c 1\n\\p\n\\v 1 First verse.\n\\v 2 Second verse.\n';
test('73-book Catholic order and unchanged Protestant order',()=>{
 assert.equal(canon.order('dra').length,73);assert.equal(canon.order('web').length,66);
 assert.deepEqual(canon.order('dra').slice(14,23),['ezra','nehemiah','tobit','judith','esther','1-maccabees','2-maccabees','job','psalms']);
 assert.deepEqual(canon.order('dra').slice(-27),canon.order('web').slice(-27));
 assert.deepEqual(Object.keys(library),canon.order('dra'));
 for(const id of ['asv','kjv','ylt','dby','webster','rv','gnv'])assert.deepEqual(canon.order(id),canon.order('web'));
});
test('full DRA corpus matches chapter inventory and contains only nonempty verse strings',()=>{
 assert.equal(Object.keys(inventory).length,73);
 for(const id of canon.order('dra')){
  const book=library[id];assert.equal(book.chapters,inventory[id],id);
  assert.equal(Object.keys(book).filter(k=>/^\d+$/.test(k)).length,inventory[id]);
  for(let c=1;c<=book.chapters;c++){
   assert.ok(book[c].verses.length>0,`${id} ${c}`);
   book[c].verses.forEach((text,i)=>{assert.ok(text.trim(),`${id} ${c}:${i+1}`);assert.doesNotMatch(text,/\\|strong="/);});
  }
 }
});
test('exact Esther, Daniel and Baruch source coordinates survive',()=>{
 assert.deepEqual(Array.from({length:16},(_,i)=>library.esther[i+1].verses.length),[22,23,15,17,14,14,10,17,32,13,12,6,18,19,19,24]);
 assert.deepEqual(Array.from({length:14},(_,i)=>library.daniel[i+1].verses.length),[21,49,100,34,31,28,28,27,27,21,45,13,65,42]);
 for(const [id,c,v] of [['esther',16,24],['daniel',3,24],['daniel',3,90],['daniel',13,65],['daniel',14,42],['baruch',6,72]])assert.ok(library[id][c].verses[v-1].trim());
});
test('all source checksums and generated bundle integrity are recorded',()=>{
 const hashes=require('../data/dra-source-checksums.json');assert.equal(Object.keys(hashes).length,73);
 for(const value of Object.values(hashes))assert.match(value,/^[a-f0-9]{64}$/);
 const entry=generator.buildManifest().dra;
 assert.equal(entry.integrity,'sha256-'+crypto.createHash('sha256').update(generator.canonicalDeployBytes(bundle)).digest('base64'));
 assert.equal(entry.structure.bookCount,73);
 generator.checkOutput();
});
test('parser is deterministic and strips USFM attributes without changing Scripture words',()=>{
 assert.deepEqual(parseBook(valid,'TOB'),parseBook(valid,'TOB'));
 assert.equal(cleanUsfm('\\w In|strong="H1"\\w* the beginning.'),'In the beginning.');
 assert.equal(parseBook(valid,'TOB')[1].verses[1],'Second verse.');
});
for(const [name,source] of [
 ['duplicate verse',valid+'\\v 2 Again.'],['verse gap',valid.replace('\\v 2','\\v 3')],
 ['chapter gap',valid+'\\c 3\n\\v 1 Test.'],['duplicate chapter',valid+'\\c 1\n\\v 1 Test.'],
 ['range coordinate',valid.replace('\\v 2','\\v 2-3')],['suffix coordinate',valid.replace('\\v 2','\\v 2a')],
 ['empty verse',valid+'\\v 3 '],['wrong ID',valid.replace('TOB','JDT')],
 ['verse before chapter',valid.replace('\\c 1\n','')],['duplicate book ID',valid+'\\id TOB\n'],
 ['empty chapter',valid+'\\c 2\n'],['zero coordinate',valid.replace('\\v 2','\\v 0')]
])test('strict parser rejects '+name,()=>assert.throws(()=>parseBook(source,'TOB')));
test('directory importer rejects missing, duplicate and unexpected Bible files',()=>{
 const os=require('os');const dir=fs.mkdtempSync(path.join(os.tmpdir(),'god4-usfm-'));
 try{
  fs.writeFileSync(path.join(dir,'41-TOBengDRA.usfm'),valid);assert.throws(()=>importDirectory(dir,'dra'),/Missing book/);
  fs.writeFileSync(path.join(dir,'42-TOBengDRA.usfm'),valid);assert.throws(()=>importDirectory(dir,'dra'),/Duplicate book/);
  fs.unlinkSync(path.join(dir,'42-TOBengDRA.usfm'));fs.writeFileSync(path.join(dir,'43-SUSengDRA.usfm'),valid);assert.throws(()=>importDirectory(dir,'dra'),/Unexpected Bible/);
 }finally{fs.rmSync(dir,{recursive:true,force:true});}
});
test('centralized aliases and conservative OT numbering policy',()=>{
 assert.ok(canon.matches('sirach','Sirach','Ecclesiasticus',false));
 assert.ok(canon.matches('wisdom','Wisdom','Wisdom of Solomon',false));
 for(const id of ['psalms','daniel','esther','genesis'])assert.equal(canon.comparable('dra','web',id),false);
 assert.equal(canon.comparable('web','asv','daniel'),true);
 assert.equal(canon.comparable('dra','web','john'),true);
});

test('legacy gap policy keeps source coordinates and rejects duplicates',()=>{
 const gap=valid.replace('\\v 2','\\v 3');
 assert.deepEqual(parseBook(gap,'TOB',{strict:false,allowGaps:true})[1].verses,['First verse.','','Second verse.']);
 assert.throws(()=>parseBook(gap,'TOB',{strict:false}),/non-contiguous/);
 assert.throws(()=>parseBook(valid+'\\v 2 Again.','TOB',{strict:false,allowGaps:true}),/Duplicate/);
});
test('legacy VPL source mappings retain existing IDs and display names',()=>{
 const rows=canon.sourceBooks('web','vpl');assert.equal(rows.length,66);
 assert.deepEqual(rows.find(r=>r[1]==='song-of-solomon'),['SOL','song-of-solomon','Song of Solomon']);
 assert.deepEqual(rows.find(r=>r[1]==='john'),['JOH','john','John']);
});

for(const [edition,suffix,gaps] of [['asv','eng-asv',false],['ylt','engylt',false],['dby','engDBY',true],['rv','eng-rv',true],['gnv','enggnv',true]]){
 test('shared parser preserves '+edition+' importer output on representative source records',()=>{
  const {execFileSync}=require('child_process');
  const original=execFileSync('git',['show','HEAD:tools/import-'+edition+'.js'],{encoding:'utf8'});
  const current=fs.readFileSync(path.join(__dirname,'../tools/import-'+edition+'.js'),'utf8');
  const files=canon.sourceBooks('web').map(([usfm,id,name],i)=>({file:`${String(i+2).padStart(2,'0')}-${usfm}${suffix}.usfm`,text:`\\id ${usfm}\n\\h ${name}\n\\c 1\n\\p\n\\v 1 First \\w word|strong="H1"\\w*.\n\\v ${gaps?3:2} Second verse.\n`}));
  function execute(script){
   let output;
   const fakeFs={existsSync:()=>true,readdirSync:()=>files.map(f=>f.file),readFileSync:file=>files.find(f=>path.basename(file)===f.file).text,writeFileSync:(file,text)=>{output=text;}};
   const requireTool=name=>name==='fs'?fakeFs:name==='path'?path:name.includes('canon')?canon:name.includes('usfm')?require('../tools/usfm'):require(name);
   vm.runInNewContext(script,{require:requireTool,__dirname:'/project/tools',process:{argv:['node','import','/fixture'],cwd:()=>'/fixture'},console:{log(){}}});
   return output;
  }
  assert.equal(execute(current),execute(original));
 });
}
