/* Domain boundary: existing keys and wire formats stay unchanged. */
var UserData = (function(storage){
  var keys = {
    saved: 'god4.savedVerses', plan: 'god4.plan.completedDays',
    translation: 'god4.translation', compare: 'god4.compare',
    speed: 'god4.speech.speed', voice: 'god4.speech.voice'
  };
  var speeds = [0.5, 0.75, 1, 1.25, 1.5, 1.75, 2, 2.25, 2.5];
  function readJSON(key){
    try { return JSON.parse(storage.read(key)); }
    catch(error){ return null; }
  }
  function savedVerses(entries){
    if(!Array.isArray(entries)) return [];
    var seen = new Set();
    return entries.filter(function(entry){
      if(!entry || typeof entry !== 'object' || Array.isArray(entry) ||
        typeof entry.ref !== 'string' || !entry.ref.trim() ||
        typeof entry.text !== 'string' || !entry.text.trim() || seen.has(entry.ref)) return false;
      seen.add(entry.ref);
      return true;
    }).map(function(entry){ return {ref: entry.ref, text: entry.text}; });
  }
  function completedDays(entries){
    if(!Array.isArray(entries)) return [];
    return Array.from(new Set(entries.filter(function(day){
      return Number.isInteger(day) && day >= 1 && day <= 30;
    })));
  }
  function translation(value){
    return typeof value === 'string' && value && value !== 'demo-local' ? value : 'web';
  }
  function compare(value){
    var result = {count: 2, selections: ['', '', '', ''], persisted: false};
    if(!value || typeof value !== 'object' || Array.isArray(value)) return result;
    if([2, 3, 4].indexOf(value.count) !== -1) result.count = value.count;
    if(Array.isArray(value.selections)) value.selections.slice(0, 4).forEach(function(id, index){
      if(typeof id === 'string') result.selections[index] = id;
    });
    result.persisted = value.persisted === true;
    // Available-translation and duplicate repair remains with Compare's catalog logic.
    return result;
  }
  function speed(value){
    var number = Number(value);
    return speeds.indexOf(number) >= 0 ? number : 1;
  }
  function voice(value){ return typeof value === 'string' ? value : ''; }
  return {
    savedVerses: {
      load: function(){ return savedVerses(readJSON(keys.saved)); },
      save: function(value){ return storage.write(keys.saved, JSON.stringify(savedVerses(value))); }
    },
    plan: {
      load: function(){ return completedDays(readJSON(keys.plan)); },
      save: function(value){ return storage.write(keys.plan, JSON.stringify(completedDays(value))); }
    },
    translation: {
      load: function(){ return translation(storage.read(keys.translation)); },
      save: function(value){ return storage.write(keys.translation, translation(value)); }
    },
    compare: {
      load: function(){ return compare(readJSON(keys.compare)); },
      save: function(value){ return storage.write(keys.compare, JSON.stringify(compare(value))); }
    },
    speechSpeed: {
      load: function(){ return speed(storage.read(keys.speed)); },
      save: function(value){ return storage.write(keys.speed, String(speed(value))); }
    },
    // Voice names belong to this device; availability is checked by BibleSpeech.
    speechVoice: {
      load: function(){ return voice(storage.read(keys.voice)); },
      save: function(value){ return storage.write(keys.voice, voice(value)); }
    }
  };
})(LocalStorageProvider);
