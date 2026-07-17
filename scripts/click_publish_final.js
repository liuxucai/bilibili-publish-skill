// Click the publish button (index 4) in iframe
(function() {
  const result = {
    success: false,
    error: null
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
    result.error = 'iframe not found';
    return JSON.stringify(result, null, 2);
  }
  
  const iframeDoc = targetIframe.contentDocument || targetIframe.contentWindow.document;
  if (!iframeDoc) {
    result.error = 'cannot access iframe';
    return JSON.stringify(result, null, 2);
  }
  
  // Get all buttons and click index 4 (the "发布" button)
  const buttons = iframeDoc.querySelectorAll('button');
  if (buttons.length >= 5) {
    const publishButton = buttons[4]; // index 4
    publishButton.click();
    result.success = true;
    result.buttonText = publishButton.textContent.trim();
    result.buttonClassName = publishButton.className;
  } else {
    result.error = `Not enough buttons (found ${buttons.length}, need at least 5)`;
  }
  
  return JSON.stringify(result, null, 2);
})();
