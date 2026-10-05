/* Opt-in physical-device voice inspection. No DOM changes outside ?voice-debug=1. */
(function initializeVoiceDebug(){
  if(new URLSearchParams(window.location.search).get('voice-debug') !== '1' ||
      typeof BibleSpeech === 'undefined') return;
  var anchor = document.getElementById('readAloudStatus');
  if(!anchor) return;

  function element(tag, text, className){
    var node = document.createElement(tag);
    if(text !== undefined) node.textContent = text;
    if(className) node.className = className;
    return node;
  }
  var panel = element('section', undefined, 'voice-debug-panel');
  panel.id = 'voiceDebugPanel';
  panel.setAttribute('aria-labelledby', 'voiceDebugHeading');
  var heading = element('h3', 'Voice diagnostics');
  heading.id = 'voiceDebugHeading';
  panel.appendChild(heading);
  var summary = element('dl');
  summary.id = 'voiceDebugSummary';
  panel.appendChild(summary);
  var actions = element('div', undefined, 'voice-debug-actions');
  var refresh = element('button', 'Refresh voices');
  var male = element('button', 'Test Male');
  var female = element('button', 'Test Female');
  [refresh, male, female].forEach(function(button){ button.type = 'button'; actions.appendChild(button); });
  panel.appendChild(actions);
  var status = element('p', 'Voice tests are available while Reader speech is stopped.');
  status.setAttribute('role', 'status');
  panel.appendChild(status);
  panel.appendChild(element('h4', 'All device voices (index starts at 0)'));
  var inventory = element('ol', undefined, 'voice-debug-inventory');
  inventory.id = 'voiceDebugInventory';
  panel.appendChild(inventory);
  anchor.after(panel);

  function detail(list, label, value){
    list.appendChild(element('dt', label));
    list.appendChild(element('dd', String(value)));
  }
  function voiceDetails(voice){
    if(!voice) return 'No resolved voice; browser default will be used.';
    return 'name: ' + voice.name + '\nvoiceURI: ' + voice.voiceURI + '\nlang: ' + voice.lang +
      '\nlocalService: ' + voice.localService + '\ndefault: ' + voice.default;
  }
  function render(){
    var data = BibleSpeech.getVoiceDiagnostics();
    summary.textContent = '';
    detail(summary, 'Browser user agent', navigator.userAgent);
    detail(summary, 'speechSynthesis supported', data.supported ? 'yes' : 'no');
    detail(summary, 'Total getVoices() count', data.inventory.length);
    detail(summary, 'English voice count', data.englishVoiceCount);
    detail(summary, 'Current semantic preference', data.resolved.preference);
    detail(summary, 'Resolved Male', voiceDetails(data.resolved.male));
    detail(summary, 'Resolved Female', voiceDetails(data.resolved.female));
    detail(summary, 'sharedFallback', data.resolved.sharedFallback);
    if(data.error) detail(summary, 'Voice inventory error', data.error);
    inventory.textContent = '';
    data.inventory.forEach(function(voice){
      var row = element('li');
      // Each inventory row is a definition list for accessible field/value navigation.
      var fields = element('dl');
      detail(fields, 'Index', voice.index);
      ['name', 'voiceURI', 'lang', 'localService', 'default'].forEach(function(key){ detail(fields, key, voice[key]); });
      row.appendChild(fields);
      inventory.appendChild(row);
    });
    if(!data.inventory.length) inventory.appendChild(element('li', 'No voices returned yet.'));
    var busy = BibleSpeech.getState() !== 'idle';
    male.disabled = female.disabled = !data.supported || busy;
    status.textContent = busy ? 'Stop Reader speech before testing a voice.' :
      data.supported ? 'Voice tests are available while Reader speech is stopped.' : 'Speech synthesis is unavailable.';
  }
  refresh.addEventListener('click', function(){ BibleSpeech.refreshVoices(); render(); });
  male.addEventListener('click', function(){ BibleSpeech.testVoiceProfile('male'); });
  female.addEventListener('click', function(){ BibleSpeech.testVoiceProfile('female'); });
  document.addEventListener('bible-speech-debug-update', render);
  if(window.speechSynthesis && typeof window.speechSynthesis.addEventListener === 'function'){
    window.speechSynthesis.addEventListener('voiceschanged', render);
  }
  render();
}());
