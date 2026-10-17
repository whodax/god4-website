# Browser test stability after the Catholic Bible releases

## Raw-touch mobile tab return

The mobile test read the Reader button's coordinates after checking that Compare
was active and waiting for two animation frames. Compare activation also loads
translation data asynchronously and positions the finished comparison. Its active
class, and even `aria-busy="false"`, precede that final render and scroll. A trace
captured the Reader button at a center Y of 216px before the tabs moved upward;
the subsequent touch hit `offlineBiblesTrigger` instead of Reader.

The test now records the promise returned by the real `CompareLoader.activate`
call and awaits its completion before sampling the return-tab coordinates. It
still uses raw touchscreen input, checks hit testing and viewport reachability,
and asserts the selected verse or previous anchor after returning. The additional
regression holds Compare's ASV readiness behind an explicit promise and verifies
that the helper remains pending until rendering and positioning complete. No
application navigation, scroll, focus, or layout behavior changed.

## Scripture Picker CSP server teardown

The Picker navigation, focus, and policy assertions completed, but moving the page
to `about:blank` did not close every browser-owned connection. An instrumented run
found a TCP socket with zero bytes received and no HTTP request while
`server.close()` remained pending. Idle HTTP keep-alive cleanup cannot be relied
on to close a speculative connection that has never sent a request. Both an unused
TCP connection and an incomplete HTTP header block reproduce the shutdown timeout
without browser timing dependencies.

The test owns a dedicated browser context and closes it before closing the server,
with nested cleanup so server shutdown still runs if context cleanup fails. The
shared test server stops accepting connections, destroys its tracked sockets, and
awaits the server close callback. Closing is idempotent. File streams are released
when their responses close, and stream errors terminate their responses. Forced
connection shutdown is confined to explicit test teardown, after assertions; it
does not suppress assertion failures or change served content or headers.

## Validation

Reproduction on the unchanged baseline (`06b3a2d`):

- Both original suites, five repetitions: **113 passed, 2 failed** (mobile return).
- Instrumented mobile failure, fifteen repetitions: **11 passed, 4 failed**;
  event targets showed the stale-coordinate touch reaching the wrong control.
- Instrumented Picker flow, ten runs: one shutdown retained an unused TCP socket;
  destroying that socket released the close callback.
- Deterministic server lifecycle regressions against the original helper:
  **0 passed, 2 failed**, both at the existing 30-second test timeout.

The first implementation run passed all 120 mobile/Picker repetitions and all
five unused-connection checks. The five incomplete-request checks initially
reported Windows `ECONNRESET` after successful forced shutdown. The regression now
observes socket closure separately and permits only that expected reset; every
other socket error still fails. The complete focused rerun passed **130/130**
with **0 failed, 0 skipped, and 0 retries**.

The related Reader, Compare, sticky controls, fullscreen, Catholic Bible and
labeling, Scripture Picker, CSP, and security-header suites passed **387/387**
with **0 failed and 0 skipped**, using one worker and no retries. Asset validation
passed: 34 asset references, 21 JavaScript syntax checks, 3 manifest icons, the
service worker, and generated metadata for all 9 translations.

The complete Playwright regression run passed **1,180/1,180** in 17.5 minutes
with **0 failed, 0 skipped, and 0 retries**, using one worker.

Run the focused repetitions with the existing timeouts and no retries:

```sh
npx playwright test tests/reader-mobile-sticky-tabs.spec.js tests/scripture-picker.spec.js tests/csp-server-lifecycle.spec.js --workers=1 --repeat-each=5 --retries=0
```

Run asset validation and the complete regression suite:

```sh
npm run test:validate
npx playwright test --workers=1 --retries=0
```

No dependencies, CSP directives, browser security options, trust stores, production
scripts, styles, or layout assets were changed. No fixed sleeps or timeout
increases were added.
