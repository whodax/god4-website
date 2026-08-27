const COMPARE_STATE_KEY = 'god4.compare';
const compareState = { count: 2, selections: ['', '', '', ''], persisted: false };
const compareReference = { bookId: '', chapter: 1, verse: null };

function loadCompareState(){
  try {
    var stored = JSON.parse(localStorage.getItem(COMPARE_STATE_KEY) || '{}');
    if([2, 3, 4].indexOf(stored.count) !== -1) compareState.count = stored.count;
    if(Array.isArray(stored.selections)) stored.selections.slice(0, 4).forEach(function(value, index){ compareState.selections[index] = value; });
    compareState.persisted = stored.persisted === true;
  } catch(error) {}
}

function saveCompareState(){
  localStorage.setItem(COMPARE_STATE_KEY, JSON.stringify(compareState));
}

function syncCompareDefaultTranslation(){
  var compareView = document.getElementById('view-compare');
  if(compareState.persisted || (compareView && compareView.classList.contains('active'))) return;
  var translations = getCompareTranslations();
  if(!translations.some(function(translation){ return translation.id === currentTranslation; })) return;
  compareState.selections[0] = currentTranslation;
  var alternate = translations.find(function(translation){ return translation.id !== currentTranslation; });
  if(alternate) compareState.selections[1] = alternate.id;
  ensureCompareSelections();
}

function getCompareTranslations(){
  if(typeof BibleData === 'undefined') return [];
  return BibleData.listTranslations().filter(function(translation){
    return translation.provider !== 'demo-library' && BibleData.listBooks(translation.id).length > 0;
  }).map(function(translation){
    return { id: translation.id, abbreviation: translation.abbreviation || translation.id.toUpperCase(), name: translation.name };
  });
}

function getCompareBooks(){
  if(typeof BibleData === 'undefined') return [];
  var books = [];
  getCompareTranslations().forEach(function(translation){
    BibleData.listBooks(translation.id).forEach(function(book){
      if(!books.some(function(existing){ return existing.id === book.id; })) books.push(book);
    });
  });
  return books;
}

function getCompareChapter(translationId, bookId, chapter){
  var result = BibleData.getChapter(translationId, bookId, chapter);
  if(result) return result;
  var fallback = getCompareTranslations().find(function(translation){
    return translation.id !== translationId && BibleData.getChapter(translation.id, bookId, chapter);
  });
  return fallback ? BibleData.getChapter(fallback.id, bookId, chapter) : null;
}

function getCompareChapterCount(bookId){
  return getCompareTranslations().reduce(function(maximum, translation){
    return Math.max(maximum, BibleData.getChapterCount(translation.id, bookId));
  }, 0);
}

function getReaderCompareReference(){
  var verseSelect = document.getElementById('verseSelect');
  var selectedVerse = verseSelect && verseSelect.value ? Number(verseSelect.value) : null;
  return { bookId: currentBook, chapter: Number(currentChapter) || 1, verse: Number.isInteger(selectedVerse) ? selectedVerse : null };
}

function getCompareReference(){
  return { bookId: compareReference.bookId, chapter: compareReference.chapter, verse: compareReference.verse };
}

function getReferenceBookName(reference){
  var book = getCompareBooks().find(function(item){ return item.id === reference.bookId; });
  return book ? book.name : reference.bookId;
}

function getReferenceLabel(reference){
  var label = getReferenceBookName(reference) + ' ' + reference.chapter;
  return reference.verse ? label + ':' + reference.verse : label;
}

function setCompareReference(reference){
  var books = getCompareBooks();
  var book = books.find(function(item){ return item.id === reference.bookId; }) || books[0];
  if(!book) return;
  var chapterCount = getCompareChapterCount(book.id);
  var chapter = Number(reference.chapter);
  if(!Number.isInteger(chapter) || chapter < 1 || chapter > chapterCount) chapter = 1;
  var chapterData = getCompareChapter(currentTranslation, book.id, chapter);
  var verse = reference.verse;
  if(verse !== null){
    if(!Number.isInteger(verse) || !chapterData) verse = null;
    else verse = Math.min(Math.max(verse, 1), chapterData.verses.length);
  }
  compareReference.bookId = book.id;
  compareReference.chapter = chapter;
  compareReference.verse = verse;
}

function populateCompareBooks(){
  var select = document.getElementById('compareBook');
  if(!select) return;
  select.innerHTML = '';
  getCompareBooks().forEach(function(book){
    var option = document.createElement('option');
    option.value = book.id;
    option.textContent = book.name;
    select.appendChild(option);
  });
  select.value = compareReference.bookId;
}

function populateCompareChapters(){
  var select = document.getElementById('compareChapter');
  if(!select) return;
  var chapterCount = getCompareChapterCount(compareReference.bookId);
  select.innerHTML = '';
  for(var chapter = 1; chapter <= chapterCount; chapter++){
    var option = document.createElement('option');
    option.value = String(chapter);
    option.textContent = 'Chapter ' + chapter;
    select.appendChild(option);
  }
  select.value = String(compareReference.chapter);
}

function populateCompareVerses(){
  var select = document.getElementById('compareVerse');
  if(!select) return;
  var chapter = getCompareChapter(currentTranslation, compareReference.bookId, compareReference.chapter);
  select.innerHTML = '<option value="">Whole chapter</option>';
  if(!chapter) return;
  chapter.verses.forEach(function(_, index){
    var option = document.createElement('option');
    option.value = String(index + 1);
    option.textContent = 'Verse ' + (index + 1);
    select.appendChild(option);
  });
  select.value = compareReference.verse ? String(compareReference.verse) : '';
}

function syncCompareControls(){
  populateCompareBooks();
  populateCompareChapters();
  populateCompareVerses();
}

function initializeCompareReference(){
  setCompareReference(getReaderCompareReference());
  syncCompareControls();
}

function syncCompareFromReader(){
  var compareView = document.getElementById('view-compare');
  if(!compareView || !compareView.classList.contains('active')) return;
  initializeCompareReference();
  loadCompare();
}

function ensureCompareSelections(){
  var translations = getCompareTranslations();
  if(!translations.length) return;
  for(var index = 0; index < 4; index++){
    var valid = translations.some(function(translation){ return translation.id === compareState.selections[index]; });
    var duplicate = compareState.selections.slice(0, index).indexOf(compareState.selections[index]) !== -1;
    if(!valid || duplicate){
      var alternate = translations.find(function(translation){ return compareState.selections.indexOf(translation.id) === -1; });
      compareState.selections[index] = alternate ? alternate.id : translations[index % translations.length].id;
    }
  }
  saveCompareState();
}

function getCompareVerses(translationId){
  if(typeof BibleData === 'undefined') return null;
  var reference = getCompareReference();
  var chapter = BibleData.getChapter(translationId, reference.bookId, reference.chapter);
  if(!chapter) return null;
  if(reference.verse){
    var verse = BibleData.getVerse(translationId, reference.bookId, reference.chapter, reference.verse);
    return verse ? [{ number: verse.verse, text: verse.text }] : null;
  }
  return chapter.verses.map(function(text, index){ return { number: index + 1, text: text }; });
}

function updateCompareSummary(){
  var summary = document.getElementById('compareSummary');
  if(summary) summary.textContent = 'Comparing ' + getReferenceLabel(getCompareReference());
}

function getCompareChapterReference(bookIndex, chapter){
  var books = getCompareBooks();
  if(bookIndex < 0 || bookIndex >= books.length) return null;
  var book = books[bookIndex];
  var chapterCount = getCompareChapterCount(book.id);
  if(chapter < 1 || chapter > chapterCount) return null;
  return { bookIndex: bookIndex, bookId: book.id, chapter: chapter };
}

function getAdjacentCompareChapter(direction){
  var books = getCompareBooks();
  var bookIndex = books.findIndex(function(book){ return book.id === compareReference.bookId; });
  if(bookIndex < 0) return null;
  var chapter = compareReference.chapter + direction;
  var nextBookIndex = bookIndex;
  if(chapter < 1){
    nextBookIndex--;
    if(nextBookIndex < 0) return null;
    chapter = getCompareChapterCount(books[nextBookIndex].id);
  } else if(chapter > getCompareChapterCount(books[bookIndex].id)){
    nextBookIndex++;
    if(nextBookIndex >= books.length) return null;
    chapter = 1;
  }
  var reference = getCompareChapterReference(nextBookIndex, chapter);
  if(!reference || !compareReference.verse) return reference;
  var destination = getCompareChapter(currentTranslation, reference.bookId, reference.chapter);
  if(!destination) return reference;
  reference.verse = Math.min(compareReference.verse, destination.verses.length);
  return reference;
}

function getAdjacentCompareVerse(direction){
  var books = getCompareBooks();
  var bookIndex = books.findIndex(function(book){ return book.id === compareReference.bookId; });
  if(bookIndex < 0 || !compareReference.verse) return null;
  var chapter = getCompareChapter(currentTranslation, compareReference.bookId, compareReference.chapter);
  var verse = compareReference.verse + direction;
  if(verse < 1){
    var previousChapter = getAdjacentCompareChapter(-1);
    if(!previousChapter) return null;
    var previousData = getCompareChapter(currentTranslation, previousChapter.bookId, previousChapter.chapter);
    return { bookId: previousChapter.bookId, chapter: previousChapter.chapter, verse: previousData.verses.length };
  }
  if(!chapter || verse > chapter.verses.length){
    var nextChapter = getAdjacentCompareChapter(1);
    if(!nextChapter) return null;
    return { bookId: nextChapter.bookId, chapter: nextChapter.chapter, verse: 1 };
  }
  return { bookId: compareReference.bookId, chapter: compareReference.chapter, verse: verse };
}

function updateCompareNavigation(){
  var chapterPrevious = document.getElementById('compareChapterPrevious');
  var chapterNext = document.getElementById('compareChapterNext');
  var versePrevious = document.getElementById('compareVersePrevious');
  var verseNext = document.getElementById('compareVerseNext');
  if(!chapterPrevious || !chapterNext || !versePrevious || !verseNext) return;
  var isVerseMode = Boolean(compareReference.verse);
  chapterPrevious.disabled = !Boolean(getAdjacentCompareChapter(-1));
  chapterNext.disabled = !Boolean(getAdjacentCompareChapter(1));
  versePrevious.disabled = !isVerseMode || !Boolean(getAdjacentCompareVerse(-1));
  verseNext.disabled = !isVerseMode || !Boolean(getAdjacentCompareVerse(1));
}

function navigateCompareReference(target){
  if(!target) return;
  setCompareReference(target);
  syncCompareControls();
  loadCompare();
}

function navigateCompareChapter(direction){
  navigateCompareReference(getAdjacentCompareChapter(direction));
}

function navigateCompareVerse(direction){
  if(!compareReference.verse) return;
  navigateCompareReference(getAdjacentCompareVerse(direction));
}

function renderCompareColumn(translationId, index){
  var translation = getCompareTranslations().find(function(item){ return item.id === translationId; });
  if(!translation) return '';
  var verses = getCompareVerses(translationId);
  var content = '<div class="compare-col"><div class="compare-col-header">';
  var label = index === 0 ? 'Left translation' : index === 1 ? 'Right translation' : 'Comparison edition ' + (index + 1);
  var side = index === 0 ? 'left' : index === 1 ? 'right' : '';
  content += '<select aria-label="' + label + '" data-compare-index="' + index + '"' + (side ? ' data-compare-side="' + side + '"' : '') + '>';
  getCompareTranslations().forEach(function(item){
    var selected = item.id === translationId ? ' selected' : '';
    content += '<option value="' + escapeHtml(item.id) + '"' + selected + '>' + escapeHtml(item.abbreviation + ' - ' + item.name) + '</option>';
  });
  content += '</select></div><div class="compare-text">';
  if(!verses){
    content += '<p class="compare-unavailable">Passage unavailable in this translation.</p>';
  } else {
    verses.forEach(function(verse){
      content += '<p><span class="vnum">' + escapeHtml(verse.number) + '</span>' + escapeHtml(verse.text) + '</p>';
    });
  }
  return content + '</div></div>';
}

function loadCompare(){
  var grid = document.getElementById('compareGrid');
  if(!grid) return;
  ensureCompareSelections();
  updateCompareSummary();
  updateCompareNavigation();
  var columns = [];
  for(var index = 0; index < compareState.count; index++) columns.push(renderCompareColumn(compareState.selections[index], index));
  grid.innerHTML = columns.join('');
  grid.classList.remove('compare-grid--3', 'compare-grid--4');
  if(compareState.count > 2) grid.classList.add('compare-grid--' + compareState.count);
  updateCompareEditionControl();
  grid.querySelectorAll('[data-compare-index]').forEach(function(select){
    select.addEventListener('change', function(){
      var index = Number(select.getAttribute('data-compare-index'));
      var otherIndex = compareState.selections.indexOf(select.value);
      if(otherIndex !== -1 && otherIndex !== index){
        compareState.selections[otherIndex] = compareState.selections[index];
      }
      compareState.selections[index] = select.value;
      compareState.persisted = true;
      saveCompareState();
      loadCompare();
    });
  });
}

function updateCompareEditionControl(){
  document.querySelectorAll('[data-compare-count]').forEach(function(button){
    var count = Number(button.getAttribute('data-compare-count'));
    button.setAttribute('aria-pressed', count === compareState.count ? 'true' : 'false');
    button.disabled = count > getCompareTranslations().length;
  });
}

function setCompareEditionCount(count){
  if([2, 3, 4].indexOf(count) === -1 || count > getCompareTranslations().length) return;
  compareState.count = count;
  compareState.persisted = true;
  ensureCompareSelections();
  saveCompareState();
  loadCompare();
}

function updateCompareReferenceFromControls(changedId){
  var book = document.getElementById('compareBook');
  var chapter = document.getElementById('compareChapter');
  var verse = document.getElementById('compareVerse');
  if(changedId === 'compareBook'){
    compareReference.bookId = book.value;
  } else if(changedId === 'compareChapter'){
    compareReference.chapter = Number(chapter.value);
  } else if(changedId === 'compareVerse'){
    compareReference.verse = verse.value ? Number(verse.value) : null;
  }
  setCompareReference(getCompareReference());
  syncCompareControls();
  loadCompare();
}

window.addEventListener('DOMContentLoaded', function(){
  loadCompareState();
  initializeCompareReference();
  ensureCompareSelections();
  loadCompare();
  ['compareBook', 'compareChapter', 'compareVerse'].forEach(function(id){
    var element = document.getElementById(id);
    if(element) element.addEventListener('change', function(){ updateCompareReferenceFromControls(id); });
  });
  document.querySelectorAll('[data-compare-count]').forEach(function(button){
    button.addEventListener('click', function(){ setCompareEditionCount(Number(button.getAttribute('data-compare-count'))); });
  });
  ['bookSelect', 'chapterSelect', 'verseSelect', 'readerTranslation'].forEach(function(id){
    var element = document.getElementById(id);
    if(element) element.addEventListener('change', id === 'readerTranslation' ? function(){ syncCompareDefaultTranslation(); syncCompareFromReader(); } : syncCompareFromReader);
  });
});
