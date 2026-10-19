# Post-release Word Study hardening

Baseline: main at `296d23908fa4c1186db3ed01ee27ab71bc22b7d1`.

## Scroll overlap

The opaque sticky verse-context block remained stationary while unfocused token
rows scrolled below it. Production measurements reproduced 29.4375px of overlap
for desktop WEB John 1:1 and 29px for 320px fullscreen KJV Isaiah 1:1. Button
centers hit the context text, not the underlying buttons. Focus clearance alone
could not protect unfocused rows.

The context now remains in normal flow with the token rows. Its reference,
excerpt, Original Language heading and alignment status remain in the same panel.
The excerpt can scroll offscreen; maintaining a stationary excerpt while words
scroll underneath it was the source of this defect. The sticky Close header,
short-viewport header unpinning, keyboard handling and focus-return behavior are
unchanged. No extra padding, fixed-height content area or nested scroll container
is introduced. Existing typography, colors and touch-target sizes are preserved.
The page or fullscreen Reader remains the only scrolling surface. Shell cache 42
refreshes the CSS/controller without changing asset membership or Bible caches.

The delayed-definition regression also exposed native page scroll anchoring at
320px: a long definition changed document scrollY from 1971 to 6420. The panel
already excluded its own descendants from anchor selection, but the root could
still anchor to Reader content below it. A local A/B check reproduced the 4449px
jump with root overflow-anchor auto and measured zero jump with it disabled.
The existing fullscreen anchoring protection now also applies to the document
root, only while Word Study is visible. Closing the panel restores normal page
anchoring. No scroll-position reset or extra scrolling is used as a workaround.

The previous verse-context test required the excerpt to remain onscreen after
scrolling to the last word. That expectation was specific to the overlapping
sticky design. It now checks same-panel text preservation, normal-flow context,
full focused-token clearance and unchanged offsets after delayed definitions.
Its reduced-motion setting uses browser context options, as the runner does not
forward the old top-level fixture. Unfocused-row tests additionally inspect
geometry and corner hit targets after scrolling, rather than relying only on
button scrollWidth/scrollHeight, which do not detect another element covering it.

## Production CSP evidence and unresolved decision

Production responded with an enforcing `Content-Security-Policy` header, not a
report-only policy. The violation event had `disposition: enforce`,
`effectiveDirective: script-src-elem`, and `blockedURI: inline`. With no separate
script-src-elem directive, the applicable directive is:

```text
script-src 'self' https://static.cloudflareinsights.com
```

The blocked inline script has no nonce and is injected by Cloudflare, not present
in the repository HTML. It creates an invisible iframe, writes another inline
script containing `window.__CF$cv$params` with per-response ray/time values, then
loads `/cdn-cgi/challenge-platform/scripts/jsd/main.js`. The script observed on
2026-10-18 used ray `a4cb714d6f9237fa` and time `MTc5MjM2NzM5Nw==`.
That bootstrap was blocked before the challenge script was requested. Normal
Reader, translation, Hebrew/Greek lookup and keyboard flows still worked. The
effect on zone-side bot scoring/WAF rules cannot be established from the public
page and requires a read-only configuration review before remediation.

[Cloudflare's JavaScript Detections documentation](https://developers.cloudflare.com/cloudflare-challenges/challenge-types/javascript-detections/)
describes this CSP conflict and support for header-provided script nonces.
It also documents separate bot-rule enforcement; a failed detection is not proof
that an application request was blocked. The existing policy already permits
same-origin challenge script URLs, but does not authorize inline execution. A
fixed hash is unsuitable for the changing bootstrap. A static/reused nonce is
not an acceptable substitute for a cryptographically random per-response nonce.

No policy relaxation, `_headers` edit, Cloudflare setting change or deployment is
part of this hotfix. Do not add unsafe-inline, suppress console errors, disable
bot protections, or add a no-transform workaround. A nonce-compatible delivery
design needs approval and tests of HTML/CSP consistency, injection order, shared
caches, service-worker cached HTML and all dependent frame/script directives.
This issue remains unresolved pending that review and explicit approval.

## Files and validation

All changes are unstaged on `fix/post-release-word-study-hardening`; HEAD remains
the merged baseline above. Production is unchanged. The 14 intended files are:

- `css/companion.css`
- `js/word-study/controller.js`
- `sw.js`
- `docs/word-study-alignment.md`
- `docs/post-release-word-study-hardening.md` (new)
- `tests/word-study-scroll.spec.js` (new)
- `tests/word-study-verse-context.spec.js`
- `tests/word-study-loader.spec.js`
- `tests/auth-loader.spec.js`
- `tests/auth-vendor-cache.spec.js`
- `tests/compare-loader.spec.js`
- `tests/offline-translation-management.spec.js`
- `tests/pwa.spec.js`
- `tests/reader-empty-verse.spec.js`

The seven cache-consumer files only follow the shell version bump, except the
Word Study loader file also checks the warm offline context's position and gap.

Each test file ran separately and sequentially, with one browser worker and zero
retries. Final complete runs, without double-counting diagnostic runs:

| Test file | Passed | Failed |
| --- | ---: | ---: |
| word-study-scroll.spec.js | 24 | 0 |
| word-study-verse-context.spec.js | 10 | 0 |
| word-study-compact.spec.js | 49 | 0 |
| word-study-sticky-close.spec.js | 40 | 0 |
| word-study-alignment.unit.js | 23 | 0 |
| word-study-reference-mapping.unit.js | 48 | 0 |
| isaiah-original-language-data.unit.js | 6 | 0 |
| word-study-alignment.spec.js | 34 | 0 |
| word-study-dra.spec.js | 15 | 0 |
| word-study-loader.spec.js | 42 | 0 |
| auth-loader.spec.js | 20 | 0 |
| auth-vendor-cache.spec.js | 38 | 0 |
| compare-loader.spec.js | 32 | 0 |
| offline-translation-management.spec.js | 12 | 0 |
| pwa.spec.js | 17 | 0 |
| reader-empty-verse.spec.js | 20 | 0 |
| csp-styles.spec.js | 5 | 0 |
| security-headers.spec.js | 3 | 0 |
| csp-report-only.spec.js (enforcing policy) | 8 | 0 |
| Total | 446 | 0 |

There were 77 unit and 369 browser tests, with no final skips or flakes. The
Isaiah regeneration case was deliberately excluded; Bible data was not generated.
The scroll matrix covers WEB John 1:1, KJV Isaiah 1:1/64:1 and DRA Isaias 1:1 at
1280px, 390px and 320px, both normal and fullscreen. All 72 unfocused-scroll
measurements retained exactly 4px context-to-first-row clearance, zero overlap,
and successful corner hit tests for visible buttons. The compact matrix retains
equivalent-reflow coverage, not a claim of native browser zoom certification.

All 66 raw Isaiah hashes and byte counts match the manifest, and all shards and
the publication manifest are byte-identical to HEAD. Asset validation passed
(34 references, 21 referenced JS checks, three manifest icons, service worker,
nine translations). Separate syntax checks passed for all 11 changed/new JS
files. Git diff --check passed, with only Git's future LF-to-CRLF warnings.

Diagnostic failures were investigated, not hidden: the new scroll test failed
on baseline with 128.4375px occlusion at its stronger scroll position; the first
verse-context run had eight passes, one anchoring failure and one not run before
the root anchoring fix. The initial sandboxed server startup stalled before any
test executed and was stopped, including its identified owned server. Completed
runs used local-server/browser access and bounded per-file timeouts. Full logs,
JSON, geometry attachments and screenshots are ignored under
`test-results/post-release-hardening/`; the baseline red log is
`test-results/post-release-hardening-before.log`.

No staging, commit, push, merge, deployment, Cloudflare setting change or CSP
relaxation was performed. The layout fix is local and the CSP issue remains open.
