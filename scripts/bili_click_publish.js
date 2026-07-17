// Click the "发布" button inside the read-editor iframe
(function() {
  var iframes = document.querySelectorAll('iframe');
  var targetIframe = null;
  for (var i = 0; i < iframes.length; i++) {
    if (iframes[i].src && iframes[i].src.indexOf('read-editor') !== -1) { targetIframe = iframes[i]; break; }
  }
  if (!targetIframe) return JSON.stringify({error:'NO_IFRAME'});
  var doc = targetIframe.contentDocument || targetIframe.contentWindow.document;
  if (!doc) return JSON.stringify({error:'IFRAME_DOC_NULL'});

  var btns = doc.querySelectorAll('button');
  var found = null;
  for (var j = 0; j < btns.length; j++) {
    if (btns[j].innerText && btns[j].innerText.trim() === '发布') { found = btns[j]; break; }
  }
  if (!found) return JSON.stringify({error:'NO_PUBLISH_BUTTON', btnCount: btns.length});

  found.dispatchEvent(new MouseEvent('mousedown', {bubbles:true}));
  found.dispatchEvent(new MouseEvent('mouseup', {bubbles:true}));
  found.dispatchEvent(new MouseEvent('click', {bubbles:true}));
  return JSON.stringify({ok:true, text: found.innerText});
})();
