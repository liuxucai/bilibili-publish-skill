// Click publish button - more robust version
(function() {
  const result = {
    buttonsFound: 0,
    buttonTexts: [],
    publishButtonFound: false
  };
  
  // Log all buttons
  const buttons = document.querySelectorAll('button');
  result.buttonsFound = buttons.length;
  buttons.forEach((btn, i) => {
    const text = btn.textContent.trim();
    result.buttonTexts.push({
      index: i,
      text: text,
      className: btn.className
    });
    
    // Check if this is the publish button
    if (text === '发布' || text.includes('发布') && !text.includes('设置')) {
      btn.click();
      result.publishButtonFound = true;
      result.clickedButtonIndex = i;
      result.clickedButtonText = text;
    }
  });
  
  if (!result.publishButtonFound) {
    // Try with role=button elements
    const roleButtons = document.querySelectorAll('[role="button"]');
    result.roleButtonsFound = roleButtons.length;
    roleButtons.forEach((btn, i) => {
      const text = btn.textContent.trim();
      if (text === '发布' || text.includes('发布')) {
        btn.click();
        result.publishButtonFound = true;
        result.clickedRoleButtonIndex = i;
      }
    });
  }
  
  return JSON.stringify(result, null, 2);
})();
