"""Extract the six frozen source quiz pages without changing their text."""
from __future__ import annotations

import hashlib
import json
import re
from pathlib import Path
from bs4 import BeautifulSoup

ROOT = Path(__file__).resolve().parents[1]
VENDOR = ROOT / "vendor" / "kaoyan-408-networks"
OUT = ROOT / "data"
SOURCE_COMMIT = "4efa1e80be9d44b9485c6b2420fc26be01c0deca"
NOTES = Path(r"D:\desk\Obsidian\1大三秋冬\CN")


def html_of(node, chapter):
    fragment = BeautifulSoup(str(node), "html.parser")
    for bad in fragment.select("script, iframe, object, embed"):
        bad.decompose()
    for tag in fragment.find_all(True):
        for key in list(tag.attrs):
            if key.startswith("on"):
                del tag.attrs[key]
        if tag.name == "img" and tag.get("src", "").startswith("../assets/"):
            tag["src"] = "../vendor/kaoyan-408-networks/" + tag["src"][3:]
    return "".join(str(x) for x in fragment.contents)


def main():
    questions = []
    hashes = {}
    for chapter in range(1, 7):
        path = VENDOR / f"ch{chapter}" / "quiz.html"
        raw = path.read_bytes()
        hashes[f"ch{chapter}/quiz.html"] = hashlib.sha256(raw).hexdigest()
        soup = BeautifulSoup(raw, "html.parser")
        heading = ""
        ordinal = 0
        for element in soup.select_one("main.content").children:
            if getattr(element, "name", None) == "h2":
                heading = element.get_text(" ", strip=True)
            if getattr(element, "name", None) != "div" or "quiz-item" not in element.get("class", []):
                continue
            ordinal += 1
            label = element.select_one(".q-no")
            source_type = element.select_one(".q-src")
            answer = element.select_one("details.ans")
            key = element.select_one(".ans-key")
            option_list = element.select_one("ul.choices")
            header = element.find("p")
            stem_nodes = [n for n in element.children if getattr(n, "name", None) and n not in (header, option_list, answer)]
            stem = "".join(html_of(n, chapter) for n in stem_nodes)
            options = [html_of(li, chapter) for li in option_list.find_all("li", recursive=False)] if option_list else []
            answer_text = key.get_text(" ", strip=True) if key else ""
            match = re.fullmatch(r"答案：\s*([A-D])", answer_text)
            # Only canonical A-D lists with four options can be scored automatically.
            option_letters = [re.match(r"\s*([A-D])\.", BeautifulSoup(o, "html.parser").get_text(" ", strip=True)) for o in options]
            auto = bool(match and len(options) == 4 and all(m and m.group(1) == chr(65+i) for i, m in enumerate(option_letters)))
            source_text = element.get_text(" ", strip=True)
            qhash = hashlib.sha256(source_text.encode("utf-8")).hexdigest()
            section_match = re.search(rf"\b{chapter}\.(\d+)\b", source_type.get_text(" ", strip=True) if source_type else "") or re.search(rf"\b{chapter}\.(\d+)\b", heading)
            section = f"{chapter}.{section_match.group(1)}" if section_match else f"{chapter}.?"
            questions.append({
                "id": f"cn-{chapter}-{ordinal:03d}",
                "sourceChapter": chapter,
                "sourceSection": section,
                "sourceHeading": heading,
                "sourceLabel": label.get_text(" ", strip=True) if label else str(ordinal),
                "sourceType": source_type.get_text(" ", strip=True) if source_type else "",
                "sourcePath": f"ch{chapter}/quiz.html",
                "sourceOrdinal": ordinal,
                "hash": qhash,
                "stemHtml": stem,
                "optionsHtml": options,
                "answerHtml": html_of(answer.select_one(".ans-body"), chapter) if answer else "",
                "answer": match.group(1) if auto else None,
                "grading": "auto" if auto else "self",
                "noteChapter": chapter,
            })
    note_index = []
    for chapter in range(1, 8):
        paths = list(NOTES.glob(f"{chapter}-*.md"))
        if not paths:
            continue
        p = paths[0]
        raw = p.read_bytes()
        titles = [line.strip() for line in raw.decode("utf-8-sig").splitlines() if re.match(r"^#{1,4} ", line)]
        note_index.append({"chapter": chapter, "name": p.stem, "path": str(p), "sha256": hashlib.sha256(raw).hexdigest(), "headings": titles})
    OUT.mkdir(exist_ok=True)
    (OUT / "questions.json").write_text(json.dumps(questions, ensure_ascii=False, indent=2), encoding="utf-8")
    (OUT / "notes.json").write_text(json.dumps(note_index, ensure_ascii=False, indent=2), encoding="utf-8")
    all_hashes = {p.relative_to(VENDOR).as_posix(): hashlib.sha256(p.read_bytes()).hexdigest()
                  for p in sorted(VENDOR.rglob("*")) if p.is_file()}
    (OUT / "source-manifest.json").write_text(json.dumps({"repository": "https://github.com/jlshdsdk/kaoyan-408-networks", "commit": SOURCE_COMMIT, "files": all_hashes, "quizSha256": hashes, "count": len(questions)}, ensure_ascii=False, indent=2), encoding="utf-8")
    print(f"questions={len(questions)} auto={sum(q['grading']=='auto' for q in questions)} self={sum(q['grading']=='self' for q in questions)} notes={len(note_index)}")


if __name__ == "__main__":
    main()
