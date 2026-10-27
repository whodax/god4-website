# Android Reader speech follow-up

Baseline: `3cdef581` on `feature/mobile-reader-compact-controls`.

## Playback and chapter introductions

The speech transport previously changed from playing to preparing for every
verse. Both the speech engine and mobile controls also rewrote the same Play
label on each update. Preparation now changes the session state only before its
first actual start; unchanged labels and icons are not rewritten between verses.
Pause, resume, explicit stop, completion, errors and replacement playback still
produce their appropriate state changes.

The first speech payload contains the verified translation's book name and
chapter, followed by the Scripture text. It uses the same utterance/audio request
as the first verse, avoiding a separate announcement transport. Chapter context
is recorded only after playback starts. A new chapter or translation announces
its reference; consecutive verses, paused resume, repeat and active Previous/Next
within the same chapter do not. A fresh playback session after Stop announces
the reference again. Individual verse numbers are never prefixed.

Only the speech payload changes. Canonical Scripture, references, verse numbering,
saved text, search and Word Study are unchanged. KJV supplied-word normalization
remains KJV-only; ordinary parentheses and other translations' brackets remain.

## Voice, speed and status

The lazy mobile picker renders a selected male/female person SVG using the
existing current color. Its accessible name includes the selected profile.
Native desktop selectors remain intact. Voice changes and persisted preferences
immediately synchronize the icon without rebuilding it on unrelated updates.

The seven speed choices run from 50% through 200%. Stored numeric speeds above
200% migrate to 200% and persist. The shared speech API clamps high requests;
the direct cloud client rejects invalid rates without canceling valid playback.
The existing server already rejects rates above 200%.

Empty readiness messages no longer consume space. Mobile playback and microphone
status remain polite screen-reader live regions outside the visual layout;
desktop retains useful nonempty status messages. Identical status text is not
rewritten. Voice Commands remains inside Options.

## Recognition lifecycle and beeps

The old recognizer used `continuous=false`, restarted from every `onend`, including
silence, and forcibly stopped after an interim playback command. These transitions
could repeatedly activate the Android microphone. A controlled baseline/current
lifecycle replay of three no-speech endings produced **4 versus 1 starts**.

Recognition now requests continuous results. Result indices deduplicate interim
and final versions without stopping capture; later result slots remain usable.
Verse playback, native synthesis and cloud TTS do not start or stop recognition.
An unexpected service end after a command permits one restart for services that
end despite continuous mode. An empty/no-speech capture ends with an explicit
restart instruction and an enabled Voice Commands button, without a retry loop.
Actual start-state races retain bounded retries. Explicit stop cancels scheduled
restarts; a late permission result cannot override that choice.

No application oscillator, beep asset or recognition-tone generator was found.
The lifecycle defect was reproduced with controlled recognizer events, not with
physical Android audio. Browser/OS microphone sounds cannot be declared eliminated
by these tests. Physical Android acceptance must check idle silence, consecutive
verses, explicit microphone start/stop, recognition of Pause/Resume/Stop/Next/
Previous, speaker echo, cloud/native voices and TalkBack. A browser may end an
idle capture despite continuous mode; restarting then requires an explicit tap.
See [continuous recognition](https://developer.mozilla.org/en-US/docs/Web/API/SpeechRecognition/continuous)
and the [service end event](https://developer.mozilla.org/en-US/docs/Web/API/SpeechRecognition/end_event).

## Focus and release boundaries

Fullscreen exit now returns focus to the visible Options trigger if its original
Fullscreen button is hidden inside collapsed mobile Options. Visible desktop
return targets retain their existing behavior. Regression assertions check both
fullscreen exit and visible focus return.

The compact three rows, independent Options and scroll-to-hide mechanisms,
Show Controls recovery, design tokens and 44px targets remain in place.
Service worker shell 52 and its 49 asset paths are unchanged in this review
branch. An installed-user release cache update must be prepared before production
delivery; this local change does not publish or activate an update. No Bible data,
translation manifests, CSP or cloud service settings change.

## Validation

Final focused runs reconcile to **395 unique passing Playwright test identities**,
zero remaining failures, zero skips and zero automatic retries. All browser runs
used one worker, sequentially. Repeated diagnostic runs are not counted twice.
The ignored `playwright-report/android-reader-summary.json` records every identity
and its complete final log source.

| Coverage | Unique passes |
| --- | ---: |
| Cloud speech, native profiles, KJV and speech highlighting | 116 |
| Android follow-up, including complete John 1 playback in both providers | 32 |
| Existing Reader/recognition/Repeat/spoken-follow contracts | 66 |
| Compact mobile controls and scroll-to-hide recovery | 63 |
| Options, fullscreen, keyboard and equivalent reflow | 84 |
| Offline Bibles and PWA | 29 |
| Historical shell 51-to-52 accepted update and failed-install retry | 4 |
| Startup byte budget and Word Study first use | 1 |
| **Total** | **395** |

The initial failures included superseded bare-text/high-speed/silence-restart
expectations, a fixture that reseeded saved voice settings on reload, and the
hidden fullscreen return target described above. Exact chapter-prefixed text
expectations replace bare first-utterance expectations; subsequent verses still
assert exact bare Scripture text. The older reflow test now measures all three
approved rows (14 controls), retains the seven-control desktop row, and uses the
existing fullscreen helper to access the button inside mobile Options. Cursor,
canonical-text, focus, keyboard, bounds and offline assertions remain intact.

Asset validation passes (36 references, 22 startup syntax checks, three manifest
icons, nine translation metadata entries). All ten changed/new JavaScript files
also pass explicit syntax checks. All 66 Isaiah SHA-256 hashes and byte counts,
shell 52's unchanged 49 assets, the 13,665-byte compact manifest and
`git diff --check` pass. No Scripture data is regenerated.

Startup remains 22 scripts: **260,413 -> 263,005 canonical LF bytes**, a 2,592-byte
increase with **27,909 bytes** remaining below the unchanged 290,914-byte budget.
The browser independently measured the same 263,005 decoded bytes. Word Study
network readiness was **16.7ms** in one run, not a comparative latency benchmark.

Hide/show regression measurements retain **0px additional Scripture displacement**
at the tested widths. Mobile tests cover 320/360/390/430px, Light/Blue Dark, normal
and fullscreen modes, 44px controls and enlarged text. Local screenshots under
`playwright-report/android-reader-icons/` confirm both person icons in the existing
palette. Physical TalkBack/VoiceOver and Android audio remain acceptance items.

Observed available physical memory remained approximately 4.0-5.2GiB, with
20.6-21.3GiB commit headroom across the sampled checks. No browser crashes or
memory-related interruptions occurred.

## Exact file scope

- `css/companion.css`
- `index.html`
- `js/bible/cloud-tts.js`
- `js/bible/reader.js`
- `js/bible/speech.js`
- `js/bible/translation-picker.js`
- `js/storage/user-data.js`
- `tests/cloud-tts.spec.js`
- `tests/final-reader-hardening.spec.js`
- `tests/god4.spec.js`
- `tests/kjv-supplied-words.spec.js`
- `tests/reader-android-speech.spec.js` (new)
- `docs/mobile-reader-compact-controls.md`
- `docs/android-reader-speech.md` (new)
