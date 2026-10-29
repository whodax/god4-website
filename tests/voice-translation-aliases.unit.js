const {test}=require('node:test');
const assert=require('node:assert/strict');
const fs=require('node:fs');
const path=require('node:path');
const vm=require('node:vm');
const root=path.resolve(__dirname,'..');
function parser(){
  const c=vm.createContext({});
  for(const file of ['canon','library','data'])vm.runInContext(fs.readFileSync(path.join(root,'js/bible/'+file+'.js'),'utf8'),c);
  const reader=fs.readFileSync(path.join(root,'js/bible/reader.js'),'utf8');
  vm.runInContext("var currentBook='john',currentChapter=1;"+reader.slice(reader.indexOf('function parseSpokenReferenceNumber('),reader.indexOf('function validSpokenPassage('))+reader.slice(reader.indexOf('function normalizeVoiceCommand('),reader.indexOf('function handleVoiceCommand(')),c);
  return {c,parse:text=>vm.runInContext('parseSpokenNavigation('+JSON.stringify(text)+')',c)};
}
const names={
  web:['WEB','W E B','World','World English','World English Bible','World English Bible Protestant Edition','double you ee bee'],
  asv:['ASV','A S V','American','American Standard','American Standard Version','American Standard Version (1901)','a ess vee'],
  kjv:['KJV','K J V','King','King James','King James Version','Authorized Version','Authorized King James Version','kay jay vee'],
  ylt:['YLT','Y L T','Young','Youngs','Young’s Literal','Young’s Literal Translation','Young Literal Translation','why el tee'],
  dby:['DBY','D B Y','Darby','Darby Translation','Darby’s Bible','J. N. Darby','John Nelson Darby','dee bee why'],
  webster:['WBS','W B S','Webster','Webster Bible','Webster Bible (1833)','Webster’s Bible','Noah Webster','double you bee ess'],
  rv:['RV','R V','Revised','Revised Version','Revised Version (1895)','English Revised Version','are vee'],
  gnv:['GNV','G N V','Geneva','Geneva Bible','Geneva Bible 1599','Geneva 1599','gee en vee'],
  dra:['DRA','D R A','Douay','Douay Rheims','Douay-Rheims','Douay Rheims Catholic','Douay Rheims Bible','Douay Rheims Catholic Bible','Catholic','Catholic Bible','Douay-Rheims — Catholic','Douay Reims Catholic','Douai Rheims Catholic','Dewey Reams Catholic','Do Way Rheims Catholic','dee are ay']
};
for(const [id,aliases] of Object.entries(names))test(id+': independent accepted-name matrix and natural command/suffix forms',()=>{
  const {parse}=parser();
  for(const alias of aliases)for(const text of [alias,'Switch to '+alias,'Read '+alias,'Change to '+alias,alias.replace(/ (?:Bible|Version|Translation)$/i,'')+' Bible',alias.replace(/ (?:Bible|Version|Translation)$/i,'')+' Version',alias.replace(/ (?:Bible|Version|Translation)$/i,'')+' Translation']){
    const p=parse(text);assert.equal(p?.error,undefined,text);assert.equal(p?.translationId,id,text);assert.equal(p.play,text.startsWith('Read '),text);
  }
});
for(const id of Object.keys(names))test(id+': every generated alias also composes with a reference',()=>{
  const {c,parse}=parser();const aliases=vm.runInContext('getSpokenTranslationAliases()',c).filter(a=>a.id===id);
  assert.ok(aliases.length>20);
  for(const a of aliases){
    const p=parse(a.name);assert.equal(p?.translationId,id,a.name);assert.equal(p.error,undefined,a.name);
    const n=parse(a.name+', Matthew chapter 1 verse 2');assert.equal(n.translationId,id,a.name);assert.equal(n.error,undefined,a.name);assert.deepEqual(JSON.parse(JSON.stringify(n.choices)),[{bookId:'matthew',chapter:1,verse:2}]);
  }
});
test('punctuation, Unicode dashes, apostrophes, case, whitespace and fullwidth letters normalize deterministically',()=>{
  const {parse}=parser();
  for(const s of ['Douay - Rheims Catholic','DOUAY–RHEIMS CATHOLIC','Douay—Rheims Catholic','Douay‑Rheims Catholic','Douay / Rheims Catholic!','  Douay   Rheims   Catholic  ','ＤＲＡ','Douay_Rheims Catholic','Douay-Rheims: Catholic'])assert.equal(parse(s)?.translationId,'dra',s);
  for(const s of ["Young's Literal",'Young’s Literal','Youngʼs Literal','Young‘s Literal','Young` s Literal'])assert.equal(parse(s)?.translationId,'ylt',s);
  assert.equal(parse('Switch translation to the Catholic Bible').translationId,'dra');
  assert.equal(parse('Douay Rheims Catholic, Tobit chapter 1 verse 2').choices[0].bookId,'tobit');
});
test('ambiguous catalog aliases reject regardless of catalog order; longer titles disambiguate',()=>{
  for(const reverse of [false,true]){
    const {c,parse}=parser();vm.runInContext('var list=BibleData.listTranslations;BibleData.listTranslations=()=>list().map(t=>t.id===\'rv\'?Object.assign({},t,{name:\'World Revised Version\'}):t)'+(reverse?'.reverse()':'')+';',c);
    assert.match(parse('World').error,/Ambiguous/);assert.match(parse('Switch to World Bible').error,/Ambiguous/);
    assert.equal(parse('World Revised').translationId,'rv');assert.equal(parse('World English').translationId,'web');
  }
});
test('catalog is the source of truth: removed editions disappear and renamed titles are recognized',()=>{
  const {c,parse}=parser();vm.runInContext("var list=BibleData.listTranslations;BibleData.listTranslations=()=>list().filter(t=>t.id!=='dra').map(t=>t.id==='rv'?Object.assign({},t,{name:'Verified Revised Version'}):t);",c);
  assert.equal(parse('Catholic Bible'),null);assert.match(parse('Switch to DRA').error,/not available/);assert.equal(parse('Verified Revised').translationId,'rv');
});
test('every canonical book remains a book, including John, James and Catholic aliases',()=>{
  const {c,parse}=parser();
  for(const b of vm.runInContext('BibleCanon.books.map(b=>({id:b.id,names:BibleCanon.names(b.id,b.name)}))',c))for(const name of b.names){
    const p=parse(name+' chapter 1 verse 2');assert.equal(p?.error,undefined,name);assert.equal(p.translationId,null,name);assert.equal(p.choices[0].bookId,b.id,name);
  }
});
test('reserved speech controls, prefix lookalikes, unsupported titles and ambiguous generic names do not select an edition',()=>{
  const {parse}=parser();
  for(const s of ['Play','Pause','Stop','Resume','Continue','Repeat','Next verse','Previous verse','Next chapter','Previous chapter','Worldly','Genevan','Catholicism','Kingdom','Darbyshire','Revised Standard Version','Catholic and WEB','Switch to NIV','English','Standard','Protestant','Bible']){
    const p=parse(s);assert.ok(!p?.translationId,s);if(/^(?:English|Standard|Protestant|Bible)$/.test(s))assert.match(p.error,/Ambiguous/);
  }
});
test('numeric ranges and invalid references are never normalized into a different coordinate',()=>{
  const {parse}=parser();
  for(const s of ['John 3:16-18','John 3:16–18','John 3:16 — 18','DRA Tobit 1:2-3'])assert.match(parse(s).error,/not found/,s);
  assert.equal(parse('Catholic Bible, John one sixteen').choices.filter(c=>c.verse===16)[0].chapter,1);
});

for(const raw of ['Douay Rheims','Douay Reims','Douay Rames','Dewey Rheims','Dewey Reams','Dewey Rames','Do Way Rheims','Do Way Reams','Do We Reems','Do We Reams','Do A Rings','Do A Reigns','Do A Reams','Do A Rains','Dewey Reigns','Dewey Rains','Do Away Reams','Do Away Reigns','Do We Rains','Do We Rings'])test('physical Android transcript: '+raw,()=>{
  const {parse}=parser();
  for(const prefix of ['', 'Switch to ', 'Change to ', 'Read '])for(const suffix of ['', ' Bible', ' Catholic', ' Catholic Bible', ' Version', ' Translation'])for(const name of [raw,raw.toUpperCase(),raw.toLowerCase(),raw.replaceAll(' ','—'),raw.replaceAll(' ','\u00a0'),raw.replaceAll('e',"e’")]){
    const text=prefix+name+suffix;
    const p=parse(text);assert.equal(p?.error,undefined,text);assert.equal(p?.translationId,'dra',text);
    assert.equal(p.play,prefix==='Read ',text);
    const n=parse(text+', Tobit chapter 1 verse 2');assert.equal(n.error,undefined,text);assert.equal(n.translationId,'dra',text);
    assert.deepEqual(JSON.parse(JSON.stringify(n.choices)),[{bookId:'tobit',chapter:1,verse:2}]);
  }
});

test('observed DRA phrases require whole tokens and never reduce to common words or speculative recombinations',()=>{
  const {parse}=parser();
  for(const raw of ['do','we','rings','reigns','reems','do a','do we','a rings','rings Bible','reigns Catholic','Switch to rings','do a ringside','do a ring','do a reems','do we reigns','do away rings','dewey rings','douay reams','do a rings around the table','do we read John 1:1','Play','Pause','Stop'])assert.ok(!parse(raw)?.translationId,raw);
});
test('observed DRA aliases retain exact catalog ambiguity rejection and explicit DRA disambiguation',()=>{
  const {c,parse}=parser();vm.runInContext("var list=BibleData.listTranslations;BibleData.listTranslations=()=>list().map(t=>t.id==='asv'?Object.assign({},t,{name:'Do A Rings Version'}):t).reverse();",c);
  for(const raw of ['do a rings','DO A RINGS BIBLE','Switch to do a rings, Tobit 1:2'])assert.match(parse(raw).error,/Ambiguous/,raw);
  assert.equal(parse('DRA, Tobit 1:2').translationId,'dra');
});


test('new DRA phrases reject catalog collisions and unrelated sentence tails',()=>{
  const variants=['Douay Rames','Dewey Rames','Do Way Reams','Do We Reams','Do A Reams','Do A Rains','Dewey Reigns','Dewey Rains','Do Away Reams','Do Away Reigns','Do We Rains','Do We Rings'];
  for(const raw of variants){
    const {c,parse}=parser();
    for(const tail of [' around the table',' Catholic and WEB',' Catholic Bible shopping','ish'])assert.ok(!parse(raw+tail)?.translationId,raw+tail);
    vm.runInContext("var list=BibleData.listTranslations;BibleData.listTranslations=()=>list().map(t=>t.id==='asv'?Object.assign({},t,{name:"+JSON.stringify(raw+' Version')+"}):t);",c);
    for(const suffix of ['', ' Bible', ' Version'])assert.match(parse('Switch to '+raw+suffix).error,/Ambiguous/,raw+suffix);
    assert.equal(parse('DRA, Tobit 1:2').translationId,'dra');
  }
});
