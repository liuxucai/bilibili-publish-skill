// Click "保存为草稿" inside read-editor iframe
(function () {
  var iframes = document.querySelectorAll('iframe');
  var target = null;
  for (var i = 0; i < iframes.length; i++) {
    if (iframes[i].src && iframes[i].src.indexOf('read-editor') !== -1) { target = iframes[i]; break; }
  }
  if (!target) return JSON.stringify({ error: 'NO_IFRAME' });
  var doc = target.contentDocument || target.contentWindow.document;
  if (!doc) return JSON.stringify({ error: 'IFRAME_DOC_NULL' });
  var btns = doc.querySelectorAll('button');
  for (var j = 0; j < btns.length; j++) {
    if (btns[j].innerText && btns[j].innerText.trim() === '保存为草稿') {
      btns[j].dispatchEvent(new MouseEvent('mousedown', { bubbles: true }));
      btns[j].dispatchEvent(new MouseEvent('mouseup', { bubbles: true }));
      btns[j].dispatchEvent(new MouseEvent('click', { bubbles: true }));
      return JSON.stringify({ ok: true });
    }
  }
  return JSON.stringify({ error: 'NO_DRAFT_BTN' });
})();
