'use strict';

const fs=require('node:fs');
const path=require('node:path');
const {createHash}=require('node:crypto');
const {loadBibleLibrary}=require('./audit-word-study-coverage');
const {provider}=require('./import-web-alignment');
const {prepareBook}=require('./audit-web-book-coverage');
const {assessBook}=require('./adjudicate-web-book');
const canon=require('../js/bible/canon');
const baseline='99d5deb81ce7ddac555f61a5d0a8f87923e3988f';
const sha=data=>createHash('sha256').update(data).digest('hex');
const root=path.resolve(__dirname,'..');
const encoding=data=>Buffer.from(JSON.stringify(data)+'\n');

async function run(webPackets,output,books){
  if(!books.length||new Set(books).size!==books.length||books.some(book=>canon.book(book)?.testament!=='old'))
    throw Error('Select distinct KJV Old Testament books');
  const target=path.resolve(output),runtime=path.join(root,'data');
  if(target===runtime||target.startsWith(runtime+path.sep)||fs.existsSync(target))
    throw Error('Review output must be a fresh non-runtime directory');
  fs.mkdirSync(target);
  const library=loadBibleLibrary('kjv.js','kjvLibrary'),original=provider(),report={baseline,kjv:{},web:{}};
  for(const book of books){
    const {hints,...packet}=await prepareBook(book,library,original,new Map(),{translationId:'kjv',revision:baseline});
    const payload=encoding(packet);
    const reviewPacketSha256=sha(payload);
    const decisions=assessBook(payload,{bookId:book,reviewPacketSha256,passages:{}},[]);
    fs.writeFileSync(path.join(target,'kjv-'+book+'-blind.json'),payload);
    report.kjv[book]={counts:packet.counts,positions:packet.rows.length,
      reviewPacketSha256,decisions:decisions.counts};
  }
  const evidence=require('../docs/shell-82-web-book-audit.json');
  for(const book of ['ruth','jonah','philemon','genesis']){
    const bytes=fs.readFileSync(path.join(webPackets,book+'-review.json'));
    const reviewPacketSha256=sha(bytes);
    if(reviewPacketSha256!==evidence.selected[book].reviewSha256) throw Error('Frozen WEB packet mismatch '+book);
    const reviewed=assessBook(bytes,{bookId:book,reviewPacketSha256,passages:{}},[]);
    report.web[book]={reviewPacketSha256,counts:reviewed.counts};
  }
  fs.writeFileSync(path.join(target,'report.json'),encoding(report));
  return report;
}

if(require.main===module){
  const [webPackets,output,...books]=process.argv.slice(2);
  if(!output) throw Error('Expected existing WEB review packets, a fresh output folder and KJV book IDs');
  run(webPackets,output,books).catch(error=>{console.error(error);process.exitCode=1;});
}
module.exports={run};
