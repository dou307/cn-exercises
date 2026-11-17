"""Generate explicitly labelled original chapter-seven exercises."""
import hashlib
import html
import json
from pathlib import Path

ROOT = Path(__file__).resolve().parents[1]

def build():
    source = json.loads((ROOT/'data/supplement-ch7.json').read_text(encoding='utf-8'))
    note = next(n for n in json.loads((ROOT/'data/notes.json').read_text(encoding='utf-8')) if n['chapter']==7)
    bundle = {'questions':[], 'reviews':[], 'mappings':[]}
    ids = set()
    for i, item in enumerate(source['items'], 1):
        assert item['id'] not in ids
        ids.add(item['id'])
        assert '## '+item['topic'] in note['headings'] or '### '+item['topic'] in note['headings']
        assert item['explanation'] and item['stem']
        choices = item.get('options', [])
        assert (len(choices)==4 and item['answer'] in 'ABCD') or (not choices and item['answer'] is None)
        digest = hashlib.sha256(json.dumps(item, ensure_ascii=False, sort_keys=True).encode()).hexdigest()
        refs = [{'id':f'rfc{n}','title':f'RFC {n}', 'url':f'https://www.rfc-editor.org/rfc/rfc{n}.html'} for n in item['refs']]
        if item.get('extraRef'): refs.append({'id':'extra',**item['extraRef']})
        answer = (f"答案：{item['answer']}。" if choices else '参考答案：') + item['explanation']
        section = {'安全威胁':1,'密码学':2,'对称密钥密码体制':2,'公钥密码体制':2,'数字签名':3,'实体识别':4,'对称密钥的分发':5,'公钥的分发':5,'IPSec 协议族':6}[item['topic']]
        bundle['questions'].append(dict(id=item['id'], sourceChapter=7, sourceSection='7.'+str(section),
            sourceHeading='原创补充 · '+item['topic'], sourceLabel=f'补充题 {i}', sourceType='原创补充',
            sourcePath='data/supplement-ch7.json', sourceOrdinal=i, hash=digest,
            stemHtml='<p>'+html.escape(item['stem'])+'</p>',
            optionsHtml=[f'<li>{chr(65+j)}. {html.escape(v)}</li>' for j,v in enumerate(choices)],
            answerHtml='<p class="ans-key">'+html.escape(answer)+'</p>', answer=item['answer'],
            grading='auto' if choices else 'self', noteChapter=7))
        bundle['reviews'].append(dict(questionId=item['id'], sourceContentHash=digest, status='verified',
            scoring='auto' if choices else 'self', noteHeading=item['topic'], noteChapter=7,
            conclusion=source['provenance'], reviewedAt=source['date'], references=refs))
        bundle['mappings'].append(dict(questionId=item['id'], sourceContentHash=digest, primaryTopic=item['topic']))
    assert len(ids)==24
    (ROOT/'data/ch7-bundle.json').write_text(json.dumps(bundle, ensure_ascii=False, indent=2)+'\n',encoding='utf-8')
    print(f'chapter 7: {len(ids)} original exercises with answers')

if __name__=='__main__': build()
