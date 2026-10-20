'use strict';
const {test}=require('node:test');
const assert=require('node:assert/strict');
const fs=require('node:fs');
const vm=require('node:vm');
const library=vm.runInNewContext(fs.readFileSync(require.resolve('../js/bible/kjv.js'),'utf8')+';kjvLibrary');

function harness(){
  let spoken;
  const context=vm.createContext({
    UserData:{readerPosition:{load:()=>({bookId:'genesis',chapter:1})},translation:{load:()=>'kjv'},speechSpeed:{load:()=>1},speechVoice:{load:()=>'male',save(){}}},
    document:{readyState:'loading',addEventListener(){},getElementById(){return null;}},
    window:{addEventListener(){},SpeechSynthesisUtterance:function(text){this.text=text;},speechSynthesis:{getVoices:()=>[{name:'Microsoft David',lang:'en-US',localService:true}],addEventListener(){},cancel(){},pause(){},resume(){},speak(utterance){spoken=utterance;utterance.onstart();}}},
    navigator:{onLine:false},WordStudyLoader:{normalizeLookupTerm:text=>text.toLowerCase()}
  });
  for(const file of ['reader','speech'])vm.runInContext(fs.readFileSync(require.resolve('../js/bible/'+file+'.js'),'utf8'),context);
  return {context,speak(text,id){context.BibleSpeech.playVerse(text,1,{translationId:arguments.length>1?id:'kjv'});return spoken.text;}};
}

for(const [book,chapter,verse,expected] of [
  ['genesis',1,2,'And the earth was without form, and void; and darkness was upon the face of the deep. And the Spirit of God moved upon the face of the waters.'],
  ['genesis',1,4,'And God saw the light, that it was good: and God divided the light from the darkness.'],
  ['genesis',14,8,'And there went out the king of Sodom, and the king of Gomorrah, and the king of Admah, and the king of Zeboiim, and the king of Bela (the same is Zoar;) and they joined battle with them in the vale of Siddim;'],
  ['genesis',35,18,'And it came to pass, as her soul was in departing, (for she died) that she called his name Ben-oni: but his father called him Benjamin.'],
  ['1-john',2,23,'Whosoever denieth the Son, the same hath not the Father: [but] he that acknowledgeth the Son hath the Father also.']
])test(`${book} ${chapter}:${verse}: speech retains words and meaningful punctuation`,()=>{
  const raw=library[book][chapter].verses[verse-1];
  assert.equal(harness().speak(raw),expected);
  assert.equal(library[book][chapter].verses[verse-1],raw);
});

test('all 31,102 KJV verses retain word order, ordinary parentheses and literal nested brackets',()=>{
  const runtime=harness();let verseCount=0,supplied=0,parentheses=0;
  for(const book of Object.values(library))for(let chapter=1;chapter<=book.chapters;chapter++)for(const raw of book[chapter].verses){
    let depth=0,expected='';
    for(const character of raw){
      if(character==='['){if(depth++)expected+=character;else supplied++;}
      else if(character===']'){if(--depth)expected+=character;}
      else expected+=character;
    }
    assert.equal(depth,0);
    const spoken=runtime.speak(raw);
    assert.equal(spoken,expected);
    assert.equal(spoken.replace(/[\[\]]/g,''),raw.replace(/[\[\]]/g,''));
    parentheses+=(raw.match(/\(/g)||[]).length;verseCount++;
  }
  assert.deepEqual({verseCount,supplied,parentheses},{verseCount:31102,supplied:21503,parentheses:222});
});

test('only explicit KJV locations normalize annotations; WEB, DRA and unknown locations stay verbatim',()=>{
  const runtime=harness(),text='A [word], (an aside); another [phrase].';
  for(const translation of ['web','dra',null,undefined])assert.equal(runtime.speak(text,translation),text);
});

test('rendering escapes source text, preserves word-study names and retains the literal [but] bracket',()=>{
  const {context}=harness();
  const html=context.renderStudyWordTokens(library['1-john'][2].verses[22],'kjv');
  assert.equal((html.match(/<i>/g)||[]).length,1);
  assert.match(html,/<i>\[<span[^>]+aria-label="Study word but"/);
  assert.match(html,/<\/span>\]<span|<\/span>\] /);
  const escaped=context.renderStudyWordTokens('[<img src=x> & "word"]','kjv');
  assert.ok(!escaped.includes('<img'));assert.ok(escaped.includes('&lt;'));assert.ok(escaped.includes('&amp;'));
  assert.ok(!context.renderStudyWordTokens('[was]','web').includes('<i>'));
  assert.ok(!context.renderStudyWordTokens('[was]','dra').includes('<i>'));
});
