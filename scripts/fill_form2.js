// Fill B站 article form - corrected version
(function() {
  const result = {
    titleFilled: false,
    contentFilled: false,
    titleError: null,
    contentError: null
  };
  
  // Fill title - try multiple selectors
  const titleSelectors = [
    'input[placeholder*="标题"]',
    'textarea[placeholder*="标题"]',
    '[aria-label*="标题"]',
    'input[type="text"]',
    '.title-input input',
    '[role="textbox"][aria-label*="标题"]'
  ];
  
  let titleInput = null;
  for (const selector of titleSelectors) {
    const el = document.querySelector(selector);
    if (el) {
      titleInput = el;
      console.log('Found title input with selector:', selector);
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
    result.titleError = 'Title input not found with any selector';
    // Log all text inputs for debugging
    const allInputs = document.querySelectorAll('input, textarea, [role="textbox"]');
    result.availableInputs = Array.from(allInputs).map(el => ({
      tag: el.tagName,
      type: el.type,
      placeholder: el.placeholder,
      ariaLabel: el.getAttribute('aria-label'),
      className: el.className
    }));
  }
  
  // Fill content - need to access iframe
  const iframes = document.querySelectorAll('iframe');
  let contentIframe = null;
  
  // Find the read-editor iframe
  for (const iframe of iframes) {
    if (iframe.src && iframe.src.includes('read-editor')) {
      contentIframe = iframe;
      break;
    }
  }
  
  if (contentIframe && contentIframe.contentDocument) {
    const iframeDoc = contentIframe.contentDocument;
    const contentArea = iframeDoc.querySelector('.ql-editor, [contenteditable="true"], .editor-content');
    
    if (contentArea) {
      contentArea.innerHTML = '<p>《勇敢的心》是一部震撼人心的作品，讲述了...</p>';
      contentArea.dispatchEvent(new InputEvent('input', { bubbles: true }));
      result.contentFilled = true;
    } else {
      result.contentError = 'Content area not found in iframe';
    }
  } else {
    result.contentError = 'read-editor iframe not found or not accessible (cross-origin)';
  }
  
  return JSON.stringify(result, null, 2);
})();
