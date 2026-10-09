# WEB Psalms data repair

Baseline: `be2c768f35c4951f9ca9f6ddd3bedeab2cf4f784` (includes PR #83).
Branch: `fix/web-psalms-data-repair`.

## Defect and repair

`webLibrary.psalms` had 151 numeric chapter properties and `chapters:151`.
Chapter 1 had an empty `verses` array; stored chapters 2–151 contained real
Psalms 1–150. Each chapter retains the existing title and subtitle. Verse
numbers are implicit: array offset zero is verse 1.

The stored strings omitted poetry continuation paragraphs after the final
numbered verse marker in 147 Psalms. Only Psalms 35, 72, and 130 already had
complete final verses. For example, Psalm 1:6 omitted “but the way of the
wicked shall perish.” Psalm 150:6 omitted its closing “Praise the LORD!”
The repair parses explicit chapter labels and numbered source verse markers,
including every continuation through the footer navigation boundary. Notes
and popup note text are excluded. Psalm 119 alphabet headings retain their
existing placement in the preceding verse string; no existing nonfinal text
is normalized or rewritten.

`tools/repair-web-psalms.js` replaces only the serialized Psalms object. It
preserves the surrounding input bytes, all 65 other WEB books, every existing
nonfinal Psalms string, and all other translations. It rejects unexpected
counts, absent chapters, duplicate or missing numbered verse markers, source
identity mismatches, source hash mismatches, and unexpected baseline text.
It validates all 150 full chapter bodies before writing. Repeated runs on
corrected input leave the bytes identical. Reader, BibleData, Romans, original
language, English Word Study, and cache behavior code are unchanged.

## Exact source and retention

Edition: World English Bible Protestant Edition, `engwebp` / WEBP, the same
lineage credited in `js/bible/web.js` and README. The text is public domain;
“World English Bible” is a trademark of eBible.org.

- Source page: <https://ebible.org/engwebp/>
- Archive: <https://ebible.org/Scriptures/engwebp_html.zip>
- Retrieved: October 9, 2026. The source index reported October 8, 2026 generation.
- Archive SHA-256: `a4c0685a929969a4bea1191d90a08fe62c17651c34639a4f57d4a2fd0bd9d9ca`.
- Members retained: exactly `PSA001.htm` through `PSA150.htm`.
- Fixture: `tests/fixtures/web-psalms/engwebp-psalms-html.json.gz`.
- Uncompressed JSON SHA-256: `55cacfcd2cdc763e57774c7a1332ec1ec40db1e0c57cd7789cf1cd57e044c6a9`.

No retained archive was found in the checked checkout, Codex import/temp and
attachment directories, or Downloads. The official archive was downloaded
with PowerShell `Invoke-WebRequest`. Its 150 source pages were decoded as
UTF-8 using .NET ZipFile/StreamReader, ordered by numeric Psalm, serialized
with Node `JSON.stringify`, and compressed with Node `zlib.gzipSync` at level 9.
The fixture retains the complete HTML pages, including provenance-bearing
titles, original verse IDs, continuation paragraphs, and notes. Baseline
hashes, manifest metadata, counts, and old final strings are retained in
`tests/fixtures/web-psalms/baseline.json`.

To rebuild the retained source from an archive with the matching archive
hash, the equivalent Python process is:

```python
import gzip, hashlib, json, zipfile
from pathlib import Path
archive = Path('engwebp_html.zip')
assert hashlib.sha256(archive.read_bytes()).hexdigest() == 'a4c0685a929969a4bea1191d90a08fe62c17651c34639a4f57d4a2fd0bd9d9ca'
with zipfile.ZipFile(archive) as z:
    pages = {f'PSA{n:03}.htm': z.read(f'PSA{n:03}.htm').decode('utf-8')
             for n in range(1, 151)}
raw = json.dumps(pages, ensure_ascii=False, separators=(',', ':')).encode('utf-8')
assert hashlib.sha256(raw).hexdigest() == '55cacfcd2cdc763e57774c7a1332ec1ec40db1e0c57cd7789cf1cd57e044c6a9'
Path('tests/fixtures/web-psalms/engwebp-psalms-html.json.gz').write_bytes(
    gzip.compress(raw, compresslevel=9, mtime=0))
```

Gzip encoding may differ between runtimes; validation pins uncompressed
source bytes. The upstream archive can change, so ordinary repair and tests
use the retained fixture and require no network fetch.

## Reproduction and validation

Files modified or added:

- `js/bible/web.js`
- `js/bible/translation-manifest.js`
- `sw.js`
- `tools/repair-web-psalms.js`
- `tests/fixtures/web-psalms/engwebp-psalms-html.json.gz`
- `tests/fixtures/web-psalms/baseline.json`
- `tests/web-psalms-data.unit.js`
- `tests/web-psalms.spec.js`
- `tests/translation-loader.spec.js` (required metadata expectations only)
- `tests/translation-manifest.spec.js` (required metadata expectations only)
- `tests/pwa.spec.js` (cache version expectations only)
- `tests/offline-translation-management.spec.js` (cache version expectation only)
- `docs/web-psalms-data-repair.md`

```text
node tools/repair-web-psalms.js
node tools/generate-translation-manifest.js
node tools/repair-web-psalms.js --check
node --test tests/web-psalms-data.unit.js tests/romans-original-language-data.unit.js tests/romans-source-compatibility.unit.js tests/word-study-reference-mapping.unit.js
node node_modules/@playwright/test/cli.js test tests/web-psalms.spec.js tests/translation-loader.spec.js tests/translation-manifest.spec.js tests/translation-cache-protocol.spec.js tests/romans-original-language.spec.js tests/pwa.spec.js tests/offline-translation-management.spec.js --workers=1 --retries=2
node tests/validate-assets.js
git diff --check
```

Unit validation compares all 2,461 verses against the retained source and
reconstructs repaired output from the pinned Git baseline. Independent browser
DOM parsing also checks all retained HTML verse text against the repair parser.
All 65 non-Psalms WEB books match their baseline hashes, including Genesis,
Isaiah, Matthew, John, Romans, and Revelation.

Final local validation on October 9, 2026:

- Unit/data/regression command above: **209 passed, 0 failed, 0 skipped**.
- Combined browser/protocol command above: **88 passed, 2 flaky, 0 failed**
  (90 distinct tests succeeded). The unchanged Romans 1:1 definition-loading
  and Isaiah 11:3 focus checks each passed on their first retry. Earlier runs
  also showed intermittent Word Study focus/definition failures on other
  Romans cases; those production files and tests were not changed.
- All **8 new Psalms tests passed on the first attempt**, including the
  independent DOM source check, four WEB Reader cases, KJV/ASV preservation,
  and actual malformed-revision cache upgrade/offline scenario.
- Required WEB Romans 14:24–26, empty Romans 16:25 and Romans 8:28 single
  `παντα` / `G3956` / `A-APN` regressions passed. Genesis 1:1 and John 1:1
  original-language checks passed; Isaiah 11:3 remained hidden (passed on retry).
- Asset validation: 39 references, 26 referenced JavaScript files, 3 icons,
  PWA worker, and generated metadata for all 8 translations passed.
- Explicit `node --check` passed for every added/modified JavaScript file,
  including the WEB bundle, manifest, worker, repair tool and test files.
- `node tools/repair-web-psalms.js --check`, manifest generator `--check`,
  and `git diff --check` passed.

These are local results only; the intermittent tests and pending Cloudflare
preview are limitations, not grounds to claim preview acceptance.

Each listed count is also the final verse number:

| Psalm | Verse count / final number | First verse |
| --- | ---: | --- |
| 1 | 6 | Blessed is the man who doesn’t walk in the counsel of the wicked, nor stand on the path of sinners, nor sit in the seat of scoffers; |
| 21 | 13 | The king rejoices in your strength, LORD! How greatly he rejoices in your salvation! |
| 22 | 31 | My God, my God, why have you forsaken me? Why are you so far from helping me, and from the words of my groaning? |
| 23 | 6 | The LORD is my shepherd; I shall lack nothing. |
| 24 | 10 | The earth is the LORD’s, with its fullness; the world, and those who dwell in it. |
| 25 | 22 | To you, LORD, I lift up my soul. |
| 35 | 28 | Contend, LORD, with those who contend with me. Fight against those who fight against me. |
| 50 | 23 | The Mighty One, God, the LORD, speaks, and calls the earth from sunrise to sunset. |
| 51 | 19 | Have mercy on me, God, according to your loving kindness. According to the multitude of your tender mercies, blot out my transgressions. |
| 72 | 20 | God, give the king your justice; your righteousness to the royal son. |
| 99 | 9 | The LORD reigns! Let the peoples tremble. He sits enthroned among the cherubim. Let the earth be moved. |
| 100 | 5 | Shout for joy to the LORD, all you lands! |
| 130 | 8 | Out of the depths I have cried to you, LORD. |
| 149 | 9 | Praise the LORD! Sing to the LORD a new song, his praise in the assembly of the saints. |
| 150 | 6 | Praise the LORD! Praise God in his sanctuary! Praise him in his heavens for his acts of power! |

## Manifest, cache and acceptance

The existing generator changes only WEB metadata: revision
`e05fd1ce8dd85087` → `a32647ad749afd31`, integrity
`sha256-4F/Rzo3YUIfkD4k+z7m1qZyxnr3Gp1/uKByyn3a13MU=` →
`sha256-oyZHrXSa/THENI7W4iz6DLDwykjuFwYd93IVUXQ70gs=`, bytes
4,194,375 → 4,202,540, total chapters 1,190 → 1,189. WEB verse counts
remain unchanged. All seven other translations' manifest entries are identical.

The sole service-worker edit is shell cache 19 → 20. Existing upgrade behavior
removes old shells and preserves retained Bible caches. A malformed retained
WEB remains an older revision with an update available until current content
is acquired online or explicitly updated, as designed. The new browser test reconstructs the actual old WEB
bytes, checks their old integrity, seeds cache 19 and the old retained revision,
re-registers the worker, verifies ordinary online loading acquires corrected
WEB instead of the malformed cached bundle, calls the existing retention API, checks
the new active revision/integrity, and reads corrected Psalm 150 offline.
This repair does not introduce automatic replacement of retained translations.

Cloudflare preview acceptance is **pending**. Local browser tests cannot
substitute for that requirement. The task prohibits push, PR creation and
deployment, so no preview containing this local change is created. After a
separately authorized preview becomes available, verify WEB Psalms 22, 23, 24,
150 (headings, first verses, verse counts and selector counts), KJV/ASV Psalm
23, WEB Romans 14:24–26 and the empty 16:25 marker, Genesis 1:1, John 1:1,
and Isaiah 11:3, with no page or unexpected console errors. Do not describe
preview acceptance as complete until those checks pass.
