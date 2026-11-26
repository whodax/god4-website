'use strict';

const assert = require('node:assert/strict');
const {test} = require('node:test');
const fs = require('node:fs');
const path = require('node:path');
const vm = require('node:vm');
const {execFileSync} = require('node:child_process');
const {createHash} = require('node:crypto');
const {readBook,readOriginal,readAlignment,validateVerse,projection,projectVerse,generate} = require('../tools/import-web-alignment');
const berean = require('../tools/word-study-berean');
const {loadBibleLibrary,READER_TOKEN_PATTERN} = require('../tools/audit-word-study-coverage');
const report = require('../docs/shell-79-web-alignment-report.json');
const web = loadBibleLibrary('web.js','webLibrary');
const root = path.resolve(__dirname,'../data/word-study/alignment/web');

const marker = (token, ordinal = 1, count = 1) =>
  '\\zaln-s |x-strong="'+token.strong+'" x-lemma="'+token.lemma+'" x-morph="'+token.morph+
  '" x-occurrence="'+ordinal+'" x-occurrences="'+count+'" x-content="'+token.form+'"\\*';
const end = '\\zaln-e\\*';
const tagged = (text, ordinal = 1, count = 1) =>
  '\\w '+text+'|x-occurrence="'+ordinal+'" x-occurrences="'+count+'"\\w*';
const article = {form:'ὁ',lemma:'ὁ',strong:'G35880',morph:'Gr,EA,,,,NMS,'};
const son = {form:'υἱός',lemma:'υἱός',strong:'G52070',morph:'Gr,N,,,,,NMS,'};
const greek = (surface,strongsNumber,morphology,tokenIndex) =>
  ({surface,strongsNumber,morphology,tokenIndex,language:'greek',status:'authoritative'});
const records = [greek('ο','G3588','T-NSM',0),greek('υιος','G5207','N-NSM',1)];

test('USFM verse parser separates prefixed poetry, bridges and duplicate references',()=>{
  const verses = readBook('\\c 1\n\\q1 \\v 1 text\n\\q1 \\v 2-3 bridge\n\\v 4 first\n\\v 4 duplicate\n\\c 2\n\\v 1 next\n');
  assert.equal(verses.get('1:1').trim(),'text');
  assert.equal(verses.has('1:2'),false);
  assert.equal(verses.get('1:4'),null);
  assert.equal(verses.get('2:1').trim(),'next');
  assert.deepEqual(readOriginal('\\w ὁ|lemma="ὁ" strong="G35880" x-morph="Gr,EA,,,,NMS,"\\w*'),[article]);
});

test('a nested source group preserves two English spans and two original positions',()=>{
  const body = '"'+marker(article)+marker(son)+tagged('the')+' '+tagged('son')+end+end+'."';
  const result = validateVerse('“the son.”',body,[article,son],records);
  assert.deepEqual(result.alignments,[[[[1,4],[5,8]],[0,1]]]);
  assert.deepEqual([...result.taggedWords],[0,1]);
  assert.equal(validateVerse('“a son.”',body,[article,son],records).reason,'English wording or punctuation differs');
});

test('source order and morphology must both agree with the live manuscript',()=>{
  const body = marker(article)+tagged('the')+end+' '+marker(son)+tagged('son')+end;
  const wrongMorph = [records[0],{...records[1],morphology:'N-NSF'}];
  for (const invalid of [[son,article],[article,{...son,strong:'G52080'}]]) {
    assert.match(validateVerse('the son',body,invalid,records).reason,/original position/);
  }
  assert.match(validateVerse('the son',body,[article,son],wrongMorph).reason,/morphology/);
});

test('repeated words use independent original occurrence positions and reject ambiguity',()=>{
  const original = [article,article];
  const displayed = [records[0],{...records[0],tokenIndex:1}];
  const bodyFor = ordinal => marker(article,1,2)+tagged('the',1,2)+end+' '+marker(article,ordinal,2)+tagged('the',2,2)+end;
  assert.deepEqual(validateVerse('the the',bodyFor(2),original,displayed).alignments,[[[[0,3]],[0]],[[[4,7]],[1]]]);
  assert.deepEqual(validateVerse('the the',bodyFor(1),original,displayed),{reason:'ambiguous original occurrence',ambiguous:true});
  assert.equal(validateVerse('the the',bodyFor(2).replace('x-occurrence="2" x-occurrences="2"\\w*','x-occurrence="1" x-occurrences="2"\\w*'),original,displayed).reason,'ambiguous English occurrence');
});

test('every published shard is pinned and has exact WEB text and selectable English spans',()=>{
  const index = JSON.parse(fs.readFileSync(path.join(root,'index.json'),'utf8'));
  const files = Object.entries(index).flatMap(([book,chapters])=>chapters.map(chapter=>book+'/'+chapter+'.json'));
  assert.deepEqual([...files,'index.json'].sort(),Object.keys(report.files).sort());
  for (const [relative,pin] of Object.entries(report.files)) {
    const bytes = fs.readFileSync(path.join(root,relative));
    assert.equal(bytes.length,pin.bytes,relative);
    assert.equal(createHash('sha256').update(bytes).digest('hex'),pin.sha256,relative);
    if (relative==='index.json') continue;
    const [book,chapter] = relative.replace('.json','').split('/');
    for (const [verse,[text,tokens,groups]] of Object.entries(JSON.parse(bytes))) {
      assert.equal(text,web[book][chapter].verses[verse-1]);
      const words = [...text.matchAll(READER_TOKEN_PATTERN)];
      for (const [spans,positions] of groups) {
        assert.ok(positions.length && positions.every(index=>tokens[index]));
        for (const [start,end] of spans) assert.ok(words.some(word=>word.index===start && start+word[0].length===end));
      }
    }
  }
});

test('import refuses an expanded source whose pinned contents do not match',async()=>{
  await assert.rejects(generate([__dirname,__dirname,__dirname],path.join(__dirname,'unused-web-test-output')),/Input checksum mismatch/);
});

test('partial projection keeps only complete groups inside one unchanged, unique sentence',()=>{
  const body = 'He spoke. She saw '+marker(article)+marker(son)+tagged('the')+' '+tagged('son')+end+end+' near home. He left.';
  const from = readAlignment(body);
  const to = 'He came. She saw the son near home. He stayed.';
  const result = projectVerse(to,body,[article,son],records,from,projection(from.english,to));
  assert.equal(result.mode,'sentence');
  assert.deepEqual(result.alignments[0],[[[17,20],[21,24]],[0,1]]);
  assert.equal(projection(from.english,to+' She saw the son near home.').ambiguous,true);
  assert.ok(projection(from.english,'He came. She saw the son, near home. He stayed.').reason);
  assert.equal(projection('She saw the son near home','She saw the son near home.').mode,'period');
  assert.ok(projection('She saw the son near home?','She saw the son near home.').reason);
  const crossed = marker(article)+'He spoke. She saw '+tagged('the')+' '+marker(son)+tagged('son')+end+
    ' near home. He '+tagged('left')+end+'.';
  const parsed = readAlignment(crossed);
  const crossResult = projectVerse(to,crossed,[article,son],records,parsed,projection(parsed.english,to));
  assert.equal(crossResult.reason,'unchanged English has no complete alignment group');
});

test('Berean groups require ordered manuscript evidence, compatible morphology, and nonsupplied words',()=>{
  const rows = [
    {order:5,englishOrder:8,language:'greek',form:'ὁ',id:'3588',morph:'Art-NMS',words:'the',start:0,end:3},
    {order:6,englishOrder:9,language:'greek',form:'υἱός',id:'5207',morph:'N-NMS',words:'son',start:4,end:7}
  ];
  const check = (data,witness=[article,son])=>berean.validate({rows:data},witness,records,(token,record)=>
    token===article ? record.strongsNumber==='G3588' : record.strongsNumber==='G5207');
  assert.deepEqual(check(rows).groups,[[[[0,3]],[0]],[[[4,7]],[1]]]);
  assert.deepEqual(check([rows[0],{...rows[1],words:'[son]'}]).groups,[[[[0,3]],[0]]]);
  assert.deepEqual(check([rows[0],{...rows[1],morph:'N-NFS'}]).groups,[[[[0,3]],[0]]]);
  assert.ok(check([rows[0],{...rows[1],form:'ἄλλος'}]).reason);
  assert.ok(check([rows[0],{...rows[1],order:5}]).ambiguous);
  assert.ok(check(rows,[son,article]).reason);
});

test('Shell 77 WEB rows remain intact and the expansions add only new references',()=>{
  const old = require('../docs/shell-77-web-alignment-report.json');
  let count = 0;
  for (const relative of Object.keys(old.files).filter(file=>file.includes('/'))) {
    const source = execFileSync('git',['show','2e82e2c:data/word-study/alignment/web/'+relative],{cwd:path.resolve(__dirname,'..')});
    const existing = JSON.parse(source);
    const current = JSON.parse(fs.readFileSync(path.join(root,relative)));
    for (const [verse,row] of Object.entries(existing)) {
      assert.deepEqual(current[verse],row);
      count++;
    }
  }
  assert.equal(count,57);
  assert.equal(require('../docs/shell-78-web-alignment-report.json').additions.verses,251);
});

test('all Shell 78 WEB rows survive and the report reconciles to live baseline totals',()=>{
  const previous=require('../docs/shell-78-web-alignment-report.json');
  let count=0;
  for (const relative of Object.keys(previous.files).filter(file=>file.includes('/'))) {
    const source=execFileSync('git',['show','eea5c23:data/word-study/alignment/web/'+relative],{cwd:path.resolve(__dirname,'..')});
    const existing=JSON.parse(source);
    const current=JSON.parse(fs.readFileSync(path.join(root,relative)));
    for (const [verse,row] of Object.entries(existing)) {
      assert.deepEqual(current[verse],row);
      count++;
    }
  }
  assert.equal(count,308);
  assert.equal(report.totals.prior,312);
  assert.equal(report.totals.wordsBefore,1829);
  assert.equal(report.totals.priorityWordsBefore,1065);
  assert.equal(Object.keys(report.forms).length,500);
});

test('the production provider verifies every WEB row and fails closed on changed input',async()=>{
  const site = path.resolve(__dirname,'..');
  const requests = [];
  const realm = vm.createContext({BibleCanon:require('../js/bible/canon'),AbortController,setTimeout,clearTimeout,
    async fetch(url) {
      requests.push(url);
      const file = path.join(site,url);
      return {ok:fs.existsSync(file),json:async()=>JSON.parse(fs.readFileSync(file,'utf8'))};
    }
  });
  for (const module of ['original-language-provider','alignment']) {
    vm.runInContext(fs.readFileSync(path.join(site,'js/word-study',module+'.js'),'utf8'),realm);
  }
  assert.deepEqual(requests,[]);
  const {WordStudyAlignment:alignment,OriginalLanguageWordStudyProvider:original} = realm;
  for (const file of Object.keys(report.files).filter(file=>file.includes('/'))) {
    const [bookId,chapter] = file.replace('.json','').split('/');
    for (const [verse,[verseText]] of Object.entries(JSON.parse(fs.readFileSync(path.join(root,file),'utf8')))) {
      const context = {translationId:'web',bookId,chapter:Number(chapter),verse:Number(verse),verseText};
      const {records} = await original.lookupVerse(context);
      const result = await alignment.lookupChapter(context,records);
      assert.equal(result?.status,'available',bookId+' '+chapter+':'+verse);
      assert.equal(await alignment.lookupChapter({...context,verseText:verseText+'!'},records),null);
      assert.equal(await alignment.lookupChapter(context,[{...records[0],morphology:'changed'},...records.slice(1)]),null);
      assert.equal(alignment.lookupChapter({...context,translationId:'asv'},records),null);
    }
  }
  assert.equal(requests.filter(url=>url.endsWith('/alignment/web/index.json')).length,1);
  assert.equal(await alignment.lookupChapter({translationId:'web',bookId:'genesis',chapter:1,verse:1},[{}]),null);
  assert.ok(!requests.includes('/data/word-study/alignment/web/genesis/1.json'));

  for (const [bookId,chapter,verse,displayWord,expected] of [
    ['matthew',12,8,'Lord','The one who has authority over the Sabbath.'],
    ['john',9,5,'light','Jesus describes himself as the one who gives people spiritual sight.'],
    ['2-peter',1,7,'love','Care for others that goes beyond affection for those close to you.'],
    ['hosea',5,9,'Ephraim','The tribe descended from Ephraim, the name Hosea uses here for the northern kingdom of Israel.'],
    ['1-chronicles',7,27,'Joshua','Joshua son of Nun, listed here among the descendants of Ephraim.'],
    ['galatians',5,22,'kindness','Treating others with goodness and consideration, listed here as fruit of the Spirit.'],
    ['1-timothy',4,5,'prayer','An appeal to God, here connected with receiving food with thanksgiving.']
  ]) {
    const verseText = web[bookId][chapter].verses[verse-1];
    const englishStart = verseText.indexOf(displayWord);
    const context = {translationId:'web',bookId,chapter,verse,verseText,displayWord,englishStart,
      englishEnd:englishStart+displayWord.length};
    const {records} = await original.lookupVerse(context);
    const result = await alignment.lookupChapter(context,records);
    assert.equal(alignment.contextualDefinition(context,records,result)?.definition,expected);
    assert.equal(alignment.contextualDefinition({...context,bookId:'genesis',verseText:'Other context'},records,result),null);
    assert.equal(alignment.contextualDefinition(context,records,null),null);
  }
});
