const {test,expect}=require('@playwright/test');
const unavailable='This passage is part of the Catholic canon and is not available in this translation.';
async function open(page,translation='dra'){
  await page.goto('/');await page.evaluate(()=>initializeBibleExperience());
  if(translation==='dra')await page.evaluate(()=>changeTranslation('dra'));
}
async function passage(page,book,chapter=1,verse){await page.evaluate(([b,c,v])=>navigateReaderToPassage(b,c,v),[book,chapter,verse]);}

test('DRA display name and description identify the canon without changing edition attribution',async({page})=>{
  await open(page);
  await expect(page.locator('#readerTranslation option[value="dra"]')).toHaveText('CTH — Catholic Bible (Douay-Rheims)');
  const metadata=await page.evaluate(()=>BibleData.listTranslations().find(t=>t.id==='dra'));
  expect(metadata.attribution).toContain('1899');
  await page.locator('#scripturePickerTrigger').click();
  await expect(page.locator('.picker-status')).toHaveText(metadata.description);
  await page.keyboard.press('Escape');
  await page.getByRole('button',{name:'Compare',exact:true}).click();
  await expect(page.locator('.compare-col').first().locator('option[value="dra"]')).toHaveText('CTH - Catholic Bible (Douay-Rheims)');
  await page.locator('#offlineBiblesTrigger').click();
  await expect(page.locator('[data-translation-id="dra"] .offline-bibles-name')).toHaveText('Catholic Bible (Douay-Rheims)');
  await expect(page.locator('[data-translation-id="dra"] .offline-bibles-row-status')).toContainText(metadata.description);
  await page.keyboard.press('Escape');
  await page.locator('#searchTranslationToggle').click();
  await expect(page.locator('#searchTranslationMenu [data-translation-id="dra"]')).toHaveAccessibleName('CTH — Catholic Bible (Douay-Rheims)');
});

test('all seven Deuterocanonical choices have visible accessible labels and common books do not',async({page})=>{
  await open(page);await page.locator('#scripturePickerTrigger').click();
  for(const name of ['Tobit','Judith','Wisdom','Sirach','Baruch','1 Maccabees','2 Maccabees']){
    const choice=page.getByRole('button',{name:name+' — Deuterocanonical',exact:true});
    await expect(choice).toBeVisible();await expect(choice).toHaveText(name+' — Deuterocanonical');
  }
  await expect(page.getByRole('button',{name:'Genesis',exact:true})).toBeVisible();
  await expect(page.locator('#bookSelect option[value="tobit"]')).toHaveText('Tobit — Deuterocanonical');
});

for(const [book,chapter,label] of [['esther',16,'Catholic addition'],['daniel',13,'Catholic addition'],['daniel',14,'Catholic addition'],['esther',10,'Includes Catholic additions (verses 4–13)'],['daniel',3,'Includes Catholic additions (verses 24–90)']])test(`contextual additions label ${book} ${chapter}`,async({page})=>{
  await open(page);await passage(page,book,chapter,1);
  await expect(page.locator('.reader-chapter-caption')).toContainText(label);
  await expect(page.locator('#readerContent [data-verse-number="1"]')).not.toContainText('Catholic addition');
  await page.locator('#scripturePickerTrigger').click();
  const chapterChoice=page.locator(`[data-picker-action="chapter"][data-value="${chapter}"]`);
  await expect(chapterChoice).toHaveAccessibleName(`Chapter ${chapter} — ${label}`);
  await chapterChoice.press('Enter');
  await expect(page.locator('#pickerDetailTitle')).toContainText(label);
  await page.keyboard.press('Escape');await expect(page.locator('#scripturePickerTrigger')).toBeFocused();
});

for(const [book,chapter,verse] of [['tobit',1,1],['esther',10,4],['esther',11,1],['esther',12,1],['esther',13,1],['esther',14,1],['esther',15,1],['esther',16,24],['daniel',13,65],['daniel',14,42],['daniel',3,90]])test(`unavailable ${book} ${chapter}:${verse} preserves Reader fallback and Compare gating`,async({page})=>{
  await open(page);await passage(page,book,chapter,verse);
  await page.getByRole('button',{name:'Compare',exact:true}).click();
  await expect(page.locator('.compare-col').nth(1)).toContainText(unavailable);
  await expect(page.locator('#compareBook option[value="tobit"]')).toHaveText('Tobit — Deuterocanonical');
  await page.getByRole('button',{name:'Reader',exact:true}).click();
  await page.evaluate(()=>changeTranslation('web'));
  await expect(page.locator('#readerTranslationStatus')).toContainText(unavailable);
  await expect(page.locator('#readerContent h2')).toHaveText(book==='tobit'?'John 1':book[0].toUpperCase()+book.slice(1)+' 1');
});

test('Protestant and common Catholic passages remain unlabeled, with existing numbering protection',async({page})=>{
  await open(page,'web');await page.locator('#scripturePickerTrigger').click();
  await expect(page.locator('.picker-status')).toBeEmpty();
  await expect(page.locator('.picker-book-list')).not.toContainText('Deuterocanonical');
  await expect(page.locator('#readerTranslation option[value="web"]')).not.toContainText('Catholic');
  await expect(page.locator('[data-picker-action="chapter"]').first()).not.toHaveAttribute('aria-label',/Catholic/);
  await page.keyboard.press('Escape');
  await page.evaluate(()=>changeTranslation('dra'));await passage(page,'genesis',1,1);
  await expect(page.locator('.reader-chapter-caption')).not.toContainText('Catholic');
  await page.getByRole('button',{name:'Compare',exact:true}).click();
  await expect(page.locator('.compare-col').nth(1)).toContainText('Numbering differs');
  await expect(page.locator('#compareBook option[value="genesis"]')).toHaveText('Genesis');
});

for(const width of [320,390])test(`Catholic picker labels retain keyboard focus and reflow at ${width}px`,async({page})=>{
  await page.setViewportSize({width,height:800});await open(page);
  await page.locator('#scripturePickerTrigger').press('Enter');
  await page.locator('#pickerBookSearch').fill('Ecclesiasticus');
  await expect(page.locator('.picker-book-list button')).toHaveCount(1);
  await page.getByRole('button',{name:'Sirach — Deuterocanonical',exact:true}).press('Enter');
  await page.locator('[data-picker-action="chapter"][data-value="51"]').press('Space');
  await page.locator('[data-picker-action="verse"][data-value="38"]').press('Enter');
  await expect(page.locator('#readerContent [data-verse-number="38"]')).toBeFocused();
  await page.locator('#searchTranslationToggle').click();
  await expect(page.locator('#searchTranslationMenu [data-translation-id="dra"]')).toHaveAccessibleName('CTH — Catholic Bible (Douay-Rheims)');
  expect(await page.evaluate(()=>document.documentElement.scrollWidth<=innerWidth)).toBe(true);
});

for(let verse=24;verse<=30;verse++){
  test(`Catholic-only Daniel 3:${verse} Reader -> WEB ignores coincident target coordinates`,async({page})=>{
    await open(page);await passage(page,'daniel',3,verse);
    expect(await page.evaluate(v=>BibleCanon.catholicOnly('daniel',3,v),verse)).toBe(true);
    expect(await page.evaluate(v=>BibleData.getVerse('web','daniel',3,v),verse)).not.toBeNull();
    await page.evaluate(()=>changeTranslation('web'));
    await expect(page.locator('#readerTranslationStatus')).toContainText(unavailable);
    await expect(page.locator('#readerTranslationStatus')).toContainText('no equivalent passage was inferred');
    expect(await page.evaluate(()=>getReaderPosition())).toEqual({bookId:'daniel',chapter:1});
    await expect(page.locator('#verseSelect')).toHaveValue('');
  });
  test(`Catholic-only Daniel 3:${verse} Compare -> WEB ignores coincident target coordinates`,async({page})=>{
    await open(page);await passage(page,'daniel',3,verse);
    expect(await page.evaluate(v=>BibleData.getVerse('web','daniel',3,v),verse)).not.toBeNull();
    await page.getByRole('button',{name:'Compare',exact:true}).click();
    await expect(page.locator('.compare-col').nth(1).getByRole('status')).toHaveText(unavailable);
    await expect(page.locator('.compare-col').first().locator('.vnum')).toHaveText(String(verse));
    await expect(page.locator('.compare-col').first().locator('.compare-unavailable')).toHaveCount(0);
    expect(await page.evaluate(()=>getCompareReference())).toEqual({bookId:'daniel',chapter:3,verse});
  });
}

for(const verse of [23,91])test(`ordinary DRA Daniel 3:${verse} retains its numbering warning`,async({page})=>{
  await open(page);await passage(page,'daniel',3,verse);
  expect(await page.evaluate(v=>BibleCanon.catholicOnly('daniel',3,v),verse)).toBe(false);
  await page.getByRole('button',{name:'Compare',exact:true}).click();
  await expect(page.locator('.compare-col').nth(1)).toContainText('Numbering differs');
  await expect(page.locator('.compare-col').nth(1)).not.toContainText(unavailable);
  await page.getByRole('button',{name:'Reader',exact:true}).click();
  await page.evaluate(()=>changeTranslation('web'));
  await expect(page.locator('#readerTranslationStatus')).toContainText('different numbering tradition');
  await expect(page.locator('#readerTranslationStatus')).not.toContainText(unavailable);
});

test('Protestant Daniel coordinates remain available in Reader and Compare',async({page})=>{
  await open(page,'web');await passage(page,'daniel',3,24);
  await page.getByRole('button',{name:'Compare',exact:true}).click();
  await expect(page.locator('.compare-col .compare-unavailable')).toHaveCount(0);
  await expect(page.locator('.compare-col .vnum')).toHaveText(['24','24']);
  await page.getByRole('button',{name:'Reader',exact:true}).click();
  await page.evaluate(()=>changeTranslation('kjv'));
  await expect(page.locator('#readerTranslationStatus')).toBeEmpty();
  expect(await page.evaluate(()=>getReaderPosition())).toEqual({bookId:'daniel',chapter:3,verse:24});
});

test('same-edition DRA selection never reports its own addition as unavailable',async({page})=>{
  await open(page);await passage(page,'daniel',3,24);await page.evaluate(()=>changeTranslation('dra'));
  await expect(page.locator('#readerTranslationStatus')).toBeEmpty();
  expect(await page.evaluate(()=>getReaderPosition())).toEqual({bookId:'daniel',chapter:3,verse:24});
});

for(const located of [false,true])test('legacy DRA saved reference displays CTH without storage migration, located='+located,async({page})=>{
  const entry={ref:'Tobit 1:1 (DRA)',text:'Existing Catholic saved verse'};
  if(located)entry.location={translationId:'dra',bookId:'tobit',chapter:1,verse:1};
  await page.addInitScript(entry=>{localStorage.setItem('god4.savedVerses',JSON.stringify([entry]));localStorage.setItem('god4.translation','dra');},entry);
  await open(page);const original=await page.evaluate(()=>localStorage.getItem('god4.savedVerses'));
  await page.locator('.saved-pill').click();await expect(page.locator('.saved-verse-reference')).toHaveText('Tobit 1:1 (CTH)');
  expect(await page.evaluate(()=>localStorage.getItem('god4.savedVerses'))).toBe(original);
  expect(await page.evaluate(()=>localStorage.getItem('god4.translation'))).toBe('dra');
  if(located){
    await page.locator('#trayList').getByRole('button',{name:'Open',exact:true}).click();
    await expect(page.locator('#readerTranslation')).toHaveValue('dra');await expect(page.locator('#scripturePickerTrigger')).toContainText('Tobit 1:1');
    expect(await page.evaluate(()=>localStorage.getItem('god4.savedVerses'))).toBe(original);
    await page.evaluate(()=>ReaderTranslationLoader.ensure());await page.locator('#readerMoreTrigger').click();
    await expect(page.locator('#readerSaveVerse')).toHaveAttribute('aria-pressed','true');
    await page.locator('.saved-pill').click();
  }
  await page.locator('#trayList').getByRole('button',{name:'Remove',exact:true}).click();
  expect(await page.evaluate(()=>UserData.savedVerses.load())).toEqual([]);
});
test('CTH Search results retain internal dra navigation',async({page})=>{
  await open(page);await page.evaluate(()=>{updateSearchTranslationSelection('dra');document.getElementById('searchInput').value='Tobias 1:1';});
  await page.evaluate(()=>doSearch());await expect(page.locator('#searchTranslationToggle')).toContainText('CTH');
  await expect(page.locator('#results')).toContainText('CTH');
  await page.locator('.result-card').click();expect(await page.evaluate(()=>currentTranslation)).toBe('dra');
  expect(await page.evaluate(()=>getReaderPosition())).toEqual({bookId:'tobit',chapter:1,verse:1});
});
