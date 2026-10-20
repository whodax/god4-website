(function(){
  var root=document.documentElement,key='god4.theme',mode='light',frame;
  function apply(value){
    cancelAnimationFrame(frame);root.classList.add('theme-changing');
    mode=value==='dark'?'dark':'light';root.dataset.theme=mode;
    frame=requestAnimationFrame(function(){frame=requestAnimationFrame(function(){root.classList.remove('theme-changing');});});
    document.querySelectorAll('[data-theme-toggle]').forEach(function(button){
      button.setAttribute('aria-label','Switch to '+(mode==='dark'?'Light':'Dark')+' Mode');
      button.setAttribute('aria-pressed',String(mode==='dark'));
    });
  }
  try{mode=localStorage.getItem(key);}catch(error){}
  apply(mode);
  var observer=new MutationObserver(function(){if(document.querySelector('[data-theme-toggle]')){observer.disconnect();apply(mode);}});
  observer.observe(root,{childList:true,subtree:true});
  document.addEventListener('DOMContentLoaded',function(){observer.disconnect();apply(mode);},{once:true});
  document.addEventListener('click',function(event){
    if(!event.target.closest('[data-theme-toggle]'))return;
    apply(mode==='dark'?'light':'dark');
    try{localStorage.setItem(key,mode);}catch(error){}
  });
  window.addEventListener('storage',function(event){
    if(event.key!==key&&event.key!==null)return;
    try{if(event.storageArea!==localStorage)return;}catch(error){return;}
    try{apply(localStorage.getItem(key));}catch(error){}
  });
})();
