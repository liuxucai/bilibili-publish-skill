# B站专栏发布 — 完整工作流（2026-10-02 实测）

驱动：**隔离 Chrome（CDP 9222）+ playwright-core**。不依赖 xb CLI、不打扰用户浏览器。

---

## 0. 依赖文件

| 文件 | 作用 |
|---|---|
| `../isolated-browser/scripts/launch.js` | 拉起隔离 Chrome（**共享基座**，固定 profile `~/.chrome_qclaw_stable`，B站登录态复用） |
| `scripts/cdplib.js` | CDP 连接 / 编辑器 iframe 定位 / 整页截图（连接语义只在这里解包一次） |
| `scripts/bili_publish_pw.js` | **主脚本**：填标题→注入正文→段落间插图→草稿校验→发布→验证码→结果校验 |
| `scripts/bili_probe.js` | 编辑器 DOM 结构探测（改版排障第一步） |
| `templates/article.txt` | 正文写法示例（一行一段） |

外部依赖仅两项：
- 系统稳定版 Chrome
- `playwright-core`（由 `isolated-browser/scripts/pathkit.js` 运行时自动探测；可用 `OPENCLAW_NODE_MODULES` 覆盖）

---

## 1. 拉起浏览器（必须后台常驻）

```bash
node ../isolated-browser/scripts/launch.js "https://member.bilibili.com/platform/upload/text/new-edit" && sleep 7200
```

- **必须在后台跑**（WorkBuddy 里 `run_in_background: true`），否则沙箱会在命令结束时回收 Chrome。
- profile 固定 `~/.chrome_qclaw_stable`：**B站登录态已存在，正常情况免登录**。
- 若跳出登录页 → 在弹出的窗口手动登录一次，登录态会存进 profile，之后长期复用。

连通性自检：

```bash
curl -s http://127.0.0.1:9222/json/version
```

---

## 2. 准备内容

```
t.txt     第 1 行 = 标题
b.txt     一行一段，空行忽略（默认 mode=line）
x.jpg     配图（本地路径）
```

正文示例见 `templates/article.txt`。

---

## 3. 发布（一键）

```bash
# 默认：配图 3 张，按标签从素材库自动挑，自动算锚点（spread 均分）
node scripts/bili_publish_pw.js --title-file t.txt --body-file b.txt \
  --keyword "婚车租车" --tags "婚庆用车,婚庆婚车车队" --publish

# 手动指定多张（可重复 --image），锚点自动均分；--image-layout group 可改为连续插在同一处
node scripts/bili_publish_pw.js --title-file t.txt --body-file b.txt \
  --image <素材目录>/14.jpg --image <素材目录>/11.jpg --image <素材目录>/9.jpg --publish
```

- 多张时**倒序插入**（避免块索引漂移，见 troubleshooting P17）。
- 不带任何 `--image` 且未给 `--tags` → 自动挑选仍会跑（关键词取标题）；`--no-image` 则纯文字发布。

**脚本内部六步**：
1. `page.goto(PUBLISH_URL)` 开全新编辑器（等价清空）
2. 标题：`.title-input__inner` 用 `locator.fill()`（新版无需 native setter）
3. 正文：`ClipboardEvent('paste')` 注入 `text/html`（唯一可靠方式）
4. 配图：按锚点定位到第 N 段末尾 → **粘贴图片文件** 触发 `upload_bfs`（多张时**倒序**逐张插）
5. 校验：打印块序列 + 抓 `draft/add` 请求体确认已换成图床 URL（`data:image` 应为 0 次）
6. 发布：点 iframe 内「发布」→ 等成功标志

**退出码**：`0` 成功 / `2` 需要验证码 / `1` 失败。

---

## 4. 风控验证码（大概率会遇到）

点发布后 `POST /x/dynamic/feed/create/opus` 返回 `code:-352`，编辑器 iframe 内弹「请完成验证」。
脚本会自动把验证码图导出到 `./bili_captcha.png` 并 **以退出码 2 退出**：

```
⚠️ 触发风控验证码（create/opus 返回 -352）
验证码图已导出: .../bili_captcha.png
```

读出图中字符（放大 5 倍最清楚），然后：

```bash
node scripts/bili_publish_pw.js --captcha M5hcD
```

脚本会：填入 `input.code-input` → 点「确定」→ 立刻再点「发布」→ 等成功标志。
（本轮可能连弹 2~3 张验证码，重复执行本命令即可。）

---

## 5. 结果校验

成功标志（任一命中）：
- 弹窗 `vui_dialog` 文本含 **「你的专栏已提交成功」**
- URL 离开 `upload/text/new-edit`

复核：

```bash
node scripts/bili_publish_pw.js --status
```

输出最近一篇的 `dyn_id / rid / title / pub_time` 与公开链接 `https://www.bilibili.com/opus/<dyn_id>`。

> ⚠️ 若点发布后 playwright 报 `vui_dialog--wrapper ... intercepts pointer events`，别慌——这说明**已经发布成功**，那个对话框挡住了按钮，不要再点。

---

## 6. 关键选择器速查（改版先跑 `bili_probe.js`）

| 目标 | 选择器 | 备注 |
|---|---|---|
| 编辑器 iframe | `iframe[src*="read-editor"]` | 标题/正文/发布按钮都在里面 |
| 标题 | `.title-input__inner` | **textarea**，`locator.fill()` 有效 |
| 正文 | `.tiptap.ProseMirror.eva3-editor` | TipTap，只认 paste 事件 |
| 配图（已插入） | `.tiptap.ProseMirror img` | src 长期为 `data:` 预览，属正常 |
| 发布 / 保存草稿 | iframe 内 `button` 文本「发布」「保存为草稿」 | |
| 验证码弹窗 | `.bili-img-verify` + `input.code-input` | 图片在 `.bili-img-verify img` |

---

## 7. 一次真实运行记录（2026-10-02 · 婚车租车）

- 关键词「婚车租车」→ 标题《婚车租车怎么选？车型、数量、预算一篇讲清楚》，正文 20 段 / 967 字
- 配图：`<素材目录>\14.jpg`（标签匹配 `婚庆用车` + `婚庆婚车车队`），插在第 2 段之后
- 图片上传：`upload_bfs` → 图床 `i0.hdslb.com/bfs/new_dyn/0149a5b13cf6a2fc2a15e16f8c75bba4487814960.jpg`
- 风控：连过 2 轮字符验证码（`M5hcD` → `sQukd`）
- 结果：**发布成功** 12:05，`dyn_id=1254454729060122661`
  → https://www.bilibili.com/opus/1254454729060122661
