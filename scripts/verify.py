"""Independent snapshot, count, asset, and record-ID checks."""
from __future__ import annotations
import hashlib, json, re
from pathlib import Path
from lxml import html

ROOT = Path(__file__).resolve().parents[1]
VENDOR = ROOT / "vendor" / "kaoyan-408-networks"
data = json.loads((ROOT / "data/questions.json").read_text(encoding="utf-8"))
manifest = json.loads((ROOT / "data/source-manifest.json").read_text(encoding="utf-8"))
registry = json.loads((ROOT / "data/source-registry.json").read_text(encoding="utf-8"))
mappings = json.loads((ROOT / "data/mappings.json").read_text(encoding="utf-8"))
reviews = json.loads((ROOT / "data/reviews/all.json").read_text(encoding="utf-8"))
baseline = json.loads((ROOT / 'data/reviews/baseline.json').read_text(encoding='utf-8'))
actual_files = {p.relative_to(VENDOR).as_posix(): hashlib.sha256(p.read_bytes()).hexdigest()
                for p in VENDOR.rglob("*") if p.is_file()}
assert actual_files == manifest["files"], "source snapshot changed"
assert len(data) == manifest["count"] == 641
assert len({q["id"] for q in data}) == len(data), "duplicate IDs"
assert {r["id"]: r["hash"] for r in registry} == {q["id"]: q["hash"] for q in data}, "registry mismatch"
assert {m["questionId"]: m["sourceContentHash"] for m in mappings} == {q["id"]: q["hash"] for q in data}, "mapping mismatch"
assert len(reviews) == len({r['questionId'] for r in reviews}) == len(data), 'review duplicates or missing records'
assert {r["questionId"]: r["sourceContentHash"] for r in reviews} == baseline == {q["id"]: q["hash"] for q in data}, "review coverage or hash mismatch"
assert all(r['status'] in ('verified','qualified','corrected','disputed') and r['conclusion'] and r['noteHeading'] for r in reviews), 'incomplete review'
second = json.loads((ROOT / 'data/reviews/recheck-20261024.json').read_text(encoding='utf-8'))
second_by_id = {r['id']: r for r in second['items']}
assert len(second_by_id) == len(second['items']) == 48
assert set(second_by_id) == {r['questionId'] for r in reviews if r.get('recheckId')}, 'second-pass coverage differs'
for r in reviews:
    if r['questionId'] not in second_by_id: continue
    item = second_by_id[r['questionId']]
    assert r['previousReview']['status'] == 'disputed'
    assert r['status'] == item['status'] and r['scoring'] == item['scoring']
    assert r['answerLabel'] == item['answerLabel'] and r['conclusion'] == item['explanation']
    assert r['reviewedAt'] == second['date']
for ch in range(1,7):
    assert json.loads((ROOT / f'data/reviews/ch{ch}.json').read_text(encoding='utf-8')) == [r for r in reviews if r['noteChapter']==ch], 'chapter reviews differ from combined review'
assert all(r["status"] != "disputed" or r["scoring"] == "self" for r in reviews), "disputed item auto-scored"
offset = 0
for chapter in range(1, 7):
    raw = (VENDOR / f"ch{chapter}" / "quiz.html").read_text(encoding="utf-8")
    count = len(re.findall(r'<div class="quiz-item">', raw))
    assert count == sum(q["sourceChapter"] == chapter for q in data), f"chapter {chapter} count"
    tree = html.fromstring(raw)
    elements = tree.xpath('//main[contains(concat(" ",normalize-space(@class)," ")," content ")]//div[contains(concat(" ",normalize-space(@class)," ")," quiz-item ")]')
    assert len(elements) == count
    for element in elements:
        q = data[offset]
        raw_text = " ".join(t.strip() for t in element.itertext() if t.strip())
        assert hashlib.sha256(raw_text.encode("utf-8")).hexdigest() == q["hash"], f"full source mismatch: {q['id']}"
        original_stem = [child for child in element if child.tag not in ("ul", "details") and not (child.tag == "p" and child.xpath('.//span[contains(concat(" ",normalize-space(@class)," ")," q-no ")]'))]
        extracted_stem = html.fragment_fromstring(q["stemHtml"], create_parent="div")
        a = " ".join(t.strip() for child in original_stem for t in child.itertext() if t.strip())
        b = " ".join(t.strip() for t in extracted_stem.itertext() if t.strip())
        assert a == b, f"stem content mismatch: {q['id']}"
        original_options = element.xpath('./ul[contains(concat(" ",normalize-space(@class)," ")," choices ")]/li')
        assert len(original_options) == len(q["optionsHtml"]), f"option count mismatch: {q['id']}"
        for source_li, extracted in zip(original_options, q["optionsHtml"]):
            a = " ".join(t.strip() for t in source_li.itertext() if t.strip())
            b = " ".join(t.strip() for t in html.fragments_fromstring(extracted)[0].itertext() if t.strip())
            assert a == b, f"option content mismatch: {q['id']}"
        source_body = element.xpath('./details[contains(concat(" ",normalize-space(@class)," ")," ans ")]/div[contains(concat(" ",normalize-space(@class)," ")," ans-body ")]')
        assert len(source_body) == 1, f"answer block mismatch: {q['id']}"
        a = " ".join(t.strip() for t in source_body[0].itertext() if t.strip())
        b = " ".join(t.strip() for t in html.fragments_fromstring(q["answerHtml"])[0].itertext() if t.strip())
        assert a == b, f"answer content mismatch: {q['id']}"
        original_images = [Path(src).name for src in element.xpath('.//img/@src')]
        extracted = html.fragment_fromstring(q["stemHtml"] + "".join(q["optionsHtml"]) + q["answerHtml"], create_parent="div")
        extracted_images = [Path(src).name for src in extracted.xpath('.//img/@src')]
        assert original_images == extracted_images, f"image order mismatch: {q['id']}"
        original_cells = [" ".join(e.itertext()).strip() for e in element.xpath('.//th|.//td')]
        extracted_cells = [" ".join(e.itertext()).strip() for e in extracted.xpath('.//th|.//td')]
        assert original_cells == extracted_cells, f"table structure mismatch: {q['id']}"
        offset += 1
assert offset == len(data)
for q in data:
    assert q["sourcePath"] == f'ch{q["sourceChapter"]}/quiz.html'
    assert bool(q["answer"]) == (q["grading"] == "auto")
    for src in re.findall(r'<img[^>]+src="([^"]+)"', q["stemHtml"] + q["answerHtml"] + "".join(q["optionsHtml"])):
        assert (ROOT / "app" / src).exists(), f"missing image {src}"
print(f"verified {len(actual_files)} source files, {len(data)} questions and referenced images")
