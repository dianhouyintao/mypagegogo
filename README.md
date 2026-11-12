# 林间 · 个人网站

一个零依赖的静态个人网站：文章用 Markdown 写，运行一次构建脚本，就变成纯 HTML 页面。可以双击 `index.html` 直接打开，也可以本地起个小服务器预览。

## 目录结构

```
personal-site/
├── build.js              # 构建脚本（唯一的"机器"，零 npm 依赖）
├── index.html            # 首页（构建生成，含最新 5 篇）
├── archives.html         # 文章列表页（构建生成，带分类筛选）
├── about.html            # 关于我（构建生成）
├── css/
│   └── style.css         # 全站样式（颜色、字号、间距都在 :root 设计令牌里）
├── posts/
│   ├── 2026-11-08-night-river.md      # 文章源文件（Markdown）
│   └── night-river.html               # 构建生成的详情页
├── images/               # 文章配图
└── README.md
```

规则很简单：**`posts/` 里的 `.md` 是你的原稿，`.html` 和根目录三个页面都是机器生成的，不要手改**——下次构建会覆盖。

## 如何新增一篇文章（三步）

1. **新建文件**：在 `posts/` 文件夹里新建一个 Markdown 文件（可用任意文本编辑器），文件名以日期开头，后接英文短横线标题，例如：

   ```
   2026-11-15-my-new-essay.md
   ```

   日期就是这个文章的发布日期，会按它排序。

2. **填头部信息 + 写正文**：打开文件，最上面写三行「frontmatter」，然后空一行，正文直接用 Markdown 写：

   ```markdown
   ---
   title: 文章标题（会显示在页面和列表里）
   date: 2026-11-15
   category: 随笔
   ---

   这里开始写正文。

   ## 二级标题

   > 这是引用块。

   ![图注文字](../images/xxx.png)   ← 插图，图片先放进 images/ 文件夹
   ```

   注意：`category` 必须是已有分类（阅读 / 诗歌 / 随笔）之一；新分类见下节。插图路径以 `../images/` 开头。

3. **重建网站**：打开终端（Mac 上是「终端」App），输入两行命令：

   ```bash
   cd /Users/work/personal-site
   node build.js
   ```

   看到「构建完成」就成功了。新文章会自动出现在首页「最新文章」和文章列表里，详情页的「上一篇 / 下一篇」也会自动接好。

## 如何新增一个分类

只改 `build.js` 里的**一处**配置：

```js
const CATEGORIES = ['阅读', '诗歌', '随笔', '新分类'];
```

如果希望新分类的文章详情页有独立的版式微调，再在 `CATEGORY_CLASS` 里补一行类名，并在 `css/style.css` 里加样式（可选，不加也能正常工作）。改完运行 `node build.js`，文章列表页顶部的筛选按钮会自动多出新分类。

## 如何本地预览

- **最简单**：直接双击 `index.html`，浏览器打开即可（文章之间的跳转都正常）。
- **更接近线上**：在终端运行：

  ```bash
  cd /Users/work/personal-site
  python3 -m http.server
  ```

  然后浏览器访问 `http://localhost:8000`。看完按 `Ctrl + C` 停止。

## 修改网站外观 / 个人信息

- 姓名、一句话简介：改 `build.js` 顶部 `SITE` 配置，重新构建。
- 颜色、字号、间距：全部集中在 `css/style.css` 最上方的 `:root` 区块，改一处全站生效。
