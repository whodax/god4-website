/* ===== ORIGINAL GOD4.US SCRIPTS ===== */
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
  const first = v.text.charAt(0);
  document.getElementById('dropcap').textContent = first;
  document.getElementById('verseText').textContent = v.text.slice(1);
  document.getElementById('verseRef').textContent = v.ref;
  document.getElementById('heroFav').classList.toggle('active', isSaved(v.ref));
  document.getElementById('heroFav').textContent = isSaved(v.ref) ? '♥' : '♡';
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
  document.getElementById('savedCount').textContent = saved.length;
  renderTray();
  renderLeaf();
  if(btnEl){
    btnEl.classList.toggle('active');
    btnEl.textContent = isSaved(ref) ? '♥' : '♡';
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
  document.getElementById('tray').style.right = trayOpen ? '0' : '-360px';
}

/* ===== SCRIPTURE COMPANION DATA ===== */
const library = {
  john: {
    name: 'John',
    chapters: 3,
    1: { title: 'The Word Became Flesh', verses: [
      'In the beginning was the Word, and the Word was with God, and the Word was God.',
      'He was with God in the beginning.',
      'Through him all things were made; without him nothing was made that has been made.',
      'In him was life, and that life was the light of all mankind.',
      'The light shines in the darkness, and the darkness has not overcome it.',
      'There was a man sent from God whose name was John.',
      'He came as a witness to testify concerning that light, so that through him all might believe.',
      'He himself was not the light; he came only as a witness to the light.',
      'The true light that gives light to everyone was coming into the world.',
      'He was in the world, and though the world was made through him, the world did not recognize him.',
      'He came to that which was his own, but his own did not receive him.',
      'Yet to all who did receive him, to those who believed in his name, he gave the right to become children of God—',
      'children born not of natural descent, nor of human decision or a husband\'s will, but born of God.',
      'The Word became flesh and made his dwelling among us. We have seen his glory, the glory of the one and only Son, who came from the Father, full of grace and truth.'
    ]},
    2: { title: 'The Wedding at Cana', verses: [
      'On the third day a wedding took place at Cana in Galilee. Jesus\' mother was there,',
      'and Jesus and his disciples had also been invited to the wedding.',
      'When the wine was gone, Jesus\' mother said to him, "They have no more wine."',
      '"Woman, why do you involve me?" Jesus replied. "My hour has not yet come."',
      'His mother said to the servants, "Do whatever he tells you."',
      'Nearby stood six stone water jars, the kind used by the Jews for ceremonial washing, each holding from twenty to thirty gallons.',
      'Jesus said to the servants, "Fill the jars with water"; so they filled them to the brim.',
      'Then he told them, "Now draw some out and take it to the master of the banquet."',
      'and the master of the banquet tasted the water that had been turned into wine. He did not realize where it had come from, though the servants who had drawn the water knew.'
    ]},
    3: { title: 'Jesus Teaches Nicodemus', verses: [
      'Now there was a Pharisee, a man named Nicodemus who was a member of the Jewish ruling council.',
      'He came to Jesus at night and said, "Rabbi, we know that you are a teacher who has come from God. For no one could perform the signs you are doing if God were not with him."',
      'Jesus replied, "Very truly I tell you, no one can see the kingdom of God unless they are born again."',
      '"How can someone be born when they are old?" Nicodemus asked. "Surely they cannot enter a second time into their mother\'s womb to be born!"',
      'Jesus answered, "Very truly I tell you, no one can enter the kingdom of God unless they are born of water and the Spirit."',
      'Flesh gives birth to flesh, but the Spirit gives birth to spirit.',
      'You should not be surprised at my saying, \'You must be born again.\'',
      'The wind blows wherever it pleases. You hear its sound, but you cannot tell where it comes from or where it is going. So it is with everyone born of the Spirit.',
      '"How can this be?" Nicodemus asked.',
      '"You are Israel\'s teacher," said Jesus, "and do you not understand these things?"'
    ]}
  },
  psalms: {
    name: 'Psalms',
    chapters: 3,
    1: { title: 'The Two Paths', verses: [
      'Blessed is the one who does not walk in step with the wicked or stand in the way that sinners take or sit in the company of mockers,',
      'but whose delight is in the law of the LORD, and who meditates on his law day and night.',
      'That person is like a tree planted by streams of water, which yields its fruit in season and whose leaf does not wither— whatever they do prospers.',
      'Not so the wicked! They are like chaff that the wind blows away.',
      'Therefore the wicked will not stand in the judgment, nor sinners in the assembly of the righteous.',
      'For the LORD watches over the way of the righteous, but the way of the wicked leads to destruction.'
    ]},
    2: { title: 'The Messiah\'s Triumph', verses: [
      'Why do the nations conspire and the peoples plot in vain?',
      'The kings of the earth rise up and the rulers band together against the LORD and against his anointed, saying,',
      '"Let us break their chains and throw off their shackles."',
      'The One enthroned in heaven laughs; the Lord scoffs at them.',
      'He rebukes them in his anger and terrifies them in his wrath, saying,',
      '"I have installed my king on Zion, my holy mountain."'
    ]},
    3: { title: 'A Psalm of David', subtitle: 'When he fled from his son Absalom', verses: [
      'LORD, how many are my foes! How many rise up against me!',
      'Many are saying of me, "God will not deliver him."',
      'But you, LORD, are a shield around me, my glory, the One who lifts my head high.',
      'I call out to the LORD, and he answers me from his holy mountain.',
      'I lie down and sleep; I wake again, because the LORD sustains me.',
      'I will not fear though tens of thousands assail me on every side.'
    ]}
  },
  romans: {
    name: 'Romans',
    chapters: 3,
    1: { title: 'Paul\'s Greeting', verses: [
      'Paul, a servant of Christ Jesus, called to be an apostle and set apart for the gospel of God—',
      'the gospel he promised beforehand through his prophets in the Holy Scriptures',
      'regarding his Son, who as to his earthly life was a descendant of David,',
      'and who through the Spirit of holiness was appointed the Son of God in power by his resurrection from the dead: Jesus Christ our Lord.',
      'Through him we received grace and apostleship to call all the Gentiles to the obedience that comes from faith for his name\'s sake.',
      'And you also are among those Gentiles who are called to belong to Jesus Christ.',
      'To all in Rome who are loved by God and called to be his holy people: Grace and peace to you from God our Father and from the Lord Jesus Christ.'
    ]},
    2: { title: 'God\'s Righteous Judgment', verses: [
      'You, therefore, have no excuse, you who pass judgment on someone else, for at whatever point you judge another, you are condemning yourself, because you who pass judgment do the same things.',
      'Now we know that God\'s judgment against those who do such things is based on truth.',
      'So when you, a mere human being, pass judgment on them and yet do the same things, do you think you will escape God\'s judgment?',
      'Or do you show contempt for the riches of his kindness, forbearance and patience, not realizing that God\'s kindness is intended to lead you to repentance?',
      'But because of your stubbornness and your unrepentant heart, you are storing up wrath against yourself for the day of God\'s wrath, when his righteous judgment will be revealed.'
    ]},
    3: { title: 'No One Is Righteous', verses: [
      'What advantage, then, is there in being a Jew, or what value is there in circumcision?',
      'Much in every way! First of all, the Jews have been entrusted with the very words of God.',
      'What if some were unfaithful? Will their unfaithfulness nullify God\'s faithfulness?',
      'Not at all! Let God be true, and every human being a liar. As it is written: "So that you may be proved right when you speak and prevail when you judge."',
      'But if our unrighteousness brings out God\'s righteousness more clearly, what shall we say? That God is unjust in bringing his wrath on us?'
    ]}
  },
  genesis: {
    name: 'Genesis',
    chapters: 3,
    1: { title: 'The Beginning', verses: [
      'In the beginning God created the heavens and the earth.',
      'Now the earth was formless and empty, darkness was over the surface of the deep, and the Spirit of God was hovering over the waters.',
      'And God said, "Let there be light," and there was light.',
      'God saw that the light was good, and he separated the light from the darkness.',
      'God called the light "day," and the darkness he called "night." And there was evening, and there was morning—the first day.',
      'And God said, "Let there be a vault between the waters to separate water from water."',
      'So God made the vault and separated the water under the vault from the water above it. And it was so.',
      'God called the vault "sky." And there was evening, and there was morning—the second day.'
    ]},
    2: { title: 'Adam and Eve', verses: [
      'Thus the heavens and the earth were completed in all their vast array.',
      'By the seventh day God had finished the work he had been doing; so on the seventh day he rested from all his work.',
      'Then God blessed the seventh day and made it holy, because on it he rested from all the work of creating that he had done.',
      'This is the account of the heavens and the earth when they were created, when the LORD God made the earth and the heavens.',
      'Now no shrub had yet appeared on the earth and no plant had yet sprung up, for the LORD God had not sent rain on the earth and there was no one to work the ground,'
    ]},
    3: { title: 'The Fall', verses: [
      'Now the serpent was more crafty than any of the wild animals the LORD God had made. He said to the woman, "Did God really say, \'You must not eat from any tree in the garden\'?"',
      'The woman said to the serpent, "We may eat fruit from the trees in the garden,',
      'but God did say, \'You must not eat fruit from the tree that is in the middle of the garden, and you must not touch it, or you will die.\'"',
      '"You will not certainly die," the serpent said to the woman.',
      '"For God knows that when you eat from it your eyes will be opened, and you will be like God, knowing good and evil."'
    ]}
  },
  matthew: {
    name: 'Matthew',
    chapters: 3,
    1: { title: 'The Genealogy of Jesus', verses: [
      'This is the genealogy of Jesus the Messiah the son of David, the son of Abraham:',
      'Abraham was the father of Isaac, Isaac the father of Jacob, Jacob the father of Judah and his brothers,',
      'Judah the father of Perez and Zerah, whose mother was Tamar, Perez the father of Hezron, Hezron the father of Ram,',
      'Ram the father of Amminadab, Amminadab the father of Nahshon, Nahshon the father of Salmon,'
    ]},
    2: { title: 'The Magi Visit', verses: [
      'After Jesus was born in Bethlehem in Judea, during the time of King Herod, Magi from the east came to Jerusalem',
      'and asked, "Where is the one who has been born king of the Jews? We saw his star when it rose and have come to worship him."',
      'When King Herod heard this he was disturbed, and all Jerusalem with him.',
      'When he had called together all the people\'s chief priests and teachers of the law, he asked them where the Messiah was to be born.',
      '"In Bethlehem in Judea," they replied, "for this is what the prophet has written:"'
    ]},
    3: { title: 'John the Baptist', verses: [
      'In those days John the Baptist came, preaching in the wilderness of Judea',
      'and saying, "Repent, for the kingdom of heaven has come near."',
      'This is he who was spoken of through the prophet Isaiah: "A voice of one calling in the wilderness, \'Prepare the way for the Lord, make straight paths for him.\'"',
      'John\'s clothes were made of camel\'s hair, and he had a leather belt around his waist. His food was locusts and wild honey.',
      'People went out to him from Jerusalem and all Judea and the whole region of the Jordan.'
    ]}
  },
  philippians: {
    name: 'Philippians',
    chapters: 3,
    1: { title: 'Thanksgiving and Prayer', verses: [
      'Paul and Timothy, servants of Christ Jesus, To all God\'s holy people in Christ Jesus at Philippi, together with the overseers and deacons:',
      'Grace and peace to you from God our Father and the Lord Jesus Christ.',
      'I thank my God every time I remember you.',
      'In all my prayers for all of you, I always pray with joy',
      'because of your partnership in the gospel from the first day until now,'
    ]},
    2: { title: 'Imitating Christ\'s Humility', verses: [
      'Therefore if you have any encouragement from being united with Christ, if any comfort from his love, if any common sharing in the Spirit, if any tenderness and compassion,',
      'then make my joy complete by being like-minded, having the same love, being one in spirit and of one mind.',
      'Do nothing out of selfish ambition or vain conceit. Rather, in humility value others above yourselves,',
      'not looking to your own interests but each of you to the interests of the others.',
      'In your relationships with one another, have the same mindset as Christ Jesus:'
    ]},
    3: { title: 'No Confidence in the Flesh', verses: [
      'Further, my brothers and sisters, rejoice in the Lord! It is no trouble for me to write the same things to you again, and it is a safeguard for you.',
      'Watch out for those dogs, those evildoers, those mutilators of the flesh.',
      'For it is we who are the circumcision, we who serve God by his Spirit, who boast in Christ Jesus, and who put no confidence in the flesh—',
      'though I myself have reasons for such confidence. If someone else thinks they have reasons to put confidence in the flesh, I have more:'
    ]}
  }
};

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

const plan = [
  {d:1, ref:'Matthew 1-2', done:true},
  {d:2, ref:'Matthew 3-4', done:true},
  {d:3, ref:'Matthew 5-6', done:true},
  {d:4, ref:'Matthew 7-8', done:true},
  {d:5, ref:'Matthew 9-10', done:true},
  {d:6, ref:'Matthew 11-12', done:true},
  {d:7, ref:'Matthew 13-14', done:true},
  {d:8, ref:'Matthew 15-16', done:true},
  {d:9, ref:'Matthew 17-18', done:true},
  {d:10, ref:'Matthew 19-20', done:true},
  {d:11, ref:'Matthew 21-22', done:true},
  {d:12, ref:'Matthew 23-24', done:true},
  {d:13, ref:'Matthew 25-26', done:true},
  {d:14, ref:'Matthew 27-28', done:true},
  {d:15, ref:'Mark 1-2', done:false},
  {d:16, ref:'Mark 3-4', done:false},
  {d:17, ref:'Mark 5-6', done:false},
  {d:18, ref:'Mark 7-8', done:false},
  {d:19, ref:'Mark 9-10', done:false},
  {d:20, ref:'Mark 11-12', done:false},
  {d:21, ref:'Mark 13-14', done:false},
  {d:22, ref:'Mark 15-16', done:false},
  {d:23, ref:'Luke 1-2', done:false},
  {d:24, ref:'Luke 3-4', done:false},
  {d:25, ref:'Luke 5-6', done:false},
  {d:26, ref:'Luke 7-8', done:false},
  {d:27, ref:'Luke 9-10', done:false},
  {d:28, ref:'Luke 11-12', done:false},
  {d:29, ref:'Luke 13-14', done:false},
  {d:30, ref:'Luke 15-16', done:false}
];

/* ===== SCRIPTURE COMPANION STATE & FUNCTIONS ===== */
let currentBook = 'john';
let currentChapter = 1;
let leftTrans = 'niv';
let rightTrans = 'esv';

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

function loadCompare(){
  var key = document.getElementById('compareBook').value;
  var data = compareData[key];
  var translations = {niv:'NIV', esv:'ESV', kjv:'KJV', msg:'The Message'};
  var html = '';
  ['left','right'].forEach(function(side){
    var transKey = side === 'left' ? leftTrans : rightTrans;
    var otherOptions = Object.keys(translations).filter(function(t){ return t !== transKey; });
    html += '<div class="compare-col">';
    html += '<div class="compare-col-header">';
    html += '<span>' + translations[transKey] + '</span>';
    html += '<select onchange="changeTrans(\'' + side + '\', this.value)">';
    html += '<option value="' + transKey + '">' + translations[transKey] + '</option>';
       otherOptions.forEach(function(o){
      html += '<option value="' + o + '">' + translations[o] + '</option>';
    });
    html += '</select></div><div class="compare-text">';
    for(var i = 0; i < data[transKey].length; i++){
      html += '<p><span class="vnum">' + (i+1) + '</span>' + data[transKey][i] + '</p>';
    }
    html += '</div></div>';
  });
  document.getElementById('compareGrid').innerHTML = html;
}

function changeTrans(side, val){
  if(side === 'left') leftTrans = val; else rightTrans = val;
  loadCompare();
}

function renderPlan(){
  var today = new Date().getDate();
  var container = document.getElementById('planDays');
  var doneCount = 0;
  container.innerHTML = plan.map(function(day){
    if(day.done) doneCount++;
    var cls = day.done ? 'past completed' : (day.d === 8 ? 'today' : 'future');
    return '<div class="plan-day ' + cls + '" onclick="toggleDay(' + day.d + ')">' +
      '<div class="day-num">' + day.d + '</div>' +
      '<div class="day-ref">' + day.ref + '</div>' +
      '</div>';
  }).join('');
  var pct = Math.round((doneCount / 30) * 100);
  document.getElementById('planFill').style.width = pct + '%';
  document.getElementById('planDone').textContent = doneCount + ' of 30 days';
  document.getElementById('planPct').textContent = pct + '%';
}

function toggleDay(d){
  var day = plan.find(function(x){ return x.d === d; });
  if(day){ day.done = !day.done; renderPlan(); }
}

/* ===== INIT ===== */
populateChapters();
loadPassage();
loadCompare();
renderPlan();
renderLeaf();
