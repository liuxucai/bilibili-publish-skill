#!/usr/bin/env node
/**
 * bili_probe.js — B站编辑器结构探测（排障用）
 *
 * 页面改版后先跑这个，确认选择器是否还有效：
 *   node scripts/bili_probe.js
 *
 * 输出：iframe 列表 / 标题元素 / contenteditable / file input / 按钮 / 工具栏项 / 已插入图片
 * 若某次发布莫名失败，把它接在报错前后跑一遍，比盲目重试快得多。
 */

const lib = require('./cdplib');

(async () => {
  const { browser, page } = await lib.connect();
  try {
    console.log('当前 URL:', page.url());
    console.log('\n--- frames ---');
    page.frames().forEach(f => console.log('  ', f.url().slice(0, 110) || '(about:blank)'));

    let ed = null;
    try { ed = await lib.getEditorFrame(page, 15000); }
    catch (e) {
      console.log('\n⚠️ 未找到编辑器 iframe（', e.message, '）');
      console.log('   可能原因：未登录被跳登录页 / 页面改版换了 iframe 关键字（改 cdplib.js 的 EDITOR_FRAME_KEY）');
      return;
    }

    const info = await ed.evaluate(() => {
      const out = {
        titleInput: null, contentEditables: [], fileInputs: [], buttons: [], toolbarItems: [], images: [],
        publishSettingsVisible: false, knownClasses: {},
      };
      const ta = document.querySelector('.title-input__inner');
      out.titleInput = ta ? { tag: ta.tagName, placeholder: ta.placeholder, value: ta.value } : null;
      document.querySelectorAll('[contenteditable="true"]').forEach(e =>
        out.contentEditables.push({ tag: e.tagName, cls: String(e.className).slice(0, 90) }));
      document.querySelectorAll('input[type=file]').forEach(e =>
        out.fileInputs.push({ accept: e.accept, cls: String(e.className).slice(0, 60), hidden: e.offsetParent === null }));
      document.querySelectorAll('button').forEach(e =>
        out.buttons.push(e.innerText.trim().slice(0, 18) || '(icon)'));
      document.querySelectorAll('eva3-toolbar-item').forEach(e =>
        out.toolbarItems.push(e.tagName.toLowerCase()));
      document.querySelectorAll('.tiptap.ProseMirror img').forEach(e =>
        out.images.push({ src: e.src.startsWith('data') ? 'base64预览' : e.src.slice(0, 60), w: e.naturalWidth }));
      out.publishSettingsVisible = !![...document.querySelectorAll('*')].find(e => e.children.length === 0 && e.textContent.trim() === '发布设置');
      ['title-input__inner', 'tiptap', 'eva3-editor', 'code-input', 'bili-img-verify'].forEach(c => {
        out.knownClasses[c] = document.querySelectorAll('.' + c.split('__')[0]).length;
      });
      return out;
    });
    console.log('\n--- 编辑器结构 ---');
    console.log(JSON.stringify(info, null, 1));
    console.log('\n提示：标题=.title-input__inner（textarea）；正文=.tiptap.ProseMirror；发布=iframe内 button「发布」');
    console.log('      验证码弹窗=.bili-img-verify + input.code-input（发布被风控拦截时出现）');
  } finally {
    await browser.close().catch(() => {});
  }
})().catch(e => { console.error('ERR', e.message); process.exit(1); });
