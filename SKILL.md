---
name: bilibili-publisher
description: B站（bilibili）专栏文章自动发布。隔离 Chrome + playwright-core 直连 CDP，完成填标题、粘贴注入正文、段落之间插入配图（本地文件自动上传图床）、发布、风控字符验证码识别、结果校验。触发词：B站发布、bilibili、发布文章到B站、发布专栏到B站。
---

# B站专栏发布 Skill v2（2026-10-02 全流程实测跑通）

> **v1 的 xb CLI 路线已整体删除**：xb（`<盘符>:\qclaw\...`、`C:\Users\<用户名>\.qclaw\...`）不是通用依赖，本机不保证存在，
> 相关脚本 `lib.js / publish.js / publish_sz.js / fill_form5.js / click_publish.js / click_confirm.js / quick_publish.js` 已移除。
> 现行方案自包含、不打扰用户浏览器、登录态复用。

---

## 什么时候用它

把一篇文章（可带一张本地配图）发布到 B站专栏：
标题 + 正文（一行一段）+ 配图插入到指定「段落之间」+ 提交发布 + 过风控验证码 + 回读文章链接。

---

## 依赖文件（都在本技能目录）

| 文件 | 说明 |
|---|---|
| `scripts/launch-cdp-chrome.js` | 拉起隔离 Chrome（profile `~/.chrome_qclaw_stable`，免登录复用） |
| `scripts/cdplib.js` | CDP 连接 / 编辑器 iframe 定位 / 整页截图 |
| `scripts/bili_publish_pw.js` | 主脚本：一键发布 / 补验证码 / 查状态 / 探测 |
| `scripts/bili_probe.js` | 编辑器 DOM 结构探测（排障首选） |
| `references/workflow.md` | 完整工作流 + 选择器速查表 |
| `references/troubleshooting.md` | **P1~P15 全部问题与解决方法**（踩坑必读） |
| `templates/article.txt` | 正文写法示例 |

外部依赖：系统稳定版 Chrome + `playwright-core`（由 `isolated-browser/scripts/pathkit.js` 运行时自动探测，可用 `OPENCLAW_NODE_MODULES` 覆盖）。

---

## 三步跑完

```bash
# ① 拉起隔离 Chrome（必须后台常驻：run_in_background + sleep 保活）
node scripts/launch-cdp-chrome.js && sleep 7200

# ② 发布（t.txt 首行=标题；b.txt 一行一段；--image-at 2 = 插到第2段之后）
node scripts/bili_publish_pw.js --title-file t.txt --body-file b.txt \
     --image <素材目录>/14.jpg --image-at 2 --publish

# ③ 若提示「触发风控验证码」（退出码 2）→ 打开导出的 bili_captcha.png 读字符
node scripts/bili_publish_pw.js --captcha M5hcD
```

查结果：`node scripts/bili_publish_pw.js --status`

---

## 必须记住的 5 条铁律

1. **正文只能靠模拟 paste 事件注入**（`ClipboardEvent('paste')` + `DataTransfer.setData('text/html')`）。
   直接改 `.tiptap.ProseMirror` 的 innerHTML 会与编辑器状态脱钩，点击后被回写清空。

2. **配图只能靠「粘贴图片文件」**（`DataTransfer.items.add(File)` + paste），
   **不要点工具栏 `eva3-toolbar-image`**——那条路插的是本地 base64 节点，不触发 `upload_bfs`。

3. **DOM 里 `img.src` 一直是 `data:image/jpeg;base64` 是正常的**，别等它变 http。
   想知道有没有真上传：抓 `POST /x/dynamic/feed/article/draft/add` 的请求体，
   里面应是 `{"para_type":2,"pic":{"pics":[{"url":"http://i0.hdslb.com/bfs/new_dyn/xxx.jpg"}]}}`。

4. **发布会被风控拦**：`create/opus` 返回 `code:-352` → 编辑器 iframe 内 `.bili-img-verify` 字符验证码。
   验证码图直接在 `.bili-img-verify img.src`（base64），填 `input.code-input` → 点「确定」→ **1.5 秒内再点一次「发布」**。
   成功标志：弹窗 **「你的专栏已提交成功」**。可能连弹 2~3 轮，属正常。

5. **截图有坑**：`page.screenshot()` 和 CDP `clip+scale` 在本页会挂起；要用画面就调 `cdplib.fullScreenshot()`（不带 clip 的整页截图）。

---

## 常见问题速查（详见 references/troubleshooting.md）

| 症状 | 去哪看 |
|---|---|
| xb CLI 报 MODULE_NOT_FOUND / F:\qclaw 不存在 | P1 |
| Chrome 起来了但立刻连不上 | P2 |
| 页面不渲染 / 弹窗空壳 / 截图黑屏 | P3 |
| 正文写进去一交互就消失 | P4 |
| 插图后 src 永远 base64、没发上传请求 | P5 / P7 |
| 等了很久以为上传超时 | P7 |
| 重载页面想找回草稿结果空白 | P9 |
| 发布返回 -352、弹「请完成验证」 | P10 |
| 截图超时 / clip 截图挂死 | P11 |
| 抓到的「验证码图」其实是文章配图 | P12 |
| 不确定到底发布成功没有 | P13 |
| 段落被合并/多出空段落 | P14 |
| 发布前/失败时的自检命令清单 | P15 |
| 测试草稿太多、删除按钮点不动 | P16 |

**调试建议**：用 `--no-save` 干跑（只填充+打印块结构，不落草稿）；因为 eva3 编辑器会自动保存，
日常调试难免在草稿箱留痕，测完记得去 `投稿 → 图文管理 → 草稿` 清理（方法见 P16）。

---

## 结果校验口径（多路确认）

- 弹窗 `vui_dialog` 含 **「你的专栏已提交成功」**
- URL 离开 `upload/text/new-edit`
- `--status` 查 `opus/creationlist` 拿 `dyn_id` → 公开链接 `https://www.bilibili.com/opus/<dyn_id>`
- 打开公开页确认 `article img` 的 src 是 `i0.hdslb.com/bfs/new_dyn/...`

> 若点发布后 playwright 报 `vui_dialog--wrapper ... intercepts pointer events`，
> 说明**已经发布成功**（成功弹窗挡住了按钮），不要再点第二次。

---

## 最近一次成功记录

2026-10-02《婚车租车怎么选？车型、数量、预算一篇讲清楚》
→ https://www.bilibili.com/opus/1254454729060122661 （dyn_id 1254454729060122661，12:05 发布，配图插在第 2 段之后）
