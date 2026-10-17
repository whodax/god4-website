'use strict';

// Read-only local validation. This module deliberately has no shard writer.
const fs = require('node:fs');
const path = require('node:path');
const crypto = require('node:crypto');
const {isaiahBookConfig,readerBook,sourceTargets,mapReference} = require('./original-language-config');
const {generateConfiguredSourceDetailed,parseStrongDat,SCHEMA_FIELDS} = require('./import-original-language');
const defaultSourceRoot = 'C:/Users/whoda/OneDrive/Documents/GOD4-OriginalLanguage-Sources';
const sha256 = bytes => crypto.createHash('sha256').update(bytes).digest('hex');
function requireEvidence(condition,message){if(!condition) throw new TypeError(message);}

function validateIsaiahText(text,lexicalText){
  const config = isaiahBookConfig();
  requireEvidence(!config.publication.enabled,'Isaiah must remain publication-disabled');
  requireEvidence(sha256(text) === config.source.sha256,'Isaiah source SHA-256 mismatch');
  requireEvidence(sha256(lexicalText) === config.source.lexicalSource.sha256,'Hebrew DAT SHA-256 mismatch');
  const seen = new Set(), annotations = [];
  for(const match of text.matchAll(/<verse\s+osisID="([A-Za-z0-9-]+)\.(\d+)\.(\d+)"[^>]*>([\s\S]*?)<\/verse>/g)){
    requireEvidence(match[1] === 'Isa','Unexpected source book');
    const chapter=Number(match[2]),verse=Number(match[3]),key=chapter+':'+verse;
    requireEvidence(!seen.has(key),'Duplicate source verse: '+key);
    seen.add(key);
    sourceTargets(config,chapter,verse);
    for(const note of match[4].matchAll(/<note>KJV:Isa\.(\d+)\.(\d+)<\/note>/g)){
      const before=match[4].slice(0,note.index).replace(/<note\b[^>]*>[\s\S]*?<\/note>/g,'');
      const tokenIndex=[...before.matchAll(/<w\s/g)].length;
      const target=mapReference(config,chapter,verse,tokenIndex);
      requireEvidence(target.chapter === Number(note[1]) && target.verse === Number(note[2]),'Mapping disagrees with inline KJV annotation: '+key);
      annotations.push({source:key,tokenIndex,target:target.chapter+':'+target.verse});
    }
  }
  const expected=config.sourceVerseCounts.reduce((a,b)=>a+b,0);
  requireEvidence(seen.size === expected,'Incomplete source verse coverage');
  config.sourceVerseCounts.forEach((n,i)=>{for(let v=1;v<=n;v++) requireEvidence(seen.has((i+1)+':'+v),'Missing source coordinate');});
  requireEvidence(annotations.length === 33,'Unexpected inline KJV annotation count');
  const {records,diagnostics}=generateConfiguredSourceDetailed(text,lexicalText,config);
  const reader=readerBook('isaiah'),targets=new Set(records.map(r=>r.chapter+':'+r.verse));
  for(let ch=1;ch<=reader.chapters;ch++) for(let v=1;v<=reader[ch].verses.length;v++) requireEvidence(targets.has(ch+':'+v),'Missing Reader verse');
  const lexicon=parseStrongDat(lexicalText,'hebrew'),missingNumericIds=[];
  let hebrew=0,aramaic=0;
  for(const row of records){
    requireEvidence(Object.keys(row).join(',') === SCHEMA_FIELDS.join(','),'Unexpected record contract');
    requireEvidence(row.source === config.source.attribution,'Unexpected source attribution');
    requireEvidence(['surface','lemma','morphology'].every(k=>typeof row[k] === 'string' && row[k].trim()),'Empty source field');
    if(row.strongsNumber) requireEvidence(lexicon.has(row.strongsNumber) && Boolean(row.definition),'Missing numeric Strong\'s lexical join');
    else missingNumericIds.push({chapter:row.chapter,verse:row.verse,tokenIndex:row.tokenIndex,lemma:row.lemma});
    requireEvidence(row.language === (row.morphology[0] === 'A' ? 'aramaic':'hebrew'),'Morphology language mismatch');
    if(row.language === 'aramaic') aramaic++;else hebrew++;
  }
  requireEvidence(diagnostics.excludedVariantNotes === 53 && diagnostics.excludedVariantWords === 56,'Unexpected apparatus counts');
  requireEvidence(diagnostics.excludedApparatus.every(n=>n.kind === 'note' && /<note type="variant">/.test(n.xml) && /<rdg type="x-qere">/.test(n.xml)),'Unreviewed apparatus structure');
  return {
    summary:{publicationEligible:false,sourceChapters:config.chapterCount,sourceVerses:seen.size,
      readerChapters:new Set(records.map(r=>r.chapter)).size,readerVerses:targets.size,tokens:records.length,
      hebrew,aramaic,excludedVariantNotes:diagnostics.excludedVariantNotes,excludedVariantWords:diagnostics.excludedVariantWords,
      numericStrongsJoinFailures:0,wordsWithoutNumericStrongs:missingNumericIds.length,
      sourceSha256:sha256(text),lexicalSha256:sha256(lexicalText),inlineKjvAnnotations:annotations.length,
      splitSourceVerse:'63:19',splitReaderVerses:{'63:19':records.filter(r=>r.chapter===63&&r.verse===19).length,'64:1':records.filter(r=>r.chapter===64&&r.verse===1).length},
      blocker:'Corrected-edition Hebrew DAT license remains unresolved; no Isaiah shards may be written.'},
    diagnostics:{...diagnostics,inlineKjvAnnotations:annotations,wordsWithoutNumericStrongs:missingNumericIds}
  };
}

function validateLocalIsaiah(sourceRoot=process.env.GOD4_ORIGINAL_LANGUAGE_SOURCES || defaultSourceRoot){
  const text=fs.readFileSync(path.join(sourceRoot,'morphhb/wlc/Isa.xml'),'utf8');
  const lexical=fs.readFileSync(path.join(sourceRoot,'strongs/hebrew/strongshebrew.dat'),'utf8');
  return validateIsaiahText(text,lexical);
}
if(require.main === module){
  if(process.argv.length > 3 || process.argv[2]?.startsWith('--')) throw new TypeError('Usage: node tools/validate-isaiah-original-language.js [local-source-root] (read-only)');
  console.log(JSON.stringify(validateLocalIsaiah(process.argv[2]),null,2));
}
module.exports={validateIsaiahText,validateLocalIsaiah,defaultSourceRoot};
