// Fill B站 article form
(function() {
  // Fill title
  const titleInput = document.querySelector('input[placeholder*="标题"]');
  if (titleInput) {
    titleInput.value = '勇敢的心';
    titleInput.dispatchEvent(new Event('input', { bubbles: true }));
    console.log('Title filled');
  } else {
    console.log('Title input not found');
  }
  
  // Fill content - need to find the contenteditable div
  // B站 might use a rich text editor
  const contentArea = document.querySelector('.ql-editor, [contenteditable="true"]');
  if (contentArea) {
    contentArea.innerHTML = '<p>《勇敢的心》是一部震撼人心的作品，讲述了...</p>';
    contentArea.dispatchEvent(new InputEvent('input', { bubbles: true }));
    console.log('Content filled');
  } else {
    console.log('Content area not found');
  }
  
  return 'Form filled';
})();
