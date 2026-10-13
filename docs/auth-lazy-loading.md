# Session-aware Account loading

Previously the homepage eagerly referenced config, Supabase vendor, provider,
auth service and Account UI. The homepage now eagerly retains config, the small
classic-script loader, and Account UI. Bible and local saved/planning features
remain independent of auth. `auth.js` business logic is unchanged.

## Readiness and session hints

`God4AuthLoader.ensure()` returns one shared readiness promise. It sequentially
loads same-origin external vendor, provider, and auth scripts, verifies each
required global, then awaits the existing idempotent auth initialization. Account
binds once before auth exists and subscribes to the ready service once.

Approved configuration explicitly supplies the existing pinned SDK storage key:

- Production: `sb-apkiqgxmfqohznxpqfcx-auth-token`
- Staging: `sb-ikzvyuvrvxemliirlfmn-auth-token`

The provider passes that key to `createClient` through `auth.storageKey`. Storage
presence is only a conservative loading hint: contents are neither parsed nor
logged, and only the SDK authenticates. A read exception starts eager restoration.
Relevant cross-tab storage appearance starts loading; disappearance does not
fabricate a sign-out. Existing SDK events remain authoritative. Ordinary anonymous
startup leaves the full stack absent until Account activation. Auth URL indicators
on normal pages also start loading to preserve SDK URL detection.

Returning users keep the neutral Account label until restoration finishes, with
no premature signed-out form. `/auth/callback/` retains its eager config → vendor
→ provider → auth → callback sequence. Callback URL cleanup, allowlists, errors,
focus and implicit flow are unchanged.

## Failure, focus and offline behavior

Network/script failure or a missing required global rejects readiness, removes
the failed script, and clears the retryable promise. A later Account activation
retries, reusing successful dependencies. A service restoration failure retains
the existing unavailable state and initialized client; reopening does not create
another client or reset subscriptions. Existing stale-result and logout fences
remain in the auth service.

Account opens immediately with an accessible status panel. Loading disables
auth actions while keeping Close and Escape available. Completion does not open
a dismissed dialog or move focus away from another page control. Enter, Space,
modal semantics, focus return and existing styling remain intact.

The initial lazy-auth change used shell cache 24 with all auth assets precached.
The vendor-only follow-up changes the shell once, 24 → 25, and removes only
`/js/vendor/supabase-js-2.117.0.min.js` from precache. Config, loader, Account UI,
provider, auth service, Account CSS, Bible and Word Study runtimes remain in the
shell. The loader, auth behavior and callback eager flow are unchanged.

## Vendor runtime cache and upgrade

The exact same-origin GET path, without a query string or Authorization header,
uses `god4-auth-vendor-supabase-js-2.117.0`. A valid cached copy is served first;
otherwise the worker fetches, validates and stores a clone. Concurrent fetches
share one worker request. Validation requires status 200, JavaScript MIME, no
redirect, the expected response origin/path, at least 200,000 body bytes and
the pinned SHA-256 digest after CRLF normalization. The worker neither parses
nor executes JavaScript. Changing the SDK requires updating path, cache name
and digest together.

Activation copies a valid vendor from shell cache 24 before normal old-shell
cleanup, without fetching the network. Invalid copies are not promoted. If
inspection or promotion fails, activation continues and retains cache 24 for
a later vendor request to retry promotion. That request can serve the valid old
copy even if persistence still fails. Shell and offline-page reads explicitly
use cache 25 so a retained migration source cannot supply older application code.
Successful later promotion removes the retained source. Cleanup preserves the
current vendor cache, removes older `god4-auth-vendor-*` versions and preserves
translation/unrelated caches. Storage cleanup failure is best effort.

Existing waiting-worker behavior remains: the visitor accepts Update, then the
accepting tab reloads. No `clients.claim()` or automatic `skipWaiting()` was added.
The fixed vendor version is compatible with both old and new auth loaders.

## Offline Account contract

A new cache-25 installation that never used Account or a session hint has no
vendor copy. Offline Account opens its accessible loading/unavailable state;
Close, Escape, focus return and reconnect retry remain available. This is an
intentional reduction in cold-offline Account availability.

On a worker-controlled page, online Account activation or returning-session
restoration warms the vendor cache. Later offline Account activation loads the
vendor there and provider/auth from the shell. An unexpired SDK-cached identity
may render; this is not proof of current server authorization. The initial page
before worker control does not populate this runtime cache; a controlled reload
is needed. Browser eviction or failed writes can also remove offline availability.
Local/unapproved origins still report accounts unavailable. Credential sign-in,
signup, confirmation, refresh and server revocation require network. Callback
offline fallback and private API exclusions are unchanged.

`_headers` is unchanged. Dynamic scripts are external, classic, same-origin
scripts permitted by the existing CSP. No inline script, eval, module conversion,
new cross-origin dependency, or Supabase project change was introduced.

## Measurements

The following homepage numbers describe the original lazy-auth change. The
vendor-only follow-up leaves homepage references and execution unchanged.

Repository sizes include checkout line endings:

| Homepage eager references | Before | After |
| --- | ---: | ---: |
| Script count | 26 | 24 |
| All JavaScript bytes | 525,982 | 299,455 |
| Auth-related bytes | 244,225 | 17,698 |

The loader is 3,338 bytes. Net eager reduction is 226,527 bytes (43.07%). The
218,180-byte vendor no longer appears in anonymous page script requests or
execution. Service-worker installation still downloads it in the background;
this phase does not reduce total installation traffic.

An isolated browser measurement used an uncompressed local HTTP server with
service workers blocked, baseline Git blobs and current checkout files:

| Resource Timing script totals | Before | After |
| --- | ---: | ---: |
| Transfer bytes | 524,936 | 306,655 |
| Encoded body bytes | 517,136 | 299,455 |
| Decoded body bytes | 517,136 | 299,455 |

Baseline Git blobs use LF, which explains their difference from checkout sizes.
These are local transfer measurements, not deployed compression results. The
prior production eager auth stack measured 63,759 transfer / 62,259 encoded /
243,573 decoded bytes. New deployed transfer sizes require a hosted preview.
No Lighthouse improvement is claimed.

At 390 × 844, delayed returning-user restoration produced identical baseline
and lazy layouts: Account width 77.5 → 158.328125 px and CLS contribution
0.002370049463297067. No additional measurable restoration shift was observed.

## Validation

`tests/auth-loader.spec.js` covers anonymous independence, early click/keyboard
activation, session hints, storage exceptions, cross-tab events, concurrency,
single client/subscription/UI binding, all three missing-global and network
failure stages, retries, restoration failure, dismissed-dialog focus, offline
cache execution, mobile baseline layout comparison and script byte measurement.
Existing auth, Account, callback, CSP, security, Reader, Search, Compare, plans,
Saved Verses and PWA suites remain regression coverage. Use a hosted preview
for final real-session, deployed-header and real-device acceptance before release.

## Vendor-only shell measurement and tests

On the Windows checkout, shell installation drops from 41 assets / 664,503 bytes
to 40 assets / 446,323 bytes: 218,180 bytes (32.83%). A local uncompressed HTTP
measurement reported 676,803 → 458,323 Resource Timing transfer bytes and
664,503 → 446,323 encoded/decoded body bytes for the shell fetches. These exclude
worker bootstrap/import requests and are not deployed compression measurements.
The prior production audit measured 55,861 encoded / 56,161 transfer bytes for
the vendor in that specific browser/cache context. No Lighthouse gain is claimed.

`tests/auth-vendor-cache.spec.js` covers exact shell membership, install failure
isolation, first-use/concurrent caching, cold failure/retry, response validation,
cache-24 migration without network, failed promotion/inspection, source retention,
obsolete-cache cleanup, private request exclusions, real worker cold/warm offline
Account, returning-session warming, synthetic SDK identity, one client/listener,
actual waiting/update acceptance with two tabs and install byte/request counts.

Vendor-only validation passed all 38 focused cases. The full regression run
covered 808 cases: 805 passed, with one renderer crash, one translation-startup
timeout and one aborted voice-profile reload. All 24 cases in the three affected
suites passed on a fresh rerun without changing code or expectations. These
non-reproducing full-run failures are recorded rather than hidden by retries.
Asset/syntax validation, 260-chapter journey coverage, scope and diff checks
passed. No hosted deployment or live credential-auth acceptance was performed.

Original lazy-auth validation covered all 770 Playwright cases. The broad run passed
769; its new byte-measurement assertion needed a correction for Git versus
checkout line endings. The final loader rerun passed all 20 cases. An initial
focus test also needed to make Search visible before focusing its input. These
were corrected test assumptions, not flaky retries. Separate journey coverage
verified 260 contiguous chapters. Asset, syntax, inline-script and diff checks
passed.

## Files in the original lazy-auth change

- `index.html`
- `js/auth/loader.js`
- `js/auth/config.js`
- `js/auth/supabase-provider.js`
- `js/auth/account-ui.js`
- `sw.js`
- `tests/auth-loader.spec.js`
- `tests/auth-config.spec.js`
- `tests/auth.spec.js`
- `tests/account.spec.js`
- `tests/csp-report-only.spec.js`
- `tests/pwa.spec.js`
- `tests/offline-translation-management.spec.js`
- `tests/reader-empty-verse.spec.js`
- `docs/auth-lazy-loading.md`

## Files in the vendor-only follow-up

- `sw.js`
- `tests/auth-vendor-cache.spec.js`
- `tests/auth-loader.spec.js`
- `tests/pwa.spec.js`
- `tests/offline-translation-management.spec.js`
- `tests/reader-empty-verse.spec.js`
- `docs/auth-lazy-loading.md`
