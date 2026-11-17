"""Package only web runtime files for GitHub Pages; keep private workspace files out."""
import json
import shutil
from pathlib import Path
from build_supplement import build

ROOT=Path(__file__).resolve().parents[1]

def main():
    build()
    out=ROOT/'dist'
    if out.exists(): shutil.rmtree(out)
    out.mkdir()
    for folder in ('app','docs'):
        shutil.copytree(ROOT/folder,out/folder)
    (out/'data/reviews').mkdir(parents=True)
    for filename in ('questions.json','mappings.json','ch7-bundle.json'):
        shutil.copy2(ROOT/'data'/filename,out/'data'/filename)
    shutil.copy2(ROOT/'data/reviews/all.json',out/'data/reviews/all.json')
    notes=json.loads((ROOT/'data/notes.json').read_text(encoding='utf-8'))
    for n in notes: n.pop('path',None)
    (out/'data/notes.json').write_text(json.dumps(notes,ensure_ascii=False),encoding='utf-8')
    # KaTeX and original quiz images are needed at their preserved relative paths.
    shutil.copytree(ROOT/'vendor/kaoyan-408-networks/assets',out/'vendor/kaoyan-408-networks/assets')
    (out/'index.html').write_text('<!doctype html><html lang="zh-CN"><meta charset="utf-8"><meta http-equiv="refresh" content="0;url=app/"><title>CN练习站</title><a href="app/">进入计算机网络练习站</a></html>',encoding='utf-8')
    (out/'.nojekyll').touch()
    (out/'SOURCE.txt').write_text('Source: https://github.com/jlshdsdk/kaoyan-408-networks\nSnapshot: 4efa1e80be9d44b9485c6b2420fc26be01c0deca\nOriginal source notice: personal study only; no commercial use or redistribution. No additional license is granted by this site.\nChapter 7: original supplemental exercises.\n',encoding='utf-8')
    print('GitHub Pages artifact ready:',out)

if __name__=='__main__': main()
