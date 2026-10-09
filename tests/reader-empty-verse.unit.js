'use strict';
const {test} = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const vm = require('node:vm');
const {execFileSync} = require('node:child_process');
const generator = require('../tools/generate-translation-manifest');
const source = fs.readFileSync(require.resolve('../js/bible/reader.js'), 'utf8');
function reader(verses){
  const context = vm.createContext({
    UserData:{readerPosition:{load:() => ({bookId:'romans',chapter:16})},translation:{load:() => 'web'}},
    document:{readyState:'loading',addEventListener(){}}, window:{addEventListener(){}},
    BibleData:{getChapter:() => ({verses})}
  });
  vm.runInContext(source + ';globalThis.setTestVerse = function(n){currentVerse = n;};', context);
  return context;
}
for(const [name, value, expected] of [
  ['empty','',false], ['spaces','   ',false], ['Unicode whitespace','\t\r\n\u00a0\u2003',false],
  ['null',null,false], ['undefined',undefined,false], ['zero',0,false], ['false',false,false],
  ['number',25,false], ['array',['Scripture'],false], ['object',{verse:25,text:'Scripture'},false],
  ['normal','The grace of our Lord Jesus Christ be with you all! Amen.',true],
  ['surrounding whitespace',' \tThe LORD is my shepherd.\n ',true]
]) test(`renderability: ${name}`, () => assert.equal(reader([]).isRenderableVerseText(value),expected));
test('next/previous traverse original coordinates across empty and whitespace slots', () => {
  const context=reader(['one','',' \t','four']);
  context.setTestVerse(1); assert.equal(context.getAdjacentReaderVerseNumber(1),4);
  context.setTestVerse(4); assert.equal(context.getAdjacentReaderVerseNumber(-1),1);
  assert.equal(context.getAdjacentReaderVerseNumber(1),null);
  context.setTestVerse(1); assert.equal(context.getAdjacentReaderVerseNumber(-1),null);
});
test('next finds first readable coordinate; previous has no destination without a selection', () => {
  const context=reader(['','second']); context.setTestVerse(null);
  assert.equal(context.getAdjacentReaderVerseNumber(1),2);
  assert.equal(context.getAdjacentReaderVerseNumber(-1),null);
});
test('an all-empty chapter offers no adjacent destination', () => {
  const context=reader(['','  ',null]); context.setTestVerse(null);
  assert.equal(context.getAdjacentReaderVerseNumber(1),null);
  assert.equal(context.getAdjacentReaderVerseNumber(-1),null);
});
test('the historical Reader repair commit left Scripture, manifest and original-language data unchanged', () => {
  const changed=execFileSync('git',['diff','--name-only','58f89ebd8fa0913517e87d909c98d0d0e4033b12','af41938256a4fdc1cf7675474d9a29a1be21cab6','--','js/bible','data/word-study','js/word-study'],{encoding:'utf8'}).trim().split(/\r?\n/).filter(Boolean);
  assert.deepEqual(changed,['js/bible/reader.js']);
  generator.checkOutput();
});
