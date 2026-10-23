"""Bind maintained review inputs and section-level note candidates to source hashes."""
from __future__ import annotations
import json
from pathlib import Path

ROOT = Path(__file__).resolve().parents[1]
DATA = ROOT / "data"
questions = json.loads((DATA / "questions.json").read_text(encoding="utf-8"))
notes = json.loads((DATA / "notes.json").read_text(encoding="utf-8"))
by_id = {q["id"]: q for q in questions}
by_chapter = {n["chapter"]: n for n in notes}

SECTION_CANDIDATES = {
    "1.1": ["定义和分类", "电路交换、分组交换和报文交换", "性能指标"],
    "1.2": ["体系结构"],
    "2.1": ["传输方式", "编码与调制", "信道的极限容量", "信道复用技术"],
    "2.2": ["传输介质"], "2.3": [],
    "3.1": ["三个问题"], "3.2": ["三个问题"], "3.3": ["三个问题"], "3.4": ["三个问题"],
    "3.5": ["共享式以太网", "802.11 无线局域网"],
    "3.6": ["共享式以太网", "交换式以太网", "以太网的 MAC 帧格式", "虚拟局域网", "以太网的发展", "802.11 无线局域网"],
    "3.7": ["点对点协议"], "3.8": ["交换式以太网"],
    "4.1": ["网际协议"], "4.2": ["网际协议", "静态路由配置", "虚拟专用网和网络地址转换"],
    "4.3": ["IPv6"], "4.4": ["因特网的路由选择协议"], "4.5": ["IP 多播"], "4.6": [], "4.7": ["网际协议", "因特网的路由选择协议"],
    "5.1": ["概述"], "5.2": ["UDP 和 TCP 的对比"], "5.3": ["传输控制协议"],
    "6.1": ["应用进程通信方式"], "6.2": ["域名系统"], "6.3": ["文件传输协议"], "6.4": ["电子邮件"], "6.5": ["万维网"],
}


def note_has_heading(chapter, heading):
    return any(h.lstrip("# ") == heading for h in by_chapter[chapter]["headings"])


def main():
    review = []
    seen = set()
    for line in (DATA / "reviews" / "ch1.tsv").read_text(encoding="utf-8").splitlines():
        if not line or line.startswith("#"):
            continue
        question_id, status, heading, scoring, conclusion = line.split("|", 4)
        assert question_id not in seen, f"duplicate review {question_id}"
        seen.add(question_id)
        q = by_id[question_id]
        assert q["sourceChapter"] == 1
        assert note_has_heading(1, heading), f"unknown note heading: {heading}"
        assert status in ("verified", "qualified", "disputed")
        assert scoring in ("auto", "self") and (scoring != "auto" or q["grading"] == "auto")
        if status == "disputed":
            assert scoring == "self"
        review.append({
            "questionId": question_id,
            "sourceContentHash": q["hash"],
            "sourcePath": q["sourcePath"],
            "sourceOrdinal": q["sourceOrdinal"],
            "sourceAnswer": q["answer"],
            "status": status,
            "scoring": scoring,
            "noteChapter": 1,
            "noteHeading": heading,
            "noteSha256": by_chapter[1]["sha256"],
            "conclusion": conclusion,
            "checkId": f"calc:{question_id}" if question_id in {"cn-1-009","cn-1-010","cn-1-011","cn-1-012","cn-1-013","cn-1-014","cn-1-015","cn-1-016","cn-1-017","cn-1-051","cn-1-056","cn-1-057"} else None,
            "reviewedAt": "2026-10-23",
        })
    expected = {q["id"] for q in questions if q["sourceChapter"] == 1}
    assert seen == expected, f"chapter 1 review coverage missing={expected-seen} extra={seen-expected}"
    review_by_id = {r["questionId"]: r for r in review}
    mappings = []
    for q in questions:
        ch = q["noteChapter"]
        candidates = SECTION_CANDIDATES[q["sourceSection"]]
        assert all(note_has_heading(ch, heading) for heading in candidates), (q["id"], candidates)
        r = review_by_id.get(q["id"])
        mappings.append({
            "questionId": q["id"],
            "sourceContentHash": q["hash"],
            "primaryNoteChapter": ch,
            "primaryTopic": r["noteHeading"] if r else None,
            "topicCandidates": [r["noteHeading"]] if r else candidates,
            "status": "reviewed" if r else "system",
            "noteSha256": by_chapter[ch]["sha256"],
        })
    (DATA / "reviews" / "ch1.json").write_text(json.dumps(review, ensure_ascii=False, indent=2), encoding="utf-8")
    (DATA / "mappings.json").write_text(json.dumps(mappings, ensure_ascii=False, indent=2), encoding="utf-8")
    from collections import Counter
    print("reviewed", len(review), dict(Counter(r["status"] for r in review)), "mapped", len(mappings))


if __name__ == "__main__":
    main()
