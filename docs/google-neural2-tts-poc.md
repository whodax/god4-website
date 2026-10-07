# Google Neural2 Reader — production review, opt-in

The controlled-rollout work starts from merged PR #73 on `main`. Cloud speech is opt-in at
`https://<host>/?cloud-tts=1`; ordinary URLs retain the production speech path and
controls. No new UI, accounts, dependencies, or per-verse buttons are introduced.

Architecture: **Reader → same-origin POST `/api/tts` → Google Cloud Text-to-Speech
→ MP3 → Reader Web Audio playback**. Browser SpeechSynthesis remains the local
fallback. Cloud speech is not the default and final production approval is pending.

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

   Keep Preview enabled for testing and Production disabled until explicit
   production approval (see rollout prerequisites below). Redeploy after changing runtime
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
Production resolves `globalThis.fetch` at each subrequest execution; tests inject
their own fetch. Outbound OAuth/synthesis requests use `redirect: "manual"` and an
eight-second AbortController deadline through response body consumption. Provider
redirects are rejected and never followed with assertions or bearer credentials.
All provider/runtime/crypto/decode failures return only HTTP 502 with
`{"error":"Cloud speech is unavailable."}` and `Cache-Control: no-store`.
Temporary configuration and provider diagnostic endpoints have been removed;
query parameters cannot reveal configuration, stages, provider statuses or errors.

## Configuration safety

`wrangler.toml` sets Preview `CLOUD_TTS_ENABLED="1"` and Production
`CLOUD_TTS_ENABLED="0"`. This cost-control change preserves both values.
Production activation requires a separate explicit approval and configuration change.
The browser query flag is an opt-in playback feature, not an endpoint cost guard.
An enabled production endpoint still accepts direct clients that forge Origin.

Keep `pages_build_output_dir = ""` as downloaded for this root-level static site;
there is no new build/output directory and no concrete reason to alter the working
Pages configuration. This review does not independently validate a new deployment.
When a Wrangler file is used, its environment configuration is the source of truth;
changing a dashboard value alone may not override the next deployment. The
service-account JSON must stay in the encrypted Pages secret, never in this file.

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
any non-200 cloud response, HTTP/provider errors, a 12-second fetch/decode/start deadline, unsupported audio,
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
for up to 30 days (2,592,000 seconds). Only the internal cached copy has
`Cache-Control: public, max-age=2592000, immutable`. SHA-256 keys include exact text,
semantic profile, mapped Google voice, rate, API/audio configuration version and
Google project. Male/Female and speed outputs cannot collide. Cache failures do
not block synthesis. Cache API entries are local to the servicing data center
and do not automatically replicate globally; preview caches may be unavailable.
This cache does not globally deduplicate Google synthesis. It is not durable storage or a
guarantee of one billable synthesis per unique verse. Browser responses use
`Cache-Control: no-store`, and provider errors are never cached. Cache keys expose
no plaintext verse or service-account credentials. Decoded audio must contain
complete MPEG Layer III frames (with supported ID3 metadata) before it is cached;
empty, non-MP3 and truncated output is rejected. Cached audio receives the same
structural check, so invalid older entries become misses and can be replaced.
This check is not a full audio decoder; browser decoding remains the final guard.

In plain English: a local edge cache hit avoids another Google synthesis request. The first
uncached combination invokes Google. Changing text, Male/Female voice, speed or
TTS configuration creates a different entry. Eviction, expiry, another data center
or an unavailable cache can cause the same combination to be synthesized again.
Failed requests are not cached and remain retryable.

The cache name and configuration version stay unchanged: retention does not change
the audio format, voice mapping, synthesis configuration, or key inputs. Existing
24-hour entries can be reused until their original expiry; subsequent successful
cache writes use 30 days. A future audio/configuration change must version its key
inputs to invalidate old output. Longer retention improves reuse and may reduce
cost, but eviction can occur before expiry and no savings or retention are guaranteed.
4xx/5xx, malformed provider output, invalid MP3, disabled-backend and local-fallback
responses are never stored as generated audio. Disabled checks precede cache reads.

Requests accept POST JSON only, at most 32 KiB of JSON and 4,000 UTF-8 bytes of
nonblank text. Only `text`, `voice`, and discrete Reader `rate` values are accepted;
Google receives plain text, fixed English Neural2 voices and MP3 configuration.
POST requires a nonmissing Origin that exactly equals the endpoint's origin. If
`Sec-Fetch-Site` is present it must equal `same-origin`; `none`, `same-site` and
`cross-site` are rejected. Standard Reader fetch supplies these browser headers.
Direct tools without Origin now receive 403. Cross-origin requests are rejected,
no wildcard CORS access is granted, and no
arbitrary URL/SSML/language/provider parameters are accepted. These controls are
not authentication or a complete anti-abuse/rate-limiting solution: non-browser
clients can forge Origin/Sec-Fetch-Site and call an enabled endpoint. Origin checks
reduce casual cross-site browser abuse but do not cap cost. Use low Google quotas
and budget alerts and, if required for a wider test,
an administrator-configured Cloudflare rule on `/api/tts`. No unbounded in-memory
IP limiter or new account/billing feature is part of this POC.

## Proposed production rate-limit rule

Design only: no Cloudflare rule is created or modified by this change. Immediately
before production activation, create this zone-level rule for GOD4.us:

| Setting | Exact value |
| --- | --- |
| Rule name | GOD4 TTS API rate limit |
| Match | URI Path equals `/api/tts` |
| Expression | `(http.request.uri.path eq "/api/tts")` |
| Counting characteristic | IP address (`ip.src`) |
| Threshold | 20 requests per 10 seconds per IP |
| Action | Block (`block`) |
| Mitigation duration | 10 seconds (`mitigation_timeout: 10`) |

Cloudflare's current Free-plan documentation supports Path expressions, IP
counting, a 10-second counting period and a 10-second mitigation period. Ten seconds
is the documented shortest Free-plan block duration; confirm the selectable value
in the dashboard at setup time. Free provides one rule, so confirm that slot is
available. This path-only rule counts all matching methods and queries, including
requests served from the Function's internal audio cache. It does not require body
inspection, custom headers, identity, CAPTCHA, Turnstile, KV, Durable Objects or paid
third-party infrastructure. In API configuration, characteristics are
`["cf.colo.id", "ip.src"]`; data center ID is mandatory and implicitly included in
the dashboard, and is not part of the match expression. Use `period: 10` and
`requests_per_period: 20`; no custom counting expression or cache exclusion.

Reader requests are sequential, so ordinary verse progression should remain well
below this initial burst threshold. Twenty requests allows reasonable voice/speed
interaction while making high-rate scripted abuse harder. Validate it with real
usage before changing the threshold. Users sharing a public IP/NAT share the
allowance. Counters are local to each data center rather than globally shared;
enforcement can lag by a few seconds and excess requests can reach the endpoint.
Distributed clients can still generate substantial traffic. This is not a hard
billing ceiling, and budget alerts also do not stop spending.

Confirm the rule applies to the production custom-domain endpoint before enabling
cloud speech. A zone rule must not be assumed to protect the separate `pages.dev`
hostnames; verify alternate-host exposure during rollout. Preview remains enabled
for controlled testing and is not evidence of production rule enforcement.

Sources (reviewed October 7, 2026):
[Free-plan capabilities and enforcement delay](https://developers.cloudflare.com/waf/rate-limiting-rules/),
[rule parameters](https://developers.cloudflare.com/waf/rate-limiting-rules/parameters/),
[per-data-center counters](https://developers.cloudflare.com/waf/rate-limiting-rules/request-rate/),
[Cache API locality](https://developers.cloudflare.com/workers/runtime-apis/cache/).

## Production rollout prerequisites and emergency response

1. Merge the 30-day cache change after review.
2. Create and verify the proposed Cloudflare rate-limit rule and its endpoint coverage.
3. Configure Google Cloud budget alerts.
4. With separate explicit approval, change Production `CLOUD_TTS_ENABLED` from
   `"0"` to `"1"` in `wrangler.toml` and deploy. Preview stays `"1"`.
5. Keep Neural2 opt-in through `?cloud-tts=1` for the initial live rollout.
6. Smoke-test production voices, continuous reading, Stop, fallback and rate limiting.
7. Observe Google usage and costs before considering default enablement.

For an emergency rollback, set Production `CLOUD_TTS_ENABLED` back to `"0"` and
redeploy. This disables cloud synthesis and cached cloud audio; browser
SpeechSynthesis continues functioning. No production activation occurs in this task.

The service worker bypasses `/api/tts`; audio is never precached or put in GOD4
browser shell/translation caches. This hardening bumps the shell exactly once from
`compact-reader-13` to `compact-reader-14`. Retained Offline Bibles and the update
notification lifecycle are unchanged. Offline reading uses local speech.

To disable without deleting code: remove `cloud-tts=1` for an individual browser;
set `CLOUD_TTS_ENABLED=0` (or remove it) in the relevant Pages environment and
redeploy to disable all cloud synthesis, including cached audio. Remove/revoke the
service-account key after the POC. Reader continues with browser speech fallback.

Automated tests mock Google and `/api/tts`, generate ephemeral test signing keys,
and use mock audio plus a generated PCM clip for native Web Audio/CSP validation.
They spend no Google quota. The owner verified successful preview MP3 responses
and natural Male/Female voices before hardening. Retest this hardened commit on a
preview with actual Google MP3 output and exact browser Origin, then exercise
Stop, Pause/Resume/Repeat, fullscreen, Journey boundaries, translation changes,
Word Study and offline fallback on physical phones/tablets before production approval.

References: [Google service-account OAuth](https://developers.google.com/identity/protocols/oauth2/service-account),
[synthesis REST API](https://docs.cloud.google.com/text-to-speech/docs/reference/rest/v1/text/synthesize),
[rate limits](https://docs.cloud.google.com/text-to-speech/docs/reference/rest/v1/AudioConfig),
[Google authentication](https://docs.cloud.google.com/text-to-speech/docs/authentication),
[Pages secrets](https://developers.cloudflare.com/pages/functions/bindings/#secrets),
[Cache API](https://developers.cloudflare.com/workers/runtime-apis/cache/).
