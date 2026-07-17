/**
 * B站文章快速发布脚本
 * 
 * 使用前提：浏览器已登录B站（profile ~/.chrome_qclaw_stable 中有登录态）
 * 使用方法：修改下面的 title 和 body，然后运行
 * 
 * PowerShell 执行：
 *   node skills/bilibili-publisher/scripts/quick_publish.js
 * 
 * ⚠️ 验证状态：
 *   - 标题/正文填写：已验证可通过 JS eval 填写
 *   - 发布按钮：待验证，可能需要手动点击
 */

const { ensureChrome, openPublishPage, fillTitle, fillBody, publish, cleanup } = require('./lib.js');

const ARTICLE = {
  title: '勇敢的心',  // ⚠️ 修改为你的标题
  body: [
    '在人类历史的长河中，总有一些故事能够穿越时空，触动每一代人的心灵。《勇敢的心》便是这样的作品。',
    '这部影片以13世纪苏格兰独立战争为背景，讲述了威廉·华莱士领导苏格兰人民反抗英格兰统治的传奇故事。',
    '勇气不仅仅是战场上挥剑的那一刻，它更多体现在日常生活中的每一个选择：面对不公时挺身而出的勇气，坚持自己信念的勇气。',
  ],
};

async function main() {
  try {
    console.log('=== B站文章快速发布 ===');
    console.log('标题:', ARTICLE.title);
    console.log('正文:', ARTICLE.body.length, '段');
    console.log('');
    
    // 1. 启动 Chrome
    console.log('1. 启动 Chrome...');
    await ensureChrome();
    console.log('  ✓ Chrome 已启动');
    console.log('');
    
    // 2. 打开发布页
    console.log('2. 打开发布页...');
    await openPublishPage();
    console.log('  ✓ 发布页已打开');
    console.log('');
    
    // 3. 填标题
    console.log('3. 填写标题...');
    try {
      const r = await fillTitle(ARTICLE.title);
      console.log('  ✓ 标题已填写:', r);
    } catch (e) {
      console.error('  ✗ 标题填写失败:', e.message);
      console.log('  ⚠️ 请在浏览器中手动填写标题');
    }
    console.log('');
    
    // 4. 填正文
    console.log('4. 填写正文...');
    try {
      const r = await fillBody(ARTICLE.body);
      console.log('  ✓ 正文已填写:', r);
    } catch (e) {
      console.error('  ✗ 正文填写失败:', e.message);
      console.log('  ⚠️ 请在浏览器中手动填写正文');
    }
    console.log('');
    
    // 5. 发布
    console.log('5. 发布文章...');
    try {
      const result = await publish();
      if (result.success) {
        console.log('  ✓ 发布成功！');
      } else {
        console.log('  ⚠️ 请在浏览器中手动点击「发布」按钮');
      }
    } catch (e) {
      console.log('  ⚠️ 请在浏览器中手动点击「发布」按钮');
    }
    
    // 清理
    await cleanup();
    
    console.log('');
    console.log('=== 发布流程结束 ===');
    
  } catch (e) {
    console.error('❌ 发布失败:', e.message);
    console.error('请手动访问', require('./lib.js').PUBLISH_URL);
  }
}

main();
