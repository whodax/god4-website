'use strict';

const assert=require('node:assert/strict');
const test=require('node:test');
const {address,referenceLink,resolveReference,tokenLinks,orderedWitness,mapVerifiedPositions}=require('../tools/scripture-crosswalk');
const {adjudicate,compare}=require('../tools/web-alignment-review');
const {evaluate,fingerprint}=require('../tools/evaluate-web-alignment-review');

const a=address('clear-wlcm','18019012'), b=address('reader-hebrew-aramaic','job:19:12');
const witnessed={kind:'ordered-witness',locator:'test ordered source'};
const declared={kind:'declared-numbering',locator:'test coordinates'};
const proof=referenceLink([a],[b],witnessed);

test('source address conversion keeps edition, native coordinates and numbering distinctions',()=>{
  assert.equal(address('crosswire-kjv','Acts.8.37').bookId,'acts');
  assert.equal(address('ult','MAT 23:13').chapter,23);
  assert.equal(address('uhb','PSA 3:0').verse,0);
  assert.equal(address('reader-web','psalms:3:0'),null);
  assert.equal(address('clear-sblgnt','18019012'),null);
  assert.equal(address('reader-web','sirach:1:1'),null);
  assert.equal(address('reader-dra','sirach:1:1').bookId,'sirach');
  assert.equal(address('reader-ethiopian','enoch:1:1').section,'1');
  assert.equal(address('reader-ethiopian','enoch:1:10000'),null);
  assert.equal(address('reader-web','matthew:23:13').verse,13);
  assert.notEqual(address('reader-web','matthew:23:13').source,address('ugnt','MAT 23:13').source);
});

test('explicit bridges stay coordinate-only and conflicting edges resolve as ambiguous',()=>{
  const previous=address('reader-hebrew-aramaic','job:19:11'), next=address('reader-hebrew-aramaic','job:19:13');
  const split=referenceLink([a],[previous,b],declared);
  assert.equal(resolveReference([split],a,b.source).status,'coordinate-only');
  assert.equal(split.relation,'one-to-many');
  assert.equal(referenceLink([previous,b],[a],declared).relation,'many-to-one');
  assert.equal(referenceLink([previous,b],[a,address('clear-wlcm','18019013')],declared).relation,'many-to-many');
  assert.equal(resolveReference([split,referenceLink([a],[next],declared)],a,b.source).status,'ambiguous');
  assert.equal(resolveReference([],a,b.source).status,'unavailable');
  assert.equal(referenceLink([a],[{...b,verse:55}],declared),null);
  assert.equal(referenceLink([a],[{...b,revision:'stale'}],declared),null);
  assert.equal(referenceLink([a],[address('reader-hebrew-aramaic','ezra:4:8')],declared),null);
  assert.equal(referenceLink([address('reader-dra','daniel:13:1')],[address('reader-hebrew-aramaic','daniel:1:1')],declared),null);
});

const token=(id,form='x',morphology='N',atoms)=>({id,form,lemma:'lemma',morphology,language:'hebrew',atoms});
const whole=token('n','ab','N',[['hebrew','a','lemma','N'],['hebrew','b','lemma','N']]);
const first=token('left','a'),second=token('right','b');
const edges=(from,to)=>({locator:'token evidence fixture',groups:[{from,to}]});

test('explicit token and morpheme groups preserve the four cardinalities',()=>{
  assert.equal(tokenLinks(proof,[first],[first],edges(['left'],['left']))[0].relation,'one-to-one');
  assert.equal(tokenLinks(proof,[whole],[first,second],edges(['n'],['left','right']))[0].relation,'one-to-many');
  assert.equal(tokenLinks(proof,[first,second],[whole],edges(['left','right'],['n']))[0].relation,'many-to-one');
  assert.equal(tokenLinks(proof,[whole,token('third','c')],[first,token('tail','bc','N',[
    ['hebrew','b','lemma','N'],['hebrew','c','lemma','N']
  ])],edges(['n','third'],['left','tail']))[0].relation,'many-to-many');
});

test('rejected token links include repeated coordinates, incomplete morphemes, reordering, Greek morphology and Strong-only evidence',()=>{
  assert.equal(tokenLinks(proof,[whole],[first],edges(['n'],['left'])),null);
  assert.equal(tokenLinks(proof,[whole],[first,second],edges(['n'],['right','left'])),null);
  assert.equal(tokenLinks(proof,[first],[{...first,form:'z',strongsNumber:'H100'}],edges(['left'],['left'])),null);
  assert.equal(tokenLinks(proof,[{...first,language:'greek'}],[{...first,language:'greek',morphology:'V'}],edges(['left'],['left'])),null);
  assert.equal(tokenLinks(referenceLink([a],[b],declared),[first],[first],edges(['left'],['left'])),null);
  assert.equal(tokenLinks(proof,[first],[first],{locator:'x',groups:[{from:['left'],to:['left']},{from:['left'],to:['left']}]}),null);
});

test('whole-verse witness must match the exact displayed original source, including Greek morphology',()=>{
  const source=address('ugnt','MAT 1:1'), target=address('reader-greek-byzantine','matthew:1:1');
  const original={form:'θεοῦ',strong:'G23160',morph:'Gr,N,,,,,GMS,'};
  const reader={surface:'θεου',strongsNumber:'G2316',morphology:'N-GSM',language:'greek',
    status:'authoritative',tokenIndex:0,bookId:'matthew',chapter:1,verse:1};
  assert.ok(orderedWitness(source,target,[original],[reader]));
  assert.equal(orderedWitness(source,target,[original],[{...reader,verse:2}]),null);
  assert.equal(orderedWitness(source,target,[original],[{...reader,morphology:'N-NSM'}]),null);
  assert.equal(mapVerifiedPositions(a,[['o180190120011','o180190120012']],{kind:'validated-package',locator:'fixture'},[{tokenIndex:0}]).size,2);
  assert.equal(mapVerifiedPositions(a,[['o180190110011']],{kind:'validated-package',locator:'fixture'},[{tokenIndex:0}]),null);
});

const record={id:'example',stratum:'contraction',text:'I don’t know',tokens:[
  {index:0,surface:'x',language:'hebrew',morphology:'N'},
  {index:1,surface:'y',language:'hebrew',morphology:'V'}
]};
const group={spans:[{start:2,end:7,text:'don’t'}],positions:[1]};
const review=(reviewerId,groups=[group])=>({reviewerId,mode:'independent-human',date:'2026-11-27',
  groups,evidence:[{source:'fixture',revision:'pinned',locator:'verse'}],rationale:'Fixture rationale'});
const roster=new Set(['first','second','third']);

test('gold review gates reject AI, repeated identities, mismatched text and invalid token IDs',()=>{
  assert.equal(adjudicate(record,[review('first'),{...review('second'),mode:'AI-assisted'}],roster).status,'pending');
  assert.equal(adjudicate(record,[review('first'),review('first')],roster).status,'pending');
  assert.equal(adjudicate(record,[review('first')],roster).status,'pending');
  assert.throws(()=>adjudicate(record,[review('first'),review('second',[{...group,spans:[{...group.spans[0],text:"don't"}]}])],roster),/exact English/);
  assert.throws(()=>adjudicate(record,[review('first'),review('second',[{...group,positions:[2]}])],roster),/original token/);
});

test('disagreeing reviews require a distinct adjudicator and evaluation recognizes partial overlap',()=>{
  assert.equal(adjudicate(record,[review('first'),review('second',[])],roster).status,'disagreement');
  assert.equal(adjudicate(record,[review('first'),review('second',[])],roster,review('first')).status,'disagreement');
  assert.equal(adjudicate(record,[review('first'),review('second',[])],roster,review('third')).status,'resolved');
  assert.deepEqual(compare([[[[2,7]],[1]]],[[[[2,7]],[0,1]]]),{exact:0,partial:1,disagreement:0,missing:0});
  assert.deepEqual(compare([[[[2,7]],[1]]],[[[[2,7]],[0]]]),{exact:0,partial:0,disagreement:1,missing:1});
});

test('held-out evaluation excludes unadjudicated and development records',()=>{
  const dataset={version:1,baseline:'revision',holdout:[record],development:[{id:'training'}]};
  const prediction={datasetRevision:'revision',datasetVersion:1,datasetChecksum:fingerprint(dataset),passages:{example:[group]}};
  const empty={datasetRevision:'revision',datasetVersion:1,datasetChecksum:fingerprint(dataset),passages:{}};
  assert.equal(evaluate(dataset,empty,prediction,[...roster]).pending,1);
  const submissions={...empty,passages:{example:{reviews:[review('first'),review('second')]}}};
  assert.equal(evaluate(dataset,submissions,prediction,[...roster]).exact,1);
  assert.throws(()=>evaluate(dataset,submissions,{...prediction,passages:{training:[]}},[...roster]),/evaluation case/);
  assert.throws(()=>evaluate(dataset,submissions,{...prediction,datasetVersion:3},[...roster]),/different edition/);
});

test('review packets contain disjoint passages and no held-out model links or human claims',()=>{
  const dataset=require('../docs/shell-81-web-review-v1.json');
  const {development,holdout}=dataset;
  const developmentCoordinates=new Set(development.map(record=>record.passage.coordinate));
  assert.equal(new Set(holdout.map(record=>record.passage.coordinate)).size,holdout.length);
  assert.ok(holdout.every(record=>!developmentCoordinates.has(record.passage.coordinate) &&
    !record.spans && !record.proposedPositions && !record.automatedFinding &&
    record.reviews.length===0 && record.adjudication===null));
  for(const language of ['hebrew','aramaic','greek']) assert.ok(holdout.some(record=>record.tokens.some(token=>token.language===language)));
  assert.ok(development.some(record=>record.stratum==='priority:moab'));
  assert.ok(development.some(record=>record.stratum==='priority:philistines'));
});
