# Reader navigation positioning

Chapter replacement previously retained or clamped the old document scroll offset.
Chapter navigation now requests positioning after translation readiness, DOM replacement,
verse-option rebuilding, selection validation, saved state and control updates.
`scrollReaderStartIntoView` aligns the passage heading below the measured sticky
navigation/toolbar plus the existing 16px margin. It reads the completed layout
synchronously, uses the fullscreen scroll surface when appropriate, and ignores
hidden/missing Reader content or an already aligned heading. No timers or deferred
scroll callbacks are needed.

Book/chapter selectors, previous/next chapter and spoken chapter references clear
obsolete verse selection and position the chapter start without moving keyboard
focus. Translation changes position the chapter start unless a valid selected
verse survives; then the verse remains the target without a new focus jump.
Explicit references retain verse focus with `preventScroll` and sticky-aware
verse positioning. Chapter scrolling is immediate; explicit smooth scrolling is
immediate when reduced motion is requested.

Startup rendering does not request positioning. Returning to an unchanged Reader
tab positions its selected verse when present, or restores its reading anchor when
there is no selection. An unchanged reference does not cause a new focus announcement.
Native browser scroll restoration remains `auto`
and ordinary navigation creates no history entries. Plan references still supply
an explicit verse and retain the existing Plan history/session behavior.

Before passage DOM replacement, Word Study invalidation advances the request
epoch, hides the obsolete panel, clears original-language content and drops the
activating word without restoring focus. Both English and original-language
callbacks ignore obsolete epochs. Normal close/Escape still restores focus to a
connected activating word.

Search delegates to `navigateReaderToPassage`, which activates Reader and resolves
chapter-only or explicit-verse positioning. Search issues no later Companion
scroll. Omitting the verse now means chapter-only navigation; Plan supplies verse
1 explicitly.

Real mobile taps and desktop clicks exposed a gap in the original tab test:
bringing the non-sticky tab buttons into view loses the passage viewport before
the click handler runs. Hiding Reader can also clamp the document scroll offset.
The original same-turn programmatic switching test bypassed these transitions.

A transient Reader bookmark now records the first visible verse and its offset
below the measured sticky controls, plus its translation/book/chapter/selected
verse and scroll surface. Passive scroll observations record reading locations;
scrolling into the tab-navigation region does not overwrite the last reading
location. Leaving Reader also captures its position when necessary. Once Reader
is visible again, an unchanged reference keeps tab focus and gives its selected
verse priority; otherwise it restores the anchor immediately.
A changed hidden reference uses chapter-start or explicit-verse
positioning instead. Internal passage navigation skips bookmark restoration
because it owns the final target. No bookmark is persisted, no timers are added,
and native history remains unchanged. Shell cache remains 22
for this continuation on the unpublished branch.

`reader-tab-position.spec.js` exercises actual taps at 390×844 and desktop clicks
for Genesis 24:45, Psalms 23:4 and John 1:30 with three-pixel geometry tolerance.
It separately checks unchanged selected verses, keyboard focus, hidden book/
chapter/translation changes and explicit hidden verse selection.
Before the correction, all three real-tap mobile cases and all three desktop-click
cases failed; mobile Genesis 24:45 returned from scrollY 6061 to 1054. Afterward,
all 91 combined browser regressions passed, followed by 18/18 final focused checks
(nine per viewport). All 263 sequential unit checks, asset/syntax validation and
`git diff --check` passed. Actual-phone acceptance on an updated hosted preview
remains required after an authorized push.

The second phone acceptance test showed that manually scrolling back up to static
tabs could still replace the ordinary reading anchor. On mobile at up to 620 CSS
pixels, the existing `.bs-nav` row is now sticky within `#bibleApp`. Its generic
`.bs-header` wrapper uses `display:contents`, so only the row stays pinned and the
Study Desk title scrolls away. Desktop header layout, labels, controls, fonts and
colors remain unchanged. The row retains the existing background/border and uses
safe-area-aware horizontal padding and the existing gold keyboard-focus outline.

The existing CSSOM/ResizeObserver measurements now live on `#bibleApp` and include
`--reader-tabs-height`. The stack is site navigation, tabs, then Reader toolbar;
chapter/verse/Word Study positioning includes their measured heights. Fullscreen
continues to use only its own toolbar. If short Compare/Plan content clamps the
viewport beyond the sticky row's container, activation keeps that row visible.
No floating or duplicate navigation, timers or history entries are added.

The selected verse is authoritative even after the user manually scrolls up to
the heading before switching views. Unchanged selections are scrolled into view
without refocusing; explicit new hidden references retain normal verse focus.
No-selection returns continue to use the saved verse/offset anchor.
`reader-mobile-sticky-tabs.spec.js` uses raw touchscreen coordinates checked with
`elementFromPoint`, so offscreen controls cannot be made reachable by Playwright's
automatic scrolling. It covers Genesis 24:45, Psalms 23:6, John 1:30, ordinary
reading, manual scroll-back fallback, keyboard focus, 320px zoom-equivalent reflow,
and fullscreen. Existing hidden-reference and six-passage navigation suites remain
active. Cache stays 22: a new immutable preview URL has its own origin and shell
cache; reusing an existing preview/alias origin requires ensuring its cached shell
is refreshed during hosted acceptance.

Sticky-tab continuation validation: final focused checks passed 43/43 (seven
raw-touch/sticky checks, 18 navigation checks and 18 tab-return checks). The broad
run passed 118/121; its three old assertions were corrected for practical 320px
reflow, intentional Compare-navigation visibility scrolling, and heading geometry
relative to the enlarged sticky stack, then passed in the final focused run.
The remaining 79 broad checks passed, including desktop layout, keyboard/reflow,
fullscreen, Plan/history, CSP and PWA/offline. Units passed 263/263. Asset validation,
JavaScript syntax, browser CSS parsing/computed-style checks and
`git diff --check` passed; no standalone CSS linter is installed.

`reader-navigation-scroll.spec.js` checks desktop/mobile geometry for six passages
from three starting offsets, controls, voice, cold/warm and pending translations,
explicit verses, Search from Reader/Compare, normal/reduced motion, stale study
responses, valid close focus, fullscreen, unchanged tab return, startup and
back/forward/reload. Existing Reader, Word Study, Plan, Scripture/data and PWA
regressions cover retained behavior. The shell cache changes once from 21 to 22.

Changed files:

- `js/bible/reader.js`
- `js/app.js`
- `js/word-study/controller.js`
- `css/companion.css`
- `sw.js`
- `tests/reader-navigation-scroll.spec.js`
- `tests/reader-tab-position.spec.js`
- `tests/reader-mobile-sticky-tabs.spec.js`
- `tests/compact-reader-controls.spec.js`
- `tests/god4.spec.js`
- `tests/reader-empty-verse.spec.js`
- `tests/romans-original-language.spec.js`
- `tests/word-study-original-language-provider.spec.js`
- `tests/genesis-original-language-data.unit.js`
- `tests/pwa.spec.js`
- `tests/offline-translation-management.spec.js`
- `docs/reader-navigation-position.md`

Existing study/offline fixtures now await lazy Reader startup before exercising
their target behavior. Verse-count fixtures use Romans 14 instead of removed
malformed WEB Psalm 3 coordinates. The Genesis repair scope assertion compares
its historical repair commit; current production shard/hash checks remain active.

Local validation: 263 unit checks passed sequentially; the final navigation run
passed 18/18 (nine per viewport, including 36 passage/starting-offset samples).
The initial broad Playwright run passed 230/234. Two study startup races and one
offline setup race were corrected; the fourth, a controlled translation-load
timeout, passed independently without retries. An affected-suite rerun passed
74/76: its two new Search fixture failures used singular `Psalm`, while the
existing parser requires `Psalms`; both passed in the final navigation run.
The 58 non-navigation cases in that rerun all passed. Existing Search/Reader/study
checks passed 73/74; the obsolete Psalm verse fixture passed after correction in
an isolated run alongside the translation loader (2/2). A concurrent unit rerun
hit a Node allocation failure; sequential validation passed. Asset validation,
syntax for all 12 changed JavaScript files and `git diff --check` passed.

Hosted desktop/mobile acceptance remains required on a Cloudflare preview after
an authorized push. This local change does not push or deploy.
