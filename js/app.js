/* ===== GENERAL GOD4.US APPLICATION ===== */
const verses = [
  {ref:"John 3:16", text:"For God so loved the world, that he gave his only begotten Son, that whosoever believeth in him should not perish, but have everlasting life."},
  {ref:"Psalm 23:1-2", text:"The Lord is my shepherd; I shall not want. He maketh me to lie down in green pastures."},
  {ref:"Proverbs 3:5", text:"Trust in the Lord with all thine heart; and lean not unto thine own understanding."},
  {ref:"Philippians 4:13", text:"I can do all things through Christ which strengtheneth me."},
  {ref:"Genesis 1:1", text:"In the beginning God created the heaven and the earth."},
  {ref:"Hebrews 11:1", text:"Now faith is the substance of things hoped for, the evidence of things not seen."},
  {ref:"Psalm 46:10", text:"Be still, and know that I am God."},
  {ref:"Romans 8:28", text:"And we know that all things work together for good to them that love God, to them that are the called according to his purpose."},
  {ref:"Isaiah 41:10", text:"Fear thou not; for I am with thee: be not dismayed; for I am thy God."},
  {ref:"Joshua 1:9", text:"Have not I commanded thee? Be strong and of a good courage; be not afraid, neither be thou dismayed: for the Lord thy God is with thee whithersoever thou goest."},
];

let idx = 0;
let saved = [];

function renderLeaf(){
  const v = verses[idx];
  const dropcap = document.getElementById('dropcap');
  const verseText = document.getElementById('verseText');
  const verseRef = document.getElementById('verseRef');
  const heroFav = document.getElementById('heroFav');
  if(!v || !dropcap || !verseText || !verseRef || !heroFav) return;
  const first = v.text.charAt(0);
  dropcap.textContent = first;
  verseText.textContent = v.text.slice(1);
  verseRef.textContent = v.ref;
  heroFav.classList.toggle('active', isSaved(v.ref));
  heroFav.textContent = isSaved(v.ref) ? '♥' : '♡';
  heroFav.setAttribute('aria-pressed', isSaved(v.ref) ? 'true' : 'false');
}

function nextVerse(){
  const card = document.getElementById('leafCard');
  card.style.opacity = 0;
  setTimeout(function(){
    idx = (idx+1) % verses.length;
    renderLeaf();
    card.style.opacity = 1;
  }, 200);
}

function isSaved(ref){ return saved.some(function(s){ return s.ref === ref; }); }

function toggleFav(ref, text, btnEl){
  if(isSaved(ref)){
    saved = saved.filter(function(s){ return s.ref !== ref; });
  } else {
    saved.push({ref:ref, text:text});
  }
  var savedCount = document.getElementById('savedCount');
  if(savedCount) savedCount.textContent = saved.length;
  renderTray();
  renderLeaf();
  if(btnEl){
    btnEl.classList.toggle('active');
    btnEl.textContent = isSaved(ref) ? '♥' : '♡';
    btnEl.setAttribute('aria-pressed', isSaved(ref) ? 'true' : 'false');
  }
}

function toggleFavFromHero(){
  var v = verses[idx];
  toggleFav(v.ref, v.text, document.getElementById('heroFav'));
}

function doSearch(){
  var q = document.getElementById('searchInput').value.trim().toLowerCase();
  var box = document.getElementById('results');
  box.innerHTML = '';
  if(!q){ return; }
  var matches = verses.filter(function(v){ return v.text.toLowerCase().indexOf(q) !== -1 || v.ref.toLowerCase().indexOf(q) !== -1; });
  if(matches.length === 0){
    box.innerHTML = '<div class="no-results">No verses matched in this demo set — the live version would search the full Bible text.</div>';
    return;
  }
  matches.forEach(function(v, i){
    var card = document.createElement('div');
    card.className = 'result-card';
    card.style.animationDelay = (i*0.05)+'s';
    var favChar = isSaved(v.ref) ? '♥' : '♡';
    var favClass = isSaved(v.ref) ? 'fav-btn active' : 'fav-btn';
    var safeRef = v.ref.replace(/'/g, "\\'");
    var safeText = v.text.replace(/\\/g, '\\\\').replace(/'/g, "\\'");
    card.innerHTML = '<div><div class="txt">"' + v.text + '"</div><div class="ref">' + v.ref + '</div></div><button class="' + favClass + '" onclick="toggleFav(\'' + safeRef + '\', \'' + safeText + '\', this)">' + favChar + '</button>';
    box.appendChild(card);
  });
}

function renderTray(){
  var list = document.getElementById('trayList');
  var empty = document.getElementById('trayEmpty');
  list.innerHTML = '';
  empty.style.display = saved.length ? 'none' : 'block';
  saved.forEach(function(v){
    var row = document.createElement('div');
    row.style.cssText = 'border-bottom:1px solid var(--line);padding-bottom:12px;';
    var safeRef = v.ref.replace(/'/g, "\\'");
    row.innerHTML = '<div style="font-style:italic;font-size:14px;line-height:1.4;">"' + v.text + '"</div><div style="display:flex;justify-content:space-between;align-items:center;margin-top:6px;"><span style="font-family:\'Inter\',sans-serif;font-size:11px;text-transform:uppercase;letter-spacing:.05em;color:var(--ink-soft);">' + v.ref + '</span><button onclick="toggleFav(\'' + safeRef + '\')" style="background:none;border:none;color:var(--oxblood);font-size:12px;cursor:pointer;font-family:\'Inter\',sans-serif;">Remove</button></div>';
    list.appendChild(row);
  });
}

var trayOpen = false;
function toggleTray(){
  trayOpen = !trayOpen;
  var tray = document.getElementById('tray');
  var savedPill = document.querySelector('.saved-pill');
  if(!tray) return;
  tray.style.right = trayOpen ? '0' : '-360px';
  tray.setAttribute('aria-hidden', trayOpen ? 'false' : 'true');
  if(savedPill) savedPill.setAttribute('aria-expanded', trayOpen ? 'true' : 'false');
  if(trayOpen){
    var closeButton = document.getElementById('closeTray');
    if(closeButton) closeButton.focus();
  } else if(savedPill){
    savedPill.focus();
  }
}

/* ===== INIT ===== */
window.addEventListener('DOMContentLoaded', function(){
  if(typeof populateChapters === 'function') populateChapters();
  if(typeof loadPassage === 'function') loadPassage();
  if(typeof loadCompare === 'function') loadCompare();
  if(typeof renderPlan === 'function') renderPlan();
  renderLeaf();
});
