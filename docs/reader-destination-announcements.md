# Reader destination announcements

This uncommitted change is based on `465b0f5` on
`feature/header-navigation-menu`. The previous heading-position and touch-focus
corrections remain intact.

The shared speech formatter previously introduced a changed chapter but omitted
the destination verse. Explicit Previous/Next and same-chapter voice navigation
could retain the chapter key, suppressing the introduction entirely. All input
routes already converge on validated Reader playback cursors and `BibleSpeech`;
a competing navigation mechanism or new asynchronous flag is unnecessary.

`createUtterance()` now uses the existing `sessionStarted` state to distinguish a
new explicitly requested sequence from automatic progression. A new sequence
announces the translation's canonical book name, chapter and actual first
speakable verse, followed by the complete existing speech-normalized verse text.
The session and chapter key are claimed only when audio actually starts. The
key remains chapter-scoped: including a verse in it would wrongly introduce
every automatically advancing verse. Only the existing new-sequence state adds
the destination verse number.

| Action | Narration introduction |
| --- | --- |
| Book/chapter selection then Play | Book, chapter, verse 1 (or first speakable coordinate) |
| Specific verse selection, direct reference, explicit seek or voice navigation | Book, chapter, destination verse |
| Automatic next verse | Scripture text only |
| Automatic chapter transition | Existing book/chapter introduction, without a verse number |
| Normal Pause/Resume | Resume existing audio without a new introduction |
| Android native command-turn replay after narration started | Replay the complete interrupted verse without repeating its introduction |
| Active Repeat detour | Preserve existing repeat and continuation behavior without a new introduction |
| Stop then Play / stopped single-verse playback | Introduce the actual resumed destination as a new sequence |

Navigation alone still does not start speech. Existing selectors, Scripture
picker, Search/Plan passage navigation, compound voice commands, translation
loading, canon validation and request/intent cancellation remain unchanged.
A paused navigation destination is introduced only when it first starts audio.
A superseded translation request cannot start old narration or select its old
reference. Invalid requests retain existing feedback rather than inventing a
reference. Native and cloud TTS share the same prepared string; fallback does
not append a second prefix. Android microphone release/isolation is unchanged.

No Scripture, display text, saved data, translation metadata, voice/speed policy,
layout, theme or service-worker source changes. KJV supplied-word normalization
still affects speech-only text and preserves all canonical words and references.

Regression coverage checks all nine editions with native/cloud providers,
actual mobile/desktop selectors, same-chapter seeks, compound Catholic commands,
paused navigation, resume, automatic verses/chapters, active repeats, obsolete
translation completion and retained WEB/DRA offline playback. Cloud test buffers
retain their actual payload text, so cached playback is checked rather than
assuming the latest HTTP request identifies the audible buffer.

Existing exact-text contracts are updated only where this approved requirement
changes the introduction. Automatic progression, complete Scripture text,
counts, state, highlighting, microphone isolation and data-preservation assertions
remain. The Shell 54 frozen contract pins the exact new speech source hash;
historical Git fixtures, 49 precache paths, vendor migration and user-accepted
activation are unchanged. The existing historical Shell 45 upgrade helper keeps
its old raw-text expectation before acceptance and the new destination prefix
only after the current shell is accepted.

The first new asynchronous fixture accidentally awaited a pending promise while
holding its download gate. The fixture now stores that promise without returning
it and waits for the new synchronous destination's actual audio before releasing
the old download. No production timeout, sleep or assertion was loosened.


Review scope:

- `js/bible/speech.js`: shared formatter condition/prefix and its transport comment.
- `tests/reader-destination-announcements.spec.js`: new end-to-end coverage.
- `tests/reader-android-speech.spec.js`, `tests/voice-scripture-navigation.spec.js`,
  `tests/reader-voice-command-isolation.spec.js`, `tests/god4.spec.js`,
  `tests/cloud-tts.spec.js`, `tests/kjv-supplied-words.spec.js`: exact-text contracts.
- `tests/mobile-translation-upgrade.spec.js`: exact speech-source integrity pin,
  preserved-assets scope and current-shell KJV announcement expectation.
- `docs/reader-destination-announcements.md`: behavior, evidence and limitations.

One old short-name voice-navigation assertion explicitly forbade "verse 2" after
navigating to Tobit 1:2. It was replaced with an exact canonical book/chapter/verse
prefix plus the full verse text. The stopped batch had 198 passing tests; that
case and the ten unexecuted tail cases were then run separately. Passing tests
were not counted twice, and unexecuted cases were not treated as passes.


Final focused validation used sequential test processes, one worker and zero
automatic retries:

| Gate | Unique passed |
| --- | ---: |
| Destination announcements (30 new), Android speech, voice navigation and isolation | 209 |
| Selected God4 speech, Repeat, cursor, chapter-boundary and spoken-follow contracts | 45 |
| Cloud TTS, KJV supplied words, speech highlighting and voice profiles | 116 |
| Reader navigation, mobile recovery, touch focus and chapter geometry | 108 |
| Historical source contracts and installed Shell 45/53-to-54 upgrades | 25 |
| PWA and offline | 17 |
| Startup performance | 1 |
| **Total** | **521** |

The reconciled final results have zero failures, skips or automatic retries.
The pre-fix Book selector test reproduced the omitted verse number. The two new
asynchronous fixture cases initially timed out on their controlled pending
promise, and the first fixture correction still waited for the old global task;
the final two cases passed without changing a production timeout or expectation.
The separately identified stale Tobit assertion and its unexecuted tail were
resolved as described above. Diagnostic attempts are not counted as additional
passing identities. Raw logs and reconciled identities are available locally in
`playwright-report/narration-destination-final-summary.json` and related reports.

Browser startup remains **22 scripts**, increasing from **290,741** to
**290,827 canonical decoded bytes** (+86), with **87 bytes** below the unchanged
290,914-byte limit. Word Study first-use readiness measured 19ms. No new audio
request or utterance is added for the introduction; it is part of the first
verse's existing payload. Assets, syntax, all 66 Isaiah hashes and sizes, the
speech-source hash, protected files and `git diff --check` pass.

Controlled browser speech tests validate the text, lifecycle and full passage
continuity. Actual device pronunciation and cadence remain a physical listening
check. This change is unstaged and uncommitted for review; there was no push,
merge or deployment.
