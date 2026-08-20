const compareData = {
  john3: {
    ref: 'John 3:16-18',
    niv: [
      'For God so loved the world that he gave his one and only Son, that whoever believes in him shall not perish but have eternal life.',
      'For God did not send his Son into the world to condemn the world, but to save the world through him.',
      'Whoever believes in him is not condemned, but whoever does not believe stands condemned already because they have not believed in the name of God\'s one and only Son.'
    ],
    esv: [
      'For God so loved the world, that he gave his only Son, that whoever believes in him should not perish but have eternal life.',
      'For God did not send his Son into the world to condemn the world, but in order that the world might be saved through him.',
      'Whoever believes in him is not condemned, but whoever does not believe is condemned already, because he has not believed in the name of the only Son of God.'
    ],
    kjv: [
      'For God so loved the world, that he gave his only begotten Son, that whosoever believeth in him should not perish, but have everlasting life.',
      'For God sent not his Son into the world to condemn the world; but that the world through him might be saved.',
      'He that believeth on him is not condemned: but he that believeth not is condemned already, because he hath not believed in the name of the only begotten Son of God.'
    ],
    msg: [
      'This is how much God loved the world: He gave his Son, his one and only Son. And this is why: so that no one need be destroyed; by believing in him, anyone can have a whole and lasting life.',
      'God didn\'t go to all the trouble of sending his Son merely to point an accusing finger, telling the world how bad it was. He came to help, to put the world right again.',
      'Anyone who trusts in him is acquitted; anyone who refuses to trust him has long since been under the death sentence without knowing it.'
    ]
  },
  psalm23: {
    ref: 'Psalm 23',
    niv: [
      'The LORD is my shepherd, I lack nothing.',
      'He makes me lie down in green pastures, he leads me beside quiet waters,',
      'he refreshes my soul. He guides me along the right paths for his name\'s sake.',
      'Even though I walk through the darkest valley, I will fear no evil, for you are with me; your rod and your staff, they comfort me.',
      'You prepare a table before me in the presence of my enemies. You anoint my head with oil; my cup overflows.',
      'Surely your goodness and love will follow me all the days of my life, and I will dwell in the house of the LORD forever.'
    ],
    esv: [
      'The LORD is my shepherd; I shall not want.',
      'He makes me lie down in green pastures. He leads me beside still waters.',
      'He restores my soul. He leads me in paths of righteousness for his name\'s sake.',
      'Even though I walk through the valley of the shadow of death, I will fear no evil, for you are with me; your rod and your staff, they comfort me.',
      'You prepare a table before me in the presence of my enemies; you anoint my head with oil; my cup overflows.',
      'Surely goodness and mercy shall follow me all the days of my life, and I shall dwell in the house of the LORD forever.'
    ],
    kjv: [
      'The LORD is my shepherd; I shall not want.',
      'He maketh me to lie down in green pastures: he leadeth me beside the still waters.',
      'He restoreth my soul: he leadeth me in the paths of righteousness for his name\'s sake.',
      'Yea, though I walk through the valley of the shadow of death, I will fear no evil: for thou art with me; thy rod and thy staff they comfort me.',
      'Thou preparest a table before me in the presence of mine enemies: thou anointest my head with oil; my cup runneth over.',
      'Surely goodness and mercy shall follow me all the days of my life: and I will dwell in the house of the LORD for ever.'
    ],
    msg: [
      'GOD, my shepherd! I don\'t need a thing.',
      'You have bedded me down in lush meadows, you find me quiet pools to drink from.',
      'True to your word, you let me catch my breath and send me in the right direction.',
      'Even when the way goes through Death Valley, I\'m not afraid when you walk at my side. Your trusty shepherd\'s crook makes me feel secure.',
      'You serve me a six-course dinner right in front of my enemies. You revive my drooping head; my cup brims with blessing.',
      'Your beauty and love chase after me every day of my life. I\'m back home in the house of GOD for the rest of my life.'
    ]
  },
  romans8: {
    ref: 'Romans 8:28-30',
    niv: [
      'And we know that in all things God works for the good of those who love him, who have been called according to his purpose.',
      'For those God foreknew he also predestined to be conformed to the image of his Son, that he might be the firstborn among many brothers and sisters.',
      'And those he predestined, he also called; those he called, he also justified; those he justified, he also glorified.'
    ],
    esv: [
      'And we know that for those who love God all things work together for good, for those who are called according to his purpose.',
      'For those whom he foreknew he also predestined to be conformed to the image of his Son, in order that he might be the firstborn among many brothers.',
      'And those whom he predestined he also called, and those whom he called he also justified, and those whom he justified he also glorified.'
    ],
    kjv: [
      'And we know that all things work together for good to them that love God, to them who are the called according to his purpose.',
      'For whom he did foreknow, he also did predestinate to be conformed to the image of his Son, that he might be the firstborn among many brethren.',
      'Moreover whom he did predestinate, them he also called: and whom he called, them he also justified: and whom he justified, them he also glorified.'
    ],
    msg: [
      'That\'s why we can be so sure that every detail in our lives of love for God is worked into something good.',
      'God knew what he was doing from the very beginning. He decided from the outset to shape the lives of those who love him along the same lines as the life of his Son.',
      'After God made that decision of what his children should be like, he followed it up by calling people by name. After he called them by name, he set them on a solid basis with himself. And then, after getting them established, he stayed with them to the end, gloriously completing what he had begun.'
    ]
  },
  phil4: {
    ref: 'Philippians 4:6-7',
    niv: [
      'Do not be anxious about anything, but in every situation, by prayer and petition, with thanksgiving, present your requests to God.',
      'And the peace of God, which transcends all understanding, will guard your hearts and your minds in Christ Jesus.'
    ],
    esv: [
      'Do not be anxious about anything, but in everything by prayer and supplication with thanksgiving let your requests be made known to God.',
      'And the peace of God, which surpasses all understanding, will guard your hearts and your minds in Christ Jesus.'
    ],
    kjv: [
      'Be careful for nothing; but in every thing by prayer and supplication with thanksgiving let your requests be made known unto God.',
      'And the peace of God, which passeth all understanding, shall keep your hearts and minds through Christ Jesus.'
    ],
    msg: [
      'Don\'t fret or worry. Instead of worrying, pray. Let petitions and praises shape your worries into prayers, letting God know your concerns.',
      'Before you know it, a sense of God\'s wholeness, everything coming together for good, will come and settle you down. It\'s wonderful what happens when Christ displaces worry at the center of your life.'
    ]
  }
};

let leftTrans = 'niv';
let rightTrans = 'esv';

const webComparePassages = {
  john3: { book: 'john', chapter: 3, start: 16, end: 18 },
  psalm23: { book: 'psalms', chapter: 23, start: 1, end: 6 },
  romans8: { book: 'romans', chapter: 8, start: 28, end: 30 },
  phil4: { book: 'philippians', chapter: 4, start: 6, end: 7 }
};

function getCompareVerses(translationId, passageKey, data){
  var passage = webComparePassages[passageKey];
  if(translationId !== 'web') return data[translationId].map(function(text, index){
    return { number: (passage ? passage.start : 1) + index, text: text };
  });
  if(!passage || typeof BibleData === 'undefined') return [];
  var verses = [];
  for(var verseNumber = passage.start; verseNumber <= passage.end; verseNumber++){
    var verse = BibleData.getVerse('web', passage.book, passage.chapter, verseNumber);
    if(verse) verses.push({ number: verse.verse, text: verse.text });
  }
  return verses;
}

function loadCompare(){
  var compareBook = document.getElementById('compareBook');
  var grid = document.getElementById('compareGrid');
  if(!compareBook || !grid) return;
  var key = compareBook.value;
  var data = compareData[key];
  if(!data) return;
  var translations = {niv:'NIV', esv:'ESV', kjv:'KJV', msg:'The Message', web:'WEB'};
  var html = '';
  ['left','right'].forEach(function(side){
    var transKey = side === 'left' ? leftTrans : rightTrans;
    var otherOptions = Object.keys(translations).filter(function(t){ return t !== transKey; });
    html += '<div class="compare-col">';
    html += '<div class="compare-col-header">';
    html += '<span>' + translations[transKey] + '</span>';
    html += '<select aria-label="' + (side === 'left' ? 'Left' : 'Right') + ' translation" onchange="changeTrans(\'' + side + '\', this.value)">';
    html += '<option value="' + transKey + '">' + translations[transKey] + '</option>';
    otherOptions.forEach(function(o){
      html += '<option value="' + o + '">' + translations[o] + '</option>';
    });
    html += '</select></div><div class="compare-text">';
    var verses = getCompareVerses(transKey, key, data);
    for(var i = 0; i < verses.length; i++){
      html += '<p><span class="vnum">' + verses[i].number + '</span>' + escapeHtml(verses[i].text) + '</p>';
    }
    html += '</div></div>';
  });
  grid.innerHTML = html;
}

function changeTrans(side, val){
  if(side === 'left') leftTrans = val; else rightTrans = val;
  loadCompare();
}
