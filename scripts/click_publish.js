// Click the publish button
(function() {
  // Find the publish button
  const buttons = document.querySelectorAll('button');
  let publishButton = null;
  
  for (const btn of buttons) {
    if (btn.textContent.includes('发布') && !btn.textContent.includes('设置')) {
      publishButton = btn;
      break;
    }
  }
  
  if (publishButton) {
    publishButton.click();
    return 'Publish button clicked';
  } else {
    return 'Publish button not found';
  }
})();
