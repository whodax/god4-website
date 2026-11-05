const {test,expect}=require('@playwright/test');

const candidate='5c461d7c0239199e5e5e3519783a3a635afb7ba4';
const shell='god4-shell-compact-reader-57-pause-diagnostic-1';
const url='/?narration-debug=1&cloud-tts=0';

test.use({viewport:{width:390,height:844},hasTouch:true,userAgent:'Mozilla/5.0 (Linux; Android 14) AppleWebKit/537.36 Chrome/130.0.0.0 Mobile Safari/537.36'});

test('diagnostics stay disabled without opt-in',async({page})=>{
  await page.goto('/');
  await expect(page.getByRole('button',{name:'Narration log'})).toHaveCount(0);
  expect(await page.evaluate(()=>typeof window.narrationDiagnostic)).toBe('undefined');
});

for(const reason of ['empty-queue','interruption'])test(`offline report identifies the running candidate and ${reason} recovery`,async({page,context})=>{
  await page.addInitScript(reason=>{
    window.utterances=[];
    Object.defineProperty(navigator,'clipboard',{value:{writeText:async report=>{window.copiedReport=report;}}});
    const synth=new EventTarget();
    Object.assign(synth,{
      speaking:false,pending:false,paused:false,
      getVoices:()=>[{name:'Test Male',voiceURI:'test-male',lang:'en-US',localService:true}],
      speak(utterance){utterances.push(utterance);this.speaking=true;},
      pause(){
        this.speaking=false;
        if(reason==='interruption'){
          const event=Object.assign(new Event('error'),{error:'interrupted'});
          utterances.at(-1).dispatchEvent(event);
          utterances.at(-1).onerror(event);
        }
      },
      resume(){},
      cancel(){this.speaking=false;}
    });
    Object.defineProperty(window,'speechSynthesis',{value:synth});
    window.SpeechSynthesisUtterance=class extends EventTarget{constructor(text){super();this.text=text;}};
    window.addEventListener('DOMContentLoaded',()=>initializeBibleExperience());
  },reason);
  await page.goto(url);
  await page.evaluate(async()=>{await navigator.serviceWorker.ready;});
  await page.reload();
  await page.waitForFunction(()=>navigator.serviceWorker.controller);
  await expect(page.locator('#readerContent h2')).toHaveText('John 1');
  await page.evaluate(()=>ReaderTranslationLoader.ensure());
  await context.setOffline(true);
  const play=page.locator('#readAloudPlay');
  await play.tap();
  await page.evaluate(()=>{
    const first=utterances[0];
    first.dispatchEvent(new Event('start'));
    first.onstart();
  });
  const recovery=page.getByRole('button',{name:'Show Reader controls',exact:true});
  if(await recovery.isVisible())await recovery.tap();
  await play.press('Enter');
  expect(await page.evaluate(()=>BibleSpeech.getState())).toBe('paused');
  await play.press('Enter');
  await page.evaluate(()=>{
    const old=utterances[0];
    old.onend();
    const latest=utterances[1];
    latest.dispatchEvent(new Event('start'));
    latest.onstart();
  });

  await page.getByRole('button',{name:'Narration log'}).click();
  await page.getByRole('button',{name:'Copy Diagnostic Report'}).click();
  await expect(page.getByText('Diagnostic report copied.')).toBeVisible();
  const readReport=async()=> (await page.getByRole('textbox',{name:'Narration diagnostic log'}).inputValue()).split('\n').map(JSON.parse);
  const entries=await readReport();
  const object=expect.objectContaining;
  expect(entries).toEqual(expect.arrayContaining([
    object({event:'active-shell',data:shell}),
    object({event:'speech-loaded',data:object({version:'shell57-pause-diag-1',candidate})}),
    object({event:'reader-pointer',data:object({control:'play',pointerType:'touch',trusted:true,state:'idle'})}),
    object({event:'tap',data:object({control:'play',trusted:true,state:'paused',online:false})}),
    object({event:'tap-after-dispatch',data:object({control:'play',state:'playing'})}),
    object({event:'native-choice',data:object({voice:'test-male',reason:'offline',verified:true})}),
    object({event:'native-pause',nativeQueue:object({speaking:true})}),
    object({event:'native-pause-returned',nativeQueue:object({speaking:false})}),
    object({event:'native-resume',nativeQueue:object({speaking:false})}),
    object({event:'native-resume-returned',nativeQueue:object({speaking:false})}),
    object({event:'recovery-'+reason,data:object({state:'paused',session:expect.any(Number),playbackAttempt:1})}),
    object({event:'speech-end-callback',data:object({accepted:false,attempt:1})}),
    object({event:'speech-start-callback',data:object({accepted:true,attempt:2})})
  ]));
  if(reason==='interruption'){
    expect(entries).toContainEqual(object({event:'speech-error-callback',data:object({accepted:true,error:'interrupted'})}));
  }
  expect(await page.evaluate(()=>window.copiedReport)).toBe(await page.getByRole('textbox',{name:'Narration diagnostic log'}).inputValue());
  expect(JSON.stringify(entries)).not.toContain('In the beginning');

  await page.reload();
  await page.getByRole('button',{name:'Narration log'}).click();
  await expect.poll(async()=>{await page.getByRole('button',{name:'Refresh log'}).click();return (await readReport()).find(entry=>entry.event==='active-shell')?.data;}).toBe(shell);
  expect(await readReport()).toContainEqual(object({event:'speech-loaded',data:object({candidate})}));
});
