// Log all button texts in iframe
(function() {
  const result = {
    iframeFound: false,
    buttons: []
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
    result.error = 'iframe not found';
    return JSON.stringify(result, null, 2);
  }
  
  const iframeDoc = targetIframe.contentDocument || targetIframe.contentWindow.document;
  if (!iframeDoc) {
    result.error = 'cannot access iframe';
    return JSON.stringify(result, null, 2);
  }
  
  // Log all buttons
  const buttons = iframeDoc.querySelectorAll('button');
  result.buttonCount = buttons.length;
  buttons.forEach((btn, i) => {
    result.buttons.push({
      index: i,
      text: btn.textContent.trim(),
      innerText: btn.innerText.trim(),
      className: btn.className
    });
  });
  
  return JSON.stringify(result, null, 2);
})();
