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
