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
tab does not request positioning. Native browser scroll restoration remains `auto`
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
- `sw.js`
- `tests/reader-navigation-scroll.spec.js`
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
