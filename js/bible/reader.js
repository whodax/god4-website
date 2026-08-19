/* ===== SCRIPTURE COMPANION STATE & FUNCTIONS ===== */
let currentBook = 'john';
let currentChapter = 1;
const currentTranslation = 'demo-local';

function escapeHtml(value){
  return String(value).replace(/[&<>"']/g, function(character){
    return {'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[character];
  });
}

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

function populateBooks(){
  var bookSelect = document.getElementById('bookSelect');
  if(!bookSelect || typeof BibleData === 'undefined') return;
  bookSelect.innerHTML = '';
  BibleData.listBooks(currentTranslation).forEach(function(book){
    var option = document.createElement('option');
    option.value = book.id;
    option.textContent = book.name;
    bookSelect.appendChild(option);
  });
}

function populateChapters(){
  var bookSelect = document.getElementById('bookSelect');
  var sel = document.getElementById('chapterSelect');
  if(!bookSelect || !sel || typeof BibleData === 'undefined') return;
  var book = bookSelect.value;
  sel.innerHTML = '';
  for(var i = 1; i <= BibleData.getChapterCount(currentTranslation, book); i++){
    sel.innerHTML += '<option>' + i + '</option>';
  }
}

function renderPassage(bookKey, chapterNum, containerId){
  var data = BibleData.getChapter(currentTranslation, bookKey, chapterNum);
  if(!data) return;
  var bookName = escapeHtml(data.bookName);
  var html = '<h2>' + bookName + ' ' + escapeHtml(chapterNum) + '</h2>';
  if(data.subtitle) html += '<div class="subtitle">' + escapeHtml(data.subtitle) + '</div>';
  html += '<div style="text-align:center;color:var(--ink-soft);font-size:14px;margin-bottom:20px;font-style:italic;">' + escapeHtml(data.title) + '</div>';
  for(var i = 0; i < data.verses.length; i++){
    html += '<button type="button" class="vnum" aria-label="Highlight verse ' + escapeHtml(i+1) + '" onclick="highlightVerse(this)">' + escapeHtml(i+1) + '</button>' + escapeHtml(data.verses[i]) + ' ';
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
  if(!bookSelect || !chapterSelect || typeof BibleData === 'undefined') return;
  currentBook = bookSelect.value;
  currentChapter = parseInt(chapterSelect.value, 10);
  if(!BibleData.getChapter(currentTranslation, currentBook, currentChapter)) return;
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
  if(currentChapter < BibleData.getChapterCount(currentTranslation, currentBook)){
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
