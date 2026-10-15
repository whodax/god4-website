# Reader reference display

Baseline: main after PR #97, `f75ed569b0efcd93cac4fb8b8d3ac4b5adbc3e4e`.
Branch: `feature/reader-reference-display`. Changes are uncommitted.

## Existing implementation and synchronization gap

`renderPassage` generated the Reader's `<h2>` as Book Chapter. Verse selection,
quick-picker targeting, and speech progression updated Reader state/highlights but
did not regenerate that heading. A verse-specific passage therefore still looked
like a chapter-level location in the heading.

## Implementation

The existing heading is the sole reference display, in its original position and
with its existing typography, color, spacing, and native level-two heading semantics.
No CSS, control layout, focus behavior, or new live/status region is introduced.

`updateReaderReferenceDisplay` formats the rendered book name and chapter with a
verse suffix when a valid verse is selected. During narration, the existing
`.verse-spoken` owner takes precedence. Pause retains that reference; Stop restores
the explicitly selected reference or chapter-only reference. Playback does not mutate
saved selection merely to update the heading. A nonexistent/blank source coordinate
cannot produce a phantom verse suffix.

The renderer supplies escaped canonical book/chapter metadata on the heading.
The formatter derives its verse from existing Reader selection or the actual
rendered spoken marker, avoiding a second location state. It runs through existing
Reader-control refreshes and chapter rendering, covering selectors, picker,
Previous/Next, actual native/cloud playback callbacks, Repeat, Stop, automatic
chapter continuation, fullscreen, translation refresh and supported session restore.
Text changes happen synchronously; unchanged text is not rewritten. No focus or
announcement is forced by progression.

Cached Reader JavaScript changed, so shell `compact-reader-32` becomes
`compact-reader-33`. Translation and auth-vendor cache namespaces, digests,
protocols and explicit waiting-worker acceptance remain unchanged. The upgrade
test uses the actual PR #97 shell as its predecessor.

## Validation

- Focused reference-display tests: 16 passed, run before broader regressions.
- Navigation unit tests: 16 passed.
- JavaScript syntax and asset validation passed; `git diff --check` passed.
- Desktop, 390px and 320px, each normal/fullscreen, passed overflow and focus checks.
  Desktop and 320px normal/fullscreen were also visually inspected.
- Existing assertions now expect exact verse-specific headings where applicable.
  The cloud mobile text-preservation check compares Scripture verse text, allowing
  the reference heading to change during narration as required.
- Full regression sweep: 1,029 passed out of 1,033. Three failures were the legacy
  whole-Reader text-immutability assertion at different widths; it now correctly
  checks that Scripture verse text is unchanged. One picker/CSP integration timed
  out. All four cases passed the final serial rerun (4/4), including CSP without a
  production change. This records passing coverage across the sweep and rerun,
  rather than claiming one uninterrupted green full-suite run.
- Shell 32 → 33 explicit acceptance, translation retention and auth-vendor-cache
  preservation passed. No commit, push, PR or deployment was performed.

## Files changed

Application: `js/bible/reader.js`, `sw.js`.

New regression suite: `tests/reader-reference-display.spec.js`.

Updated heading/cache expectations: `tests/auth-loader.spec.js`,
`tests/auth-vendor-cache.spec.js`, `tests/cloud-tts.spec.js`,
`tests/compare-loader.spec.js`, `tests/genesis-original-language.spec.js`,
`tests/god4.spec.js`, `tests/offline-translation-management.spec.js`,
`tests/plans-focus-visibility.spec.js`, `tests/plans-readiness.spec.js`,
`tests/pwa.spec.js`, `tests/reader-empty-verse.spec.js`,
`tests/reader-speech-highlight.spec.js`, `tests/reading-journey.spec.js`,
`tests/scripture-picker.spec.js`, `tests/shared-reader-fullscreen.spec.js`,
`tests/word-study-loader.spec.js`.

Documentation: `docs/reader-reference-display.md`.
