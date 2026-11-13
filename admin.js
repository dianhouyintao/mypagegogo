#!/usr/bin/env node
/**
 * admin.js — 本地文章录入后台
 * 零依赖，仅用 Node 内置模块。运行 `node admin.js` 后自动打开浏览器。
 * 只监听本机（127.0.0.1），外部无法访问；关掉终端窗口即关闭后台。
 */
'use strict';

const fs = require('fs');
const path = require('path');
const http = require('http');
const { exec } = require('child_process');
const site = require('./build.js');

const ROOT = __dirname;
const POSTS_DIR = path.join(ROOT, 'posts');
const IMAGES_DIR = path.join(ROOT, 'images');
const BASE_PORT = 4321;

/* ---------- 工具 ---------- */

const escapeHtml = (s) =>
  s.replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;')
   .replace(/"/g, '&quot;').replace(/'/g, '&#39;');

// 安全校验：只允许 posts/ 下已存在的 .md 文件名，杜绝路径穿越
function safePostFile(file) {
  const name = path.basename(String(file || ''));
  if (!name.endsWith('.md')) return null;
  const full = path.join(POSTS_DIR, name);
  return fs.existsSync(full) ? name : null;
}

function listPosts() {
  return fs.readdirSync(POSTS_DIR)
    .filter((f) => f.endsWith('.md'))
    .map((f) => {
      try {
        const { meta } = site.parseFrontmatter(fs.readFileSync(path.join(POSTS_DIR, f), 'utf8'));
        return { file: f, title: meta.title, date: meta.date, category: meta.category };
      } catch { return { file: f, title: `⚠ 解析失败：${f}`, date: '', category: '' }; }
    })
    .sort((a, b) => (b.date + b.file).localeCompare(a.date + a.file));
}

function rebuild() {
  const log = [];
  const origLog = console.log;
  console.log = (...a) => log.push(a.join(' '));
  try { site.main(); } finally { console.log = origLog; }
  return log.join('\n');
}

function newFilename(date) {
  const rand = Math.random().toString(16).slice(2, 10);
  return `${date}-art${rand}.md`;
}

function readBody(req) {
  return new Promise((resolve, reject) => {
    let data = '';
    req.on('data', (c) => {
      data += c;
      if (data.length > 20 * 1024 * 1024) { reject(new Error('内容过大')); req.destroy(); }
    });
    req.on('end', () => resolve(data));
    req.on('error', reject);
  });
}

function json(res, code, obj) {
  res.writeHead(code, { 'Content-Type': 'application/json; charset=utf-8' });
  res.end(JSON.stringify(obj));
}

/* ---------- 路由 ---------- */

const server = http.createServer(async (req, res) => {
  const url = new URL(req.url, `http://127.0.0.1`);
  try {
    // 页面
    if (req.method === 'GET' && url.pathname === '/') {
      res.writeHead(200, { 'Content-Type': 'text/html; charset=utf-8' });
      res.end(fs.readFileSync(path.join(ROOT, 'admin.html')));
      return;
    }

    // 文章列表 + 分类
    if (req.method === 'GET' && url.pathname === '/api/meta') {
      json(res, 200, { categories: site.CATEGORIES, posts: listPosts() });
      return;
    }

    // 读取单篇原稿（供编辑）
    if (req.method === 'GET' && url.pathname === '/api/post') {
      const file = safePostFile(url.searchParams.get('file'));
      if (!file) return json(res, 404, { error: '文章不存在' });
      json(res, 200, { file, raw: fs.readFileSync(path.join(POSTS_DIR, file), 'utf8') });
      return;
    }

    // 预览：用与正式构建完全相同的渲染器
    if (req.method === 'POST' && url.pathname === '/api/preview') {
      const { body } = JSON.parse(await readBody(req));
      json(res, 200, { html: site.renderMarkdown(String(body || '')) });
      return;
    }

    // 保存：新建或覆盖，随后重建站点
    if (req.method === 'POST' && url.pathname === '/api/save') {
      const { file, title, date, category, body } = JSON.parse(await readBody(req));
      if (!title || !title.trim()) return json(res, 400, { error: '标题不能为空' });
      if (!/^\d{4}-\d{2}-\d{2}$/.test(date || '')) return json(res, 400, { error: '日期格式应为 YYYY-MM-DD' });
      if (!site.CATEGORIES.includes(category)) return json(res, 400, { error: `分类必须是：${site.CATEGORIES.join(' / ')}` });
      if (!String(body || '').trim()) return json(res, 400, { error: '正文不能为空' });

      let target;
      if (file) {
        target = safePostFile(file);
        if (!target) return json(res, 404, { error: '要编辑的文章不存在' });
      } else {
        target = newFilename(date);
      }

      const md = `---\ntitle: ${title.trim()}\ndate: ${date}\ncategory: ${category}\n---\n\n${String(body).replace(/\r\n/g, '\n').trim()}\n`;
      fs.writeFileSync(path.join(POSTS_DIR, target), md);
      const log = rebuild();
      json(res, 200, { ok: true, file: target, log });
      return;
    }

    // 上传图片（base64），返回可粘贴的 Markdown 片段
    if (req.method === 'POST' && url.pathname === '/api/upload') {
      const { name, data } = JSON.parse(await readBody(req));
      const ext = path.extname(String(name || '')).toLowerCase();
      if (!['.png', '.jpg', '.jpeg', '.gif', '.webp', '.svg'].includes(ext)) {
        return json(res, 400, { error: '仅支持 png / jpg / gif / webp / svg' });
      }
      const buf = Buffer.from(String(data || '').split(',').pop(), 'base64');
      if (!buf.length) return json(res, 400, { error: '图片数据为空' });
      const rand = Math.random().toString(16).slice(2, 10);
      const fname = `${rand}${ext}`;
      fs.writeFileSync(path.join(IMAGES_DIR, fname), buf);
      json(res, 200, { ok: true, file: fname, snippet: `![图注](../images/${fname})` });
      return;
    }

    json(res, 404, { error: '未知接口' });
  } catch (e) {
    json(res, 500, { error: e.message });
  }
});

/* ---------- 启动 ---------- */

function listen(port) {
  server.on('error', () => {
    if (port < BASE_PORT + 20) listen(port + 1); // 端口被占就顺延
    else console.error('找不到可用端口');
  });
  server.listen(port, '127.0.0.1', () => {
    const addr = `http://localhost:${port}`;
    console.log(`录入后台已启动：${addr}`);
    console.log('关掉本窗口（或按 Ctrl+C）即可关闭后台。');
    if (process.platform === 'darwin') exec(`open ${addr}`);
  });
}

listen(BASE_PORT);
