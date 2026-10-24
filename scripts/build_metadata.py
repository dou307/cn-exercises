"""Bind maintained review inputs and section-level note candidates to source hashes."""
from __future__ import annotations
import json
from collections import Counter
from pathlib import Path
from review_checks import CHECKED_IDS

ROOT = Path(__file__).resolve().parents[1]
DATA = ROOT / "data"
questions = json.loads((DATA / "questions.json").read_text(encoding="utf-8"))
notes = json.loads((DATA / "notes.json").read_text(encoding="utf-8"))
by_id = {q["id"]: q for q in questions}
by_chapter = {n["chapter"]: n for n in notes}
baseline = json.loads((DATA / 'reviews' / 'baseline.json').read_text(encoding='utf-8'))
references = json.loads((DATA / 'reviews' / 'references.json').read_text(encoding='utf-8'))
recheck = json.loads((DATA / 'reviews' / 'recheck-20261024.json').read_text(encoding='utf-8'))
CH1_CALCS = {'cn-1-009','cn-1-010','cn-1-011','cn-1-012','cn-1-013','cn-1-014','cn-1-015','cn-1-016','cn-1-017','cn-1-051','cn-1-056','cn-1-057'}

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
    lines = []
    for chapter in range(1, 7):
        lines.extend((DATA / 'reviews' / f'ch{chapter}.tsv').read_text(encoding='utf-8').splitlines())
    for ref in references:
        assert ref['url'].startswith('https://') and set(ref['questions'].split()) <= by_id.keys(), ref
    for line in lines:
        if not line or line.startswith("#"):
            continue
        question_id, status, heading, scoring, conclusion = line.split("|", 4)
        assert question_id not in seen, f"duplicate review {question_id}"
        seen.add(question_id)
        q = by_id[question_id]
        ch = q['sourceChapter']
        assert baseline[question_id] == q['hash'], f'content changed since audit: {question_id}'
        assert note_has_heading(ch, heading), f"unknown note heading: {question_id} {heading}"
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
            "noteChapter": ch,
            "noteHeading": heading,
            "noteSha256": by_chapter[ch]["sha256"],
            "conclusion": conclusion,
            "checkId": f"calc:{question_id}" if question_id in CHECKED_IDS | CH1_CALCS else None,
            "references": [{k:ref[k] for k in ('id','title','url')} for ref in references if question_id in ref['questions'].split()],
            "reviewedAt": "2026-10-23",
        })
    # Second-pass decisions override the audit, never the immutable source.
    second = {r['id']: r for r in recheck['items']}
    assert len(second) == len(recheck['items']) == 48
    assert set(second) == {r['questionId'] for r in review if r['status'] == 'disputed'}, 'second pass must cover exactly the original 48 disputes'
    ref_by_id = {r['id']: r for r in references}
    for r in review:
        item = second.get(r['questionId'])
        if not item:
            continue
        assert item['status'] in ('verified', 'qualified', 'corrected', 'disputed')
        assert item['scoring'] in ('auto', 'self')
        assert item['status'] != 'corrected' or item['scoring'] == 'self', 'this recheck has no replacement single-choice options'
        assert item['status'] != 'disputed' or item['scoring'] == 'self'
        assert item['answerLabel'] and item['explanation']
        assert set(item['refs']) <= ref_by_id.keys()
        r['previousReview'] = {k:r[k] for k in ('status','scoring','conclusion','reviewedAt')}
        r.update(status=item['status'], scoring=item['scoring'], conclusion=item['explanation'],
                 answerLabel=item['answerLabel'],
                 reviewedAt=recheck['date'], recheckId='recheck-20261024')
        if r['scoring'] == 'auto':
            assert by_id[r['questionId']]['grading'] == 'auto'
        ids = set(item['refs']) | {ref['id'] for ref in r['references']}
        r['references'] = [{k:ref[k] for k in ('id','title','url')} for ref in references if ref['id'] in ids]
    expected = set(by_id)
    assert seen == expected, f"review coverage missing={expected-seen} extra={seen-expected}"
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
    review.sort(key=lambda r:(by_id[r['questionId']]['sourceChapter'],by_id[r['questionId']]['sourceOrdinal']))
    for ch in range(1,7):
        rows = [r for r in review if r['noteChapter']==ch]
        (DATA / 'reviews' / f'ch{ch}.json').write_text(json.dumps(rows, ensure_ascii=False, indent=2), encoding='utf-8')
        print(f'chapter {ch}: {len(rows)}',dict(Counter(r['status'] for r in rows)))
    (DATA / 'reviews' / 'all.json').write_text(json.dumps(review, ensure_ascii=False, indent=2), encoding='utf-8')
    (DATA / "mappings.json").write_text(json.dumps(mappings, ensure_ascii=False, indent=2), encoding="utf-8")
    print("reviewed", len(review), dict(Counter(r["status"] for r in review)), "mapped", len(mappings))
    report = ['# 全题库逐题审核', '', '初审日期：2026-10-23；48题重点复核：2026-10-24。由 `scripts/build_metadata.py` 生成，维护输入为各章TSV及 `data/reviews/recheck-20261024.json`。', '',
        '范围：固定网页快照的641个题块，逐题检查题干、选项、来源答案与解析，并查看题内图表。不是王道原书扫描版或官方试卷的逐字校对。第一章沿用已完成的审核，第2至6章本轮新增583题。', '',
        '状态口径：`verified` 结论成立；`qualified` 附适用前提/解析提示；`corrected` 已能确定原答案/解析的错误并给出勘误（选项缺失或整题无正确项时只自评，不虚构可选字母）；`disputed` 存在多解、缺条件、缺图或版本口径差异，继续不计分。原始题目与答案均保留，复核答案优先展示。', '',
        '| 来源章 | 题数 | 结论成立 | 附前提/解析提示 | 已勘误 | 争议不计分 |', '| --- | ---: | ---: | ---: | ---: | ---: |']
    for ch in range(1,7):
        rows=[r for r in review if r['noteChapter']==ch]; counts=Counter(r['status'] for r in rows)
        report.append(f"| {ch} | {len(rows)} | {counts['verified']} | {counts['qualified']} | {counts['corrected']} | {counts['disputed']} |")
    report += ['', '48题复核结果：12题已勘误、1题撤销争议并确认原答案、35题保留争议。详见 [48道争议题重点复核](48道争议题重点复核.md)。已勘误中含选项本身有误的题，恢复的是正确参考结论，不是强行恢复单选判分。复核新增独立计算见 `scripts/recheck_checks.py`，覆盖CRC反例、IPv4字段/校验和、RIP扩散及TCP时序/窗口模型。', '']
    report += ['', f'数值证据：第一章12题复算及第2至6章{len(CHECKED_IDS)}题的独立数值/模型检查，见 `scripts/review_ch1_checks.py` 与 `scripts/review_checks.py`。计算脚本不读取来源答案或审核JSON。每题审核绑定 `baseline.json` 的原文哈希，来源改变时生成会停止，需重新审核。', '',
        '## 争议题清单', '', '| 稳定题号 | 来源题号 | 争议说明 |', '| --- | --- | --- |']
    for r in review:
        if r['status']=='disputed': report.append(f"| {r['questionId']} | {by_id[r['questionId']]['sourceLabel']} | {r['conclusion']} |")
    report += ['', '## 外部核查依据', '', '以下标准或厂商技术文档用于特定问题的交叉核查；其余结论依据独立推导与题面模型，不将第三方解析当独立证据。', '']
    for ref in references: report.append(f"- [{ref['title']}]({ref['url']})：{ref['questions']}。")
    report += ['', '## 后续维护', '', '不要改 vendor 原文。首轮审核维护各章TSV，48题的当前结论维护 `recheck-20261024.json`，保留首轮记录用于追溯。来源变化后须复核并更新基线，不能直接套用旧结论。笔记映射不表示穷举所有前置知识。第7章没有对应来源习题。', '']
    (ROOT / 'docs' / '全题库逐题审核.md').write_text('\n'.join(report),encoding='utf-8')
    report = ['# 48道争议题重点复核', '', f"日期：{recheck['date']}。范围：{recheck['scope']}", '',
              '结论：12题已能明确勘误，1题确认原答案，35题仍有歧义或缺证据。勘误不等于可以强制单选：无正确选项的题转为自评。原题、原解析及首轮结论不覆盖。', '',
              '未找到可核对的原书完整扫描件，配图错配/裁切的题不凭原解析补造字段。条件式结论会明确列出模型，不将推断当题面已知。', '']
    labels = {'verified':'确认原答案','qualified':'附前提','corrected':'已勘误','disputed':'仍有争议 · 不计分'}
    for r in review:
        if r['questionId'] not in second: continue
        report += [f"## {r['questionId']} · {labels[r['status']]}", '', f"来源：第{r['noteChapter']}章 {r['sourceOrdinal']}号题块；{by_id[r['questionId']]['sourceLabel']}。", '',
                   f"**复核答案：{r['answerLabel']}**", '', r['conclusion'], '', f"首轮争议：{r['previousReview']['conclusion']}", '']
        for ref in r['references']: report.append(f"- [{ref['title']}]({ref['url']})")
        report.append('')
    (ROOT / 'docs' / '48道争议题重点复核.md').write_text('\n'.join(report),encoding='utf-8')


if __name__ == "__main__":
    main()
