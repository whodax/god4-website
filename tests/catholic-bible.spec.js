const {test,expect}=require('@playwright/test');
const {selectCompareOption}=require('./reader-navigation-test-helper');
async function open(page){await page.goto('/');await page.evaluate(()=>navigator.serviceWorker.ready.then(()=>true));if(!await page.evaluate(()=>Boolean(navigator.serviceWorker.controller)))await page.reload();await page.evaluate(()=>initializeBibleExperience());await page.evaluate(()=>changeTranslation('dra'));}
async function passage(page,book,chapter=1,verse){await page.evaluate(([b,c,v])=>navigateReaderToPassage(b,c,v),[book,chapter,verse]);}
test('DRA registry, exact configured order and unchanged Protestant inventory',async({page})=>{
 await open(page);await expect(page.locator('#readerTranslation option[value="dra"]')).toHaveText(/DRA.*Douay-Rheims — Catholic/);
 const result=await page.evaluate(()=>({dra:BibleData.listBooks('dra').map(b=>b.id),expected:BibleCanon.order('dra'),web:BibleData.listBooks('web').map(b=>b.id),pro:BibleCanon.order('web')}));
 expect(result.dra).toEqual(result.expected);expect(result.dra).toHaveLength(73);expect(result.web).toEqual(result.pro);expect(result.web).toHaveLength(66);
});
for(const [book,chapter,verse] of [['tobit',1,1],['judith',1,1],['wisdom',1,1],['sirach',1,1],['baruch',6,72],['1-maccabees',1,1],['2-maccabees',1,1],['esther',10,4],['esther',16,24],['daniel',3,24],['daniel',3,90],['daniel',13,65],['daniel',14,42]]){
 test(`Reader and launcher preserve ${book} ${chapter}:${verse}`,async({page})=>{
  await open(page);await passage(page,book,chapter,verse);
  await expect(page.locator(`#readerContent [data-verse-number="${verse}"]`)).toBeFocused();
  await expect(page.locator('#scripturePickerTrigger')).toContainText(`${chapter}:${verse}`);
  expect(await page.evaluate(()=>getReaderPosition())).toEqual({bookId:book,chapter,verse});
 });
}
test('all Esther addition chapters are reachable',async({page})=>{await open(page);for(let c=10;c<=16;c++){await passage(page,'esther',c,1);await expect(page.locator('#readerContent h2')).toHaveText(`Esther ${c}`);}});
test('Catholic Previous/Next crosses configured book boundaries',async({page})=>{
 await open(page);await passage(page,'tobit',14);await page.evaluate(()=>nextChapter());await expect(page.locator('#readerContent h2')).toHaveText('Judith 1');
 await page.evaluate(()=>prevChapter());await expect(page.locator('#readerContent h2')).toHaveText('Tobit 14');
 await passage(page,'nehemiah',13);await page.evaluate(()=>nextChapter());await expect(page.locator('#readerContent h2')).toHaveText('Tobit 1');
});
test('cross-canon switching announces safe fallback and numbering reset',async({page})=>{
 await open(page);await passage(page,'sirach',5,1);await page.evaluate(()=>changeTranslation('web'));
 await expect(page.locator('#readerContent h2')).toHaveText('John 1');await expect(page.locator('#readerTranslationStatus')).toContainText('Sirach is not available');
 await page.evaluate(()=>changeTranslation('dra'));await passage(page,'daniel',3,90);await page.evaluate(()=>changeTranslation('web'));
 await expect(page.locator('#readerContent h2')).toHaveText('Daniel 1');await expect(page.locator('#readerTranslationStatus')).toContainText('different numbering');
});
for(const [book,c,v] of [['tobit',1,1],['esther',16,24],['daniel',3,90],['daniel',13,65],['psalms',23,1]])test(`Compare handles canon/numbering for ${book} ${c}:${v}`,async({page})=>{
 await open(page);await passage(page,book,c,v);await page.evaluate(async()=>{await CompareLoader.activate();setCompareEditionCount(2,true);await loadCompare();});
 await expect(page.locator('#compareGrid')).toContainText('DRA - Douay-Rheims — Catholic');
 const web=page.locator('.compare-col').filter({has:page.locator('select option[value="web"]:checked')});
 await expect(web).toContainText(book==='tobit'||(book==='esther'&&c>10)||(book==='daniel'&&(c>12||c===3&&v===90))?'This passage is part of the Catholic canon':'Numbering differs');
 expect(await page.evaluate(()=>getCompareReference())).toEqual({bookId:book,chapter:c,verse:v});
});
for(const [query,id,c,v] of [['Tobias 1:1','tobit',1,1],['Ecclesiasticus 1:1','sirach',1,1],['Wisdom of Solomon 1:1','wisdom',1,1],['Esther 16:24','esther',16,24],['Daniel 3:90','daniel',3,90]])test('Search reference alias '+query,async({page})=>{
 await open(page);await page.evaluate(()=>changeSearchTranslation('dra'));await page.locator('#searchInput').fill(query);await page.evaluate(()=>doSearch());
 await expect(page.locator('.result-card')).toHaveCount(1);await page.locator('.result-card').click();
 expect(await page.evaluate(()=>getReaderPosition())).toEqual({bookId:id,chapter:c,verse:v});
});
test('keyword search covers Deuterocanonical and addition text',async({page})=>{
 await open(page);expect(await page.evaluate(()=>BibleData.search('dra','Susanna').some(r=>r.bookId==='daniel' && r.chapter===13))).toBe(true);
 expect(await page.evaluate(()=>BibleData.search('dra','Tobias').some(r=>r.bookId==='tobit'))).toBe(true);
 expect(await page.evaluate(()=>BibleData.search('dra','Mardochai').some(r=>r.bookId==='esther'&&r.chapter>10))).toBe(true);
});
test('Saved Catholic verse survives reload and intentionally loads its own edition',async({page})=>{
 await open(page);await passage(page,'tobit',1,1);await page.evaluate(()=>saveReaderVerse());
 const saved=await page.evaluate(()=>UserData.savedVerses.load());expect(saved[0].location).toEqual({translationId:'dra',bookId:'tobit',chapter:1,verse:1});expect(saved[0].ref).toBe('Tobit 1:1 (DRA)');
 await page.evaluate(()=>changeTranslation('web'));await page.reload();await page.evaluate(()=>initializeBibleExperience());
 await page.locator('.saved-pill').click();await page.locator('#trayList').getByRole('button',{name:'Open',exact:true}).click();
 await expect(page.locator('#readerTranslation')).toHaveValue('dra');await expect(page.locator('#scripturePickerTrigger')).toContainText('Tobit 1:1');
 expect(await page.evaluate(()=>UserData.savedVerses.load()[0].text)).toBe(saved[0].text);
});
for(const width of [1280,390,320])test(`Catholic picker keyboard, fullscreen and reflow ${width}`,async({page})=>{
 await page.setViewportSize({width,height:800});await open(page);await page.locator('#fullscreenBtn').click();await page.locator('#scripturePickerTrigger').click();
 await page.locator('#pickerBookSearch').fill('Ecclesiasticus');await expect(page.locator('.picker-book-list button')).toHaveCount(1);
 await page.locator('.picker-book-list button').press('Enter');await page.locator('[data-picker-action="chapter"][data-value="51"]').press('Space');await page.locator('[data-picker-action="verse"][data-value="38"]').press('Enter');
 await expect(page.locator('#view-reader')).toHaveClass(/reader-fullscreen/);await expect(page.locator('#readerContent [data-verse-number="38"]')).toBeFocused();
 expect(await page.evaluate(()=>document.documentElement.scrollWidth<=innerWidth)).toBe(true);
 await page.screenshot({path:`test-results/catholic-${width}.png`});
});
for(const [book,c,v] of [['tobit',1,1],['wisdom',1,1],['sirach',1,1],['1-maccabees',1,1],['esther',16,23],['daniel',3,89]])test(`native narration ${book}`,async({page})=>{
 await page.addInitScript(()=>{
  window.__spoken=[];window.SpeechSynthesisUtterance=function(text){this.text=text;};
  Object.defineProperty(window,'speechSynthesis',{configurable:true,value:{getVoices(){return [{name:'Microsoft David',lang:'en-US',localService:true}];},addEventListener(){},speak(u){window.__spoken.push(u);u.onstart?.();},cancel(){},pause(){},resume(){}}});
 });
 await open(page);await passage(page,book,c,v);await page.locator('#readAloudPlay').click();
 await expect(page.locator('.verse-spoken')).toHaveAttribute('data-verse-number',String(v));
 expect(await page.evaluate(()=>window.__spoken.at(-1).text)).toContain(await page.evaluate(([b,c,v])=>BibleData.getVerse('dra',b,c,v).text,[book,c,v]));
 await page.evaluate(()=>window.__spoken.at(-1).onend());await expect(page.locator('.verse-spoken')).toHaveAttribute('data-verse-number',String(v+1));
 await page.evaluate(()=>stopReader());await expect(page.locator('.verse-spoken')).toHaveCount(0);
});
test('Catholic-only original-language data stays explicitly unavailable',async({page})=>{
 await open(page);await page.evaluate(()=>WordStudyLoader.ensure());expect(await page.evaluate(()=>OriginalLanguageWordStudyProvider.lookupVerse({translationId:'dra',bookId:'tobit',chapter:1,verse:1}))).toEqual({status:'unavailable',records:[]});
});
test('startup does not request DRA; retain/offline Reader/remove use existing protocol',async({page,context})=>{
 await page.addInitScript(()=>{window.IntersectionObserver=class{observe(){}disconnect(){}};});
 const requests=[];page.on('request',r=>requests.push(r.url()));await page.goto('/');await page.evaluate(()=>navigator.serviceWorker.ready.then(()=>true));await page.reload();
 expect(requests.filter(u=>/\/dra\.js/.test(u))).toEqual([]);
 const shell=await page.evaluate(async()=>{const keys=await caches.keys();return (await(await caches.open(keys.find(k=>k.startsWith('god4-shell-')))).keys()).map(r=>new URL(r.url).pathname);});expect(shell).not.toContain('/js/bible/dra.js');
 await page.evaluate(()=>document.getElementById('offlineBiblesTrigger').click());
 const action=page.locator('[data-translation-id="dra"] .offline-bibles-action');await action.click();await expect(action).toHaveText('Remove');
 await page.keyboard.press('Escape');await page.evaluate(()=>initializeBibleExperience());await page.evaluate(()=>changeTranslation('dra'));await passage(page,'baruch',6,72);
 await context.setOffline(true);await page.reload();await page.evaluate(()=>initializeBibleExperience());await expect(page.locator('#readerTranslation')).toHaveValue('dra');await expect(page.locator('#scripturePickerTrigger')).toContainText('Baruch 6:72');
 await context.setOffline(false);await page.evaluate(()=>changeTranslation('web'));await page.evaluate(()=>document.getElementById('offlineBiblesTrigger').click());await action.click();await expect(action).toHaveText('Download');
 await page.keyboard.press('Escape');await context.setOffline(true);await page.reload();expect(await page.evaluate(()=>BibleTranslationLoader.ensure('dra'))).toBe(false);
});

test.describe('Compare Catholic reference regressions',()=>{
 test.use({serviceWorkers:'block'});
for(const [book,lastChapter] of [['esther',16],['daniel',14]])test(`Compare refreshes ${book} controls after delayed DRA loading`,async({page})=>{
 await page.goto('/');await page.evaluate(()=>initializeBibleExperience());
 await page.evaluate(book=>navigateReaderToPassage(book,1),book);
 await page.getByRole('button',{name:'Compare',exact:true}).click();
 await expect(page.locator('#compareGrid .compare-col')).toHaveCount(2);
 expect(await page.evaluate(()=>BibleData.isTranslationLoaded('dra'))).toBe(false);
 await expect(page.locator('#compareBook option[value="tobit"]')).toHaveCount(0);
 await expect(page.locator(`#compareChapter option[value="${lastChapter}"]`)).toHaveCount(0);
 let release;const pending=new Promise(resolve=>release=resolve);
 await page.route('**/js/bible/dra.js?*',async route=>{await pending;await route.continue();});
 const requested=page.waitForRequest(request=>new URL(request.url()).pathname==='/js/bible/dra.js');
 await selectCompareOption(page.locator('[data-compare-index="1"]'),'dra');await requested;
 await expect(page.locator('#compareBook option[value="tobit"]')).toHaveCount(0);
 release();
 await expect(page.locator('#compareBook option[value="tobit"]')).toHaveCount(1);
 await expect(page.locator(`#compareChapter option[value="${lastChapter}"]`)).toHaveCount(1);
 await expect(page.locator('#compareBook')).toHaveValue(book);
 await expect(page.locator('#compareChapter')).toHaveValue('1');
 await expect(page.locator('#view-compare')).toHaveClass(/active/);
 await selectCompareOption(page.locator('#compareBook'),'tobit');
 await expect(page.locator('.compare-col').nth(1).locator('.vnum')).toHaveCount(25);
});

for(const [book,chapter] of [['esther',11],['esther',12],['esther',13],['esther',14],['esther',15],['esther',16],['daniel',13],['daniel',14]])test(`Compare assigns DRA ownership to ${book} ${chapter} from WEB`,async({page})=>{
 await page.goto('/');await page.evaluate(()=>initializeBibleExperience());
 await page.evaluate(()=>BibleTranslationLoader.ensure('dra'));
 await page.getByRole('button',{name:'Compare',exact:true}).click();
 await expect(page.locator('#compareGrid .compare-col')).toHaveCount(2);
 await selectCompareOption(page.locator('[data-compare-index="1"]'),'dra');
 await selectCompareOption(page.locator('#compareBook'),book);
 await selectCompareOption(page.locator('#compareChapter'),String(chapter));
 const dra=page.locator('.compare-col').nth(1),web=page.locator('.compare-col').first();
 const expected=await page.evaluate(([book,chapter])=>BibleData.getChapter('dra',book,chapter).verses,[book,chapter]);
 await expect(dra.locator('.vnum')).toHaveCount(expected.length);
 await expect(dra.locator('.compare-text p').first()).toContainText(expected[0]);
 await expect(web).toContainText('This passage is part of the Catholic canon and is not available in this translation.');
 expect(await page.evaluate(()=>getCompareReference())).toEqual({bookId:book,chapter,verse:null});
 await expect(page.locator('#readerTranslation')).toHaveValue('web');
});
});
