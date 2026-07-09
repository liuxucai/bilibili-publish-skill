// Click the "确定" (Confirm) button in the dialog
(function() {
  const result = {
    success: false,
    linksFound: 0,
    linkTexts: []
  };
  
  // Find all links in the page
  const links = document.querySelectorAll('a, link');
  result.linksFound = links.length;
  
  for (const link of links) {
    const text = link.textContent.trim();
    result.linkTexts.push(text);
    
    if (text === '确定' || text === '确认') {
      link.click();
      result.success = true;
      result.clickedText = text;
      break;
    }
  }
  
  // Also check buttons
  const buttons = document.querySelectorAll('button');
  for (const btn of buttons) {
    const text = btn.textContent.trim();
    if (text === '确定' || text === '确认') {
      btn.click();
      result.success = true;
      result.clickedText = text;
      result.clickedElement = 'button';
      break;
    }
  }
  
  return JSON.stringify(result, null, 2);
})();
