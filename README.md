# god4-website
Bible website

## Automated testing

This project has a small Playwright safety net for the existing static site. Run
`npm test` to check local CSS/JavaScript references and JavaScript syntax, then
run browser tests against a temporary local web server.

The browser tests protect the homepage, navigation, hero verse rotation,
save/tray behavior, search, reader controls, highlighting, fullscreen,
translation comparison, reading-plan progress, and switching between study
views. They also fail on browser console errors and page errors encountered
during the homepage check.

This foundation does not yet cover every responsive layout, accessibility
criterion, external resource, or future persistence/API behavior.

## Phase 1 foundation and workflow

GOD4.us remains a static site served from `index.html`. Presentation is split
across the CSS files in `css/`, while the Bible library and companion behavior
are separated into the plain JavaScript files in `js/bible/`; general homepage
behavior lives in `js/app.js`. No framework or build step is required.

Development work starts from `development` on a feature branch. Changes are
validated with `npm test`, reviewed in a pull request targeting `development`,
and checked in a Cloudflare Preview deployment before production review.
The `main` branch is reserved for production and is not used for experimental
work.
