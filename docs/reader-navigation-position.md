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

Mobile sticky-overlap correction: the tabs were bounded by `#bibleApp`, but the
toolbar was bounded by the padded Reader view. At the chapter's end, the toolbar
started sliding upward before the tabs, producing about 95px of overlap. Normal
selected-verse/tab-return offsets already included every sticky row and did not
need to change.

At both 390×844 and 320×844, the measured normal stack was 131px site navigation,
115px tabs and 103px toolbar, totaling 349px with zero inter-row gap. Each box's
1px bottom border is included. Tab padding is 12px/14px vertically; toolbar padding
is 4px/4px. The measured toolbar bottom margin is 6px and Reader bottom padding is
16px. Safe-area horizontal insets contributed no additional space in this emulation.

The mobile tabs now reserve `--reader-stack-tail` in their sticky margin box:
toolbar height + toolbar bottom margin + Reader bottom padding (125px here).
An equal negative `.bs-main` margin cancels that reserve in normal layout, leaving
document spacing unchanged. This coordinates the two end constraints so the rows
leave the Study Desk together instead of overlapping. The reserve is zero on
desktop, hidden Reader and fullscreen. Existing CSSOM/ResizeObserver measurements
provide the value, refreshed synchronously on view changes before the existing
positioning/restoration runs. No selected-verse, bookmark, focus or history contract
changes, new scroll surface or hard-coded offset is introduced; cache remains 22.

`reader-sticky-overlap.spec.js` checks actual rectangles independently of
`readerVisibleTop`, before/after tab return and during ordinary/end-of-chapter
scrolling. It verifies all three selected references at both widths, chapter-start
clearance and unchanged desktop CSS. At the end constraint the tab bottom now
matches the toolbar top; the prior six failing end-boundary cases pass. Final
validation passed 105/105 browser checks and 263/263 units, plus asset/syntax and
`git diff --check`. Another actual-phone acceptance run on a fresh updated preview
is required after an authorized push.

Compare clearance correction: `#view-compare` contains the reference summary,
three reference controls, then `#compareGrid` with two to four translation columns.
Its controls and column headers are static. Unlike the Reader toolbar, they add
no height to the sticky stack. The Reader containment reserve correctly becomes
zero while Compare is active. The remaining defect was missing content positioning:
the previous activation only ensured that the tabs were reachable. Document-height
clamping and retained column content could leave the summary or verses behind them.

Pre-fix stack: 131px site navigation + 115px tabs = 246px. Cold summary tops were
125.56px at 390px and 125.94px at 320px; the controls were also above the stack.
Warm-entry measurements (pixels, first column):

| Width | Reference | Summary top | Header top | Verse top | Verse height obscured |
|---|---|---:|---:|---:|---:|
|390|Genesis 24:45|-441.44|-311.05|-261.05|140|
|390|Psalms 23:6|-104.44|25.95|75.95|112|
|390|John 1:30|-301.44|-171.05|-121.05|84|
|320|Genesis 24:45|-609.06|-478.67|-428.67|224|
|320|Psalms 23:6|-221.06|-90.67|-40.67|168|
|320|John 1:30|-385.06|-254.67|-204.67|140|

Mobile Compare targets now use a CSS scroll margin composed of the existing
measured site/tab variables plus the existing 16px navigation margin. Entry aligns
the summary below that stack immediately and after the matching asynchronous
column render. The render epoch and active-view guard prevent obsolete or hidden
results from scrolling Reader. Only activation opts into final render positioning;
ordinary Compare edits retain their existing behavior. No focus changes, timers,
new sticky headers, independent offsets or Reader restoration changes are added.
Desktop entry is a no-op for this helper. Native header/verse scrolling and control
focus use the same mobile margin. Mobile columns remain stacked without horizontal
overflow; desktop edition layout stays unchanged. Cache remains 22.

After correction, the summary is about 262px, first column header 392px and verse
442px on both widths, all below the 246px stack. `compare-sticky-overlap.spec.js`
checks cold/warm entries, all three references, Reader returns, whole chapters,
native scrolling, two/three/four columns, keyboard focus, reflow, desktop and a
delayed render after Reader return. Validation passed 118/118 combined browser
checks, 31/31 existing Compare regressions and 263/263 units, plus asset/syntax and
`git diff --check`. The corrected mobile layout was visually inspected. Another
actual-phone acceptance run on a fresh updated preview remains required.

`reader-navigation-scroll.spec.js` checks desktop/mobile geometry for six passages
from three starting offsets, controls, voice, cold/warm and pending translations,
explicit verses, Search from Reader/Compare, normal/reduced motion, stale study
responses, valid close focus, fullscreen, unchanged tab return, startup and
back/forward/reload. Existing Reader, Word Study, Plan, Scripture/data and PWA
regressions cover retained behavior. The shell cache changes once from 21 to 22.

Changed files:

- `js/bible/reader.js`
- `js/bible/compare.js`
- `js/app.js`
- `js/word-study/controller.js`
- `css/companion.css`
- `sw.js`
- `tests/reader-navigation-scroll.spec.js`
- `tests/reader-tab-position.spec.js`
- `tests/reader-mobile-sticky-tabs.spec.js`
- `tests/reader-sticky-overlap.spec.js`
- `tests/compare-sticky-overlap.spec.js`
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
