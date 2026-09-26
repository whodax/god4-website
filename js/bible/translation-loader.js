/* ===== ON-DEMAND BIBLE TRANSLATION LOADER ===== */
var BibleTranslationLoader = (function createBibleTranslationLoader(){
  var paths = {
    asv: 'js/bible/asv.js',
    kjv: 'js/bible/kjv.js',
    ylt: 'js/bible/ylt.js',
    dby: 'js/bible/dby.js',
    webster: 'js/bible/webster.js',
    rv: 'js/bible/rv.js',
    gnv: 'js/bible/gnv.js'
  };
  var requests = {};

  function isLoaded(translationId){
    return typeof BibleData !== 'undefined' && BibleData.isTranslationLoaded(translationId);
  }

  function ensure(translationId){
    if(isLoaded(translationId)) return Promise.resolve(true);
    if(!paths[translationId]) return Promise.resolve(false);
    if(requests[translationId]) return requests[translationId];

    requests[translationId] = new Promise(function(resolve){
      var script = document.createElement('script');

      function finish(loaded){
        if(!loaded){
          delete requests[translationId];
          script.remove();
        }
        resolve(loaded);
      }

      script.src = paths[translationId];
      script.async = true;
      script.setAttribute('data-bible-translation', translationId);
      script.addEventListener('load', function(){ finish(isLoaded(translationId)); }, {once:true});
      script.addEventListener('error', function(){ finish(false); }, {once:true});
      document.head.appendChild(script);
    });
    return requests[translationId];
  }

  return { ensure: ensure, isLoaded: isLoaded };
}());