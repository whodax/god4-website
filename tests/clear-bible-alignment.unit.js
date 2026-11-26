'use strict';

const assert=require('node:assert/strict');
const {test}=require('node:test');
const fs=require('node:fs');
const os=require('node:os');
const path=require('node:path');
const {loadPackage,targetVerse,validatePackageVerse}=require('../tools/clear-bible-alignment');

const ref='01001001';
const target=[[ref+'001',ref,'in','','','',''],[ref+'002',ref,'bread','y','','',''],[ref+'003',ref,'.','','y','','']];
const part=(id,form,strong,pos)=>[id,'',form,strong,'','',pos,''];
const prefix='o'+ref+'0011';
const noun='o'+ref+'0012';
const source=[part(prefix,'בְּ','0871a','preposition'),part(noun,'לֶחֶם','3899','noun')];
const witness=[{form:'בְּ\u2060לֶחֶם',strong:'b:H3899',morph:'He,R:Ncmsa'}];
const records=[{tokenIndex:0,language:'hebrew',surface:'בְּ/לֶחֶם',strongsNumber:'H3899',morphology:'HR/Ncmsa',status:'authoritative'}];
function evidence({hebrew=true,id='WLCM',words=source,english=target,links=[{source:[prefix,noun],target:target.slice(0,2).map(row=>row[0])}]}={}) {
  return {id,hebrew,sources:new Map([[ref,words]]),targets:new Map([[ref,english]]),alignments:new Map([[ref,links]])};
}

test('reconstructs punctuation and retains exact lexical positions',()=>{
  const result=targetVerse(target,ref);
  assert.equal(result.text,'in bread.');
  assert.deepEqual([...result.offsets.values()],[[0,2],[3,8]]);
  assert.equal(targetVerse([target[1],target[0]],ref).ambiguous,true);
  assert.equal(targetVerse([[target[0][0],'01001002','in','','','','']],ref).reason,'target verse bridge or remap');
});

test('complete Hebrew morphemes project to one ordered, fully identified word',()=>{
  assert.deepEqual(validatePackageVerse(evidence(),ref,witness,records).groups,[[[[0,2],[3,8]],[0]]]);
  const withHeadMismatch=[source[0],part(noun,'לֶחֶם','0871a','noun')];
  const wrongClass=[source[0],part(noun,'לֶחֶם','3899','verb')];
  for (const words of [withHeadMismatch,wrongClass,source.slice().reverse()]) {
    assert.match(validatePackageVerse(evidence({words}),ref,witness,records).reason,/original/);
  }
  assert.match(validatePackageVerse(evidence(),ref,witness,[{...records[0],morphology:'HR/Vqp3ms'}]).reason,/original/);
});

test('partial morphemes, excluded punctuation and unknown position IDs fail closed',()=>{
  const partial=[{source:[noun],target:[target[1][0]]}];
  const punctuation=[{source:[prefix,noun],target:[target[2][0]]}];
  const unknown=[{source:[prefix,'o010010020012'],target:[target[1][0]]}];
  assert.equal(validatePackageVerse(evidence({links:partial}),ref,witness,records).reason,'no complete original word groups');
  assert.equal(validatePackageVerse(evidence({links:punctuation}),ref,witness,records).reason,'no complete original word groups');
  assert.equal(validatePackageVerse(evidence({links:unknown}),ref,witness,records).ambiguous,true);
});

test('removing a partial group also removes other groups linked to its English span',()=>{
  const other='o'+ref+'0021';
  const words=[...source,part(other,'דָּג','1709','noun')];
  const second={form:'דָּג',strong:'H1709',morph:'He,Ncmsa'};
  const secondRecord={...records[0],tokenIndex:1,surface:'דָּג',strongsNumber:'H1709',morphology:'HNcmsa'};
  const links=[{source:[noun],target:[target[1][0]]},{source:[other],target:[target[1][0]]}];
  assert.equal(validatePackageVerse(evidence({words,links}),ref,[...witness,second],[...records,secondRecord]).reason,'no complete original word groups');
});

test('exact Greek surfaces and morphology are required even with the same Strong ID',()=>{
  const word='n'+ref+'001';
  const rows=[[word,'','ἄρτος','G0740','','','','noun','N-NSM']];
  const dataset=evidence({hebrew:false,id:'SBLGNT',words:rows,links:[{source:[word],target:[target[1][0]]}]});
  const native=[{form:'ἄρτος',strong:'G07400',morph:'Gr,N,,,,,NMS,'}];
  const reader=[{tokenIndex:0,language:'greek',surface:'ἄρτος',strongsNumber:'G740',morphology:'N-NSM',status:'authoritative'}];
  assert.deepEqual(validatePackageVerse(dataset,ref,native,reader).groups,[[[[3,8]],[0]]]);
  assert.match(validatePackageVerse(dataset,ref,native,[{...reader[0],surface:'ἄρτον'}]).reason,/original/);
  rows[0][8]='N-ASM';
  assert.match(validatePackageVerse(dataset,ref,native,reader).reason,/original/);
});

test('package loader refuses an unpinned alignment artifact',()=>{
  const dir=fs.mkdtempSync(path.join(os.tmpdir(),'god4-clear-test-'));
  try{
    fs.writeFileSync(path.join(dir,'shell80-WLCM-BSB-manual.json'),'{}');
    assert.throws(()=>loadPackage(dir,'WLCM',{}),/Clear.Bible checksum mismatch/);
  }finally{
    fs.unlinkSync(path.join(dir,'shell80-WLCM-BSB-manual.json'));
    fs.rmdirSync(dir);
  }
});
