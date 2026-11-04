const openingTopicKey = 'god4.discovery.openingTopic';

export function createDiscovery(topics, random = Math.random, storage = () => localStorage) {
  let previousOpening;
  try {
    previousOpening = storage().getItem(openingTopicKey);
  } catch {
    // Discovery works without visit history.
  }

  const take = items => items.splice(Math.floor(random() * items.length), 1)[0];
  let topic, sequence, position;

  function begin(excluded) {
    topic = take(topics.filter(candidate => candidate.id !== excluded));
    const count = 3 + Math.floor(random() * 3);
    const candidates = [...topic.passages];
    sequence = Array.from({ length: count }, () => take(candidates));
    position = 0;
    return sequence[position];
  }

  const opening = begin(previousOpening);
  try {
    storage().setItem(openingTopicKey, topic.id);
  } catch {
    // The in-memory sequence remains usable.
  }

  return {
    opening,
    next() {
      return ++position < sequence.length ? sequence[position] : begin(topic.id);
    }
  };
}

export async function open(card, render) {
  const response = await fetch('/js/home-discovery-catalog.json');
  if (!response.ok) throw new Error('Scripture discovery catalog unavailable');
  const { topics } = await response.json();
  const discovery = createDiscovery(topics);
  let queued = 0;

  function showNext() {
    render(discovery.next(), true);
    card.classList.remove('is-fading');
    // Continue an input burst without fading the card out again.
    if (--queued) setTimeout(showNext, 200);
  }

  render(discovery.opening, false);
  return function advance() {
    if (++queued !== 1) return;
    card.classList.add('is-fading');
    setTimeout(showNext, 200);
  };
}
