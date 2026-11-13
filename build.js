#!/usr/bin/env node
/**
 * build.js — 极简静态站点构建脚本
 * 零依赖，仅用 Node 内置模块。运行 `node build.js` 全量重建。
 */
'use strict';

const fs = require('fs');
const path = require('path');

/* ============================================================
 * 站点配置（改这里）
 * ========================================================== */

// 分类集中定义于这一处：新增分类只需往数组加名字，
// 并在 CATEGORY_CLASS 里补一个对应的样式类名（用于 CSS 微调）。
const CATEGORIES = ['阅读', '写作', '随笔', '诗歌', 'AI'];

const CATEGORY_CLASS = {
  '阅读': 'cat-reading',
  '写作': 'cat-writing',
  '随笔': 'cat-essay',
  '诗歌': 'cat-poetry',
  'AI': 'cat-ai',
};

const SITE = {
  name: '林间',
  intro: '读书，写诗，把日子过成慢火的文章。',
};

/* ============================================================
 * 构建逻辑（一般不需要动）
 * ========================================================== */

const ROOT = __dirname;
const POSTS_DIR = path.join(ROOT, 'posts');

const escapeHtml = (s) =>
  s.replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;')
   .replace(/"/g, '&quot;').replace(/'/g, '&#39;');

const formatDate = (iso) => {
  const [y, m, d] = iso.split('-').map(Number);
  return `${y} 年 ${m} 月 ${d} 日`;
};

// 文件名 2026-11-01-winter-beginning.md → slug "winter-beginning"
const slugOf = (filename) => filename.replace(/^\d{4}-\d{2}-\d{2}-/, '').replace(/\.md$/, '');

/* ---------- Markdown 极简解析 ---------- */

function parseFrontmatter(raw) {
  const m = raw.match(/^---\r?\n([\s\S]*?)\r?\n---\r?\n?([\s\S]*)$/);
  if (!m) throw new Error('缺少 frontmatter（文件需以 --- 开头，包含 title / date / category）');
  const meta = {};
  for (const line of m[1].split(/\r?\n/)) {
    const kv = line.match(/^(\w+)\s*:\s*(.+)$/);
    if (kv) meta[kv[1]] = kv[2].trim();
  }
  for (const key of ['title', 'date', 'category']) {
    if (!meta[key]) throw new Error(`frontmatter 缺少 ${key}`);
  }
  return { meta, body: m[2] };
}

function renderInline(text) {
  let s = escapeHtml(text);
  s = s.replace(/`([^`]+)`/g, '<code>$1</code>');
  s = s.replace(/\*\*([^*]+)\*\*/g, '<strong>$1</strong>');
  s = s.replace(/\*([^*]+)\*/g, '<em>$1</em>');
  s = s.replace(/\[([^\]]+)\]\(([^)]+)\)/g, '<a href="$2">$1</a>');
  return s;
}

function renderMarkdown(md) {
  const lines = md.replace(/\r\n/g, '\n').split('\n');
  const out = [];
  let i = 0;
  while (i < lines.length) {
    const line = lines[i];

    // 围栏代码块
    if (line.startsWith('```')) {
      const code = [];
      i++;
      while (i < lines.length && !lines[i].startsWith('```')) code.push(lines[i++]);
      i++; // 跳过结尾 ```
      out.push(`<pre><code>${escapeHtml(code.join('\n'))}</code></pre>`);
      continue;
    }

    // 标题（# → h1，## → h2，### → h3）
    const h = line.match(/^(#{1,3})\s+(.*)$/);
    if (h) {
      out.push(`<h${h[1].length}>${renderInline(h[2])}</h${h[1].length}>`);
      i++;
      continue;
    }

    // 水平分隔线
    if (/^(-{3,}|\*{3,})$/.test(line.trim())) {
      out.push('<hr>');
      i++;
      continue;
    }

    // 引用块（连续 > 行）
    if (line.startsWith('>')) {
      const quote = [];
      while (i < lines.length && lines[i].startsWith('>')) quote.push(lines[i++].replace(/^>\s?/, ''));
      out.push(`<blockquote>${quote.map((q) => `<p>${renderInline(q)}</p>`).join('\n')}</blockquote>`);
      continue;
    }

    // 独立成行的图片 ![图注](路径)
    const img = line.trim().match(/^!\[([^\]]*)\]\(([^)]+)\)$/);
    if (img) {
      const caption = img[1] ? `<figcaption>${escapeHtml(img[1])}</figcaption>` : '';
      out.push(`<figure><img src="${escapeHtml(img[2])}" alt="${escapeHtml(img[1] || '')}">${caption}</figure>`);
      i++;
      continue;
    }

    // 空行
    if (line.trim() === '') { i++; continue; }

    // 普通段落（连续非空行合并）
    const para = [];
    while (i < lines.length && lines[i].trim() !== '' &&
           !lines[i].startsWith('```') && !lines[i].startsWith('#') &&
           !lines[i].startsWith('>') && !/^(-{3,}|\*{3,})$/.test(lines[i].trim()) &&
           !/^!\[[^\]]*\]\([^)]+\)$/.test(lines[i].trim())) {
      para.push(lines[i++]);
    }
    if (!para.length) para.push(lines[i++]); // 兜底：避免无法归类的行导致死循环
    out.push(`<p>${renderInline(para.join('\n')).replace(/\n/g, '<br>')}</p>`);
  }
  return out.join('\n');
}

/* ---------- 页面模板 ---------- */

function layout({ title, active, body, root = '', pageClass = '' }) {
  const navLink = (href, label, key) =>
    `<a href="${root}${href}"${active === key ? ' class="active" aria-current="page"' : ''}>${label}</a>`;
  return `<!DOCTYPE html>
<html lang="zh-CN">
<head>
<meta charset="UTF-8">
<meta name="viewport" content="width=device-width, initial-scale=1.0">
<title>${escapeHtml(title)} · ${SITE.name}</title>
<meta name="description" content="${SITE.intro}">
<link rel="stylesheet" href="${root}css/style.css">
</head>
<body class="${pageClass}">
<header class="site-header">
  <nav class="site-nav wrap">
    <a class="site-name" href="${root}index.html">${SITE.name}</a>
    <div class="nav-links">
      ${navLink('index.html', '首页', 'home')}
      ${navLink('archives.html', '文章', 'archives')}
      ${navLink('about.html', '关于', 'about')}
    </div>
  </nav>
</header>
<main class="wrap">
${body}
</main>
<footer class="site-footer">
  <div class="wrap">© 2026 ${SITE.name} · 用文字记下经过的日子</div>
</footer>
</body>
</html>
`;
}

function postListItem(p, root = '') {
  return `<li class="post-item" data-category="${escapeHtml(p.category)}">
  <a class="post-link" href="${root}posts/${p.slug}.html">
    <time class="post-date" datetime="${p.date}">${p.date}</time>
    <span class="post-title">${escapeHtml(p.title)}</span>
    <span class="tag">${escapeHtml(p.category)}</span>
  </a>
</li>`;
}

/* ---------- 生成各页面 ---------- */

function buildIndex(posts) {
  const latest = posts.slice(0, 5);
  const body = `<section class="hero fade-in">
  <h1 class="hero-name">${SITE.name}</h1>
  <p class="hero-intro">${SITE.intro}</p>
  <a class="hero-about" href="about.html">关于我 →</a>
</section>
<section class="latest">
  <h2 class="section-heading">最新文章</h2>
  <ul class="post-list">
    ${latest.map((p) => postListItem(p)).join('\n')}
  </ul>
  <a class="all-posts" href="archives.html">全部文章 →</a>
</section>`;
  return layout({ title: '首页', active: 'home', body });
}

function buildArchives(posts) {
  const filters = ['全部', ...CATEGORIES]
    .map((c, idx) => `<button class="filter-btn${idx === 0 ? ' active' : ''}" data-filter="${escapeHtml(c)}">${escapeHtml(c)}</button>`)
    .join('\n    ');
  // 按年份分组（posts 已按日期倒序）
  const byYear = new Map();
  for (const p of posts) {
    const y = p.date.slice(0, 4);
    if (!byYear.has(y)) byYear.set(y, []);
    byYear.get(y).push(p);
  }
  const groups = [...byYear.entries()].map(([year, list]) => `
<section class="year-group">
  <h2 class="year-label">${year}</h2>
  <ul class="post-list">
    ${list.map((p) => postListItem(p)).join('\n')}
  </ul>
</section>`).join('\n');
  const body = `<h1 class="page-title">全部文章</h1>
<div class="filters" role="group" aria-label="分类筛选">
    ${filters}
</div>
<div id="archive-list">
  ${groups}
</div>`;
  const js = `<script>
(function () {
  var btns = document.querySelectorAll('.filter-btn');
  var items = document.querySelectorAll('#archive-list .post-item');
  var groups = document.querySelectorAll('#archive-list .year-group');
  btns.forEach(function (btn) {
    btn.addEventListener('click', function () {
      btns.forEach(function (b) { b.classList.remove('active'); });
      btn.classList.add('active');
      var f = btn.getAttribute('data-filter');
      items.forEach(function (it) {
        it.hidden = (f !== '全部') && it.getAttribute('data-category') !== f;
      });
      groups.forEach(function (g) {
        var visible = Array.prototype.some.call(
          g.querySelectorAll('.post-item'),
          function (it) { return !it.hidden; }
        );
        g.hidden = !visible;
      });
    });
  });
})();
</script>`;
  return layout({ title: '文章', active: 'archives', body: body + js });
}

function buildAbout() {
  const body = `<article class="about">
  <h1 class="page-title">关于我</h1>
  <div class="post-body">
    <p>你好，我是<strong>林间</strong>，一个把写字当作过日子方式的人。</p>
    <p>白天在屏幕里讨生活，晚上回到纸面上。读得多的时候写书评，心里有风的时候写诗，其余的日子，记一点随笔——关于食物、天气、路上的人，以及所有来不及命名的心情。</p>
    <p>这里没有宏大的主题，只有一些诚实的句子。如果你在某一段里认出了自己，那我们就算认识了。</p>
    <h2>联系我</h2>
    <div class="contact-box">
      <ul>
        <li>邮箱：<a href="mailto:hello@example.com">hello@example.com</a></li>
        <li>Usually 回信在三天以内，慢一点的时候，说明我在写一首难产的诗。</li>
      </ul>
    </div>
  </div>
</article>`;
  return layout({ title: '关于我', active: 'about', body });
}

function buildPostPage(p, posts) {
  // posts 按日期倒序。上一篇 = 更早一篇（下标+1），下一篇 = 更新一篇（下标-1）
  const idx = posts.indexOf(p);
  const older = posts[idx + 1];
  const newer = posts[idx - 1];

  const prevNext = [];
  if (newer) prevNext.push(`<a class="pn-link pn-next" href="${newer.slug}.html"><span class="pn-label">下一篇</span><span class="pn-title">${escapeHtml(newer.title)}</span></a>`);
  if (older) prevNext.push(`<a class="pn-link pn-prev" href="${older.slug}.html"><span class="pn-label">上一篇</span><span class="pn-title">${escapeHtml(older.title)}</span></a>`);
  const prevNextHtml = prevNext.length
    ? `<nav class="prev-next">${prevNext.join('\n')}</nav>`
    : '';

  const body = `<article class="post${p.category === '诗歌' ? ' post-poetry' : ''}">
  <a class="back-link" href="../archives.html">← 返回</a>
  <header class="post-header">
    <h1 class="post-heading">${escapeHtml(p.title)}</h1>
    <div class="post-meta">
      <time datetime="${p.date}">${formatDate(p.date)}</time>
      <span class="tag tag-${CATEGORY_CLASS[p.category] || ''}">${escapeHtml(p.category)}</span>
    </div>
  </header>
  <div class="post-body">
${p.html}
  </div>
  ${prevNextHtml}
</article>`;
  return layout({
    title: p.title,
    active: 'archives',
    root: '../',
    pageClass: `page-post ${CATEGORY_CLASS[p.category] || ''}`,
    body,
  });
}

/* ---------- 主流程 ---------- */

function main() {
  const files = fs.readdirSync(POSTS_DIR).filter((f) => f.endsWith('.md'));
  if (!files.length) { console.log('posts/ 下没有找到 .md 文件'); return; }

  let posts;
  try {
    posts = files.map((f) => {
      const raw = fs.readFileSync(path.join(POSTS_DIR, f), 'utf8');
      const { meta, body } = parseFrontmatter(raw);
      if (!CATEGORIES.includes(meta.category)) {
        throw new Error(`分类「${meta.category}」未在 build.js 的 CATEGORIES 中定义`);
      }
      return {
        slug: slugOf(f),
        title: meta.title,
        date: meta.date,
        category: meta.category,
        html: renderMarkdown(body),
      };
    });
  } catch (e) {
    console.error('解析文章失败：', e.message);
    process.exit(1);
  }

  // 按日期倒序（同日按文件名倒序保持稳定）
  posts.sort((a, b) => (b.date + b.slug).localeCompare(a.date + a.slug));

  fs.writeFileSync(path.join(ROOT, 'index.html'), buildIndex(posts));
  fs.writeFileSync(path.join(ROOT, 'archives.html'), buildArchives(posts));
  fs.writeFileSync(path.join(ROOT, 'about.html'), buildAbout());
  for (const p of posts) {
    fs.writeFileSync(path.join(POSTS_DIR, `${p.slug}.html`), buildPostPage(p, posts));
  }
  console.log(`构建完成：index / about / archives + ${posts.length} 篇文章页`);
  for (const p of posts) console.log(`  · ${p.date} [${p.category}] ${p.title} → posts/${p.slug}.html`);
}

// 直接运行时构建；被 admin.js require 时只导出函数不执行
if (require.main === module) main();

module.exports = { CATEGORIES, CATEGORY_CLASS, SITE, parseFrontmatter, renderMarkdown, main };
