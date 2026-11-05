/* ===== SCRIPTURE READ ALOUD ===== */
var BibleSpeech = (function createBibleSpeech(){
  var SPEEDS = [0.5, 0.75, 1, 1.25, 1.5, 1.75, 2];
  var state = 'idle';
  var PROFILES = Object.freeze({
    male:Object.freeze({id:'male', displayName:'Natural Male', gender:'male', locale:'en-US', provider:'google-neural2', providerVoiceId:'en-US-Neural2-D', fallbackGender:'male', defaultRate:1}),
    female:Object.freeze({id:'female', displayName:'Natural Female', gender:'female', locale:'en-US', provider:'google-neural2', providerVoiceId:'en-US-Neural2-F', fallbackGender:'female', defaultRate:1})
  });
  var actualPlayback = null;
  var lastResult = null;
  var utteranceStarted = false;
  var playbackAttempt = 0;
  var announcementKey = '';
  // Session state survives per-verse preparation; chapter context is claimed only on actual start.
  var spokenChapterKey = '', sessionStarted = false, preserveChapterOnce = false;
  var commandNativeReplay = false;
  var stopped = false, wordOffset = 0, resumeOffset = 0;
  var verses = [];
  var verseIndex = 0;
  var pendingNext = false;
  var pauseAfterCurrent = false;
  var sequenceIsChapter = false;
  var repeatState = null;
  var currentVerseIndex = -1;
  var session = 0;
  var continueAfterChapter = null;
  var completionMessage = '';
  var statusMessage = '';
  var speed = readSpeedPreference();
  var voicePreference = readVoicePreference();
  var playbackListener = null;

  function localSupported(){
    return typeof window !== 'undefined' && typeof window.speechSynthesis !== 'undefined' && typeof window.SpeechSynthesisUtterance !== 'undefined';
  }
  function cloudSupported(){
    return typeof BibleCloudTTS !== 'undefined' && BibleCloudTTS.available();
  }
  function supported(){ return localSupported() || cloudSupported(); }
  function cancelSpeech(){
    if(cloudSupported()) BibleCloudTTS.cancel();
    if(localSupported()) window.speechSynthesis.cancel();
  }
  function pauseSpeech(){
    if(cloudSupported()) BibleCloudTTS.pause();
    if(localSupported()) window.speechSynthesis.pause();
  }
  function resumeSpeech(){
    if(cloudSupported()) BibleCloudTTS.resume();
    if(localSupported()) window.speechSynthesis.resume();
  }
  function deferForMicrophone(action){
    return typeof deferReaderSpeechUntilMicrophoneReleased === 'function' && deferReaderSpeechUntilMicrophoneReleased(action);
  }
  function prepareCloudSpeech(){
    if(deferForMicrophone(prepareCloudSpeech)) return;
    if(cloudSupported()) BibleCloudTTS.prepare();
  }
  function createUtterance(verse){
    var text = verse.translationId === 'kjv' ? verse.text.replace(/\[((?:\[[^[\]]*\]|[^[\]])+)\]/g, '$1') : verse.text;
    var offset = resumeOffset;
    resumeOffset = 0;
    wordOffset = offset;
    text = text.slice(offset);
    var utterance = cloudSupported() ? {text:text} : new window.SpeechSynthesisUtterance(text);
    var chapter = typeof BibleData!=='undefined' && verse.bookId && verse.chapter
      ? BibleData.getChapter(verse.translationId,verse.bookId,verse.chapter) : null;
    utterance.chapterKey = chapter ? JSON.stringify([verse.translationId,verse.bookId,verse.chapter]) : '';
    if(chapter && (!sessionStarted || utterance.chapterKey!==spokenChapterKey)){
      utterance.text=chapter.bookName+' chapter '+verse.chapter+(!sessionStarted && verse.verseNumber?' verse '+verse.verseNumber:'')+'. '+text;
    }
    utterance.prefixLength = utterance.text.length - text.length;
    utterance.offset = offset;
    utterance.profileId = voicePreference;
    utterance.playbackRate = speed;
    return utterance;
  }
  function canReplayAndroidPause(){
    return !pendingNext && currentVerseIndex >= 0 &&
      typeof isAndroidVoiceCommands === 'function' && isAndroidVoiceCommands();
  }
  function retainInterruptedNative(){
    session++;
    commandNativeReplay = 'interrupted';
    utteranceStarted = false;
  }

  function speakUtterance(utterance){
    var attempt = ++playbackAttempt, activeSession = session;
    var profile = PROFILES[utterance.profileId], rate = utterance.playbackRate;
    var onstart = utterance.onstart;
    utteranceStarted = false;
    if(state !== 'paused' && !sessionStarted) state = 'preparing';
    if(!announcementKey || actualPlayback && actualPlayback.profileId !== profile.id) statusMessage = 'Preparing ' + profile.displayName + '…';
    updateControls();
    function current(){ return activeSession === session && attempt === playbackAttempt; }
    function started(){
      if(!current()) return;
      utteranceStarted = true;
      sessionStarted = true;
      if(utterance.chapterKey) spokenChapterKey=utterance.chapterKey;
      if(state !== 'paused') state = 'playing';
      announcementKey = profile.id;
      if(actualPlayback.provider === 'cloud') statusMessage = 'Playing ' + profile.displayName + '.';
      updateControls();
      onstart();
    }
    function speakLocal(reason){
      if(!current()) return;
      if(navigator.onLine === false) reason = 'offline';
      var voice = selectedVoice(profile.id);
      var verified = voice && nativeGender(voice) === profile.gender;
      var guidance = reason === 'offline' && !verified ?
        ' No verified offline ' + profile.gender + ' voice. On Android, open Settings > Accessibility > Text-to-speech output > Install voice data. Install English voice data and preview and select a matching voice if available.' : '';
      if(!localSupported() || !voice && voices().length){
        actualPlayback = {profileId:profile.id,provider:null,voiceName:null,genderVerified:false,fallbackReason:'native-unavailable'};
        utterance.onerror('Playback unavailable.' + guidance);
        return;
      }
      actualPlayback = {profileId:profile.id, provider:'native', voiceName:voice ? voice.name : null,
        locale:voice ? voice.lang : 'en', genderVerified:Boolean(verified), fallbackReason:reason};
      if(state === 'paused' && typeof isAndroidVoiceCommands === 'function' && isAndroidVoiceCommands()){
        session++;
        commandNativeReplay = true;
        return;
      }
      var local = new window.SpeechSynthesisUtterance(utterance.text);
      local.rate = rate;
      local.pitch = 1;
      if(voice) local.voice = voice;
      else local.lang = 'en';
      local.onstart = started;
      local.onboundary = function(event){
        var index = event.charIndex;
        if(current() && /^(word|sentence)$/.test(event.name) && Number.isInteger(index) &&
            index >= utterance.prefixLength && index < utterance.text.length){
          // Engines can report a position inside or immediately after a word.
          while(index > utterance.prefixLength && /\S/.test(utterance.text[index - 1])) index--;
          wordOffset = Math.max(wordOffset, utterance.offset + index - utterance.prefixLength);
        }
      };
      local.onend = function(){ if(current()) utterance.onend(); };
      local.onerror = function(event){
        if(!current()) return;
        if(state === 'paused' && /^(interrupted|canceled)$/.test(event?.error) && canReplayAndroidPause()){
          retainInterruptedNative();
          return;
        }
        utterance.onerror(guidance ? 'Playback unavailable.' + guidance : undefined);
      };
      announcementKey = profile.id;
      statusMessage = profile.displayName + ' unavailable' + (reason === 'rate' ? ' at this speed' : '') + '. Using ' +
        (verified ? 'a same-gender device voice.' : 'a device voice; gender unverified.') + guidance;
      updateControls();
      window.speechSynthesis.speak(local);
    }
    if(cloudSupported() && navigator.onLine !== false && rate <= 2){
      actualPlayback = {profileId:profile.id, provider:'cloud', voiceName:profile.providerVoiceId,
        locale:profile.locale, genderVerified:true, fallbackReason:null};
      if(BibleCloudTTS.speak(utterance.text, profile.id, rate, {
        onstart:started, onend:utterance.onend, onfallback:function(){ speakLocal('cloud-unavailable'); }
      })) return;
    }
    speakLocal(navigator.onLine === false ? 'offline' : rate > 2 ? 'rate' : 'cloud-unavailable');
  }

  function elements(){
    return {
      play: document.getElementById('readAloudPlay'),
      status: document.getElementById('readAloudStatus'),
      voice: document.getElementById('readAloudVoice'),
      speed: document.getElementById('readAloudSpeed')
    };
  }

  function readSpeedPreference(){
    return UserData.speechSpeed.load();
  }

  function readVoicePreference(){
    var saved = UserData.speechVoice.load();
    // Older profiles and device names now map to the two supported choices.
    // In particular, the former Male 2 selection must never reopen its silent voice.
    var preference = saved === 'female' || /^(?:adult-female|child-female)$/i.test(saved) ||
      /\b(?:Zira|Samantha)\b|Google UK English Female/i.test(saved) ? 'female' : 'male';
    if(saved !== preference) UserData.speechVoice.save(preference);
    return preference;
  }

  function voices(){
    if(!localSupported() || typeof window.speechSynthesis.getVoices !== 'function') return [];
    return window.speechSynthesis.getVoices();
  }

  function compareVoiceText(left, right){
    var first = String(left || '').toLowerCase();
    var second = String(right || '').toLowerCase();
    return first < second ? -1 : first > second ? 1 : 0;
  }

  function sortedEnglishVoices(){
    var english = voices().filter(function(voice){ return /^en(?:-|_|$)/i.test(voice.lang); });
    english.sort(function(left, right){
      var localDifference = Number(Boolean(right.localService)) - Number(Boolean(left.localService));
      if(localDifference) return localDifference;
      var localeDifference = Number(/^en[-_]US$/i.test(right.lang)) - Number(/^en[-_]US$/i.test(left.lang));
      if(localeDifference) return localeDifference;
      return compareVoiceText(left.name, right.name) || compareVoiceText(left.lang, right.lang);
    });
    return english;
  }

  function nativeGender(voice){
    var name = voice.name;
    if(/\b(?:Zira|Samantha)\b|\bFemale\b/i.test(name)) return 'female';
    if(/\b(?:David|Mark)\b|\bMale\b/i.test(name)) return 'male';
    return null;
  }
  function selectedVoice(profileId){
    var gender = profileId || voicePreference;
    var available = sortedEnglishVoices().filter(function(voice){
      return (navigator.onLine !== false || voice.localService) && !/Google UK English Male|^(?:Automatic|Adult Male|Adult Female|Child Male|Child Female)$/i.test(voice.name);
    });
    return available.find(function(voice){ return voice.localService && nativeGender(voice) === gender; }) ||
      available.find(function(voice){ return nativeGender(voice) === gender; }) ||
      available.find(function(voice){ return nativeGender(voice) === null; }) || null;
  }
  function populateVoiceSelector(){
    var select = elements().voice;
    if(!select) return;
    select.textContent = '';
    ['male','female'].forEach(function(id){
      var option = document.createElement('option');
      option.value = id;
      option.textContent = PROFILES[id].displayName;
      select.appendChild(option);
    });
    select.value = voicePreference;
    select.disabled = !supported();
    if(window.ReaderOptions) ReaderOptions.sync();
  }
  function getVoiceProfiles(){
    return ['male','female'].map(function(id){ return Object.assign({},PROFILES[id],{
      availability:{cloud:cloudSupported() && navigator.onLine !== false, native:localSupported() && Boolean(selectedVoice(id))}
    }); });
  }
  function getResolvedVoiceInfo(){
    var voice = selectedVoice();
    return Object.assign({preference:voicePreference, voiceName:voice ? voice.name : null,
      lang:voice ? voice.lang : null, pitch:1, result:lastResult},actualPlayback || {},{preference:voicePreference});
  }
  function setPlaybackListener(listener){
    playbackListener = listener && typeof listener === 'object' ? listener : null;
  }

  function notifyVerseStart(verseNumber, location){
    if(!playbackListener || typeof playbackListener.onVerseStart !== 'function') return;
    playbackListener.onVerseStart(verseNumber, location || null);
  }

  function notifyVerseSpoken(verseNumber, location){
    if(!playbackListener || typeof playbackListener.onVerseSpoken !== 'function') return;
    playbackListener.onVerseSpoken(verseNumber, location || null);
  }
  function notifyVerseRepeat(verseNumber, location){
    if(!playbackListener || typeof playbackListener.onVerseRepeat !== 'function') return;
    playbackListener.onVerseRepeat(verseNumber, location || null);
  }

  function notifyVerseComplete(location){
    if(!playbackListener || typeof playbackListener.onVerseComplete !== 'function') return;
    playbackListener.onVerseComplete(location || null);
  }

  function notifyPlaybackEnd(){
    if(!playbackListener || typeof playbackListener.onEnd !== 'function') return;
    playbackListener.onEnd();
  }
  function setStatusMessage(message){
    if(state === 'playing' || state === 'preparing') statusMessage = String(message || '');
    else completionMessage = String(message || '');
    updateControls();
  }
  function updateControls(){
    var controls = elements();
    var unavailable = !supported();
    var active = state === 'playing' || state === 'preparing';
    if(controls.play){
      controls.play.disabled = unavailable;
      var text=active ? 'Stop' : 'Play';
      var compact=controls.play.closest('.reader-compact-mobile');
      var label=compact && state==='playing' ? 'Pause reading aloud' : compact && state==='paused' ? 'Resume reading aloud' : active ? 'Stop reading aloud' : 'Play reading aloud';
      if(controls.play.textContent!==text) controls.play.textContent=text;
      if(controls.play.getAttribute('aria-label')!==label) controls.play.setAttribute('aria-label',label);
    }
    if(controls.status){
      var message = unavailable ? 'Read aloud is unavailable in this browser.' : active ? statusMessage || 'Preparing ' + PROFILES[voicePreference].displayName + '…' : state === 'paused' ? 'Reading aloud paused.' : completionMessage;
      controls.status.toggleAttribute('data-offline-voice', message.includes('Install voice data'));
      if(controls.status.textContent !== message) controls.status.textContent = message;
    }
    if(controls.speed) controls.speed.value = String(speed);
    if(controls.voice) controls.voice.disabled = unavailable;
    if(window.ReaderOptions) ReaderOptions.sync();
  }

  function finish(activeSession, message){
    if(activeSession !== session) return;
    state = 'idle';
    stopped = false;
    commandNativeReplay = false;
    spokenChapterKey='';sessionStarted=false;preserveChapterOnce=false;
    verses = [];
    verseIndex = 0;
    pendingNext = false;
    pauseAfterCurrent = false;
    sequenceIsChapter = false;
    repeatState = null;
    currentVerseIndex = -1;
    continueAfterChapter = null;
    completionMessage = message || '';
    updateControls();
    notifyPlaybackEnd();
  }
  function continueAtChapterBoundary(activeSession, activeVerse){
    if(activeSession !== session) return;
    if(!continueAfterChapter){ finish(activeSession); return; }
    var continuation = continueAfterChapter({
      translationId:activeVerse.translationId || null,
      bookId:activeVerse.bookId || null,
      chapter:activeVerse.chapter || null,
      verse:activeVerse.verseNumber
    });
    if(continuation && continuation.chapter){
      setChapter(continuation.chapter, continuation.translationId);
      speakNext(activeSession);
    } else {
      finish(activeSession, continuation && continuation.message);
    }
  }
  function speakNext(activeSession){
    if(activeSession !== session || state === 'paused' || state === 'idle') return;
    if(verseIndex >= verses.length){
      if(verses.length) continueAtChapterBoundary(activeSession, verses[verses.length - 1]);
      else finish(activeSession);
      return;
    }
    currentVerseIndex = verseIndex;
    var activeVerse = verses[verseIndex];
    var location = {
      translationId:activeVerse.translationId || null,
      bookId:activeVerse.bookId || null,
      chapter:activeVerse.chapter || null,
      verse:activeVerse.verseNumber
    };
    var utterance = createUtterance(activeVerse);
    var ended = false;
    utterance.onstart = function(){
      if(activeSession !== session || ended) return;
      updateControls();
      notifyVerseSpoken(activeVerse.verseNumber, location);
    };
    utterance.onend = function(){
      if(activeSession !== session || ended) return;
      ended = true;
      if(state === 'preparing') state = 'playing';
      verseIndex++;
      notifyVerseComplete(location);
      if(pauseAfterCurrent){
        pauseAfterCurrent = false;
        state = 'paused';
        pendingNext = true;
        pauseSpeech();
        updateControls();
        return;
      }
      if(state === 'paused'){
        pendingNext = true;
        return;
      }
      if(verseIndex >= verses.length){
        continueAtChapterBoundary(activeSession, activeVerse);
        return;
      }
      speakNext(activeSession);
    };
    utterance.onerror = function(message){
      if(activeSession !== session || ended) return;
      ended = true;
      lastResult = 'failed';
      finish(activeSession, message || 'Playback unavailable.');
    };
    notifyVerseStart(activeVerse.verseNumber, location);
    speakUtterance(utterance);
  }
  function setChapter(chapter, translationId){
    verses = chapter.verses.map(function(verse, index){
      return {
        text:String(verse).trim(), verseNumber:index + 1,
        translationId:translationId || chapter.translationId || null,
        bookId:chapter.bookId || null, chapter:chapter.chapter || null
      };
    }).filter(function(verse){ return Boolean(verse.text); });
    verseIndex = 0;
    currentVerseIndex = -1;
  }
  function playChapter(chapter, startVerse, pauseAfterFirst, options){
    if(deferForMicrophone(function(){playChapter(chapter,startVerse,pauseAfterFirst,options);})) return;
    if(!supported() || !chapter || !Array.isArray(chapter.verses)){
      updateControls();
      return;
    }
    var wasPaused = state === 'paused';
    stopped = false;
    commandNativeReplay = false;
    if(state==='idle' && !preserveChapterOnce) spokenChapterKey='';
    preserveChapterOnce=false;
    sessionStarted=false;
    session++;
    cancelSpeech();
    if(wasPaused) resumeSpeech();
    prepareCloudSpeech();
    setChapter(chapter, options && options.translationId);
    var startIndex = verses.findIndex(function(verse){ return verse.verseNumber >= startVerse; });
    verseIndex = startIndex < 0 ? verses.length : startIndex;
    pendingNext = false;
    pauseAfterCurrent = Boolean(pauseAfterFirst);
    repeatState = null;
    currentVerseIndex = -1;
    sequenceIsChapter = true;
    continueAfterChapter = options && typeof options.continueAfterChapter === 'function' ? options.continueAfterChapter : null;
    completionMessage = '';
    statusMessage = '';
    announcementKey = '';
    lastResult = null;
    state = verses.length ? options && options.startPaused ? 'paused' : 'preparing' : 'idle';
    updateControls();
    if(verses.length && state==='paused'){pendingNext=true;pauseSpeech();}
    else if(verses.length) speakNext(session);
    else notifyPlaybackEnd();
  }
  function playVerse(text, verseNumber, location){
    if(deferForMicrophone(function(){playVerse(text,verseNumber,location);})) return;
    if(!supported() || !String(text || '').trim()){
      updateControls();
      return;
    }
    var wasPaused = state === 'paused';
    stopped = false;
    commandNativeReplay = false;
    if(state==='idle' && !preserveChapterOnce) spokenChapterKey='';
    preserveChapterOnce=false;
    sessionStarted=false;
    session++;
    cancelSpeech();
    if(wasPaused) resumeSpeech();
    prepareCloudSpeech();
    verses = [{
      text:String(text).trim(),
      verseNumber:Number.isInteger(Number(verseNumber)) && Number(verseNumber) > 0 ? Number(verseNumber) : null,
      translationId:location && location.translationId || null,
      bookId:location && location.bookId || null,
      chapter:location && location.chapter || null
    }];
    verseIndex = 0;
    pendingNext = false;
    pauseAfterCurrent = false;
    repeatState = null;
    currentVerseIndex = -1;
    sequenceIsChapter = false;
    continueAfterChapter = null;
    completionMessage = '';
    statusMessage = '';
    announcementKey = '';
    lastResult = null;
    state = 'preparing';
    updateControls();
    speakNext(session);
  }
  function speakRepeat(activeSession, detour){
    if(activeSession !== session || repeatState !== detour) return;
    var activeVerse = verses[detour.repeatVerseIndex];
    var utterance = createUtterance(activeVerse);
    var ended = false;
    currentVerseIndex = detour.repeatVerseIndex;
    utterance.onstart = function(){
      if(activeSession === session && repeatState === detour && !ended){
        updateControls();
        notifyVerseRepeat(activeVerse.verseNumber, {
          translationId:activeVerse.translationId || null, bookId:activeVerse.bookId || null,
          chapter:activeVerse.chapter || null, verse:activeVerse.verseNumber
        });
      }
    };
    utterance.onend = function(){
      if(activeSession !== session || repeatState !== detour || ended) return;
      ended = true;
      repeatState = null;
      verseIndex = detour.continuationVerseIndex;
      if(detour.wasPausedBeforeRepeat || state === 'paused'){
        state = 'paused';
        pendingNext = true;
        pauseSpeech();
        updateControls();
      } else if(verseIndex >= verses.length){
        continueAtChapterBoundary(activeSession, verses[verses.length - 1]);
      } else {
        state = 'playing';
        pendingNext = false;
        speakNext(activeSession);
      }
    };
    utterance.onerror = function(message){
      if(activeSession !== session || repeatState !== detour || ended) return;
      ended = true;
      lastResult = 'failed';
      finish(activeSession, message || 'Playback unavailable.');
    };
    notifyVerseStart(activeVerse.verseNumber, {
      translationId:activeVerse.translationId || null, bookId:activeVerse.bookId || null,
      chapter:activeVerse.chapter || null, verse:activeVerse.verseNumber
    });
    speakUtterance(utterance);
  }
  function repeatVerse(verseNumber){
    if(deferForMicrophone(function(){repeatVerse(verseNumber);})) return true;
    if(!supported() || !sequenceIsChapter || state === 'idle') return false;
    var repeatIndex = verses.findIndex(function(verse){ return verse.verseNumber === verseNumber; });
    if(repeatIndex < 0) return false;
    commandNativeReplay = false;
    var wasPaused = state === 'paused' || Boolean(repeatState && repeatState.wasPausedBeforeRepeat);
    var continuationVerseIndex = repeatState
      ? repeatState.continuationVerseIndex
      : pendingNext
        ? verseIndex
        : Math.max(verseIndex, currentVerseIndex + 1);
    session++;
    cancelSpeech();
    if(wasPaused) resumeSpeech();
    prepareCloudSpeech();
    var detour = {
      repeatVerseIndex: repeatIndex,
      continuationVerseIndex: continuationVerseIndex,
      wasPausedBeforeRepeat: wasPaused
    };
    repeatState = detour;
    pendingNext = false;
    pauseAfterCurrent = false;
    state = 'playing';
    updateControls();
    speakRepeat(session, detour);
    return true;
  }
  function getPlaybackSnapshot(){
    var nextIndex = repeatState ? repeatState.continuationVerseIndex : pendingNext ? verseIndex : verseIndex + 1;
    return {
      status: state,
      isChapter: sequenceIsChapter,
      currentVerse: currentVerseIndex >= 0 && verses[currentVerseIndex] ? verses[currentVerseIndex].verseNumber : null,
      nextVerse: state !== 'idle' && verses[nextIndex] ? verses[nextIndex].verseNumber : null,
      repeatActive: Boolean(repeatState),
      repeatVerse: repeatState ? verses[repeatState.repeatVerseIndex].verseNumber : null,
      repeatNextVerse: repeatState && verses[repeatState.continuationVerseIndex] ? verses[repeatState.continuationVerseIndex].verseNumber : null,
      wasPausedBeforeRepeat: repeatState ? repeatState.wasPausedBeforeRepeat : null,
      pendingNextWhilePaused: pendingNext
    };
  }
  function setSpeed(value){
    if(!Number.isFinite(Number(value))) return;
    var nextSpeed = Math.min(2,Number(value));
    if(SPEEDS.indexOf(nextSpeed) < 0) return;
    speed = nextSpeed;
    UserData.speechSpeed.save(speed);
    updateControls();
  }

  function setVoice(name){
    if(!Object.prototype.hasOwnProperty.call(PROFILES,name)) return;
    voicePreference = name;
    UserData.speechVoice.save(voicePreference);
    populateVoiceSelector();
  }

  function pauseForVoiceCommand(){
    if(state !== 'playing' && state !== 'preparing') return;
    if(actualPlayback && actualPlayback.provider === 'native' && currentVerseIndex >= 0){
      // Android native pause can cancel the utterance. Retain its complete verse
      // and chapter context, invalidate late callbacks, and replay only on resume.
      session++;
      state = 'paused';
      commandNativeReplay = true;
      utteranceStarted = false;
      cancelSpeech();
      updateControls();
    } else pauseResume();
  }

  function pauseResume(){
    if(!supported()) return;
    if(state === 'playing' || state === 'preparing'){
      state = 'paused';
      pauseSpeech();
    } else if(state === 'paused'){
      if(deferForMicrophone(pauseResume)) return;
      var synth = window.speechSynthesis;
      if(!commandNativeReplay && actualPlayback?.provider === 'native' &&
          synth?.speaking === false && synth.pending === false && canReplayAndroidPause()){
        retainInterruptedNative();
      }
      state = sessionStarted || utteranceStarted || pendingNext ? 'playing' : 'preparing';
      if(repeatState) repeatState.wasPausedBeforeRepeat = false;
      pauseAfterCurrent = false;
      resumeSpeech();
      if(commandNativeReplay){
        if(commandNativeReplay === 'interrupted') resumeOffset = wordOffset;
        commandNativeReplay = false;
        if(repeatState) speakRepeat(session,repeatState);
        else {verseIndex=currentVerseIndex; speakNext(session);}
      } else if(pendingNext){
        pendingNext = false;
        speakNext(session);
      }
    }
    updateControls();
  }

  function beginPreparation(){
    stopped = false;
    commandNativeReplay = false;
    session++;
    cancelSpeech();
    state = 'preparing';
    spokenChapterKey='';sessionStarted=false;preserveChapterOnce=false;
    actualPlayback = null;
    lastResult = null;
    statusMessage = 'Preparing ' + PROFILES[voicePreference].displayName + '…';
    updateControls();
  }
  function failPreparation(){ lastResult = 'failed'; finish(session,'Playback unavailable.'); }
  function resumeStopped(){
    if(!stopped) return false;
    if(deferForMicrophone(resumeStopped)) return true;
    if(localSupported() && window.speechSynthesis.paused) window.speechSynthesis.resume();
    stopped = false;
    state = 'preparing';
    prepareCloudSpeech();
    resumeOffset = pendingNext ? 0 : wordOffset;
    pendingNext = false;
    if(repeatState) speakRepeat(session, repeatState);
    else speakNext(session);
    return true;
  }
  function stop(preserveChapter, keepPosition){
    if(typeof cancelReaderVoicePlayback === 'function') cancelReaderVoicePlayback();
    if(keepPosition && state === 'idle') return;
    stopped = Boolean(keepPosition && verses.length);
    commandNativeReplay = false;
    session++;
    cancelSpeech();
    state = 'idle';
    if(!stopped){
      // Transport replacement retains context; a new sequence still identifies its destination.
      preserveChapterOnce=preserveChapter===true;
      if(!preserveChapterOnce) spokenChapterKey='';
      sessionStarted=false;
      verses = [];
      verseIndex = 0;
      pendingNext = false;
      pauseAfterCurrent = false;
      sequenceIsChapter = false;
      repeatState = null;
      currentVerseIndex = -1;
      continueAfterChapter = null;
    }
    completionMessage = 'Stopped. Press Play to continue reading.';
    statusMessage = '';
    updateControls();
    notifyPlaybackEnd();
  }
  if(typeof window !== 'undefined' && window.speechSynthesis && typeof window.speechSynthesis.addEventListener === 'function'){
    window.speechSynthesis.addEventListener('voiceschanged', populateVoiceSelector);
  }
  updateControls();
  populateVoiceSelector();
  return {
    prepare: prepareCloudSpeech,
    beginPreparation: beginPreparation,
    failPreparation: failPreparation,
    getVoiceProfiles: getVoiceProfiles,
    playChapter: playChapter,
    playVerse: playVerse,
    repeatVerse: repeatVerse,
    getPlaybackSnapshot: getPlaybackSnapshot,
    pauseResume: pauseResume,
    pauseForVoiceCommand: pauseForVoiceCommand,
    stop: stop,
    resumeStopped: resumeStopped,
    discardStopped: function(){ stopped = false; },
    setSpeed: setSpeed,
    setVoice: setVoice,
    setPlaybackListener: setPlaybackListener,
    setStatusMessage: setStatusMessage,
    getSpeed: function(){ return speed; },
    getVoice: function(){ return selectedVoice(); },
    getResolvedVoiceInfo: getResolvedVoiceInfo,
    getSpeedOptions: function(){ return SPEEDS.slice(); },
    refreshVoices: populateVoiceSelector,
    updateControls: updateControls,
    getState: function(){ return state; }
  };
}());
