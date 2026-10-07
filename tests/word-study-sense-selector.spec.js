const {test, expect} = require('@playwright/test');
const fs = require('fs');
const path = require('path');
const vm = require('vm');
const {loadBibleLibrary} = require('../tools/audit-word-study-coverage');
const root = path.resolve(__dirname, '..');
let bible;
test.beforeAll(() => { bible = loadBibleLibrary('web.js', 'webLibrary'); });
function runtime(withSelector = true, blocked = false){
  const requests = [];
  const realm = vm.createContext({fetch:async url => {
    requests.push(url);
    const file = path.join(root, url.replace(/^\//, ''));
    return {ok:!blocked && fs.existsSync(file), json:async () => JSON.parse(fs.readFileSync(file, 'utf8'))};
  }});
  for(const file of ['provider.js', 'local-provider.js'].concat(withSelector ? ['sense-selector.js'] : []).concat(['dictionary-provider.js'])){
    vm.runInContext(fs.readFileSync(path.join(root, 'js/word-study', file), 'utf8'), realm);
  }
  return {realm, requests};
}
function entry(term, shard){ return JSON.parse(fs.readFileSync(path.join(root, 'data/word-study', shard + '.json'), 'utf8')).entries[term]; }
function verseContext(displayWord, book, chapter){
  return {displayWord, lookupTerm:displayWord.toLowerCase(), bookId:book, chapter, verse:1,
    verseText:bible[book][chapter].verses[0]};
}
function pure(definitions, context){
  const {realm, requests} = runtime();
  const result = realm.WordStudySenseSelector.select(definitions, context);
  expect(requests).toEqual([]);
  return result;
}

for(const [word, shard, book, chapter, index, ambiguous] of [
  ['king','ki','genesis',14,1,false], ['God','go','genesis',1,2,false],
  ['word','wo','john',1,0,true], ['beginning','beg','genesis',1,0,true]
]){
  test(`Word Study sense selector uses real ${word} candidates conservatively`, () => {
    const candidates = entry(word.toLowerCase(), shard).definitions;
    const snapshot = JSON.stringify(candidates);
    candidates.forEach(Object.freeze); Object.freeze(candidates);
    const context = verseContext(word, book, chapter);
    const result = pure(candidates, context);
    expect(result.selectedIndex).toBe(index);
    expect(result.ambiguous).toBe(ambiguous);
    expect(result.confidence).toBe(ambiguous ? 0 : word === 'God' ? 0.5 : 1);
    expect(JSON.stringify(candidates)).toBe(snapshot);
    expect(pure(candidates, context)).toEqual(result);
  });
  test(`Word Study provider integrates real ${word} selection without changing candidates or related words`, async () => {
    const deployed = entry(word.toLowerCase(), shard);
    const context = verseContext(word, book, chapter);
    const current = runtime(), previous = runtime(false);
    const result = await current.realm.WordStudyProvider.lookup(context);
    const baseline = await previous.realm.WordStudyProvider.lookup(context);
    expect(result.definition).toBe(deployed.definitions[index].text);
    expect(result.partOfSpeech).toBe(deployed.definitions[index].partOfSpeech);
    expect(result.definitions).toEqual(deployed.definitions);
    expect(result.definitions).toEqual(baseline.definitions);
    expect(result.relatedWords).toEqual(baseline.relatedWords);
    expect(result.source).toBe(baseline.source);
    expect(current.requests).toEqual(previous.requests);
    expect(result.senseSelection.selectedIndex).toBe(index);
    expect(result.senseSelection.ambiguous).toBe(ambiguous);
  });
}

test('Word Study corroborated same spelling ranking supports blank POS', () => {
  const definitions = [{text:'A building where money and coins are stored. [Obs.]',partOfSpeech:''},
    {text:'A strip of soil bordering flowing water.',partOfSpeech:''}];
  expect(pure(definitions,{lookupTerm:'bank',displayWord:'bank',verseText:'The bank received money and coins.'}).selectedIndex).toBe(0);
  const other = pure(definitions,{lookupTerm:'bank',displayWord:'bank',verseText:'The bank borders flowing water.'});
  expect(other.selectedIndex).toBe(1); expect(other.ambiguous).toBe(false);
});

test('Word Study named-role evidence generalizes to other headwords without English POS tagging', () => {
  const definitions = [{text:'A wooden instrument used to measure soil.',partOfSpeech:'noun'},
    {text:'An officer responsible for a district.',partOfSpeech:'noun'}];
  expect(pure(definitions,{lookupTerm:'warden',displayWord:'warden',verseText:'Marcus warden of Harbor met his friends.'}))
    .toMatchObject({selectedIndex:1,ambiguous:false});
  expect(pure(definitions,{lookupTerm:'warden',displayWord:'warden',verseText:'The warden was there.'}))
    .toMatchObject({selectedIndex:0,ambiguous:true});
});

test('Word Study artifact markers cannot beat substantive definitions', () => {
  expect(pure([{text:'pl.',partOfSpeech:'noun'},{text:'A body of flowing water.',partOfSpeech:'noun'}],{}))
    .toMatchObject({selectedIndex:1,ambiguous:false});
  expect(pure([{text:'pl.'},{text:'One useful meaning.'},{text:'Another useful meaning.'}],{}))
    .toMatchObject({selectedIndex:1,ambiguous:true,confidence:0});
});

test('Word Study obsolete penalty is soft and a contextual archaic sense remains eligible', () => {
  const result = pure([{text:'A container for dry grain.',partOfSpeech:'noun'},
    {text:'An officer entrusted with ships and harbor water. [Obs.]',partOfSpeech:'noun'}],
    {lookupTerm:'warden',displayWord:'warden',verseText:'Marcus warden of Harbor guarded ships near water.'});
  expect(result).toMatchObject({selectedIndex:1,ambiguous:false});
  expect(result.reasons).toContain('obsolete-label:-1.5');
});

test('Word Study capitalization alone cannot confidently promote a sense', () => {
  expect(pure([{text:'An ordinary object.',partOfSpeech:'noun'},{text:'The North Star.',partOfSpeech:'noun'}],
    {lookupTerm:'object',displayWord:'Object',verseText:'I saw Object near the hill.'}))
    .toMatchObject({selectedIndex:0,ambiguous:true,confidence:0});
});

test('Word Study quotations and long compound blobs cannot dominate overlap', () => {
  const verseText = 'The tool worked soil beside flowing water.';
  const result = pure([{text:'A decorative object. [Obs.] "' + verseText.repeat(40) + '"',partOfSpeech:'noun'},
    {text:'A device for working soil.',partOfSpeech:'noun'}],{lookupTerm:'tool',displayWord:'tool',verseText});
  expect(result).toMatchObject({selectedIndex:1,ambiguous:false});
  const blob = 'A brief remark. -- ' + verseText.repeat(50);
  expect(pure([{text:'A spoken expression.',partOfSpeech:'noun'},{text:blob,partOfSpeech:'noun'}],
    {lookupTerm:'tool',displayWord:'tool',verseText})).toMatchObject({selectedIndex:0,ambiguous:true});
});

for(const [translation, file, variable, word, shard, book, chapter, verse] of [
  ['WEB','web.js','webLibrary','delight','del','isaiah',11,3],
  ['ASV','asv.js','asvLibrary','delight','del','isaiah',11,3],
  ['KJV','kjv.js','kjvLibrary','mortify','mo','romans',8,13]
]){
  test(`Word Study blocks unsupported real ${translation} ${word} promotion`, async () => {
    const library = loadBibleLibrary(file, variable);
    const context = {translationId:translation.toLowerCase(), bookId:book, chapter, verse,
      displayWord:word, lookupTerm:word, verseText:library[book][chapter].verses[verse - 1]};
    const candidates = entry(word, shard).definitions;
    const before = JSON.stringify(candidates);
    const selected = pure(candidates, context);
    expect(selected).toMatchObject({selectedIndex:0,ambiguous:true,confidence:0});
    if(word === 'mortify') expect(selected.reasons).toContain('promotion-without-corroboration');
    const current = runtime(), previous = runtime(false);
    const result = await current.realm.WordStudyProvider.lookup(context);
    const original = await previous.realm.WordStudyProvider.lookup(context);
    expect(result.definition).toBe(candidates[0].text);
    expect(result.senseSelection).toEqual(selected);
    expect(result.definitions).toEqual(original.definitions);
    expect(result.relatedWords).toEqual(original.relatedWords);
    expect(result.partOfSpeech).toBe(candidates[0].partOfSpeech);
    expect(JSON.stringify(candidates)).toBe(before);
  });
}

test('Word Study overlap alone cannot promote with matching or absent POS', () => {
  for(const partOfSpeech of ['noun','']){
    const result = pure([{text:'A decorative container.',partOfSpeech},
      {text:'A strip of soil beside flowing water.',partOfSpeech}],
      {lookupTerm:'bank',displayWord:'bank',verseText:'The bank borders soil and flowing water.'});
    expect(result).toMatchObject({selectedIndex:0,ambiguous:true,confidence:0});
    expect(result.reasons).toContain('promotion-without-corroboration');
  }
});

test('Word Study obsolete corroboration cannot authorize an unsupported POS change', () => {
  const result = pure([{text:'A decorative container. [Obs.]',partOfSpeech:'noun'},
    {text:'To carry cargo across flowing water.',partOfSpeech:'verb'}],
    {lookupTerm:'carrier',displayWord:'carrier',verseText:'The carrier brought cargo across flowing water.'});
  expect(result).toMatchObject({selectedIndex:0,ambiguous:true,confidence:0});
  expect(result.reasons).toContain('unsupported-part-of-speech-change');
});

test('Word Study title capitalization cannot displace a meaningful nonobsolete POS', () => {
  const result = pure([{text:'To observe.',partOfSpeech:'verb'},
    {text:'The North Star visible in the night sky.',partOfSpeech:'noun'}],
    {lookupTerm:'object',displayWord:'Object',verseText:'I saw Object in the night sky.'});
  expect(result).toMatchObject({selectedIndex:0,ambiguous:true,confidence:0});
  expect(result.reasons).toContain('unsupported-part-of-speech-change');
});

test('Word Study marked unquoted examples cannot supply overlap despite obsolete corroboration', () => {
  for(const marker of ['; as,', '; as', ': for example', '; e.g.']){
    const result = pure([{text:'A container. [Obs.]',partOfSpeech:'noun'},
      {text:'A pleasant object' + marker + ' the eye sees flowing water and soil.',partOfSpeech:'noun'}],
      {lookupTerm:'thing',displayWord:'thing',verseText:'The thing borders flowing water and soil.'});
    expect(result).toMatchObject({selectedIndex:0,ambiguous:true,confidence:0});
  }
});

test('Word Study retains as within substantive definition meaning', () => {
  const result = pure([{text:'An old container. [Obs.]',partOfSpeech:'noun'},
    {text:'A position as officer responsible for ships and harbor water.',partOfSpeech:'noun'}],
    {lookupTerm:'warden',displayWord:'warden',verseText:'Marcus warden of Harbor guarded ships near water.'});
  expect(result).toMatchObject({selectedIndex:1,ambiguous:false});
  expect(result.reasons).toContain('named-role-context:+3');
  expect(result.reasons).toContain('promotion-corroborated');
});

test('Word Study same-POS obsolete ranking requires positive evidence', () => {
  const definitions = [{text:'A dry grain vessel. [Obs.]',partOfSpeech:'noun'},
    {text:'A strip of soil beside flowing water.',partOfSpeech:'noun'}];
  expect(pure(definitions,{lookupTerm:'bank',verseText:'The bank borders soil and flowing water.'}))
    .toMatchObject({selectedIndex:1,ambiguous:false});
  expect(pure(definitions,{lookupTerm:'bank',verseText:'The bank was nearby.'}))
    .toMatchObject({selectedIndex:0,ambiguous:true,confidence:0});
});

test('Word Study ties and near ties preserve the original index with deterministic ambiguity', () => {
  for(const definitions of [
    [{text:'A river of water.'},{text:'A flow of water.'}],
    [{text:'A channel of water.'},{text:'A channel of water and soil.'}]
  ]){
    const context={lookupTerm:'bank',displayWord:'bank',verseText:'Water runs beside soil at the bank.'};
    const result=pure(definitions,context);
    expect(result).toMatchObject({selectedIndex:0,ambiguous:true,confidence:0});
    expect(pure(definitions,context)).toEqual(result);
  }
});

test('Word Study selector ignores unaligned original-language metadata and handles absent candidates', () => {
  const definitions=[{text:'A vessel for grain.'},{text:'A strip of soil near water.'}];
  const context={lookupTerm:'bank',displayWord:'bank',verseText:'The bank held grain.'};
  expect(pure(definitions,{...context,strongsNumber:'H4428',morphology:'noun',definition:'soil water',tokenIndex:3}))
    .toEqual(pure(definitions,context));
  expect(pure([],context)).toEqual({selectedIndex:-1,confidence:0,reasons:['no-candidates'],ambiguous:false});
});

test('Word Study selection retains exact/possessive fallback and does not refetch an already loaded shard', async () => {
  const current=runtime(); const context=verseContext('king','genesis',14);
  await current.realm.WordStudyProvider.lookup(context);
  const before=current.requests.slice();
  const cached=await current.realm.WordStudyProvider.lookup({...context,verseText:'The hammer struck metal plates in the frame of wood.'});
  expect(cached.definition).toBe(entry('king','ki').definitions[0].text);
  expect(current.requests).toEqual(before);
  const inflected=await current.realm.WordStudyProvider.lookup({...context,lookupTerm:"king's",displayWord:"king's"});
  expect(inflected.definition).toBe(entry('king','ki').definitions[1].text);
  expect(inflected.definitions).toEqual(entry('king','ki').definitions);
});

test('Word Study dictionary failure retains the existing local fallback without selector network calls', async () => {
  const current=runtime(true,true), previous=runtime(false,true);
  const context={lookupTerm:'beginning',displayWord:'beginning',verseText:'In the beginning.'};
  expect(await current.realm.WordStudyProvider.lookup(context)).toEqual(await previous.realm.WordStudyProvider.lookup(context));
  expect(current.requests).toEqual(previous.requests);
});

for(const [displayWord, chapter, expectedStart] of [['king',14,'A chief ruler; a sovereign;'], ['God',1,'The Supreme Being;']]){
  test(`Word Study Reader displays the selected ${displayWord} sense through unchanged panel controls`, async ({page}) => {
    const errors=[]; page.on('pageerror', error => errors.push(error.message));
    await page.goto('/');
    await page.evaluate(async chapter => {
      await BibleTranslationLoader.ensure('web');
      currentTranslation='web'; currentBook='genesis'; currentChapter=chapter;
      renderPassage('genesis', chapter);
    },chapter);
    const word=page.locator('#readerContent [data-verse-number="1"] [data-word-study-display="' + displayWord + '"]').first();
    await word.focus(); await word.press('Enter');
    await expect(page.locator('#wordStudyPanel')).toBeVisible();
    await expect(page.locator('#wordStudyDefinition')).toContainText(expectedStart);
    await expect(page.locator('#wordStudyPartOfSpeech')).toHaveText('noun');
    await expect(page.locator('#wordStudyHeading')).toBeFocused();
    await page.keyboard.press('Escape');
    await expect(page.locator('#wordStudyPanel')).toBeHidden();
    await expect(word).toBeFocused();
    expect(errors).toEqual([]);
  });
}
