# Word Study in seven additional books

The Study Desk loads Hebrew for Exodus, Leviticus, Numbers, and Deuteronomy and
Greek for Matthew, Mark, and Luke. The data covers 205 chapters and 7,218 verses,
with 109,608 original-language token records. Selecting an English word opens
the same Word Study panel with the published original-language tokens for the
verse. Select a token to see its available lexical fields. English-to-original
word mappings remain limited to individually reviewed catalog entries.

Chapter JSON loads on demand. The 205 shards total 111,941,579 raw bytes, with a
largest chapter of 1,302,304 bytes. Only the provider script is in the existing
app-shell asset list. The chapter shards require a network connection when
the Reader has yet to load them during the current page session.

## Source and verification

| Source | Revision | Terms |
| --- | --- | --- |
| [Open Scriptures Hebrew Bible](https://github.com/openscriptures/morphhb), WLC OSIS per book | `3d15126fb1ef74867fc1434be1942e837932691f` | OSHB annotations CC BY 4.0, WLC text public domain |
| [Robinson–Pierpont Byzantine Textform RP2018](https://github.com/byztxt/byzantine-majority-text), byztxt v3.3.2 CSV with parsing | `27a45ff1b7be6c17ccbfeac414f3f55732ae8e28` | Public domain / Unlicense |
| [Open Scriptures Strong's XML](https://github.com/openscriptures/strongs) | `0acd2f251c2d35ff8db2dece4e0593979d3ac223` | Reviewed public-domain components |

The Hebrew data uses the same [five-field Strong's Hebrew subset](hebrew-xml-lexical-provenance.md)
as Isaiah, with main-text OSHB tokens and the OSHB apparatus excluded. The Greek
data records the first source analysis for each running-text word. The eight
alternate analyses in Matthew and Mark are recorded in the manifest. Strong's
Greek G2022 in Luke 10:34 has a blank definition field in the pinned XML. The
importer uses the lexical text in the same entry's KJV gloss field.

The import script verifies SHA-256 for each pinned source and lexicon Git blob,
checks the Hebrew numbering against the source's inline KJV reference notes,
and rejects incomplete or conflicting chapter data. Its JSON report matches
the [publication manifest](expanded-original-language-manifest.json), which
records every chapter checksum. Run from the site repository with the three
source repositories available locally.

```powershell
node tools/publish-expanded-original-language.js 'C:/path/to/source-repositories' 'C:/path/to/fresh-review-folder'
node --test tests/word-study-expansion.unit.js
npx.cmd playwright test tests/word-study-expansion.spec.js --workers=1
```

## Verse numbering and source limits

- Hebrew exceptions are in Exodus 7–8 and 21–22, Leviticus 5–6, Numbers 16–17,
  25–26 and 29–30, and Deuteronomy 12–13, 22–23 and 28–29.
  Hebrew Numbers 25:19 and 26:1 join in order as Reader Numbers 26:1.
- The Byzantine source has no Luke 17:36. Luke 17:37 keeps its own Greek words.
- The Byzantine source and WEB place the two Matthew 23:13–14 sayings in the
  opposite order from KJV. The import and Reader provider map each saying to
  its own words. Douay–Rheims likewise reverses Matthew 5:4–5 relative to KJV.
- The Reader provider adjusts the reviewed numbering differences in Geneva and
  Douay–Rheims. A few passages combine or split the source material, including
  Geneva Luke 15:31 and parts of Douay–Rheims Exodus 38–40 and Numbers 15, 20,
  and 27. The provider lists each affected verse and keeps English dictionary
  lookup available there.
