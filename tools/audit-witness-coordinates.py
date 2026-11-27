"""Audit coordinates only. Coincident addresses do not establish textual equivalence."""
import argparse
from collections import Counter
from hashlib import sha256
import json
from pathlib import Path
import re
import xml.etree.ElementTree as ET

ROOT = Path(__file__).resolve().parent.parent
PINS = {
    "vulgate": "5da5f3c07fa6896d4a2b45f5f309c3ece43e554fd059b31b8ae3688bbd182baf",
    "enoch": "61dd5b372894e54c10f661740d0dd3fbfbfaeef4c99c55690eed4b4aae03f6d9",
    "jubilees": "d8c6eaa3857c35d8e467a6c150178fc02395fc569527bedfc7687c43cc68d87f",
}
TEI = "{http://www.tei-c.org/ns/1.0}"
XML_ID = "{http://www.w3.org/XML/1998/namespace}id"


def source(path, name):
    data = path.read_bytes()
    if sha256(data).hexdigest() != PINS[name]:
        raise ValueError(f"{name} source checksum mismatch")
    if re.search(rb"<!\s*(DOCTYPE|ENTITY)", data, re.I):
        raise ValueError(f"{name} XML includes a DTD or entity declaration")
    return ET.fromstring(data)


def compare(witness, english):
    unique = {ref for ref, count in witness.items() if count == 1}
    return {
        "witnessNumericAddresses": len(witness),
        "englishNumericAddresses": len(english),
        "sharedUniqueNumericAddresses": len(unique & english),
        "ambiguousWitnessAddresses": len(witness) - len(unique),
        "witnessOnlyNumericAddresses": len(witness.keys() - english),
        "englishOnlyNumericAddresses": len(english - witness.keys()),
    }


def dra_data():
    script = (ROOT / "js/bible/dra.js").read_text(encoding="utf-8")
    start = script.index("const draLibrary = ") + len("const draLibrary = ")
    return json.JSONDecoder().raw_decode(script[start:])[0]


def latin(root):
    bible = dra_data()
    # USFX book identifiers for the targeted numbering and canon comparisons.
    targets = {
        "GEN": "genesis", "PSA": "psalms", "TOB": "tobit", "JDT": "judith",
        "EST": "esther", "DAN": "daniel", "WIS": "wisdom", "SIR": "sirach",
        "BAR": "baruch", "1MA": "1-maccabees", "2MA": "2-maccabees",
        "JHN": "john", "ACT": "acts",
    }
    books = {}
    for book in root.findall("book"):
        book_id = book.attrib["id"]
        addresses = Counter()
        chapter = ""
        unsupported = 0
        for item in book.iter():
            if item.tag == "c":
                chapter = item.attrib["id"]
            if item.tag == "v":
                verse = item.attrib["id"]
                if chapter.isdecimal() and verse.isdecimal():
                    addresses[int(chapter), int(verse)] += 1
                else:
                    unsupported += 1
        books[book_id] = {"numericAddresses": len(addresses), "nonnumericRecords": unsupported}
        if book_id in targets:
            english = {(int(chapter), verse) for chapter, section in bible[targets[book_id]].items()
                       if chapter.isdecimal() and isinstance(section, dict)
                       for verse, text in enumerate(section["verses"], 1) if text}
            books[book_id].update(compare(addresses, english))
    return {"books": len(books), "byBook": books}


def ethiopic(root, name):
    selected, = [node for node in root.iter() if node.get(XML_ID) == "EOTCed"]
    addresses = Counter()
    unnumbered = 0
    for chapter in selected.iter(TEI + "div"):
        if chapter.get("subtype") != "chapter":
            continue
        chapter_id = chapter.get("n", "")
        cap = re.fullmatch(r"Cap([0-9]+)", chapter.get(XML_ID, ""))
        if name == "jubilees" and cap:
            chapter_id = cap[1]
        for line in chapter.iter(TEI + "l"):
            number = line.get("n", "")
            if chapter_id.isdecimal() and number.isdecimal():
                addresses[int(chapter_id), int(number)] += 1
            else:
                unnumbered += 1
    installed = json.loads((ROOT / f"data/ethiopian-readings/{name}.json").read_bytes())
    english = {(int(section["id"]), int(line)) for section in installed["sections"]
               for line, text in section["lines"]
               if str(section["id"]).isdecimal() and str(line).isdecimal() and text}
    return {**compare(addresses, english), "nonnumericWitnessRecords": unnumbered, "branch": "EOTCed"}


if __name__ == "__main__":
    parser = argparse.ArgumentParser(description=__doc__)
    for key in PINS:
        parser.add_argument(key, type=Path)
    parser.add_argument("report", type=Path)
    args = parser.parse_args()
    report = {
        "sourceSha256": PINS,
        "verifiedEnglishAlignments": 0,
        "clementine": latin(source(args.vulgate, "vulgate")),
        **{name: ethiopic(source(getattr(args, name), name), name) for name in ("enoch", "jubilees")},
    }
    args.report.write_bytes((json.dumps(report, indent=2) + "\n").encode())
