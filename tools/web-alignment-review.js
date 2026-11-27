'use strict';

const {READER_TOKEN_PATTERN}=require('./audit-word-study-coverage');

function canonicalGroups(record, groups) {
  if (!Array.isArray(groups)) throw new Error('Missing alignment groups');
  const words=new Set([...record.text.matchAll(READER_TOKEN_PATTERN)].map(word=>word.index+':'+(word.index+word[0].length)));
  const positions=new Set(record.tokens.filter(token=>token.surface && token.language && token.morphology).map(token=>token.index));
  const spansSeen=new Set();
  return groups.map(group=>{
    if (!group.spans?.length || !group.positions?.length || new Set(group.positions).size!==group.positions.length ||
      !group.positions.every(position=>positions.has(position))) throw new Error('Invalid original token positions');
    const spans=group.spans.map(span=>{
      const key=span.start+':'+span.end;
      if (!words.has(key) || span.text!==record.text.slice(span.start,span.end) || spansSeen.has(key)) {
        throw new Error('Invalid or duplicate exact English span');
      }
      spansSeen.add(key);
      return [span.start,span.end];
    }).sort((a,b)=>a[0]-b[0]);
    return [spans,group.positions.slice().sort((a,b)=>a-b)];
  }).sort((a,b)=>a[0][0][0]-b[0][0][0]);
}

function evidence(review, roster) {
  return review?.mode==='independent-human' && roster.has(review.reviewerId) &&
    typeof review.date==='string' && /^\d{4}-\d{2}-\d{2}$/.test(review.date) &&
    Array.isArray(review.evidence) && review.evidence.length &&
    review.evidence.every(item=>item.source && item.revision && item.locator) &&
    typeof review.rationale==='string' && review.rationale.trim();
}

function adjudicate(record, submissions, roster, resolution) {
  if (!Array.isArray(submissions) || submissions.length<2 ||
    submissions.some(item=>!evidence(item,roster)) ||
    new Set(submissions.map(item=>item.reviewerId)).size!==submissions.length) return {status:'pending'};
  const judgments=submissions.map(item=>canonicalGroups(record,item.groups));
  if (judgments.every(groups=>JSON.stringify(groups)===JSON.stringify(judgments[0]))) {
    return {status:'agreed',groups:judgments[0],reviewers:submissions.map(item=>item.reviewerId)};
  }
  if (!evidence(resolution,roster) || submissions.some(item=>item.reviewerId===resolution.reviewerId)) return {status:'disagreement'};
  return {status:'resolved',groups:canonicalGroups(record,resolution.groups),
    reviewers:submissions.map(item=>item.reviewerId),adjudicator:resolution.reviewerId};
}

function compare(expected, predicted) {
  const unmatched=new Set(expected);
  const outcome={exact:0,partial:0,disagreement:0,missing:0};
  const unmatchedPredictions=[];
  for (const proposed of predicted) {
    const same=[...unmatched].find(group=>JSON.stringify(group)===JSON.stringify(proposed));
    if (same) {outcome.exact++;unmatched.delete(same);}
    else unmatchedPredictions.push(proposed);
  }
  for (const proposed of unmatchedPredictions) {
    const touching=[...unmatched].filter(group=>group[0].some(([from,to])=>
      proposed[0].some(([start,end])=>from<end&&start<to)));
    if (touching.length===1 && touching[0][1].some(position=>proposed[1].includes(position))) {
      outcome.partial++;unmatched.delete(touching[0]);
    } else {
      outcome.disagreement++;
    }
  }
  outcome.missing=unmatched.size;
  return outcome;
}

module.exports={adjudicate,canonicalGroups,compare};
