// Check DOM structure of B站 publish page
(function() {
  console.log('=== Page info ===');
  console.log('URL:', window.location.href);
  console.log('Title:', document.title);
  
  console.log('\n=== Title input ===');
  const titleInput = document.querySelector('input[placeholder*="标题"]');
  if (titleInput) {
    console.log('Found title input:', titleInput.placeholder);
    console.log('Current value:', titleInput.value);
  } else {
    console.log('Title input not found');
  }
  
  console.log('\n=== Content editable elements ===');
  const editableElements = document.querySelectorAll('[contenteditable="true"]');
  console.log('Count:', editableElements.length);
  editableElements.forEach((el, i) => {
    console.log(`Editable ${i}:`, el.className, el.tagName, el.innerText.substring(0, 50));
  });
  
  console.log('\n=== Iframes ===');
  const iframes = document.querySelectorAll('iframe');
  console.log('Count:', iframes.length);
  iframes.forEach((iframe, i) => {
    console.log(`Iframe ${i}:`, iframe.className, iframe.src);
  });
  
  console.log('\n=== Textboxes ===');
  const textboxes = document.querySelectorAll('textarea, input[type="text"]');
  console.log('Count:', textboxes.length);
  textboxes.forEach((el, i) => {
    console.log(`Textbox ${i}:`, el.className, el.placeholder || el.name);
  });
  
  return 'DOM checked';
})();
