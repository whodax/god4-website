'use strict';

const assert=require('node:assert/strict');
const {test}=require('node:test');
const {validatePhrases}=require('../tools/web-phrase-consensus');
const {READER_TOKEN_PATTERN}=require('../tools/audit-word-study-coverage');

function evidence(text,groups) {
  const words=[...text.matchAll(READER_TOKEN_PATTERN)];
  return {text,groups:groups.map(([english,original])=>[
    english.map(index=>[words[index].index,words[index].index+words[index][0].length]),original
  ])};
}

const left='They saw fresh bread near home yesterday.';
const right='Some saw fresh bread near home before.';
const web='We saw fresh bread near home earlier.';
const anchorGroups=[[[1],[1]],[[4],[4]]];
const pair=group=>[evidence(left,[...anchorGroups,...group]),evidence(right,[...anchorGroups,...group])];

test('projects only complete position links into the exact selected WEB spans',()=>{
  for (const groups of [
    [[[2],[2]],[[3],[3]]],
    [[[2],[2,3]],[[3],[5]]],
    [[[2,3],[2]]],
    [[[2,3],[2,3]]]
  ]) {
    const result=validatePhrases(web,...pair(groups));
    const expected=groups.map(([indices,positions])=>[indices.map(i=>[i===2?7:13,i===2?12:18]),positions]);
    assert.deepEqual(result.groups,expected);
  }
});

test('identical wording does not rescue damaged context, a supplied word, or changed scope',()=>{
  const sources=pair([[[2,3],[2]]]);
  for (const invalid of [
    'We see fresh bread near home earlier.',
    'We saw [fresh bread] near home earlier.',
    'We saw fresh bread; near home earlier.',
    'We saw fresh-bread near home earlier.',
    'We saw fresh bread near home, but not today.',
    'We saw fresh bread near home, but cannot return.',
    'We saw fresh bread near home, unless it rains.'
  ]) assert.equal(validatePhrases(invalid,...sources).groups,undefined,invalid);
});

test('unresolved repeated phrases and reordered context fail closed',()=>{
  const sources=pair([[[2,3],[2]]]);
  assert.deepEqual(validatePhrases(web+' There was fresh bread.',...sources),{code:'repeated group',ambiguous:true});
  const reordered='We saw fresh bread near home outside.';
  const rows=[[[0],[0]],[[2],[1]],[[3,4],[2]],[[5],[4]]];
  const a=evidence('Outside they saw fresh bread near home yesterday.',rows);
  const b=evidence('Outside some saw fresh bread near home before.',rows);
  assert.deepEqual(validatePhrases(reordered,a,b),{code:'reordered contextual anchors',ambiguous:true});
});

test('group identity requires every exact position edge and connected span to agree',()=>{
  const a=evidence(left,[...anchorGroups,[[2],[2,3]],[[3],[3]]]);
  const otherEdge=evidence(right,[...anchorGroups,[[2],[2]],[[3],[2,3]]]);
  const otherPosition=evidence(right,[...anchorGroups,[[2],[5,6]],[[3],[6]]]);
  const partial=evidence(right,[...anchorGroups,[[2],[2,3]]]);
  for (const b of [otherEdge,otherPosition,partial]) assert.equal(validatePhrases(web,a,b).groups,undefined);
  const disconnected=pair([[[2,5],[2]]]);
  assert.equal(validatePhrases(web,...disconnected).groups,undefined);
});
