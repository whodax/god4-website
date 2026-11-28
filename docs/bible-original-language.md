# Bible-wide Word Study

The Reader offers English Word Study throughout its nine English editions.
Original-language verse data now reaches all 66 shared books and their 1,189
chapters. The expansion adds 831 chapter files for 55 books. The earlier
11 books use their existing data and numbering rules.

Hebrew and Aramaic come from the Open Scriptures Hebrew Bible, based on the
Westminster Leningrad Codex. Original work of the Open Scriptures Hebrew
Bible available at https://github.com/openscriptures/morphhb under
[CC BY 4.0](https://creativecommons.org/licenses/by/4.0/).
GOD4.us removes variant-note tokens and adapts verse numbering using the
source's KJV verse map. Inline KJV notes establish the word boundaries
for the splits in 1 Kings and Psalm 13. Greek comes from the
[Robinson–Pierpont Byzantine Textform](https://github.com/byztxt/byzantine-majority-text)
under the Unlicense. Duplicate identical Greek analysis tags are collapsed
during the new import. Each running-text word uses the source's first analysis.
The lexical fields come from the same reviewed Strong components used for
[Isaiah](hebrew-xml-lexical-provenance.md) and [the earlier expansion](expanded-original-language.md).

Each new chapter stores its verse tokens and a glossary shared by its verses.
The Reader loads a chapter only when a reader starts Word Study there. The
new chapters are outside the PWA app shell. Original-language token details
remain available when the source chapter has been loaded in the current page.
The verified English-to-original highlighting catalog continues to apply at
the reviewed word and phrase locations.

Robinson–Pierpont omits Luke 17:36 and Acts 8:37, 15:34, and 24:7. For English
editions containing those readings, the Reader uses the corresponding Greek
from [Maurice A. Robinson's parsed Textus Receptus](https://github.com/byztxt/greektext-textus-receptus)
(public domain, revision `33af6e9361f8db0afd353714d05c75f44e5555b9`). The
four alternate verse files record their source file checksums. The panel
identifies the alternate edition. Nehemiah 7:68 has English lookup because
the pinned Westminster source lacks that reading at the KJV reference.
Douay-Rheims Catholic-only texts and its differently numbered
Psalms, Esther, and Daniel use English Word Study. New chapters with divergent
verse counts in Douay-Rheims or Geneva use English lookup until their individual
source references are mapped.

The [publication manifest](bible-original-language-manifest.json) records the
pinned source revisions, chapter checksums, and omitted references. Reproduce
the compact files with the three pinned source repositories in a local folder.

```powershell
node tools/publish-bible-original-language.js 'C:/path/to/source-repositories' 'C:/path/to/fresh-output-folder'
node tools/publish-bible-original-language.js 'C:/path/to/source-repositories' 'C:/path/to/variant-output' --variants 'C:/path/to/greektext-textus-receptus'
node --test tests/bible-original-language.unit.js
```
