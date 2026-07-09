// Fill B站 article form - 2026-07-09 更新
// 标题用 textarea native setter + 4事件
// 正文用 .tiptap.ProseMirror innerHTML
// 文档：SKILL.md 中 关键难点 章节
(function() {
  const result = {
    titleFilled: false,
    contentFilled: false,
    titleError: null,
    contentError: null
  };
  
  // Find the read-editor iframe
  const iframes = document.querySelectorAll('iframe');
  let targetIframe = null;
  
  for (const iframe of iframes) {
    if (iframe.src && iframe.src.includes('read-editor')) {
      targetIframe = iframe;
      break;
    }
  }
  
  if (!targetIframe) {
    result.titleError = 'read-editor iframe not found';
    result.contentError = 'read-editor iframe not found';
    return JSON.stringify(result, null, 2);
  }
  
  const doc = targetIframe.contentDocument || targetIframe.contentWindow.document;
  if (!doc) {
    result.titleError = 'Cannot access iframe document';
    result.contentError = 'Cannot access iframe document';
    return JSON.stringify(result, null, 2);
  }
  
  // --- Fill title (textarea native setter + 4 events) ---
  const titleTextarea = doc.querySelector('.title-input__inner');
  if (titleTextarea) {
    // 用 native setter（普通赋值 React 检测不到）
    var nativeSetter = Object.getOwnPropertyDescriptor(
      window.HTMLTextAreaElement.prototype, 'value'
    ).set;
    nativeSetter.call(titleTextarea, '稳健：在不确定的世界里，做一个确定的人');
    
    // 触发 React 检测事件
    ['input', 'change', 'keyup', 'blur'].forEach(function(evt) {
      titleTextarea.dispatchEvent(new Event(evt, { bubbles: true }));
    });
    
    result.titleFilled = true;
    result.titleValue = titleTextarea.value;
  } else {
    result.titleError = 'Title textarea (.title-input__inner) not found';
  }
  
  // --- Fill content (TipTap ProseMirror) ---
  const contentArea = doc.querySelector('.tiptap.ProseMirror');
  if (contentArea) {
    contentArea.innerHTML = [
      '<p>在这个充满不确定性的时代，「稳健」是一种稀缺的品质，更是一种高级的智慧。</p>',
      '<p>不冒进，不急躁，不随风摇摆——稳，不是慢，而是每一步都踩实了再走。</p>',
      '<h2>什么是真正的稳健？</h2>',
      '<p>很多人把稳健等同于保守、退缩、不敢尝试。这是天大的误解。</p>',
      '<p>真正的稳健，是在充分认知风险的前提下做出决策，是知道自己能承受多大波动后仍然选择前进。</p>',
      '<h2>为什么我们需要稳健？</h2>',
      '<p>这几年的经历教会我们一件事：黑天鹅永远存在，灰犀牛随时会来。</p>',
      '<p>稳健的核心逻辑很简单：活得久，比跑得快更重要。</p>',
    ].join('');
    contentArea.dispatchEvent(new Event('input', { bubbles: true }));
    result.contentFilled = true;
    result.contentLen = contentArea.innerText.length;
  } else {
    result.contentError = 'Content area (.tiptap.ProseMirror) not found';
  }
  
  return JSON.stringify(result, null, 2);
})();
