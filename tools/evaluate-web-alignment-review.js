'use strict';

const fs=require('node:fs');
const {createHash}=require('node:crypto');
const {adjudicate,canonicalGroups,compare}=require('./web-alignment-review');

function fingerprint(dataset) {
  return createHash('sha256').update(JSON.stringify(dataset)).digest('hex');
}

function evaluate(dataset, submissions, predictions, roster) {
  if(dataset.version!==1 || !Array.isArray(dataset.holdout)) throw new Error('Unsupported review dataset');
  if(submissions.datasetRevision!==dataset.baseline || predictions.datasetRevision!==dataset.baseline ||
    submissions.datasetVersion!==dataset.version || predictions.datasetVersion!==dataset.version) {
    throw new Error('Review inputs target a different edition or dataset version');
  }
  const checksum=fingerprint(dataset);
  if(submissions.datasetChecksum!==checksum || predictions.datasetChecksum!==checksum) {
    throw new Error('Review inputs target a different frozen dataset');
  }
  if(!Array.isArray(roster) || roster.some(id=>typeof id!=='string'||!id.trim()) ||
    new Set(roster).size!==roster.length) throw new Error('Invalid approved reviewer roster');
  const ids=new Set(dataset.holdout.map(record=>record.id));
  if(ids.size!==dataset.holdout.length || [submissions.passages,predictions.passages].some(items=>
    !items || Object.keys(items).some(id=>!ids.has(id)))) throw new Error('Foreign or repeated evaluation case');
  const results={cases:ids.size,evaluated:0,pending:0,unresolvedDisagreement:0,exact:0,partial:0,disagreement:0,missing:0,details:[]};
  const approved=new Set(roster);
  for(const record of dataset.holdout){
    const item=submissions.passages[record.id];
    const outcome=adjudicate(record,item?.reviews,approved,item?.resolution);
    if(outcome.status==='pending') {results.pending++;continue;}
    if(outcome.status==='disagreement') {results.unresolvedDisagreement++;continue;}
    const predicted=canonicalGroups(record,predictions.passages[record.id]??[]);
    const counts=compare(outcome.groups,predicted);
    results.evaluated++;
    for(const [key,value] of Object.entries(counts)) results[key]+=value;
    results.details.push({id:record.id,stratum:record.stratum,status:outcome.status,...counts});
  }
  return results;
}

if(require.main===module){
  const [dataset,submissions,predictions,roster]=process.argv.slice(2);
  if(!roster) throw new Error('Expected review dataset, submissions, frozen predictions and approved roster paths');
  const read=file=>JSON.parse(fs.readFileSync(file,'utf8'));
  console.log(JSON.stringify(evaluate(...[dataset,submissions,predictions,roster].map(read)),null,2));
}

module.exports={evaluate,fingerprint};
