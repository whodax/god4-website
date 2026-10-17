'use strict';

// Explicit publication-candidate workflow. Dry configuration stays disabled;
// only this reviewed, complete-book path enables the existing guarded writer.
const fs = require('node:fs'), path = require('node:path'), crypto = require('node:crypto');
const {isaiahBookConfig,validateBookConfig,assertPublicationEligible} = require('./original-language-config');
const {generateConfiguredSourceDetailed,writeStaticData,SCHEMA_FIELDS} = require('./import-original-language');
const {validateIsaiahText,defaultSourceRoot} = require('./validate-isaiah-original-language');
const repository = path.resolve(__dirname,'..');
const productionBase = path.join(repository,'data/word-study/original-language');
const sha = bytes => crypto.createHash('sha256').update(bytes).digest('hex');
function requireCheck(condition,message) { if(!condition) throw new TypeError(message); }
const chapterNames = Array.from({length:66},(_,i)=>(i+1)+'.json');
function readInputs(sourceRoot) {
  const config = isaiahBookConfig();
  requireCheck(config.lexicalJoinStrategy === 'strongs-hebrew-xml-subset','Unexpected Isaiah lexical strategy');
  const text = fs.readFileSync(path.join(sourceRoot,'morphhb',config.source.artifact),'utf8');
  const lexical = fs.readFileSync(path.join(sourceRoot,'strongs',config.source.lexicalSource.artifact),'utf8');
  const validation = validateIsaiahText(text,lexical);
  const s = validation.summary;
  requireCheck(s.readerChapters===66 && s.readerVerses===1292 && s.tokens===16932 && s.hebrew===16932 && s.aramaic===0 &&
    s.excludedVariantNotes===53 && s.excludedVariantWords===56 && s.numericStrongsJoinFailures===0 && s.missingSelectedLexicalFields===0,'Unexpected complete-book validation totals');
  config.publication.enabled = true;
  validateBookConfig(config); assertPublicationEligible(config);
  return {config,text,lexical,validation};
}
function generateCandidate(inputs) {
  const {config,text,lexical,validation} = inputs;
  const result = generateConfiguredSourceDetailed(text,lexical,config);
  requireCheck(result.records.length===16932,'Incomplete candidate tokens');
  requireCheck(JSON.stringify(result.diagnostics.mapping)===JSON.stringify(validation.diagnostics.mapping),'Unexpected mapping diagnostics');
  const bytes = new Map(), chapters = [];
  for(let chapter=1;chapter<=66;chapter++) {
    const records=result.records.filter(r=>r.chapter===chapter);
    const content=Buffer.from(JSON.stringify({records},null,2)+'\n','utf8');
    bytes.set(chapter+'.json',content);
    chapters.push({chapter,file:'isaiah/'+chapter+'.json',byteSize:content.length,sha256:sha(content),recordCount:records.length,verseCount:new Set(records.map(r=>r.verse)).size});
  }
  const manifest={formatVersion:1,bookId:'isaiah',lexicalStrategy:config.lexicalJoinStrategy,
    source:{repository:config.source.upstreamIdentifier,revision:config.source.revision,artifact:config.source.artifact,sha256:config.source.sha256,license:config.source.license},
    lexicalSource:config.source.lexicalSource,attribution:config.source.attribution,recordFields:SCHEMA_FIELDS,
    referenceMapping:config.referenceMapping,apparatusPolicy:'OSHB main text only; exclude note/rdg apparatus before token indexing',
    totals:{chapters:66,readerVerses:1292,tokens:16932,bytes:chapters.reduce((n,c)=>n+c.byteSize,0),hebrew:16932,aramaic:0,
      excludedApparatusBlocks:53,excludedAlternateWords:56,numericStrongsJoinFailures:0,wordsWithoutNumericStrongs:310,
      missingSelectedLexicalFields:0,missingReaderTargets:0,collidingReaderTargets:0},chapters};
  return {...result,bytes,manifest};
}
function verifyDirectory(directory,expected) {
  requireCheck(JSON.stringify(fs.readdirSync(directory).sort())===JSON.stringify([...chapterNames].sort()),'Expected exactly 66 chapter files');
  for(const name of chapterNames) requireCheck(fs.readFileSync(path.join(directory,name)).equals(expected.bytes.get(name)),'Chapter bytes mismatch: '+name);
}
function stageIsaiah(stageRoot,sourceRoot=process.env.GOD4_ORIGINAL_LANGUAGE_SOURCES || defaultSourceRoot) {
  stageRoot=path.resolve(stageRoot);
  const dataRoot=path.join(repository,'data');
  requireCheck(stageRoot!==dataRoot && !stageRoot.startsWith(dataRoot+path.sep),'Staging must be outside production data');
  requireCheck(!fs.existsSync(stageRoot),'Staging directory must be fresh');
  const inputs=readInputs(sourceRoot),first=generateCandidate(inputs);
  fs.mkdirSync(stageRoot,{recursive:true});
  writeStaticData(first.records,path.join(stageRoot,'run-1'),[inputs.config]);
  const second=generateCandidate(inputs); // Independent parse/generation, not reuse of records.
  writeStaticData(second.records,path.join(stageRoot,'run-2'),[inputs.config]);
  requireCheck(JSON.stringify(first.manifest)===JSON.stringify(second.manifest),'Nondeterministic generation manifest');
  for(const run of ['run-1','run-2']) verifyDirectory(path.join(stageRoot,run,'isaiah'),first);
  fs.writeFileSync(path.join(stageRoot,'manifest.json'),JSON.stringify(first.manifest,null,2)+'\n');
  return first.manifest;
}
function verifyCandidate(stageRoot,sourceRoot=process.env.GOD4_ORIGINAL_LANGUAGE_SOURCES || defaultSourceRoot) {
  const expected=generateCandidate(readInputs(sourceRoot));
  requireCheck(JSON.stringify(JSON.parse(fs.readFileSync(path.join(stageRoot,'manifest.json'),'utf8')))===JSON.stringify(expected.manifest),'Candidate manifest mismatch');
  for(const run of ['run-1','run-2']) verifyDirectory(path.join(stageRoot,run,'isaiah'),expected);
  return expected;
}
function publishIsaiah(stageRoot,sourceRoot=process.env.GOD4_ORIGINAL_LANGUAGE_SOURCES || defaultSourceRoot,outputBase=productionBase) {
  const expected=verifyCandidate(stageRoot,sourceRoot),destination=path.resolve(outputBase,'isaiah');
  requireCheck(!fs.existsSync(destination),'Refusing to overwrite existing Isaiah publication');
  fs.mkdirSync(destination,{recursive:true});
  try {
    for(const name of chapterNames) fs.copyFileSync(path.join(stageRoot,'run-1/isaiah',name),path.join(destination,name));
    verifyDirectory(destination,expected);
  } catch(error) {
    // Only the freshly created, explicitly resolved Isaiah directory is removed.
    requireCheck(destination===path.join(path.resolve(outputBase),'isaiah'),'Unsafe rollback directory');
    fs.rmSync(destination,{recursive:true,force:true}); throw error;
  }
  return expected.manifest;
}
if(require.main===module) {
  const [action,stageRoot,sourceRoot,...extra]=process.argv.slice(2);
  requireCheck(stageRoot && !extra.length && ['stage','check','publish'].includes(action),'Usage: node tools/publish-isaiah-original-language.js stage|check|publish <stage-root> [local-source-root]');
  const result=action==='stage'?stageIsaiah(stageRoot,sourceRoot):action==='publish'?publishIsaiah(stageRoot,sourceRoot):verifyCandidate(stageRoot,sourceRoot).manifest;
  console.log(JSON.stringify(result,null,2));
}
module.exports={stageIsaiah,verifyCandidate,publishIsaiah};
