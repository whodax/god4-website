# Voice Scripture navigation

Voice Commands uses the nine-translation registry and the existing Reader navigation
and translation loaders. The Catholic edition displays CTH — Catholic Bible
(Douay-Rheims), while its internal translation ID remains dra. Other editions
remain WEB, ASV, KJV, YLT, DBY, WBS, RV and GNV.

## Catholic commands

Supported names include Catholic, Catholic Bible, CTH, spelled C T H, the full
Catholic Bible (Douay-Rheims) title, and the backward-compatible DRA / D R A names.
The actual Douay-Rheims title remains supported. Experimental phonetic spellings
such as Dewey Reams, Do A Rings and Do We Reams have been removed.

Use Switch to, Change to, Read, Select or Use with a complete translation name.
Bible, Version, Translation and Edition suffixes remain supported. For example:

- Switch to CTH
- Change to Catholic Bible
- Read CTH, Tobit chapter 1 verse 2
- DRA, Tobit chapter 1 verse 2 (legacy command, displays CTH)

Case, Unicode punctuation, hyphens, apostrophes and spacing normalize
predictably. Matching uses complete phrases and catalog ambiguity checks; there
is no fuzzy matching or speculative phonetic recombination. Non-primary Web Speech
alternatives never override primary commands or resolve ambiguity by guessing.
Invalid references and incompatible canon/numbering changes preserve the passage.

## Android microphone turns

Android still uses a single final command per explicit listening turn. Narration
waits for microphone onend; no timer, per-verse callback or stale recognizer event
may restart capture or audio. Native, cloud and fallback narration keep the same
playback intent and chapter-introduction rules.

## Diagnostics removed

The experimental #voice-debug panel, tracing hooks, styling, transcript capture and
maxAlternatives hint have been removed. The fragment no longer enables diagnostics
or loads the optional Reader runtime. Do not use older preview diagnostic
instructions to validate this simplification build. Physical Android and TalkBack
acceptance should use the normal Voice Commands UI.

## Persistence and offline compatibility

CTH is display metadata. The ID dra, dra.js Bible file, download manifest, cache
keys, storage keys, canon and attribution remain unchanged. Existing DRA voice
commands still work. Existing saved references ending in (DRA) display (CTH),
without rewriting stored references; Open, duplicate detection and Remove retain
the original identity. New saves use (CTH) with translationId dra.

Shell 53 and its 49 asset paths remain unchanged. Historical upgrade tests pin
exact current source checksums and cached bytes while retaining their historical
Git fixtures, update acceptance and offline recovery assertions. A same-generation
installed preview can retain old code until a fresh preview origin is used; no
new service-worker generation or asset rename is part of this change.

See catholic-bible-simplification.md for the display contract and validation.
