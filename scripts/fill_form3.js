// Fill B站 article form - access iframe correctly
(function() {
  const result = {
    titleFilled: false,
    contentFilled: false,
    titleError: null,
    contentError: null,
    iframeFound: false
  };
  
  // Find the read-editor iframe
  const iframes = document.querySelectorAll('iframe');
  let targetIframe = null;
  
  for (const iframe of iframes) {
    if (iframe.src && iframe.src.includes('read-editor')) {
      targetIframe = iframe;
      result.iframeFound = true;
      break;
    }
  }
  
  if (!targetIframe) {
    result.titleError = 'read-editor iframe not found';
    result.contentError = 'read-editor iframe not found';
    return JSON.stringify(result, null, 2);
  }
  
  // Access iframe content
  const iframeDoc = targetIframe.contentDocument || targetIframe.contentWindow.document;
  if (!iframeDoc) {
    result.titleError = 'Cannot access iframe document (cross-origin?)';
    result.contentError = 'Cannot access iframe document (cross-origin?)';
    return JSON.stringify(result, null, 2);
  }
  
  // Fill title - search inside iframe
  const titleSelectors = [
    'input[placeholder*="标题"]',
    'textarea[placeholder*="标题"]',
    '[aria-label*="标题"]',
    '[role="textbox"][aria-label*="标题"]',
    '.title-input input',
    'input[type="text"]'
  ];
  
  let titleInput = null;
  for (const selector of titleSelectors) {
    const el = iframeDoc.querySelector(selector);
    if (el) {
      titleInput = el;
      break;
    }
  }
  
  if (titleInput) {
    titleInput.value = '勇敢的心';
    titleInput.dispatchEvent(new Event('input', { bubbles: true }));
    titleInput.dispatchEvent(new Event('change', { bubbles: true }));
    result.titleFilled = true;
    result.titleValue = titleInput.value;
  } else {
    result.titleError = 'Title input not found in iframe';
    // Debug: log all inputs in iframe
    const allInputs = iframeDoc.querySelectorAll('input, textarea, [role="textbox"]');
    result.availableInputsInIframe = Array.from(allInputs).map(el => ({
      tag: el.tagName,
      type: el.type,
      placeholder: el.placeholder,
      ariaLabel: el.getAttribute('aria-label'),
      className: el.className
    }));
  }
  
  // Fill content - search inside iframe
  const contentSelectors = [
    '.ql-editor',
    '[contenteditable="true"]',
    '.editor-content',
    '.bili-editor',
    'textarea'
  ];
  
  let contentArea = null;
  for (const selector of contentSelectors) {
    const el = iframeDoc.querySelector(selector);
    if (el) {
      contentArea = el;
      break;
    }
  }
  
  if (contentArea) {
    if (contentArea.tagName === 'TEXTAREA' || contentArea.tagName === 'INPUT') {
      contentArea.value = '《勇敢的心》是一部震撼人心的作品，讲述了...';
    } else {
      contentArea.innerHTML = '<p>《勇敢的心》是一部震撼人心的作品，讲述了...</p>';
    }
    contentArea.dispatchEvent(new InputEvent('input', { bubbles: true }));
    result.contentFilled = true;
  } else {
    result.contentError = 'Content area not found in iframe';
  }
  
  return JSON.stringify(result, null, 2);
})();
