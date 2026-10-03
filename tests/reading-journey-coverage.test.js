const assert = require('node:assert/strict');
const fs = require('node:fs');
const vm = require('node:vm');

const source = fs.readFileSync(require.resolve('../js/bible/reading-journey.js'), 'utf8');
const context = {globalThis: {}};
vm.runInNewContext(source, context);
const plans = context.globalThis.ReadingJourneyPlans;
const manifestContext = {};
vm.runInNewContext(fs.readFileSync(require.resolve('../js/bible/translation-manifest.js'), 'utf8'), manifestContext);
const expectedBooks = [
  ['matthew',28],['mark',16],['luke',24],['john',21],['acts',28],['romans',16],
  ['1-corinthians',16],['2-corinthians',13],['galatians',6],['ephesians',6],['philippians',4],
  ['colossians',4],['1-thessalonians',5],['2-thessalonians',3],['1-timothy',6],['2-timothy',4],
  ['titus',3],['philemon',1],['hebrews',13],['james',5],['1-peter',5],['2-peter',3],
  ['1-john',5],['2-john',1],['3-john',1],['jude',1],['revelation',22]
];
const all = plans.flatMap((plan) => plan.days.flatMap((day) => day.chapters));
const ntManifest = manifestContext.BibleTranslationManifest.web.structure.books.slice(
  manifestContext.BibleTranslationManifest.web.structure.books.findIndex(([bookId]) => bookId === 'matthew'));
assert.deepEqual(expectedBooks.map(([bookId,chapters])=>[bookId,chapters]),Array.from(ntManifest,([bookId,chapters])=>[bookId,chapters]),'book IDs and chapter counts match canonical Bible data');
const expected = expectedBooks.flatMap(([bookId, chapters]) =>
  Array.from({length: chapters}, (_, index) => `${bookId}:${index + 1}`));
assert.equal(plans.length, 5, 'journey has five plans');
assert.deepEqual(Array.from(plans, (plan) => plan.days.length), [30,30,30,30,30], 'each plan has 30 days');
assert.deepEqual(Array.from(plans, (plan) => plan.days.flatMap((day) => day.chapters).length), [60,50,50,50,50]);
assert.ok(plans[0].days.every((day)=>day.chapters.length===2),'Plan 1 preserves its 2-chapter reading pattern');
assert.ok(plans.slice(1).every((plan)=>plan.days.filter((day)=>day.chapters.length===1).length===10 && plan.days.filter((day)=>day.chapters.length===2).length===20),'Plans 2-5 each have twenty 2-chapter days and ten 1-chapter days');
assert.equal(all.length, 260, 'journey covers exactly 260 chapters');
assert.equal(new Set(all.map(({bookId,chapter}) => `${bookId}:${chapter}`)).size, 260, 'no chapter duplicates');
assert.deepEqual(Array.from(all, ({bookId,chapter}) => `${bookId}:${chapter}`), expected, 'canonical order with no gaps');
console.log('Reading journey coverage passed: 260 contiguous chapters across five 30-day plans.');
