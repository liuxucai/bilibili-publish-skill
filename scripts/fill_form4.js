// Fill B站 article form - fixed selectors
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
  
  const iframeDoc = targetIframe.contentDocument || targetIframe.contentWindow.document;
  if (!iframeDoc) {
    result.titleError = 'Cannot access iframe document';
    result.contentError = 'Cannot access iframe document';
    return JSON.stringify(result, null, 2);
  }
  
  // Fill title - it's a TEXTAREA with placeholder containing "标题"
  const titleTextarea = iframeDoc.querySelector('textarea[placeholder*="标题"]');
  if (titleTextarea) {
    titleTextarea.value = '勇敢的心';
    titleTextarea.dispatchEvent(new Event('input', { bubbles: true }));
    titleTextarea.dispatchEvent(new Event('change', { bubbles: true }));
    result.titleFilled = true;
    result.titleValue = titleTextarea.value;
  } else {
    result.titleError = 'Title textarea not found';
  }
  
  // Fill content - it's a ProseMirror editor (contenteditable DIV)
  const contentArea = iframeDoc.querySelector('.tiptap.ProseMirror, .eva3-editor, [contenteditable="true"]');
  if (contentArea) {
    // For ProseMirror, we need to set innerHTML
    contentArea.innerHTML = '<p>《勇敢的心》是一部震撼人心的作品，讲述了...</p>';
    contentArea.dispatchEvent(new InputEvent('input', { bubbles: true }));
    result.contentFilled = true;
  } else {
    result.contentError = 'Content area (ProseMirror) not found';
  }
  
  return JSON.stringify(result, null, 2);
})();
