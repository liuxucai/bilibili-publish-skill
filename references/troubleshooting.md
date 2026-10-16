# B站文章发布 — 故障排查（2026-10-02 实测重写）

> 本文档是**唯一权威版本**，基于 2026-10-02 在本机跑通《婚车租车》全流程的真实踩坑记录。
> 旧版基于 xb CLI 的内容（`lib.js` / `publish.js` / `fill_form5.js` / `click_*.js` / `quick_publish.js`）已全部删除——那套在本机根本跑不起来，见 P1。

浏览器驱动：**隔离 Chrome（profile `~/.chrome_qclaw_stable`）+ playwright-core 直连 CDP 9222**

---

## P1. xb CLI 不存在，整个旧方案失效 ⛔（最高优先级）

**症状**：`node .../xb.cjs` 报 `MODULE_NOT_FOUND` / `ENOENT`；或 `F:\qclaw` 目录根本不存在。

**原因**：技能早期依赖 xb CLI（agent-browser 封装），但那套东西（`C:\Users\<用户名>\.qclaw\...`、`<盘符>:\qclaw\...`）属于**原作者机器**的环境，本机不一定有。

**解决**：整体切换到「自己拉隔离 Chrome + playwright-core 直连 CDP」。

```bash
node ../isolated-browser/scripts/launch.js && sleep 7200     # 必须后台常驻
node scripts/bili_publish_pw.js --probe             # 验证能连上
```

> 相关连的老坑一并作废：`xb 输出带非 JSON 前缀`、`eval --base64 解码失败`、`xb cleanup/status` 等，全部不再需要。

---

## P2. 沙箱回收 detached Chrome，进程活不过一条命令

**症状**：`launch.js` 打印了 PID，紧接着下一条命令就 `ECONNREFUSED 9222`。

**原因**：WorkBuddy 沙箱会在**命令结束时回收 detached 子进程**，`spawn(detached)` + `unref()` 也保不住。

**解决**：拉起 Chrome 的 Bash 调用必须带 `run_in_background: true`，且命令末尾接 `&& sleep 7200` 把进程吊住。

---

## P3. 窗口被遮挡 → 页面不渲染（防节流参数）

**症状**：`document.visibilityState === 'hidden'`，懒加载弹窗只挂空壳、按钮恒 disabled、截图全黑。

**解决**：`isolated-browser/scripts/launch.js` 已内置四条启动参数，**不要删**（本 skill 原自带的 `launch-cdp-chrome.js` 已删除，改用该共享脚本）：

```
--disable-backgrounding-occluded-windows
--disable-background-timer-throttling
--disable-renderer-backgrounding
--disable-features=CalculateNativeWinOcclusion
```

`Page.bringToFront` 对被遮挡窗口无效，只能靠启动参数兜底。

---

## P4. 正文怎么都写不进去（TipTap 编辑器）

**症状**：`el.innerHTML = ...` 看似写入成功，一点击编辑器内容就消失；或字数统计不动。

**原因**：B站用的是 TipTap/ProseMirror（`.tiptap.ProseMirror.eva3-editor`），直接改 innerHTML 会与其内部文档状态脱钩，下次交互被回写覆盖。

**解决**：**模拟 paste 事件**，让编辑器自己解析 HTML（2026-10-02 验证：注入后点击段落、停留观察均不丢）：

```js
el.focus();
const dt = new DataTransfer();
dt.setData('text/html', '<p>段1</p><p>段2</p>');
el.dispatchEvent(new ClipboardEvent('paste', { clipboardData: dt, bubbles: true, cancelable: true }));
```

> 注：老版 B站标题是 textarea，需要 `native setter + 4 事件`；**新版不需要**——`.title-input__inner` 用 playwright 的 `locator.fill()` 直接生效（已验证）。旧文档的 native setter 写法可以不用了。

---

## P5. 插图失败之一：工具栏图片按钮 + filechooser ❌

**症状**：点 `eva3-toolbar-image` → 原生文件选择框（被 playwright 拦成 filechooser）→ `setFiles()` 后，编辑器里确实出现图片，**但 img.src 永远是 `data:image/jpeg;base64,...`，且上传接口一个都没发**。

**原因**：这条路径插入的是「本地图片」节点（等价于拖入本地文件），会走编辑器内部的本地图片占位逻辑，不触发 `upload_bfs`，即使在 `bilibili.com` 图床里能显示，序列化/发布时也会出问题。

**解决**：**不要用工具栏按钮插图**，改用 P6 的粘贴文件方案。

---

## P6. 插图失败之二：粘贴图片文件 ✅（唯一可靠方案）

**解决**：把本地文件读成字节 → 构造 `File` → 塞进 `DataTransfer.items` → 派发 paste：

```js
const file = new File([uint8Array], 'car14.jpg', { type: 'image/jpeg' });
const dt = new DataTransfer();
dt.items.add(file);
el.focus();
el.dispatchEvent(new ClipboardEvent('paste', { clipboardData: dt, bubbles: true, cancelable: true }));
```

**判定成功**：网络里出现 `POST https://api.bilibili.com/x/dynamic/feed/draw/upload_bfs`，随后 `GET https://i0.hdslb.com/bfs/new_dyn/xxx.jpg`。

---

## P7. 「等了 60 秒 img.src 还是 base64」——这是正常的，别等 ⚠️

**症状**：图片明明上传成功（有 upload_bfs 响应、有 CDN GET），但 DOM 里 `img.src` 始终是 `data:image/jpeg;base64,...`，`el.innerHTML.includes('hdslb.com')` 为 false。于是误判为「上传超时」，脚本反复重试、甚至把好图删掉重插。

**真相**：eva3 编辑器 DOM 里保留的是**本地预览**；**只有序列化时才替换成图床 URL**。

**如何确认真的上传成功**（任选其一）：
1. 抓 `POST /x/dynamic/feed/article/draft/add` 的 **POST body**，里面已是：
   `{"para_type":2,"pic":{"pics":[{"url":"http://i0.hdslb.com/bfs/new_dyn/xxx.jpg","width":800,...}]}}`
   → `body.includes('hdslb.com') === true` 且 `data:image` 出现 **0** 次。
2. 发布后打开公开页，`document.querySelectorAll('article img')` 的 src 是 `i0.hdslb.com/bfs/new_dyn/...`。

**所以**：`bili_publish_pw.js` 只等「图片节点出现」，并额外抓一次草稿 body 做校验，不再傻等 src 变 http。

---

## P8. 图片上传状态判断用错选择器（一次误判）

**症状**：写检查脚本时 `document.querySelector('img')` 只取到第一张图（旧的 base64 那张），于是把「已上传的新图」判成未上传。

**解决**：一律用 `document.querySelectorAll('.tiptap.ProseMirror img')` 取全部，逐张看 src；配合 P7 的草稿 body 校验，别只看 DOM。

---

## P9. `/new-edit` 重载后草稿不恢复 —— 重载等于清空

**症状**：想「重载页面把草稿读回来」继续改，结果编辑器空白，之前的内容和测试文字全没了（内容只存在投稿管理的「草稿」里）。

**结论**：`/upload/text/new-edit` **每次都开一个新编辑器**，不会恢复上次草稿。
**用法**：把它当「清空重来」的手段即可——要重做就重载，别指望它读回草稿；草稿请去 `投稿 → 图文管理 → 草稿` 找。

---

## P10. 发布被风控拦截：`create/opus` 返回 `code:-352` + 字符验证码

**症状**：点「发布」→ `POST https://api.bilibili.com/x/dynamic/feed/create/opus` 返回 `{"code":-352,"message":"-352"}`，URL 不变，编辑器 iframe 内弹出「请完成验证」弹窗。

**DOM**（验证码就在**编辑器 iframe 里**，不是主文档）：

| 元素 | 选择器 |
|---|---|
| 弹窗容器 | `.bili-img-verify`（标题文字「请完成验证」） |
| 验证码图 | `.bili-img-verify img` → `src` 是 `data:image/jpeg;base64,...`（200×50） |
| 输入框 | `input.code-input`（placeholder「请输入图片中的内容」） |
| 确定/取消 | 弹窗内文本「确定」「取消」 |

**解决（可自动化，无需人工）**：
1. 从 DOM 直接取验证码图（**不要截图**，见 P11）：`.bili-img-verify img.src` → base64 落盘 → 放大 5 倍读出字符（本次实测样例：`M5hcD`、`sQukd`）。
2. `input.code-input` 填答案 → 点弹窗内「确定」→ **1.5 秒内立刻再点一次「发布」**。
3. 成功标志：弹出 `vui_dialog`，文本 = **「你的专栏已提交成功|点击查看」**（或 URL 跳到 `upload-manager/opus`）。

**注意**：
- **只解验证码不点发布，不会自动续发**——必须手动再点一次「发布」。
- 每被拦一次就弹一张新验证码；`create/opus` 成功前可能连着弹 2~3 轮，属正常。
- 提交后弹「你的专栏已提交成功」对话框会**挡住发布按钮**（playwright 报 `vui_dialog--wrapper ... intercepts pointer events`）——看到这个报错说明**已经发布成功**，别再点第二次。

---

## P11. 截图相关：整页截图可用，clip/playwright 截图会挂起

**症状**：
- `page.screenshot()` 报 `Timeout 30000ms exceeded ... waiting for fonts to load`；
- CDP `Page.captureScreenshot` 带 `clip` + `scale` 时挂住不返回（跑满 2 分钟）。

**解决**：
- 要画面就用**不带 clip/scale 的** `Page.captureScreenshot`（cdplib.js 的 `fullScreenshot()`）——本次验证可用。
- 要**验证码**就别截图：直接从 `.bili-img-verify img.src` 取（P10）。
- 想放大验证码：小工具 Pillow（本机已装在 managed python 3.13.12）。

---

## P12. 首次拿到验证码截图是「文章配图」而非验证码

**症状**：写「遍历所有 frame、找 `img[src^=data:image]`」的脚本取验证码，结果存下来的是 320KB 的文章配图（编辑器里那张）。

**原因**：编辑器 iframe 里本来就有配图的 base64 img，且它也是 `data:image/jpeg`、宽度 > 30。

**解决**：先把范围收窄到弹窗 —— `.bili-img-verify img`；或按尺寸过滤（验证码 200×50，配图 800 宽）。

---

## P13. 发布结果怎么确认（别用「URL 变了」当唯一判据）

多路确认，任一命中即成功：

| 判据 | 说明 |
|---|---|
| 弹窗文本 | `vui_dialog` 含「你的专栏已提交成功」 |
| URL | 离开 `upload/text/new-edit`（常跳到 `upload-manager/opus`） |
| 列表接口 | 管理页 iframe 内 `fetch`：<br>`https://api.bilibili.com/x/polymer/web-dynamic/v1/opus/creationlist?ps=10&pn=1&classification_type=0&creation_type=0`（`credentials:'include'`）→ `items[0].dyn_id / rid / title / pub_time` |
| 公开页 | `https://www.bilibili.com/opus/<dyn_id>`，检查标题、正文、`article img` 是否为 `i0.hdslb.com/bfs/new_dyn/...` |

**本次实测结果**：`dyn_id=1254454729060122661`，12:05 发布，配图 URL `i0.hdslb.com/bfs/new_dyn/0149a5b13cf6a2fc2a15e16f8c75bba4487814960.jpg`，位置正确（第 2 段与「一、婚车车型怎么选」之间）。

---

## P14. 切到「一行一段」的正文文件更稳

**症状**：用「空行分段」的 .txt 时，正文里被误构建出大量空 `<p>`（段落数 20 → 实际 967 字却有 20 块），或反过来合并成一段。

**解决**：正文文件**一行一段**（`bili_publish_pw.js` 默认 `--body-mode line`），空行直接忽略；确实要空行分段再加 `--body-mode blank`。

---

## P15. 快速自检清单（发布前/失败时照着跑）

```bash
# 1. Chrome 在不在
curl -s http://127.0.0.1:9222/json/version | head -3

# 2. 编辑器选择器还有效吗
node scripts/bili_probe.js

# 3. 登录态还在吗（URL 应停在 member.bilibili.com，不是 passport.bilibili.com）
node -e "require('./scripts/cdplib').connect().then(({page,browser})=>{console.log(page.url());return browser.close()})"

# 4. 干跑一遍（只填内容、不落草稿）
node scripts/bili_publish_pw.js --title-file t.txt --body-file b.txt --image x.jpg --image-at 2 --no-save

# 5. 只存草稿（不提交）
node scripts/bili_publish_pw.js --title-file t.txt --body-file b.txt

# 6. 正式发布（若退出码 2 → 读验证码图后补 --captcha）
node scripts/bili_publish_pw.js --title-file t.txt --body-file b.txt --image x.jpg --image-at 2 --publish
```

> 调试图省事就用 `--no-save`：只填充+打印块结构，**不触发保存草稿**（已验证草稿箱零残留）。
> 因为 eva3 编辑器有自动保存，任何「填了内容」的调试都可能落进草稿箱，测试完记得去 `投稿 → 图文管理 → 草稿` 清掉。

---

## P16. 清理测试产生的草稿（删除按钮点不动）

**症状**：想删掉测试草稿，但：
- `document.querySelectorAll` 扫不到「删除」元素（`hits: 0`）；
- 用 `el.click()` / `dispatchEvent(MouseEvent)` 手动派发事件，**返回 true 但草稿纹丝不动**（vui 组件需要真实鼠标事件）。

**原因**：草稿列表在 iframe + 自定义组件里，删除入口对合成事件不响应。

**解决**：用 playwright 的 locator（会穿透 open shadow DOM 且派发**受信任**事件），并**用「标题 + 最后修改时间」双条件定位卡片**，避免误删同名草稿：

```js
const card = page.locator('[class*=card]', { hasText: 标题 }).filter({ hasText: '最后修改时间：2026-10-02 11:48:17' }).first();
await card.getByText('删除', { exact: true }).first().click();     // 真实点击
await page.getByText('确定', { exact: true }).last().click();      // 确认弹窗
```

**排查地址**：`https://member.bilibili.com/opus/management/drafts`（页面文本里每个草稿都带「最后修改时间」，用它区分）。
**踩坑提醒**：删除前一定核对时间戳——同名草稿可能同时存在（已发布的文章也会在图文列表里显示同名标题，别删错）。

---

## P17. 多图（3 张）改造（2026-10-12）

**新增能力**：`bili_publish_pw.js` 的 `--image` 支持**重复传参**（`argAll('image')` 收集为数组），
并新增 `--keyword` / `--tags` / `--image-top` / `--image-layout`（`spread` 均分 / `group` 连续）/ `--no-image`。
不给 `--image` 时由共享工具 `../../isolated-browser/scripts/post_images.js` 的 `planImages()`
按「标签 → 素材库」自动挑 3 张并算好插入锚点。

### 问题 1：多图按顺序插会串位
- **现象**：按 slot 从小到大依次插图时，第 2、3 张落到错误段落。
- **原因**：每插一张图都会在编辑器里**新增一个 block**，后面尚未处理的锚点索引整体后移。
- **解决**：**倒序插入**（slot 大的先插）——插前面的图不会影响后面锚点的索引。
  实现：`order = images.sort((a,b) => b.at - a.at)`。

### 问题 2：多图时"上传是否成功"的判据要按累计数看
- **现象**：只看第 1 张的 src 会误判。
- **解决**：以「**图床 URL 数 = 图片数**」为准。P7 的草稿 body 校验同样适用：
  发布前抓 `draft/add` 请求体，确认每张 `pic.pics[].url` 都是 `hdslb.com`，且 `data:image` 出现 **0** 次。

### 实测结果（2026-10-12）
3 张图分别落在第 **3 / 7 / 10** 段之后，块结构完整；
草稿序列化校验：**图床 URL = true / base64 残留 = 0**。

### 已证伪（勿再试）
| 做法 | 为什么不行 |
|---|---|
| 正序逐张插图 | 锚点索引漂移，第 2 张起位置错 |
| 用一次 paste 塞多个 File 实现多图 | 编辑器按「一次粘贴一个块」处理，多文件不可控 |
| 用 `eva3-toolbar-image`（工具栏图片按钮）插图 | 早于 P5 已证伪：插的是本地 base64 节点，不触发 `upload_bfs` |

---

## P18. `--captcha` 提交后报「vui_dialog 拦截点击」= 大概率已发布成功（2026-10-12 实测）

**现象**：`--captcha dVGkr` 提示「验证码已提交」后，脚本回头点「发布」按钮时报：

```
ERR locator.click: Timeout 8000ms exceeded.
  - <button ...>发布</button>
  - <div class="vui_dialog--wrapper">…</div> from <div class="vui_dialog--root">…</div>
    subtree intercepts pointer events
```

退出码 1，**看起来像失败**。

**根因**：验证码通过后发布实际上已经完成，**成功弹窗挡住了发布按钮**——与「结果校验口径」一节
"点发布被 vui_dialog 拦截 = 已成功" 是同一个现象，只是这次发生在验证码补填流程里，脚本把它当成了失败。

**✅ 解决**：遇到该报错**先查状态、绝不要再补一次发布**（会重复发稿）：

```bash
node scripts/bili_publish_pw.js --status
```

能查到刚发的标题 + `dyn_id` 即为成功。

**实测**：2026-10-12 18:27，《婚车租车怎么选不踩坑？…》验证码 `dVGkr` 一次通过 → 报上述错 →
`--status` 查到 `dyn_id 1258264021493088277`；公开页 3 张配图均为 `i2.hdslb.com/bfs/new_dyn/...` 外链。

**验证码识别经验**：导出的 `bili_captcha.png` 用视觉模型/人工直接读字符即可，实测一次通过；
文件是运行产物，已加 `.gitignore` 不入库。

---

## P19. 专栏封面：「自定义封面」是发布设置里的开关，**已发布后无法网页补设**（2026-10-13 二次实测修订）

**机制**：编辑器（含 iframe `member.bilibili.com/york/read-editor`）的「发布设置 → 自定义封面」
是一个 **`vui_switch` 开关，默认关闭** —— 不开开关时封面自动取正文开头文字，分享卡 `pic`
兜底为 `static.hdslb.com/mobile/img/app_logo.png`（分享出去很丑）。

**✅ 正确设置姿势（发布时做，已固化进 `bili_publish_pw.js --cover`）**：
1. 打开开关：`iframe.locator('.form-item:has(.form-item-label:text-is("自定义封面")) .vui_switch--switch').click()`
   （先读 `input[type=checkbox].checked` / `aria-checked`，已开不重复点）
2. 点新出现的「**添加封面**」→ iframe 出现 `input[type=file]`（accept `.jpg,.jpeg,.png`，**单选**）
3. `setInputFiles` 上传（建议 ≥600×336）
4. ⚠️ **会弹「选择封面的截取位置」裁剪弹窗**（早前"无裁剪"结论有误——此前是在空白新稿上测的），
   必须点弹窗内「确定」，否则封面停在弹窗里不生效
5. 正常点「发布」

**⚠️ 已发布的图文（opus）无法补设封面**（三路全堵，勿再试）：
- opus 公开页右上角「···」（`.opus-more__btn`）菜单**只有「可见范围 / 删除」**，没有「编辑」；
- 图文管理侧栏的「图文管理」子菜单默认**折叠不可见**（`bcc-nav-slider-sub-menu__group` vis=false）；
- `upload/text/new-edit?opus_id=<id>` 打开的是**空白新稿**（`opus_id` 参数无效）——
  在空白稿上开开关、传封面、点「发布」会被**静默拦截**（标题必填）：不弹窗、不报错、URL 不变。
  （好在空稿不会被保存，无残留。）

**封面判据（2026-10-13 修订，重要）**：
- ✅ **权威判据**：创作中心 `opus/creationlist` API 返回条目的 **`cover.url`**
  （图床 `i0.hdslb.com/bfs/new_dyn/...` = 生效；空 = 未生效）。
- ⚠️ **公开页 `__INITIAL_STATE__` 的 `share_info.pic` 有延迟**：刚发布时仍兜底 `app_logo.png`，
  发布后几分钟内据此判"未生效"会**误报**（实测：API 已是真封面，公开页 pic 仍 app_logo）。
- 复核命令：`node scripts/bili_publish_pw.js --check-cover <dyn_id>`（先查 API，公开页仅兜底）。

**实测（2026-10-13 12:10）**：《陪表弟订婚车跑了两周…》
→ https://www.bilibili.com/opus/1258537975963189301 （dyn_id 1258537975963189301），
封面 9.jpg 裁剪为 622×350 落图床 `bfs/new_dyn/fd9b00ecb...jpg`，验证码 `6Tdp7` 一次通过。
