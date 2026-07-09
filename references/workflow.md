# B站文章发布 - 工作流程

> 基于 2026-07-09 实际验证经验。浏览器驱动：xb CLI（agent-browser 0.25.3 封装）

## 核心流程

```
xb open 发布页
    ↓
┌─ URL不含 login ─→ 已登录，继续
│
└─ URL含 login ─→ 提示用户手动登录（xb无法过极验）
                    ↓
             用户手动完成登录后
                    ↓
             xb open 发布页（或通过已打开的窗口导航）
                    ↓
     eval JS 填标题（.title-input__inner textarea native setter）
                    ↓
     eval JS 填正文（.tiptap.ProseMirror innerHTML，在 iframe 内）
                    ↓
     eval JS 点发布按钮（MouseEvent 三件套）
                    ↓
     ┌─ 无弹窗 → URL变化 → ✅ 发布成功
     │
     └─ 弹「请输入图片中的内容」→ 用户手动输入 → 点确定 → 完成
```

---

## 一、xb CLI 启动

### 1.1 xb 路径

```powershell
# 主路径
$xb = "C:\Users\菠萝\.qclaw\skills\xbrowser\scripts\xb.cjs"

# OpenClaw 内置路径（备选）
$xb2 = "F:\qclaw\v0.2.32.610\resources\openclaw\config\skills\xbrowser\scripts\xb.cjs"
```

### 1.2 检查状态

```powershell
node $xb status
```

输出示例：
```json
{
  "ok": true,
  "data": {
    "cli": { "version": "agent-browser 0.25.3" },
    "browsers": { "chrome": { "installed": true, "version": "150.0.7871.46" } },
    "profiles": { "chrome": { "exists": true, "path": "..." } }
  }
}
```

### 1.3 打开发布页

```powershell
node $xb run --browser chrome --headed open "https://member.bilibili.com/platform/upload/text/new-edit"
open 后建议等待页面加载：
Start-Sleep -Seconds 4
```

### 1.4 检查登录状态

```powershell
node $xb run --browser chrome get url
```

| URL 包含 | 状态 |
|----------|------|
| `member.bilibili.com/platform/upload/text/new-edit` | ✅ 已登录 |
| `passport.bilibili.com/login` | ❌ 未登录 |

---

## 二、登录处理

### 2.1 未登录处理

**xb 无法自动化极验验证码**。唯一方案：

```powershell
Write-Host "⚠️ 请在浏览器窗口中手动完成B站登录"
Write-Host "1. 切换到浏览器窗口"
Write-Host "2. 输入账号密码并完成图形验证码"
Write-Host "3. 登录后继续脚本操作"

# 等待用户手动登录（可以轮询 URL）
do {
  Start-Sleep -Seconds 3
  $url = node $xb run --browser chrome get url 2>$null
  $json = $url | ConvertFrom-Json
  $currentUrl = $json.data.result.data.url
} while ($currentUrl -match "login")
```

### 2.2 登录页结构

| 元素 | ref | 类型 |
|------|-----|------|
| 密码登录 tab | e4 | generic |
| 短信登录 tab | e5 | generic |
| 账号输入框 | e36 | textbox |
| 密码输入框 | e37 | textbox (type=password) |
| 登录按钮 | e38 | generic (.btn_primary) |
| 关闭验证弹窗 | e49 | button |
| 验证码确认 | e48 | button |

---

## 三、填标题

### 3.1 关键发现：标题是 textarea

```js
// ✅ 正确：用 native setter + 4事件
(function(){
  var iframe = document.querySelector('iframe[src*="read-editor"]');
  if(!iframe) return 'NO_IFRAME';
  var doc = iframe.contentDocument || iframe.contentWindow.document;
  var ta = doc.querySelector('.title-input__inner');
  if(!ta) return 'NO_TITLE';
  
  var nativeSetter = Object.getOwnPropertyDescriptor(
    window.HTMLTextAreaElement.prototype, 'value'
  ).set;
  nativeSetter.call(ta, '标题内容');
  
  ['input','change','keyup','blur'].forEach(function(evt){
    ta.dispatchEvent(new Event(evt, {bubbles:true}));
  });
  
  return 'OK:' + ta.value.length;
})()
```

### 3.2 ❌ 错误方式

```js
// innerText 对 textarea 无效
ta.innerText = '标题';       // ❌ 不生效
ta.innerHTML = '标题';       // ❌ 不生效
ta.value = '标题';           // ❌ React 不检测
// contenteditable 方式也不适用（B站标题是 textarea）
```

### 3.3 验证标题

```powershell
# snapshot 后查看 e27 的值
node $xb run --browser chrome snapshot -i
# 输出中应显示：textbox "请输入标题（建议30字以内）" [ref=e27]: 标题内容
```

---

## 四、填正文

### 4.1 正文编辑器

B站正文使用 **TipTap** 编辑器，选择器：`.tiptap.ProseMirror`
与标题同一个 iframe（`iframe[src*="read-editor"]`）。

### 4.2 用 JS eval 填写

```js
(function(){
  var iframe = document.querySelector('iframe[src*="read-editor"]');
  if(!iframe) return 'NO_IFRAME';
  var doc = iframe.contentDocument || iframe.contentWindow.document;
  var editor = doc.querySelector('.tiptap.ProseMirror');
  if(!editor) return 'NO_EDITOR';
  editor.innerHTML = '<p>正文第一段</p><p>正文第二段</p>';
  editor.dispatchEvent(new Event('input', {bubbles:true}));
  return 'OK:' + editor.innerText.length;
})()
```

### 4.3 ❌ 不能用 xb type / fill

xb 的 `type`/`fill` 对 iframe 内的 TipTap 编辑器不响应。
所有编辑器操作必须用 `eval --base64` 执行 JS。

### 4.4 验证正文

```powershell
# snapshot 后查看 e35（正文 textarea/div 的内容）
node $xb run --browser chrome snapshot -i
```

---

## 五、发布

### 5.1 发布按钮

发布按钮在同一 iframe 内，snapshot 中为：
```
button "发布" [ref=e26]
```

### 5.2 点击发布（MouseEvent 序列）

```js
(function(){
  var iframe = document.querySelector('iframe[src*="read-editor"]');
  if(!iframe) return 'NO_IFRAME';
  var doc = iframe.contentDocument || iframe.contentWindow.document;
  var btns = doc.querySelectorAll('button');
  var found = null;
  btns.forEach(function(b){
    if(b.innerText.trim() === '发布') found = b;
  });
  if(!found) return 'NO_BTN';
  
  found.dispatchEvent(new MouseEvent('mousedown', {bubbles:true}));
  found.dispatchEvent(new MouseEvent('mouseup', {bubbles:true}));
  found.dispatchEvent(new MouseEvent('click', {bubbles:true}));
  return 'CLICKED';
})()
```

### 5.3 弹窗处理

点发布后可能弹出验证码弹窗（"请输入图片中的内容"）：
```
textbox "请输入图片中的内容" [ref=e32]
link "取消" [ref=e33]
link "确定" [ref=e34]
```

**处理方式**：
```powershell
# 用户手动在浏览器中完成验证码输入
# 填完后点"确定"
Write-Host "⚠️ 请在浏览器中输入验证码图片内容，然后点击「确定」"
```

### 5.4 验证发布成功

```powershell
node $xb run --browser chrome get url
```
- URL 不再是 `new-edit` → ✅ 发布成功（跳转到文章管理列表）
- 仍在 `new-edit` → ❌ 发布失败

---

## 六、完整发布脚本

推荐使用 `scripts/publish.js` 一键执行：

```powershell
# 确保 xb CLI 路径配置
# 编辑 scripts/lib.js 中的 XB_PATH 变量

# 执行发布
node skills/bilibili-publisher/scripts/publish.js
```

---

## 七、调试建议

### 7.1 xb 输出解析

xb 返回 JSON 结构：
```json
{
  "ok": true,
  "command": "run",
  "data": {
    "browser_command": "snapshot -i",
    "result": {
      "success": true,
      "data": { "origin": "...", "refs": {...}, "snapshot": "..." }
    }
  }
}
```

关键数据路径：
- snapshot 和 get url：`data.result.data`
- eval 返回值：`data.result.data.result`
- snapshot refs：`data.result.data.refs`
- snapshot 文本：`data.result.data.snapshot`

### 7.2 常用调试命令

```powershell
$xb = "C:\Users\菠萝\.qclaw\skills\xbrowser\scripts\xb.cjs"

# 截图
node $xb run --browser chrome screenshot

# 快照
node $xb run --browser chrome snapshot -i

# 当前 URL
node $xb run --browser chrome get url

# 页面文本（获取当前 tab 所有可见文字）
node $xb run --browser chrome get text body

# 执行任意 JS
# 先用 Base64 编码 JS 文件：
$js = Get-Content -Raw "script.js"
$b64 = [Convert]::ToBase64String([System.Text.Encoding]::UTF8.GetBytes($js))
node $xb run --browser chrome eval --base64 $b64
```

### 7.3 base64 编码 JS 的最佳方式

```powershell
# 方式1：用 Node.js 编码
node -e "console.log(Buffer.from(require('fs').readFileSync('script.js','utf8'),'utf8').toString('base64'))"

# 方式2：用 PowerShell
$js = Get-Content -Raw "script.js"
[Convert]::ToBase64String([System.Text.Encoding]::UTF8.GetBytes($js))
```
