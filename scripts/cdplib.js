/**
 * cdplib.js — B站发布专用 CDP 连接封装（playwright-core 直连隔离 Chrome）
 *
 * 约定：
 *   - 本文件只负责「连上隔离 Chrome + 定位编辑器 iframe + 基础动作」，不含业务逻辑
 *   - 业务动作（填标题/注入正文/插图/发布/验证码）在 bili_publish_pw.js
 *   - 解包只在这里做一次，业务侧拿到的就是最终值（避免 NO_VAL 假错误）
 *
 * 环境变量：
 *   OPENCLAW_NODE_MODULES  playwright-core 所在 node_modules（不设则运行时自动探测）
 *   BILI_CDP_PORT          CDP 端口，默认 9222
 */

const path = require('path');
const fs = require('fs');

const NODE_MODULES = process.env.OPENCLAW_NODE_MODULES || null;

const CDP_PORT = process.env.BILI_CDP_PORT || '9222';
const CDP_URL = 'http://127.0.0.1:' + CDP_PORT;

const PUBLISH_URL = 'https://member.bilibili.com/platform/upload/text/new-edit';
const MANAGER_URL = 'https://member.bilibili.com/platform/upload-manager/opus';
const EDITOR_FRAME_KEY = 'read-editor';   // 编辑器 iframe：member.bilibili.com/york/read-editor

function sleep(ms) { return new Promise(function (r) { setTimeout(r, ms); }); }

function loadPlaywright() {
  // 首选：公共解析器（不写死用户名 / 盘符 / 版本号）
  try {
    return require(path.resolve(__dirname, '..', '..', 'isolated-browser', 'scripts', 'pathkit.js')).resolvePlaywright();
  } catch (e) { /* 回退本地探测 */ }
  var home = process.env.USERPROFILE || process.env.HOME || '';
  var cands = [NODE_MODULES, home && path.join(home, '.workbuddy', 'binaries', 'node', 'workspace', 'node_modules')].filter(Boolean);
  for (var i = 0; i < cands.length; i++) {
    var p = path.join(cands[i], 'playwright-core');
    if (fs.existsSync(p)) return require(p);
  }
  throw new Error('未找到 playwright-core。请设置 OPENCLAW_NODE_MODULES 指向含 playwright-core 的 node_modules');
}

/** 连接隔离 Chrome，返回 { browser, ctx, page } */
async function connect() {
  var chromium = loadPlaywright().chromium;
  var browser = await chromium.connectOverCDP(CDP_URL);
  var ctx = browser.contexts()[0];
  if (!ctx) throw new Error('CDP 已连上但没有 context，请确认隔离 Chrome 已启动（../isolated-browser/scripts/launch.js）');
  var page = ctx.pages().find(function (p) { return p.url().indexOf('member.bilibili.com') >= 0; }) || ctx.pages()[0];
  if (!page) throw new Error('隔离 Chrome 里没有可用标签页');
  return { browser: browser, ctx: ctx, page: page };
}

/** 在页面里定位编辑器 iframe（轮询等待） */
async function getEditorFrame(page, timeoutMs) {
  timeoutMs = timeoutMs || 40000;
  var t0 = Date.now();
  while (Date.now() - t0 < timeoutMs) {
    var f = page.frames().find(function (x) { return x.url().indexOf(EDITOR_FRAME_KEY) >= 0; });
    if (f) {
      var ok = await f.locator('.tiptap.ProseMirror').count().catch(function () { return 0; });
      if (ok) return f;
    }
    await sleep(1000);
  }
  throw new Error('等待编辑器 iframe 超时（' + timeoutMs + 'ms）');
}

/** 打开（或复用）发布页 */
async function openEditor(page) {
  if (page.url().indexOf('upload/text/new-edit') < 0) {
    await page.goto(PUBLISH_URL, { waitUntil: 'domcontentloaded', timeout: 45000 });
  }
  return getEditorFrame(page);
}

/** 重载到全新编辑器（/new-edit 不会恢复草稿，重载即清空） */
async function freshEditor(page) {
  await page.goto(PUBLISH_URL, { waitUntil: 'domcontentloaded', timeout: 45000 });
  return getEditorFrame(page);
}

/** 整页截图（⚠️ 不要用 playwright 的 page.screenshot / CDP clip+scale：在本页会挂起） */
async function fullScreenshot(page, file) {
  var session = await page.context().newCDPSession(page);
  var r = await session.send('Page.captureScreenshot', { format: 'png' });
  fs.writeFileSync(file, Buffer.from(r.data, 'base64'));
  return file;
}

module.exports = {
  NODE_MODULES, CDP_PORT, CDP_URL, PUBLISH_URL, MANAGER_URL, EDITOR_FRAME_KEY,
  sleep, loadPlaywright, connect, getEditorFrame, openEditor, freshEditor, fullScreenshot,
};
