# Shell 84 corpus alignment attribution

The chapter files record derived English span and original-language position groups. They reference the already installed Bible text and original-language editions. The position sources are:

- [Clear.Bible manual alignment packages](https://github.com/Clear-Bible/Alignments), CC BY 4.0. The corpus compiler checks pinned WLCM and SBLGNT data and matches the published ordered witness before importing groups.
- [unfoldingWord Literal Text v92](https://git.door43.org/unfoldingWord/en_ult/src/tag/v92) and its Hebrew and Greek contextual witnesses, CC BY-SA 4.0. GOD4.us checked their groups and coordinates against the installed text and kept only qualifying matches.
- [CrossWire KJV module source](https://www.crosswire.org/sword/modules/ModInfo.jsp?modName=KJV), pinned OSIS revision and notice documented in the [Shell 76 report](../../../../docs/shell-76-word-study.md). The compiler checks KJV lexical tags, Greek positions or verified groups outside supplied words where indicated.

These compiled transformations retain CC BY-SA 4.0 attribution for the unfoldingWord-derived alignment data and the other source notices. Published original positions and English spans are indexed by edition and scripture coordinate. The [publication report](../../../../docs/shell-84-corpus-publication.json) includes input and output checksums.
