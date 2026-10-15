# Coherent Reader Scripture picker

Branch: `feature/reader-reference-display`. Starting commit: `b05cf07`.
This correction evolves the existing PR #97 picker. No second picker or passage
renderer is introduced. Changes remain uncommitted and unpushed.

## PR #97 implementation reused

PR #97 already supplied an activation-built native dialog, searchable scrollable
books, canonical translation-aware chapter and verse data, native number buttons,
Whole Chapter, a stepped mobile flow, modal keyboard handling, focus restoration,
readiness/translation generations and shared `navigateReaderToPassage` navigation.

The missing primary interaction was the launcher: its generic Scripture button sat
beside three primary dropdowns. Current reference text lived only in the passage
heading after b05cf07. Draft chapter selection and actual spoken verse selection
also needed to be reflected more clearly in the picker.

## Final UI

The sticky Reader toolbar begins with Previous Chapter, a compact current-reference
button such as **Isaiah 53:5 ▾**, and Next Chapter. Translation, Play, More and
Fullscreen retain their functionality. The original book/chapter/verse selects are
available as **Detailed Scripture navigation** inside More. The primary experience
is the reference launcher and grid picker; one-click chapter arrows remain visible.

Desktop uses the available dialog width with Books/search/scrolling list on the
left and a larger chapter grid on the right. Choosing a chapter presents the verse
grid and Whole Chapter. Current/draft book and chapter are underlined and highlighted
using the existing palette and expose `aria-current`. The verse marker follows the
actual spoken verse or ordinary Reader selection. A deep current chapter such as
Psalm 119 is scrolled into view on opening without moving book focus.

At 390px and 320px the same dialog displays Books → Chapters → Verses, with Back
controls. Number targets are at least 44px wide/48px high on mobile and 52px high
on desktop. The book list and number panes scroll independently. No Bible.com
branding, palette, typography or external assets are used.

The passage `<h2>` is chapter context again (**Isaiah 53**). The b05cf07 formatter
now supplies the live location to the launcher; the heading's canonical metadata
is reused, rather than retaining a second verse-location status.

## State, focus and accessibility

The launcher derives its reference from the rendered passage identity and the
existing spoken marker/selected verse. No new authoritative Reader location state
is stored. Existing control refreshes synchronize the launcher and open picker.
Speech progression updates verse markers without rebuilding the number grid or
moving focus. An untouched picker follows chapter continuation; deliberate book
search/browsing is preserved while speech continues.

The dialog has an accessible name and Books, Chapters and Verses headings. Search
has an explicit label. Native Tab, Shift+Tab, Enter and Space work with visible
focus, including wrapping at modal boundaries. Escape/Close restore launcher focus;
exact verse navigation retains PR #97's focus on the destination verse. Fullscreen
lets the picker handle Escape and Tab before the Reader shell.

Readiness cancellation, translation invalidation, unavailable Scripture, offline
retention, Search targeting and Plan session rules reuse existing paths. The Speech
module and its generation/attempt protections are unchanged. Active Previous/Next
Verse still replace playback safely; voice profiles, rate and chapter/single-verse
mode remain intact. No per-verse live region is added.

## PWA

Cached HTML, CSS and JS changed, so shell 33 advances once to
`god4-shell-compact-reader-34`. Existing picker assets were already precached;
there is no new runtime asset. Translation and auth-vendor namespaces/protocols,
vendor digest and explicit waiting-worker acceptance are preserved. The upgrade
fixture starts from the actual b05cf07 shell 33.

## Test approach

Picker-focused tests cover primary launcher, search, two-column/stepped layouts,
book/chapter/verse selection, Whole Chapter, draft selection, open-picker speech
updates, chapter continuation, Previous/Next, keyboard/focus, translation/session
restoration, fullscreen and deep selected-chapter visibility.

Legacy selector tests use `reader-navigation-test-helper.js` to open the real More
disclosure before selecting. It does not force hidden controls or patch application
APIs. Toolbar assertions now exercise the new first control and primary row order.
Chapter-heading assertions use chapter context; the focused suite tests the launcher.

Desktop chapter/verse grids, 390px and 320px stepped screens, and the 320px Reader
controls were captured and visually inspected. Fonts, colors and spacing treatment
remain GOD4.us throughout.

## Files changed

- `css/companion.css`
- `docs/reader-reference-display.md`
- `index.html`
- `js/bible/reader.js`
- `js/bible/scripture-picker.js`
- `sw.js`
- `tests/auth-loader.spec.js`
- `tests/auth-vendor-cache.spec.js`
- `tests/cloud-tts.spec.js`
- `tests/compact-reader-controls.spec.js`
- `tests/compare-loader.spec.js`
- `tests/csp-report-only.spec.js`
- `tests/final-reader-hardening.spec.js`
- `tests/genesis-original-language.spec.js`
- `tests/god4.spec.js`
- `tests/offline-translation-management.spec.js`
- `tests/plans-focus-visibility.spec.js`
- `tests/plans-readiness.spec.js`
- `tests/pwa.spec.js`
- `tests/reader-empty-verse.spec.js`
- `tests/reader-navigation-scroll.spec.js`
- `tests/reader-navigation-test-helper.js`
- `tests/reader-reference-display.spec.js`
- `tests/reader-speech-highlight.spec.js`
- `tests/reader-verse-cleanup.spec.js`
- `tests/reading-journey.spec.js`
- `tests/scripture-picker.spec.js`
- `tests/shared-reader-fullscreen.spec.js`
- `tests/voice-profiles.spec.js`
- `tests/word-study-loader.spec.js`

## Validation results

- Final focused picker coverage: 14 cases, included in the final affected suites.
- Initial focused run: 13 passed before broader validation; the additional long-grid
  visibility case passed in final validation.
- Final picker, speech/highlight, compact controls, hardening, fullscreen,
  Plan-readiness, Reader-navigation and Reading Plans suites: 159 passed.
- Full sweep: 1,024 passed out of 1,030. Six cases failed against an intermediate
  layout/test assumption. After retaining primary chapter arrows, fixing More
  disclosure setup and waiting for completed session navigation, all six passed
  on rerun (6/6). This is coverage across the sweep and final reruns, not a claim
  of one uninterrupted green full-suite run.
- Reader empty-coordinate navigation unit tests: 16 passed.
- JavaScript syntax, asset/reference validation and git diff --check passed.
- Real shell 33-to-34 explicit update and retained Bible/vendor cache tests passed.
- Screenshots verified desktop chapter/verse grids, 390px and 320px verse steps,
  and the compact Reader controls with primary chapter arrows.

No commit, push, PR, merge or deployment was performed. HEAD remains b05cf07.
