/**
 * B站文章发布 - 深圳主题
 * 精简直接版，适应已登录状态
 */

const { 
  xb, evalJs, evalInIframe, sleep, snapshot, getUrl, cleanup
} = require('./lib.js');

const XB = "C:\\Users\\菠萝\\.qclaw\\skills\\xbrowser\\scripts\\xb.cjs";
const PUBLISH_URL = 'https://member.bilibili.com/platform/upload/text/new-edit';

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

/**
 * 执行 xb 命令并返回解析后的结果
 */
function runXb(action, timeout = 20000) {
  const { execSync } = require('child_process');
  const fullCmd = `"node" "${XB}" run --browser chrome ${action}`;
  const out = execSync(fullCmd, { timeout, windowsHide: true, encoding: 'utf8', maxBuffer: 10*1024*1024 });
  const lines = out.trim().split('\n');
  for (let i = lines.length - 1; i >= 0; i--) {
    const line = lines[i].trim();
    if (line.startsWith('{')) {
      return JSON.parse(line);
    }
  }
  return null;
}

/**
 * 获取 eval 返回值
 */
function evalJsRaw(jsCode, timeout = 20000) {
  const b64 = Buffer.from(jsCode, 'utf8').toString('base64');
  const r = runXb(`eval --base64 ${b64}`, timeout);
  if (r && r.data && r.data.result && r.data.result.success) {
    return r.data.result.data.result;
  }
  return null;
}

async function main() {
  console.log('');
  console.log('═══════════════════════════════');
  console.log('   B站文章发布 · 深圳主题');
  console.log('═══════════════════════════════');
  console.log('');

  // 1. 确认登录状态
  console.log('┃ 检查当前状态...');
  const r = runXb('get url');
  const url = r?.data?.result?.data?.url || '';
  console.log(`  当前URL: ${url}`);
  
  const isLoggedIn = url.includes('member.bilibili.com') && !url.includes('login');
  if (!isLoggedIn) {
    console.log('  ⚠️ 未登录，请手动登录后重试');
    process.exit(1);
  }
  console.log('  ✓ 已登录');
  console.log('');

  // 2. 确保在发布页
  if (!url.includes('new-edit')) {
    console.log('  导航到发布页...');
    runXb(`open "${PUBLISH_URL}"`, 15000);
    await sleep(3000);
  }
  console.log('');

  // 3. 填标题
  console.log('┃ 填写标题...');
  const titleJs = `(function(){
    var iframe = document.querySelector('iframe[src*="read-editor"]');
    if(!iframe) return JSON.stringify({error:'NO_IFRAME'});
    var doc = iframe.contentDocument || iframe.contentWindow.document;
    var ta = doc.querySelector('.title-input__inner');
    if(!ta) return JSON.stringify({error:'NO_TITLE'});
    var ns = Object.getOwnPropertyDescriptor(window.HTMLTextAreaElement.prototype,'value').set;
    ns.call(ta, '${ARTICLE.title.replace(/'/g, "\\'")}');
    ['input','change','keyup','blur'].forEach(function(e){ta.dispatchEvent(new Event(e,{bubbles:true}))});
    return JSON.stringify({ok:true,len:ta.value.length});
  })()`;
  const titleResult = evalJsRaw(titleJs);
  if (titleResult) {
    const tr = JSON.parse(titleResult);
    if (tr.ok) console.log('  ✓ 标题已填写（' + tr.len + '字）');
    else console.log('  ✗ ' + tr.error);
  }
  console.log('');

  // 4. 填正文
  console.log('┃ 填写正文...');
  const sections = ARTICLE.body.map(p => '<p>' + p.replace(/</g, '&lt;').replace(/>/g, '&gt;') + '</p>').join('');
  const bodyJs = `(function(){
    var iframe = document.querySelector('iframe[src*="read-editor"]');
    if(!iframe) return JSON.stringify({error:'NO_IFRAME'});
    var doc = iframe.contentDocument || iframe.contentWindow.document;
    var el = doc.querySelector('.tiptap.ProseMirror');
    if(!el) return JSON.stringify({error:'NO_EDITOR'});
    el.innerHTML = '${sections.replace(/'/g, "\\'").replace(/\n/g, '')}';
    el.dispatchEvent(new Event('input', {bubbles:true}));
    return JSON.stringify({ok:true, len: el.innerText.length});
  })()`;
  const bodyResult = evalJsRaw(bodyJs);
  if (bodyResult) {
    const br = JSON.parse(bodyResult);
    if (br.ok) console.log('  ✓ 正文已填写（' + br.len + '字）');
    else console.log('  ✗ ' + br.error);
  }
  console.log('');

  // 5. 截图确认
  console.log('┃ 截图确认表单...');
  runXb('screenshot', 10000);
  console.log('  ✓ 截图已保存');
  console.log('');

  // 6. 点击发布
  console.log('┃ 点击发布按钮...');
  const clickJs = `(function(){
    var iframe = document.querySelector('iframe[src*="read-editor"]');
    if(!iframe) return JSON.stringify({error:'NO_IFRAME'});
    var doc = iframe.contentDocument || iframe.contentWindow.document;
    var btns = doc.querySelectorAll('button');
    var found = null;
    btns.forEach(function(b){if(b.innerText.trim()==='发布')found=b;});
    if(!found) return JSON.stringify({error:'NO_PUBLISH_BUTTON'});
    found.dispatchEvent(new MouseEvent('mousedown',{bubbles:true}));
    found.dispatchEvent(new MouseEvent('mouseup',{bubbles:true}));
    found.dispatchEvent(new MouseEvent('click',{bubbles:true}));
    return JSON.stringify({ok:true});
  })()`;
  const clickResult = evalJsRaw(clickJs);
  if (clickResult) {
    const cr = JSON.parse(clickResult);
    if (cr.ok) console.log('  ✓ 发布按钮已点击');
    else console.log('  ✗ ' + cr.error);
  }
  console.log('');

  // 7. 等待跳转
  console.log('┃ 等待发布结果...');
  await sleep(5000);
  const finalR = runXb('get url');
  const finalUrl = finalR?.data?.result?.data?.url || '';
  console.log(`  当前URL: ${finalUrl}`);
  
  if (finalUrl && !finalUrl.includes('new-edit')) {
    console.log('  ✅ 发布成功！');
    console.log('  URL: ' + finalUrl);
  } else {
    console.log('  页面未跳转，可能需要手动处理验证码弹窗');
    console.log('  请在Chrome窗口中检查并输入验证码');
  }
  
  console.log('');
  console.log('═══════════════════════════════');
  console.log('   流程结束');
  console.log('═══════════════════════════════');
}

main().catch(e => {
  console.error('❌ 失败:', e.message);
  process.exit(1);
});
