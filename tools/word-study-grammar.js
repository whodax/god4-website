'use strict';

const pending=[
  {edition:'kjv',book:'philemon',chapter:1,verse:9,term:'yet',
    phrase:/^Yet for love.s sake\b/d,category:'implicit-english',
    rationale:'The adversative connective signals the contrast with the preceding verse. There is no separate Greek adversative word in the aligned opening clause.',
    needed:'Independent agreement on the discourse span and a review decision about eligibility.'},
  {edition:'kjv',book:'titus',chapter:1,verse:1,term:'is',
    phrase:/\bwhich (is) after godliness\b/d,category:'implicit-english',
    rationale:'English supplies a copula to express the relation in the Greek article and prepositional phrase. The Greek clause has no separate copula.',
    needed:'Independent morphological and translation review before any eligibility change.'}
];
function studyClass(context,token,alignment){
  if([...context.verseText.matchAll(/\[[^\]]*\]/g)].some(mark=>
    mark.index<=token.start&&token.end<=mark.index+mark[0].length)) return {category:'marked-supplied'};
  const groups=(alignment?.groups||[]).filter(group=>group.english.some(span=>span.start<=token.start&&span.end>=token.end));
  if(groups.length) return {category:groups.every(group=>group.grammatical)?'verified-grammatical':'explicit-alignment'};
  const review=pending.find(row=>{
    if(row.edition!==context.translationId||row.book!==context.bookId||row.chapter!==context.chapter||
      row.verse!==context.verse||row.term!==token.term) return false;
    const match=row.phrase.exec(context.verseText);
    return match&&token.start===(match.indices[1]?.[0]??match.index);
  });
  if(review) return {category:'unresolved',proposed:review.category,rationale:review.rationale,needed:review.needed};
  return {category:'unresolved'};
}
module.exports={studyClass};
