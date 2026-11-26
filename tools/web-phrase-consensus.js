'use strict';

const {READER_TOKEN_PATTERN} = require('./audit-word-study-coverage');
const normalize = text => text.trim().replace(/\s+/g,' ').replace(/[\u201c\u201d]/g,'"').replace(/[\u2018\u2019]/g,"'");
const words = text => [...text.matchAll(READER_TOKEN_PATTERN)].map(match=>({
  start:match.index,end:match.index+match[0].length,term:normalize(match[0]).toLowerCase()
}));
const reason = (code,ambiguous=false)=>({code,ambiguous});

function indexed(text, groups) {
  const tokens = words(text);
  const offsets = new Map(tokens.map((token,index)=>[token.start,index]));
  const edges = tokens.map(()=>new Set());
  const reverse = new Map();
  for (const [spans,native] of groups) {
    for (const [start,end] of spans) {
      const index = offsets.get(start);
      if (tokens[index]?.end!==end) throw new Error('Invalid verified source span');
      for (const position of native) {
        edges[index].add(position);
        if (!reverse.has(position)) reverse.set(position,new Set());
        reverse.get(position).add(index);
      }
    }
  }
  return {text,tokens,edges,reverse};
}

function components({edges,reverse}) {
  const result = [], seen = new Set();
  for (const [seed,positions] of edges.entries()) {
    if (!positions.size || seen.has(seed)) continue;
    const component = [seed], native = new Set();
    seen.add(seed);
    for (const index of component) {
      for (const position of edges[index]) {
        native.add(position);
        for (const linked of reverse.get(position)) {
          if (seen.has(linked)) continue;
          seen.add(linked);
          component.push(linked);
        }
      }
    }
    result.push({english:component.sort((a,b)=>a-b),native:[...native].sort((a,b)=>a-b)});
  }
  return result;
}

function occurrences(needle,haystack) {
  return haystack.flatMap((token,index)=>token.term===needle[0].term &&
    needle.every((part,offset)=>part.term===haystack[index+offset]?.term)?[index]:[]);
}

function edgeText(source,start,end) {
  const {text,tokens}=source;
  return normalize(text.slice(start>0?tokens[start-1].start:0,
    end+1<tokens.length?tokens[end+1].end:text.length));
}

function edgesAgree(a,i,b,j) {
  return a.edges[i].size===b.edges[j].size && [...a.edges[i]].every(position=>b.edges[j].has(position));
}

function uniqueWords(tokens) {
  const positions=new Map();
  for (const [index,word] of tokens.entries()) positions.set(word.term,positions.has(word.term)?-1:index);
  return positions;
}

function sharedAnchors(a,b,target) {
  const right=uniqueWords(b.tokens), web=uniqueWords(target.tokens);
  return [...uniqueWords(a.tokens)].flatMap(([term,i])=>{
    const j=right.get(term),k=web.get(term);
    return i>=0 && j>=0 && k>=0 && a.edges[i].size && edgesAgree(a,i,b,j)?[[i,j,k]]:[];
  });
}

function lexicalCandidates(leftText,rightText,targetText) {
  const a=words(leftText),b=words(rightText),t=words(targetText);
  const bTerms=new Set(b.map(word=>word.term));
  const tTerms=new Set(t.map(word=>word.term));
  return a.some(word=>bTerms.has(word.term)&&tTerms.has(word.term));
}

function validatePhrases(english, first, second) {
  const target = {text:english,tokens:words(english)};
  const left = indexed(first.text,first.groups), right = indexed(second.text,second.groups);
  // A local expression cannot prove that polarity, condition or exception scope survived a changed verse.
  if ([english,first.text,second.text].some(text=>/\b(?:not|no|none|never|neither|nor|without|unless|except|if|lest|only|cannot|nothing|nobody|nowhere)\b|n['\u2019]t\b/i.test(text))) {
    return reason('scope-sensitive wording');
  }
  const rightComponents = new Map(components(right).map(group=>[group.native.join(','),group]));
  const anchors=sharedAnchors(left,right,target);
  const accepted=[];
  let repeated=false,reordered=false;
  for (const group of components(left)) {
    const other=rightComponents.get(group.native.join(','));
    if (!other || group.english.length!==other.english.length ||
      !group.english.every((position,index)=>position===group.english[0]+index) ||
      !other.english.every((position,index)=>position===other.english[0]+index) ||
      !group.native.every((position,index)=>position===group.native[0]+index)) continue;
    const start=group.english[0], end=group.english.at(-1);
    const otherStart=other.english[0], otherEnd=other.english.at(-1);
    const needle=left.tokens.slice(start,end+1);
    if (!needle.every((token,index)=>token.term===right.tokens[otherStart+index].term &&
      edgesAgree(left,start+index,right,otherStart+index))) continue;
    const targets=occurrences(needle,target.tokens);
    if (!targets.length) continue;
    if (targets.length!==1 || occurrences(needle,left.tokens).length!==1 || occurrences(needle,right.tokens).length!==1) {
      repeated=true;
      continue;
    }
    const from=targets[0], to=from+needle.length-1;
    if ((start===0)!==(otherStart===0) || (start===0)!==(from===0) ||
      (end===left.tokens.length-1)!==(otherEnd===right.tokens.length-1) ||
      (end===left.tokens.length-1)!==(to===target.tokens.length-1)) continue;
    // Match the full punctuation-bearing local frame. Reject scope or quotation breaks
    // inside that frame rather than letting word-only matching cross them.
    const frame=edgeText(target,from,to);
    if (frame!==edgeText(left,start,end) || frame!==edgeText(right,otherStart,otherEnd) ||
      /[;:!?"()[\]{}]/.test(frame) || /[.](?=\s)/.test(frame)) continue;
    // Shared verified adjacent words establish context on both sides where present.
    if ((start>0 && (!left.edges[start-1].size || !edgesAgree(left,start-1,right,otherStart-1))) ||
      (end+1<left.tokens.length && (!left.edges[end+1].size || !edgesAgree(left,end+1,right,otherEnd+1)))) continue;
    if (anchors.some(([i,j,k])=>(i<start)!==(j<otherStart) || (i<start)!==(k<from))) {
      reordered=true;
      continue;
    }
    accepted.push({group,other,from,to});
  }
  if (accepted.some((row,index)=>index &&
    (row.from<=accepted[index-1].to || row.other.english[0]<=accepted[index-1].other.english.at(-1)))) {
    return reason('reordered matching groups',true);
  }
  if (!accepted.length) {
    if (reordered) return reason('reordered contextual anchors',true);
    return repeated?reason('repeated group',true):reason('no complete anchored two-source group');
  }
  const groups = [];
  for (const {group,from} of accepted) {
    const spansByPositions=new Map();
    for (const [i,sourceIndex] of group.english.entries()) {
      const positions=[...left.edges[sourceIndex]].sort((a,b)=>a-b);
      const key=positions.join(',');
      if (!spansByPositions.has(key)) spansByPositions.set(key,[[],positions]);
      const {start,end}=target.tokens[from+i];
      spansByPositions.get(key)[0].push([start,end]);
    }
    groups.push(...spansByPositions.values());
  }
  return {groups,components:accepted.length};
}

module.exports={lexicalCandidates,validatePhrases};
