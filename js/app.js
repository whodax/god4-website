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
const SEARCH_BATCH_SIZE = 10;
let searchMatches = [];
let searchVisibleCount = 0;
let searchStatus = '';
let searchTranslationId = '';

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

function getSearchTranslations(){
  var translations = typeof BibleData === 'undefined' ? [] : BibleData.listTranslations().filter(function(translation){
    return translation.provider !== 'demo-library' && BibleData.listBooks(translation.id).length > 0;
  });
  return translations;
}

function populateSearchTranslations(){
  var select = document.getElementById('searchTranslation');
  var translations = getSearchTranslations();
  if(!select || !translations.length) return;
  select.innerHTML = '';
  translations.forEach(function(translation){
    var option = document.createElement('option');
    option.value = translation.id;
    option.textContent = translation.abbreviation;
    select.appendChild(option);
  });
  searchTranslationId = translations.some(function(translation){ return translation.id === currentTranslation; }) ? currentTranslation : translations[0].id;
  select.value = searchTranslationId;
}

function getSearchTranslation(){
  var translations = getSearchTranslations();
  if(!translations.length) return null;
  var selected = document.getElementById('searchTranslation');
  searchTranslationId = selected && translations.some(function(translation){ return translation.id === selected.value; }) ? selected.value : searchTranslationId;
  return translations.find(function(translation){ return translation.id === searchTranslationId; }) || translations.find(function(translation){ return translation.id === currentTranslation; }) || translations[0];
}

function parseSearchReference(query, translationId){
  var cleaned = String(query || '').trim().replace(/[()]/g, '').replace(/[?!.]+$/g, '').replace(/^\s*(?:show me|what does|tell me about|open|go to)\s+/i, '').replace(/\s+(?:say|please)$/i, '').trim();
  var books = BibleData.listBooks(translationId).sort(function(first, second){ return second.name.length - first.name.length; });
  for(var index = 0; index < books.length; index++){
    var book = books[index];
    var match = new RegExp('^' + book.name.replace(/[.*+?^${}()|[\]\\]/g, '\\$&') + '\\s+(?:chapter\\s+)?(\\d+)(?:(?:\\s*:\\s*|\\s+verse\\s+|\\s+)(\\d+))?$', 'i').exec(cleaned);
    if(match){
      return { bookId: book.id, bookName: book.name, chapter: Number(match[1]), verse: match[2] ? Number(match[2]) : null };
    }
  }
  return null;
}

function navigateSearchResult(result){
  if(!result) return;
  var book = BibleData.listBooks(result.translationId || currentTranslation).find(function(item){ return item.id === result.bookId; });
  if(!book || typeof navigateToSpokenBook !== 'function') return;
  var previousTranslation = currentTranslation;
  if(result.translationId && result.translationId !== currentTranslation && typeof changeTranslation === 'function') changeTranslation(result.translationId);
  navigateToSpokenBook(book.name, result.chapter, result.isChapter ? undefined : result.verse);
  document.getElementById('companion').scrollIntoView({ behavior: 'smooth', block: 'start' });
}

function createSearchResultCard(result, index){
  var card = document.createElement('button');
  card.type = 'button';
  card.className = 'result-card result-card-button';
  card.style.animationDelay = (index * 0.03) + 's';
  var reference = result.isChapter ? result.bookName + ' ' + result.chapter : result.bookName + ' ' + result.chapter + ':' + result.verse;
  card.innerHTML = '<span><span class="txt">&quot;' + escapeHtml(result.text) + '&quot;</span><span class="ref">' + escapeHtml(reference) + ' <small>' + escapeHtml(result.translationAbbreviation || '') + '</small></span></span><span class="result-open">Open</span>';
  card.addEventListener('click', function(){ navigateSearchResult(result); });
  return card;
}

function renderSearchResults(){
  var box = document.getElementById('results');
  if(!box) return;
  box.innerHTML = '';
  var visibleMatches = searchMatches.slice(0, searchVisibleCount);
  visibleMatches.forEach(function(match, index){ box.appendChild(createSearchResultCard(match, index)); });
  if(searchMatches.length){
    var status = document.createElement('div');
    status.className = 'search-status';
    status.textContent = 'Showing ' + visibleMatches.length + ' of ' + searchMatches.length + ' matches';
    box.appendChild(status);
  }
  if(searchVisibleCount < searchMatches.length){
    var more = document.createElement('button');
    more.type = 'button';
    more.className = 'search-more';
    more.textContent = 'Show more';
    more.addEventListener('click', function(){
      searchVisibleCount = Math.min(searchVisibleCount + SEARCH_BATCH_SIZE, searchMatches.length);
      renderSearchResults();
    });
    box.appendChild(more);
  }
}

function clearSearch(){
  var input = document.getElementById('searchInput');
  var box = document.getElementById('results');
  if(input) input.value = '';
  searchMatches = [];
  searchVisibleCount = 0;
  searchStatus = '';
  if(box) box.innerHTML = '';
}

function doSearch(){
  var query = document.getElementById('searchInput').value.trim();
  var box = document.getElementById('results');
  if(!query){ clearSearch(); return; }
  searchMatches = [];
  searchVisibleCount = 0;
  searchStatus = '';
  box.innerHTML = '';
  var translation = getSearchTranslation();
  if(!translation){
    box.innerHTML = '<div class="no-results">Search is unavailable because no complete translation is loaded.</div>';
    return;
  }
  var reference = parseSearchReference(query, translation.id);
  var matches = [];
  if(reference){
    var chapter = BibleData.getChapter(translation.id, reference.bookId, reference.chapter);
    if(chapter && reference.verse === null){
      matches = chapter.verses.map(function(text, index){ return { translationId: translation.id, translationAbbreviation: translation.abbreviation, bookId: reference.bookId, bookName: chapter.bookName, chapter: reference.chapter, verse: index + 1, isChapter: index === 0, text: text }; });
    } else if(chapter && BibleData.getVerse(translation.id, reference.bookId, reference.chapter, reference.verse)){
      var verse = BibleData.getVerse(translation.id, reference.bookId, reference.chapter, reference.verse);
      matches = [{ translationId: translation.id, translationAbbreviation: translation.abbreviation, bookId: reference.bookId, bookName: chapter.bookName, chapter: reference.chapter, verse: reference.verse, text: verse.text }];
    }
  } else {
    var keyword = query.replace(/^(?:show me|what does|tell me about)\s+/i, '').replace(/\s+(?:say|please)$/i, '').trim();
    matches = BibleData.search(translation.id, keyword).sort(function(first, second){
      var exactPattern = new RegExp('(^|[^a-z])' + keyword.replace(/[.*+?^${}()|[\]\\]/g, '\\$&') + '([^a-z]|$)', 'i');
      return Number(exactPattern.test(second.text)) - Number(exactPattern.test(first.text));
    }).map(function(match){
      match.translationAbbreviation = translation.abbreviation;
      return match;
    });
  }
  if(!matches.length){
    box.innerHTML = '<div class="no-results">No verses matched in ' + escapeHtml(translation.abbreviation) + '.</div>';
    return;
  }
  searchMatches = matches;
  searchVisibleCount = Math.min(SEARCH_BATCH_SIZE, searchMatches.length);
  renderSearchResults();
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
  var searchInput = document.getElementById('searchInput');
  if(searchInput) searchInput.addEventListener('input', function(){
    if(!searchInput.value.trim()) clearSearch();
  });
  populateSearchTranslations();
  var searchTranslation = document.getElementById('searchTranslation');
  if(searchTranslation) searchTranslation.addEventListener('change', function(){ searchTranslationId = searchTranslation.value; });
  var brandMark = document.getElementById('brandMark');
  if(brandMark){
    var pulseBrandMark = function(){
      brandMark.classList.remove('brand-mark--pulse');
      void brandMark.offsetWidth;
      brandMark.classList.add('brand-mark--pulse');
    };
    brandMark.addEventListener('click', pulseBrandMark);
    requestAnimationFrame(function(){ pulseBrandMark(); });
  }
  if(typeof populateTranslations === 'function') populateTranslations();
  if(typeof populateBooks === 'function') populateBooks();
  if(typeof populateChapters === 'function') populateChapters();
  if(typeof loadPassage === 'function') loadPassage();
  if(typeof loadCompare === 'function') loadCompare();
  if(typeof renderPlan === 'function') renderPlan();
  renderLeaf();
});
