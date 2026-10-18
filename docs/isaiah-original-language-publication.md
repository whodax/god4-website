# Complete Isaiah original-language publication candidate

**Release gate blocked:** the complete one-worker/no-retry Playwright run finished
with 1,190 passes, one failure and zero skips. Candidate files exist only in the
local working tree; no publication commit, push, deployment or PR was performed.

This candidate adds all 66 Isaiah chapter shards to the existing lazy Word Study
provider. No runtime JavaScript, UI, Reader/Compare layout, CSS, CSP, dependency,
trust-store or service-worker shell-cache changes are required. The provider
already requests `data/word-study/original-language/<book>/<chapter>.json` on
demand and caches repeated requests per chapter. No Cloudflare deployment or
preview is part of this milestone.

## Authoritative inputs

Both inputs were already supplied locally under
`C:/Users/whoda/OneDrive/Documents/GOD4-OriginalLanguage-Sources`. No source was
downloaded or substituted. Hashes identify exact local artifact bytes, including
checkout line endings and the lexical XML BOM.

| Input | Repository / revision | Artifact | SHA-256 |
| --- | --- | --- | --- |
| OSHB Isaiah | `https://github.com/openscriptures/morphhb` / `3d15126fb1ef74867fc1434be1942e837932691f` | `wlc/Isa.xml` | `ce039243b56e4de55b85a635f17343fe9cac7176123fbde5f72af623f9c8f0a5` |
| Reviewed Hebrew XML | `https://github.com/openscriptures/strongs` / `0acd2f251c2d35ff8db2dece4e0593979d3ac223` | `hebrew/StrongHebrewG.xml` | `f5a0258d39e9ae37edab27feba5301ff7db540a424e28a41a7af57b8ba5058f2` |

OSHB annotations are CC BY 4.0; WLC text is public domain. The exact OSHB original
work attribution, edition identities and lexical credits appear on every record.
The Hebrew XML's Strong component declares public domain and credits James
Strong (1894), David Instone-Brewer and David Troidl. This is a field-scoped
decision, not a public-domain claim for the entire XML. See the
[retained-evidence lexical review](hebrew-xml-lexical-provenance.md).

`strongs-hebrew-xml-subset` accepts only these direct entry fields:

| Record field | XML selector |
| --- | --- |
| `strongsNumber` | `w/@ID` |
| `lemma` | `w/@lemma` |
| `transliteration` | `w/@xlit` |
| `pronunciation` | `w/@POS` |
| `definition` | `note[@type='explanation']` text and plain `hi` text |

TWOT-linked glosses, numbered lists, Greek references, derivation/translation
notes and editorial annotations are excluded. **DAT was not used for publication**;
the publication tool does not open it or offer a fallback. The earlier
[DAT/XML comparison](isaiah-lexical-comparison.json) remains historical evidence,
not an input. Numeric-ID words use the reviewed lexical headword; original OSHB
lemma annotations remain in generation diagnostics. The 310 grammatical words
without numeric Strong's IDs retain their OSHB lemmas and null lexical fields.
Morphology, surface and contextual Hebrew/Aramaic classification come from OSHB;
no English-word alignment is invented and the 15-field contract is unchanged.

## Mapping and apparatus policy

All 1,291 source verse coordinates map to all 1,292 canonical KJV Reader verses.
All 33 inline source KJV annotations were cross-checked. Exceptions:

| Source | Reader target |
| --- | --- |
| 8:23 | 9:1 |
| 9:1–20 | 9:2–21 |
| 63:19 source token indexes 0–8 | 63:19 indexes 0–8 |
| 63:19 source token indexes 9–15 | 64:1 indexes 0–6 |
| 64:1–11 | 64:2–12 |
| All other source coordinates | Identity |

The authoritative parser excludes `note`/`rdg` apparatus before indexing running
words: 53 word-bearing variant blocks containing 56 alternate words. It retains
the main-text ketiv words. The 63:19 / 64:1 split yields nine/seven words; the first
64:1 word is `לוּא`. Mapping, source extraction and lexical adapter behavior were
not changed for publication.

## Staging, manifest and production gate

`tools/publish-isaiah-original-language.js` first validates pinned inputs and all
complete-book invariants, then uses a copy of the reviewed configuration with
publication enabled for the existing guarded writer. `isaiahBookConfig()` remains
the disabled read-only configuration, preserving historical dry checks. No
publication guard is bypassed or weakened.

Two independent parses/generations write to fresh `run-1/isaiah` and
`run-2/isaiah` directories outside production. Both have exactly 66 numerically
ordered chapters and identical bytes, fingerprints, records, lexical values and
attribution. Before copying, the publication tool regenerates expected bytes
from pinned inputs again, verifies both stages and their manifest, and refuses
an existing destination. A copy error rolls back only its freshly created Isaiah
directory. Tests corrupt a staged shard and verify that copying is blocked before
a destination is created.

The [publication manifest](isaiah-original-language-publication-manifest.json)
records source proof, mapping, attribution, totals and all 66 chapter entries:
chapter, relative filename, byte size, SHA-256, record count and verse count.
`.gitattributes` preserves the Isaiah JSON bytes across Windows/Unix checkouts.
Each shard is UTF-8 JSON with LF and a final newline, using the generic writer's
existing format.

| Publication total | Value |
| --- | ---: |
| Chapter files | 66 |
| Bytes | 18,894,839 |
| Running-text tokens | 16,932 |
| Canonical Reader verses | 1,292 |
| Hebrew / Aramaic tokens | 16,932 / 0 |
| Excluded apparatus blocks / alternate words | 53 / 56 |
| Distinct numeric Strong's IDs | 2,443 |
| Numeric join failures / missing selected lexical fields | 0 / 0 |
| Missing / colliding Reader targets | 0 / 0 |

## Reproduction and rollback

Use a new staging root on each run, with the already-local source package at its
recorded location or `GOD4_ORIGINAL_LANGUAGE_SOURCES` pointing to it:

```powershell
node tools/publish-isaiah-original-language.js stage ../fresh-isaiah-candidate
node tools/publish-isaiah-original-language.js check ../fresh-isaiah-candidate
node --test tests/isaiah-original-language-data.unit.js
```

The data tests generate fresh independent stages and compare every chapter with
the committed production bytes and manifest. The explicit `publish` action is
for a reviewed candidate before its destination exists; it refuses overwrites.
It is not needed to verify an existing publication.

Rollback is a normal revert of this publication commit, removing all 66 Isaiah
shards, restoring the prior test/documentation state and the attributes entry.
There are no runtime-code, dependency or cache migrations to reverse. Existing
open Word Study sessions may retain an already fetched chapter in memory until
reload, consistent with the existing provider's cache behavior.

## Validation

Pre-publication staging: 147 unit tests passed with zero failures/skips, including
all seven Isaiah data/gate cases and the existing importer, adapter, mapping,
Genesis/John/Romans regression suites. Asset validation passed before copying.

Final post-copy results:

| Required check | Passed | Failed | Skipped |
| --- | ---: | ---: | ---: |
| Nine importer/adapter/Isaiah/existing-book/reference-mapping unit files | 147 | 0 | 0 |
| Eleven focused browser/PWA/offline files | 246 | 0 | 0 |
| General Word Study acceptance, including John Greek | 22 | 0 | 0 |
| Complete Playwright, one worker, retries disabled | 1,190 | 1 | 0 |
| Remaining failed case, isolated 20 times without retries | 20 | 0 | 0 |

Asset validation passed serially: 34 references, 21 JavaScript syntax checks,
three icons, PWA service worker and metadata for nine translations. Explicit
syntax checks passed for all six added/changed JavaScript files. All 66 production
candidate shards match both staging runs and their manifest SHA-256 values.

The full-suite blocker is the existing `tests/word-study-loader.spec.js` case
`/js/word-study/original-language-provider.js network is accessible and retry
reuses successful partial dependencies`. Its `open()` setup found an empty
`#readerContent` instead of John 1, before Word Study fault injection was exercised
or any Isaiah shard was requested. It subsequently passed 20/20 isolated runs;
that does not convert the failed complete suite into a passing gate. No safe
scoped fix or production defect was established, and the test was not changed.

An earlier full attempt was interrupted after four other failures while Windows
had about 0.4 GB of commit headroom and a concurrent Node syntax check reported
`VirtualAlloc failed`. Those four cases passed 12/12 isolated executions and all
passed in the completed full run. Asset validation then passed serially. Memory
pressure is evidence of an environmental contribution, not proof of the final
startup failure's cause. No retries, timeouts, assertions, CSP or browser security
settings were weakened to obtain these results.

The completed JSON report and retained failure context are local review artifacts
at `../isaiah-validation/isaiah-publication-full-playwright-final.json` and
`../isaiah-validation/full-run-word-study-startup-failure.md`. The two original
staging runs remain at `../isaiah-publication-candidate-c61fbaf`. Publication may
be committed/pushed only after the complete required suite passes with zero
failures and zero skips; a passing isolated rerun is insufficient.

## Follow-up startup investigation

The complete Word Study loader file was repeated three times with one worker,
retries disabled, and failure tracing: **126 passed, zero failed, zero skipped**.
No loader test or application code was changed. This does not clear the failed
complete-suite gate or establish the original startup failure's root cause.

A subsequent full-suite diagnostic run with `--trace=retain-on-failure` was
interrupted after three existing Catholic test failures during translation
startup: Compare Daniel 13:65, picker/fullscreen/reflow at 390px, and native
narration Wisdom. These failed before their feature assertions. At that point
Windows reported 741,524 KB free physical memory and 410,404 KB free virtual
memory (commit headroom). Traces show HTTP 200 local WEB translation responses,
with startup remaining incomplete; no explicit network or JavaScript error
identifies a code defect. Memory pressure is a demonstrated constraint, not a
proven explanation of the earlier Word Study failure. No sleeps, retries,
timeout increases, security changes, or assertion changes were introduced.

The diagnostic run is incomplete and is not counted as a passing regression run.
The last completed full-suite result remains **1,190 passed, one failed, zero
skipped**. Three failure traces and contexts are retained locally under
`../isaiah-validation/traced-startup-failures/`. A clean, complete one-worker,
zero-retry run is still required before commit or push.

## Exact change manifest

The 66 added data files are `data/word-study/original-language/isaiah/1.json`
through `66.json`; every exact path and fingerprint appears in the publication
manifest. The ten supporting added/modified files are:

```text
.gitattributes
docs/original-language-import.md
docs/isaiah-original-language-publication.md
docs/isaiah-original-language-publication-manifest.json
tools/publish-isaiah-original-language.js
tests/isaiah-original-language-data.unit.js
tests/isaiah-original-language.spec.js
tests/isaiah-original-language-validation.unit.js
tests/original-language-importer.unit.js
tests/romans-original-language.spec.js
```
