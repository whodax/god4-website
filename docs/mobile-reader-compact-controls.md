# Compact mobile Reader controls

Branch: `feature/mobile-reader-compact-controls`, based on `ca0d623`.

At widths up to 620px, the Reader has three rows:

1. Reader, Compare, Plan, Offline (the existing Study Desk navigation).
2. Previous Chapter, Scripture picker/reference, Next Chapter, Options.
3. Translation, Previous Verse, Play/Pause, Next Verse, Reading Voice, Speed.

Options independently expands detailed Book/Chapter/Verse navigation, Save Verse,
Voice Commands, Fullscreen and Stop reading aloud. The microphone continues to
mean Voice Commands; the selected male/female person icon opens Select Reading Voice.
Speed opens the existing speed picker. Accessible names expose the current voice
and speed, and Options retains its expanded state and Escape/focus restoration.

The original controls are moved, not copied or recreated. Comment anchors restore
their exact desktop positions at the breakpoint, preserving IDs, native selects,
listeners, selection and playback state. Only fullscreen uses navigation proxies:
Compare, Plan and Offline exit fullscreen before invoking the original controls.
The normal navigation remains intact. Desktop retains Play/Stop; mobile Play/Pause
uses the existing pause/resume implementation, with Stop available in Options.

The composition runs in the existing lazy translation-picker runtime. If that
runtime fails or native dialogs are unavailable, the existing native-control
fallback layout remains usable. No eager script, shell asset or Bible data changes.

## Independent visibility mechanisms

Options changes only the settings disclosure. Scroll-to-hide keeps its existing
gesture, speech-state, focus, selection and dialog guards. Hidden controls remain
in flow, inert and unavailable to assistive navigation until Show Controls restores
them. Options state survives conceal/recovery. Desktop automatic-hide behavior is
unchanged.

The compact layout revealed a recovery-position corner case near the Reader's
start: navigation can remain below its sticky inset. Its actual bottom was
222.94px while recovery started at 200px, intercepting recovery taps. The recovery
position now uses the measured navigation bottom plus the existing 4px gap. This
does not change passage flow, scroll offsets or the hide/show state machine.

Initial compact navigation can also settle one frame after the existing chapter
alignment callback: the measured sticky boundary changed from 315px to 313px,
leaving a reproducible 2.14px error. A second animation-frame correction runs only
for the compact layout and reuses the existing disconnected-target, selection,
active-view and fullscreen-surface guards. Desktop retains its previous timing.
An intervening scroll also cancels compact corrections, so they cannot override
an explicit reading position established after chapter navigation. Compact tab
returns restore the saved offset before checking selected-verse visibility,
avoiding a 1px browser-anchoring drift when Compare temporarily changes the page.
The original strict chapter test passes ten consecutive uninstrumented runs;
the 2px tolerance is unchanged. Superseding verse/Plan navigation is covered.

If the optional runtime arrives while a native Reader select is focused, compact
composition waits for blur rather than replacing that active control. During
breakpoint moves, a temporary reparenting marker suppresses the Reader Options
blur adapter until native voice/speed focus is restored without scrolling. The
marker is removed immediately; later genuine blur resumes the normal custom
picker behavior. Existing late-load/fallback assertions remain intact.

At 320px, narrower Reader gutters allow six targets of at least 44px without
shrinking Scripture or introducing horizontal scrolling. Existing cream/navy/gold
and blue-dark tokens, font families and Scripture sizing are retained. Unicode
controls request text presentation where an emoji could introduce platform colors.

## Validation contracts and release limits

Tests cover 320/360/390/430px, both themes, fullscreen, picker focus, keyboard
Escape, selected translation, DRA, chapter/verse navigation, pause/resume/stop,
desktop restoration and independent Options/concealment. Geometry tests measure
the visible verse, not just scroll offsets: browser anchoring can change the
offset during Options expansion while preserving the verse's screen position.
Hide/recovery continues to require exact offset and passage-position preservation.

The existing normal-motion Search stability test sampled before smooth scrolling
ended. A read-only baseline comparison reproduced 7693 → 7728 → 7866px on
`ca0d623`; the feature reproduced 6934 → 6973 → 7137px. It now waits for the
destination's actual `scrollend` before applying the unchanged two-frame stability
assertion. No navigation animation or assertion tolerance was changed.

Existing touch/CDP, cloud fallback, saved-verse and offline regressions remain
applicable. Geometry fixtures use pointer events to represent reading intent rather
than tapping beside a word: coarse-pointer hit adjustment can legitimately activate
Word Study from a narrow gutter. Real touch-drag coverage remains separate.

Physical Android/TalkBack, iOS/VoiceOver, real system text scaling and actual voice
audio remain device acceptance items. Browser emulation is not physical-device
certification. Shell 52 and all 49 assets remain unchanged for this local review;
an installed-user cache-version update must be assessed before production release.
No merge or deployment is authorized by this work.

## Final automated results

All runs used one Chromium worker and zero retries, in sequential groups.

| Coverage | Passed |
| --- | ---: |
| Compact layout, native-focus races and stale-position cancellation | 21 |
| Options, saving, enlarged text and independent hide/recovery | 85 |
| Reader, fullscreen anchors, navigation, highlighting and voice profiles | 111 |
| Book/Chapter/Verse cascade and Whole Chapter/native fallback contracts | 26 |
| Cloud speech, translation picker, PWA and offline Bible management | 105 |
| Historical startup budget and Word Study readiness | 1 |
| **Unique tests** | **349** |

Final groups have zero failures, skips or retries. The original strict chapter
geometry test additionally passed **10/10 uninstrumented repeats** on the final
source, beyond the unique total. Development failures exposed and corrected the
recovery interception, stale positioning and late native-focus replacement described
above. Legacy fullscreen/Stop locators now exercise the approved control placement;
geometry, navigation and focus assertions remain meaningful and strict.

Startup remains **22 scripts**, measuring **260,413 decoded bytes**, below the
unchanged **290,914-byte** budget by **30,501 bytes**. The compact control runtime
remains lazy; the guarded Reader positioning changes add 966 canonical bytes to
the 259,447-byte baseline. Word Study first-use readiness measured **21.6ms** in
this run; this is a single measurement, not a comparative performance claim.

Asset validation, all changed JavaScript syntax checks, nine-translation metadata
validation, all **66 Isaiah hashes** and `git diff --check` pass. The compact
manifest remains **13,665 canonical bytes**. Bible data, manifest metadata, speech
implementation, service worker, activation policy, design tokens and CSP are
unchanged. No browser crashes or memory-related interruptions occurred.

The ignored `playwright-report/compact-reader-summary.json` reconciles the 349
unique identities from the final complete logs. Browser screenshots are retained
under `playwright-report/compact-reader-screenshots/` for local inspection.

## Exact change scope

- `css/companion.css`
- `js/bible/reader.js`
- `js/bible/translation-picker.js`
- `docs/mobile-reader-compact-controls.md`
- `tests/cloud-tts.spec.js`
- `tests/compact-reader-controls.spec.js`
- `tests/mobile-reader-compact.spec.js`
- `tests/mobile-reader-options-layout.spec.js`
- `tests/mobile-reader-options.spec.js`
- `tests/mobile-reader-reading-controls.spec.js`
- `tests/mobile-translation-picker.spec.js`
- `tests/reader-navigation-scroll.spec.js`
- `tests/reader-navigation-test-helper.js`
- `tests/reader-speech-highlight.spec.js`
- `tests/shared-reader-fullscreen.spec.js`
