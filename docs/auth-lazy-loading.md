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

Shell cache changes once, 23 → 24. All auth assets remain precached, including
the new loader. Cached scripts are not executed merely because they are cached;
Account activation can load them offline after installation. Local/unapproved
origins continue to report accounts unavailable. Offline does not guarantee a
successful server-dependent sign-in. Callback offline fallback is unchanged.

`_headers` is unchanged. Dynamic scripts are external, classic, same-origin
scripts permitted by the existing CSP. No inline script, eval, module conversion,
new cross-origin dependency, or Supabase project change was introduced.

## Measurements

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

Validation on this branch covered all 770 Playwright cases. The broad run passed
769; its new byte-measurement assertion needed a correction for Git versus
checkout line endings. The final loader rerun passed all 20 cases. An initial
focus test also needed to make Search visible before focusing its input. These
were corrected test assumptions, not flaky retries. Separate journey coverage
verified 260 contiguous chapters. Asset, syntax, inline-script and diff checks
passed.

## Changed files

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
