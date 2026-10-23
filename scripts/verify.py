"""Independent snapshot, count, asset, and record-ID checks."""
from __future__ import annotations
import hashlib, json, re
from pathlib import Path

ROOT = Path(__file__).resolve().parents[1]
VENDOR = ROOT / "vendor" / "kaoyan-408-networks"
data = json.loads((ROOT / "data/questions.json").read_text(encoding="utf-8"))
manifest = json.loads((ROOT / "data/source-manifest.json").read_text(encoding="utf-8"))
actual_files = {p.relative_to(VENDOR).as_posix(): hashlib.sha256(p.read_bytes()).hexdigest()
                for p in VENDOR.rglob("*") if p.is_file()}
assert actual_files == manifest["files"], "source snapshot changed"
assert len(data) == manifest["count"] == 641
assert len({q["id"] for q in data}) == len(data), "duplicate IDs"
for chapter in range(1, 7):
    raw = (VENDOR / f"ch{chapter}" / "quiz.html").read_text(encoding="utf-8")
    count = len(re.findall(r'<div class="quiz-item">', raw))
    assert count == sum(q["sourceChapter"] == chapter for q in data), f"chapter {chapter} count"
for q in data:
    assert q["sourcePath"] == f'ch{q["sourceChapter"]}/quiz.html'
    assert bool(q["answer"]) == (q["grading"] == "auto")
    for src in re.findall(r'<img[^>]+src="([^"]+)"', q["stemHtml"] + q["answerHtml"] + "".join(q["optionsHtml"])):
        assert (ROOT / "app" / src).exists(), f"missing image {src}"
print(f"verified {len(actual_files)} source files, {len(data)} questions and referenced images")
