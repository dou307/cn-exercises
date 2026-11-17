"""Explain all remaining disputes and check suspect image bytes against upstream."""
import hashlib
import json
import urllib.request
from pathlib import Path
from collections import Counter

ROOT=Path(__file__).resolve().parents[1]
COMMIT='4efa1e80be9d44b9485c6b2420fc26be01c0deca'
GROUPS={
    '原网页配图错配/裁切':['cn-4-143','cn-5-106'],
    '历史教材与协议版本口径':['cn-4-072','cn-6-019','cn-6-047'],
    '术语、范围或比较词歧义':['cn-1-012','cn-3-024','cn-3-030','cn-3-109','cn-3-135','cn-5-005','cn-5-039','cn-6-055'],
    '条件不足或多个选项可成立':['cn-1-006','cn-2-003','cn-2-020','cn-2-032','cn-2-051','cn-4-003','cn-4-009','cn-4-014','cn-4-031','cn-4-043','cn-4-044','cn-4-132','cn-4-150','cn-4-166','cn-5-019','cn-5-027','cn-5-044','cn-5-051','cn-5-073','cn-5-086','cn-5-103','cn-6-061']
}

def main():
    reviews=json.loads((ROOT/'data/reviews/all.json').read_text(encoding='utf-8'))
    qs={q['id']:q for q in json.loads((ROOT/'data/questions.json').read_text(encoding='utf-8'))}
    ids=[i for values in GROUPS.values() for i in values]
    assert len(ids)==len(set(ids))==35
    assert set(ids)=={r['questionId'] for r in reviews if r['status']=='disputed'}
    assert all(qs[i]['answerHtml'] for i in ids), 'all 35 originally have answers'
    evidence=[]
    for path in ['assets/ch4/quiz-4.4-q25.webp','assets/ch5/quiz-5.3-comp18a.webp','assets/ch5/quiz-5.3-comp18b.webp','assets/ch5/quiz-5.3-comp18c.webp']:
        url=f'https://raw.githubusercontent.com/jlshdsdk/kaoyan-408-networks/{COMMIT}/{path}'
        with urllib.request.urlopen(url,timeout=30) as response: remote=response.read()
        local=(ROOT/'vendor/kaoyan-408-networks'/path).read_bytes()
        assert remote==local, f'upstream mismatch: {path}'
        evidence.append(dict(path=path,bytes=len(local),sha256=hashlib.sha256(local).hexdigest(),url=url,equal=True))
    (ROOT/'data/dispute-provenance.json').write_text(json.dumps({'checkedAt':'2026-11-17','sourceCommit':COMMIT,'all35HaveSourceAnswers':True,'images':evidence},ensure_ascii=False,indent=2)+'\n',encoding='utf-8')
    lines=['# 35道争议题：原因与迁移核查','','核查日期：2026-11-17。', '',
        '**35题原来源全部有答案与解析。争议标记是本站审核意见，不是“原站无答案”，也不是官方勘误结论。**', '',
        '迁移核查：`scripts/verify.py`逐题比较原始HTML与提取数据的完整题干、选项、答案、图序和表格；440个来源文件逐字节SHA-256与快照清单一致。另从固定上游提交重新下载两道问题题目的4张图片，字节与本地原图完全一致，记录在 `data/dispute-provenance.json`。因此已发现的配图错配与裁切存在于上游网页快照，并非本站迁移时裁剪或丢失。', '',
        '这不证明纸质王道原书同样有错；网页整理/裁图过程也可能引入错误。未取得完整原书题面，不能把网页问题归咎于原书。', '',
        '“仍有争议”还包括对“必须”“可以”“最少”等措辞的严格解释；部分题按传统课堂默认模型可使用原答案。标记偏保守，不能把这35题都说成原答案错误。', '']
    by_id={r['questionId']:r for r in reviews}
    for group, items in GROUPS.items():
        lines.extend([f'## {group}（{len(items)}题）','','| 题目 | 来源答案 | 为何保留争议 |','| --- | --- | --- |'])
        for i in items:
            q=qs[i];r=by_id[i]
            lines.append(f"| [{i}](../app/?q={i})（第{q['sourceChapter']}章 {q['sourceLabel']}） | {q['answer'] or '有，综合/特殊题解析见原题'} | {r['conclusion']} |")
        lines.append('')
    lines+=['## 图片原始字节证据','']
    for e in evidence: lines.append(f"- [{e['path']}]({e['url']})：{e['bytes']}字节；SHA-256 `{e['sha256']}`；上游与本地相同。")
    (ROOT/'docs/35道争议题原因与迁移核查.md').write_text('\n'.join(lines)+'\n',encoding='utf-8')
    print('all 35 have source answers; 4 suspect images match upstream byte-for-byte')

if __name__=='__main__': main()
