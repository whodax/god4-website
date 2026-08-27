/* ===== BIBLE DATA ACCESS ===== */
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
    provider: 'demo-library'
  }, {
    id: 'web',
    name: 'World English Bible Protestant Edition',
    abbreviation: 'WEB',
    language: 'English',
    source: 'eBible.org — https://ebible.org/engwebp/',
    copyrightStatus: 'Public domain',
    attribution: 'World English Bible Protestant Edition (WEBP), eBible.org',
    licensingNotes: 'The text is public domain. “World English Bible” is a trademark of eBible.org.',
    offlineAllowed: true,
    provider: 'web-library'
  }, {
    id: 'asv',
    name: 'American Standard Version (1901)',
    abbreviation: 'ASV',
    language: 'English',
    source: 'eBible.org — https://ebible.org/eng-asv/',
    copyrightStatus: 'Public domain',
    attribution: 'American Standard Version (1901), eBible.org',
    licensingNotes: 'The American Standard Version (1901) is public domain. Source archive: eng-asv_usfm.zip.',
    offlineAllowed: true,
    provider: 'asv-library'
  }, {
    id: 'kjv',
    name: 'King James Version',
    abbreviation: 'KJV',
    language: 'English',
    source: 'eBible.org / CrossWire Bible Society — https://ebible.org/eng-kjv/',
    copyrightStatus: 'Public domain outside the United Kingdom',
    attribution: 'King James Version, standardized 1769 text, eBible.org / CrossWire Bible Society',
    licensingNotes: 'eBible.org identifies this text as public domain outside the UK. The source edition includes Apocrypha; this repository imports the canonical 66 Protestant books only.',
    offlineAllowed: true,
    provider: 'kjv-library'
  }, {
    id: 'ylt',
    name: 'Young’s Literal Translation',
    abbreviation: 'YLT',
    language: 'English',
    source: 'eBible.org — https://ebible.org/engylt/',
    copyrightStatus: 'Public domain',
    attribution: 'Young’s Literal Translation, eBible.org',
    licensingNotes: 'eBible.org identifies the Young’s Literal Translation as public domain. Source archive: engylt_usfm.zip.',
    offlineAllowed: true,
    provider: 'ylt-library'
  }, {
    id: 'dby',
    name: 'Darby Translation',
    abbreviation: 'DBY',
    language: 'English',
    source: 'eBible.org — https://ebible.org/engDBY/',
    copyrightStatus: 'Public domain',
    attribution: 'The Holy Scriptures, a New Translation from the Original Languages by J. N. Darby, eBible.org',
    licensingNotes: 'eBible.org identifies the Darby Translation as public domain. Source archive: engDBY_usfm.zip.',
    offlineAllowed: true,
    provider: 'dby-library'
  }, {
    id: 'webster',
    name: 'Webster Bible (1833)',
    abbreviation: 'WBS',
    language: 'English',
    source: 'eBible.org — https://ebible.org/engwebster/',
    copyrightStatus: 'Public domain',
    attribution: 'The Holy Bible, with amendments of the language by Noah Webster, eBible.org',
    licensingNotes: 'eBible.org identifies the Noah Webster Bible as public domain. Source archive: engwebster_vpl.zip.',
    offlineAllowed: true,
    provider: 'webster-library'
  }, {
    id: 'rv',
    name: 'Revised Version (1895)',
    abbreviation: 'RV',
    language: 'English',
    source: 'eBible.org — https://ebible.org/eng-rv/',
    copyrightStatus: 'Public domain',
    attribution: 'Revised Version (1895), eBible.org',
    licensingNotes: 'eBible.org identifies the Revised Version as public domain. Source archive: eng-rv_usfm.zip. GOD4.us imports only the canonical 66 Protestant books from the larger distribution.',
    offlineAllowed: true,
    provider: 'rv-library'
  }, {
    id: 'gnv',
    name: 'Geneva Bible 1599',
    abbreviation: 'GNV',
    language: 'English',
    source: 'eBible.org — https://ebible.org/enggnv/',
    copyrightStatus: 'Public domain',
    attribution: 'Geneva Bible 1599, eBible.org',
    licensingNotes: 'eBible.org identifies this digital copy as public domain and freely available worldwide. Source archive: enggnv_usfm.zip. GOD4.us preserves the original historical spelling.',
    offlineAllowed: true,
    provider: 'gnv-library'
  }];

  function getTranslation(translationId){
    return translations.find(function(translation){
      return translation.id === translationId;
    });
  }

  function getLibrary(translationId){
    var translation = getTranslation(translationId);
    if(!translation) return null;
    if(translation.provider === 'demo-library' && typeof library !== 'undefined') return library;
    if(translation.provider === 'web-library' && typeof webLibrary !== 'undefined') return webLibrary;
    if(translation.provider === 'asv-library' && typeof asvLibrary !== 'undefined') return asvLibrary;
    if(translation.provider === 'kjv-library' && typeof kjvLibrary !== 'undefined') return kjvLibrary;
    if(translation.provider === 'ylt-library' && typeof yltLibrary !== 'undefined') return yltLibrary;
    if(translation.provider === 'dby-library' && typeof dbyLibrary !== 'undefined') return dbyLibrary;
    if(translation.provider === 'webster-library' && typeof websterLibrary !== 'undefined') return websterLibrary;
    if(translation.provider === 'rv-library' && typeof rvLibrary !== 'undefined') return rvLibrary;
    if(translation.provider === 'gnv-library' && typeof gnvLibrary !== 'undefined') return gnvLibrary;
    if(translation.provider === 'gnv-library' && typeof gnvLibrary !== 'undefined') return gnvLibrary;
    return null;
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
    var chapterKey = Number(chapterNumber);
    var chapter = source && source[bookId] && source[bookId][chapterKey];
    if(!chapter) return null;
    return {
      bookId: bookId,
      bookName: source[bookId].name,
      chapter: chapterKey,
      title: chapter.title,
      subtitle: chapter.subtitle,
      verses: chapter.verses.slice()
    };
  }

  function getVerse(translationId, bookId, chapterNumber, verseNumber){
    var chapter = getChapter(translationId, bookId, chapterNumber);
    if(!chapter || verseNumber < 1 || verseNumber > chapter.verses.length) return null;
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
        var chapter = source[book.id][chapterNumber];
        if(!chapter) continue;
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
