'use strict';

const fs = require('node:fs');
const path = require('node:path');
const crypto = require('node:crypto');
const {execFileSync} = require('node:child_process');
const {createBookConfig, validateBookConfig, sourceTargets, isaiahBookConfig, romansBookConfig} = require('./original-language-config');
const {generateConfiguredSourceDetailed, writeStaticData} = require('./import-original-language');

const books = {
  exodus: ['Exod', '04868367cdacb6ccdc61488e923e20f918172042e6437842a0621f63ac5b847f'],
  leviticus: ['Lev', 'e21e70265c9ef500182f8ccb4f4e1186e5a79e1169d24cef23cc479baf07b191'],
  numbers: ['Num', '02e4febfcc027d10b3e35e4f091eae67a40d26f37b6254faac6b4af053fe4896'],
  deuteronomy: ['Deut', '04f8087442a1e67a631cd70f2ac4e42fe0a780ae132edb165a3a29f3f290358f'],
  matthew: ['MAT', 'a46e3b9d3f02df1ad2022757474c46fd939517d9457a38f7b253efd6eca7e7d8'],
  mark: ['MAR', 'fddcfeeb7f03cd2bd7be230725f78e2a16b872cdb97dc92703f9dc2cffb28261'],
  luke: ['LUK', '929f10c29dbf8f670edeeb87f997a684c6e13615cdeec796c5fc7e4f10deb49c']
};

const mappings = {
  exodus: {
    counts: {7:29, 8:28, 21:37, 22:30},
    ranges: [[7,26,29,8,1], [8,1,28,8,5], [21,37,37,22,1], [22,1,30,22,2]]
  },
  leviticus: {
    counts: {5:26, 6:23},
    ranges: [[5,20,26,6,1], [6,1,23,6,8]]
  },
  numbers: {
    counts: {16:35, 17:28, 25:19, 29:39, 30:17},
    ranges: [[17,1,15,16,36], [17,16,28,17,1], [25,19,19,26,1], [30,1,1,29,40], [30,2,17,30,1]],
    mergedTargets: {'26:1':['25:19', '26:1']}
  },
  deuteronomy: {
    counts: {12:31, 13:19, 22:29, 23:26, 28:69, 29:28},
    ranges: [[13,1,1,12,32], [13,2,19,13,1], [23,1,1,22,30], [23,2,26,23,1], [28,69,69,29,1], [29,1,28,29,2]]
  },
  matthew: {
    // The Greek source has the widows' houses before shutting the kingdom.
    counts: {}, ranges: [[23,13,13,23,14], [23,14,14,23,13]]
  },
  luke: {
    counts: {}, ranges: [],
    omittedReaderVerses: {'17:36':'The pinned Robinson–Pierpont CSV skips from 17:35 to 17:37.'}
  }
};

const sha = buffer => crypto.createHash('sha256').update(buffer).digest('hex');

function expansionConfig(bookId){
  const [sourceBookId, sha256] = books[bookId];
  const hebrew = sourceBookId !== sourceBookId.toUpperCase();
  const config = createBookConfig(bookId, hebrew ? 'oshb' : 'byzantine', sourceBookId);
  const existing = hebrew ? isaiahBookConfig() : romansBookConfig();
  const artifact = hebrew ? 'wlc/' + sourceBookId + '.xml' : 'csv-unicode/strongs/with-parsing/' + sourceBookId + '.csv';
  const lexicalSource = {...existing.source.lexicalSource};
  config.lexicalJoinStrategy = existing.lexicalJoinStrategy;
  if(hebrew){
    config.oshbWordPolicy = existing.oshbWordPolicy;
    lexicalSource.sha256 = '1f9659ea208f4c498843a0280dacb1448627c33ca77712642d8705793ab66061';
  }else{
    config.alternateAnalysisPolicy = existing.alternateAnalysisPolicy;
    lexicalSource.sha256 = 'df928f01b37632f8af9f16289ce58d10b958014cb5dbd1e1ea715a8d311a0625';
    lexicalSource.licenseVerification = {status:'verified',evidence:'Pinned Strong Greek XML 1.4 prologue declares Public Domain -- Copy Freely.'};
  }
  config.source = {
    ...existing.source, artifact, sha256, lexicalSource,
    licenseVerification:{status:'verified',evidence:hebrew ?
      'Pinned OSHB LICENSE.md and OSIS header, CC BY 4.0 with author and license attribution.' :
      'Pinned byztxt LICENSE.txt declares public domain under the Unlicense.'}
  };
  if(hebrew){
    config.source.textSource = {...existing.source.textSource, artifact, sha256};
    config.source.attribution = existing.source.attribution.replace('CC BY 4.0)', 'CC BY 4.0, https://creativecommons.org/licenses/by/4.0/)') +
      '; GOD4.us excludes variant notes and maps verse numbering';
  }else{
    delete config.source.primaryArtifact;
  }
  const mapping = mappings[bookId];
  config.referenceMapping = {
    strategy:mapping ? 'identity-with-exceptions' : 'identity', verified:true,
    evidence:hebrew ? 'Pinned OSHB verse counts and inline KJV reference notes checked against the Reader.' :
      'Pinned byztxt CSV references checked against the KJV Reader; see docs/expanded-original-language.md.'
  };
  if(mapping){
    for(const [chapter,count] of Object.entries(mapping.counts)) config.sourceVerseCounts[chapter-1] = count;
    config.referenceMapping.ranges = mapping.ranges.map(([sourceChapter,sourceStart,sourceEnd,readerChapter,readerStart]) =>
      ({sourceChapter,sourceStart,sourceEnd,readerChapter,readerStart}));
    if(mapping.mergedTargets) config.referenceMapping.mergedTargets = mapping.mergedTargets;
    if(mapping.omittedReaderVerses) config.referenceMapping.omittedReaderVerses = mapping.omittedReaderVerses;
  }
  config.publication.enabled = true;
  return validateBookConfig(config);
}

function readPinnedSource(root, component){
  const repository = component.upstreamIdentifier.split('/').at(-1);
  const bytes = execFileSync('git', ['-C',path.join(root,repository),'show',component.revision+':'+component.artifact],{maxBuffer:16*1024*1024});
  if(sha(bytes) !== component.sha256) throw new Error('Source checksum mismatch: '+component.artifact);
  return bytes.toString('utf8');
}

function auditHebrewReferences(text, config){
  const counts = Array(config.chapterCount).fill(0);
  const verses = text.matchAll(/<verse\s+osisID="([A-Za-z0-9-]+)\.(\d+)\.(\d+)"[^>]*>([\s\S]*?)<\/verse>/g);
  for(const [,book,chapter,verse,body] of verses){
    if(book !== config.sourceBookId || ++counts[Number(chapter)-1] !== Number(verse)) throw new Error('Unexpected source reference: '+book+'.'+chapter+'.'+verse);
    const [target] = sourceTargets(config,Number(chapter),Number(verse));
    const note = body.match(/KJV:\s*([\w.]+)/)?.[1];
    const mapped = book+'.'+target.chapter+'.'+target.verse;
    if((note && note !== mapped) || (!note && mapped !== book+'.'+chapter+'.'+verse)){
      throw new Error('OSHB reference note mismatch at '+book+'.'+chapter+'.'+verse);
    }
  }
  if(counts.some((count,index) => count !== config.sourceVerseCounts[index])) throw new Error('Unexpected OSHB verse counts for '+config.bookId);
}

function generateExpansion(sourceRoot, output){
  const report = {};
  for(const bookId of Object.keys(books)){
    const config = expansionConfig(bookId);
    const text = readPinnedSource(sourceRoot,config.source);
    const lexical = readPinnedSource(sourceRoot,config.source.lexicalSource);
    if(config.language === 'hebrew') auditHebrewReferences(text,config);
    const {records,diagnostics} = generateConfiguredSourceDetailed(text,lexical,config);
    const missing = records.filter(record => record.strongsNumber && (!record.lemma || !record.transliteration || !record.definition));
    if(missing.length) throw new Error(bookId+' missing lexical joins: '+JSON.stringify(missing.slice(0,5).map(({chapter,verse,strongsNumber})=>({chapter,verse,strongsNumber}))));
    const {shards} = writeStaticData(records,output,[config]);
    if(shards.length !== config.chapterCount) throw new Error('Incomplete chapter set for '+bookId);
    report[bookId] = {chapters:shards.length, ...diagnostics.mapping, excludedApparatusWords:diagnostics.excludedVariantWords,
      alternateAnalyses:diagnostics.alternateAnalyses, sha256:Object.fromEntries(shards.map(shard => [path.basename(shard),sha(fs.readFileSync(path.join(output,shard)))]))};
  }
  return report;
}

function buildExpansion(sourceRoot, output){
  const destination = path.resolve(output);
  if(fs.existsSync(destination)) throw new Error('Output directory must be fresh: '+destination);
  const staging = fs.mkdtempSync(destination+'.stage-');
  try{
    const report = generateExpansion(sourceRoot,staging);
    if(fs.existsSync(destination)) throw new Error('Output directory was created during generation: '+destination);
    fs.renameSync(staging,destination);
    return report;
  }finally{
    // Only the temporary directory returned by mkdtemp is eligible for cleanup.
    fs.rmSync(staging,{recursive:true,force:true});
  }
}

if(require.main === module){
  const [sourceRoot,output,...extra] = process.argv.slice(2);
  if(!sourceRoot || !output || extra.length) throw new Error('Usage: node tools/publish-expanded-original-language.js <source-root> <output-directory>');
  console.log(JSON.stringify(buildExpansion(sourceRoot,output),null,2));
}

module.exports = {buildExpansion, expansionConfig};
