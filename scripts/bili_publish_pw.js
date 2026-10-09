#!/usr/bin/env node
/**
 * bili_publish_pw.js — B站专栏文章发布（playwright-core 直连隔离 Chrome CDP）
 *
 * 覆盖全流程：填标题 → 粘贴注入正文 → 段落间插图 → 保存/发布 → 风控验证码 → 结果校验
 *
 * ── 用法 ─────────────────────────────────────────────────────────────────
 *   # 1) 发布（无图）
 *   node scripts/bili_publish_pw.js --title-file t.txt --body-file b.txt --publish
 *
 *   # 2) 发布 + 在第 2 段之后插图
 *   node scripts/bili_publish_pw.js --title-file t.txt --body-file b.txt \
 *        --image <素材目录>/14.jpg --image-at 2 --publish
 *
 *   # 3) 发布被风控拦下 → 脚本导出验证码图并退出(码2)，人工/Agent 读出后补填
 *   node scripts/bili_publish_pw.js --captcha M5hcD
 *
 *   # 4) 只填不发布（存草稿）、查最近发布结果、探测编辑器结构
 *   node scripts/bili_publish_pw.js --title-file t.txt --body-file b.txt
 *   node scripts/bili_publish_pw.js --title-file t.txt --body-file b.txt --no-save   # 纯自检，不碰草稿
 *   node scripts/bili_publish_pw.js --status
 *   node scripts/bili_publish_pw.js --probe
 *
 * ── 参数 ─────────────────────────────────────────────────────────────────
 *   --title-file <f>   标题文件（纯文本，首行）
 *   --title <s>        标题（与 title-file 二选一）
 *   --body-file <f>    正文文件。默认「一行一段」（空行忽略）；--body-mode blank 改为「空行分段」
 *   --body-mode line|blank
 *   --image <f>        配图路径（本地文件）
 *   --image-at <N>     配图插到「第 N 段之后」（1 基，段落之间）；默认 1
 *   --publish          真正提交发布（缺省=只填内容存草稿）
 *   --no-save          配合缺省模式：只填充+自检，不触发保存草稿
 *   --captcha <code>   补填风控验证码并继续发布
 *   --out-dir <d>      验证码图/截图输出目录，默认当前目录
 *   --status           查询最近一篇的发布状态（opus/creationlist）
 *   --probe            打印编辑器 DOM 结构（排障用）
 *
 * 退出码：0 成功 / 2 需要验证码 / 1 失败
 */

const fs = require('fs');
const path = require('path');
const lib = require('./cdplib');
const { sleep } = lib;

// ───────────────────────── 参数解析 ─────────────────────────
function arg(name, def) {
  const i = process.argv.indexOf('--' + name);
  if (i < 0) return def;
  const v = process.argv[i + 1];
  return (v === undefined || v.startsWith('--')) ? true : v;
}
const A = {
  titleFile: arg('title-file'), title: arg('title'),
  bodyFile: arg('body-file'), bodyMode: arg('body-mode', 'line'),
  image: arg('image'), imageAt: parseInt(arg('image-at', '1'), 10) || 1,
  publish: !!arg('publish', false),
  noSave: !!arg('no-save', false),
  captcha: arg('captcha'), outDir: arg('out-dir', process.cwd()),
  status: !!arg('status', false), probe: !!arg('probe', false),
};
if (!fs.existsSync(A.outDir)) fs.mkdirSync(A.outDir, { recursive: true });

function log(...a) { console.log(...a); }

// ───────────────────────── 内容装载 ─────────────────────────
function loadArticle() {
  let title = typeof A.title === 'string' ? A.title : '';
  if (!title && typeof A.titleFile === 'string') {
    title = fs.readFileSync(A.titleFile, 'utf8').split(/\r?\n/).map(s => s.trim()).filter(Boolean)[0] || '';
  }
  let paras = [];
  if (typeof A.bodyFile === 'string') {
    const raw = fs.readFileSync(A.bodyFile, 'utf8').replace(/\r\n/g, '\n');
    if (A.bodyMode === 'blank') paras = raw.split(/\n\s*\n/).map(s => s.trim()).filter(Boolean);
    else paras = raw.split('\n').map(s => s.trim()).filter(Boolean);
  }
  return { title, paras };
}

// ───────────────────────── 页面动作 ─────────────────────────

/** 填标题：.title-input__inner 是 textarea，locator.fill 即可（React 事件由 playwright 真实触发） */
async function fillTitle(ed, title) {
  const t = ed.locator('.title-input__inner');
  await t.click({ timeout: 10000 });
  await t.fill('');
  await t.fill(title);
  await sleep(400);
  const v = await t.inputValue();
  if (v !== title) throw new Error('标题写入校验失败: ' + v);
  log('  ✓ 标题:', v);
}

/** 正文注入：模拟 paste 事件（唯一可靠方式，重载不丢） */
async function fillBody(ed, paras) {
  const html = paras.map(p => '<p>' + p.replace(/</g, '&lt;').replace(/>/g, '&gt;') + '</p>').join('');
  await ed.evaluate(h => {
    const el = document.querySelector('.tiptap.ProseMirror');
    el.focus();
    const dt = new DataTransfer();
    dt.setData('text/html', h);
    dt.setData('text/plain', h.replace(/<[^>]+>/g, ''));
    el.dispatchEvent(new ClipboardEvent('paste', { clipboardData: dt, bubbles: true, cancelable: true }));
  }, html);
  await sleep(1500);
  const kids = await ed.evaluate(() => document.querySelector('.tiptap.ProseMirror').children.length);
  if (kids < Math.max(1, paras.length - 2)) throw new Error('正文注入异常，段落数=' + kids);
  log('  ✓ 正文:', kids, '个块 /', paras.length, '段');
}

/** 光标定位到第 n 段（1 基）末尾 */
async function putCursorAtEnd(ed, n) {
  await ed.evaluate(idx => {
    const el = document.querySelector('.tiptap.ProseMirror');
    const p = el.children[idx];
    if (!p) return;
    const range = document.createRange();
    range.selectNodeContents(p);
    range.collapse(false);
    const sel = window.getSelection();
    sel.removeAllRanges();
    sel.addRange(range);
  }, n - 1);
  await sleep(300);
}

/**
 * 插图：唯一可靠方案 = 粘贴图片文件
 *  - ❌ 工具栏 eva3-toolbar-image + filechooser：插进来是「本地 base64 预览」，不走 upload_bfs
 *  - ✅ DataTransfer.items.add(File) + ClipboardEvent('paste') → 触发 POST .../draw/upload_bfs
 *  - 注意：DOM 里 img.src 一直是 data:image/jpeg;base64 属正常，序列化（草稿/发布）时才是图床 URL
 */
async function insertImage(ed, imgPath) {
  const b64 = fs.readFileSync(imgPath).toString('base64');
  const name = path.basename(imgPath);
  const ext = (path.extname(imgPath) || '.jpg').replace('.', '');
  await ed.evaluate(({ b64, name, ext }) => {
    const bin = atob(b64);
    const arr = new Uint8Array(bin.length);
    for (let i = 0; i < bin.length; i++) arr[i] = bin.charCodeAt(i);
    const file = new File([arr], name, { type: 'image/' + (ext === 'jpg' ? 'jpeg' : ext) });
    const dt = new DataTransfer();
    dt.items.add(file);
    const el = document.querySelector('.tiptap.ProseMirror');
    el.focus();
    el.dispatchEvent(new ClipboardEvent('paste', { clipboardData: dt, bubbles: true, cancelable: true }));
  }, { b64, name, ext });

  // 等图片节点出现（src 保持 base64 是正常的，不要等它变 http）
  for (let i = 0; i < 40; i++) {
    await sleep(1000);
    const ok = await ed.evaluate(() => document.querySelectorAll('.tiptap.ProseMirror img').length);
    if (ok) { log('  ✓ 配图已插入（本地预览态，上传在后台）'); return true; }
  }
  throw new Error('配图插入超时');
}

/** 打印块序列（校验配图位置） */
async function dumpSeq(ed) {
  const seq = await ed.evaluate(() => [...document.querySelector('.tiptap.ProseMirror').children].map((c, i) => {
    const im = c.querySelector && c.querySelector('img');
    return i + ':' + c.tagName + (im ? '[IMG ' + (im.src.startsWith('data') ? 'base64预览' : '图床') + ']' : '::' + (c.innerText || '').replace(/\n/g, '').slice(0, 14));
  }));
  seq.forEach(s => log('   ', s));
  return seq;
}

/** 抓一次草稿序列化，确认图片已换成图床 URL */
async function waitDraftWithImage(page, timeoutMs) {
  timeoutMs = timeoutMs || 60000;
  return new Promise(resolve => {
    let done = false;
    const h = r => {
      if (done || !/draft\/(add|update)/.test(r.url())) return;
      const p = r.postData();
      if (!p || p.length < 500) return;
      done = true;
      page.off('request', h);
      resolve({ hasRemote: p.includes('hdslb.com'), dataImgs: (p.match(/data:image/g) || []).length, body: p });
    };
    page.on('request', h);
    // 触发一次保存，保证有序列化请求
    sleep(1500).then(() => saveDraft(page)).catch(() => {});
    setTimeout(() => { if (!done) { done = true; page.off('request', h); resolve(null); } }, timeoutMs);
  });
}

async function saveDraft(page) {
  const ed = await lib.getEditorFrame(page, 5000).catch(() => null);
  if (!ed) return;
  await ed.locator('button', { hasText: '保存为草稿' }).last().click({ timeout: 5000 }).catch(() => {});
}

/** 读验证码图并导出；返回文件路径 */
async function grabCaptcha(ed, outDir) {
  const src = await ed.evaluate(() => {
    const im = document.querySelector('.bili-img-verify img');
    return im ? im.src : null;
  }).catch(() => null);
  if (!src) return null;
  const f = path.join(outDir, 'bili_captcha.png');
  fs.writeFileSync(f, Buffer.from(src.split(',')[1], 'base64'));
  return f;
}

/** 填验证码 + 确定 */
async function solveCaptcha(ed, code) {
  const inp = ed.locator('input.code-input');
  await inp.click({ timeout: 8000 });
  await inp.fill('');
  await inp.type(code, { delay: 70 });
  await sleep(300);
  await ed.locator('.bili-img-verify').locator('text=确定').first().click({ timeout: 8000 });
  log('  ✓ 验证码已提交:', code);
  await sleep(1500);
}

/** 点发布 */
async function clickPublish(ed) {
  await ed.locator('button', { hasText: '发布' }).last().click({ timeout: 8000 });
}

/**
 * 等待发布结果
 * 成功标志：① URL 离开 new-edit ② 出现 vui_dialog「你的专栏已提交成功」
 */
async function waitResult(page, ed, timeoutMs) {
  timeoutMs = timeoutMs || 70000;
  const t0 = Date.now();
  while (Date.now() - t0 < timeoutMs) {
    await sleep(1000);
    if (page.url().indexOf('new-edit') < 0) return { ok: true, how: 'url', url: page.url() };
    const dlg = await ed.evaluate(() => {
      const d = [...document.querySelectorAll('[class*=vui_dialog--wrapper]')].find(x => x.getBoundingClientRect().width > 0);
      return d ? d.innerText.replace(/\s+/g, ' ') : '';
    }).catch(() => '');
    if (dlg && dlg.indexOf('提交成功') >= 0) return { ok: true, how: 'dialog', msg: dlg };
    if (await ed.locator('input.code-input').count().catch(() => 0)) return { ok: false, needCaptcha: true };
  }
  return { ok: false, msg: '超时未见成功标志' };
}

/** 查询最近发布结果 */
async function status(page) {
  const f = page.frames().find(x => x.url().indexOf('opus/management') >= 0)
    || page.frames().find(x => x.url().indexOf('bilibili.com') >= 0);
  const data = await f.evaluate(async () => {
    const r = await fetch('https://api.bilibili.com/x/polymer/web-dynamic/v1/opus/creationlist?ps=10&pn=1&classification_type=0&creation_type=0', { credentials: 'include' });
    return await r.json();
  }).catch(e => ({ err: e.message }));
  const items = (data && data.data && data.data.items) || [];
  if (!items.length) { log('（无已发布内容或接口异常）', JSON.stringify(data).slice(0, 200)); return null; }
  const it = items[0];
  const info = {
    title: it.title, dyn_id: it.dyn_id, rid: it.rid, pub_time: it.pub_time,
    url: 'https://www.bilibili.com/opus/' + it.dyn_id,
    imgInSummary: /\[图片\]/.test(it.summary || ''),
  };
  log('最近一篇:'); log(JSON.stringify(info, null, 1));
  return info;
}

/** 编辑器结构探测 */
async function probe(ed) {
  const info = await ed.evaluate(() => {
    const out = { url: location.href, title: null, editables: [], fileInputs: [], buttons: [], toolbar: [], imgs: [] };
    const ta = document.querySelector('.title-input__inner');
    out.title = ta ? { tag: ta.tagName, ph: ta.placeholder, val: ta.value } : null;
    document.querySelectorAll('[contenteditable="true"]').forEach(e => out.editables.push({ cls: String(e.className).slice(0, 80), tag: e.tagName }));
    document.querySelectorAll('input[type=file]').forEach(e => out.fileInputs.push({ accept: e.accept, cls: String(e.className).slice(0, 50) }));
    document.querySelectorAll('button').forEach(e => { if (out.buttons.length < 20) out.buttons.push(e.innerText.trim().slice(0, 16)); });
    document.querySelectorAll('eva3-toolbar-item').forEach(e => { if (out.toolbar.length < 40) out.toolbar.push(e.tagName.toLowerCase()); });
    document.querySelectorAll('.tiptap.ProseMirror img').forEach(e => out.imgs.push(e.src.slice(0, 40)));
    return out;
  });
  log(JSON.stringify(info, null, 1));
}

// ───────────────────────── 主流程 ─────────────────────────
(async () => {
  const { browser, page } = await lib.connect();
  try {
    // 模式：查状态
    if (A.status) {
      if (page.url().indexOf('bilibili.com') < 0) await page.goto(lib.MANAGER_URL, { waitUntil: 'domcontentloaded' });
      await sleep(2500);
      await status(page);
      return;
    }
    // 模式：补验证码并继续发布
    if (typeof A.captcha === 'string') {
      const ed = await lib.getEditorFrame(page);
      log('[验证码] 补填并继续发布...');
      await solveCaptcha(ed, A.captcha);
      await clickPublish(ed);
      const r = await waitResult(page, ed);
      if (r.ok) { log('=== 发布成功 ===', r.url || r.msg); const s = await status(page); if (s) log('文章链接:', s.url); return; }
      if (r.needCaptcha) { const f = await grabCaptcha(ed, A.outDir); log('CAPTCHA_REQUIRED', f); process.exitCode = 2; return; }
      throw new Error(r.msg);
    }

    const { title, paras } = loadArticle();
    if (!title || !paras.length) throw new Error('缺少标题或正文（--title-file / --body-file）');

    // 全新编辑器（重载清空，/new-edit 不会恢复草稿）
    log('[1/6] 打开全新编辑器...');
    const ed = await lib.freshEditor(page);
    log('  ✓ 编辑器就绪');

    if (A.probe) { await probe(ed); return; }

    log('[2/6] 填标题...'); await fillTitle(ed, title);
    log('[3/6] 注入正文...'); await fillBody(ed, paras);

    if (typeof A.image === 'string') {
      log('[4/6] 插图（第', A.imageAt, '段之后）...');
      await putCursorAtEnd(ed, A.imageAt);
      await insertImage(ed, A.image);
    } else log('[4/6] 无配图，跳过');

    log('[5/6] 校验块结构...');
    await dumpSeq(ed);

    if (A.noSave) {
      log('=== 自检完成（--no-save，未触发保存）===');
      return;
    }

    const draft = await waitDraftWithImage(page);
    if (draft) log('  ✓ 草稿序列化：图床URL=' + draft.hasRemote + ' / base64残留=' + draft.dataImgs);
    if (typeof A.image === 'string' && draft && !draft.hasRemote) log('  ⚠️ 警告：草稿里图片仍是 base64，发布后可能失效');

    if (!A.publish) {
      log('=== 已保存草稿（未发布）。加 --publish 才会提交 ===');
      return;
    }

    log('[6/6] 发布...');
    await clickPublish(ed);
    let r = await waitResult(page, ed);
    if (!r.ok && r.needCaptcha) {
      const f = await grabCaptcha(ed, A.outDir);
      log('⚠️ 触发风控验证码（create/opus 返回 -352）');
      log('验证码图已导出:', f);
      log('请读出图中的字符，然后执行：node scripts/bili_publish_pw.js --captcha <字符>');
      process.exitCode = 2;
      return;
    }
    if (!r.ok) throw new Error(r.msg || '发布失败');
    log('=== 发布成功 ===', r.url || r.msg);
    const s = await status(page);
    if (s) log('文章链接:', s.url);
  } finally {
    await browser.close().catch(() => {});
  }
})().catch(e => { console.error('ERR', e.message); process.exit(1); });
