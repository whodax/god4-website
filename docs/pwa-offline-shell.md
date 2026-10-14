# PWA offline shell

Phase 1 makes GOD4.us installable and keeps the public application shell available after a successful visit.

## Cached content

The versioned `god4-shell-*` cache contains the homepage, offline fallback, manifest, icons, local styles, and the public JavaScript required to start the existing application. The cache deliberately excludes all Bible translation bundles.

The service worker uses exact same-origin asset paths. It does not cache arbitrary successful requests.

## Network-only content

- Bible translations in Phase 1
- Supabase requests and responses
- Authentication callback responses
- Requests with authorization headers
- Cloudflare Web Analytics and Challenge Platform traffic
- Non-GET requests

## Navigation and updates

Same-origin navigations use the network first. The cached homepage is used for the canonical home route when the network is unavailable, and other failed navigations receive the canonical `/offline` page. Cloudflare Pages redirects `/offline.html` to `/offline`, so the service worker precaches `/offline` directly to keep the stored fallback response usable and non-redirected. Authentication callbacks always try the network and may receive only the generic offline page when unreachable.

Each release uses a new cache name. A newly installed worker waits while the current worker and page remain active. The page announces that an update is ready and activates it only after the visitor selects **Update when ready**. No reading session is reloaded automatically.

## Phase 1 limitations

- Bible translations are not stored for offline reading yet.
- Search, Reader, and Compare require a translation response unless the browser happens to have one in its ordinary HTTP cache.
- Google Fonts are not part of the same-origin shell cache, so an offline launch may use the existing metric-adjusted fallbacks.
- Account operations and password recovery require a connection.

## Phase 2A translation metadata

`js/bible/translation-manifest.js` is generated from the eight approved local translation bundles by:

```text
npm run generate:translation-manifest
```

Each manifest entry contains the fixed translation ID and same-origin path, a revision derived from the first 16 hexadecimal characters of the file's SHA-256 digest, the complete SHA-256 value in Subresource Integrity format, the decoded byte length, and structural counts for the complete translation and each canonical book.

The generator converts CRLF line endings to LF before hashing, measuring, decoding, and structurally parsing each bundle. These canonical LF bytes match the Git and Cloudflare Pages representation, so checkout line-ending settings cannot change manifest integrity metadata.

The per-book structure is stored as `[bookId, chapterCount, verseCount]` tuples. Empty verse strings used by some editions to preserve canonical verse numbering are counted as verses. WEB Psalm 1 is currently represented by an existing empty chapter array and is recorded as such; the metadata workflow does not change Bible text.

`npm run test:validate` regenerates the expected manifest in memory and requires an exact match with the checked-in file. It also verifies that the loader's fixed mapping matches the generated allowlist. After an approved translation bundle changes, regenerate the manifest and review both changes together.

Phase 2A adds the metadata manifest to the existing shell because it is a small startup dependency. It does not place any Bible translation payload in Cache Storage and does not change translation request behavior.

### Generated manifest rules

- The generator reads only WEB, ASV, KJV, YLT, DBY, Webster, RV, and GNV from their fixed local paths.
- Missing bundles, duplicate IDs, invalid book/chapter/verse structures, stale output, and unexpected manifest or loader mappings fail validation.
- Translation bundles remain source inputs and are never modified by the generator.
- Service-worker candidate and ready caches, offline translation serving, promotion, and update behavior were deferred to Phase 2B.

## Phase 2B service-worker translation cache protocol

Phase 2B adds worker-side candidate and ready caches without connecting them to Reader, Search, or Compare yet.

- `god4-bible-candidates-v1` stores only responses that pass the fixed allowlist, status, redirect, JavaScript MIME, decoded byte-length, and SHA-256 checks.
- `god4-bible-ready-v1` stores explicitly promoted payloads and the active-revision metadata response.
- Candidate keys use `/__god4/bible-cache/candidate/<id>/<revision>`.
- Ready keys use `/__god4/bible-cache/ready/<id>/<revision>`.
- Active metadata keys use `/__god4/bible-cache/active/<id>`.

The active revision is a small JSON response in the ready Cache Storage cache. It records the trusted manifest `id`, `revision`, `path`, `integrity`, decoded `bytes`, and structural metadata for the promoted payload, and survives worker restarts without adding IndexedDB. The worker ignores caller-supplied metadata. This lets an older last-known-good revision validate against its own persisted structure after the current manifest changes.

Promotion writes the new ready payload first and the active metadata second. The active metadata write is the commit point. A failure before that point preserves the previous active revision and rolls back the new ready payload when needed. Candidate deletion and obsolete ready-payload deletion happen after commit as best-effort cleanup; a cleanup failure can leave an inert extra cache entry but does not change the new active revision or report the committed promotion as failed. Candidates are never promoted automatically.

The worker accepts only fixed acquire, promote, and status messages. Acquire and promote operations accept a translation ID and the current approved revision. URLs, request methods, and headers supplied by a caller are ignored. The worker constructs the same-origin request from the generated manifest.

The existing page loader remains unchanged in Phase 2B. Normal translation requests remain network-only and no Bible cache is created during application-shell installation. Loader integration, offline Reader/Search/Compare behavior, and user-facing offline availability belong to Phase 2C.

## Phase 2C loader integration

The translation loader asks the controlling service worker for status and acquisition using only an approved translation ID and revision. A verified current candidate is executed from the approved translation URL with its manifest SRI value and is promoted only after `BibleData.validateTranslation()` succeeds. The worker can serve an active ready payload only through `/__god4/bible-cache/active-script/<id>/<revision>.js`, after matching and revalidating its worker-owned active metadata.

When current acquisition is unavailable, a validated active revision is the offline fallback for Reader, Search, and Compare. Missing offline translations fail without changing visible content and can be retried after reconnection. An uncontrolled first page loads the approved current URL with SRI for immediate reading; retention begins on a later controlled load so the first visit does not download the same bundle twice. User-facing download and storage-management controls remain deferred.

## Phase 2D-A translation management protocol

Phase 2D-A adds protocol and loader foundations for later user-facing management without adding controls or automatic downloads.

- `BIBLE_TRANSLATION_LIST` returns the eight fixed manifest translations in manifest order. Each item contains the worker-derived current revision and byte length, validated active metadata when available, and a `not-retained`, `current`, or `update-available` state. Listing never opens Bible caches or downloads a translation.
- `BIBLE_TRANSLATION_REMOVE` accepts only an approved translation ID. Deleting its active metadata pointer is the removal commit point. Candidate and ready payloads for that exact ID are then removed through structurally parsed synthetic keys. Cleanup failures can leave inert bytes and are returned as deterministic warnings; they cannot reactivate a removed payload or affect another translation or the shell cache.
- `BibleTranslationLoader.retain(id)` provides a deduplicated, retryable explicit-retention API. It uses the existing status, acquire, SRI execution, structural validation, and promotion sequence, returns a structured result, and leaves `ensure(id)` behavior unchanged.

The shell cache is `god4-shell-c089a89-phase2da1`. A new cache name is required because the shell-cached translation loader changed. This keeps the new loader paired with the new worker protocol while the previous active worker continues serving its existing cache until the visitor explicitly activates the waiting update.

Browser storage estimates and user-facing Offline Bibles controls remain deferred to Phase 2D-B.

## Phase 2D-B Offline Bibles controls

Phase 2D-B adds an **Offline Bibles** button to the Study Desk and an accessible native dialog for explicitly retaining, updating, and removing individual translations. Opening the dialog performs only `BIBLE_TRANSLATION_LIST`; it never downloads a translation or creates a Bible cache. Download and update actions use `BibleTranslationLoader.retain(id)`, while removal uses the worker-owned `BIBLE_TRANSLATION_REMOVE` operation.

The dialog reports exact retained Bible bytes by summing validated `active.bytes` values returned by LIST. A separate `navigator.storage.estimate()` value describes approximate origin-wide browser storage when that API is available. Page code does not inspect Cache Storage. Download and update actions are disabled while offline, removal remains available, and reconnection never starts an operation automatically.

The dialog uses native modal behavior, explicit focus containment, heading focus on open, trigger focus restoration, per-row busy states, and polite status announcements. An older controlling worker receives no automatic activation or reload; the dialog asks the visitor to apply the pending app update through the existing update control.

The Phase 2D-B shell cache is `god4-shell-c089a89-phase2db1`. It adds `/js/pwa/offline-translations.js` and keeps the existing explicit `ACTIVATE_UPDATE` lifecycle.

## Word Study runtime loading: shell 25 → 26

Shell 26 keeps all six `/js/word-study/` runtime files and adds
`/js/word-study/loader.js`. Homepage references now load only the loader; first
Reader word activation loads the six classic scripts in their existing order.
Installation still downloads and caches them. Document startup deferral must not
be described as eliminating Word Study shell-installation requests.

The shell has 41 assets / 452,280 Windows checkout bytes. Translation cache names,
translation acquisition, Supabase vendor runtime-cache/migration rules, callback
exclusions and waiting-worker acceptance remain unchanged. Shell 25 is cleaned
through the normal old-shell path after activation; existing shell-24 vendor
migration and failure retention still apply.

After online installation and worker control, a first-ever offline Word Study
activation can load its complete JavaScript runtime from the shell and render
local fallback notes. Dictionary and original-language JSON is neither precached
nor runtime-cached by this change. Warm in-page lookup data remains memoized;
offline reload does not guarantee dictionary or original-language data. Loader
failure/retry and Close/Escape/focus restoration use the existing accessible panel.

## Compare runtime loading: shell 26 -> 27

Shell 27 adds /js/bible/compare-loader.js and retains /js/bible/compare.js, bringing the precache to 42 assets. The document executes only the loader until Compare-tab or edition-count activation. Installation still downloads both files; this is startup execution deferral, not shell-installation savings. Translation/auth cache names and protocols stay unchanged. Cold offline runtime loading, warm use, and reload use the existing retained-translation contract. See [Compare runtime loading](compare-lazy-loading.md) for readiness, APIs, cancellation and measurements.

## Premium voice profiles: shell 27 → 28

The eager Speech/cloud and Reader integration change requires one shell bump to compact-reader-28. Both runtimes remain precached; translation caches and the Supabase vendor cache stay unchanged. Accept the waiting update and reload for coherent new controls/runtime. Generated speech audio is not retained in browser shell caches.

## Offline Bibles runtime loading: shell 28 -> 29

Shell 29 replaces the document's eager offline-translations.js reference with
offline-translations-loader.js. Both classic scripts remain in the 43-asset
shell precache. Installation still downloads the runtime even if the visitor
never opens Offline Bibles; this change defers document startup work, not shell
installation bytes. Translation and auth-vendor cache names, worker protocol,
timeouts, validation/promotion behavior, and explicit waiting-update acceptance
are unchanged. Accept the waiting update and reload for a coherent shell.

Only activation of the Study Desk Offline Bibles button loads the runtime.
Native click, Enter, Space, and programmatic click share one handler. Hover,
focus, Reader visibility, translation selection, connectivity, and PWA status
do not load it. The facade opens the existing modal immediately, focuses its
heading, and provides a polite loading status with aria-busy. Native modal
containment and Close/Escape work before readiness; the existing explicit Tab
loop becomes available with the runtime. No markup, CSS, or CSP redesign is
required.

OfflineBiblesLoader.ensure() shares one retryable promise. It inserts a
same-origin external classic script, validates OfflineBiblesRuntime.version
and its initialize()/openFromTrigger() methods, and initializes once.
initialize() returns true on readiness and remains idempotent. The facade owns
modal opening, dismissal, expanded/busy state, and trigger-focus restoration;
openFromTrigger() populates an already-open dialog without reopening or focusing
it. Catalog/action helpers remain private. Failed scripts are removed and
readiness resets. Closing and reactivating retries; a valid loaded API survives
a temporary initialization failure. No worker-message bridge is needed.

An activation generation prevents dismissed or superseded readiness from
reopening the dialog or moving focus. A separate dialog generation and LIST
refresh version prevent stale responses and old action announcements from
overwriting a newer session. Download/removal operations continue after close;
completion clears busy state and can refresh a currently open catalog without
announcing an older session's outcome. A successful current LIST also settles
an outstanding checking status, including when action refresh supersedes the
opening request. Catalog rebuild preserves the focused translation action when
enabled, otherwise focuses the stable Close button with preventScroll. Hidden
catalog refresh never redirects focus.

Lazy connectivity handlers read current navigator.onLine and do not replay
historical events. Retained-state inspection still uses LIST; it does not
download translations. Older/unsupported worker LIST responses retain the
existing app-update message without automatic worker activation or reload.
BibleData.listTranslations(), BibleTranslationLoader.isLoaded(), ensure(), and
retain() keep their synchronous/promise/result contracts.

Cold offline contract: after successful installation, a user who has never
opened Offline Bibles online can reload offline and activate it for the first
time. The facade and runtime load from the shell, and LIST inspects retained
state without a runtime network dependency. Retained reading and removal
semantics remain unchanged; installation alone still does not retain a Bible.

### Local measurements and validation

Measured against main 40934bbbf181e44addf6283cbb02933b740fefb8 using Chromium
151.0.7922.34. Decode measurements normalize CRLF to the deployed LF
representation; cold transfer measurements use identical local gzip settings.
These local compressed sizes are not claimed as deployed Cloudflare sizes.

| Item | Checkout bytes | LF decoded bytes | Gzip body bytes | Cold transfer bytes |
| --- | ---: | ---: | ---: | ---: |
| Previous eager UI | 11,652 | 11,363 | 3,142 | 3,442 |
| Current lazy runtime | 12,363 | 12,068 | 3,352 | 3,652 |
| Eager facade | 3,081 | 3,008 | 982 | 1,282 |

Eager external application script count stays 19: the facade replaces one
reference. Net eager JavaScript reduction is 8355 decoded bytes
and 2160 matched cold-transfer bytes. The HTML reference grows by seven bytes.
The facade exceeds the audit's 1-2 KiB planning range; report its actual size.
Total installed shell bytes grow because both scripts remain precached and the
runtime includes the focused accessibility/race fixes.

Twenty-load median top-level evaluation was 0.0420 ms before and
0.0265 ms for the facade after. This tiny CPU delta is timing noise
scale; the meaningful measured benefit is fewer eager bytes.

Five-sample first activation medians (milliseconds from click):

| Runtime source | Runtime ready | Catalog settled |
| --- | ---: | ---: |
| Local network | 11.5 | 11.9 |
| HTTP cache | 4.3 | 4.5 |
| Service-worker cache, offline | 13.5 | 22.7 |

These include immediate modal layout/focus and runtime initialization. The
uncontrolled network/HTTP-cache fixture settles into the existing unsupported
worker state; the offline worker fixture performs real LIST inspection. Local
desktop timings do not predict WAN or mobile performance. The prior production
baseline was 3,518 transfer bytes; new deployed transfer size requires preview
verification.

Focused validation covers eager request exclusion, all activation modes,
shared readiness/idempotent initialization, invalid API/network failures,
partial initialization retry, Close/Escape before readiness, rapid activation,
current connectivity, stale LIST/action overlap, duplicate/busy actions,
focus preservation, enforcing unchanged CSP, narrow reflow, first-ever offline
activation, and real waiting-worker 28->29 acceptance with retained Bible and
vendor cache preservation. Existing management, translation loader/protocol,
manifest, PWA, compact Reader, reflow, CSP, auth, Compare, Word Study, and empty
verse suites pass after shell membership/byte-accounting expectations are
updated. No translation-loader, protocol, PWA registration, Speech, Compare,
Word Study, styles, or _headers production logic changed.
