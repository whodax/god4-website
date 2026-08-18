/* ===== SCRIPTURE COMPANION STATE & FUNCTIONS ===== */
let currentBook = 'john';
let currentChapter = 1;

function switchView(view, btn){
  document.querySelectorAll('.bs-view').forEach(function(v){ v.classList.remove('active'); });
  document.getElementById('view-' + view).classList.add('active');
  document.querySelectorAll('.bs-btn').forEach(function(b){ b.classList.remove('active'); });
  btn.classList.add('active');
}

function populateChapters(){
  var book = document.getElementById('bookSelect').value;
  var sel = document.getElementById('chapterSelect');
  sel.innerHTML = '';
  for(var i = 1; i <= library[book].chapters; i++){
    sel.innerHTML += '<option>' + i + '</option>';
  }
}

function renderPassage(bookKey, chapterNum, containerId){
  var data = library[bookKey][chapterNum];
  var bookName = library[bookKey].name;
  var html = '<h2>' + bookName + ' ' + chapterNum + '</h2>';
  if(data.subtitle) html += '<div class="subtitle">' + data.subtitle + '</div>';
  html += '<div style="text-align:center;color:var(--ink-soft);font-size:14px;margin-bottom:20px;font-style:italic;">' + data.title + '</div>';
  for(var i = 0; i < data.verses.length; i++){
    html += '<span class="vnum" onclick="highlightVerse(this)">' + (i+1) + '</span>' + data.verses[i] + ' ';
  }
  document.getElementById(containerId).innerHTML = html;
  document.getElementById('fsTitle').textContent = bookName + ' ' + chapterNum;
  document.getElementById('fsContent').innerHTML = html;
}

function loadPassage(){
  currentBook = document.getElementById('bookSelect').value;
  currentChapter = parseInt(document.getElementById('chapterSelect').value);
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
  document.getElementById('fsOverlay').classList.toggle('active');
}
