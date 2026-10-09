#!/usr/bin/env node
/**
 * launch-cdp-chrome.js — 拉起「隔离 Chrome + CDP 9222」用于 B站发布
 *
 * 为什么需要它：
 *   本技能早期走 xb CLI（agent-browser 封装），但 xb 不是通用依赖、本机不保证有。
 *   现改为自己拉一个与用户浏览器完全隔离的 Chrome，再用 playwright-core 直连 CDP。
 *
 * 关键点：
 *   1) profile 固定 ~/.chrome_qclaw_stable —— B站登录态长期复用，免登录（不要随便换目录）
 *   2) 必须后台常驻：spawn(detached) + unref()；在沙箱里还要 run_in_background + 末尾 sleep 保活
 *   3) 防节流四参数必带：窗口被遮挡时 visibilityState=hidden 会让页面渲染被节流
 *
 * 用法：
 *   node scripts/launch-cdp-chrome.js                       # 默认打开B站发布页
 *   node scripts/launch-cdp-chrome.js "https://xxx"          # 自定义起始页
 *   BILI_CDP_PORT=9223 node scripts/launch-cdp-chrome.js
 */

const { spawn } = require('child_process');
const fs = require('fs');
const path = require('path');
const os = require('os');

const CDP_PORT = process.env.BILI_CDP_PORT || process.env.ISOB_CDP_PORT || '9222';
const PROFILE_DIR = process.env.ISOB_PROFILE_DIR || path.join(os.homedir(), '.chrome_qclaw_stable');
const START_URL = process.argv[2] || 'https://member.bilibili.com/platform/upload/text/new-edit';

function findChrome() {
  const cands = [
    process.env.AGENT_BROWSER_EXECUTABLE_PATH,
    'C:\\Program Files\\Google\\Chrome\\Application\\chrome.exe',
    'C:\\Program Files (x86)\\Google\\Chrome\\Application\\chrome.exe',
    '/Applications/Google Chrome.app/Contents/MacOS/Google Chrome',
    '/usr/bin/google-chrome',
    '/usr/bin/google-chrome-stable',
  ].filter(Boolean);
  for (const c of cands) if (fs.existsSync(c)) return c;
  return 'chrome';
}

const chrome = findChrome();
if (chrome !== 'chrome' && !fs.existsSync(chrome)) {
  console.error('找不到 Chrome 可执行文件:', chrome);
  process.exit(1);
}
fs.mkdirSync(PROFILE_DIR, { recursive: true });

const args = [
  '--new-instance',
  `--user-data-dir=${PROFILE_DIR}`,
  `--remote-debugging-port=${CDP_PORT}`,
  '--no-first-run',
  '--no-default-browser-check',
  // 防节流：窗口被遮挡/最小化时页面不渲染（插图弹窗、按钮状态都会异常）
  '--disable-backgrounding-occluded-windows',
  '--disable-background-timer-throttling',
  '--disable-renderer-backgrounding',
  '--disable-features=CalculateNativeWinOcclusion',
  START_URL,
];

console.log('=== 启动隔离 Chrome（B站发布用）===');
console.log('Chrome :', chrome);
console.log('Profile:', PROFILE_DIR);
console.log('CDP    :', CDP_PORT);
console.log('起始页 :', START_URL);

const child = spawn(chrome, args, { detached: true, stdio: 'ignore', windowsHide: true });
child.unref();
child.on('error', (e) => { console.error('启动失败:', e.message); process.exit(1); });

setTimeout(() => {
  console.log(`\n已发起（PID ${child.pid}）。`);
  console.log('下一步：');
  console.log('  1) 若未登录，在弹出的窗口里手动登录B站（登录态会存进 profile，长期复用）');
  console.log('  2) 驱动：node scripts/bili_publish_pw.js --title-file t.txt --body-file b.txt --publish');
  console.log('  3) 若报连不上：确认本命令是后台常驻（run_in_background + sleep 保活），别让进程退出');
}, 1500);
