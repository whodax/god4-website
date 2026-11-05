const {test,expect}=require('@playwright/test');

test('diagnostics stay disabled without opt-in',async({page})=>{
  await page.goto('/');
  await expect(page.getByRole('button',{name:'Narration log'})).toHaveCount(0);
  expect(await page.evaluate(()=>typeof window.narrationDiagnostic)).toBe('undefined');
});

test('offline opt-in records the active shell, Stop and Play, and rejects a stale callback',async({page,context})=>{
  await page.addInitScript(()=>{
    window.utterances=[];
    Object.defineProperty(navigator,'clipboard',{value:{writeText:async report=>{window.copiedReport=report;}}});
    const synth=new EventTarget();
    synth.getVoices=()=>[{name:'Test Male',voiceURI:'test-male',lang:'en-US',localService:true}];
    synth.speak=utterance=>utterances.push(utterance);
    synth.cancel=()=>{};
    Object.defineProperty(window,'speechSynthesis',{value:synth});
    window.SpeechSynthesisUtterance=class extends EventTarget{constructor(text){super();this.text=text;}};
    window.addEventListener('DOMContentLoaded',()=>initializeBibleExperience());
  });
  const url='/?narration-debug=1&cloud-tts=0';
  await page.goto(url);
  await page.evaluate(async()=>{await navigator.serviceWorker.ready;});
  await page.reload();
  await page.waitForFunction(()=>navigator.serviceWorker.controller);
  await expect(page.locator('#readerContent h2')).toHaveText('John 1');
  await expect.poll(()=>page.evaluate(()=>Boolean(BibleTranslationLoader.isLoaded('web')))).toBe(true);
  await context.setOffline(true);
  const play=page.locator('#readAloudPlay');
  await play.press('Enter');
  await page.evaluate(()=>{
    const first=utterances[0];
    const boundary={name:'word',charIndex:first.text.indexOf('beginning')};
    first.dispatchEvent(new Event('start'));
    first.onstart();
    first.dispatchEvent(Object.assign(new Event('boundary'),boundary));
    first.onboundary(boundary);
  });
  await play.press('Enter');
  await play.press('Enter');
  await page.evaluate(()=>{
    utterances[0].onerror({error:'interrupted'});
    utterances[1].dispatchEvent(new Event('start'));
    utterances[1].onstart();
  });
  await page.evaluate(()=>{stopReader();handleVoiceCommand('Play');});
  await page.getByRole('button',{name:'Narration log'}).click();
  await page.getByRole('button',{name:'Copy Diagnostic Report'}).click();
  await expect(page.getByText('Diagnostic report copied.')).toBeVisible();
  const entries=(await page.getByRole('textbox',{name:'Narration diagnostic log'}).inputValue()).split('\n').map(JSON.parse);
  expect(entries).toEqual(expect.arrayContaining([
    expect.objectContaining({event:'active-shell',data:'god4-shell-compact-reader-57-diagnostic'}),
    expect.objectContaining({event:'speech-loaded',data:expect.objectContaining({version:'shell57-diag-1'})}),
    expect.objectContaining({event:'native-choice',data:expect.objectContaining({voice:'test-male',reason:'offline'})}),
    expect.objectContaining({event:'speech-stop-checkpoint',data:expect.objectContaining({stopped:true,wordOffset:7})}),
    expect.objectContaining({event:'native-boundary'}),
    expect.objectContaining({event:'microphone-play-command',data:expect.objectContaining({state:'idle'})}),
    expect.objectContaining({event:'speech-error-callback',data:expect.objectContaining({accepted:false})}),
    expect.objectContaining({event:'native-start',data:expect.objectContaining({id:2})})
  ]));
  expect(await page.evaluate(()=>window.copiedReport)).toBe(await page.getByRole('textbox',{name:'Narration diagnostic log'}).inputValue());
  expect(JSON.stringify(entries)).not.toContain('In the beginning');
});
