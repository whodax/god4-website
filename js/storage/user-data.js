/* Domain boundary: existing keys and wire formats stay unchanged. */
var UserData = (function(storage){
  var keys = {
    saved: 'god4.savedVerses', plan: 'god4.plan.completedDays',
    translation: 'god4.translation', compare: 'god4.compare',
    speed: 'god4.speech.speed', voice: 'god4.speech.voice',
    readerPosition: 'god4.reader.position', journey: 'god4.plan.journey.v1'
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
  function journey(value){
    if(!value || typeof value !== 'object' || value.version !== 1) return null;
    var plans = Array.isArray(value.plans) ? value.plans.slice(0, 5).map(completedDays) : [];
    while(plans.length < 5) plans.push([]);
    var dates = Array.isArray(value.completedDates) ? Array.from(new Set(value.completedDates.filter(function(date){
      if(typeof date !== 'string' || !/^\d{4}-\d{2}-\d{2}$/.test(date)) return false;
      var parsed=new Date(date+'T00:00:00');
      return !isNaN(parsed.getTime()) && [parsed.getFullYear(),String(parsed.getMonth()+1).padStart(2,'0'),String(parsed.getDate()).padStart(2,'0')].join('-')===date;
    }))).sort() : [];
    return {version: 1, plans: plans, completedDates: dates};
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
  function readerPosition(value){
    if(!value || typeof value !== 'object' || Array.isArray(value) ||
      typeof value.bookId !== 'string' || !value.bookId.trim() ||
      !Number.isInteger(value.chapter) || value.chapter < 1){
      return {bookId: 'john', chapter: 1};
    }
    var result = {bookId: value.bookId, chapter: value.chapter};
    if(Number.isInteger(value.verse) && value.verse > 0) result.verse = value.verse;
    return result;
  }
  return {
    savedVerses: {
      load: function(){ return savedVerses(readJSON(keys.saved)); },
      save: function(value){ return storage.write(keys.saved, JSON.stringify(savedVerses(value))); }
    },
    plan: {
      load: function(){ return completedDays(readJSON(keys.plan)); },
      save: function(value){ return storage.write(keys.plan, JSON.stringify(completedDays(value))); }
    },
    journey: {
      load: function(){
        var raw=readJSON(keys.journey), stored = journey(raw);
        if(stored) return stored;
        var legacy = completedDays(readJSON(keys.plan));
        var migrated = {version: 1, plans: [legacy, [], [], [], []], completedDates: []};
        if(raw === null) storage.write(keys.journey, JSON.stringify(migrated));
        return migrated;
      },
      save: function(value){ var safe = journey(value); return safe ? storage.write(keys.journey, JSON.stringify(safe)) : false; }
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
    // Male or Female preference; BibleSpeech migrates older profile and device values.
    speechVoice: {
      load: function(){ return voice(storage.read(keys.voice)); },
      save: function(value){ return storage.write(keys.voice, voice(value)); }
    },
    readerPosition: {
      load: function(){ return readerPosition(readJSON(keys.readerPosition)); },
      save: function(value){ return storage.write(keys.readerPosition, JSON.stringify(readerPosition(value))); }
    }
  };
})(LocalStorageProvider);
