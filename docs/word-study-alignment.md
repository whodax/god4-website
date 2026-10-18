# Word Study layout and exact alignment

The selected English verse stays in the same Word Study panel. Its reference,
Original Language heading and alignment status share one measured context block.
The Close header remains above that block; original tokens and lexical definitions
flow below it. The whole context stops pinning when it would leave less than 140px
for content. Short viewports therefore scroll normally instead of hiding controls.
The existing page or fullscreen Reader remains the sole scrolling surface.

## Available data

The 60,663 retained Genesis, Isaiah, John and Romans token records contain 15
lexical/reference fields. None supplies translation-specific English word spans.
Strong's numbers/definitions and verse-number compatibility do not establish word
alignment. There are **no verified production word alignments** shipped here,
including for DRA. Original-language tokens and lexical definitions remain usable;
the panel explicitly reports that exact word alignment is unavailable.
If the optional alignment module cannot load, English dictionary and verse-level
original-language lookup still work with the same unavailable-alignment notice.
The module is requested once, lazily, without delaying normal Word Study readiness.
Its load attempt has a three-second deadline. Errors, missing APIs and timeout keep
the fallback for the page lifetime; reloading the page permits another attempt.
Removing a timed-out script cannot guarantee cancellation of browser execution,
so any completion after the deadline is ignored by the controller.
Successful loading within the deadline is used on the next word activation, never
to rebuild an already open excerpt, change focus or repeat provider lookups.

## Reviewed alignment contract

`js/word-study/alignment.js` keeps an empty, code-reviewed production catalog.
Future catalog additions require a separately reviewed alignment source, including
title, source reference, revision and reviewer. A `verified` label received from
an arbitrary external source is not sufficient: there is no runtime external
catalog ingestion or inference service.

Entries pin the exact translation ID, canonical Reader book/chapter/verse, complete
English verse text, and every original token's canonical book/chapter/verse, index
and surface. Any mismatch, incomplete provenance, invalid range, non-authoritative
token record, or duplicate matching catalog entry makes alignment unavailable.

Each group contains arrays `english: [{start, end}, ...]` and
`original: [tokenIndex, ...]`. English ranges are half-open UTF-16 offsets into the
exact published verse text; surrogate pairs cannot be split. Multiple English
spans can identify multiple original tokens, including noncontiguous phrases and
overlapping groups. Exact Reader word offsets distinguish repeated occurrences.
Offsets come from DOM ranges only after the complete displayed Reader verse agrees
with its published text. Text drift clears stale offsets and disables alignment.
No matching against definitions, similar text, Strong's numbers or translations
is performed. Unmapped selections remain explicitly unavailable.

Verified groups highlight both the verse excerpt and Reader words, plus all linked
original chips. Enter/Space activate mapped excerpt phrases and original chips;
selection never moves focus automatically. Escape clears highlights, closes the
panel and restores the activating Reader word. Delayed English definitions do not
replace the excerpt or move keyboard focus.
Whitespace-only segments created by overlapping ranges retain their text but are
never keyboard-focusable phrase controls; accessible phrase names are trimmed.

## Verification

`word-study-alignment.unit.js` checks provenance/identity rejection, ambiguity,
range validation and bidirectional many-to-many selection. Browser tests cover
Hebrew, Greek, DRA, no alignment, dictionary-only definitions, keyboard activation,
desktop, mobile, fullscreen and short viewport layouts. Synthetic alignment
fixtures exist only inside tests and explicitly identify themselves as test-only;
they make no linguistic claim and are never published as production mappings.
Layout checks configure reduced motion through browser `contextOptions` and assert
the actual media-query state before navigating. This avoids measuring an active
passage-navigation animation as though Word Study had jumped or overlapped after
navigation settled. Geometry and scroll-offset assertions retain exact bounds;
there are no rounding tolerances or time-based settling sleeps in these checks.

No Bible text, original-language shards, manifests, numbering or source provenance
is regenerated or modified. The shell cache advances to `compact-reader-40` to
include the lazily loaded alignment module for offline use.
