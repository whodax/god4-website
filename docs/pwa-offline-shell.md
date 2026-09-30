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

The per-book structure is stored as `[bookId, chapterCount, verseCount]` tuples. Empty verse strings used by some editions to preserve canonical verse numbering are counted as verses. WEB Psalm 1 is currently represented by an existing empty chapter array and is recorded as such; the metadata workflow does not change Bible text.

`npm run test:validate` regenerates the expected manifest in memory and requires an exact match with the checked-in file. It also verifies that the loader's fixed mapping matches the generated allowlist. After an approved translation bundle changes, regenerate the manifest and review both changes together.

Phase 2A adds the metadata manifest to the existing shell because it is a small startup dependency. It does not place any Bible translation payload in Cache Storage and does not change translation request behavior.

### Generated manifest rules

- The generator reads only WEB, ASV, KJV, YLT, DBY, Webster, RV, and GNV from their fixed local paths.
- Missing bundles, duplicate IDs, invalid book/chapter/verse structures, stale output, and unexpected manifest or loader mappings fail validation.
- Translation bundles remain source inputs and are never modified by the generator.
- Service-worker candidate and ready caches, offline translation serving, promotion, and update behavior remain deferred to Phase 2B.
