# CN 练习站

面向个人本地学习的计算机网络题库网页。2026-10-23 建立，项目目录为 `D:\desk\1learn\CN\exercises\cn-exercises`。

## 启动

```powershell
Set-Location -LiteralPath 'D:\desk\1learn\CN\exercises\cn-exercises'
.\scripts\start.ps1 -Port 8766
```

浏览器打开 <http://127.0.0.1:8766/app/>。关闭服务器用 `Ctrl+C`。不能直接双击 `app/index.html`，因为题库数据通过 HTTP 加载。

页面支持章节切换、可调整的已学状态、题目搜索与筛选、单选判分、特殊题自评、错题回顾、收藏、重做以及记录导入导出。记录保存在当前浏览器的 `localStorage`；换浏览器前请导出备份。

## 数据与状态

- 来源：`jlshdsdk/kaoyan-408-networks` 固定提交 `4efa1e80be9d44b9485c6b2420fc26be01c0deca`，原始快照在 `vendor/`，全部文件哈希在 `data/source-manifest.json`。
- 实际从六个 `quiz.html` 提取 **641 个题块**；557 个符合单选自动判分的结构条件，84 个需要自评。来源 README 写 562 道选择题和 77 道综合题（639），与当前页面题块数不一致，本站采用页面实数。分类数字仅表示程序可判分条件，不代表答案经过独立审核。
- Obsidian 笔记：`D:\desk\Obsidian\1大三秋冬\CN\1-概述.md` 至 `7-网络安全.md`。当前只建立**章节级**对应，未逐题确认知识点和前置知识。笔记只读。笔记第 7 章在来源中无独立章末习题。
- 课程课件只有第 1 至 4 章，其中第 4 章为 MAC 子层；来源把相关内容放在第 3 章的 3.5～3.8 节。网页以 Obsidian 笔记章节为主，后续若按课件分组需单独映射。
- 用户未指定已学章节，初始全为未标记，网页中可自行调整。
- 第三方来源声明仅供个人学习，不商用、不再分发。本项目未创建远端仓库或公开部署。

## 维护

```powershell
python -X utf8 scripts/extract.py
python -X utf8 scripts/verify.py
node --check app/app.js
```

`extract.py` 需要 Beautiful Soup 4。更新来源时先重新固定提交和快照，核对文件/题块变化，再更新登记 ID，不能直接覆盖已有学习记录。当前 ID 按首次来源章和题块序号登记；尚未实现跨来源版本的自动身份迁移，因此**不要在来源变化后直接重新提取并沿用旧记录**。

详见 [来源与边界](docs/来源与边界.md) 和 [实施记录](docs/实施记录.md)。
