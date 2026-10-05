# Google Neural2 Reader proof of concept

This branch starts from production `cbcfa10`. Cloud speech is opt-in at
`https://<host>/?cloud-tts=1`; ordinary URLs retain the production speech path and
controls. No new UI, accounts, dependencies, or per-verse buttons are introduced.

## Administrator setup

1. Create a dedicated Google Cloud project with billing enabled. Enable the
   **Cloud Text-to-Speech API** (`texttospeech.googleapis.com`). Use a dedicated
   project for preview testing, with deliberately low synthesis quotas and budget
   alerts. Budget alerts do not impose a hard spending cap.
2. Create a dedicated service account. Grant **Service Usage Consumer**
   (`roles/serviceusage.serviceUsageConsumer`) on the project to allow API usage
   billed through `x-goog-user-project`. Do not grant Owner/Editor. This POC calls
   synchronous text synthesis, not long-audio/Cloud Storage APIs.
3. Create a JSON service-account key, if your organization permits keys. Store the
   complete JSON only as an encrypted Cloudflare secret. Rotate/revoke the key
   when testing finishes. Do not put it in this repository, HTML, browser storage,
   build variables, or browser responses. If organization policy disallows keys,
   leave the POC disabled; workload identity federation is outside this narrow POC.
4. In the Cloudflare Pages project, select **Settings → Variables and Secrets**.
   Configure these runtime bindings separately for **Preview** and **Production**:

   | Binding | Type | Meaning |
   | --- | --- | --- |
   | `GOOGLE_TTS_SERVICE_ACCOUNT` | Encrypted secret | Complete service-account JSON, including `client_email`, `private_key`, `project_id`, and `type` |
   | `CLOUD_TTS_ENABLED` | Variable (or encrypted secret) | Exactly `1` enables the endpoint; omitted/any other value disables it |

   Enable Preview first. Leave Production disabled until physical-device testing
   is satisfactory. Redeploy the appropriate environment after changing runtime
   bindings. Deploy through Pages Git integration or Wrangler with Functions
   support; a static-only server/dashboard direct upload cannot run this Function.
   No Node compatibility flag, Google SDK, R2, or other storage binding is needed.
5. Check Pages build output includes `functions/api/tts.js`, `_routes.json`, and
   the static site. Only `/api/tts` invokes the Function. `_headers` remains
   unchanged. Static-only local preview returns 404 for the endpoint and exercises
   the local fallback; it cannot verify live Google synthesis.

Authentication follows Google's service-account OAuth flow: sign a one-hour RS256
JWT with Web Crypto, exchange it at the fixed Google OAuth token endpoint, and
use the short-lived access token for the fixed v1 synthesis endpoint. The token
is reused only in the server isolate, refreshed before expiry, and invalidated
when credentials change. Neither token nor JWT is returned to the browser.

## Playback and manual test

Open `https://<your-preview>.god4-us.pages.dev/?cloud-tts=1`, enter Reader, choose
Male/Female and speed under More, and press Play. In browser developer tools,
requests should be **same-origin POST `/api/tts`**, one exact Scripture verse at a
time, with `{text, voice, rate}`. Successful responses are `audio/mpeg` bytes.

| Reader label | Fixed Google voice |
| --- | --- |
| Male | `en-US-Neural2-D` |
| Female | `en-US-Neural2-F` |

Check both voices on physical phones/tablets, continuous verse/chapter/book
reading, Stop, voice-command Pause/Resume/Repeat, fullscreen, and an assigned
Journey day's final verse. Switch voice/speed while reading and verify the next
verse uses the new settings. Stop or navigate during a pending request and verify
late responses cannot restart audio. Check 320/375/480px widths and Word Study.
Compare an ordinary URL to confirm the original speech path is retained.

MP3 bytes are decoded and played with a reusable Web Audio context and one buffer
source per verse. Play resumes the context during the user gesture. No media
element/blob URL or direct browser Google connection is needed, so strict CSP,
including `media-src 'none'`, stays intact. Background audio behavior and autoplay
restrictions vary by physical browser and need manual testing.

Cloud speech never gates Scripture initialization. Offline state, network errors,
HTTP/provider errors, a 12-second fetch/decode/start deadline, unsupported audio,
or rejected playback fall back to browser SpeechSynthesis for the same verse.
If the browser has no local speech API either, playback ends safely while Reader
remains functional. Paused playback stays paused through fallback. Google v1
supports rates only through 2.0: Reader rates 2.25/2.5 receive a deliberate 422
without contacting Google and retain their selected speed through local speech.
Fallback quality and gender still depend on the device's installed voices.

The existing speech sequence owns chapter continuation, Journey boundaries,
verse highlighting, progress/resume callbacks, Pause/Resume/Stop and Repeat.
Cancel aborts pending fetches, stops audio, and ignores old callbacks. There is no
chapter prefetch; verse-by-verse network latency may introduce audible gaps.

## Caching, limits, and disabling

The server's named Cache API cache `god4-neural2-tts-v1` stores successful audio
for up to 24 hours with immutable cache headers. SHA-256 keys include exact text,
semantic profile, mapped Google voice, rate, API/audio configuration version and
Google project. Male/Female and speed outputs cannot collide. Cache failures do
not block synthesis. Cache availability/hits vary by Cloudflare environment and
data center; preview caches may be unavailable. This is not durable storage or a
guarantee of one billable synthesis per unique verse. Browser responses use
`Cache-Control: no-store`, and provider errors are never cached.

Requests accept POST JSON only, at most 32 KiB of JSON and 4,000 UTF-8 bytes of
nonblank text. Only `text`, `voice`, and discrete Reader `rate` values are accepted;
Google receives plain text, fixed English Neural2 voices and MP3 configuration.
Cross-origin browser requests are rejected, no CORS access is granted, and no
arbitrary URL/SSML/language/provider parameters are accepted. These controls are
not authentication or a global rate limiter: direct clients can still call an
enabled public endpoint. Use low Google quotas and, if required for a wider test,
an administrator-configured Cloudflare rule on `/api/tts`. No unbounded in-memory
IP limiter or new account/billing feature is part of this POC.

The service worker bypasses `/api/tts`; audio is never precached or put in GOD4
browser shell/translation caches. The shell is bumped exactly once from
`compact-reader-12` to `compact-reader-13`. Retained Offline Bibles and the update
notification lifecycle are unchanged. Offline reading uses local speech.

To disable without deleting code: remove `cloud-tts=1` for an individual browser;
set `CLOUD_TTS_ENABLED=0` (or remove it) in the relevant Pages environment and
redeploy to disable all cloud synthesis, including cached audio. Remove/revoke the
service-account key after the POC. Reader continues with browser speech fallback.

Automated tests mock Google and `/api/tts`, generate ephemeral test signing keys,
and use mock audio plus a generated PCM clip for native Web Audio/CSP validation.
They spend no Google quota. Real Neural2 sound quality and Pages deployment
authentication require the administrator's configured physical-device test.

References: [Google service-account OAuth](https://developers.google.com/identity/protocols/oauth2/service-account),
[synthesis REST API](https://docs.cloud.google.com/text-to-speech/docs/reference/rest/v1/text/synthesize),
[rate limits](https://docs.cloud.google.com/text-to-speech/docs/reference/rest/v1/AudioConfig),
[Google authentication](https://docs.cloud.google.com/text-to-speech/docs/authentication),
[Pages secrets](https://developers.cloudflare.com/pages/functions/bindings/#secrets),
[Cache API](https://developers.cloudflare.com/workers/runtime-apis/cache/).
