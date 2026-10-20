# Mobile Reader Options and saved-verse feedback

Starting point: production `cc5246704b366fe881b3d7393723810d22db308a`.
Branch: `codex/fix-mobile-reader-options`. Scripture Discovery is not part of
this change. Its verse selection, content and card logic remain unchanged;
only the shared Saved Verses workflow gains Reader-state synchronization and
a persistence-result return value.

## Inspection and root causes

At 320px and 390px, in both emulated light and dark system modes, closed Book,
Chapter, Verse and Speed selects already computed to vellum `rgb(237,227,200)`,
ink `rgb(27,42,68)`, Inter and 44px height. Their computed `color-scheme` was
`normal`. Open native menus were browser-owned: Chromium's selected row used
blue highlighting instead of the site's gold/highlight treatment.

Scoped `color-scheme:light` and option foreground/background styling were
evaluated before implementation. Android's OS/browser picker is not a normal
page dialog, so CSS cannot reliably control its complete popup or touch states.
The screenshots are Android-sized Chromium emulation on Windows, not proof
of physical Android rendering. The reported Android dark-gray appearance was
not reproduced as a site-applied dark background in this environment.

[MDN's select documentation](https://developer.mozilla.org/en-US/docs/Web/HTML/Reference/Elements/select)
describes the cross-browser limitations of traditional popup styling. Newer
[customizable select features](https://developer.mozilla.org/en-US/docs/Learn_web_development/Extensions/Forms/Customizable_select)
offer more control but remain limited-availability; this fix does not require
those features across the site's supported browsers.

Save Verse was disabled whenever neither a selected nor an actually spoken
verse was available. It offered no explanation or selection action. On save,
confirmation appeared in the translation-status region outside the expanded
controls, while the button never reflected saved state or `aria-pressed`.
Drawer removals did not refresh that button. The storage adapter deliberately
retains failed writes in memory, but the original caller ignored whether the
write was durable.

## Implementation and trade-offs

- Keep native Book/Chapter/Verse/Voice/Speed selects as the source of truth. On mobile
  only, five button proxies open one accessible native `<dialog>` using the
  existing translation/Scripture picker colors, borders, fonts and scrolling
  patterns. A choice dispatches the existing select's change event; navigation,
  verse numbering, voice preference and speed behavior are not reimplemented.
- Desktop retains its native selects. Native controls remain available while
  the optional runtime loads, after network failure, or without dialog support.
  Mobile native fallback uses a scoped light color scheme; exact native popup
  decoration still depends on the device.
- Dialog choices retain all native options, including Catholic book names and
  empty-verse filtering. Empty verse selection has the meaningful label
  "Whole chapter (no selected verse)". The save-selection flow offers only
  numbered verses and does not save merely by focusing or choosing a verse.
- Arrows, Home/End, Tab trapping, Enter/Space, Close and Escape work without
  replacing focused controls. Closing returns focus to the launcher. The
  existing fullscreen modal guard now recognizes both Reader selection dialogs
  so its capture listener cannot consume the inner dialog's Escape or Tab.
- Selected rows use the existing highlight/gold treatment plus a contrasting
  check mark and `aria-pressed`. Focus uses the existing ink token: measured
  contrast against vellum is **11.2386:1**. Touch targets remain at least 44px.
  The list, not the Close heading, scrolls; no hidden-content fixed heights are
  introduced. Pointer cancellation and scrolling clear pressed styling.
- Choices from an obsolete passage are rejected with an explanation instead
  of being applied to a different chapter or translation. Live speed changes
  update selection styling without moving focus.

The existing on-demand `/js/bible/translation-picker.js` is now the shared Reader
selection runtime. `ReaderOptions.initialize/sync/save` are guarded against
duplicate initialization and late re-evaluation. No new script or precached URL
is introduced. Save behavior moved out of eager application code into this
already-cached runtime. Shared disclosure/error handling avoids duplicated
eager code. The existing ten-second loader timeout, request deduplication,
retry and native fallback remain in place.

The eager historical budget assertion is unchanged. LF-canonical bytes across
the same 21 scripts are **290,894 before → 290,879 after**, below the unchanged
**290,914-byte** bound, leaving **35 bytes**. Future eager additions must be
deferred or offset rather than increasing this budget.

## Saving and feedback

The click captures the displayed verse's translation, book, chapter and verse
before awaiting runtime readiness. An actually spoken verse takes precedence
over the previously selected verse, including while paused. Text comes from
`BibleData`, never rendered italics or an arbitrary first verse.
The click also captures focus; an unselected Save request that completes after
Options closes or focus moves elsewhere cannot open a late dialog. Resizing
returns a mobile launcher to the corresponding visible desktop native control,
without replacing a native control that is already focused.

With no selection the enabled button says "Choose verse to save" and opens
numbered choices. After selection, feedback tells the visitor to activate Save
verse. A real save immediately confirms the named reference in
the screen-reader-only `#readerSaveStatus`, with `role="status"`, polite live output
and atomic announcements. The button shows **Saved ✓**, a reference-specific
accessible name, pressed state and `aria-disabled="true"`. It stays focusable;
repeated pointer or keyboard activation cannot remove the verse. Removal remains
in the top Saved drawer. Stored entries with an identical verified
location remain recognized even if their older display reference differs.

The existing `toggleFav` still synchronizes the count, drawer, card and storage.
Its new return value distinguishes a durable write from the existing session
fallback. Failure explicitly says the change is "for this visit only" rather
than claiming persistence. Drawer removals and external-tab storage changes
refresh the button and confirmation. Repeated identical Save activations queued
behind one runtime load are deduplicated within that completion turn; subsequent
activations of an already-saved verse are idempotent. State synchronization
does not unnecessarily replace unchanged button text during speech updates.

The disclosure is now Options / Hide Options / Options. One shared state setter
keeps text, panel visibility and `aria-expanded` synchronized. Escape and focus
return remain available even when the optional runtime cannot load.

At 320px the longer labels exposed a real 2px primary-row misalignment. Mobile
grid sizing now reserves readable space for Options and stretches the controls
to the row's natural height. The strict test measures **zero top-edge mismatch**,
**108px toolbar height**, no overflow, and retains its existing 110px limit.
Desktop typography and native control styling are unchanged apart from the
requested Save state and accessible Reader focus treatment.

## Installed users and scope

Shell cache **46 → 47**, with exactly the same **47 assets**. Bible caches, saved
data, existing cleanup policy, explicit update acceptance and cross-tab activation
behavior are unchanged. Historical cache 43/44/45 upgrade coverage is retained;
real cache-46 fixtures additionally verify new Reader/runtime bytes only after
acceptance, mobile/desktop controls, DRA save/remove, offline reload and safe
retry after an installation fails to acquire the selection runtime.

Production files: `css/companion.css`, `index.html`, `js/app.js`,
`js/bible/reader.js`, `js/bible/speech.js`, `js/bible/translation-picker.js` and
the cache number in `sw.js`. Remaining edits are documentation and focused tests,
shared test interactions, or current-cache expectations. Bible files, manifests,
CSP, design tokens and Scripture Discovery generation are not changed.

## Validation and remaining acceptance

Focused suites run sequentially, one browser worker and zero retries. Existing
mobile tests now select through the real mobile proxies rather than attempting
to operate hidden native controls. Two translation-only test locators were scoped
to their intended dialog because the style classes are now shared. Geometry,
performance and accessibility assertions were not relaxed.

Physical Android light/dark appearance, TalkBack announcements, system font
scaling and long momentum-fling behavior remain device acceptance items.
Chromium emulation and deterministic speech mocks do not establish actual
Android OS popup appearance or audible voice prosody. No merge or production
deployment is authorized by this review branch.

## Initial PR automated results

| Separate targeted suite | Passed |
| --- | ---: |
| Mobile Reader Options and Save feedback | 25 |
| Existing mobile translation picker | 32 |
| Compact controls / shared fullscreen / mobile sticky tabs | 12 / 22 / 8 |
| Reader speech highlighting / cloud speech | 45 / 44 |
| KJV browser / Word Study loader / Catholic Bible | 13 / 43 / 50 |
| Installed cache 43/44/45/46 → 47 | 19 |
| PWA / offline translation management | 17 / 12 |
| Auth vendor cache / auth loader / Compare loader | 38 / 20 / 32 |
| Reader empty-verse coordinates / tab positioning | 20 / 18 |
| KJV unit/corpus tests / all 66 Isaiah hashes | 8 / 1 |
| **Total unique checks** | **479** |

Final targeted validation has no remaining failures, skips or retries. Asset
integrity, all modified JavaScript syntax checks and `git diff --check` pass.
The unchanged historical byte-budget test was rerun against the final source:
**290,879 < 290,914**. All nine translation manifests and the 66 Isaiah chapter
hashes remain intact. No full-suite invocation or concurrent test runners ran.

The initial budget failure was resolved by moving Save implementation on demand
and consolidating disclosure/error handling, not by changing the assertion.
The initial focus-return/fullscreen failures and 2px alignment defect were fixed
in production code. The extended cache-43 fixture was corrected to request only
that historical shell's existing assets while offline; strict new-runtime hashes
and the complete 47-URL upgraded asset list remain asserted. Tests' former global
translation-style locators were scoped, not weakened.

Final memory snapshot: 1.00 GiB available physical RAM, 31.60 GiB commit limit,
4.67 GiB available commit headroom. The tests completed without an out-of-memory
failure; this is a point-in-time sample, not a peak-use claim.

## PR #109: compact mobile Options follow-up

The expanded panel previously used a wrapping flex layout. Its verse-navigation
group could itself wrap into two rows, Book occupied a whole additional row,
audio controls wrapped independently, and save feedback reserved a full row.
At 320px with a 740px viewport the panel occupied **384px**, with some navigation
and Voice Commands targets only **35px** tall.

At widths up to 620px, a scoped responsive grid now has exactly four rows:

1. Previous Verse | Next Verse
2. Book | Chapter | Verse
3. Save Verse | Voice Commands
4. Voice | Speed

Nested groups retain their names and existing DOM/listeners. The audio wrapper
uses `display:contents` only on mobile; its named group remains exposed in the
Chromium accessibility checks. Voice and Speed have small structural field
wrappers; desktop keeps its native controls and existing flex layout. Every
mobile action is at least 44px tall. Labels keep the existing 13px Inter styling
and wrap rather than truncating. Voice reuses the existing optional mobile
selection dialog so enlarged voice names are not clipped by a narrow native
select. Desktop and failed-runtime fallback remain native. The whole-chapter
Verse launcher uses the short visible value "None" with the full accessible name
"Verse: Whole chapter (no selected verse)".

Reader Save is now save-only, not a second removal control. **Saved ✓** remains
focusable with `aria-pressed="true"` and `aria-disabled="true"`, allowing focus
to remain in place after saving. Its accessible name explains that management
is in Saved. Activation is guarded in the runtime, including queued requests;
already-saved verses cannot be toggled off here. Removing from the top Saved
drawer or another tab restores the Save state. The polite, atomic status region
is screen-reader-only and consumes no grid row. No-selection guidance and
session-only storage-failure warnings remain available through that region.

Tests retain strict geometry and pointer-hit checks at 320/360/390/430px, normal
and fullscreen. They exercise all five Reader selection dialogs, touch taps,
keyboard focus return, saving, persistence, top-drawer removal and zero scroll
offset change when opening and closing Options after deep reading. Font
enlargement is simulated with **20px control text** and **16px field labels**;
it is not a claim of physical Android font-scaling or TalkBack acceptance.
Larger text can increase the four rows' natural height; existing bounded Options
scrolling keeps every control reachable without shrinking text or hiding it.

Shell cache stays **47**, with the same **47 assets**. The existing installed
43/44/45/46 → 47 fixtures continue checking accepted activation, exact refreshed
runtime/CSS bytes, retained WEB/DRA data, offline reload and failed-install retry.
For acceptance of this unmerged revision, use its new hash-specific preview URL:
an older preview origin already running cache 47 is not a production upgrade
fixture. Production users still upgrade from the preceding release cache.

No eager JavaScript file changes in this follow-up: the measured total remains
**290,879 LF-canonical bytes**, with the historical **290,914-byte** assertion
unchanged. No Bible data, manifests, CSP, design tokens, KJV speech/italics or
Scripture Discovery code changes are included.

### Follow-up validation results

| Viewport width | Normal Options height | Fullscreen Options height |
| --- | ---: | ---: |
| 320px | 227.50px | 202.38px |
| 360px | 210.75px | 194px |
| 390px | 194px | 194px |
| 430px | 194px | 194px |

These are the initial, unselected Options states at a 740px viewport height.
The 320px normal panel is **156.5px / 40.8% shorter** than the reproduced 384px
baseline. Every case has four aligned rows, no horizontal or button-text overflow,
and hit-testable Scripture lines below the panel. Enlarged-text checks additionally
use the long book name **Song of Solomon**, wait for actual computed 20px control
fonts rather than sleeping, and hit-test every control after scrolling it into view.

| Separate targeted suite | Passed |
| --- | ---: |
| Four-row layout, enlarged text, touch and scroll stability | 16 |
| Reader Options, saving, persistence, accessibility and native fallback | 27 |
| Compact controls / fullscreen / existing translation picker | 12 / 22 / 32 |
| Voice profiles / Reader speech / cloud speech | 12 / 45 / 44 |
| KJV browser / Catholic Bible / Word Study loader and unchanged budget | 13 / 50 / 43 |
| Installed cache 43/44/45/46 → 47 / PWA / offline translation management | 19 / 17 / 12 |
| KJV unit/corpus tests / all 66 Isaiah hashes | 8 / 1 |
| **Total unique checks** | **373** |

Final focused validation has **zero remaining failures, skips or retries**, with
one browser worker. Asset integrity, JavaScript syntax and `git diff --check`
pass. A development double-save test caught duplicate announcement ordering;
deduplication now runs before the already-saved guard, preserving the original
single confirmation. Former Reader-removal expectations now assert the requested
save-only contract and real top-drawer removal, including after offline upgrades.
An incomplete speech-suite filename initially selected no tests; the actual
`reader-speech-highlight.spec.js` suite subsequently passed all 45 checks.

Remaining device acceptance: physical Android light/dark rendering, TalkBack
announcements and navigation, real system text scaling, and long momentum flings.
These are not represented as physically tested by Chromium emulation. The new
hash-specific Cloudflare preview is for this acceptance review only; production
merge and deployment still require approval.
