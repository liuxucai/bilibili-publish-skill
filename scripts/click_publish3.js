// Click publish button inside iframe
(function() {
  const result = {
    iframeFound: false,
    buttonsInMainPage: 0,
    buttonsInIframe: 0,
    publishButtonFound: false
  };
  
  // Check main page
  result.buttonsInMainPage = document.querySelectorAll('button').length;
  
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
    result.error = 'read-editor iframe not found';
    return JSON.stringify(result, null, 2);
  }
  
  const iframeDoc = targetIframe.contentDocument || targetIframe.contentWindow.document;
  if (!iframeDoc) {
    result.error = 'Cannot access iframe document';
    return JSON.stringify(result, null, 2);
  }
  
  // Find buttons in iframe
  const buttons = iframeDoc.querySelectorAll('button');
  result.buttonsInIframe = buttons.length;
  
  for (const btn of buttons) {
    const text = btn.textContent.trim();
    if (text === '发布' || (text.includes('发布') && !text.includes('设置'))) {
      btn.click();
      result.publishButtonFound = true;
      result.clickedButtonText = text;
      break;
    }
  }
  
  return JSON.stringify(result, null, 2);
})();
