/* Synchronous storage adapter. Failed writes remain usable for this visit. */
var LocalStorageProvider = (function(){
  var memory = new Map();
  var pending = new Set();
  return {
    read: function(key){
      if(pending.has(key)) return memory.get(key);
      try {
        var value = window.localStorage.getItem(key);
        memory.set(key, value);
        return value;
      } catch(error){
        return memory.has(key) ? memory.get(key) : null;
      }
    },
    write: function(key, value){
      memory.set(key, value);
      try {
        window.localStorage.setItem(key, value);
        pending.delete(key);
        return true;
      } catch(error){
        pending.add(key);
        return false;
      }
    },
    remove: function(key){
      memory.set(key, null);
      try {
        window.localStorage.removeItem(key);
        pending.delete(key);
        return true;
      } catch(error){
        pending.add(key);
        return false;
      }
    }
  };
})();
