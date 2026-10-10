# Word Study sticky Close

The static Word Study header previously scrolled away with the document. On a
390px viewport the site navigation, Study Desk tabs, and Reader toolbar occupied
349px above it. The panel had no internal scrollbar; a long real definition
("upon", John 1:16) could extend well beyond the available viewport.

The existing `.word-study-header` now sticks within `#wordStudyPanel`, below the
shared measured navigation stack, with focus-ring clearance inside the header
rather than a gap that could expose clipped body text. It keeps its current
DOM position, typography, colors, and single semantic Close button. Its opaque
vellum background and z-index 10 place it above its body and below navigation.
The header remains in normal flow, preserving space at the start of the panel.
As text scrolls behind the header, its background prevents text showing through.
Content remains readable by scrolling; original-language token/detail scroll
targets include the measured header height and clearance in their scroll margins.

Normal desktop/mobile Reader continues to use document scrolling. Fullscreen
continues to use the Reader scroll container, and the header offset excludes the
outer site navigation and tabs there. Fullscreen content-target clearance also
includes the container's existing padding, measured rather than hard-coded.
The existing Reader ResizeObserver additionally observes Word Study header height;
there is no new scroll listener or focus/positioning callback.

CSS sticky containment stops the header at the panel bottom. Once the panel has
scrolled past, Close disappears with it instead of floating over Scripture. This
is intentionally scoped to reading Word Study content, not persistence everywhere
while the panel's hidden attribute remains false. No bounded Word Study scroll
region, duplicate control, or global floating UI was introduced.

Close retains the accessible name "Close Word Study", existing text, border,
colors, and focus outline, with a minimum 44x44 CSS-pixel target. Header padding
allows focus-ring clearance; the heading can wrap at narrow widths. Controller
and HTML are unchanged: loading/result heading focus, panel-scoped Escape,
click dismissal, connected-word focus restoration, and request-ID invalidation
remain intact.

`tests/word-study-sticky-close.spec.js` covers six result states across desktop
1280x900, mobile 390x844, narrow 320x844, and desktop/mobile fullscreen. It checks
real long content, independently measured sticky rectangles, Close hit testing,
button count/name/target, keyboard focus ring, click/touch, Escape, disconnected
activating words, content-target clearance, and the panel-bottom boundary.
Short result states use a scroll distance within their panel; long results use
600px. The 320 CSS-pixel viewport covers narrow reflow; headless tests do not
exercise browser-chrome 200% zoom or Android browser/safe-area behavior.

Shell cache changes once from `compact-reader-22` to `compact-reader-23` because
CSS and Reader JS are shell assets. Only matching cache expectations change;
service-worker behavior is otherwise unchanged. A new hosted preview and a real
phone check are required before release.

Validation: 178 combined browser checks passed (including all 40 new sticky-close
cases), followed by 263 unit tests. Reader
navigation, Search targets, Reader/Compare tab return and sticky clearance, stale
English/original-language results, fullscreen, CSP styles, offline rendering, and
shell 22-to-23 migration all passed. Initial development checks exposed inconsistent test starting offsets
after original-language selection and missing fullscreen content-scroll padding;
both were corrected before final validation. Desktop, 390px, and 320px long-result
screenshots were visually inspected. Asset validation, all 26 runtime JavaScript
syntax checks, explicit new-test syntax, computed CSS geometry/hit testing, and
`git diff --check` passed.

The existing God-sense Reader test intermittently failed because it manually
rendered a passage before `initializeBibleExperience()` finished. Focusing its
word exposed Study Desk to the lazy IntersectionObserver; initialization could
then render again and correctly invalidate the just-opened study. The test now
awaits initialization before its manual passage setup. Both king/God cases passed
three repetitions each after synchronization; no runtime controller changes or
longer assertion timeouts were needed. The complete existing Word Study selection
then passed all 61 checks with no retries. Final totals: 239 selected browser/test
checks (including 40 new cases), 263 unit tests, plus six repeated sense checks.
