// Fill B站 article form via isolated-browser CDP
// title: textarea native setter + 4 events
// body: .tiptap.ProseMirror innerHTML
(function() {
  var result = { titleFilled: false, contentFilled: false, titleError: null, contentError: null };

  var iframes = document.querySelectorAll('iframe');
  var targetIframe = null;
  for (var i = 0; i < iframes.length; i++) {
    if (iframes[i].src && iframes[i].src.indexOf('read-editor') !== -1) { targetIframe = iframes[i]; break; }
  }
  if (!targetIframe) { result.titleError = 'read-editor iframe not found'; result.contentError = 'read-editor iframe not found'; return JSON.stringify(result); }

  var doc = targetIframe.contentDocument || targetIframe.contentWindow.document;
  if (!doc) { result.titleError = 'Cannot access iframe document'; result.contentError = 'Cannot access iframe document'; return JSON.stringify(result); }

  var titleText = '明治维新：一场把日本甩进近代世界的疾速转身';
  var ta = doc.querySelector('.title-input__inner');
  if (ta) {
    var nativeSetter = Object.getOwnPropertyDescriptor(window.HTMLTextAreaElement.prototype, 'value').set;
    nativeSetter.call(ta, titleText);
    ['input','change','keyup','blur'].forEach(function(evt){ ta.dispatchEvent(new Event(evt, {bubbles:true})); });
    result.titleFilled = true;
    result.titleValue = ta.value;
  } else {
    result.titleError = 'Title textarea (.title-input__inner) not found';
  }

  var paras = [
    '<p>1868年，日本江户幕府落幕，明治天皇迁都东京，"明治"年号启用。此后不到半个世纪，这个闭关锁国的岛国，从一个被炮舰叩开港口的落后封建国家，一跃成为亚洲第一个近代工业化强国。这场被称作"明治维新"的疾速转身，至今仍是近代史研究里最令人惊叹的案例之一。</p>',
    '<h2>为什么是明治？</h2>',
    '<p>十九世纪中叶，西方列强的蒸汽船接连出现在日本近海。1853年的"黑船来航"让幕府的锁国体制彻底破产，接连签订的不平等条约，让有识之士意识到：不变，就要亡。</p>',
    '<p>倒幕派以"尊王攘夷"为旗号，推翻德川幕府，拥戴明治天皇重掌实权。与许多改革不同，明治维新的高明之处在于：它把"皇权"与"现代化"拧成了一股绳——自上而下推动变革，阻力被极大地压缩。</p>',
    '<h2>疾风骤雨的"全盘西化"</h2>',
    '<p>明治政府几乎是以冲刺的速度重构了整个国家：</p>',
    '<p>政治上，废藩置县，建立中央集权；颁布《大日本帝国宪法》，设立议会，尽管皇权至上，却第一次有了近代国家框架。</p>',
    '<p>经济上，废除士农工商身份等级，允许土地买卖；兴铁路、办工厂、设银行，殖产兴业。1872年东京—横滨铁路通车，是日本第一条铁路。</p>',
    '<p>教育上，1872年颁布《学制》，提出"邑无不学之户，家无不学之人"，强制性普及国民教育，为后来的工业腾飞埋下最关键的伏笔。</p>',
    '<p>军事上，取消武士垄断，推行征兵制，建立常备军，并全面学习普鲁士的建军模式。</p>',
    '<p>社会文化上，断发脱刀、改穿洋服、吃牛肉、跳交际舞……一时间"文明开化"成为潮流。福泽谕吉那句"脱亚入欧"，正是这个时代最直白的注脚。</p>',
    '<h2>光鲜背后的代价</h2>',
    '<p>明治维新并非田园诗。快速工业化建立在对农民的沉重税赋、对工人的严苛剥削之上；"富国强兵"的逻辑，最终滑向了对外扩张——甲午战争、日俄战争，日本一步步走上军国主义歧路。</p>',
    '<p>更重要的是，明治宪法把天皇神格化、权力绝对化，民权始终匍匐在皇权之下。这套体制在带来效率的同时，也埋下了二十世纪灾难的种子。</p>',
    '<h2>明治留给今天的镜鉴</h2>',
    '<p>明治维新证明了一件事：一个国家的命运，可以在一两代人的时间里被彻底改写。它的成功来自对落后清醒的认知、对先进毫不扭捏的学习，以及一套高效的执行体系。</p>',
    '<p>但它的教训同样刺眼——现代化不只是坚船利炮和GDP，更是制度、权利与对人本身的尊重。只学"术"不学"道"，强国终会变成危险的怪物。</p>',
    '<p>一百五十多年过去，明治时代的铁路、学堂、宪法文本大多已成故纸。但那场转身里关于"开放、学习、自省"的故事，仍值得每一个想要变好的国家静静听一听。</p>'
  ];

  var el = doc.querySelector('.tiptap.ProseMirror');
  if (el) {
    el.innerHTML = paras.join('');
    el.dispatchEvent(new Event('input', {bubbles:true}));
    result.contentFilled = true;
    result.contentLen = el.innerText.length;
  } else {
    result.contentError = 'Content area (.tiptap.ProseMirror) not found';
  }

  return JSON.stringify(result);
})();
