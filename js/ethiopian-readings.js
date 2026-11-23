(() => {
  const byId = (id) => document.getElementById(id);
  const book = byId('eth-book');
  const chapter = byId('eth-chapter');
  const play = byId('eth-play');
  const stop = byId('eth-stop');
  const heading = byId('eth-heading');
  const passage = byId('eth-passage');
  const status = byId('eth-reading-status');
  const speech = window.speechSynthesis;
  const dataPath = '/data/ethiopian-readings/';
  let currentBook;
  let bookRequest = 0;
  let playback = 0;
  let spokenLines = [];

  async function loadJson(path) {
    const response = await fetch(dataPath + path);
    if (!response.ok) throw new Error('Ethiopian reading text unavailable');
    return response.json();
  }

  function stopReading() {
    playback += 1;
    if (!stop.disabled) speech.cancel();
    stop.disabled = true;
    play.disabled = !speech || !spokenLines.length;
  }

  function showChapter() {
    stopReading();
    const section = currentBook.sections.find(({ id }) => id === chapter.value);
    heading.textContent = currentBook.name + ' ' + section.id + (section.title ? ' · ' + section.title : '');
    const content = document.createDocumentFragment();
    spokenLines = [];
    for (const [number, text] of section.lines) {
      if (!text.trim()) continue;
      spokenLines.push(text);
      const paragraph = document.createElement('p');
      if (number) {
        const verse = document.createElement('sup');
        verse.textContent = number;
        paragraph.append(verse);
      }
      paragraph.append(document.createTextNode(text));
      content.append(paragraph);
    }
    passage.replaceChildren(content);
    heading.parentElement.hidden = false;
    play.disabled = !speech || !spokenLines.length;
    status.textContent = speech ? '' : 'Read Aloud is unavailable in this browser.';
  }

  async function showBook(preferredChapter) {
    const request = ++bookRequest;
    spokenLines = [];
    stopReading();
    chapter.disabled = true;
    chapter.replaceChildren();
    heading.parentElement.hidden = true;
    status.textContent = 'Loading reading text…';
    try {
      const entry = await loadJson(encodeURIComponent(book.value) + '.json');
      if (request !== bookRequest) return;
      currentBook = entry;
      chapter.replaceChildren(...entry.sections.map(({ id }) => new Option(id, id)));
      if (entry.sections.some(({ id }) => id === preferredChapter)) chapter.value = preferredChapter;
      chapter.disabled = false;
      showChapter();
    } catch {
      if (request === bookRequest) status.textContent = 'This book could not be loaded. Choose another book or reload the page.';
    }
  }

  function readAloud() {
    const voice = speech.getVoices().find(({ localService, lang }) => localService && /^en(?:-|_|$)/i.test(lang));
    if (!voice) {
      status.textContent = 'Install or enable an offline English voice in your device’s speech settings.';
      return;
    }
    const attempt = ++playback;
    play.disabled = true;
    stop.disabled = false;
    status.textContent = 'Reading aloud';
    function speakLine(index) {
      if (attempt !== playback) return;
      if (index >= spokenLines.length) {
        stopReading();
        status.textContent = 'Finished reading this chapter.';
        return;
      }
      const line = new SpeechSynthesisUtterance(spokenLines[index]);
      line.voice = voice;
      line.lang = voice.lang;
      line.onend = () => setTimeout(() => speakLine(index + 1), 0);
      line.onerror = () => {
        if (attempt !== playback) return;
        stopReading();
        status.textContent = 'Your device could not read this passage aloud.';
      };
      speech.speak(line);
    }
    speakLine(0);
  }

  book.addEventListener('change', () => showBook());
  chapter.addEventListener('change', showChapter);
  play.addEventListener('click', readAloud);
  stop.addEventListener('click', () => {
    stopReading();
    status.textContent = 'Read Aloud stopped.';
  });
  window.addEventListener('pagehide', stopReading);

  status.textContent = 'Loading the book list…';
  loadJson('books.json').then((catalog) => {
    const params = new URLSearchParams(location.search);
    book.replaceChildren(...catalog.map(({ id, name }) => new Option(name, id)));
    const initial = params.get('book');
    if (catalog.some(({ id }) => id === initial)) book.value = initial;
    book.disabled = false;
    showBook(params.get('chapter'));
  }).catch(() => {
    status.textContent = 'Could not load the collection. Reload the page or use the offline download.';
  });
})();
