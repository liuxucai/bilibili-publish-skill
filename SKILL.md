---
name: bilibili-publisher
description: B站（bilibili）文章自动发布流程。通过 xb CLI（agent-browser 封装）驱动 Chrome 完成登录、填标题、填正文、发布。触发词：B站发布、bilibili、发布文章到B站、发布专栏到B站。

验证状态：⚠️ 部分验证 - 登录验证码（极验）无法自动化，需用户手动；标题/正文用 JS eval 已验证可行；发布按钮触发后可能弹验证弹窗需用户手动完成。
---

# B站文章自动发布 Skill

## 适用场景

- 自动化将文章发布到B站专栏
- 复用同一发布流程处理多篇文章

## 环境要求

| 项目     | 要求                                                         |
| -------- | ------------------------------------------------------------ |
| 浏览器   | 正式版 Chrome                                                |
| 控制工具 | xb CLI                                                       |
| 路径     | `F:\qclaw\v0.2.23.532\resources\openclaw\config\skills\xbrowser\scripts\xb.cjs` |
| 运行环境 | Windows PowerShell，不支持 `&&` 链式语法                     |
| 脚本语言 | Node.js（封装所有 xb 调用，规避 PowerShell 中文乱码）        |

## xb CLI 路径

xb CLI 有两条可用路径（内容相同）：

| 位置 | 路径 |
|------|------|
| 工作区 skill 副本 | `C:\Users\菠萝\.qclaw\skills\xbrowser\scripts\xb.cjs` |
| OpenClaw 内置 | `F:\qclaw\v0.2.33.617\resources\openclaw\config\skills\xbrowser\scripts\xb.cjs` |

**推荐使用工作区路径**（短一些）。

## xb 核心语法

| 操作 | 命令 |
|------|------|
| 打开页面 | `node <xb.cjs> run --browser chrome open <URL>` |
| 快照 | `node <xb.cjs> run --browser chrome snapshot -i` |
| 点击 (ref) | `node <xb.cjs> run --browser chrome click @eXX` |
| 填字段 | `node <xb.cjs> run --browser chrome fill @eXX "text"` |
| 逐字符输入 | `node <xb.cjs> run --browser chrome type @eXX "text"` |
| eval JS | `node <xb.cjs> run --browser chrome eval --base64 <base64>` |
| 获取 URL | `node <xb.cjs> run --browser chrome get url` |
| 截图 | `node <xb.cjs> run --browser chrome screenshot` |
| 按键 | `node <xb.cjs> run --browser chrome press <key>` |
| 关闭标签 | `node <xb.cjs> run --browser chrome close` |
| 状态检查 | `node <xb.cjs> status` |
| 清理会话 | `node <xb.cjs> cleanup` |

> **注意**：xb `fill` 和 `click` 只接受 `@ref` 编号（来自 snapshot），不接受 CSS 选择器。
> 复杂操作必须用 `eval --base64` 执行 JS。

## 核心原则

### ⚠️ 登录验证码（极验 geetest）无法自动化
- 每次密码登录后必弹「请在下图依次点击」文字点选验证码
- canvas 宽高为 0，不可截图分析，点击坐标无法计算
- **唯一方案**：填好账号密码后，让用户手动点登录 → 过验证码
- 或：用户先手动登录一次，xb 的 profile 会保存登录态

### ⚠️ 浏览器原则：绝不关闭现有浏览器进程
- xb 使用独立 profile（`~/.qclaw/tools/xbrowser/profiles/chrome`），不碰用户浏览器
- 禁止 `taskkill /F /IM chrome.exe`

### ⚠️ 标题编辑器是 textarea（非 contenteditable）
- B站标题元素 `.title-input__inner` **是 textarea**（不是 span contenteditable）
- 设置方法：用 `HTMLTextAreaElement.prototype.value` native setter + 4事件
- `innerText`/`innerHTML` 对 textarea 不生效

### ⚠️ 发布按钮可能弹验证码弹窗
- 点"发布"按钮后，可能弹出「请输入图片中的内容」验证弹窗
- 弹窗有 textbox（输入验证码）+「取消」（`<a class="cancel">`，见下）+「确定」按钮
- 需要用户手动填写验证码
- **验证码阻塞标准流程（用户 2026-07-16 确认）**：点发布弹验证码且无法自动完成时 → ①关闭弹窗（取消控件是 `<a class="cancel">`，非 button，需全元素递归搜索，见 references/troubleshooting.md §11.4）→ ②点"保存为草稿"存盘 → ③再次点发布 → ④等用户手动输入验证码并点"确定"。不要尝试自动识别图片验证码。
- **验证跳转卡死**：若登录/验证后页面停在空白"登录验证"、组件未渲染，不要等陈旧 URL，直接用 `open` 重新导航到 `https://member.bilibili.com/platform/upload/text/new-edit`。

### ?? 执行类任务默认直接执行，不交互询问
- 任务目标明确（如"发布X文章到B站"）时，不要弹选项面板询问细节（文章方向、次数等）。直接选定合理方案执行，并简短陈述假设。
- 仅在确实无法判断关键走向、且选错会浪费大量成本时，才用面板确认。

## 核心流程

```
1. xb open 发布页
2. 检查是否已登录（URL 是否含 login）
   - 已登录 → 继续
   - 未登录 → 提示用户手动登录（xb 无法处理极验）
3. 填标题（JS eval：native setter + 4事件）
4. 填正文（JS eval：.tiptap.ProseMirror innerHTML）
5. 发布（JS eval：MouseEvent 序列点击发布按钮）
6. 处理验证码弹窗（如有，用户手动）
7. 验证成功（URL 变化）
```

## 关键难点（2026-07-09 更新）

### 1. 标题是 textarea，要用 native setter
```js
// ✅ 正确
var ta = doc.querySelector('.title-input__inner');
var nativeSetter = Object.getOwnPropertyDescriptor(
  HTMLTextAreaElement.prototype, 'value'
).set;
nativeSetter.call(ta, '标题');
['input','change','keyup','blur'].forEach(function(evt){
  ta.dispatchEvent(new Event(evt, {bubbles:true}));
});

// ❌ 错误：innerText / innerHTML 对 textarea 无效
ta.innerText = '标题';  // 不生效
```

### 2. 标题和正文都在 iframe 内
- iframe 选择器：`iframe[src*="read-editor"]`
- 标题：`.title-input__inner`（textarea）
- 正文：`.tiptap.ProseMirror`（TipTap 编辑器，div contenteditable）
- 发布按钮也是 iframe 内的 `button`（innerText="发布"）

### 3. PowerShell 2>&1 问题
- xb 输出前会打印 `"环境变量注入"` 等非 JSON 前缀行
- 必须用 `2>$null` 抑制错误流，或用 JSON parse 取最后一个 JSON
- 不能正确使用 `2>&1` 等重定向语法

### 4. eval --base64 编码（中文防乱码通用做法）
- base64 解码必须产生**有效 UTF-8**，否则报错
- 中文需先确保 JS 文件 UTF-8 编码，再 base64
- **最稳做法（isolated-browser / agent-browser --cdp 路线同样适用）**：把填表 JS 写成独立 `.js` 文件（UTF-8）→ 读文件字节做 base64 → `agent-browser --cdp 9222 eval --base64 <b64>`。本次"明治"文章（标题+1017字正文）用此法中文无损填入。
- PowerShell 下可用 `[Convert]::ToBase64String([System.IO.File]::ReadAllBytes($js))` 生成 base64。

### 5. 验证码弹窗的"取消"是 `<a class="cancel">`，不是 button
- 点"发布"后弹出的图片验证码弹窗，其"取消"控件是 `<a class="cancel">`（锚点元素），**不是 `<button>`**。
- 仅查 `button`（含 read-editor iframe、甚至递归嵌套 iframe）都找不到它。
- 可靠做法：递归遍历顶层文档 + 所有嵌套 iframe 的**全部元素**，按精确文本 "取消" 命中并 dispatch 点击事件。
- 详见 references/troubleshooting.md §11.4。

## 使用方法

### 快速发布（已登录状态）

```powershell
# 定义 xb 路径快捷变量
$xb = "C:\Users\菠萝\.qclaw\skills\xbrowser\scripts\xb.cjs"

# 1. 打开发布页（如未登录会自动跳到登录页）
node $xb run --browser chrome open "https://member.bilibili.com/platform/upload/text/new-edit"

# 2. 检查是否已登录
node $xb run --browser chrome get url

# 3. 填标题+正文（推荐用 fill_form5.js 或独立 JS 文件编码）
node scripts/bilibili-publisher/scripts/fill_form5.js

# 4. 获取最新 snapshot 查看发布按钮
node $xb run --browser chrome snapshot -i

# 5. 用 eval --base64 执行点击发布（推荐脚本化）
```

推荐使用 `scripts/publish.js` 一键执行完整流程。

## 配套资源

| 文件 | 说明 |
|------|------|
| [SKILL.md](SKILL.md) | 本文件 |
| [references/workflow.md](references/workflow.md) | 完整发布流程 |
| [references/troubleshooting.md](references/troubleshooting.md) | 问题排查 |
| [scripts/publish.js](scripts/publish.js) | 一键发布脚本（推荐） |
| [scripts/lib.js](scripts/lib.js) | xb 封装库 |
| [scripts/fill_form5.js](scripts/fill_form5.js) | 表单填写 JS（标题+正文） |
| [templates/article.txt](templates/article.txt) | 文章模板 |
| [scripts/bili_fill_meiji.js](scripts/bili_fill_meiji.js) | CDP 路线填文脚本（标题+正文 innerHTML，base64 eval 用） |
| [scripts/bili_click_publish.js](scripts/bili_click_publish.js) | CDP 路线点「发布」按钮 |
| [scripts/bili_save_draft.js](scripts/bili_save_draft.js) | CDP 路线点「保存为草稿」 |
| [scripts/bili_click_cancel_div.js](scripts/bili_click_cancel_div.js) | CDP 路线关闭验证码弹窗（递归搜 `<a class="cancel">`，见 troubleshooting §11.4） |

## 浏览器启用方式（isolated-browser）

本 skill 启用浏览器的方式：调用 isolated-browser skill 拉起一个与用户默认浏览器完全隔离的独立 Chrome 实例，再用其 agent-browser --cdp 直连驱动（B 路线），不打扰用户已开的 Chrome/Edge，也绕开 xb 安全锁。

- 若该 skill 已安装（工作区 skills/isolated-browser）：直接调用其 scripts/launch.js 拉起隔离实例、scripts/connect.js 做连通性检查。用法详见 skills/isolated-browser/SKILL.md。
- 若该 skill 未安装：从以下地址安装后再使用：
  - git clone：`git clone https://github.com/liuxucai/isolated-browser-skill <工作区>/skills/isolated-browser`
  - GitHub 直连被墙时改用 codeload 镜像下载 ZIP 解压：`https://codeload.github.com/liuxucai/isolated-browser-skill/zip/refs/heads/main`，解压后确保 SKILL.md 位于技能根目录。
  - 也可优先走 qclaw 技能安装通道：`skillhub_install install_skill isolated-browser`（若可用）。

> 说明：本仓库配套的 scripts/lib.js、scripts/publish.js 等目前仍按 xbrowser skill 的 xb.cjs（A 路线，要求用户先关闭其 Chrome）编写。若改用 isolated-browser 驱动，需将 lib.js 的调用方式从 xb.cjs 改为 agent-browser --cdp（参考 skills/isolated-browser/scripts/connect.js）。
