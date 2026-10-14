# Premium Scripture voice profiles

Natural Female and Natural Male are stable product identities. Existing god4.speech.voice values female/male and all speed preferences remain compatible. The small frozen catalogue lives inside the eager BibleSpeech module, avoiding another script or provider framework. Profiles contain id, displayName, gender, locale, provider, providerVoiceId, fallbackGender and defaultRate; getVoiceProfiles adds capability/inventory availability. Provider IDs appear only in developer diagnostics; the normal selector shows product names. The server still accepts only male/female and maps them to en-US-Neural2-D/F. Neither credentials nor arbitrary provider IDs move to the browser.

## Contracts and state

playChapter, playVerse, stop, pauseResume, setVoice, setSpeed and listener commands keep their existing void returns; repeatVerse keeps Boolean. getVoice still returns a native fallback object or null. Playback snapshots retain their existing fields. getState additionally reports preparing; failed playback returns to idle with a failed diagnostic result and Playback unavailable status. getResolvedVoiceInfo separates preferred preference from the latest attempt's profileId, provider, voiceName, locale, fallbackReason and genderVerified; these fields describe the current/latest attempt, not proof of physical audibility.

Voice and rate are captured for each utterance/request. A selection change does not cancel current playback: the current verse (including fallback) keeps its captured profile/rate; the next verse uses new preferences. The selected product option is never overwritten by a missing device voice or fallback. Migration of older names/profiles remains intact.

Premium cloud is primary on ordinary online URLs; cloud-tts=1 remains compatible but unnecessary. cloud-tts=0 explicitly selects the diagnostic device path. Availability is capability/inventory information, not a backend uptime guarantee. No TTS API call occurs at startup. The existing Function remains enabled/configured as before; no deployment or secret modification is required by this client code.

## Fallback and rates

Fallback first seeks a known same-gender local voice, then a known same-gender English native candidate, then an English voice with unknown gender. Gender recognition is a small curated/name-based inference, not a Web Speech API guarantee. A known opposite-gender voice is excluded. Empty inventories may attempt the unverified device default; an inventory containing only incompatible known voices yields Playback unavailable. Offline selection excludes enumerated remote voices. Selected product preference survives every outcome.

Rates 0.5 through 2.0 use premium synthesis. Existing 2.25/2.5 selections deliberately bypass cloud and use device speech, announcing Natural Male/Female unavailable at this speed. They are not sent to Google. Backend validation still rejects unsupported rates and arbitrary provider IDs. Native gender/quality can remain unverified and is announced honestly.

Preparing, Playing, fallback and failure use the existing polite status. Provider/profile transitions are announced; identical status text is not rewritten each verse. Focus is not moved by playback/provider completion. Paused playback retains its paused status. More and unrelated verse controls retain their existing Escape/focus behavior.

## Cancellation and mobile authorization

Speech owns session and utterance attempt IDs; cloud owns request generation and audio-operation IDs. Old prepare/resume/suspend promises cannot fallback or start a newer operation. Stop aborts fetches, invalidates sessions, detaches/stops sources and rejects late decode completion. Repeat evaluates a finished sequence against its original final verse rather than the repeated detour verse, preserving chapter and Plan boundaries.

Explicit Play invokes AudioContext preparation before Bible readiness. The first data acquisition uses a cancellable Reader intent; Stop, view changes and manual navigation invalidate it. Readiness may not replay a canceled Play. Explicit voice-command activation also prepares audio; automatic/background recognition is not an audio authorization substitute. Physical mobile autoplay, interruption and background recovery remain owner acceptance requirements.

Speech/cloud scripts stay eager and shell-precached. Shell advances exactly once from 27 to 28; translation and auth-vendor cache names/protocols remain unchanged. No SSML, punctuation rewriting, large browser audio cache, new CSP origin or preview UI is added. Existing validated server MP3 caching, fixed endpoints, rate limiter, limits, generic errors and secret isolation remain unchanged.

## Owner listening acceptance

Use an authorized preview containing this branch, confirm shell 28 after accepting any waiting update, and open an ordinary URL without a cloud query flag. In Reader More, select Natural Female first and then repeat the same passages with Natural Male, initially at 100%. Confirm the status says Playing the selected product voice and developer diagnostics show cloud rather than fallback. Do not count device fallback as a premium listening pass.

| Purpose | Exact WEB passage |
|---|---|
| Narrative prose and dialogue | Luke 15:11-24 |
| Psalms/poetry and pauses | Psalm 23:1-6 |
| Names and unfamiliar pronunciations | Genesis 10:1-10 |
| Quotations and sentence boundaries | John 14:1-6 |
| Long sentences and punctuation | Romans 8:28-39 |
| Short verse and pacing | Psalm 119:105 |
| Familiar comparison sample | John 3:16 |

Repeat Psalm 23 and Romans 8 in KJV to check translation punctuation. Judge naturalness, narrator gender, pronunciation, emphasis, breath/pause timing, fatigue and inter-verse gaps; record human pass/fail and comments for each voice. There is no automated subjective quality score. Check 50%, 100%, 150% and 200%; at 225%/250% expect the announced device fallback.

Test physical Chrome/Edge Windows, Chrome Android, Safari iPhone/iPad, and Safari/Chrome macOS. On mobile, include first Play before Scripture readiness, Stop during preparation, voice change during a pending verse, Pause/Resume via existing commands, early-verse Repeat while the final verse is playing, chapter transition and a Journey day's final verse. Verify keyboard Play/Stop and More Escape/focus. Go offline and confirm profile retention plus honest device fallback or unavailable status. Listen again after background/foreground and headphones/device interruption.

## Future preview

A future short preview can share the catalogue and provider resolution, but must use a distinct preview session with no Scripture highlighting, resume cursor, chapter or Plan continuation. It should cancel prior playback, retain focus, and require explicit narration Resume. No preview UI or generic marketplace is implemented here.

## Validation and performance

Baseline eager application JS is 256,494 Windows checkout / 248,998 decoded bytes across 19 scripts. Speech plus cloud baseline is 25,949 checkout / 25,291 decoded bytes. Final measurements and test outcomes are reported with this branch; local transport/timing probes are distinguished from deployed acceptance. No startup optimization, Lighthouse gain or subjective voice-quality approval is claimed.

### Measured local validation (2026-10-13)

The final combined required suites cover 452 distinct Playwright cases, all eventually passing: the 396-case run had 392 passes/four old fixture failures; the full affected cloud/Journey/CSP rerun passed 78/78; Reader speech had 55/56 plus one old label assertion, then the label/native-profile rerun passed 12/12. Earlier runs encountered Windows/Node out-of-memory worker crashes and ten outdated status/readiness fixture failures; these were corrected and rerun after the owner freed memory. These historical failures are not omitted or counted as passes. Journey data coverage also passed for 260 contiguous chapters. Changed JavaScript syntax, asset validation, protected server/CSP/data-path comparisons and git diff --check passed.

Nineteen eager application scripts remain: Windows checkout 256,494 → 261,849 bytes (+5355); decoded LF 248,998 → 254,271 bytes (+5273, 2.12%). Local gzip body sum 55,811 → 57,032 bytes; this is a local compression measurement, not deployed transfer. Speech/cloud decoded 25291 → 29316 bytes. No startup optimization is claimed.

before: three fresh headless Chromium contexts against an in-memory gzip server, eager EvaluateScript totals 18.994, 152.046, 15.531 ms (median 18.994); speech/cloud 3.649, 1.578, 2.086 ms (median 2.086).

after: three fresh headless Chromium contexts against an in-memory gzip server, eager EvaluateScript totals 162.885, 157.818, 18.925 ms (median 157.818); speech/cloud 2.134, 1.577, 2.094 ms (median 2.094).

Reader evaluation intermittently spent about 144–154 ms in both versions, versus about 9 ms in other samples. The total median increased in this small sample; variability prevents attributing that increase to profile work or declaring startup cost unchanged. Speech/cloud median changed about +0.008 ms. Repeat performance acceptance on the eventual hosted preview; no measured improvement is claimed.

Live probes used canonical BibleData WEB John 3:16 at 100%, one verse per profile, the modified local client and unchanged hosted /api/tts through a local forwarding harness. No branch deployment occurred. An earlier harness-only text sample was replaced with canonical data for the reported measurements.

female: HTTP 200, 66048 bytes audio/mpeg; response headers/body 323/324 ms; gesture-to-decode/start 458.1/458.3 ms; en-US-Neural2-F, cloud, no fallback.

male: HTTP 200, 62016 bytes audio/mpeg; response headers/body 193/194 ms; gesture-to-decode/start 243.1/243.3 ms; en-US-Neural2-D, cloud, no fallback.

Earlier production-baseline gesture-to-start probes were male 882.8 ms and female 676.5 ms. Network/cache state and harness differ; the new male 243.3/female 458.3 ms samples do not establish a speed improvement. Audio source start is measured, not subjective audibility or narrator approval. Physical mobile authorization/background recovery and owner listening remain outstanding.
