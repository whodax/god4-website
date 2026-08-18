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
