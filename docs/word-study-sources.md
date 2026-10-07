# Word Study Sources

The Word Study importer accepts locally supplied source files and never downloads source material.

## Webster's Unabridged Dictionary

- Project Gutenberg eBook #29765: https://www.gutenberg.org/ebooks/29765
- Project Gutenberg identifies this edition as public domain in the United States.
- The importer uses only parsed dictionary content. Project Gutenberg headers, footers, and trademark references are removed from generated data.

## Moby Thesaurus II

- Project Gutenberg eBook #3202: https://www.gutenberg.org/ebooks/3202
- Main thesaurus source: https://www.gutenberg.org/files/3202/files/mthesaur.txt
- Its included documentation states: "Public Domain material by grant from the author, January, 2001."
- Project Gutenberg identifies the eBook as public domain in the United States.

Public-domain status may differ outside the United States. Raw Gutenberg source files are not deployed and should not be committed unless their retention and distribution requirements are reviewed.

## Conservative contextual sense selection

`js/word-study/sense-selector.js` selects only among the existing Webster
definitions for the exact/stemmed headword already resolved by the dictionary
provider. The corpus, candidate order, definition text and existing Moby related
words are unchanged. Exact lookup, inflection fallback and Dictionary → Local
provider order are unchanged. The provider exposes `senseSelection` metadata:
`selectedIndex` (zero-based), `confidence`, `reasons`, and `ambiguous`.
The panel/controller is unchanged and does not render this metadata.

This module is synchronous, deterministic, dependency-free and performs no
network calls. It is usable offline once the normal dictionary shard is loaded;
this change does not add persistent dictionary caching or guarantee dictionary
availability after an offline reload. The module is loaded before the dictionary
provider and included in shell cache `compact-reader-16`, a single bump from 15.

### Signals and confidence

| Signal | Weight / bound |
| --- | --- |
| Explicit `[Obs.]`, `Obs.`, `obsolete` or `archaic` | −1.5; soft penalty, never automatic exclusion |
| Empty/non-letter text or grammar-only markers such as `pl.` | −6 |
| Obvious dangling continuation punctuation | −3 |
| Long compound blob: over 1,000 characters with compound/domain markers | −0.75 and cannot be confidently promoted |
| Distinct meaningful verse/definition token overlap | +1.25 per match, capped at two matches (+2.5) |
| Generic `Name [headword] of Place` frame plus explicit human-role language in a noun/blank-POS definition opening | +3 |
| Noninitial capitalized display word plus a title-case phrase in a noun definition opening | +0.25 |

Context overlap ignores function words and clicked/matched headword tokens.
Feature-only suffix folding handles common endings, including `created`/`Creator`;
it does not change dictionary key normalization or headword lookup. No English POS
tagger is introduced. The role frame uses generic human-role cues in definitions,
never a word/book/verse-specific override. Capitalization alone cannot promote a
candidate. Hebrew/Greek tokens, morphology, Strong's glosses and alignment guesses
are not used at all.

Evidence is taken from at most the first 420 characters of the opening definition
sentence, after removing double-quoted examples. Repetition and definition length
do not increase the overlap score; trailing citations/compound material cannot
dominate it. Original array index is the final tie-breaker.

Promotion requires a score lead of at least **1.5**, positive evidence of at least
**1.5**, and a substantive candidate that is not flagged as a compound blob.
Insufficient evidence/close scores preserve candidate zero and expose ambiguity.
The exception is a grammar-only/non-definition artifact at index zero: the best
substantive candidate replaces it, but close alternatives still remain ambiguous.
A single substantive candidate needs no competition test.

Confidence is **0 when ambiguous**, otherwise `min(1, scoreMargin / 3)` (1 for a
single candidate). This is a rule-strength indicator, not a calibrated probability
of semantic correctness. Reasons record the applied signals and ambiguity policy.
No new ambiguity message, sense chooser, focus behavior or visible layout is added.

### Real-corpus regressions and limits

- Genesis 14:1 `king`: candidate 1 (Chinese instrument) → candidate 2 (ruler/sovereign),
  using the generic named-role frame.
- Genesis 1:1 `God`: candidate 1 (obsolete adjective) → candidate 3 (existing noun),
  using lexical context overlap and weak capitalization evidence.
- John 1:1 `word`: candidate 1 retained with ambiguity; the long contaminated
  compound candidate is not promoted. The theological text remains inside its
  existing compound entry and is not rewritten/extracted by this phase.
- `beginning`: the sensible first candidate remains selected.

Tests use real deployed candidates, contrasting local contexts, obsolete senses,
artifacts, blank POS, ties, quotations, untouched arrays/text, exact/possessive
lookup, shard reuse, browser panel behavior and existing original-language tests.
Generic role frames can mistake capitalized things/places for people; suffix
folding can conflate words; obsolete-label penalties can be inappropriate for old
translations; unquoted examples inside an opening sentence can still add noise.
Sparse context and missing English/original-language alignment remain limitations.
Future work should evaluate false positives and restore corpus sense boundaries
with provenance before broadening these signals. No corpus regeneration occurs here.
