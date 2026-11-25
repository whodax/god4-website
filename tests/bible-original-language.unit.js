'use strict';

const {test} = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const vm = require('node:vm');
const {createHash} = require('node:crypto');
const canon = require('../js/bible/canon');
const {readerBook} = require('../tools/original-language-config');
const manifest = require('../docs/bible-original-language-manifest.json');

const shards = path.join(__dirname,'../data/word-study/original-language');

test('each shared Reader book has one Word Study shard per chapter', () => {
  const books = canon.order('kjv');
  assert.deepEqual(fs.readdirSync(shards).sort(),books.sort());
  for(const id of books){
    const chapterFiles = fs.readdirSync(path.join(shards,id));
    assert.deepEqual(chapterFiles.sort(),Array.from({length:readerBook(id).chapters},(_,index) => (index+1)+'.json').sort(),id);
  }
});

test('the compact corpus covers its published verses with valid lexical references', () => {
  const omissions = {'nehemiah':['7:68'],acts:['8:37','15:34','24:7']};
  assert.equal(Object.keys(manifest.books).length,55);
  for(const [book,entry] of Object.entries(manifest.books)){
    const source = readerBook(book);
    const missing = [];
    let count = 0;
    for(let chapter = 1; chapter <= source.chapters; chapter++){
      const bytes = fs.readFileSync(path.join(shards,book,chapter+'.json'));
      const {verses,lexicon} = JSON.parse(bytes);
      assert.equal(createHash('sha256').update(bytes).digest('hex'),entry.sha256[chapter]);
      assert.equal(verses.length,source[chapter].verses.length,book+' '+chapter);
      for(const [index,tokens] of verses.entries()){
        if(!tokens){
          missing.push(chapter+':'+(index+1));
          continue;
        }
        assert.ok(tokens.length);
        for(const [surface,strong,morphology] of tokens){
          assert.ok(surface && morphology);
          if(strong) assert.ok(Array.isArray(lexicon[strong]));
        }
        count += tokens.length;
      }
    }
    assert.deepEqual(missing,omissions[book] || [],book);
    assert.deepEqual(missing,entry.missing,book);
    assert.equal(count,entry.tokens,book);
  }
});

test('the live provider expands compact Hebrew, Aramaic and Greek and respects verse boundaries', async () => {
  const fetch = async url => {
    const filename = path.join(shards,...url.split('/').slice(-2));
    return {ok:fs.existsSync(filename),json:async () => JSON.parse(fs.readFileSync(filename,'utf8'))};
  };
  const provider = vm.runInNewContext(
    fs.readFileSync(path.join(__dirname,'../js/word-study/original-language-provider.js'),'utf8') +
    '\nOriginalLanguageWordStudyProvider;', {fetch}
  );
  for(const [bookId,chapter,verse,language] of [['joshua',1,1,'hebrew'],['daniel',2,4,'aramaic'],['revelation',22,21,'greek']]){
    const result = await provider.lookupVerse({translationId:'web',bookId,chapter,verse});
    assert.equal(result.status,'available');
    assert.ok(result.records.some(record => record.language === language && record.strongsNumber && record.definition));
    assert.ok(result.records.every((record,index) => record.tokenIndex === index && record.bookId === bookId &&
      record.chapter === chapter && record.verse === verse));
  }
  const lookup = (bookId,chapter,verse,translationId='kjv') => provider.lookupVerse({bookId,chapter,verse,translationId});
  const [before,after] = await Promise.all([lookup('psalms',13,5),lookup('psalms',13,6)]);
  assert.equal(before.records.length,6);
  assert.equal(after.records.length,5);
  assert.equal(after.records[0].strongsNumber,'H7891');
  assert.equal((await lookup('psalms',23,1,'dra')).status,'unavailable');
  assert.equal((await lookup('acts',8,37)).status,'unavailable');
  assert.equal((await lookup('acts',8,38)).status,'available');
});
