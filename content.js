/*
function getSelectionText() {
    var text = "";
    if (window.getSelection) {
        text = window.getSelection().toString();
    } else if (document.selection && document.selection.type != "Control") {
        text = document.selection.createRange().text;
    }
    return text;
}

function getSelectionHtml() {
  if (typeof document.selection != 'undefined')
    return document.selection.createRange();
  else
    return window.getSelection();
}
*/

/*
function getSelectedRanges() {
  var ranges = [];
  var sel = window.getSelection();
  if (sel.rangeCount) {
    selr = sel.getRangeAt(0);
    locateTextNodes(selr.commonAncestorContainer, selr, '', function(path, node) {
      var text = node.wholeText;
      if (text.trim())
        ranges.push({ xpath: path, text: text });
    });
  }
  return ranges;
}
*/

function locateTextNodes(parent, sel, path, cb) {
  if (!sel.intersectsNode(parent))
    return;

  if (parent.nodeType === Node.TEXT_NODE) {
    cb(path, parent);
    return;
  }

  var childNodes = parent.childNodes;
  if (childNodes == null) 
    return;
  for (var i = 0; i < childNodes.length; i++) {
    var child = childNodes[i];
    var cpath = path + '/*[' + (i+1) + ']';
    locateTextNodes(child, sel, cpath, cb);
  }
}

function forSelectedRanges(cb) {
  var sel = window.getSelection();
  for (var i = 0; i < sel.rangeCount; ++i) {
    cb(sel.getRangeAt(i));
  }
}

function getSelectedRanges() {
  var ranges = [];
  forSelectedRanges(function(sel) {
    locateTextNodes(sel.commonAncestorContainer, sel, '.', function(path, node) {
      var text = node.textContent;
      // todo: selected substring
      if (text.trim())
        ranges.push({ xpath: path, text: text });
    });
  });
  return ranges;
}

function replaceText(node, find, replace) {
  var text = node.textContent;
  var i = text.indexOf(find);
  if (i >= 0) {
    var ie = i + find.length;
    if (ie < text.length) {
      node.splitText(ie);
    }
    if (i > 0) {
      node.splitText(i);
      node = node.nextSibling;
    }
    var rep = document.createElement('span');
    node.parentNode.replaceChild(rep, node);
    rep.outerHTML = replace;
  }    
}

function replaceSelectedRanges(ranges) {
  var cnt = 0;
  forSelectedRanges(function(sel) {
      console.log(ranges);
    for (var i = ranges.length - 1; i >= 0; --i) {
      var res = document.evaluate(ranges[i].xpath, sel.commonAncestorContainer,
        null, XPathResult.FIRST_ORDERED_NODE_TYPE, null);
      if (res && res.singleNodeValue) {
        replaceText(res.singleNodeValue, ranges[i].text, ranges[i].aug);
        ++cnt;
      }
    }
/*    locateTextNodes(sel.commonAncestorContainer, sel, '', function(path, node) {
      if (node.wholeText.trim()) {
        var n2 = document.createElement('span');
        n2.HTML
        node.parentNode.replaceChild(n2, node);
        n2.outerHTML = ranges[cnt].text;
        ++cnt;
      }
    });*/
  });
  return cnt;
}

chrome.runtime.onMessage.addListener(function (msg, sender, sendResponse) {
    if (msg.babelgarble === 'get-selected-text') {
        sendResponse({
          ranges: getSelectedRanges()
        });
    } else if (msg.babelgarble === 'replace-selected-text') {
        sendResponse({
          num: replaceSelectedRanges(msg.ranges)
        });
    }
});