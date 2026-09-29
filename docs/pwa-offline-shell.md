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

Same-origin navigations use the network first. The cached homepage is used for the canonical home route when the network is unavailable, and other failed navigations receive `offline.html`. Authentication callbacks always try the network and may receive only the generic offline page when unreachable.

Each release uses a new cache name. A newly installed worker waits while the current worker and page remain active. The page announces that an update is ready and activates it only after the visitor selects **Update when ready**. No reading session is reloaded automatically.

## Phase 1 limitations

- Bible translations are not stored for offline reading yet.
- Search, Reader, and Compare require a translation response unless the browser happens to have one in its ordinary HTTP cache.
- Google Fonts are not part of the same-origin shell cache, so an offline launch may use the existing metric-adjusted fallbacks.
- Account operations and password recovery require a connection.
