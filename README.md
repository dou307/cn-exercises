# CN 练习站

面向个人本地学习的计算机网络题库网页。2026-10-23 建立，项目目录为 `D:\desk\1learn\CN\exercises\cn-exercises`。

## 启动

```powershell
Set-Location -LiteralPath 'D:\desk\1learn\CN\exercises\cn-exercises'
.\scripts\start.ps1 -Port 8766
```

浏览器打开 <http://127.0.0.1:8766/app/>。关闭服务器用 `Ctrl+C`。不能直接双击 `app/index.html`，因为题库数据通过 HTTP 加载。

页面支持章节切换、可调整的已学状态、题目搜索与筛选（含来源小节和答案待核对题）、稳定题号跳转、单选判分、特殊题草稿与自评、自评更正、错题回顾、收藏、重做以及校验后合并导入/导出。题目链接可带 `?q=cn-1-001` 直达。记录保存在当前浏览器的 `localStorage`；换浏览器前请导出备份。

## 数据与状态

- 来源：`jlshdsdk/kaoyan-408-networks` 固定提交 `4efa1e80be9d44b9485c6b2420fc26be01c0deca`，原始快照在 `vendor/`，全部文件哈希在 `data/source-manifest.json`。
- 实际从六个 `quiz.html` 提取 **641 个题块**；557 个符合单选自动判分的结构条件，84 个需要自评。来源 README 写 562 道选择题和 77 道综合题（639），与当前页面题块数不一致，本站采用页面实数。分类数字仅表示程序可判分条件，不代表答案经过独立审核。
- Obsidian 笔记：`D:\desk\Obsidian\1大三秋冬\CN\1-概述.md` 至 `7-网络安全.md`。第 1～6 章 641 题均逐题选择主要笔记小节，未穷举所有前置知识。笔记只读。笔记第 7 章在来源中无独立章末习题。
- **641题已逐题核查**：324题结论成立、270题附前提、12题已勘误、35题仍有争议。2026-10-24重点复核原48道争议题，12题明确修正，1题确认原答案，35题保留歧义/缺证据标记。已勘误题中原选项缺失或无正确项的，显示完整参考答案并自评，不强行按原字母判分。审核针对固定网页快照，**没有与原书扫描页或官方真题逐题比对**。
- 争议题历史作答仍保留在浏览器记录中，但不再计入正误或已作答进度；附前提题按来源答案评分，并显示条件与解析提示。自动判分的结构条件与审核后是否计分是两个不同字段。
- 48题复核答案与解析优先显示，原来源答案可展开对照；12道勘误题须按新结论重新自评，旧记录保留但不会自动算作已掌握。筛选提供“已勘误”类别。
- 课程课件只有第 1 至 4 章，其中第 4 章为 MAC 子层；来源把相关内容放在第 3 章的 3.5～3.8 节。网页以 Obsidian 笔记章节为主，后续若按课件分组需单独映射。
- 用户未指定已学章节，初始全为未标记，网页中可自行调整。
- 第三方来源声明仅供个人学习，不商用、不再分发。本项目未创建远端仓库或公开部署。

## 维护

```powershell
python -X utf8 scripts/extract.py
python -X utf8 scripts/build_metadata.py
python -X utf8 scripts/verify.py
python -X utf8 scripts/review_ch1_checks.py
python -X utf8 scripts/review_checks.py
python -X utf8 scripts/recheck_checks.py
python -X utf8 -m unittest discover -s tests -p 'test_*.py' -v
node --check app/app.js
node --test tests/state.test.cjs
```

`extract.py` 需要 Beautiful Soup 4；`verify.py` 需要 lxml。`source-registry.json` 按题目内容哈希维持稳定 ID：题块重排不会更改身份；来源题目变更或删除会停止生成，要求先人工核对并制定记录迁移。维护审核输入 `data/reviews/ch1.tsv` 至 `ch6.tsv` 后，运行 `build_metadata.py` 生成各章/合并审核、主要考点和审核报告。`data/reviews/baseline.json` 冻结审核时正文哈希，来源改变时必须重新核查后显式更新基线，不能重新生成就沿用旧结论。不要编辑 `vendor/` 原文，也不要手改生成的 JSON。

复核维护输入为 `data/reviews/recheck-20261024.json`，会覆盖各章TSV的当前展示结论，同时保存首轮状态及说明，不修改源题数据。

详见 [48道争议题重点复核](docs/48道争议题重点复核.md)、[全题库逐题审核](docs/全题库逐题审核.md)、[来源与边界](docs/来源与边界.md)、[第一章首轮复核](docs/第一章逐题复核.md) 和 [实施记录](docs/实施记录.md)。
