// Find ANY element (not only <button>) containing target text across top doc + nested iframes; click it
(function (target) {
  var matches = [];
  function walkEl(el, depth, cb) {
    if (!el || !el.querySelectorAll) return;
    var all = el.querySelectorAll('*');
    for (var i = 0; i < all.length; i++) {
      cb(all[i], depth);
    }
    // also self
    cb(el, depth);
  }
  function search(doc, depth) {
    if (!doc) return;
    walkEl(doc.body || doc.documentElement || doc, depth, function (node) {
      var t = (node.innerText || node.textContent || '').trim();
      if (t === target) {
        matches.push({ depth: depth, tag: node.tagName, cls: node.className, role: node.getAttribute && node.getAttribute('role') });
      }
    });
    var frs = doc.querySelectorAll('iframe');
    for (var j = 0; j < frs.length; j++) {
      try { search(frs[j].contentDocument || frs[j].contentWindow.document, depth + 1); } catch (e) {}
    }
  }
  search(document, 0);

  // click phase: re-search and click first exact text match
  var clicked = false;
  function clickSearch(doc, depth) {
    if (clicked || !doc) return;
    try {
      var all = (doc.body || doc.documentElement || doc).querySelectorAll('*');
      for (var i = 0; i < all.length; i++) {
        var t = (all[i].innerText || all[i].textContent || '').trim();
        if (t === target) {
          all[i].dispatchEvent(new MouseEvent('mousedown', { bubbles: true }));
          all[i].dispatchEvent(new MouseEvent('mouseup', { bubbles: true }));
          all[i].dispatchEvent(new MouseEvent('click', { bubbles: true }));
          clicked = true;
          return;
        }
      }
    } catch (e) {}
    var frs = doc.querySelectorAll('iframe');
    for (var j = 0; j < frs.length; j++) {
      if (clicked) return;
      try { clickSearch(frs[j].contentDocument || frs[j].contentWindow.document, depth + 1); } catch (e) {}
    }
  }
  clickSearch(document, 0);

  return JSON.stringify({ matches: matches, clicked: clicked });
}).call(null, '取消');
