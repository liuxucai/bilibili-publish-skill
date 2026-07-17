# B站文章发布 - 故障排查

基于 2026-07-09 实际验证经验。浏览器驱动：xb CLI（agent-browser 0.25.3 封装）

---

## 1. xb CLI 路径问题

**症状**：`node <path>\xb.cjs` 报 `MODULE_NOT_FOUND` 或 `ENOENT`
**原因**：xb.cjs 路径错误，或 xb 依赖缺失

**可用路径**：
| 路径 | 说明 |
|------|------|
| `C:\Users\菠萝\.qclaw\skills\xbrowser\scripts\xb.cjs` | 工作区 skill 副本 |
| `F:\qclaw\v0.2.32.610\resources\openclaw\config\skills\xbrowser\scripts\xb.cjs` | OpenClaw 内置 |

**检查**：
```powershell
Test-Path "C:\Users\菠萝\.qclaw\skills\xbrowser\scripts\xb.cjs"
Test-Path "F:\qclaw\v0.2.32.610\resources\openclaw\config\skills\xbrowser\scripts\xb.cjs"
node "C:\Users\菠萝\.qclaw\skills\xbrowser\scripts\xb.cjs" status
```

**恢复**：
```powershell
# 如果 xb.cjs 缺失，重新运行 xb init
# 或从另一个可用路径复制
```

---

## 2. 浏览器未启动 / 无法连接

**症状**：xb 操作报错 `浏览器操作失败` / `raw_error: socket hang up` / `connection refused`

**原因**：
- Chrome 未启动
- CDP 端口（9222）被占用
- xb 守护进程异常

**解决**：
```powershell
# 1. 检查 xb 状态
node "C:\Users\菠萝\.qclaw\skills\xbrowser\scripts\xb.cjs" status

# 2. 先 open 一个页面确保浏览器启动
node "C:\Users\菠萝\.qclaw\skills\xbrowser\scripts\xb.cjs" run --browser chrome --headed open "https://member.bilibili.com/platform/upload/text/new-edit"

# 3. 如果还不行，清理并重试
node "C:\Users\菠萝\.qclaw\skills\xbrowser\scripts\xb.cjs" cleanup
```

---

## 3. 登录验证码（极验 geetest）— 无法绕过

**症状**：填好账号密码点登录后，弹出「请在下图依次点击」弹窗
**根本原因**：极验是行为级图形验证码，完全无法自动化
**DOM 结构**：
```
button "关闭验证" [ref=e49]
button "刷新验证" [ref=e50]
button "确认" [ref=e48]
div.geetest_holder — 极验容器
```

**唯一方案**：
1. **用户手动登录**：在浏览器中手动输入账号密码，完成验证码登录
2. **复用 profile**：登录态保存在 xb profile（`~/.qclaw/tools/xbrowser/profiles/chrome`），下次自动复用

---

## 4. xb 输出带非 JSON 前缀

**症状**：xb 输出的 JSON 前有类似 `"环境变量注入：..."` 的文本

```
"环境变量注入：" 不是内部或外部命令...
'NARY:' 不是内部或外部命令...
'TASK_NODE_ENABLED:' 不是内部或外部命令...
```

**原因**：xb.cjs 被 PowerShell 作为子进程执行时，环境变量注入脚本在 stderr 输出，PowerShell 把它们打印到控制台

**不影响实际结果**：最后的 JSON 输出 `{"ok":true,...}` 是有效的，可以正确解析

**解决方法**：
```powershell
# 方法1：用 2>$null 抑制错误流
node $xb run --browser chrome snapshot -i 2>$null

# 方法2：在 Node.js 中通过 execSync 调用，stderr 会自动分离
# 方法3：忽略控制台输出，只取末尾的 JSON
```

---

## 5. 填写内容在 snapshot 中看不到

**症状**：执行 eval 后返回了 `OK:19` 但 snapshot 中标题/正文为空

**原因**：B站标题是 textarea，需要用 native setter + 4事件触发 React 检测
分别检查：
```powershell
# 标题设置（验证长度）
node -e "console.log(Buffer.from(\"(function(){var i=document.querySelector('iframe[src*=read-editor]');if(!i)return 'NO_IFRAME';var d=i.contentDocument||i.contentWindow.document;var t=d.querySelector('.title-input__inner');return t?'VALUE:'+t.value:'NO_TITLE';})()\",'utf8').toString('base64'))"

# 如果 snapshot 中 e27 的值正确显示标题，说明设置成功
```

---

## 6. 发布按钮点击无效

**症状**：eval 返回 `CLICKED` 但页面无变化，点了几次后弹验证码弹窗

**原因**：
- React 事件委托需要特定点击序列
- MouseEvent + isTrusted 检查可能导致 native 方法无效
- 点发布可能触发安全验证弹窗

**解决**：
```powershell
# 检查是否弹出了验证弹窗
node $xb run --browser chrome snapshot -i 2>$null
# 如果出现 textbox "请输入图片中的内容" 说明弹了验证码
# 需要用户手动输入
```

---

## 7. eval --base64 解码失败

**症状**：报错 `Base64 decoded to invalid UTF-8`

**原因**：base64 解码后的字节序列不是有效 UTF-8

**排查**：
```powershell
# 检查编码是否正确
$b64 = "你的base64字符串"
$bytes = [Convert]::FromBase64String($b64)
$text = [System.Text.Encoding]::UTF8.GetString($bytes)
$text  # 检查是否能正常显示中文

# 确保 JS 源文件是 UTF-8 编码（无 BOM）
# 用以下方式编码最稳：
$js = Get-Content -Raw "script.js" -Encoding UTF8
$b64 = [Convert]::ToBase64String([System.Text.Encoding]::UTF8.GetBytes($js))
```

---

## 8. 标题填完后字数显示 0

**症状**：标题 eval OK 但页面标题字数显示为 0

**原因**：B站标题编辑器是 textarea，用了 `innerText` 或其他非标准方式
**恢复**：用 native setter + 4 事件方式

```js
// ✅ 正确的标题设置
var ta = doc.querySelector('.title-input__inner');
var nativeSetter = Object.getOwnPropertyDescriptor(
  window.HTMLTextAreaElement.prototype, 'value'
).set;
nativeSetter.call(ta, '标题');
['input','change','keyup','blur'].forEach(function(evt){
  ta.dispatchEvent(new Event(evt, {bubbles:true}));
});
```

---

## 9. iframe 内容无法访问

**症状**：`contentDocument` 返回 null 或 eval 报跨域错误

**原因**：
- iframe 跨域（但 member.bilibili.com 和子域是同源的，不应跨域）
- iframe 未完全加载

**调试**：
```js
(function(){
  var frames = document.querySelectorAll('iframe');
  var info = [];
  frames.forEach(function(f,i){
    try {
      var d = f.contentDocument || f.contentWindow.document;
      info.push({
        index:i, id:f.id, class:f.className,
        src:(f.src||'').substring(0,80),
        canAccess: !!d,
        title: d ? (d.title||'') : 'N/A'
      });
    } catch(e) {
      info.push({index:i, src:(f.src||'').substring(0,80), error:e.message});
    }
  });
  return JSON.stringify(info);
})()
```

---

## 10. 完整调试流程

```powershell
$xb = "C:\Users\菠萝\.qclaw\skills\xbrowser\scripts\xb.cjs"
$skill = "C:\Users\菠萝\.qclaw\workspace-agent-3af8d089\skills\bilibili-publisher"

# Step 1: 检查 xb 状态
node $xb status 2>$null

# Step 2: 打开发布页
node $xb run --browser chrome open "https://member.bilibili.com/platform/upload/text/new-edit"
Start-Sleep -Seconds 4

# Step 3: 查看当前 URL（判断登录态）
node $xb run --browser chrome get url 2>$null

# Step 4: 截屏
node $xb run --browser chrome screenshot 2>$null

# Step 5: 快照
node $xb run --browser chrome snapshot -i 2>$null | ConvertFrom-Json | % {$_.data.result.data.snapshot}

# Step 6: 执行填写脚本
node $skill\scripts\fill_form5.js

# Step 7: 再次快照验证填写结果
node $xb run --browser chrome snapshot -i 2>$null

# Step 8: 发布（用 eval JS）
node $skill\scripts\click_publish.js

# Step 9: 验证结果
node $xb run --browser chrome get url 2>$null
node $xb run --browser chrome snapshot -i 2>$null
```

---

## 11. 2026-07-16 实战问题集（agent-browser --cdp / isolated-browser 路线）

以下为发布「明治维新」文章（isolated-browser 独立 Chrome + `agent-browser --cdp 9222` 驱动）实战中暴露的问题与解法。前 10 节基于 xb 路线，本章节补充 CDP 直连路线下的坑。

### 11.1 中文填入乱码风险（填标题/正文）
- **现象**：经 CDP `eval` 直接传中文易乱码。
- **解决**：把填表 JS 写成独立 `.js` 文件（UTF-8）→ 读文件字节做 base64 → 执行 `agent-browser --cdp 9222 eval --base64 <b64>`。
- **PowerShell 生成 base64**：
  ```powershell
  $js = "C:\...\bili_fill_meiji.js"
  $b64 = [Convert]::ToBase64String([System.IO.File]::ReadAllBytes($js))
  agent-browser --cdp 9222 eval --base64 $b64
  ```
- 本次效果：标题 + 1017 字正文正确写入，中文无损。

### 11.2 登录验证后页面卡空白「登录验证」（组件未渲染）
- **现象**：用户完成短信验证后，URL 仍停在 `passport.bilibili.com/.../riskVerify`；截图只见「登录验证」四字，无输入框——验证组件加载失败 / 跳转卡死。
- **解决**：不信任陈旧 URL，直接用 `agent-browser --cdp 9222 open "https://member.bilibili.com/platform/upload/text/new-edit"` 重新导航 → 成功进入编辑页。
- **经验**：B站验证跳转偶发卡死，重新 `open` 目标编辑页比等待更可靠。

### 11.3 点「发布」弹出图片验证码弹窗
- **现象**：填好标题/正文点发布后，弹出「请完成验证」图片验证码弹窗（先后出现形如 `Ae,bVn`、`GVFfB` 的字符），含 textbox + 「取消」+「确定」。无法可靠自动识别输入。
- **触发标准流程**（用户 2026-07-16 确认）：验证码无法发布时 → ①关闭弹窗 → ②存为草稿 → ③再点发布 → ④等用户手动验证（见 §11.4–§11.6）。

### 11.4 关闭验证码弹窗：「取消」是 `<a class="cancel">`，不是 button（关键坑）
- **根因**：取消控件不是 `<button>`，而是 `<a class="cancel">`（锚点元素），仅查 `button` 必然找不到。
- **可靠写法**：递归遍历所有元素（`*`）跨顶层 + 嵌套 iframe，按精确文本「取消」命中并 dispatch 点击事件：
  ```js
  (function (target) {
    var clicked = false;
    function clickSearch(doc, depth) {
      if (clicked || !doc) return;
      var all = (doc.body || doc.documentElement || doc).querySelectorAll('*');
      for (var i = 0; i < all.length; i++) {
        var t = (all[i].innerText || all[i].textContent || '').trim();
        if (t === target) {
          all[i].dispatchEvent(new MouseEvent('mousedown', {bubbles:true}));
          all[i].dispatchEvent(new MouseEvent('mouseup', {bubbles:true}));
          all[i].dispatchEvent(new MouseEvent('click', {bubbles:true}));
          clicked = true; return;
        }
      }
      var frs = doc.querySelectorAll('iframe');
      for (var j = 0; j < frs.length; j++) {
        if (clicked) return;
        try { clickSearch(frs[j].contentDocument || frs[j].contentWindow.document, depth+1); } catch(e){}
      }
    }
    clickSearch(document, 0);
    return JSON.stringify({ clicked: clicked });
  }).call(null, '取消');
  ```
- **注意**：「确定」也是弹窗内控件，定位同理（按文本「确定」搜索，而非假设为 button）。

### 11.5 存草稿
- **现象/解决**：在 read-editor iframe 内找到「保存为草稿」`button` 并 click（mousedown/mouseup/click 三件套）→ 返回 `ok`；底部状态栏显示「保存成功 996/100000」，内容未丢。
- iframe 内按钮可直接按 `button` + innerText 定位（与 §11.4 的弹窗控件不同，编辑器工具栏按钮确实是 button）。

### 11.6 再次发布仍弹验证码（预期行为）
- **现象**：再次点击发布 → 新验证码弹窗（如 `GVFfB`）。
- **处理**：当前停在等用户手动输入验证码并点「确定」。草稿已落盘，内容安全，随时可验证发布。

### 11.7 沉淀经验（建议随版本固化进 SKILL.md）
1. 关闭 B站验证码弹窗用 `<a class="cancel">` 全元素递归搜索，不要只查 `button`。
2. CDP 填中文一律走「文件 → base64 → eval --base64」，避免乱码。
3. 验证码阻塞标准流程：关弹窗 → 存草稿 → 再点发布 → 等人工验证（本次用户已确认）。
4. 验证跳转卡死时，直接重新 `open` 目标编辑页 URL，不要等陈旧 URL。
