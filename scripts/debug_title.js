// Debug: find all elements related to "标题"
(function() {
  const result = {
    allElementsWithTitle: [],
    titleInput: null
  };
  
  // Find all elements with "标题" in any attribute
  const allElements = document.querySelectorAll('*');
  allElements.forEach(el => {
    const attrs = el.attributes;
    for (let i = 0; i < attrs.length; i++) {
      const attr = attrs[i];
      if (attr.value && attr.value.includes('标题')) {
        result.allElementsWithTitle.push({
          tag: el.tagName,
          attr: attr.name,
          value: attr.value,
          className: el.className,
          id: el.id
        });
      }
    }
  });
  
  // Also try to find the title input by role
  const textboxes = document.querySelectorAll('[role="textbox"]');
  result.textboxes = Array.from(textboxes).map(el => ({
    tag: el.tagName,
    ariaLabel: el.getAttribute('aria-label'),
    placeholder: el.placeholder,
    className: el.className,
    id: el.id,
    textContent: el.textContent.substring(0, 30)
  }));
  
  // Try to find by placeholder exactly
  const byPlaceholder = document.querySelectorAll('[placeholder]');
  result.byPlaceholder = Array.from(byPlaceholder).map(el => ({
    tag: el.tagName,
    placeholder: el.placeholder,
    className: el.className
  }));
  
  return JSON.stringify(result, null, 2);
})();
