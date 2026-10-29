const {test,expect}=require('@playwright/test');
test.use({hasTouch:true,userAgent:'Mozilla/5.0 (Linux; Android 14; Pixel 7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/130.0.0.0 Mobile Safari/537.36'});
async function open(page,cloud=false,diagnostic=false){
  await page.setViewportSize({width:390,height:844});await page.emulateMedia({reducedMotion:'reduce'});
  await page.addInitScript(cloud=>{
    window.IntersectionObserver=class{observe(){}unobserve(){}disconnect(){}};
    Object.defineProperty(navigator,'permissions',{configurable:true,value:{query:async()=>({state:'prompt'})}});
    const s=window.__voiceNav={native:[],requests:[],sources:[],recognizers:[],overlaps:[],autoEnd:true};
    class Recognition{constructor(){this.maxAlternatives=1;s.recognizers.push(this);}start(){this.active=true;this.onstart?.();}abort(){if(s.autoEnd)queueMicrotask(()=>this.end());}end(){this.active=false;this.onend?.();}emit(t,final=true,alternatives=[]){this.onresult?.({resultIndex:0,results:[Object.assign([t,...alternatives].map(transcript=>({transcript})),{isFinal:final})]});}}
    window.SpeechRecognition=Recognition;window.webkitSpeechRecognition=Recognition;
    const released=()=>{if(s.recognizers.some(r=>r.active))s.overlaps.push('speech before microphone release');};
    Object.defineProperty(window,'SpeechSynthesisUtterance',{configurable:true,value:function(text){this.text=text;}});
    Object.defineProperty(window,'speechSynthesis',{configurable:true,value:{getVoices:()=>[{name:'Microsoft David',lang:'en-US',localService:true}],addEventListener(){},pause(){},resume(){released();},cancel(){},speak(u){released();s.native.push(u);u.onstart?.();}}});
    class Context{constructor(){this.state='running';this.destination={};}resume(){released();this.state='running';return Promise.resolve();}suspend(){this.state='suspended';return Promise.resolve();}decodeAudioData(){return Promise.resolve({duration:1});}createBufferSource(){const src={connect(){},disconnect(){},start(){if(this.state!=='suspended')released();},stop(){},end(){this.onended?.();}};s.sources.push(src);return src;}}
    Object.defineProperty(window,'AudioContext',{configurable:true,value:cloud?Context:undefined});Object.defineProperty(window,'webkitAudioContext',{configurable:true,value:undefined});
  },cloud);
  await page.route('**/api/tts',async route=>{await page.evaluate(b=>__voiceNav.requests.push(b),route.request().postDataJSON());await route.fulfill({status:200,contentType:'audio/mpeg',body:'controlled audio'});});
  page.errors=[];page.on('pageerror',e=>page.errors.push(e.message));
  await page.goto(diagnostic?'/#voice-debug':'/');await page.evaluate(()=>initializeBibleExperience());await page.evaluate(()=>ReaderTranslationLoader.ensure());
}
async function command(page,text,wait=true,alternatives=[]){
  await page.evaluate(()=>new Promise(requestAnimationFrame));const recovery=page.getByRole('button',{name:'Show Reader controls',exact:true});if(await recovery.isVisible())await recovery.click();
  const more=page.locator('#readerMoreTrigger');if(await more.getAttribute('aria-expanded')==='false')await more.click();
  await page.locator('[data-voice-command-button]').tap();await page.evaluate(({text,alternatives})=>__voiceNav.recognizers.at(-1).emit(text,true,alternatives),{text,alternatives});
  await expect(page.locator('[data-voice-command-button]')).toHaveAttribute('aria-pressed','false');
  if(wait)await page.evaluate(()=>voiceNavigationTask);
}
async function position(page){return page.evaluate(()=>({id:currentTranslation,book:currentBook,chapter:currentChapter,verse:currentVerse,stored:localStorage.getItem('god4.translation'),saved:JSON.stringify(UserData.savedVerses.load())}));}
test.afterEach(async({page})=>{expect(page.errors||[]).toEqual([]);expect(await page.evaluate(()=>__voiceNav.overlaps)).toEqual([]);});

const translations=[['web','World English Bible','W E B'],['asv','American Standard Version','A S V'],['kjv','King James Version','K J V'],['ylt','Young’s Literal Translation','Y L T'],['dby','Darby Translation','D B Y'],['webster','Webster Bible','W B S'],['rv','Revised Version','R V'],['gnv','Geneva Bible','G N V'],['dra','Douay-Rheims — Catholic','D R A']];
for(const [id,name,letters] of translations)test(`${id}: full name, spoken abbreviation, compound reference and persistence`,async({page})=>{
  await open(page);await command(page,name);await expect(page.locator('#readerTranslation')).toHaveValue(id);
  await command(page,`Switch to ${letters}, Matthew chapter one verse two`);
  await expect(page.locator('#readerContent h2')).toHaveText('Matthew 1');await expect(page.locator('#verseSelect')).toHaveValue('2');
  await expect(page.locator('#readerContent .verse-focused')).toHaveAttribute('data-verse-number','2');
  expect(await page.evaluate(()=>BibleSpeech.getState())).toBe('idle');expect(await page.evaluate(()=>localStorage.getItem('god4.translation'))).toBe(id);
  await page.reload();await page.evaluate(()=>initializeBibleExperience());await expect(page.locator('#readerTranslation')).toHaveValue(id);await expect(page.locator('#verseSelect')).toHaveValue('2');
});

for(const [spoken,book,chapter,verse] of [
  ['Matthew chapter 1 verse 2','matthew',1,2],['John 1:1','john',1,1],['John1:16','john',1,16],['John one sixteen','john',1,16],
  ['John chapter 3','john',3,null],['Verse 16','john',1,16],['chapter three verse sixteen','john',3,16],
  ['Psalms chapter one hundred and nineteen verse one hundred seventy six','psalms',119,176],
  ['first John two verse twenty three','1-john',2,23],['Second Timothy 1:2','2-timothy',1,2],['Jude five','jude',1,5],['Philemon 25','philemon',1,25]
])test(`reference: ${spoken}`,async({page})=>{
  await open(page);await command(page,spoken);const p=await position(page);expect(p).toMatchObject({book,chapter,verse});
  if(verse!==null)await expect(page.locator('#readerContent .verse-focused')).toHaveAttribute('data-verse-number',String(verse));
});

for(const spoken of ['John 99:1','John chapter zero','John 3:999','John 3:16-18','John twenty one','Switch to NIV','King James Version, Romans 99:1','WEB Tobit 1:1','Verse 999'])test(`invalid/ambiguous: ${spoken} leaves the exact passage and translation intact`,async({page})=>{
  await open(page);await page.evaluate(()=>navigateReaderToPassage('john',1,2));const before=await position(page);
  await command(page,spoken);expect(await position(page)).toEqual(before);await expect(page.locator('#voiceStatusTop')).toHaveText(/not found|not available|Ambiguous/);
});

test('Catholic aliases and explicit cross-canon targets work without inferring numbering equivalence',async({page})=>{
  await open(page);await command(page,'Douay-Rheims, Tobias 1:1');expect(await position(page)).toMatchObject({id:'dra',book:'tobit',chapter:1,verse:1});
  const before=await position(page);await command(page,'ASV');expect(await position(page)).toEqual(before);
  await command(page,'ASV Romans 8:28');expect(await position(page)).toMatchObject({id:'asv',book:'romans',chapter:8,verse:28});
  await command(page,'DRA Psalms 23:1');const psalm=await position(page);await command(page,'WEB');expect(await position(page)).toEqual(psalm);await expect(page.locator('#voiceStatusTop')).toContainText('numbering');
  await command(page,'WEB Psalms 23:1');expect(await position(page)).toMatchObject({id:'web',book:'psalms',chapter:23,verse:1});
  await command(page,'DRA Daniel 13:65');expect(await position(page)).toMatchObject({id:'dra',book:'daniel',chapter:13,verse:65});
});

for(const cloud of [false,true])test(`${cloud?'cloud':'native'}: compound navigation resumes at the new passage, same-chapter verse commands do not repeat chapter introductions`,async({page})=>{
  await open(page,cloud);await page.evaluate(async()=>{await navigateReaderToPassage('john',2,5);playReader();});
  await expect.poll(()=>page.evaluate(cloud=>cloud?__voiceNav.sources.length:__voiceNav.native.length,cloud)).toBe(1);
  await command(page,'King James Version, Romans chapter eight verse twenty eight');
  await expect.poll(()=>page.evaluate(()=>BibleSpeech.getState())).toBe('playing');
  const spoken=await page.evaluate(cloud=>cloud?__voiceNav.requests.map(r=>r.text):__voiceNav.native.map(u=>u.text),cloud);
  expect(spoken).toHaveLength(2);expect(spoken[1]).toBe('Romans chapter 8. '+await page.evaluate(()=>BibleData.getVerse('kjv','romans',8,28).text.replace(/\[((?:\[[^[\]]*\]|[^[\]])+)\]/g,'$1')));
  await command(page,'Verse 30');const last=await page.evaluate(cloud=>cloud?__voiceNav.requests.at(-1).text:__voiceNav.native.at(-1).text,cloud);
  expect(last).toBe(await page.evaluate(()=>BibleData.getVerse('kjv','romans',8,30).text.replace(/\[((?:\[[^[\]]*\]|[^[\]])+)\]/g,'$1')));
});

test('paused navigation prepares the destination without audio and Resume starts only that passage',async({page})=>{
  await open(page);await page.evaluate(()=>playReader());await expect.poll(()=>page.evaluate(()=>__voiceNav.native.length)).toBe(1);
  await command(page,'pause');await command(page,'ASV Romans 8:28');expect(await page.evaluate(()=>BibleSpeech.getState())).toBe('paused');expect(await page.evaluate(()=>__voiceNav.native.length)).toBe(1);
  await command(page,'resume');await expect.poll(()=>page.evaluate(()=>__voiceNav.native.length)).toBe(2);expect(await page.evaluate(()=>__voiceNav.native[1].text)).toBe('Romans chapter 8. '+await page.evaluate(()=>BibleData.getVerse('asv','romans',8,28).text));
});

test('unavailable and empty verses never select an edition or skip to a different coordinate',async({page})=>{
  await open(page);const before=await position(page);
  await page.evaluate(()=>{const get=BibleData.getVerse;BibleData.getVerse=function(id,b,c,v){const verse=get(id,b,c,v);return id==='asv' && b==='john' && c===3 && v===16?{...verse,text:'  '}:verse;};});
  await command(page,'ASV John 3:16');expect(await position(page)).toEqual(before);
  await page.evaluate(()=>{const ensure=BibleTranslationLoader.ensure;BibleTranslationLoader.ensure=id=>id==='dra'?Promise.resolve(false):ensure(id);});
  await command(page,'DRA John 1:1');expect(await position(page)).toEqual(before);await expect(page.locator('#voiceStatusTop')).toContainText('unavailable');
});

for(const newer of ['stop','WEB John 3:16','manual'])test(`delayed translation cannot override ${newer}`,async({page})=>{
  await open(page);await page.evaluate(()=>{const ensure=BibleTranslationLoader.ensure;window.__releaseVoice=null;BibleTranslationLoader.ensure=id=>id==='asv'?new Promise(resolve=>window.__releaseVoice=()=>ensure(id).then(resolve)):ensure(id);});
  await command(page,'ASV Romans 8:28',false);await expect.poll(()=>page.evaluate(()=>typeof window.__releaseVoice)).toBe('function');
  if(newer==='manual')await page.evaluate(()=>navigateReaderToPassage('matthew',2,3));else await command(page,newer,false);
  const before=await position(page);await page.evaluate(()=>window.__releaseVoice());await page.evaluate(()=>voiceNavigationTask);expect(await position(page)).toEqual(before);expect(await page.evaluate(()=>__voiceNav.native.length)).toBe(0);
});

test('warm offline translations use existing loaders and keep Saved Verses unchanged',async({page,context})=>{
  await open(page);await page.evaluate(async()=>{await BibleTranslationLoader.ensure('asv');toggleFav('John 1:1',BibleData.getVerse('web','john',1,1).text,null,{translationId:'web',bookId:'john',chapter:1,verse:1});});
  const saved=(await position(page)).saved;await context.setOffline(true);await command(page,'ASV Romans 8:28');expect(await position(page)).toMatchObject({id:'asv',book:'romans',chapter:8,verse:28,saved});
});

for(const outcome of ['complete','fail'])test(`late picker-module ${outcome} cannot override manual navigation`,async({page})=>{
  await open(page);await page.evaluate(async()=>{
    await BibleTranslationLoader.ensure('asv');
    ReaderTranslationLoader.ensure=()=>new Promise((resolve,reject)=>{window.__releasePicker=resolve;window.__rejectPicker=()=>reject(new Error('controlled picker failure'));});
  });
  await command(page,'ASV Romans 8:28',false);await expect.poll(()=>page.evaluate(()=>typeof __releasePicker)).toBe('function');
  await page.evaluate(()=>navigateReaderToPassage('matthew',2,3));const before=await position(page);
  await page.evaluate(outcome=>{if(outcome==='fail')__rejectPicker();else __releasePicker();},outcome);await page.evaluate(()=>voiceNavigationTask);
  expect(await position(page)).toEqual(before);expect(await page.evaluate(()=>__voiceNav.native.length)).toBe(0);
  await expect(page.locator('#readerTranslationStatus')).not.toContainText('unavailable');
});

test('a new Android command turn cancels a delayed destination before any new transcript',async({page})=>{
  await open(page);await page.evaluate(()=>{const ensure=BibleTranslationLoader.ensure;BibleTranslationLoader.ensure=id=>id==='asv'?new Promise(resolve=>window.__releaseVoice=()=>ensure(id).then(resolve)):ensure(id);});
  await command(page,'ASV Romans 8:28',false);const before=await position(page);
  await page.locator('[data-voice-command-button]').tap();await page.evaluate(()=>__releaseVoice());await page.evaluate(()=>voiceNavigationTask);
  expect(await position(page)).toEqual(before);expect(await page.evaluate(()=>__voiceNav.native.length)).toBe(0);
  await page.evaluate(()=>__voiceNav.recognizers.at(-1).emit('John 3:16'));expect(await position(page)).toMatchObject({id:'web',book:'john',chapter:3,verse:16});
});

const shortTranslations=[
  ['web','World','World English'],['asv','American','American Standard'],['kjv','King','King James'],
  ['ylt','Youngs','Youngs Literal'],['dby','Darby','Darby Translation'],['webster','Webster','Webster Bible'],
  ['rv','Revised','Revised Version'],['gnv','Geneva','Geneva Bible'],['dra','Douay','Douay Rheims']
];
for(const [id,first,two] of shortTranslations)test(`${id}: short catalog names and natural Bible/Version/Translation commands use the existing selector`,async({page})=>{
  await open(page);await page.evaluate(()=>navigateReaderToPassage('john',1,2));
  for(const transcript of [first,two,'Switch to '+first+' Bible','Change to '+two+' Version','Use '+two+' Translation']){
    await command(page,transcript);expect(await position(page)).toMatchObject({id,book:'john',chapter:1,verse:2,stored:id});
    await expect(page.locator('#readerTranslation')).toHaveValue(id);
  }
});

test('Catholic spoken names, punctuation and deterministic Android transcript variants accept one final command',async({page})=>{
  await open(page);
  for(const transcript of ['DRA','Douay','Douay Rheims','Douay-Rheims','Douay Rheims Catholic','Douay Rheims Bible','Douay Rheims Catholic Bible','Catholic','Catholic Bible','Switch to Catholic Bible','Douay - Rheims Catholic','Douay–Rheims Catholic','DOUAY—RHEIMS CATHOLIC!','Douay‑Rheims Catholic','Douay/Reims Catholic','Dewey Reams Catholic','ＤＲＡ']){
    await command(page,transcript+', Tobit chapter 1 verse 2');expect(await position(page)).toMatchObject({id:'dra',book:'tobit',chapter:1,verse:2});
    expect(await page.evaluate(()=>__voiceNav.recognizers.filter(r=>r.active).length)).toBe(0);
  }
});

test('ambiguous short catalog name is announced without changing passage; a longer title disambiguates',async({page})=>{
  await open(page);await page.evaluate(()=>{const list=BibleData.listTranslations;BibleData.listTranslations=()=>list().map(t=>t.id==='rv'?{...t,name:'World Revised Version'}:t).reverse();});
  const before=await position(page);await command(page,'Switch to World Bible');expect(await position(page)).toEqual(before);
  await expect(page.locator('#voiceStatusTop')).toHaveText('Ambiguous translation name. Say its full title or abbreviation.');
  await expect(page.locator('#voiceStatusTop')).toHaveAttribute('aria-live','polite');
  await command(page,'World Revised, John 1:2');expect(await position(page)).toMatchObject({id:'rv',book:'john',chapter:1,verse:2});
});

test('generic, lookalike and unsupported translation titles never silently change the Bible',async({page})=>{
  await open(page);await page.evaluate(()=>navigateReaderToPassage('john',1,2));const before=await position(page);
  for(const transcript of ['Switch to English Bible','Bible','Switch to Catholicism','Switch to Worldly','Revised Standard Version','Catholic and WEB','Switch to NIV']){
    await command(page,transcript);expect(await position(page)).toEqual(before);await expect(page.locator('#voiceStatusTop')).toHaveText(/Ambiguous|not available|not found/);
  }
});

for(const cloud of [false,true])test(`${cloud?'cloud':'native'}: Read Geneva and Catholic short-name navigation preserve narration and microphone isolation`,async({page})=>{
  await open(page,cloud);await command(page,'Read Geneva');
  await expect.poll(()=>page.evaluate(()=>BibleSpeech.getState())).toBe('playing');
  await command(page,'Douay Rheims Catholic Bible, Tobit chapter 1 verse 2');
  await expect.poll(()=>page.evaluate(()=>BibleSpeech.getState())).toBe('playing');
  const spoken=await page.evaluate(cloud=>cloud?__voiceNav.requests.map(r=>r.text):__voiceNav.native.map(u=>u.text),cloud);
  expect(spoken).toHaveLength(2);
  const passage=await page.evaluate(()=>BibleData.getVerse('dra','tobit',1,2).text);
  expect(spoken[1]).toContain(passage);expect(spoken[1]).toMatch(/chapter 1\./);expect(spoken[1]).not.toMatch(/verse 2/i);
  await command(page,'pause');expect(await page.evaluate(()=>BibleSpeech.getState())).toBe('paused');
  await command(page,'resume');expect(await page.evaluate(()=>BibleSpeech.getState())).toBe('playing');
  await command(page,'stop');expect(await page.evaluate(()=>BibleSpeech.getState())).toBe('idle');
});

test('new natural aliases work offline with retained Catholic and Protestant downloads and Saved Verses',async({page,context})=>{
  await open(page);await page.evaluate(async()=>{
    await BibleTranslationLoader.ensure('dra');await BibleTranslationLoader.ensure('asv');
    toggleFav('John 1:1',BibleData.getVerse('web','john',1,1).text,null,{translationId:'web',bookId:'john',chapter:1,verse:1});
  });
  const saved=(await position(page)).saved;await context.setOffline(true);
  await command(page,'Catholic Bible, Tobit chapter 1 verse 2');expect(await position(page)).toMatchObject({id:'dra',book:'tobit',chapter:1,verse:2,saved});
  await command(page,'Change to American Standard, John 1:16');expect(await position(page)).toMatchObject({id:'asv',book:'john',chapter:1,verse:16,saved});
});


const debugField=(page,name)=>page.locator('[data-voice-debug="'+name+'"]');

test('diagnostics: default-off emits no transcript to page, console, network or storage',async({page})=>{
  const requests=[],consoleText=[];page.on('request',r=>requests.push(r.url()+' '+(r.postData()||'')));page.on('console',m=>consoleText.push(m.text()));
  await open(page);await expect(page.locator('#readerVoiceDebug')).toHaveCount(0);
  const storage=()=>page.evaluate(()=>JSON.stringify({local:{...localStorage},session:{...sessionStorage}}));const before=await storage();
  const raw='private transcript sentinel 482729';await command(page,raw);
  await expect(page.locator('body')).not.toContainText(raw);expect(await storage()).toBe(before);
  expect(requests.join(' ')).not.toContain(raw);expect(consoleText.join(' ')).not.toContain(raw);
  expect(await page.evaluate(()=>__voiceNav.recognizers.at(-1).maxAlternatives)).toBe(1);
});

for(const [raw,id] of [['Douay Rheims','dra'],['Douay Rheims Catholic','dra'],['Douay-Rheims Bible','dra'],['Catholic Bible','dra'],['Catholic','dra'],['DRA','dra'],['American Standard','asv'],['Geneva Bible','gnv']])test('diagnostics: physical report literal transcript '+raw+' reaches handler and switches from WEB',async({page})=>{
  await open(page,false,true);await page.evaluate(()=>navigateReaderToPassage('john',1,2));
  await expect(page.locator('#readerVoiceDebug')).toContainText('voice-trace-1');await command(page,raw);
  expect(await position(page)).toMatchObject({id,book:'john',chapter:1,verse:2,stored:id});
  await expect(debugField(page,'raw')).toHaveText(JSON.stringify(raw));
  await expect(debugField(page,'normalized')).toHaveText(JSON.stringify(await page.evaluate(t=>normalizeSpokenNavigation(t),raw)));
  await expect(debugField(page,'decision')).toContainText('Exact final reached handler.');
  await expect(debugField(page,'decision')).toContainText('"translationId":"'+id+'"');
  await expect(debugField(page,'outcome')).toContainText('Selected: '+id+' / john 1:2');
  expect(await page.evaluate(()=>__voiceNav.recognizers.at(-1).maxAlternatives)).toBe(3);
});

for(const raw of ['Douay Rheims','Douay Rheims Catholic','Douay-Rheims Bible'])test('diagnostics: literal compound '+raw+' validates and selects Catholic Tobit',async({page})=>{
  await open(page,false,true);await command(page,raw+', Tobit chapter 1 verse 2');
  expect(await position(page)).toMatchObject({id:'dra',book:'tobit',chapter:1,verse:2});
  await expect(debugField(page,'raw')).toHaveText(JSON.stringify(raw+', Tobit chapter 1 verse 2'));
  await expect(debugField(page,'decision')).toContainText('"bookId":"tobit"');
});

test('diagnostics: unsupported synthetic transcript is displayed exactly; supported alternatives never silently select DRA',async({page})=>{
  await open(page,false,true);const before=await position(page);
  // Hypothesis fixture, NOT a claimed physical Android transcript.
  const raw='  Dooay Rames, Catholic!  ';await command(page,raw,true,['Douay Rheims Catholic','DRA','Catholic Bible']);
  expect(await position(page)).toEqual(before);await expect(debugField(page,'raw')).toHaveText(JSON.stringify(raw));
  await expect(debugField(page,'normalized')).toHaveText('"dooay rames catholic"');
  await expect(debugField(page,'alternatives')).toHaveText('1: '+JSON.stringify(raw)+'\n2: "Douay Rheims Catholic"\n3: "DRA"');
  await expect(debugField(page,'decision')).toContainText('No translation/reference match.');
  await expect(debugField(page,'outcome')).toContainText('Command not recognized.');
});

test('diagnostics: accepted final, microphone release, dispatch and selection are separate observable stages',async({page})=>{
  await open(page,false,true);await page.evaluate(()=>__voiceNav.autoEnd=false);
  await page.locator('[data-voice-command-button]').tap();await page.evaluate(()=>__voiceNav.recognizers.at(-1).emit('Douay Rheims Catholic'));
  await expect(page.locator('[data-voice-command-button]')).toHaveAttribute('aria-busy','true');
  await expect(debugField(page,'raw')).toHaveText('"Douay Rheims Catholic"');
  await expect(debugField(page,'decision')).toHaveText('—');
  await expect(debugField(page,'outcome')).toContainText('Closing microphone');
  expect((await position(page)).id).toBe('web');
  await page.evaluate(()=>__voiceNav.recognizers.at(-1).end());await page.evaluate(()=>voiceNavigationTask);
  await expect(debugField(page,'decision')).toContainText('Exact final reached handler.');expect((await position(page)).id).toBe('dra');
});

test('diagnostics: exact punctuation is inert text and is never sent or persisted',async({page})=>{
  const requests=[],consoleText=[];page.on('request',r=>requests.push(r.url()+' '+(r.postData()||'')));page.on('console',m=>consoleText.push(m.text()));
  await open(page,false,true);const before=await page.evaluate(()=>JSON.stringify({local:{...localStorage},session:{...sessionStorage}}));
  const raw='<img src=x onerror="window.voiceDiagnosticInjected=true"> Dooay—Rames?';await command(page,raw);
  await expect(debugField(page,'raw')).toHaveText(JSON.stringify(raw));expect(await page.evaluate(()=>window.voiceDiagnosticInjected)).toBeUndefined();
  await expect(page.locator('#readerVoiceDebug img')).toHaveCount(0);expect(await page.evaluate(()=>JSON.stringify({local:{...localStorage},session:{...sessionStorage}}))).toBe(before);
  expect(requests.join(' ')).not.toContain(raw);expect(consoleText.join(' ')).not.toContain(raw);
  expect(page.url()).not.toContain(encodeURIComponent(raw));
});

test('diagnostics: expiry, next command, visibility, pagehide and reload clear transient text',async({page})=>{
  await open(page,false,true);await command(page,'Dooay Rames');
  await page.locator('[data-voice-command-button]').tap();await expect(debugField(page,'raw')).toHaveText('—');
  await page.evaluate(()=>__voiceNav.recognizers.at(-1).emit('Dooay Rames'));await page.evaluate(()=>voiceNavigationTask);
  await page.evaluate(()=>{Object.defineProperty(document,'hidden',{configurable:true,value:true});document.dispatchEvent(new Event('visibilitychange'));delete document.hidden;});
  await expect(debugField(page,'raw')).toHaveText('—');
  await command(page,'Dooay Rames');await page.evaluate(()=>dispatchEvent(new PageTransitionEvent('pagehide')));await expect(debugField(page,'raw')).toHaveText('—');
  await page.clock.install();await page.evaluate(()=>{toggleVoiceCommands();__voiceNav.recognizers.at(-1).emit('Dooay Rames');});
  await expect(debugField(page,'raw')).toHaveText('"Dooay Rames"');await page.clock.fastForward(60001);
  for(const field of ['raw','alternatives','normalized','decision','outcome'])await expect(debugField(page,field)).toHaveText('—');
  await page.reload();await page.evaluate(()=>initializeBibleExperience());await expect(page.locator('#readerVoiceDebug')).toBeVisible();await expect(debugField(page,'raw')).toHaveText('—');
});

for(const [width,dark] of [[320,false],[360,true],[390,false],[430,true]])test(`diagnostics: ${width}px dark=${dark} wraps long text and clear/disable support keyboard focus`,async({page})=>{
  await open(page,false,true);await page.setViewportSize({width,height:844});if(dark)await page.evaluate(()=>document.querySelector('[data-theme-toggle]').click());await expect(page.locator('html')).toHaveAttribute('data-theme',dark?'dark':'light');
  await command(page,'Dooay '+'.'.repeat(500)+' Rames');
  await expect(page.getByRole('region',{name:'Local Voice Commands diagnostics'})).toBeVisible();
  expect(await page.locator('#readerVoiceDebug').evaluate(e=>e.scrollWidth<=e.clientWidth && document.documentElement.scrollWidth<=innerWidth)).toBe(true);
  const clear=page.getByRole('button',{name:'Clear diagnostic text',exact:true});expect(await clear.evaluate(e=>e.getBoundingClientRect().height)).toBeGreaterThanOrEqual(44);
  await clear.focus();await page.keyboard.press('Enter');await expect(debugField(page,'raw')).toHaveText('—');await expect(clear).toBeFocused();
  const close=page.getByRole('button',{name:'Disable diagnostics',exact:true});await close.focus();await page.keyboard.press('Enter');
  await expect(page.locator('#readerVoiceDebug')).toHaveCount(0);await expect(page.locator('[data-voice-command-button]')).toBeFocused();expect(new URL(page.url()).hash).toBe('');
  await command(page,'Dooay Rames');expect(await page.evaluate(()=>__voiceNav.recognizers.at(-1).maxAlternatives)).toBe(1);await expect(page.locator('body')).not.toContainText('Dooay Rames');
});

for(const cloud of [false,true])test(`diagnostics: ${cloud?'cloud':'native'} compound narration still waits for release and preserves playing state`,async({page})=>{
  await open(page,cloud,true);await page.evaluate(()=>playReader());
  await expect.poll(()=>page.evaluate(()=>BibleSpeech.getState())).toBe('playing');
  await command(page,'Douay Rheims Catholic, Tobit chapter 1 verse 2');
  await expect.poll(()=>page.evaluate(()=>BibleSpeech.getState())).toBe('playing');expect(await position(page)).toMatchObject({id:'dra',book:'tobit',chapter:1,verse:2});
  await expect(debugField(page,'decision')).toContainText('"translationId":"dra"');await expect(debugField(page,'outcome')).toContainText('Selected: dra / tobit 1:2');
  const old=await page.evaluate(()=>__voiceNav.recognizers.length);await command(page,'pause');
  await page.evaluate(()=>__voiceNav.recognizers.at(-2).emit('stop'));expect(await page.evaluate(()=>__voiceNav.recognizers.length)).toBe(old+1);
  await expect(debugField(page,'raw')).toHaveText('"pause"');expect(await page.evaluate(()=>BibleSpeech.getState())).toBe('paused');
});


test('diagnostics: a broken optional trace hook cannot interrupt normal microphone, selection or narration',async({page})=>{
  await open(page);await page.evaluate(()=>{window.ReaderVoiceDiagnostics={start(){throw Error('controlled diagnostic failure');},final(){throw Error('controlled diagnostic failure');},dispatch(){throw Error('controlled diagnostic failure');},status(){throw Error('controlled diagnostic failure');}};});
  await command(page,'Douay Rheims Catholic, Tobit chapter 1 verse 2');expect(await position(page)).toMatchObject({id:'dra',book:'tobit',chapter:1,verse:2});
  await command(page,'play');await expect.poll(()=>page.evaluate(()=>BibleSpeech.getState())).toBe('playing');await command(page,'stop');expect(await page.evaluate(()=>BibleSpeech.getState())).toBe('idle');
});


test('diagnostics: delayed final/release callbacks cannot repopulate cleared or hidden transcript fields',async({page})=>{
  await open(page,false,true);await page.evaluate(()=>__voiceNav.autoEnd=false);
  await page.locator('[data-voice-command-button]').tap();await page.evaluate(()=>__voiceNav.recognizers.at(-1).emit('Dooay Rames'));
  await expect(debugField(page,'raw')).toHaveText('"Dooay Rames"');
  await page.getByRole('button',{name:'Clear diagnostic text',exact:true}).click();
  await page.evaluate(()=>__voiceNav.recognizers.at(-1).end());
  for(const field of ['raw','alternatives','normalized','decision','outcome'])await expect(debugField(page,field)).toHaveText('—');
  await page.locator('[data-voice-command-button]').tap();
  await page.evaluate(()=>{Object.defineProperty(document,'hidden',{configurable:true,value:true});document.dispatchEvent(new Event('visibilitychange'));__voiceNav.recognizers.at(-1).emit('Dooay Rames hidden');__voiceNav.recognizers.at(-1).end();delete document.hidden;});
  for(const field of ['raw','alternatives','normalized','decision','outcome'])await expect(debugField(page,field)).toHaveText('—');
  await page.evaluate(()=>__voiceNav.autoEnd=true);await command(page,'Catholic Bible, John 1:2');await expect(debugField(page,'raw')).toHaveText('"Catholic Bible, John 1:2"');expect((await position(page)).id).toBe('dra');
});
