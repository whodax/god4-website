# Reader empty verse placeholders

Baseline: `58f89ebd8fa0913517e87d909c98d0d0e4033b12`.
Branch: `fix/reader-empty-verse-placeholder`.

## Scope and behavior

Reader previously created a verse span and keyboard-focusable “Highlight
verse” button for every stored array slot, including empty source-note
placeholders. It also offered these slots in the verse selector. This exposed
a standalone number without readable Scripture. The source coordinates are
intentional and must remain in BibleData: deleting a slot would renumber
subsequent verses.

`isRenderableVerseText(text)` in `js/bible/reader.js` accepts only primitive
strings with non-whitespace content. It rejects empty strings, Unicode
whitespace-only strings, null, undefined, numbers, booleans, arrays and metadata
objects. Existing chapter slots are strings; navigation passes the actual
`BibleData.getVerse(...).text` display field. The helper tests for emptiness
without rewriting the displayed string or removing meaningful text.

`renderPassage()` skips empty slots, retaining `index + 1` for every actual
verse. `populateVerses()` applies the same rule to the selector. No empty
span, numbered button, word target, accessible label or focus destination is
created. Normal verse text, word buttons, highlight behavior, styles and
typography remain unchanged.

Direct `setReaderVerse()` and `selectReaderVerse()` calls to an existing empty
coordinate clear selection and saved verse state and return false. Reference
navigation through `navigateReaderToPassage()` keeps the requested chapter,
renders its readable verses, clears the empty selection and returns false.
It does not redirect to another verse. Saved empty coordinates and selections
made empty by a translation switch also clear. There is no Scripture-reference
URL parser in the current app; reference links use the existing navigation
function. Stale selector requests are covered separately.

Previous/next verse actions walk renderable coordinates in the current chapter.
For ASV and RV, 23 advances to 25 and 25 goes back to 23. For WEB, next is
disabled at Romans 16:24. No verse numbering is changed, and direct requests
to omitted coordinates do not use this adjacent traversal. Clearing an empty
selection happens before establishing the chapter's resume cursor, so a stale
empty coordinate is not retained in Reader state. Speech/TTS code is unchanged.

## Translation audit

All eight translation bundles were inspected locally.

| Translation | Empty stored slots throughout Bible | Romans 16 readable ending |
| --- | ---: | --- |
| WEB | 5 | Verse 24 present; empty 25 omitted; 26–27 absent |
| ASV | 16 | Empty 24 omitted; 25–27 present at original coordinates |
| RV | 16 | Empty 24 omitted; 25–27 present at original coordinates |
| KJV | 0 | 24–27 unchanged |
| YLT | 0 | 24–27 unchanged |
| Darby | 3 | 24–27 unchanged |
| Webster | 0 | 24–27 unchanged |
| Geneva | 0 | 24–27 unchanged |

WEB's other empty coordinates are Luke 17:36 and Acts 8:37, 15:34 and 24:7.
ASV/RV also have empty slots in Matthew, Mark, Luke, John and Acts. Darby's
empty coordinates are Matthew 23:14 and Acts 8:37 and 15:34. The helper applies
the same presentation rule to these existing slots without changing data.

WEB Romans 16 retains 25 stored slots but offers 24 numbered Reader options.
ASV/RV retain 27 stored slots but offer 26 numbered Reader options. The other
five Romans 16 translations retain all 27 numbered options. Each selector
also retains its existing unnumbered “Verse” option.

## Files

- `js/bible/reader.js`: renderability, filtered presentation, selection clearing,
  and adjacent readable-verse navigation.
- `sw.js`: shell cache 20 → 21 only.
- `tests/reader-empty-verse.unit.js`: helper, adjacent traversal, and baseline
  preservation checks.
- `tests/reader-empty-verse.spec.js`: all eight translations, navigation,
  persistence, accessibility, synthetic whitespace, and offline Reader checks.
- `tests/romans-original-language.spec.js`: update only the old empty-marker
  rendering expectation; preserve the source-data assertion and mapping tests.
- `tests/pwa.spec.js`: cache upgrade expectations and cached Reader verification.
- `tests/offline-translation-management.spec.js`: cache version expectation.
- `docs/reader-empty-verse-placeholder.md`: implementation and acceptance record.

No Scripture bundle, translation manifest, BibleData, original-language provider
or data shard, English dictionary, Compare, CSS, or speech/TTS file is modified.
WEB manifest revision remains `a32647ad749afd31`. The existing cache upgrade
preserves retained translations. Reader JS is listed in `SHELL_ASSETS`, requiring
the single 20 → 21 shell bump so offline clients acquire the changed runtime.

## Validation commands

```text
node --test tests/reader-empty-verse.unit.js tests/web-psalms-data.unit.js tests/romans-original-language-data.unit.js tests/romans-source-compatibility.unit.js tests/word-study-reference-mapping.unit.js
node node_modules/@playwright/test/cli.js test tests/reader-empty-verse.spec.js tests/reader-verse-cleanup.spec.js tests/compact-reader-controls.spec.js tests/shared-reader-fullscreen.spec.js tests/final-reader-hardening.spec.js tests/romans-original-language.spec.js tests/web-psalms.spec.js tests/translation-loader.spec.js tests/translation-manifest.spec.js tests/translation-cache-protocol.spec.js tests/pwa.spec.js tests/offline-translation-management.spec.js --workers=1
node tests/validate-assets.js
node tools/generate-translation-manifest.js --check
git diff --check
```

Use explicit `node --check` for each added/modified JavaScript file as well.
Initial failures must be reported separately from isolated/retry passes.

## Hosted acceptance and limitations

Cloudflare preview acceptance is **pending**. No preview of this local runtime
change is published because push and deployment are not authorized. Do not
describe the task as fully accepted until a preview containing this commit
passes the required checks:

- WEB Romans 16: verse 24 text, no empty 25 marker/option, no 26–27.
- ASV/RV Romans 16: no empty 24 marker/option; original 25–27 text and numbers.
- KJV Romans 16: 24–27 unchanged.
- WEB Romans 14:24–26: translation-aware canonical Greek lookup unchanged.
- Romans 8:28: one `παντα`, `G3956`, `A-APN`.
- WEB Psalm 23: correct six verses.
- Genesis 1:1 Hebrew; John 1:1 Greek; Isaiah 11:3 Original Language hidden.
- No page errors or unexpected console errors.

BibleData continues to return the empty source coordinate. Reader does not
invent missing Scripture, explanatory source notes, or English-to-Greek token
alignment. Compare presentation remains outside this change. Programmatic
requests to an empty Reader destination return false after keeping the chapter
and clearing the verse selection. Prior Word Study focus/definition-loading
tests have exhibited intermittent failures; exact run outcomes are recorded
below after validation.

## Local results — October 9, 2026

- Helper/navigation unit tests: **16 passed, 0 failed**.
- Combined helper, Psalms, Romans data and mapping unit tests: **225 passed,
  0 failed, 0 skipped**.
- Initial focused Reader run: **19 passed, 0 failed** before the offline test
  was added and resume-cursor assertions were extended.
- Broad browser run: **138 passed, 4 failed** out of 142 tests. The four
  failures were focus-return assertions in existing tests: WEB Romans 14:23,
  ASV Romans 16:25, KJV Romans 16:26 and Genesis 1:1. Their assertions were
  not changed.
- Isolated rerun of those four cases: **4 passed, 0 failed**; each passed on
  the first isolated attempt, without consuming the configured retries.
  These are flaky rerun passes, not clean passes in the original broad run.
- Final focused run on the final Reader runtime: **20 passed, 0 failed**,
  including all eight translation inventories, all direct empty-coordinate
  requests, saved-state and translation-switch clearing, normal focus,
  whitespace and all-empty cases, and cached Reader 21 offline behavior.
- Required WEB Romans 14:24–26 and Romans 8:28 checks passed in the broad
  run. WEB Psalms 22/23/24/150 and KJV/ASV Psalm 23 checks passed. Genesis 1:1
  passed on isolated rerun; John 1:1 and Isaiah 11:3 passed in the broad run.
- Reader layout, normal/fullscreen focus and keyboard controls, loader,
  translation manifest, cache protocol and PWA/offline suites passed.
- Asset validation passed: **39 references, 26 referenced JavaScript files,
  3 icons**, worker validation and metadata for all eight translations.
- Explicit JavaScript syntax checks passed for every added/modified JS file.
- Manifest generator `--check` and `git diff --check` passed.
- Git comparison against the baseline confirms Scripture bundles, translation
  manifest and original-language code/data are unchanged; only Reader changes
  under the inspected Bible and Word Study paths.

Isolation command:

```text
node node_modules/@playwright/test/cli.js test tests/romans-original-language.spec.js --grep 'web Romans 14:23|asv Romans 16:25|Romans 16:26 discovers|preserves genesis 1:1' --workers=1 --retries=2
node node_modules/@playwright/test/cli.js test tests/reader-empty-verse.spec.js --workers=1
```

All 142 distinct broad-run cases have successful results across the original
run and isolated rerun. This does not erase the four original failures or
satisfy pending hosted preview acceptance.
