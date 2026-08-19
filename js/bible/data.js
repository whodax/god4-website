/* ===== BIBLE DATA ACCESS =====
 * The current library is a small local/demo dataset. It is not a complete
 * Bible, and its source and licensing status still require verification.
 *
 * A future provider can implement the same methods for static files, a
 * permitted API, or offline application storage without changing reader code.
 */
const BibleData = (function createBibleDataAccess(){
  const translations = [{
    id: 'demo-local',
    name: 'Current Demo Bible',
    abbreviation: 'DEMO',
    language: 'English',
    source: 'Unknown — source documentation is required',
    copyrightStatus: 'Unknown — licensing verification is required',
    attribution: 'Not documented in this repository',
    licensingNotes: 'Do not treat this dataset as public domain or as a complete Bible.',
    offlineAllowed: null,
    provider: 'local'
  }];

  function getTranslation(translationId){
    return translations.find(function(translation){
      return translation.id === translationId;
    });
  }

  function getLibrary(translationId){
    if(!getTranslation(translationId)) return null;
    return library;
  }

  function listTranslations(){
    return translations.map(function(translation){ return Object.assign({}, translation); });
  }

  function listBooks(translationId){
    var source = getLibrary(translationId);
    if(!source) return [];
    return Object.keys(source).map(function(bookId){
      return { id: bookId, name: source[bookId].name };
    });
  }

  function getChapterCount(translationId, bookId){
    var source = getLibrary(translationId);
    return source && source[bookId] ? source[bookId].chapters : 0;
  }

  function getChapter(translationId, bookId, chapterNumber){
    var source = getLibrary(translationId);
    var chapter = source && source[bookId] && source[bookId][chapterNumber];
    if(!chapter) return null;
    return {
      bookId: bookId,
      bookName: source[bookId].name,
      chapter: Number(chapterNumber),
      title: chapter.title,
      subtitle: chapter.subtitle,
      verses: chapter.verses.slice()
    };
  }

  function getVerse(translationId, bookId, chapterNumber, verseNumber){
    var chapter = getChapter(translationId, bookId, chapterNumber);
    if(!chapter || !chapter.verses[verseNumber - 1]) return null;
    return {
      translationId: translationId,
      bookId: bookId,
      chapter: chapter.chapter,
      verse: verseNumber,
      text: chapter.verses[verseNumber - 1]
    };
  }

  function search(translationId, query){
    var source = getLibrary(translationId);
    var normalizedQuery = String(query || '').trim().toLowerCase();
    if(!source || !normalizedQuery) return [];
    return listBooks(translationId).reduce(function(matches, book){
      for(var chapterNumber = 1; chapterNumber <= source[book.id].chapters; chapterNumber++){
        var chapter = getChapter(translationId, book.id, chapterNumber);
        chapter.verses.forEach(function(text, index){
          if(text.toLowerCase().indexOf(normalizedQuery) !== -1){
            matches.push({
              translationId: translationId,
              bookId: book.id,
              bookName: book.name,
              chapter: chapterNumber,
              verse: index + 1,
              text: text
            });
          }
        });
      }
      return matches;
    }, []);
  }

  return {
    listTranslations: listTranslations,
    listBooks: listBooks,
    getChapterCount: getChapterCount,
    getChapter: getChapter,
    getVerse: getVerse,
    search: search
  };
}());
