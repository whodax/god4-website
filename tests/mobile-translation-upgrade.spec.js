const {test,expect}=require('@playwright/test');
const fs=require('node:fs');
const path=require('node:path');
const http=require('node:http');
const crypto=require('node:crypto');
const vm=require('node:vm');
const {execFileSync}=require('node:child_process');
const generator=require('../tools/generate-translation-manifest');

const root=path.resolve(__dirname,'..');
const production56='8b7c2b3f8c22b0952c41c00ac57ee4de697ea555';
const narrationPins={"/js/bible/speech.js":"6b721970892177023f7ec47af75146a1c28eca31cc8bc065ec50153c1885718c","/js/bible/reader.js":"9208083097e0c33a1dbb80831c27c6edce4bb0be25f5e8513047ea2f7d691f78","/css/companion.css":"4688d3468d9256f49876a444a2d0cd8498132e7f78541334ad1588d21301582e","/js/bible/translation-picker.js":"d07ceface0ae23f66e2d2ceddbb2764e98c6d18eca8bb93ab74eeeb05b01f921"};
const production59='be5c59b04700182f5c636007e45e2137445619aa';
// Shell 60 release candidate, squash-merged with the same files in PR #124.
const production60='93bc6884e2c6143520cde52555c38738708a91e0';
const shell60HomepagePin='f065b0cb9384677859acc32548fc80f4818e4c13c9a3ccde978c773bd80d4aba';
const production61='f693f0997a110dcd6554764eb94b9b76086b3bdb';
const production62='e27b928fd56249a54c08ca1484ed2dfde9d7b1ef';
const production63='94052c125c089e2835fbbebcf787589af93c421e';
const production64='6c8c84129e8af46bd55558610efbc06138f8a2e0';
const preview65='8587b271719608666adbf68889317cf86b4031e3';
const preview66='6ac00a3415fe4c19d4e524c643f0ae29e3b11a9b';
const preview67='36a83c644db7a510f634d692866968a431837a78';
const preview68='7014c91849364dae244b89b44dd0a515fa1c98d1';
const preview69='885831216ca3e85bf5426ec5940e1a9105a3afd4';
const preview70='558845a0d9f12a61d8911b4db47cb363a4ad281e';
const currentVersion=85;
const production55='90a13c28afc64526bf27b6c2bb7021dd516d6493';
const discoveryAssets=["/js/home-discovery.js","/js/home-discovery-catalog.json"];
const discoveryPins={"/":"0dbb79fc2df882e469eb86e752cf7953e85078aa60e615362603597b5596fd15","/js/app.js":"498e0a2f3ce4b5c735d4ba3ea43bfb6a70709181849c7627067c339d4b31eab2","/js/home-discovery.js":"d123dff0bc63e160beb2f512dcb05341931abb0241233eebd77d864cb460eee3","/js/home-discovery-catalog.json":"5bb67690dbf8e1ff44af50617d0d9f30ae30aa5e78f95bdd024952c632b4555a","/css/components.css":"401ba5d477482de2fd3647da880bd9a266fc3f7dc4d134f93f9eae95e3ccca95"};
const production54='22a503480e2fb1c8d7f873f2092e5ca9b9d8c340';
const production52='ca0d623f87d9f85a9cb4c515acbb5ea69796ff15';
const normalizeSource=body=>body.toString('utf8').replace(/\r\n/g,'\n');
const fileFor=url=>url==='/'?'index.html':url==='/offline'?'offline.html':new URL(url,'http://localhost').pathname.slice(1);
const workerSource=fs.readFileSync(path.join(root,'sw.js'),'utf8');
const requiredAssets=vm.runInNewContext(workerSource.match(/const SHELL_ASSETS = (\[[\s\S]*?\]);/)[1],{HOME_URL:'/',OFFLINE_URL:'/offline'});
const requiredHashes=Object.fromEntries(requiredAssets.map(url=>{
  const pathname=new URL(url,'http://localhost').pathname;
  const file=pathname==='/'?'index.html':pathname==='/offline'?'offline.html':pathname.slice(1);
  return [url,crypto.createHash('sha256').update(fs.readFileSync(path.join(root,file))).digest('hex')];
}));
for(const previous of [
  {version:43,commit:'a051890a7d04aac53b937e62d909e284b0101f4d',assets:46},
  {version:44,commit:'301b36f3b2bed4fdac5eadf5bde231a42b0c454b',assets:47},
  {version:45,commit:'51d2e4185fdc8f6294cb68ce65b88f0357be750e',assets:47},
  {version:46,commit:'cc5246704b366fe881b3d7393723810d22db308a',assets:47},
  {version:47,commit:'42e9cdaa3dbaef221b05760173c0f7237ddc4d7d',assets:47},
  {version:48,commit:'33cb61666b788e6573ebce721fc32a641ae3b474',assets:49},
  {version:49,commit:'782dfdce88c64b079b92da35f3fb477b8e0b7ccf',assets:49},
  {version:50,commit:'f0b533da999023246dbc7d79251c23e136fa10ab',assets:49},
  {version:51,commit:'7ef31a3bc64124ef185b8b3b43436f6f89347015',assets:49},
  {version:52,commit:production52,assets:49},
  {version:53,commit:'5e98b32eddfeaeac6f90beb3a247044b2d610127',assets:49},
  {version:54,commit:production54,assets:49},
  {version:55,commit:production55,assets:50},
  {version:56,commit:production56,assets:52},
  {version:58,commit:'fbc93cb582864b4827e9c5800eb06ce3e5d1c069',assets:52},
  {version:59,commit:production59,assets:52},
  {version:60,commit:production60,assets:52},
  {version:61,commit:production61,assets:52},
  {version:62,commit:production62,assets:52},
  {version:63,commit:production63,assets:52},
  {version:64,commit:production64,assets:52},
  {version:65,commit:preview65,assets:52},
  {version:66,commit:preview66,assets:52},
  {version:67,commit:preview67,assets:52},
  {version:68,commit:preview68,assets:52},
  {version:69,commit:preview69,assets:52},
  {version:70,commit:preview70,assets:52},
  {version:71,commit:'33768054b1e7069c21b3d61d4490953ae49045d3',assets:52},
  {version:72,commit:'8260ae6eb38aefd1376213b95cd0824ac8b6589a',assets:52},
  {version:73,commit:'d660b2cb36300ff4a4c6e4e6d04f9a21c573f7e8',assets:52},
  {version:74,commit:'2a763101b9a8405c2c27f3a760f855ac3854c438',assets:52},
  {version:75,commit:'08ae6aeded6182ca140165c8f17fd0a35d317e0b',assets:52},
  {version:76,commit:'e6e319836ddcdb904d8d3da4c3072f6a120e1d60',assets:52},
  {version:77,commit:'2e82e2c59bedb1398c566bdc7f62d8d6e31bd6c2',assets:52},
  {version:78,commit:'eea5c23eede2afb9495f18334b78c66815506db9',assets:52},
  {version:79,commit:'ea6902a18f4f4f65e3a434b84f516484a51dfef1',assets:52},
  {version:80,commit:'82042e8cc29875d3d69aeea241c1a131368ec15b',assets:52},
  {version:81,commit:'13d94205e959d332645ba7f4cb2a4b7d3da9ea2a',assets:52},
  {version:82,commit:'cce89e56de5fe07b40207928128e3d735f41ef1d',assets:52},
  {version:83,commit:'99d5deb81ce7ddac555f61a5d0a8f87923e3988f',assets:52},
  {version:84,commit:'748defc3fa1628dd79575ff3ca492a6a0836f8b0',assets:52}
])test.describe(`installed cache ${previous.version}`,()=>{
const baseline=previous.commit;
const oldCache='god4-shell-compact-reader-'+previous.version,newCache='god4-shell-compact-reader-'+currentVersion;
const runtimePath='/js/bible/translation-picker.js';
const alignmentPath='/js/word-study/alignment.js';
const dictionaryPath='/js/word-study/dictionary-provider.js';
const lexiconProviderPath='/js/word-study/original-language-provider.js';
const manifestPath='/js/bible/translation-manifest.js';
const assetPaths=['/','/css/layout.css',manifestPath,'/js/bible/cloud-tts.js','/js/storage/user-data.js','/css/components.css','/css/companion.css','/js/bible/reader.js','/js/bible/scripture-picker.js','/js/bible/compare.js','/js/word-study/controller.js',lexiconProviderPath,dictionaryPath,'/js/app.js','/js/bible/speech.js',...(previous.version>=44?[runtimePath]:[]),...(previous.version>=48?[alignmentPath]:[])];
const themePaths=['/css/theme.css','/js/theme.js'];
const warmedWordStudy=['/data/word-study/alignment/web/index.json',
  '/data/word-study/alignment/web/numbers/32.json','/data/word-study/original-language/numbers/32.json'];
const digest=body=>crypto.createHash('sha256').update(body).digest('hex');
let prior,current,oldHashes,newHashes,themeHashes,runtimeHashes;
test.beforeAll(()=>{
  const oldWorker=execFileSync('git',['show',baseline+':sw.js'],{cwd:root});
  const oldAssets=vm.runInNewContext(oldWorker.toString().match(/const SHELL_ASSETS = (\[[\s\S]*?\]);/)[1],{HOME_URL:'/',OFFLINE_URL:'/offline'});
  // Hydrate only selected historical fixtures; every response remains a Git blob.
  prior=Object.fromEntries([...new Set(['/sw.js',...oldAssets,...assetPaths,...(previous.version>=78?warmedWordStudy:[])])].map(url=>[new URL(url,'http://localhost').pathname,execFileSync('git',['show',baseline+':'+fileFor(url)],{cwd:root})]));
  current=Object.fromEntries(assetPaths.map(url=>[url,fs.readFileSync(path.join(root,fileFor(url)))]));
  oldHashes=Object.fromEntries(assetPaths.map(url=>[url,digest(prior[url])]));
  newHashes=Object.fromEntries(assetPaths.map(url=>[url,digest(current[url])]));
  themeHashes=Object.fromEntries(themePaths.map(url=>[url,digest(fs.readFileSync(path.join(root,url.slice(1))))]));
  runtimeHashes={[runtimePath]:digest(fs.readFileSync(path.join(root,runtimePath.slice(1))))};
});
const saved=[{ref:'John 1:1',text:'Installed-user saved verse',location:{translationId:'dra',bookId:'john',chapter:1,verse:1}}];

test.use({viewport:{width:320,height:844},hasTouch:true,serviceWorkers:'allow'});
if(previous.version>=52)test.use({userAgent:'Mozilla/5.0 (Linux; Android 14; Pixel 7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/130.0.0.0 Mobile Safari/537.36'});

test('shell 85 preserves activation, Bible caches and the exact required assets',()=>{
  const worker=fs.readFileSync(path.join(root,'sw.js'),'utf8');
  let normalized=worker.replace(/\r\n/g,'\n').replace("'compact-reader-85'","'compact-reader-"+previous.version+"'");
  normalized=normalized.replaceAll('|extensions','');
  if(previous.version<84) normalized=normalized.replaceAll('editions|corpus|kjv-scrivener','editions');
  if(previous.version<83) normalized=normalized.replaceAll('web|kjv-tr|editions','web|kjv-tr').replaceAll('web|kjv|kjv-tr|editions','web|kjv|kjv-tr');
  if(previous.version>=78&&previous.version<82) normalized=normalized
    .replace("!/\\/alignment\\/(?:web|kjv-tr)\\/index\\.json$/.test(key.url)","!key.url.endsWith('/alignment/web/index.json')")
    .replace('(?:web|kjv-tr)\\/index|(?:web|kjv|kjv-tr)\\/','web\\/index|(?:web|kjv)\\/');
  if(previous.version<78)normalized=normalized.replace(/\/\/ Word Study runtime cache begins[\s\S]*?\/\/ Word Study runtime cache ends\n\n/,'')
    .replace(/  \/\/ Word Study runtime route begins[\s\S]*?  \/\/ Word Study runtime route ends\n/,'');
  if(previous.version<56)for(const asset of discoveryAssets)normalized=normalized.replace("  '"+asset+"',\n",'');
  if(previous.version<55)normalized=normalized.replace("  '/js/home-commandments.js',\n",'');
  if(previous.version<48)normalized=normalized.replace("  '/css/theme.css',\n",'').replace("  '/js/theme.js',\n",'');
  if(previous.version===43)normalized=normalized.replace("  '/js/bible/translation-picker.js',\n",'');
  expect(normalized).toBe(prior['/sw.js'].toString('utf8').replace(/\r\n/g,'\n'));
  expect(requiredAssets).toHaveLength(52);
  if(previous.version>=59){
    expect(digest(Buffer.from(normalizeSource(prior['/'])))).toBe(previous.version>=71?'2b4f020a910a66406fa04cdfd3d8abe6200068b599107d3e33de7d0d61e396e6':previous.version>=63?'a3c12993dd0d0279848f14d4fc804a33acd34089d8c2c0566bb6516728f31dd8':previous.version===62?'1ae164e488bf338ec053fbe5ba68739d73a84cacaefa9eaacc0fef27571ef513':previous.version===61?'0c7b055a36695e6d0ed35907953805fe08a41698caf99055014797161818ce4d':previous.version===60?shell60HomepagePin:discoveryPins['/']);
  }
  const scrollbarPins={"/js/app.js":"764688812f36e40830cdb94e183e11dc71935ea4538c25274f9848dd4b8ded61","/js/bible/reader.js":"24c39f8519381f20d4306caeca2510af739a0bfeb6e368e2bd4799d0b01049e1","/js/bible/translation-picker.js":"e7b10c7dade2c728d87c05c24b78b7360783b85bc62591d117bd675940a69f9a","/css/companion.css":"e1a898e7b50992871185c18351833b361fed8ba50af1f9d049b953f737ddfe52","/":"a3c12993dd0d0279848f14d4fc804a33acd34089d8c2c0566bb6516728f31dd8"};
  // Pin only the changed and added assets against the production Shell 54 baseline.
  const homepageAssets={"/":"4fbdc1c0ef304fa50dad52b62542db19738e7541b69f2915c5c074762baca31c","/css/layout.css":"3580a30382bd0a452edaeea54fb1c33fb0309e24648deb025274c87442103fae","/js/app.js":"f1f4035a743d60fcebd93693372854cc74ef1c235c0e3ab5fd85ed65b21e09df","/js/home-commandments.js":"1e389624a305ee3fec1dbb97dc52dccce758117501bd8723b8f9a23dd8f385ad"};
  const wordStudyPins={
    '/js/word-study/loader.js':'fd9c157bcd771c2787581302febd4e26eb1dfb00f4bed401e433094643ef362e',
    '/js/word-study/provider.js':'7d66b02670df844217585cb57680dd41812555619a3e4851dcbd5122273fb3e8',
    '/':'2b4f020a910a66406fa04cdfd3d8abe6200068b599107d3e33de7d0d61e396e6',
    '/css/companion.css':'afe7794ac43078b655794831a0571918a0b96731ab3da5930c8204d9fdc4c986',
    [alignmentPath]:'93c91b4d031002e34f702cf6108ca8cf456bafa34675faa4dcf103d2b4f91480',
    [dictionaryPath]:'d2370962a5c5d5f8785fc0d9d4c9f717a639b5a4aa4646204ecc66f0470995ef',
    [lexiconProviderPath]:'26442c26186010cad9ea56aaecd624c09b016c9d6f41556d3e630ea4f02c150e',
    '/js/word-study/controller.js':'5cb7bec00de950d5f00d8cc94c5200cb333672277d5e561c88f3e2e127931a24'
  };
  for(const asset of requiredAssets){
    const body=fs.readFileSync(path.join(root,fileFor(asset)));
    if(wordStudyPins[asset])expect(digest(Buffer.from(normalizeSource(body))),asset).toBe(wordStudyPins[asset]);
    else if(scrollbarPins[asset])expect(digest(Buffer.from(normalizeSource(body))),asset).toBe(scrollbarPins[asset]);
    else if(narrationPins[asset])expect(digest(Buffer.from(normalizeSource(body))),asset).toBe(narrationPins[asset]);
    else if(discoveryPins[asset])expect(digest(Buffer.from(normalizeSource(body))),asset).toBe(discoveryPins[asset]);
    else if(homepageAssets[asset])expect(digest(Buffer.from(normalizeSource(body))),asset).toBe(homepageAssets[asset]);
    else expect(digest(/\.(?:png|woff2)$/.test(fileFor(asset))?body:Buffer.from(normalizeSource(body))),asset)
      .toBe(digest(/\.(?:png|woff2)$/.test(fileFor(asset))?prior54(asset):Buffer.from(normalizeSource(prior54(asset)))));
  }
  function prior54(asset){return execFileSync('git',['show',production54+':'+fileFor(asset)],{cwd:root});}
  for(const asset of previous.version>=80?[alignmentPath,"/js/word-study/controller.js"]:previous.version>=77?[alignmentPath]:previous.version>=75?[alignmentPath,'/js/word-study/controller.js']:previous.version===74?[alignmentPath,'/css/companion.css']:previous.version>=72?[lexiconProviderPath,'/js/word-study/controller.js']:previous.version===71?[alignmentPath]:previous.version===70?['/','/js/word-study/controller.js','/css/companion.css']:previous.version===69?[alignmentPath,dictionaryPath,'/js/word-study/controller.js','/css/companion.css']:previous.version===68?[alignmentPath,dictionaryPath,'/js/word-study/controller.js']:previous.version===67?['/js/word-study/controller.js']:previous.version>=65?[alignmentPath,dictionaryPath]:previous.version===64?Object.keys(wordStudyPins):previous.version===63?['/css/layout.css']:previous.version>=59?['/']:previous.version===58?['/','/css/components.css','/js/app.js']:previous.version===56?Object.keys(narrationPins):previous.version===55?['/','/js/app.js']:previous.version===54?['/','/css/layout.css','/js/app.js']:previous.version===53?['/','/css/components.css','/js/app.js','/css/companion.css','/js/bible/reader.js',runtimePath,'/js/bible/speech.js','/js/bible/compare.js','/js/word-study/controller.js']:['/','/css/companion.css','/js/bible/reader.js','/js/bible/speech.js','/js/bible/cloud-tts.js','/js/storage/user-data.js',...(previous.version>=44?[runtimePath]:[])]){
    expect(normalizeSource(current[asset]),asset+' must deliver the accepted release').not.toBe(normalizeSource(prior[asset]));
  }
  if(previous.version>=80) for(const asset of requiredAssets.filter(asset=>![alignmentPath,"/js/word-study/controller.js","/js/word-study/provider.js"].includes(asset))){
    expect(digest(Buffer.from(normalizeSource(fs.readFileSync(path.join(root,fileFor(asset)))))),asset)
      .toBe(digest(Buffer.from(normalizeSource(prior[new URL(asset,'http://localhost').pathname]))));
  }
  if(previous.version===53) for(const asset of requiredAssets.filter(url=>![...discoveryAssets,...Object.keys(wordStudyPins),'/','/css/layout.css','/js/home-commandments.js','/css/components.css','/js/app.js','/css/companion.css','/js/bible/reader.js',runtimePath,'/js/bible/speech.js','/js/bible/compare.js'].includes(url))){
    expect(normalizeSource(fs.readFileSync(path.join(root,fileFor(asset)))),asset+' stays unchanged from production 53').toBe(normalizeSource(prior[new URL(asset,'http://localhost').pathname]));
  }
  expect(normalizeSource(current[manifestPath])===normalizeSource(prior[manifestPath])).toBe(previous.version>=52);

});

async function fixture(){
  const state={version:previous.version,failAsset:null,interruptAsset:null,interruptions:0,bibleRequests:[]};
  const types={'.html':'text/html; charset=utf-8','.js':'application/javascript; charset=utf-8','.css':'text/css; charset=utf-8','.json':'application/json','.webmanifest':'application/manifest+json','.png':'image/png','.svg':'image/svg+xml','.woff2':'font/woff2'};
  const server=http.createServer((request,response)=>{
    const pathname=new URL(request.url,'http://localhost').pathname;
    if(/^\/js\/bible\/(web|asv|kjv|ylt|dby|webster|rv|gnv|dra)\.js$/.test(pathname))state.bibleRequests.push(pathname);
    const relative=pathname==='/'?'/index.html':pathname==='/offline'?'/offline.html':pathname;
    const file=path.resolve(root,'.'+relative);
    if(!file.startsWith(root+path.sep)){response.writeHead(403).end();return;}
    if(state.version===currentVersion&&pathname===state.failAsset){response.writeHead(503).end('Install failure fixture');return;}
    if(state.version===currentVersion&&pathname===state.interruptAsset){state.interruptions++;response.destroy();return;}
    try{
      let body=state.version===previous.version&&prior[pathname]?prior[pathname]:fs.readFileSync(file);
      if(/^\/js\/bible\/(web|asv|kjv|ylt|dby|webster|rv|gnv|dra)\.js$/.test(pathname))body=generator.canonicalDeployBytes(body);
      response.writeHead(200,{'content-type':types[path.extname(file)]||'application/octet-stream','cache-control':'no-store'});
      response.end(body);
    }catch(error){response.writeHead(404).end();}
  });
  await new Promise(resolve=>server.listen(0,'127.0.0.1',resolve));
  return {state,origin:'http://127.0.0.1:'+server.address().port,
    stop:async context=>{
      await Promise.all(context.pages().map(page=>page.goto('about:blank')));
      await new Promise(resolve=>{server.close(resolve);server.closeAllConnections();});
    }};
}
async function hashes(page,cacheName=null,urls=assetPaths){
  return page.evaluate(async({urls,cacheName})=>{
    const result={},cache=cacheName?await caches.open(cacheName):null;
    for(const url of urls){
      const response=cache?await cache.match(url):await fetch(url);
      if(!response)throw new Error('Missing shell asset: '+url);
      const bytes=await response.arrayBuffer();
      result[url]=Array.from(new Uint8Array(await crypto.subtle.digest('SHA-256',bytes)),byte=>byte.toString(16).padStart(2,'0')).join('');
    }
    return result;
  },{urls,cacheName});
}
async function installOld(page,origin){
  if(previous.version>=52)await page.addInitScript(()=>{
    window.__upgradeRecognition=[];
    Object.defineProperty(navigator,'permissions',{configurable:true,value:{query:async()=>({state:'prompt'})}});
    window.SpeechRecognition=class{
      constructor(){__upgradeRecognition.push(this);}start(){this.onstart?.();}
      abort(){queueMicrotask(()=>this.onend?.());}
      emit(text){this.onresult?.({resultIndex:0,results:[Object.assign([{transcript:text}],{isFinal:true})]});}
    };
  });
  await page.addInitScript(()=>{window.IntersectionObserver=class{observe(){}unobserve(){}disconnect(){}};});
  if(previous.version===45)await page.addInitScript(()=>{
    window.__upgradeSpeech=[];
    Object.defineProperty(window,'AudioContext',{configurable:true,value:undefined});
    Object.defineProperty(window,'webkitAudioContext',{configurable:true,value:undefined});
    Object.defineProperty(window,'SpeechSynthesisUtterance',{configurable:true,value:function(text){this.text=text;}});
    Object.defineProperty(window,'speechSynthesis',{configurable:true,value:{getVoices(){return [{name:'Microsoft David',lang:'en-US',localService:true}];},addEventListener(){},cancel(){},pause(){},resume(){},speak(utterance){window.__upgradeSpeech.push(utterance.text);utterance.onstart?.();}}});
  });
  await page.goto(origin);
  await page.evaluate(()=>navigator.serviceWorker.ready.then(()=>true));
  await page.reload();
  await expect.poll(()=>page.evaluate(()=>!!navigator.serviceWorker.controller)).toBe(true);
  await page.evaluate(async({entries,version})=>{
    await initializeBibleExperience();
    if(!(await BibleTranslationLoader.retain('web')).ok)throw new Error('WEB retention failed');
    await changeTranslation('dra');
    if(!(await BibleTranslationLoader.retain('dra')).ok)throw new Error('DRA retention failed');
    UserData.savedVerses.save(entries);
    if(version>=51){
      BibleSpeech.setSpeed(1.25);BibleSpeech.setVoice('female');
      UserData.plan.save([1,3]);
      UserData.journey.save({version:1,plans:[[1,3],[],[],[],[]],completedDates:['2026-01-01']});
      UserData.compare.save({count:3,selections:['web','dra','kjv',''],persisted:true});
      localStorage.setItem('god4.theme','dark');
      localStorage.setItem('god4.m116.upgrade-marker','preserve local user data');
    }
    const vendor=await fetch('/js/vendor/supabase-js-2.117.0.min.js');
    if(!vendor.ok)throw new Error('Vendor fixture unavailable');
    // Drain the warm-up fetch so its old-worker response stream is complete.
    await vendor.arrayBuffer();
  },{entries:saved,version:previous.version});
  if(previous.version===45)expect(await page.evaluate(async()=> (await BibleTranslationLoader.retain('kjv')).ok)).toBe(true);
  await expect(page.locator('#readerTranslation')).toHaveValue('dra');
  await expectOldPicker(page);
  expect(await hashes(page)).toEqual(oldHashes);
  const keys=await page.evaluate(async name=>(await(await caches.open(name)).keys()).map(request=>new URL(request.url).pathname+new URL(request.url).search).sort(),oldCache);
  expect(keys).toHaveLength(previous.assets);
  return keys;
}
async function expectOldPicker(page){
  if(previous.version>=44)await expectCurrentPicker(page);
  else await expect(page.locator('#readerTranslationTrigger')).toHaveCount(0);
}
async function expectCurrentPicker(page){
  if(await page.evaluate(()=>matchMedia('(max-width:620px)').matches))await expect(page.locator('#readerTranslationTrigger')).toBeVisible();
  else await expect(page.locator('#readerTranslation')).toBeVisible();
}
async function planPosition(page){
  await page.getByRole('button',{name:'Reader',exact:true}).click();
  await page.evaluate(()=>{
    const verse=document.querySelector('#readerContent [data-verse-number="45"]');
    window.scrollBy({top:verse.getBoundingClientRect().top-readerVisibleTop()-16,behavior:'instant'});
  });
  await page.getByRole('button',{name:'Plan',exact:true}).click();
  return page.evaluate(()=>{
    const heading=document.getElementById('planHeading').getBoundingClientRect();
    const day=document.querySelector('#planDays button').getBoundingClientRect();
    return {headingTop:heading.top,headingBottom:heading.bottom,dayBottom:day.bottom,top:readerVisibleTop(),height:innerHeight};
  });
}
async function observeLifecycle(page){
  const versions=[];const session=await page.context().newCDPSession(page);
  session.on('ServiceWorker.workerVersionUpdated',event=>versions.push(...event.versions));
  await session.send('ServiceWorker.enable');
  return ()=>{
    const ids=[...new Set(versions.map(v=>v.versionId))];
    const updated=ids.find(id=>{const states=versions.filter(v=>v.versionId===id).map(v=>v.status);return ['installing','installed','activating','activated'].every(s=>states.includes(s));});
    expect(updated,'new worker must really install, activate and complete').toBeDefined();
    expect(versions.some(v=>v.versionId!==updated && v.status==='redundant')).toBe(true);
  };
}

async function requestUpdate(page){
  await page.evaluate(async()=>{
    const registration=await navigator.serviceWorker.getRegistration();
    window.lastInstallState=null;
    registration.addEventListener('updatefound',()=>{
      const worker=registration.installing;
      worker.addEventListener('statechange',()=>{window.lastInstallState=worker.state;});
    },{once:true});
    await registration.update();
  });
}
async function acceptUpdate(page){
  await expect(page.locator('#pwaUpdateButton')).toBeVisible();
  await Promise.all([page.waitForEvent('load'),page.locator('#pwaUpdateButton').click()]);
  await page.evaluate(()=>initializeBibleExperience());
  await page.evaluate(()=>ReaderTranslationLoader.ensure().then(()=>true));
  await expectCurrentPicker(page);
  await expect(page.locator('#readerTranslation')).toHaveValue('dra');
  expect(await hashes(page)).toEqual(newHashes);
  expect(await hashes(page,newCache)).toEqual(newHashes);
  expect(await hashes(page,newCache,[runtimePath])).toEqual(runtimeHashes);
  await expect.poll(()=>page.evaluate(()=>caches.keys())).not.toContain(oldCache);
  if(previous.version>=51)await expectCompactManifest(page);
}
async function expectCompactManifest(page){
  const text=await page.evaluate(async({name,url})=>({
    cached:await(await(await caches.open(name)).match(url)).text(),
    served:await(await fetch(url)).text()
  }),{name:newCache,url:manifestPath});
  const expected=current[manifestPath].toString('utf8');
  expect(text).toEqual({cached:expected,served:expected});
  expect(Buffer.byteLength(generator.normalizeManifestLineEndings(text.served),'utf8')).toBe(13665);
  expect(await hashes(page,newCache,requiredAssets)).toEqual(requiredHashes);
  await expect(page.locator('html')).toHaveAttribute('data-theme','dark');
  await expect(page.locator('#readAloudVoice')).toHaveValue('female');
  await expect(page.locator('#readAloudSpeed')).toHaveValue('1.25');
}
async function retainedState(page){
  return page.evaluate(async version=>{
    const registration=await navigator.serviceWorker.ready;
    const retained={};
    for(const id of version===45?['web','dra','kjv']:['web','dra']){
      retained[id]=await new Promise(resolve=>{
        const channel=new MessageChannel();
        channel.port1.onmessage=event=>{channel.port1.onmessage=null;channel.port1.close();resolve(event.data.activeRevision);};
        registration.active.postMessage({type:'BIBLE_TRANSLATION_STATUS',id},[channel.port2]);
      });
    }
    const result={retained,saved:UserData.savedVerses.load(),translation:UserData.translation.load()};
    if(version>=51)result.preferences={
      speed:UserData.speechSpeed.load(),voice:UserData.speechVoice.load(),
      plan:UserData.plan.load(),journey:UserData.journey.load(),compare:UserData.compare.load(),
      position:UserData.readerPosition.load(),theme:localStorage.getItem('god4.theme'),
      marker:localStorage.getItem('god4.m116.upgrade-marker')
    };
    return result;
  },previous.version);
}

async function compactVoiceNavigation(page,before){
  const mobile=await page.evaluate(()=>matchMedia('(max-width:620px)').matches);
  const mic=page.locator('#readerVoiceCommands'),more=page.locator('#readerMoreTrigger');
  if(mobile){
    await expect(page.locator('.reader-toolbar')).toHaveClass(/reader-compact-mobile/);
    await expect(page.locator('.reader-toolbar > #readerVoiceCommands')).toBeVisible();
    expect(await mic.evaluate(e=>e.previousElementSibling.id)).toBe('readerMoreTrigger');
    expect(await mic.evaluate(e=>e.getBoundingClientRect().width)).toBeGreaterThanOrEqual(44);
  }else if(await more.getAttribute('aria-expanded')==='false')await more.click();
  await expect(page.locator('[data-voice-command-button]')).toHaveCount(1);
  for(const [command,id,book,verse] of [['WEB John 1:16','web','john',16],['CTH, Tobias 1:1','dra','tobit',1]]){
    const recovery=page.getByRole('button',{name:'Show Reader controls',exact:true});if(await recovery.isVisible())await recovery.click();
    await mic.click();await expect(mic).toHaveAttribute('aria-pressed','true');await expect(mic).toHaveAccessibleName(/listening/);
    await page.evaluate(command=>__upgradeRecognition.at(-1).emit(command),command);await page.evaluate(()=>voiceNavigationTask);
    await expect(mic).toHaveAttribute('aria-pressed','false');await expect(page.locator('#readerTranslation')).toHaveValue(id);
    expect(await page.evaluate(()=>({book:currentBook,chapter:currentChapter,verse:currentVerse}))).toEqual({book,chapter:1,verse});
    await expect(page.locator('#readerContent .verse-focused')).toHaveAttribute('data-verse-number',String(verse));
  }
  expect(await page.evaluate(()=>UserData.savedVerses.load())).toEqual(before.saved);
  expect(await page.evaluate(()=>({voice:UserData.speechVoice.load(),speed:UserData.speechSpeed.load()}))).toEqual({voice:'female',speed:1.25});
  expect(await page.evaluate(()=>BibleData.listTranslations().filter(t=>t.id!=='demo-local').length)).toBe(9);
}

async function kjvSpeech(page,updated){
  await page.evaluate(async()=>{
    if(!await BibleTranslationLoader.ensure('kjv'))throw new Error('Retained KJV unavailable');
    await navigateSearchResult({translationId:'kjv',bookId:'genesis',chapter:1,verse:2});
    const chapter=BibleData.getChapter('kjv','genesis',1);
    BibleSpeech.playVerse(chapter.verses[1],2,{translationId:'kjv',bookId:'genesis',chapter:1});
  });
  const verse=page.locator('#readerContent [data-verse-number="2"]');
  await expect(verse.locator('i')).toHaveCount(updated?1:0);
  const raw=await verse.getAttribute('data-verse-text');
  expect(raw).toContain('[was]');
  expect(await page.evaluate(()=>window.__upgradeSpeech.at(-1))).toBe(updated?'Genesis chapter 1 verse 2. '+raw.replace('[was]','was'):raw);
  await page.evaluate(async()=>{stopReader();await changeTranslation('dra');await navigateReaderToPassage('john',1,1);});
}

async function readerOptions(page,updated){
  await page.locator('#readerMoreTrigger').click();
  if(updated){
    await page.evaluate(()=>ReaderTranslationLoader.ensure());
    await expect(page.locator('#readerMoreTrigger')).toHaveText('Hide Options');
    const mobile=await page.evaluate(()=>matchMedia('(max-width:620px)').matches);
    for(const id of ['bookSelect','chapterSelect','verseSelect','readAloudVoice','readAloudSpeed']){
      if(mobile)await expect(page.locator(`[data-reader-select="${id}"]`)).toBeVisible();
      else await expect(page.locator('#'+id)).toBeVisible();
    }
    await page.evaluate(()=>selectReaderVerse(2));
    const save=page.locator('#readerSaveVerse');
    await save.click();await expect(page.locator('#readerSaveStatus')).toHaveText('John 1:2 (CTH) saved.');
    await expect(save).toHaveAttribute('aria-pressed','true');
    expect(await page.evaluate(()=>UserData.savedVerses.load().at(-1).location)).toEqual({translationId:'dra',bookId:'john',chapter:1,verse:2});
    await expect(save).toHaveText('Saved ✓');await expect(save).toHaveAttribute('aria-disabled','true');
    await save.press('Enter');
    expect(await page.evaluate(()=>UserData.savedVerses.load().filter(entry=>entry.location?.verse===2))).toHaveLength(1);
    await page.locator('.saved-pill').click();
    await page.locator('#tray .saved-verse-row').filter({hasText:'John 1:2 (CTH)'}).locator('.saved-verse-remove').filter({hasText:'Remove'}).click();
    await page.locator('#closeTray').click();
    await expect(save).toHaveAttribute('aria-pressed','false');
    await expect(page.locator('#readerSaveStatus')).toHaveText('John 1:2 (CTH) removed from Saved.');
    if(mobile){
      await page.locator('#readerContent').dispatchEvent('wheel',{deltaY:96});
      await page.evaluate(()=>scrollBy({top:96,behavior:'instant'}));
      const recovery=page.getByRole('button',{name:'Show Reader controls',exact:true});await expect(recovery).toBeVisible();
      const before=await page.evaluate(()=>({scroll:scrollY,content:document.getElementById('readerContent').getBoundingClientRect().top}));
      await recovery.tap();
      await expect(page.locator('.reader-toolbar')).toHaveCSS('visibility','visible');
      await expect(page.locator('#readAloudPlay')).toBeFocused();
      expect(await page.evaluate(()=>({scroll:scrollY,content:document.getElementById('readerContent').getBoundingClientRect().top}))).toEqual(before);
      await expect(page.locator('#readerMoreTrigger')).toHaveText('Hide Options');
    }
  }else expect(await page.evaluate(()=>typeof ReaderOptions)).toBe('undefined');
  await page.locator('#readerMoreTrigger').press('Escape');
  await expect(page.locator('#readerSecondaryControls')).toBeHidden();
  if(updated)await expect(page.locator('#readerMoreTrigger')).toHaveText('Options');
}

for(const width of previous.version>=44?[1280,320,390]:[320,390])test(`installed shell ${previous.version} waits for acceptance and preserves offline data across tabs at ${width}px`,async({page,context})=>{
  test.setTimeout(60000);
  await page.setViewportSize({width,height:844});
  const server=await fixture(),errors=[];
  page.on('pageerror',error=>errors.push(error.message));
  try{
    const keys=await installOld(page,server.origin),before=await retainedState(page);
    if(previous.version===47)await page.evaluate(()=>localStorage.setItem('god4.theme','dark'));
    expect(before.saved).toEqual(saved);
    expect(Object.values(before.retained).every(Boolean)).toBe(true);
    if(previous.version===46)await readerOptions(page,false);
    if(previous.version===45)await kjvSpeech(page,false);
    if(previous.version===44){
      const oldPosition=await planPosition(page);
      expect(oldPosition.headingTop).toBeLessThan(oldPosition.top);
    }
    const second=await context.newPage();
    second.on('pageerror',error=>errors.push(error.message));
    await second.goto(server.origin);await second.evaluate(()=>{window.upgradeTabMarker='old tab';return initializeBibleExperience();});
    const beforeRequests=server.state.bibleRequests.slice();
    server.state.version=currentVersion;
    await page.bringToFront();
    await requestUpdate(page);
    await expect(page.locator('#pwaUpdateButton')).toBeVisible();
    expect(await page.evaluate(async()=>{
      const registration=await navigator.serviceWorker.getRegistration();
      return {active:registration.active.state,waiting:registration.waiting.state};
    })).toEqual({active:'activated',waiting:'installed'});
    expect(await hashes(page)).toEqual(oldHashes);
    expect(await hashes(page,newCache)).toEqual(newHashes);
    expect(await hashes(page,newCache,[runtimePath])).toEqual(runtimeHashes);
    if(previous.version>=51)expect(await hashes(page,newCache,requiredAssets)).toEqual(requiredHashes);
    await page.reload();await page.evaluate(()=>initializeBibleExperience());
    if(previous.version===53){
      await expect(page.locator('#headerMenuTrigger')).toBeHidden();
      await expect(page.locator('#headerMenuFallback')).toBeVisible();
      await page.locator('#headerMenuFallback').click();
      await expect(page.locator('#readerContent h2')).toHaveText('John 1');
      expect(await retainedState(page)).toEqual(before);
      expect(await hashes(page)).toEqual(oldHashes);
    }
    await expectOldPicker(page);
    expect(await hashes(page)).toEqual(oldHashes);
    if(previous.version===55){
      const beforeRef=await page.locator('#verseRef').textContent();
      await page.getByRole('button',{name:'Another verse'}).click();
      await expect(page.locator('#verseRef')).not.toHaveText(beforeRef);
      await expect(page.locator('#discoveryStatus')).toBeEmpty();
    }
    const responses=[];
    page.on('response',response=>{if(assetPaths.concat(runtimePath).includes(new URL(response.url()).pathname))responses.push({path:new URL(response.url()).pathname,worker:response.fromServiceWorker()});});
    await acceptUpdate(page);
    if(previous.version===53){
      await expect(page.locator('#headerMenuFallback')).toBeHidden();
      await page.locator('#headerMenuTrigger').click();
      await expect(page.locator('#headerMenu [data-destination]')).toHaveCount(17);
      await expect(page.locator('#headerMenu [data-destination="ethiopian"]')).toBeVisible();
      await page.locator('#headerMenu [data-destination="resources"]').click();
      await expect(page.locator('#resources')).toBeFocused();
    }
    if(previous.version===47){
      await expect(page.locator('html')).toHaveAttribute('data-theme','dark');
      expect(await hashes(page,newCache,themePaths)).toEqual(themeHashes);
      expect(await hashes(page,null,themePaths)).toEqual(themeHashes);
    }
    if(previous.version===44){
      const newPosition=await planPosition(page);
      expect(newPosition.headingTop).toBeGreaterThanOrEqual(newPosition.top);
      expect(newPosition.headingBottom).toBeLessThanOrEqual(newPosition.height);
      expect(newPosition.dayBottom).toBeLessThanOrEqual(newPosition.height);
      console.log('Installed 44-to-61 Reader/Plan geometry:',JSON.stringify({width,newPosition}));
      await page.getByRole('button',{name:'Reader',exact:true}).click();
    }
    if(previous.version===45)await kjvSpeech(page,true);
    if(previous.version===46)await readerOptions(page,true);
    for(const asset of assetPaths.concat(runtimePath))expect(responses.some(response=>response.path===asset&&response.worker)).toBe(true);
    expect(await retainedState(page)).toEqual(before);
    const upgradedKeys=await page.evaluate(async name=>(await(await caches.open(name)).keys()).map(request=>new URL(request.url).pathname+new URL(request.url).search).sort(),newCache);
    expect(upgradedKeys).toEqual(keys.concat(previous.version>=48?[]:themePaths,previous.version===43?[runtimePath]:[],previous.version<55?['/js/home-commandments.js']:[],previous.version<56?discoveryAssets:[]).sort());
    expect(upgradedKeys).toHaveLength(52);
    expect(await page.evaluate(()=>caches.keys())).toContain('god4-auth-vendor-supabase-js-2.117.0');
    expect(await second.evaluate(()=>window.upgradeTabMarker)).toBe('old tab');
    await expectOldPicker(second);
    expect(await hashes(second)).toEqual(newHashes);
    await second.reload();await second.evaluate(()=>initializeBibleExperience());
    await second.evaluate(()=>ReaderTranslationLoader.ensure());await expectCurrentPicker(second);
    await context.setOffline(true);
    await page.reload();await page.evaluate(()=>initializeBibleExperience());
    expect(await hashes(page)).toEqual(newHashes);
    if(previous.version===53){
      await page.locator('#headerMenuTrigger').click();
      await expect(page.locator('#headerMenu [data-destination]')).toHaveCount(17);
      await expect(page.locator('#headerMenu [data-destination="ethiopian"]')).toBeVisible();
      await page.keyboard.press('Escape');
    }
    if(previous.version===55 || previous.version>=58){
      const next=page.getByRole('button',{name:'Another verse'});
      await next.click();
      await expect(page.locator('#discoveryStatus')).toHaveText(/ \(WEB\)$/);
      const catalog=await page.evaluate(async url=>(await fetch(url)).json(),discoveryAssets[1]);
      const ref=await page.locator('#verseRef').textContent();
      const passage=catalog.topics.flatMap(topic=>topic.passages).find(p=>p.reference===ref);
      await expect(page.locator('#discoveryTopic')).toHaveText(catalog.topics.find(topic=>topic.passages.some(p=>p.reference===ref)).title);
      expect(await page.locator('#leafCard').evaluate(card=>card.querySelector('#dropcap').textContent+card.querySelector('#verseText').textContent)).toBe(passage.text);
    }
    if(previous.version>=54){
      await page.getByRole('button',{name:'Next commandment'}).click();
      await expect(page.locator('#commandments output')).toHaveText('2 of 10');
    }
    if(previous.version>=51)await expectCompactManifest(page);
    if(previous.version===47){expect(await hashes(page,null,themePaths)).toEqual(themeHashes);await expect(page.locator('html')).toHaveAttribute('data-theme','dark');await page.locator('[data-theme-toggle]').click();await expect(page.locator('html')).toHaveAttribute('data-theme','light');}
    expect(await retainedState(page)).toEqual(before);
    if(previous.version===45)await kjvSpeech(page,true);
    if(previous.version===46)await readerOptions(page,true);
    if(previous.version===44){
      const offlinePosition=await planPosition(page);
      expect(offlinePosition.headingTop).toBeGreaterThanOrEqual(offlinePosition.top);
      expect(offlinePosition.headingBottom).toBeLessThanOrEqual(offlinePosition.height);
      await page.getByRole('button',{name:'Reader',exact:true}).click();
    }
    for(const id of ['web','dra']){
      if(width<=620){
        await page.locator('#readerTranslationTrigger').click();
        await page.locator(`#readerTranslationPicker [data-translation="${id}"]`).tap();
        await expect(page.locator('#readerTranslationPicker')).not.toBeVisible();
      }else await page.locator('#readerTranslation').selectOption(id);
      await expect(page.locator('#readerTranslation')).toHaveValue(id);
      await expect.poll(()=>page.evaluate(()=>currentTranslation)).toBe(id);
      await expect(page.locator('#readerContent h2')).toHaveText('John 1');
    }
    if(previous.version===47){
      await page.getByRole('button',{name:'Compare',exact:true}).click();
      const trigger=page.locator('[data-themed-select="compareChapter"]');
      await expect(trigger).toBeVisible();await trigger.click();
      await expect(page.locator('#themedSelectPicker')).toBeVisible();
      await page.locator('#themedSelectPicker [data-option-value="3"]').click();
      await expect(page.locator('#compareSummary')).toHaveText('Comparing John 3');
      await expect(trigger).toHaveText('Chapter 3');
      await page.getByRole('button',{name:'Reader',exact:true}).click();
    }
    if(previous.version>=52)await compactVoiceNavigation(page,before);
    if(previous.version>=59 && width===390){
      const guides=['/guides/ethiopian-bible.html','/books-of-enoch.html'];
      await expect(page.locator('#ethiopian a[href="/ethiopian-bible.html"]')).toHaveCount(0);
      for(const guide of guides)await expect(page.locator('#ethiopian a[href="'+guide+'"]')).toHaveCount(1);
      expect(upgradedKeys.filter(key=>guides.includes(key))).toEqual([]);
      const guidePage=await context.newPage();
      for(const guide of guides){
        await guidePage.goto(server.origin+guide);
        await expect(guidePage.getByRole('heading',{name:'You are offline'})).toBeVisible();
      }
      await guidePage.close();
    }
    expect(errors).toEqual([]);
    expect(server.state.bibleRequests).toEqual(beforeRequests);
  }finally{await context.setOffline(false);await server.stop(context);}
});

test(`failed shell-85 installation leaves installed shell ${previous.version} usable offline and retries without data loss`,async({page,context})=>{
  test.setTimeout(60000);
  const server=await fixture();
  try{
    await installOld(page,server.origin);
    const before=await retainedState(page);
    const beforeRequests=server.state.bibleRequests.slice();
    server.state.version=currentVersion;server.state.failAsset=previous.version===56?'/js/bible/speech.js':previous.version===55?discoveryAssets[1]:previous.version===51?'/js/bible/reader.js':previous.version===50?'/css/components.css':previous.version===49?alignmentPath:previous.version===48?'/css/companion.css':previous.version===47?'/js/theme.js':previous.version===46?runtimePath:previous.version===45?'/js/bible/speech.js':previous.version===44?'/js/bible/reader.js':'/css/companion.css';
    await requestUpdate(page);
    await expect.poll(()=>page.evaluate(()=>window.lastInstallState)).toBe('redundant');
    expect(await page.evaluate(async()=>!!(await navigator.serviceWorker.getRegistration()).waiting)).toBe(false);
    await expect(page.locator('#pwaUpdateButton')).toBeHidden();
    expect(await page.evaluate(async name=>{
      if(!(await caches.keys()).includes(name))return [];
      return(await(await caches.open(name)).keys()).map(request=>request.url);
    },newCache)).toEqual([]);
    expect(await hashes(page)).toEqual(oldHashes);
    if(previous.version===53){
      await page.reload();await expect(page.locator('#headerMenuTrigger')).toBeHidden();
      await page.locator('#headerMenuFallback').click();await expect(page.locator('#readerContent h2')).toHaveText('John 1');
      expect(await retainedState(page)).toEqual(before);
    }
    await context.setOffline(true);
    await page.reload();await page.evaluate(()=>initializeBibleExperience());
    if(previous.version===43)await expect(page.locator('#readerTranslation')).toBeVisible();
    await expectOldPicker(page);
    expect(await hashes(page)).toEqual(oldHashes);
    expect(await retainedState(page)).toEqual(before);
    if(previous.version===45)await kjvSpeech(page,false);
    await context.setOffline(false);server.state.failAsset=null;
    await requestUpdate(page);
    await acceptUpdate(page);
    if(previous.version===53)await expect(page.locator('#headerMenuTrigger')).toBeVisible();
    if(previous.version===46)await readerOptions(page,true);
    if(previous.version===45)await kjvSpeech(page,true);
    expect(await retainedState(page)).toEqual(before);
    expect(server.state.bibleRequests).toEqual(beforeRequests);
  }finally{await context.setOffline(false);await server.stop(context);}
});

test(`interrupted shell-85 precache keeps shell ${previous.version} recoverable and retries offline safely`,async({page,context})=>{
  test.setTimeout(60000);const server=await fixture();
  try{
    await installOld(page,server.origin);const before=await retainedState(page),requests=server.state.bibleRequests.slice();
    server.state.version=currentVersion;server.state.interruptAsset='/js/pwa/register.js';
    await requestUpdate(page);await expect.poll(()=>page.evaluate(()=>window.lastInstallState)).toBe('redundant');
    expect(server.state.interruptions).toBeGreaterThan(0);
    expect(await page.evaluate(async()=>!!(await navigator.serviceWorker.getRegistration()).waiting)).toBe(false);
    await expect(page.locator('#pwaUpdateButton')).toBeHidden();
    expect(await page.evaluate(async name=>(await caches.keys()).includes(name)?(await(await caches.open(name)).keys()).length:0,newCache)).toBe(0);
    if(previous.version===53){
      await page.reload();await expect(page.locator('#headerMenuTrigger')).toBeHidden();
      await page.locator('#headerMenuFallback').click();await expect(page.locator('#readerContent h2')).toHaveText('John 1');
      expect(await retainedState(page)).toEqual(before);
    }
    await context.setOffline(true);await page.reload();await page.evaluate(()=>initializeBibleExperience());
    expect(await hashes(page)).toEqual(oldHashes);expect(await retainedState(page)).toEqual(before);
    await expect(page.locator('#readerContent h2')).toHaveText('John 1');
    await context.setOffline(false);server.state.interruptAsset=null;await requestUpdate(page);await acceptUpdate(page);
    await context.setOffline(true);await page.reload();await page.evaluate(()=>initializeBibleExperience());await page.evaluate(()=>ReaderTranslationLoader.ensure());
    expect(await hashes(page,newCache,requiredAssets)).toEqual(requiredHashes);expect(await retainedState(page)).toEqual(before);
    for(const id of ['web','dra']){await page.evaluate(id=>changeTranslation(id),id);await expect(page.locator('#readerTranslation')).toHaveValue(id);await expect(page.locator('#readerContent h2')).toHaveText('John 1');}
    expect(server.state.bibleRequests).toEqual(requests);
  }finally{await context.setOffline(false);await server.stop(context);}
});


if(previous.version>=52)test('an uninitialized old tab can first load Reader controls after another tab accepts the update',async({page,context})=>{
  test.setTimeout(60000);const server=await fixture();
  try{
    await installOld(page,server.origin);const before=await retainedState(page);const assertLifecycle=await observeLifecycle(page);
    const late=await context.newPage();await late.addInitScript(()=>{window.IntersectionObserver=class{observe(){}unobserve(){}disconnect(){}};});
    await late.goto(server.origin);
    // Finish registration before requesting a distinct version update. Reader
    // remains uninitialized; no timers or synthetic reading interactions.
    await late.evaluate(()=>navigator.serviceWorker.register('/sw.js',{scope:'/',updateViaCache:'none'}).then(()=>true));
    await late.evaluate(()=>{window.oldTabMarker='preserve me';window.oldController=navigator.serviceWorker.controller;window.controllerTransitions=[];navigator.serviceWorker.addEventListener('controllerchange',()=>controllerTransitions.push(navigator.serviceWorker.controller.state));});
    expect(await late.evaluate(()=>({ready:bibleExperienceReady,runtime:typeof ReaderTranslationPicker,mic:!!document.getElementById('readerVoiceCommands')}))).toEqual({ready:false,runtime:'undefined',mic:previous.version>=53});
    await page.bringToFront();server.state.version=currentVersion;await requestUpdate(page);
    await acceptUpdate(page);
    assertLifecycle();
    await late.bringToFront();
    expect(await late.evaluate(async()=>{const r=await navigator.serviceWorker.getRegistration();return {controller:navigator.serviceWorker.controller.state,active:r.active.state,waiting:r.waiting?.state||null,installing:r.installing?.state||null,old:oldController.state,changed:oldController!==navigator.serviceWorker.controller,current:navigator.serviceWorker.controller===r.active,events:controllerTransitions.length};})).toEqual({controller:'activated',active:'activated',waiting:null,installing:null,old:'redundant',changed:true,current:true,events:1});
    const loaded=await late.evaluate(async()=>{await initializeBibleExperience();try{await ReaderTranslationLoader.ensure();return true;}catch{return false;}});
    expect(loaded,'new lazy controls must remain compatible with old shell markup until that tab reloads').toBe(true);
    if(previous.version>=53)await expect(late.locator('.reader-toolbar')).toHaveClass(/reader-compact-mobile/);
    else await expect(late.locator('.reader-toolbar')).not.toHaveClass(/reader-compact-mobile/);
    expect(await late.evaluate(()=>window.oldTabMarker)).toBe('preserve me');
    await late.locator('#readerMoreTrigger').click();await expect(late.locator('#readerSecondaryControls')).toBeVisible();
    await expect(late.locator('[data-voice-command-button]')).toHaveCount(1);
    expect(await retainedState(late)).toEqual(before);
    await context.setOffline(true);await late.reload();await late.evaluate(()=>initializeBibleExperience());await late.evaluate(()=>ReaderTranslationLoader.ensure());
    await expect(late.locator('.reader-toolbar > #readerVoiceCommands')).toBeVisible();expect(await hashes(late,newCache,requiredAssets)).toEqual(requiredHashes);
  }finally{await context.setOffline(false);await server.stop(context);}
});


if(previous.version>=52)test('closing an unused old tab permits accepted update recovery without losing offline data',async({page,context})=>{
  test.setTimeout(60000);const server=await fixture();
  try{
    await installOld(page,server.origin);const before=await retainedState(page);const assertLifecycle=await observeLifecycle(page);
    const idle=await context.newPage();await idle.addInitScript(()=>{window.IntersectionObserver=class{observe(){}unobserve(){}disconnect(){}};});
    await idle.goto(server.origin);await idle.evaluate(()=>navigator.serviceWorker.register('/sw.js',{scope:'/',updateViaCache:'none'}).then(()=>true));
    expect(await idle.evaluate(()=>bibleExperienceReady)).toBe(false);
    await page.bringToFront();server.state.version=currentVersion;await requestUpdate(page);await expect(page.locator('#pwaUpdateButton')).toBeVisible();
    const reloaded=page.waitForEvent('load');await page.locator('#pwaUpdateButton').click();await idle.close();await reloaded;assertLifecycle();
    await page.evaluate(()=>initializeBibleExperience());await page.evaluate(()=>ReaderTranslationLoader.ensure());
    await expect(page.locator('.reader-toolbar > #readerVoiceCommands')).toBeVisible();expect(await retainedState(page)).toEqual(before);
    await context.setOffline(true);await page.reload();await page.evaluate(()=>initializeBibleExperience());await page.evaluate(()=>ReaderTranslationLoader.ensure());
    expect(await hashes(page,newCache,requiredAssets)).toEqual(requiredHashes);expect(await retainedState(page)).toEqual(before);
    for(const id of ['web','dra']){await page.evaluate(id=>changeTranslation(id),id);await expect(page.locator('#readerTranslation')).toHaveValue(id);await expect(page.locator('#readerContent h2')).toHaveText('John 1');}
  }finally{await context.setOffline(false);await server.stop(context);}
});


if(previous.version>=52)test('closing all old tabs permits offline relaunch with preserved downloaded Bibles and settings',async({page,context})=>{
  test.setTimeout(60000);const server=await fixture();
  try{
    await installOld(page,server.origin);const before=await retainedState(page);
    const idle=await context.newPage();await idle.addInitScript(()=>{window.IntersectionObserver=class{observe(){}unobserve(){}disconnect(){}};});
    await idle.goto(server.origin);await page.bringToFront();server.state.version=currentVersion;await requestUpdate(page);await expect(page.locator('#pwaUpdateButton')).toBeVisible();await page.locator('#pwaUpdateButton').click();
    await Promise.all(context.pages().map(p=>p.close()));
    const reopened=await context.newPage();await context.setOffline(true);await reopened.goto(server.origin);await reopened.evaluate(()=>initializeBibleExperience());await reopened.evaluate(()=>ReaderTranslationLoader.ensure());
    await expect(reopened.locator('.reader-toolbar > #readerVoiceCommands')).toBeVisible();expect(await hashes(reopened,newCache,requiredAssets)).toEqual(requiredHashes);expect(await retainedState(reopened)).toEqual(before);
    for(const id of ['web','dra']){await reopened.evaluate(id=>changeTranslation(id),id);await expect(reopened.locator('#readerTranslation')).toHaveValue(id);await expect(reopened.locator('#readerContent h2')).toHaveText('John 1');}
  }finally{await context.setOffline(false);await server.stop(context);}
});


if(previous.version>=78)test('previously cached Word Study survives the shell update and offline reload',async({page,context})=>{
  test.setTimeout(60000);
  const server=await fixture();
  const cacheName='god4-word-study-data-v1';
  try{
    await installOld(page,server.origin);
    await page.evaluate(async paths=>{for(const url of paths)await (await fetch(url)).json();},warmedWordStudy);
    const cached=await hashes(page,cacheName,warmedWordStudy);
    for(const url of warmedWordStudy) expect(cached[url]).toBe(digest(prior[url]));
    server.state.version=currentVersion;
    await requestUpdate(page);await acceptUpdate(page);
    await context.setOffline(true);
    await page.reload();
    await page.evaluate(async()=>{
      await initializeBibleExperience();await changeTranslation('web');await navigateReaderToPassage('numbers',32,3);
    });
    expect(await hashes(page,cacheName,warmedWordStudy)).toEqual(cached);
    await page.locator('#readerContent [data-verse-number="3"] [data-word-study-term="dibon"]').press('Enter');
    await expect(page.locator('#wordStudyAlignmentStatus')).toContainText('Berean translation tables');
    await expect(page.locator('#wordStudyOriginalTokens [data-aligned="true"]')).toHaveCount(1);
  }finally{await context.setOffline(false);await server.stop(context);}
});

if(previous.version>=52)test('an unfinished response owned by the accepting tab delays activation only until its body is consumed',async({page,context})=>{
  test.setTimeout(60000);const server=await fixture();
  try{
    await installOld(page,server.origin);const before=await retainedState(page);const assertLifecycle=await observeLifecycle(page);
    await page.evaluate(async()=>{window.heldVendor=await fetch('/js/vendor/supabase-js-2.117.0.min.js');});
    expect(await page.evaluate(()=>heldVendor.bodyUsed)).toBe(false);
    server.state.version=currentVersion;await requestUpdate(page);await expect(page.locator('#pwaUpdateButton')).toBeVisible();
    const reloaded=page.waitForEvent('load');await page.locator('#pwaUpdateButton').click();
    expect(await page.evaluate(async()=>{const r=await navigator.serviceWorker.getRegistration();return {old:r.active?.state,next:r.waiting?.state,bodyUsed:heldVendor.bodyUsed};})).toEqual({old:'activated',next:'installed',bodyUsed:false});
    // Resolving this old fetch, rather than any tab reload/close or forced
    // activation, must release the browser's normal lifecycle gate.
    await page.evaluate(()=>heldVendor.arrayBuffer().then(()=>true));await reloaded;assertLifecycle();
    await page.evaluate(()=>initializeBibleExperience());await page.evaluate(()=>ReaderTranslationLoader.ensure());
    expect(await retainedState(page)).toEqual(before);expect(await hashes(page,newCache,requiredAssets)).toEqual(requiredHashes);
  }finally{await context.setOffline(false);await server.stop(context);}
});

});
