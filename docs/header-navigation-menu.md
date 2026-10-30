# Header navigation menu

Implementation baseline: `5e98b32eddfeaeac6f90beb3a247044b2d610127`.
Branch: `feature/header-navigation-menu`.

The header replaces its desktop text links with a labeled Menu button beside the
brand at every width. Saved, Account and theme shortcuts remain available.
The existing narrow-screen header wrap is retained. The menu uses a native modal
dialog, a scrollable surface, existing theme tokens and existing typography.
It overlays the document without changing Scripture layout. All menu buttons
have at least 44 by 44 CSS pixel targets. Tab/Shift+Tab wrap within the dialog;
Escape, Close and a backdrop click dismiss it and explicitly return focus to Menu.
Keyboard wrap scrolls the destination into view inside the panel.
Backdrop scrolling is prevented without changing body layout or overflow.

## Configuration and destinations

The grouped configuration in `js/app.js` supplies labels and stable action keys.
The dialog is constructed once on first open. Opening it loads no new runtime,
Bible or account data. Adding a destination requires a configuration entry and
an action that delegates to its existing feature control or handler.

* **Read & Study:** Bible Reader, Compare Translations, Reading Plan, Search
  Scripture, Word Study.
* **My Bible:** Saved Verses, Offline Bibles, Choose Translation.
* **Preferences & Account:** Read Aloud, Voice Commands, Voice & Reading Speed,
  Light / Dark Theme, Account.
* **Explore:** Featured Verse, Bible Resources.

Reader, Compare and Plan reuse their existing view handlers, tab controls and
loaders. Menu returns to Reader use its existing saved scroll cursor, avoiding
the selected-verse and fullscreen-anchor repositioning modes. Reader retains
its current passage and reading position. Search keeps its input and
receives focus. Word Study focuses a studyable word in the selected/spoken verse,
or the current passage, without changing Scripture or automatically opening a
definition. There is no dictionary destination or inferred alignment.

Opening Menu dismisses an already-open Saved tray through its existing toggle
so two focus traps cannot compete; entries remain untouched.
Saved, Offline and Account use existing triggers, including their unavailable
and offline states. Translation opens the existing mobile picker or focuses the
desktop native selector. The catalog still contains nine editions, including
CTH Catholic (internal ID `dra`). No alias or canon metadata changes.
If the optional picker cannot load, the native selector remains accessible;
existing translation-load feedback and retry behavior remain responsible for
retaining the previous translation until the runtime becomes available.

Audio destinations reveal existing Options and focus Play, the microphone, or
voice preferences, respectively. They never start narration or listening and
never change preferences. Both voice and speed fields remain in Options.
The theme action invokes the existing shortcut and reflects the available action
each time the menu opens. Options and automatic scroll-to-hide remain independent;
Reader actions use the existing Show Controls recovery when necessary.

While a destination loads, duplicate activation is ignored. Closing or reopening
the menu invalidates its pending action so a late completion cannot navigate,
close a new menu or steal focus. Failed Bible initialization leaves the menu
open with retry feedback. Existing required Bible loading behavior is unchanged.

Footer Open Bibles now targets Scripture Companion. Ethiopian Bible targets its
existing information section; its unavailable edition and the unimplemented
email/RSS/Contact features are labeled unavailable rather than linking to `#`.
No feature implementation is invented for these placeholders.

## Release milestone: Shell 54 (separate approval)

**This implementation deliberately leaves `sw.js`, shell 53, all 49 asset paths,
the web manifest, Bible data and security policy unchanged. It is not ready to
deliver as an installed-user production update.** The changed HTML, app script
and CSS already occupy existing precache paths, so no additional asset is needed.

Before production release, advance shell 53 to 54 in a separately reviewed
milestone. Preserve explicit update acceptance, legacy vendor migration, Bible
cache protocols, saved data and all settings. Verify installed shell 53 serves
its old app before acceptance; after acceptance, assert exact new HTML/CSS/app
bytes in shell 54 and offline menu availability. Cover historical shells,
multiple tabs, failed/interrupted installation, retry, old-version recovery,
WEB/CTH downloads, Saved Verses and no unintended Bible redownloads. Update only
current-shell expectations; preserve historical fixtures. Do not infer safe
installed-user delivery from the fresh-shell offline test in this change.

The existing frozen-release test at
`tests/mobile-translation-upgrade.spec.js:59` intentionally still pins the approved
Shell 53 HTML/CSS/app sources. Its source comparison at line 77 fails on `/`
with this implementation's new header HTML. This is an outstanding release gate,
not permission to replace historical release hashes or claim that installed
Shell 53 users receive the menu. Preserve the assertion until the separate
Shell 54 milestone establishes the new release contract and upgrade fixtures.

## Validation and acceptance

`tests/header-navigation-menu.spec.js` covers approved groups and destinations,
320/390/430px and desktop, both themes, focus containment and return, dismissal,
touch targets, overlay reflow, actual ASV/CTH selection, persisted translation,
reading/Saved state, optional-runtime failure/retry, canceled asynchronous work,
fresh-install offline operation, shell assets and the unchanged startup budget.
Existing compact Reader, microphone, navigation, Saved, Compare, account and PWA
regressions must also pass sequentially with one worker and zero retries.

Screenshots are test artifacts, not site assets. Automated semantic/focus tests
do not replace physical Android momentum scrolling, TalkBack or iOS VoiceOver
acceptance. Check those on a future approved preview; this branch is local only.

Validated locally with one worker and zero retries:

| Targeted batch | Passed |
| --- | ---: |
| Header menu (including both themes, all requested widths and offline) | 31 |
| Compact Reader, microphone, recovery, navigation and Plan | 105 |
| PWA and offline translation management | 29 |
| Account, Compare and Saved Verses | 61 |
| Existing shell 52-to-53 upgrade behavior | 9 |
| Homepage/Reader-state smoke and browser performance | 8 |
| **Unique passing tests** | **243** |

The frozen Shell 53 release-source contract failed once as documented above;
nine additional historical source-contract cases did not run after fail-fast.
The nine behavior cases subsequently ran separately and passed. This is not a
claim of 53-to-54 upgrade coverage. No assertions or frozen release hashes were
changed to bypass the failure. Baseline `5e98b32` still matches all 49 frozen
release source contracts; the new menu assets require the new release milestone.

Browser measurements: 22 eager scripts, 289,970 canonical LF decoded bytes,
944 bytes below the unchanged 290,914-byte budget. Word Study first-use network
readiness measured 21.6 ms locally (not a production latency guarantee).
Asset validation, JavaScript syntax, all 66 Isaiah hashes/byte lengths and
`git diff --check` passed. Windows samples retained at least 3,390 MiB available
physical RAM and over 19 GiB commit headroom; no browser crashes occurred.
