// Check DOM and return info
(function() {
  const info = {
    url: window.location.href,
    title: document.title,
    titleInput: null,
    editableCount: 0,
    editableElements: [],
    iframeCount: 0,
    iframes: [],
    textboxCount: 0,
    textboxes: []
  };
  
  // Check title input
  const titleInput = document.querySelector('input[placeholder*="标题"]');
  if (titleInput) {
    info.titleInput = {
      found: true,
      placeholder: titleInput.placeholder,
      value: titleInput.value
    };
  }
  
  // Check contenteditable elements
  const editableElements = document.querySelectorAll('[contenteditable="true"]');
  info.editableCount = editableElements.length;
  editableElements.forEach((el, i) => {
    info.editableElements.push({
      index: i,
      className: el.className,
      tagName: el.tagName,
      textPreview: el.innerText.substring(0, 50)
    });
  });
  
  // Check iframes
  const iframes = document.querySelectorAll('iframe');
  info.iframeCount = iframes.length;
  iframes.forEach((iframe, i) => {
    info.iframes.push({
      index: i,
      className: iframe.className,
      src: iframe.src
    });
  });
  
  // Check textboxes
  const textboxes = document.querySelectorAll('textarea, input[type="text"]');
  info.textboxCount = textboxes.length;
  textboxes.forEach((el, i) => {
    info.textboxes.push({
      index: i,
      className: el.className,
      placeholder: el.placeholder || el.name
    });
  });
  
  return JSON.stringify(info, null, 2);
})();
