(() => {
  const byId = (id) => document.getElementById('eth-' + id);
  const book = byId('book');
  const chapter = byId('chapter');
  const verse = byId('verse');
  const voice = byId('voice');
  const speed = byId('speed');
  const play = byId('play');
  const heading = byId('heading');
  const passage = byId('passage');
  const pane = heading.parentElement;
  const status = byId('reading-status');
  const cloud = window.BibleCloudTTS;
  const speech = window.speechSynthesis;
  const embedded = byId('texts');
  const data = embedded && JSON.parse(embedded.textContent);
  let currentBook;
  let bookRequest = 0;
  let playback = 0;
  let playing = false;
  let useCloud = false;
  let spoken;
  let lines = [];

  async function loadJson(file) {
    if (data) return file === 'books' ? Object.entries(data).map(([id, entry]) => ({ id, name: entry.name })) : data[file];
    const response = await fetch('/data/ethiopian-readings/' + encodeURIComponent(file) + '.json');
    if (!response.ok) throw new Error('Ethiopian reading text unavailable');
    return response.json();
  }

  function clearHighlight() {
    spoken?.removeAttribute('aria-current');
    spoken = null;
  }

  function updatePlay() {
    play.textContent = playing ? 'Stop' : 'Play';
    play.setAttribute('aria-label', playing ? 'Stop Read Aloud' : 'Play Read Aloud');
    play.disabled = !playing && (!(cloud?.available() || speech) || !lines.length);
  }

  function stopReading() {
    playback += 1;
    if (playing) {
      cloud?.cancel();
      speech?.cancel();
    }
    playing = false;
    clearHighlight();
    updatePlay();
  }

  function scrollToVerse(index) {
    const paragraph = passage.children[index];
    const bounds = pane.getBoundingClientRect();
    const rect = paragraph.getBoundingClientRect();
    if (rect.top < bounds.top + 8 || rect.bottom > bounds.bottom - 8) {
      pane.scrollTop += rect.top - bounds.top - 16;
    }
  }

  function showChapter(preferredVerse) {
    const section = currentBook.sections[chapter.selectedIndex];
    heading.textContent = currentBook.name + ' ' + section.id + (section.title ? ' · ' + section.title : '');
    clearHighlight();
    lines = section.lines.filter(([, text]) => text.trim());
    const content = document.createDocumentFragment();
    const options = document.createDocumentFragment();
    lines.forEach(([number, text], index) => {
      options.append(new Option(number || 'Paragraph ' + (index + 1), index));
      const paragraph = document.createElement('p');
      if (number) {
        const label = document.createElement('sup');
        label.textContent = number;
        paragraph.append(label);
      }
      paragraph.append(document.createTextNode(text));
      content.append(paragraph);
    });
    passage.replaceChildren(content);
    verse.replaceChildren(options);
    verse.disabled = !lines.length;
    pane.hidden = false;
    pane.scrollTo({ top: 0, behavior: 'instant' });
    const index = lines.findIndex(([number]) => String(number) === preferredVerse);
    if (index >= 0) {
      verse.selectedIndex = index;
      scrollToVerse(index);
    }
    updatePlay();
  }

  async function showBook(preferredChapter, preferredVerse) {
    const request = ++bookRequest;
    lines = [];
    verse.disabled = chapter.disabled = true;
    chapter.replaceChildren();
    verse.replaceChildren();
    pane.hidden = true;
    updatePlay();
    status.textContent = 'Loading reading text.';
    try {
      const entry = await loadJson(book.value);
      if (request !== bookRequest) return false;
      currentBook = entry;
      chapter.replaceChildren(...entry.sections.map(({ id }) => new Option(id, id)));
      if (entry.sections.some(({ id }) => id === preferredChapter)) chapter.value = preferredChapter;
      chapter.disabled = false;
      showChapter(preferredVerse);
      status.textContent = playing ? 'Reading aloud.' : '';
      return true;
    } catch {
      if (request === bookRequest) {
        stopReading();
        status.textContent = 'This book could not be loaded. Choose another book or reload the page.';
      }
      return false;
    }
  }

  function genderOf({ name }) {
    if (/\b(?:Zira|Samantha|Female)\b/i.test(name)) return 'female';
    if (/\b(?:David|Mark|Male)\b/i.test(name)) return 'male';
    return '';
  }

  function deviceVoice(profile) {
    const english = (speech?.getVoices() || []).filter(({ localService, lang }) =>
      (localService || (!embedded && navigator.onLine)) && /^en(?:-|_|$)/i.test(lang)
    );
    return english.find(candidate => candidate.localService && genderOf(candidate) === profile) ||
      english.find(candidate => genderOf(candidate) === profile) || english[0];
  }

  async function speakLine(attempt, index) {
    if (attempt !== playback) return;
    if (index >= lines.length) {
      if (chapter.selectedIndex + 1 < chapter.length) {
        chapter.selectedIndex += 1;
        showChapter();
      } else if (book.selectedIndex + 1 < book.length) {
        book.selectedIndex += 1;
        if (!await showBook() || attempt !== playback) return;
      } else {
        stopReading();
        status.textContent = 'Finished reading the collection.';
        return;
      }
      setTimeout(() => speakLine(attempt, 0), 0);
      return;
    }

    const text = lines[index][1];
    const profile = voice.value;
    const rate = Number(speed.value);
    const onstart = () => {
      if (attempt !== playback) return;
      clearHighlight();
      spoken = passage.children[index];
      spoken.setAttribute('aria-current', 'true');
      verse.selectedIndex = index;
      scrollToVerse(index);
    };
    const onend = () => setTimeout(() => speakLine(attempt, index + 1), 0);
    const speakOnDevice = () => {
      if (attempt !== playback) return;
      useCloud = false;
      const chosen = deviceVoice(profile);
      if (!chosen) {
        stopReading();
        status.textContent = 'Install or enable an English voice in your device’s speech settings.';
        return;
      }
      const message = genderOf(chosen) === profile ? 'Reading with a device voice.' : 'Reading with a device voice. The selected voice is unavailable.';
      if (status.textContent !== message) status.textContent = message;
      const chunks = text.match(/\S.{0,219}(?=\s|$)|\S{1,220}/gs);
      function speakChunk(i) {
        if (attempt !== playback) return;
        const utterance = new SpeechSynthesisUtterance(chunks[i]);
        utterance.voice = chosen;
        utterance.lang = chosen.lang;
        utterance.rate = rate;
        if (!i) utterance.onstart = onstart;
        utterance.onend = i + 1 === chunks.length ? onend : () => setTimeout(() => speakChunk(i + 1), 0);
        utterance.onerror = () => {
          if (attempt !== playback) return;
          stopReading();
          status.textContent = 'Your device could not read this passage aloud.';
        };
        speech.speak(utterance);
      }
      speakChunk(0);
    };
    if (useCloud && cloud.speak(text, profile, rate, { onstart, onend, onfallback: speakOnDevice })) return;
    speakOnDevice();
  }

  function beginReading() {
    playing = true;
    useCloud = Boolean(cloud?.available() && navigator.onLine);
    if (useCloud) cloud.prepare();
    updatePlay();
    status.textContent = 'Reading aloud.';
    speakLine(++playback, Math.max(0, verse.selectedIndex));
  }

  const fullscreen = byId('fullscreen');
  const fullscreenToggle = byId('fullscreen-toggle');
  const reader = byId('reader');
  fullscreenToggle.hidden = typeof fullscreen.showModal !== 'function';
  fullscreenToggle.addEventListener('click', () => {
    if (fullscreen.open) {
      fullscreen.close();
      return;
    }
    const position = pane.scrollTop;
    fullscreen.append(reader);
    fullscreen.showModal();
    fullscreenToggle.setAttribute('aria-pressed', 'true');
    fullscreenToggle.textContent = 'Exit Fullscreen';
    fullscreenToggle.focus({ preventScroll: true });
    pane.scrollTop = position;
  });
  fullscreen.addEventListener('close', () => {
    const position = pane.scrollTop;
    byId('reader-mount').append(reader);
    fullscreenToggle.setAttribute('aria-pressed', 'false');
    fullscreenToggle.textContent = 'Fullscreen';
    fullscreenToggle.focus({ preventScroll: true });
    pane.scrollTop = position;
  });

  byId('top').addEventListener('click', () => {
    pane.scrollTo({ top: 0, behavior: 'instant' });
    pane.focus();
  });
  book.addEventListener('change', () => {
    stopReading();
    showBook();
  });
  chapter.addEventListener('change', () => {
    stopReading();
    showChapter();
    status.textContent = '';
  });
  verse.addEventListener('change', () => {
    stopReading();
    scrollToVerse(verse.selectedIndex);
    status.textContent = '';
  });
  play.addEventListener('click', () => {
    if (playing) {
      stopReading();
      status.textContent = 'Read Aloud stopped.';
    } else {
      beginReading();
    }
  });
  window.addEventListener('pagehide', stopReading);

  status.textContent = 'Loading the book list.';
  loadJson('books').then((catalog) => {
    const params = new URLSearchParams(location.search);
    book.replaceChildren(...catalog.map(({ id, name }) => new Option(name, id)));
    const initial = params.get('book');
    if (catalog.some(({ id }) => id === initial)) book.value = initial;
    book.disabled = false;
    showBook(params.get('chapter'), params.get('verse'));
  }).catch(() => {
    status.textContent = 'Could not load the collection. Reload the page or use the offline download.';
  });
})();
