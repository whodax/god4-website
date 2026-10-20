# Light and blue Dark Mode

## Dependency and isolation

This feature starts from PR #109 head
`42e9cdaa3dbaef221b05760173c0f7237ddc4d7d` in a separate
`god4-dark-mode` worktree on `codex/feature-dark-mode`.
PR #109 was open and unmerged when inspected. This is a dependent change;
reconcile its base with production main after #109 lands, before approving a
production merge. No Scripture Discovery work is included.

## Behavior and accessibility

The icon-only, 44px native theme button is immediately before Saved in the top
header. Its moon means “Switch to Dark Mode”; its sun means “Switch to Light
Mode”. The accessible name and `aria-pressed` describe the action and current
state. Native keyboard activation and focus outlines remain available.

At mobile header widths an adaptive grid reserves the theme/Saved positions and
lets Account grow into the remaining space, with its existing ellipsis when
necessary. A regression caught extra identity-restoration layout shift with a
plain flex row: CLS was 0.0031125 against a historical 0.0023700 baseline.
The grid reduces it to 0.0014710 while preserving the Account button's measured
77.5px / 158.33px initial/restored widths at 390px. The existing strict CLS
assertion is unchanged. Desktop header layout and Saved styling are unchanged.

Light is the default, including with dark operating-system preferences. Only
explicit selection changes appearance. `god4.theme` stores `light` or `dark`;
same-origin storage events synchronize open tabs. Invalid/missing preferences
default to Light. Blocked storage preserves session-only switching. Unrelated
keys and account data are not changed.

Synchronization reads the latest stored choice rather than replaying an old
event value. A short-lived parsing observer initializes the button as soon as
it exists, even if unrelated deferred Bible scripts are still loading, and
disconnects immediately (or at DOM readiness on pages without a toggle).

`js/theme.js` runs synchronously before stylesheets or body parsing on the
homepage, offline fallback and account callback. It is a small same-origin
external script, allowed by the unchanged CSP; no inline bootstrap or
`unsafe-inline` is introduced. A returning preference is therefore applied
before first paint, without hiding the page or waiting for account/Reader code.

Switching changes root tokens, button semantics and icons only: no content
reconstruction, reload, Scripture navigation, audio operations or storage reset.
Existing color transitions are suppressed for the switching render boundary
so intermediate colors do not become unreadable. Normal component transitions
resume after two animation frames; pending frame cleanup is cancelled on a
new change. No theme animation or arbitrary delay is needed.

Fullscreen keeps its existing modal background isolation: the header does not
become an out-of-modal focus target. Recover Reader controls if necessary, exit
Fullscreen, use the header toggle, and re-enter. Existing visible-anchor and
focus restoration remain responsible for position. Changes from another tab
also update an active fullscreen Reader without leaving fullscreen or moving
its reading surface.

## Design and coverage

`css/theme.css` leaves existing Light selectors/tokens intact. Dark-only tokens
use primary `#172236`, panels `#243248`, elevated surfaces `#2B3B52`, Scripture
`#F0E8D6`, secondary text `#C9C3B8` and gold `#D6B675`. Borders are refined to
`#8190A5` for control contrast; warnings use a readable warm `#F1AAA0`.
Inverse Light components receive dark surface/text pairs instead of becoming
large ivory panels. Hard-coded header/hover/account/plan fills are covered.
Dark modal backdrops have their own translucent navy fill rather than reusing
the now-opaque, contrast-compliant border token. Placeholders use secondary
text; future Plan dates retain full opacity for readable small labels.
Native form popups get explicit color-scheme and option colors; mobile Reader
pickers retain their accessible, themed custom dialogs. Native OS popup
rendering remains browser controlled and requires physical-device acceptance.

The original fonts, font sizes, Scripture layout and four Options rows are not
changed. Reader conceal/recovery, KJV italics/speech, all nine translations,
Saved, Word Study, Search, Compare, Plans, offline management and authentication
use the same application code and state. The small toggle is the only new
header control; enlarged action text can wrap without horizontal overflow.

## Performance and offline delivery

The historical strict eager limit remains **290,914 LF-canonical bytes**.
The baseline was **290,870 bytes** in 21 scripts. One early theme entry adds
one script; the performance test now explicitly expects 22 current scripts,
while retaining the original historical measurement and strict byte assertion.
To fund the bootstrap without deferring/removing features, only leading
indentation in the functions of `js/app.js` is compacted. Its initial verse
array and state declarations remain byte-for-byte unchanged. A regression compares every resulting
line against the baseline with that exact transformation, preserving all words,
strings, comments, control flow and public functions. No Bible bundle changes.

Shell **48** retains all 47 previous assets and adds only `/css/theme.css` and
`/js/theme.js`, for **49** precached assets. No activation, translation-cache,
vendor-cache or saved-data logic changes. Existing installed-user fixtures cover
43/44/45/46 and the approved 47 checkpoint upgrading to 48, acceptance before
activation, offline WEB/DRA retention and retry after a failed theme install.
Use a new hash-specific preview for acceptance rather than an older origin with
a pre-existing shell cache.

## Physical acceptance still required

- Android Chrome in light/dark OS settings: toggle, native popups, real system
  text enlargement, momentum scrolling and nighttime legibility.
- TalkBack and iOS VoiceOver: changing action names, pressed state, header/Saved
  order, modal traps, focus return and fullscreen exit/return.
- Real native and premium cloud voices during switching, pause/repeat/fallback.
- Installed PWA update acceptance on real devices and offline relaunch.

Browser emulation, computed contrast and deterministic speech mocks are not a
claim of physical screen-reader or provider-audio certification.

### Installed-app launch screen boundary

The page's returning-Dark initialization is verified before body parsing and
first paint. This is not a claim about an OS-managed PWA launch screen. The
existing manifest's cream `background_color` is intentionally unchanged to
preserve Light installation metadata. Android generates splash screens from
manifest colors/icons ([Google PWA documentation](https://web.dev/learn/pwa/web-app-manifest)).
A manifest cannot read a visitor's localStorage before launch. Check the actual
installed-device launch experience; a different splash-screen policy would
need a separate Light/Dark launch-design decision rather than silently changing
the existing Light manifest or promising that JavaScript controls OS UI.

## Final automated validation

**664 browser checks and 38 Node unit tests passed** on the final selected
configurations. Suites ran separately, sequentially, with one browser worker,
zero retries and no unrestricted full-suite invocation. Repeated diagnostic
runs are not added to these totals.

| Browser suite / configuration | Passed |
| --- | ---: |
| Theme, persistence, pre-paint, cross-tab, storage denial, speech and accessibility | 34 |
| Four-row layout / Reader Options / compact controls | 16 / 27 / 12 |
| Reader conceal/recovery in Light / Dark configurations | 42 / 42 |
| Fullscreen / Reader tab positioning / empty-coordinate safety | 22 / 18 / 20 |
| Mobile translation picker / Compare loader | 32 / 32 |
| Installed shells 43–47 → 48 / PWA / offline translation management | 24 / 17 / 12 |
| Auth loader / authenticated vendor cache | 20 / 38 |
| Word Study loader and strict performance bound | 43 |
| Dark Hebrew/Greek/DRA Word Study, fullscreen and 200%-equivalent reflow | 49 |
| Native Reader speech / cloud speech / voice profiles | 45 / 44 / 12 |
| KJV formatting/speech / Catholic Reader/Search/Compare/Saved | 13 / 50 |

Node tests: KJV corpus **8**, Catholic canon/import contracts **26**, and
Isaiah/unchanged shard integrity **4**, all passed without skips. All 66 Isaiah
hashes and 87 Genesis/John/Romans shards match their reviewed contracts.
Reading Journey additionally passes coverage of **260 contiguous chapters
across five 30-day plans**. No Bible data was regenerated or changed.

Final eager script measurement: **290,857 LF-canonical bytes** in 22 scripts,
versus the unchanged historical strict **290,914-byte** bound (57 bytes margin).
The theme entry is 1,451 LF bytes, funded by formatting-only app compaction.
Worker install membership is exactly **49 assets**; existing strict install-byte
accounting now includes the two declared theme files, not a relaxed byte limit.

Measured Dark contrast: Scripture **13.0592:1**, secondary text **7.3741:1**,
visible keyboard focus **8.1966:1**, and control border against the elevated
surface **3.4949:1**. CSS parses in Chromium and critical computed styles are
asserted, including navy modal backdrops and both native fallback color schemes.
The original Light Reader screenshot is pixel-identical when the new Dark rules
are disabled while retaining the toggle's sizing. Fonts and passage dimensions
are unchanged between themes. All eight theme-switch position cases and both
Light/Dark conceal/recovery matrices retain **0px additional Scripture shift**.

Asset validation checks 36 references, 22 JavaScript entries, three manifest
icons and all nine translation metadata contracts. Modified JavaScript and
worker syntax pass. Git whitespace validation uses
`git -c core.whitespace=cr-at-eol diff --check` because the existing homepage
blob contains mixed CRLF/LF; no unrelated whole-file normalization is made.
Bible data, manifests, CSP and original Light stylesheet files are unchanged.

Development checks exposed the real header CLS regression described above and
the stale cache-membership expectation; both are resolved, with original CLS
and strict JavaScript byte assertions preserved. An early pixel-comparison
batch was stopped after unbounded binary-diff formatting stalled; the final
test keeps header geometry constant and compares exact image bytes with a
bounded scalar assertion. Early runner output-path/pre-paint instrumentation
issues were corrected; final selected runs have no remaining failures/skips.
This is focused automated evidence, not a complete WCAG certification or
physical-device acceptance claim.
