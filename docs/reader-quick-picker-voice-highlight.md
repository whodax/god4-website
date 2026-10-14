# Quick Scripture picker and voice-following highlight

Baseline: `a46064628726f943b2f14e560f37fc6f21c49632`. Branch:
`feature/reader-quick-picker-voice-highlight`. Shell: `god4-shell-compact-reader-31`.

## Read-only audit before implementation

1. Reader markup is one compact primary toolbar and a More disclosure.
2. Book select uses `BibleData.listBooks(currentTranslation)`.
3. Chapter select uses `BibleData.getChapterCount`.
4. Verse select uses source coordinates, skipping blank text without renumbering.
5. Mobile has two existing primary toolbar rows at widths through 620px.
6. Fullscreen uses the same Reader, a dedicated scroll surface, inert background, focus trapping and Escape.
7. Selects and buttons use native keyboard interaction; fullscreen handles Tab and Escape.
8. Explicit verse navigation focuses the target, while spoken follow only scrolls.
9. `navigateReaderToPassage` delegates to readiness, `loadPassage`, and selection/focus helpers.
10. Bible libraries exposed by `BibleData` own book/chapter/verse metadata.
11. `BibleTranslationLoader.ensure`, `initializeBibleExperience`, and translation request IDs guard acquisition.
12. Speech originally applied `.verse-spoken` when queueing a verse, before actual playback.
13. Explicit Reader/Search navigation independently applied `.verse-focused`.
14. Independent yellow selected and red spoken backgrounds could coexist; a combined selector mixed them on one verse.
15. Speech publishes queue start, actual spoken/repeated start, verse completion, and playback end. Session generations reject obsolete playback/decode callbacks.
16. Reader keeps current selection, current spoken verse, last spoken verse, and continuation cursor separately.
17. Search changes translation if necessary and uses shared direct passage navigation.
18. Plans use shared navigation plus readiness intents, assigned chapter ranges, completion boundaries and browser history markers.
19. Compare has its own lazy loader and passage state; Reader translation changes synchronize default translation.
20. Changes are confined to Reader markup/CSS, Reader callbacks, one picker module, shell, focused tests, affected existing expectations and this document.
21. Recommended architecture: activation-built native dialog, canonical metadata, shared Reader renderer, playback-owned primary styling.
22. Trade-offs: a small eager module and one trigger; number grids and dialog listeners are created on activation. Native buttons avoid custom grid semantics.
23. Accessibility risks: nested fullscreen handling, delayed readiness, return focus, and preserving keyboard indicators.
24. Reflow risks: long book names and Psalms chapter/verse counts; mobile needs steps and 44px targets.
25. Shell changes require one version bump and precaching the module; Bible and auth vendor protocols remain unchanged.

## Picker contract

The **Scripture** button follows Fullscreen in the primary toolbar. Desktop retains
one row. At widths through 620px it occupies an additional full-width row, leaving
all existing selectors and controls in their original order and positions.

The named native `dialog` is built on first activation inside `#view-reader`.
Desktop shows searchable books on the left and chapter/verse grids on the right.
Phones show Books → Chapters → Verses, with Back controls. Current pending book,
current Reader chapter, and current Reader verse use `aria-current`, underlined bold
text, and existing highlight/gold variables. Search filters names from the current
translation's canonical book list; no book or verse counts are duplicated.

Chapter counts come from `BibleData.getChapterCount`; verse coordinates come from
`BibleData.getChapter(...).verses`. Blank source coordinates are omitted, retaining
original verse numbers. Whole chapter sends no verse to `navigateReaderToPassage`.
Direct verses use that same path, focus the target, and scroll with the existing
sticky/fullscreen geometry and motion preference. The dialog closes before passage
navigation, allowing Reader focus to take precedence over trigger restoration.

Tab/Shift+Tab traverse native buttons and the search input, with explicit wrapping
at modal boundaries. Enter and Space activate buttons. Escape closes the dialog
and restores the trigger. There is no custom arrow-key grid model. Opening focuses
the current book; selecting a book/chapter focuses a current or first relevant
number. Modal Escape/Tab handling takes priority over fullscreen handling.

Readiness uses the selected translation's existing loader without requesting an
alternate passage. Generation and translation request checks invalidate delayed
opening after close, manual navigation, or translation replacement. Opening during
an in-flight translation safely closes rather than presenting stale metadata.
Unavailable data leaves a readable status and Close control without navigating.
The precached module and retained translation protocol support offline first use.

Manual picker navigation uses existing Plan rules: an assigned chapter preserves
the session, while an out-of-range chapter clears the session and history marker.
Search, Plan readiness/history/progress, Compare, Saved, Word Study and Account
continue through their existing paths.

## Highlight ownership

Selection and resume state remain distinct, but only one system owns the primary
visual treatment:

1. An actual spoken or repeat-start callback owns the primary verse treatment.
2. Without an active spoken verse, the ordinary explicit Reader/Search selection
   owns the existing yellow background and gold outline.
3. Temporary keyboard focus remains native focus, not a playback cursor.

The playback owner adds `.speech-owns-highlight` to the passage and exactly one
`.verse-spoken`. CSS suppresses the selected background/outline while speech owns
the primary highlight. The spoken verse uses the existing yellow highlight and
oxblood inset underline. Bookmark number markers preserve their separate meaning.
Selection data and saved Reader position do not advance with narration.

Queue-start callbacks clear the previous spoken verse. Actual playback start claims
the next verse, so cloud response/decode preparation does not falsely mark it as
spoken. Pause retains the actual spoken verse; Resume advances on the next real
callback. Repeat uses the existing repeat callback and continuation cursor. Stop,
natural end, failure, navigation and translation clear ownership, restoring ordinary
selection. Location checks supplement existing Speech session/generation guards.
No timer drives highlighting, no speech callback focuses a verse, and no new
per-verse live region is introduced. Existing offscreen-only spoken follow,
reduced-motion behavior and navigation scroll cancellation remain intact.

Voice profiles, cloud/native fallback, gender matching, preference/rate persistence,
offline speech, gesture authorization, and delayed response/decode cancellation
are unchanged. Natural Male remains `en-US-Neural2-D`; Natural Female remains
`en-US-Neural2-F`.

## Validation and performance

See the final milestone validation record below. Browser playback tests use
deterministic native and Web Audio mocks; server tests verify exact voice mappings.
Actual voice sound, production audio latency and assistive-technology interaction
still require manual checks. A Cloudflare HTTPS preview should validate actual
headers, waiting-worker upgrade flow, offline retention and cloud audio before
release. This milestone does not push, create a PR, or deploy.

The local performance harness compares baseline/current Reader evaluation using
external-script timing instrumentation, ten samples per version, and warm Bible
activation. Compression estimates use per-file gzip level 9 and Brotli, not actual
Cloudflare transfer measurements. Startup adds one UI button, one external script
element, and one click listener; dialog/grid DOM and its listeners are deferred.
Timing is a local diagnostic with coarse clock resolution and normal host noise;
there is no claimed performance improvement.

### Recorded results

- Final corpus: 1,000 browser cases. Full sweep: 985 passed, 13 failed. Affected
  legacy cache, keyboard, byte-count and pre-playback expectations were updated.
  Twelve serial reruns passed; the renamed actual shell 30 → 31 upgrade case passed
  in the final feature/PWA run. The two subsequently added picker cases also passed.
  This is passing coverage across the full sweep and subsequent reruns, not a claim
  of one uninterrupted green 1,000-test run.
- Final feature/PWA run: 55 passed, including 38 new picker/highlight cases.
- Adjusted auth-vendor/hardening suites: 45 passed. Data unit suites: 263 passed.
  Journey coverage: 260 contiguous chapters across five plans.
- Three transient full-sweep failures passed serially without product changes:
  an auth fixture connection reset, a Plan focus bottom edge 0.015625px outside its
  strict assertion, and a Word Study fixture retry-count mismatch.
- Syntax: all 40 first-party JavaScript files passed `node --check`. Asset validation
  passed for 33 references, three icons and eight generated translation manifests.
  `git diff --check` passed. New picker interaction passed enforcing CSP validation.
- LF-normalized added eager JavaScript: 9,733 decoded bytes (8,627-byte picker plus
  1,106-byte Reader delta). Estimated per-file compression delta: 2,701 bytes gzip,
  2,210 bytes Brotli. These estimates do not include CSS/HTML or transport headers.
- Ten local evaluation samples per version: Reader median 8.7ms before and after;
  module execution measured 0ms at clock resolution; warm first activation median
  31.7ms. The host was also running regression tests, so timing is diagnostic only.
- Startup: one added UI button and one external script node; one new click listener.
  No dialog, book list or number-grid DOM is constructed before activation.
- Shell upgrade test uses the actual baseline shell, verifies the picker is absent
  from shell 30 and present in shell 31, and preserves Bible/vendor caches after
  explicit acceptance. Translation namespaces and vendor digest are unchanged.

### Files changed

Application: `index.html`, `css/companion.css`, `js/bible/reader.js`,
`js/bible/scripture-picker.js`, `sw.js`.

New tests: `tests/scripture-picker.spec.js`, `tests/reader-speech-highlight.spec.js`.

Updated regression expectations: `tests/auth-loader.spec.js`,
`tests/auth-vendor-cache.spec.js`, `tests/compact-reader-controls.spec.js`,
`tests/compare-loader.spec.js`, `tests/final-reader-hardening.spec.js`,
`tests/god4.spec.js`, `tests/offline-translation-management.spec.js`,
`tests/pwa.spec.js`, `tests/reader-empty-verse.spec.js`,
`tests/word-study-loader.spec.js`.

Documentation: `docs/reader-quick-picker-voice-highlight.md`.
