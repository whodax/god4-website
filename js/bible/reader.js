/* ===== SCRIPTURE COMPANION STATE & FUNCTIONS ===== */
let currentBook = 'john';
let currentChapter = 1;

function switchView(view, btn){
  document.querySelectorAll('.bs-view').forEach(function(v){ v.classList.remove('active'); });
  var target = document.getElementById('view-' + view);
  if(!target || !btn) return;
  target.classList.add('active');
  document.querySelectorAll('.bs-btn').forEach(function(b){ b.classList.remove('active'); });
  document.querySelectorAll('.bs-btn[aria-pressed]').forEach(function(b){ b.setAttribute('aria-pressed', 'false'); });
  btn.classList.add('active');
  btn.setAttribute('aria-pressed', 'true');
}

function populateChapters(){
  var bookSelect = document.getElementById('bookSelect');
  var sel = document.getElementById('chapterSelect');
  if(!bookSelect || !sel || !library[bookSelect.value]) return;
  var book = bookSelect.value;
  sel.innerHTML = '';
  for(var i = 1; i <= library[book].chapters; i++){
    sel.innerHTML += '<option>' + i + '</option>';
  }
}

function renderPassage(bookKey, chapterNum, containerId){
  if(!library[bookKey] || !library[bookKey][chapterNum]) return;
  var data = library[bookKey][chapterNum];
  var bookName = library[bookKey].name;
  var html = '<h2>' + bookName + ' ' + chapterNum + '</h2>';
  if(data.subtitle) html += '<div class="subtitle">' + data.subtitle + '</div>';
  html += '<div style="text-align:center;color:var(--ink-soft);font-size:14px;margin-bottom:20px;font-style:italic;">' + data.title + '</div>';
  for(var i = 0; i < data.verses.length; i++){
    html += '<button type="button" class="vnum" aria-label="Highlight verse ' + (i+1) + '" onclick="highlightVerse(this)">' + (i+1) + '</button>' + data.verses[i] + ' ';
  }
  var container = document.getElementById(containerId);
  var fsTitle = document.getElementById('fsTitle');
  var fsContent = document.getElementById('fsContent');
  if(container) container.innerHTML = html;
  if(fsTitle) fsTitle.textContent = bookName + ' ' + chapterNum;
  if(fsContent) fsContent.innerHTML = html;
}

function loadPassage(){
  var bookSelect = document.getElementById('bookSelect');
  var chapterSelect = document.getElementById('chapterSelect');
  if(!bookSelect || !chapterSelect || !library[bookSelect.value]) return;
  currentBook = bookSelect.value;
  currentChapter = parseInt(chapterSelect.value, 10);
  if(!library[currentBook][currentChapter]) return;
  renderPassage(currentBook, currentChapter, 'readerContent');
}

function prevChapter(){
  if(currentChapter > 1){
    currentChapter--;
    document.getElementById('chapterSelect').value = currentChapter;
    loadPassage();
  }
}
function nextChapter(){
  if(currentChapter < library[currentBook].chapters){
    currentChapter++;
    document.getElementById('chapterSelect').value = currentChapter;
    loadPassage();
  }
}

function highlightVerse(el){
  el.classList.toggle('highlighted');
}

function toggleFullscreen(){
  var overlay = document.getElementById('fsOverlay');
  var fullscreenButton = document.getElementById('fullscreenBtn');
  if(!overlay) return;
  overlay.classList.toggle('active');
  var isActive = overlay.classList.contains('active');
  overlay.setAttribute('aria-hidden', isActive ? 'false' : 'true');
  if(fullscreenButton) fullscreenButton.setAttribute('aria-pressed', isActive ? 'true' : 'false');
}
