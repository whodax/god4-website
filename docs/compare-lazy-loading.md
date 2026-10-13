# Compare runtime loading

Main 9a5baee2 eagerly loaded compare.js (17,468 Windows checkout bytes / 17,063 LF decoded bytes), initialized state and selectors, and bound 13 listeners even when Compare was unused. The new document loads compare-loader.js in that same script slot. Compare rendering, reference/navigation logic, edition selection, persistence, and translation loading remain in compare.js.

## Activation and API compatibility

Reader switchView activates CompareLoader after applying the active view and measured sticky stack. Native Compare click, Enter, and Space use the same button listener. The eager loader also delegates native edition-count button clicks, including Enter/Space-generated clicks while Reader remains active. Edition activation does not switch views.

The external-reference audit found app.js/reader.js calls to syncCompareDefaultTranslation, syncCompareFromReader, initializeCompareReference, loadCompare and scrollCompareStartIntoView, plus a direct setCompareEditionCount test. The eager facade preserves void returns for synchronous commands and Promise<undefined> for loadCompare. Before readiness, count/render commands queue intent; reference/default synchronization does not populate hidden controls or capture startup state. Callers requiring comparison controls/helpers must await CompareLoader.ensure(). After readiness, all 35 original global helper functions remain exported with their existing return behavior; initializeCompare is now idempotent. State/reference/request counters are encapsulated by CompareRuntime rather than eager global lexical bindings. No external consumer of those private bindings was found.

## Readiness and current intent

One shared promise loads the fixed same-origin classic script, validates version 1 and its expected API, and initializes the runtime once. The runtime owns all business logic. A failed script is removed, the promise is reset, and later Compare/edition activation retries. A valid runtime is reused without reloading or rebinding. A separate polite live status next to the edition controls is available even when the Compare view is hidden; active Compare also uses its existing summary. No existing Compare HTML markup or CSS changes.

Requests replace the pending intent. Leaving a view cancels readiness replay and clears its status without affecting unrelated Reader controls or moving focus. Returning to Compare creates a new current intent. Runtime loading may complete after cancellation, but it cannot reopen or scroll the canceled view. Queued edition choice is retained for a later valid activation.

Reader changeTranslation still returns Promise<boolean>; it records its existing commit operation as readerTranslationTask. Initial Compare readiness waits for current/replacement translation commits and normal Bible experience readiness before using current Reader coordinates and committed translation. No translation snapshots from startup are replayed. Existing BibleTranslationLoader promises, validation, retry, retention and unavailable-column messaging are unchanged.

Once activated, edition changes preserve the independently navigated Compare reference and selected slots. Tab activation hands off the current Reader reference. Existing comparison request counters still reject replaced data loads. Already-started data loads may render columns while hidden, as intentionally covered by compare-sticky-overlap; the existing active-view scroll guard prevents scrolling Reader, and completion does not move focus.

## Offline, updates, CSP and SEO

Shell 27 retains compare.js and adds compare-loader.js: 42 shell assets. Installation still fetches Compare even though documents do not execute it until activation. Cold offline activation can load the runtime from this cache. Actual verses depend on loaded/retained translations, exactly as before; no dedicated Compare runtime cache or translation persistence was added. Warm use and offline reload retain the existing translation contract.

The cache bump is exactly compact-reader-26 -> compact-reader-27. Translation cache names, Supabase vendor cache/migration rules, worker message protocols, and explicit waiting-update acceptance remain unchanged. Accept the waiting update and reload for a coherent new HTML/loader/runtime pairing. An old controlling shell can supply the previous runtime without CompareRuntime; validation then exposes a retryable unavailable message. Normal update/reload is required before retrying against the new cache.

Both entries are external same-origin classic scripts under the unchanged _headers CSP. No inline script, eval, dynamic import, or new origin is required. Initial Scripture, metadata/canonical, landmarks, typography and layout remain unchanged; Compare columns are still interaction rendered.

## Measurements and validation

Both versions contain 19 eager application script tags because the loader replaces the runtime. Gross Compare deferral is 17,468 checkout / 17,063 decoded bytes. The eager loader and Reader integration must be subtracted; gross is not net. Measurements below are recorded after validation and distinguish source bytes, local transport and execution probes from production acceptance. No Lighthouse claim is made.

| Measurement | Main before | Lazy after |
|---|---:|---:|
| Eager application scripts | 19 | 19 |
| Eager checkout JS bytes (Windows CRLF) | 268,575 | 256,494 |
| Eager LF/decoded JS bytes | 260,788 | 248,998 |
| Local gzip Resource Timing transfer bytes | 63,527 | 61,511 |
| Local gzip encoded-body bytes | 57,827 | 55,811 |
| Compare entry median top-level evaluation, three local samples | 1.244 ms | 0.184 ms |

The loader is 5,225 checkout / 5,119 decoded bytes, with a local gzip body of 1,794 bytes (2,094 Resource Timing transfer bytes). Reader integration adds 162 checkout / 154 decoded bytes. Net startup reduction is therefore 12,081 checkout / 11,790 decoded bytes, about 4.5%; the controlled local gzip transfer reduction is 2,016 bytes. The deferred runtime is now 18,326 decoded bytes because it includes its namespace/API and explicit activation entry; it remains precached.

Compare-entry evaluation falls by about 1.060 ms in these samples. Aggregate eager-script evaluation is noisy: the three-sample median was 16.473 ms before and 18.319 ms after, with substantial Reader variation. These measurements do not establish an aggregate startup speedup or a Lighthouse/Core Web Vitals improvement.

One first-use sample per source on a temporary local gzip server measured readiness at 14.0 ms from localhost network, 17.0 ms from browser HTTP cache, and 16.8 ms from service-worker cache. Resource Timing confirmed network transfer for the first, zero transfer/cache delivery for the second, and zero transfer/worker cache delivery for the third. These are desktop local samples, not production/mobile latency estimates; their ordering reflects small-sample noise.

First two-column render was 254.2 ms and 239.9 ms for the online network/HTTP-cache samples, including first ASV acquisition and execution. The cold shell-cache offline sample rendered in 35.1 ms with retained WEB and the existing unavailable-ASV message; it is not equivalent to rendering two available online editions. Production baseline Compare transfer was 4,345 bytes in the preceding current-main audit. After-change Cloudflare transfer and hosted acceptance require a separately authorized preview deployment.

### Final validation record

All 882 distinct Playwright cases have passing results across completed runs; this was not one uninterrupted green full-suite run. The broad serial run ended during case 793 after 792 completed cases (790 passed, two failed). The failures were an Account page crash and a recorded ERR_INSUFFICIENT_RESOURCES fetching the unchanged Word Study controller. Completing/rerunning Account, Compare loader, and the four Word Study suites produced 169/170 passing cases; the immediate-before-Reader Compare case timed out and its diagnostic page evaluation also stalled, without a confirmed cause. A subsequent complete Compare-loader rerun passed 32/32 with unchanged assertions.

Earlier runs: existing Compare coverage passed 44/44 serial after a two-worker process exhausted resources; focused regression coverage passed 139/142 initially (two Compare rendering timeouts and a worker crash), then all affected cases passed in later complete suite reruns. Compare-loader plus auth-vendor coverage passed 70/70. An initial new-test run passed 30/32; one failure was a Reader-startup timeout, and the other was a headers comparison that incorrectly treated Git LF and Windows CRLF as different CSP. Only that line-ending comparison was corrected. These intermittent timeouts remain a validation limitation and are not all attributed to resource exhaustion.

Standalone units passed 263/263. Reading-journey coverage verified 260 contiguous chapters across five plans. JavaScript syntax, 32 asset references, 19 eager script files, three manifest icons, the service worker and eight generated translation metadata sets passed validation. git diff --check passed, and protected production headers, styles, auth/storage, Word Study, translation loaders/cache protocol and data had no diff. No push, PR or deployment was performed.
