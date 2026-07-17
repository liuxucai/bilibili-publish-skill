/**
 * B站文章一键发布脚本
 * 
 * 浏览器驱动：xb CLI（agent-browser 0.25.3 封装）
 * 使用方法：
 *   node skills/bilibili-publisher/scripts/publish.js
 * 
 * 流程：
 *   1. 启动 Chrome（xb open）
 *   2. 检查登录态（get url）
 *   3. 填标题（textarea native setter + 4事件）
 *   4. 填正文（TipTap innerHTML）
 *   5. 发布（MouseEvent 三件套）
 *   6. 验证
 * 
 * ⚠️ 依赖：
 *   - xb CLI 路径：C:\Users\菠萝\.qclaw\skills\xbrowser\scripts\xb.cjs
 *   - 如果路径不同，修改 lib.js 中的 XB_PATH
 * 
 * ⚠️ 已知限制：
 *   - 登录验证码（极验）无法自动化，需用户手动完成
 *   - 发布后可能弹验证码弹窗，需用户手动完成
 */

const { 
  ensureChrome, checkLogin, waitForLogin,
  fillTitle, fillBody, publish, cleanup, sleep, snapshot, getUrl
} = require('./lib.js');

// ============================================================
// 文章内容 — 修改此处
// ============================================================

const ARTICLE = {
  title: '深圳：一座永不停机的城市',
  body: [
    '如果你问一个深圳人，"你是什么时候来深圳的？"',
    '答案可能千差万别——有人是90年代的拓荒者，有人是十年前毕业就来这里的追梦人，也有人是去年才下高铁的"深漂"。',
    '但如果你问他们"为什么留在深圳？"，答案往往只有一个：',
    '因为这里还在生长。',
    '',
    '深圳，基建狂魔的巅峰之作',
    '从罗湖到南山，从福田到龙岗，深圳的城市天际线一年一个样。',
    '2015年的时候，后海还是一片工地。2020年，中国华润大厦（春笋）已经成为深圳的新地标。到了2025年，深圳的超高层建筑数量已经位居全球前列。',
    '不是每个城市都有这种"一天一层楼"的速度。深圳的魔力在于——你离开半年回来，某个路口的地铁站已经通了。',
    '截至目前，深圳地铁已开通17条线路，总里程超500公里，日均客流量超过800万人次。',
    '',
    '南山的科技密度，可能全球最高',
    '如果你想感受未来的样子，来南山。',
    '粤海街道的科技密度高到什么程度？',
    '在这片不到20平方公里的土地上，聚集了超过100家上市公司。',
    '腾讯、大疆、中兴、字节跳动……这些名字，随便拿一个出来都是行业巨头，但在深圳，它们只是"邻居"。',
    '深圳的研发投入强度（R&D占GDP比重）长期保持在5%以上，超过以色列和韩国，位居全球前列。',
    '',
    '深圳人，都在忙什么？',
    '深圳的节奏快，是出了名的。',
    '凌晨12点的科技园，写字楼依然灯火通明。清晨6点的白石洲，早餐摊前已经排起了长队。',
    '深圳人不是在加班，就是在去加班的路上——这话虽然是调侃，但也侧面说明了深圳的拼搏精神。',
    '但千万别觉得深圳只有"卷"。',
    '深圳的公园数量超过1200个，是全国公园最多的城市之一。',
    '从莲花山到塘朗山，从深圳湾公园到大沙河生态长廊，深圳人在周末可以切换成"慢生活"模式。',
    '一边是效率至上的奋斗，一边是蓝天白云的惬意——这种张力，恰恰是深圳的魅力所在。',
    '',
    '一座来了就不想走的城市',
    '为什么深圳能吸引这么多人？',
    '因为深圳的经济活力。2024年深圳GDP突破3.7万亿元，位居全国第三。',
    '因为深圳的人口结构。深圳是全国最年轻的一线城市，平均年龄只有32.5岁。',
    '因为深圳的政策环境。"来了就是深圳人"不是一句口号，深圳的落户门槛在全国一线城市中是最低的。',
    '因为深圳的空气质量。2024年深圳PM2.5年均浓度仅为18微克/立方米。',
    '',
    '深圳，不是一个完美的城市',
    '这里确实有它的短板。',
    '房价高、教育医疗资源紧张、生活成本不低——深圳不是天堂。',
    '但深圳的底色是什么？是"允许一切发生"。',
    '在这个城市，没有人会在意你的出身、你的口音、你的过去。大家只关心一个问题：你能做什么？',
    '',
    '深圳精神：永远年轻，永远热泪盈眶',
    '今年是深圳经济特区建立的第46个年头。',
    '46年，从一个边陲小渔村成长为国际大都市，深圳的奇迹不是靠运气。',
    '它是每一个凌晨还在改方案的打工人拼出来的。',
    '它是每一个顶着台风暴雨送货的外卖小哥跑出来的。',
    '它是每一个从零开始的创业者熬出来的。',
    '深圳最稀缺的不是资本，不是政策，而是一颗永远想折腾的心。',
    '如果你正在想去不去深圳，别犹豫。',
    '这里的海风很咸，阳光很烈，但梦想，很甜。',
  ],
};

// ============================================================
// 主流程
// ============================================================

async function main() {
  try {
    console.log('');
    console.log('═══════════════════════════════');
    console.log('   B站文章发布 · 深圳主题');
    console.log('═══════════════════════════════');
    console.log('');
    console.log(`  标题: ${ARTICLE.title}`);
    console.log(`  正文: ${ARTICLE.body.filter(p => p).length} 段`);
    console.log('');

    // Step 1: 打开发布页
    console.log('┃ [1/6] 打开发布页...');
    await ensureChrome();
    console.log('  ✓ 发布页已打开');
    console.log('');

    // Step 2: 检查登录
    console.log('┃ [2/6] 检查登录状态...');
    const loginCheck = await checkLogin();
    if (!loginCheck.ok) {
      console.log('  ⚠️ 未登录B站');
      console.log('  请在浏览器窗口中手动完成登录：');
      console.log('    1. 切换到Chrome窗口');
      console.log('    2. 输入账号密码（如有需要）');
      console.log('    3. 完成图形验证码（依次点击提示文字）');
      console.log('    4. 发布页会自动加载');
      console.log('  等待手动登录...');
      const loginResult = await waitForLogin();
      console.log(`  ✓ 登录成功: ${loginResult.url}`);
    } else {
      console.log('  ✓ 已登录');
    }
    console.log('');

    // Step 3: 填标题
    console.log('┃ [3/6] 填写标题...');
    try {
      const titleResult = await fillTitle(ARTICLE.title);
      if (titleResult.code === 0 && titleResult.result && titleResult.result.ok) {
        console.log(`  ✓ 标题已填写（${titleResult.result.len}字）`);
      } else {
        const err = titleResult.result ? titleResult.result.error : titleResult.error;
        console.log(`  ✗ 标题填写失败: ${err || '未知错误'}`);
        console.log('  ⚠️ 请手动在浏览器中填写标题');
      }
    } catch (e) {
      console.log(`  ✗ 标题填写异常: ${e.message}`);
      console.log('  ⚠️ 请手动在浏览器中填写标题');
    }
    console.log('');

    // Step 4: 填正文
    console.log('┃ [4/6] 填写正文...');
    try {
      const bodyResult = await fillBody(ARTICLE.body);
      if (bodyResult.code === 0 && bodyResult.result && bodyResult.result.ok) {
        console.log(`  ✓ 正文已填写（${bodyResult.result.len}字）`);
      } else {
        const err = bodyResult.result ? bodyResult.result.error : bodyResult.error;
        console.log(`  ✗ 正文填写失败: ${err || '未知错误'}`);
        console.log('  ⚠️ 请手动在浏览器中填写正文');
      }
    } catch (e) {
      console.log(`  ✗ 正文填写异常: ${e.message}`);
      console.log('  ⚠️ 请手动在浏览器中填写正文');
    }
    console.log('');

    // 可选：显示 snapshot 确认
    try {
      const snap = await snapshot();
      if (snap) {
        const hasTitle = snap.includes(ARTICLE.title.substring(0, 10));
        console.log(`  确认：标题${hasTitle ? '✓ 可见' : '✗ 未显示'}`);
      }
    } catch (_) {}
    console.log('');

    // Step 5: 发布
    console.log('┃ [5/6] 发布文章...');
    try {
      const publishResult = await publish();
      if (publishResult.success) {
        console.log(`  ✓ 发布成功！`);
        console.log(`  文章URL: ${publishResult.url}`);
      } else {
        console.log(`  ⚠️ ${publishResult.message}`);
        console.log('  如果弹出了验证码，请在浏览器中：');
        console.log('    1. 输入验证码图片中的内容');
        console.log('    2. 点击「确定」');
        console.log('  完成后URL会自动跳转');
      }
    } catch (e) {
      console.log(`  ✗ 发布异常: ${e.message}`);
      console.log('  ⚠️ 请手动在浏览器中点击「发布」按钮');
    }
    console.log('');

    // Step 6: 验证
    console.log('┃ [6/6] 验证发布结果...');
    await sleep(3000);
    const finalUrl = await getUrl();
    if (finalUrl && !finalUrl.includes('new-edit')) {
      console.log(`  ✓ 发布完成！`);
      console.log(`  当前页面: ${finalUrl}`);
    } else {
      console.log('  当前仍在发布页，可能需要手动完成验证或点击发布');
    }
    console.log('');

    // 清理
    await cleanup();

    console.log('═══════════════════════════════');
    console.log('   发布流程结束');
    console.log('═══════════════════════════════');

  } catch (e) {
    console.error('');
    console.error('❌ 发布失败:', e.message);
    console.error('');
    console.error('调试建议：');
    console.error('  1. 运行 xb status 检查环境');
    console.error('  2. 手动访问 ' + require('./lib.js').PUBLISH_URL);
    console.error('  3. 用 xb snapshot -i 查看页面结构');
    console.error('  4. 更新 references/ 中的文档');
    process.exit(1);
  }
}

main();
