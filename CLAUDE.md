# Claude Code 指南（personal-site 个人网站「林间」）

## 项目

中文个人文集网站，展示站主的阅读笔记、写作感想、随笔、诗歌。纯静态、零 npm 依赖，访客主要用手机和桌面浏览器阅读。

## 结构与构建

- **posts/** - 文章 Markdown 原稿（frontmatter: title/date/category），**唯一数据真相源**
- **posts/*.html** - 构建产物，**勿手改**，改了会被 build.js 覆盖
- **build.js** - 零依赖构建脚本（Node 内置模块），运行 `node build.js` 全量重建；分类常量 CATEGORIES 在文件顶部；被 admin.js require 复用（直接运行才执行 main）
- **admin.js + admin.html** - 本地文章录入后台（零依赖，仅监听 127.0.0.1:4321）：表单录入/编辑文章、上传图片、调用 build.js 同款渲染器做预览，保存即自动重建。`发布.command` 是 Mac 双击启动器
- **css/style.css** - PaperMod 风格（参考 harsh17.in / blog.xiaohuangyu.space），亮暗模式由 `prefers-color-scheme` 自动切换；全部设计令牌在 :root CSS 变量里，禁止在组件样式中硬编码颜色
- **archives.html** - 按年份分组 + 分类筛选；列表为「日期 · 标题 · 分类」行式排版
- **images/** - 文章图片；md 内图片路径基准是 `../images/xxx.jpg`（详情页在 posts/ 下生成）
- index.html / archives.html / about.html - 构建产物，勿手改

## 分类（五个，改分类只动 build.js 顶部一处）

阅读（阅读笔记）· 写作（写作感想）· 随笔（日常）· 诗歌 · AI（暂空）

## 新增文章标准流程

1. 在 `posts/` 新建 `YYYY-MM-DD-slug.md`，写好 frontmatter（title/date/category）
2. 图片放 `images/`，md 内引用 `../images/文件名`
3. 运行 `node build.js`，确认输出无报错
4. 正文内容不改写用户原稿

## 已知坑与待办

- 浏览器里对本地页面「存储/另存为」会覆盖生成的 HTML 成纯文本版；恢复 = 重跑 `node build.js`
- 待复核：posts 中《挖一口油井》分类暂归「随笔」；#05 有一处行内图片未转换
- 3 篇早期示例文（《立冬》等）混在真稿中，用户未决定是否删除
- cat-writing / cat-ai 分类暂无差异化 CSS（有 .tag 兜底样式，显示正常）

## 规则

- 不自动 git 提交，除非用户明确要求（本目录是全工作区唯一允许推送远程的项目）
- 涉及删除文件先与用户确认
- 文档使用中文，文件名使用英文
- 站主是编程小白：汇报用表格、结论先行、给可直接执行的命令

## cards/ 卡片发文流程

- `cards/` 是站主手写卡片与拼接初稿的起草区，发布走全局 skill「site-publish」：拼接 → 中度润色（改动列清单经用户确认）→ 落 posts/ → 构建 → 本地提交 → 卡片归档 done/
- 该流程的润色以 skill 规则为准（上面「不改写原稿」针对 posts/ 已有文章）
- 已用卡片移入 `cards/done/日期-slug/`，draft.md 清空
