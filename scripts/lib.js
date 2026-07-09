/**
 * B站文章发布 - xb CLI 封装库
 * 
 * 浏览器驱动：xb CLI（agent-browser 0.25.3 封装）
 * 可用路径：
 *   - 主：C:\Users\菠萝\.qclaw\skills\xbrowser\scripts\xb.cjs
 *   - 备：F:\qclaw\v0.2.32.610\resources\openclaw\config\skills\xbrowser\scripts\xb.cjs
 * 
 * 验证状态（2026-07-09）：
 *   - ✅ 标题填写：textarea native setter + 4事件（input/change/keyup/blur）
 *   - ✅ 正文填写：.tiptap.ProseMirror innerHTML + dispatchEvent
 *   - ✅ 标题+正文都在 iframe(member.bilibili.com/york/read-editor) 内
 *   - ✅ 发布按钮：MouseEvent 三件套（mousedown+mouseup+click）
 *   - ⚠️ 登录验证码：极验 geetest 无法自动化，必须用户手动
 *   - ⚠️ 发布弹验证码：点发布后可能弹「请输入图片中的内容」，需用户手动
 */

const { execSync } = require('child_process');
const fs = require('fs');
const path = require('path');

// ============================================================
// 配置
// ============================================================

const XB_PATH = 'C:\\Users\\菠萝\\.qclaw\\skills\\xbrowser\\scripts\\xb.cjs';
const WORKSPACE = 'C:\\Users\\菠萝\\.qclaw\\workspace-agent-67effa96';
const PUBLISH_URL = 'https://member.bilibili.com/platform/upload/text/new-edit';
const LOGIN_URL_PATTERN = 'passport.bilibili.com';
const PUBLISHED_URL_PATTERN = 'member.bilibili.com';

// ============================================================
// xb 命令执行
// ============================================================

/**
 * 执行 xb 命令
 * @param {string} action - xb 的 action（含参数），如 'open URL'、'snapshot -i'
 * @param {number} timeout - 超时毫秒
 * @returns {{ code: number, data: object|null, raw: string }}
 */
function xb(action, timeout = 25000) {
  const fullCmd = `"node" "${XB_PATH}" run --browser chrome ${action}`;
  try {
    const out = execSync(fullCmd, {
      timeout,
      windowsHide: true,
      encoding: 'utf8',
      maxBuffer: 10 * 1024 * 1024,
    });
    // 从输出中提取最后一个 JSON
    const lines = out.trim().split('\n');
    let jsonStr = null;
    for (let i = lines.length - 1; i >= 0; i--) {
      const line = lines[i].trim();
      if (line.startsWith('{') || line.startsWith('[')) {
        jsonStr = line;
        break;
      }
    }
    if (!jsonStr) {
      return { code: 0, data: null, raw: out.trim() };
    }
    try {
      return { code: 0, data: JSON.parse(jsonStr), raw: out.trim() };
    } catch (e) {
      return { code: 0, data: null, raw: out.trim() };
    }
  } catch (e) {
    // 即使 exit code 非零，输出中可能仍有 JSON
    const out = e.stdout || e.message || String(e);
    const lines = out.trim().split('\n');
    for (let i = lines.length - 1; i >= 0; i--) {
      const line = lines[i].trim();
      if (line.startsWith('{')) {
        try {
          return { code: e.status || 1, data: JSON.parse(line), raw: out.trim() };
        } catch (_) {}
      }
    }
    return { code: e.status || 1, data: null, raw: out.trim() };
  }
}

/**
 * 通过独立 JS 文件执行 eval（避免 PowerShell 引号 + xb base64 编码问题）
 * @param {string} jsFilePath - JS 文件路径
 * @param {number} timeout - 超时毫秒
 * @returns {{ code: number, result: any }}
 */
function evalJsFile(jsFilePath, timeout = 20000) {
  const js = fs.readFileSync(jsFilePath, 'utf8');
  const b64 = Buffer.from(js, 'utf8').toString('base64');
  const r = xb(`eval --base64 ${b64}`, timeout);
  if (r.data && r.data.result && r.data.result.success) {
    const resultStr = r.data.result.data.result;
    if (typeof resultStr === 'string' && (resultStr.startsWith('{') || resultStr.startsWith('['))) {
      try { return { code: 0, result: JSON.parse(resultStr) }; } catch (_) {}
    }
    return { code: 0, result: resultStr };
  }
  // 只在失败时尝试 raw 解析
  if (r.data && r.data.result && !r.data.result.success) {
    return { code: 1, result: null, error: r.data.result.error };
  }
  return { code: r.code, result: r.data };
}

/**
 * 直接执行 JS 字符串 eval
 */
function evalJs(jsCode, timeout = 20000) {
  const tmpFile = path.join(WORKSPACE, 'tmp_bili_eval.js');
  fs.writeFileSync(tmpFile, jsCode, 'utf8');
  return evalJsFile(tmpFile, timeout);
}

function sleep(ms) {
  return new Promise((r) => setTimeout(r, ms));
}

// ============================================================
// 页面操作封装
// ============================================================

/**
 * 获取 data.result.data（统一解析路径）
 */
function getResultData(xbResult) {
  if (!xbResult.data) return null;
  // xb JSON：data → result → data
  if (xbResult.data.result && xbResult.data.result.data) {
    return xbResult.data.result.data;
  }
  return xbResult.data;
}

/**
 * 获取 snapshot 文本
 */
async function snapshot() {
  const r = xb('snapshot -i', 20000);
  const d = getResultData(r);
  if (d && d.snapshot) return d.snapshot;
  if (d && d.result) return d.result;
  return null;
}

/**
 * 获取当前 URL
 */
async function getUrl() {
  const r = xb('get url', 10000);
  const d = getResultData(r);
  if (d && d.url) return d.url;
  return null;
}

/**
 * 截图
 */
async function screenshot() {
  return xb('screenshot', 15000);
}

/**
 * 打开 URL
 */
async function open(url) {
  return xb(`open "${url}"`, 25000);
}

/**
 * 点击 ref
 */
async function clickRef(ref) {
  return xb(`click @${ref}`, 10000);
}

/**
 * 填字段
 */
async function fillRef(ref, text) {
  return xb(`fill @${ref} "${text}"`, 10000);
}

// ============================================================
// 登录处理
// ============================================================

/**
 * 确保浏览器可用（先 open 一次）
 */
async function ensureChrome() {
  console.log('  启动 Chrome（xb CLI）...');
  const r = xb(`open "${PUBLISH_URL}"`, 30000);
  await sleep(4000);
  return r;
}

/**
 * 检查登录状态
 */
async function checkLogin() {
  await open(PUBLISH_URL);
  await sleep(4000);
  const url = await getUrl();
  const isLoggedIn = url && url.includes(PUBLISHED_URL_PATTERN) && !url.includes('login');
  if (isLoggedIn) {
    return { ok: true, message: '已登录', url };
  }
  return { ok: false, message: '未登录，请手动在浏览器中完成登录', url };
}

/**
 * 等待用户手动登录（轮询 URL）
 */
async function waitForLogin(maxWaitMs = 600000) {
  const start = Date.now();
  while (Date.now() - start < maxWaitMs) {
    await sleep(5000);
    const url = await getUrl();
    if (url && url.includes(PUBLISHED_URL_PATTERN) && !url.includes('login')) {
      return { ok: true, url };
    }
  }
  throw new Error('登录等待超时（10分钟）');
}

// ============================================================
// 填写操作
// ============================================================

/**
 * 在 iframe 内执行 JS
 * 生成独立 JS 文件并 base64 eval
 */
async function evalInIframe(jsCode) {
  const fullJs = `(function(){
    var iframe = document.querySelector('iframe[src*="read-editor"]');
    if(!iframe) return JSON.stringify({error:'NO_IFRAME'});
    var doc = iframe.contentDocument || iframe.contentWindow.document;
    if(!doc) return JSON.stringify({error:'IFRAME_CROSS_ORIGIN'});
    try {
      var result = (function(){${jsCode}})();
      return JSON.stringify(result);
    } catch(e) { return JSON.stringify({error:e.message}); }
  })()`;
  return evalJs(fullJs);
}

/**
 * 填标题（textarea native setter + 4事件）
 */
async function fillTitle(title) {
  const escapedTitle = title.replace(/'/g, "\\'").replace(/"/g, '\\"').replace(/\n/g, '\\n');
  const jsCode = `
    var ta = doc.querySelector('.title-input__inner');
    if(!ta) return {error:'NO_TITLE_INPUT'};
    var nativeSetter = Object.getOwnPropertyDescriptor(
      window.HTMLTextAreaElement.prototype, 'value'
    ).set;
    nativeSetter.call(ta, '${escapedTitle}');
    ['input','change','keyup','blur'].forEach(function(evt){
      ta.dispatchEvent(new Event(evt, {bubbles:true}));
    });
    return {ok:true, len: ta.value.length, val: ta.value};
  `;
  return evalInIframe(jsCode);
}

/**
 * 填正文（TipTap editor innerHTML）
 */
async function fillBody(body) {
  const sections = Array.isArray(body) ? body : [body];
  const html = sections.map(p => '<p>' + p.replace(/</g, '&lt;').replace(/>/g, '&gt;') + '</p>').join('');
  const escapedHtml = html.replace(/'/g, "\\'").replace(/\n/g, '\\n');
  const jsCode = `
    var el = doc.querySelector('.tiptap.ProseMirror');
    if(!el) return {error:'NO_EDITOR'};
    el.innerHTML = '${escapedHtml}';
    el.dispatchEvent(new Event('input', {bubbles:true}));
    return {ok:true, len: el.innerText.length};
  `;
  return evalInIframe(jsCode);
}

/**
 * 发布（点击发布按钮）
 */
async function publish() {
  // 发布按钮点击
  const clickJs = `
    var btns = doc.querySelectorAll('button');
    var found = null;
    btns.forEach(function(b){
      if(b.innerText.trim() === '发布') found = b;
    });
    if(!found) return {error:'NO_PUBLISH_BUTTON'};
    found.dispatchEvent(new MouseEvent('mousedown', {bubbles:true}));
    found.dispatchEvent(new MouseEvent('mouseup', {bubbles:true}));
    found.dispatchEvent(new MouseEvent('click', {bubbles:true}));
    return {ok:true, text: found.innerText};
  `;
  const r = await evalInIframe(clickJs);
  await sleep(3000);
  
  // 验证是否跳转
  const url = await getUrl();
  if (url && !url.includes('new-edit')) {
    return { success: true, url, message: '发布成功' };
  }
  
  // 检查是否有验证弹窗
  const snap = await snapshot();
  if (snap && snap.includes('请输入图片中的内容')) {
    return { success: false, message: '弹出了验证码弹窗，请在浏览器中输入验证码后点「确定」' };
  }
  
  return { success: false, message: '发布按钮已点击，但页面未跳转' };
}

async function cleanup() {
  // xb 会话自动管理，不需要显式清理
  // 如果需要：xb('close', 5000)
}

module.exports = {
  xb, evalJs, evalJsFile, evalInIframe,
  sleep,
  snapshot, getUrl, screenshot, open, clickRef, fillRef,
  ensureChrome, checkLogin, waitForLogin,
  fillTitle, fillBody, publish, cleanup,
  XB_PATH, PUBLISH_URL,
};
