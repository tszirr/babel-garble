
function processCurrentTab(callback) {
  var queryInfo = {
    active: true,
    currentWindow: true
  };
  chrome.tabs.query(queryInfo, function(tabs) {
    var tab = tabs[0];
    console.assert(typeof tab.url == 'string', 'tab.url should be a string. Permission error?');
    callback(tab);
  });
}

function renderStatus(statusText) {
  console.log(statusText);
  document.getElementById('status').textContent = statusText;
}

function glosbeRequest(fromto, word, callback, errorCallback) {
  var searchUrl = 'https://glosbe.com/gapi/translate' +
    '?phrase=' + encodeURIComponent(word) +
    '&dest=' + fromto[1] +
    '&from=' + fromto[0] +
    '&format=json';
  var x = new XMLHttpRequest();
  x.open('GET', searchUrl);
  x.responseType = 'json';
  x.onload = function() {
//    renderStatus(JSON.stringify(x.response))
    var response = x.response;
    if (!response || response['result'] !== 'ok') {
      errorCallback('No response: ' + searchUrl, word);
      return;
    }
    var translations = response['tuc'];
    if (!Array.isArray(translations)) {
      errorCallback('Wrong data format: ' + searchUrl, word);
      return;
    }
    var translation = null;
    for (var i = 0; i < translations.length; ++i) {
      var p = translations[i]['phrase'];
      if (p && p['language'] == fromto[1]) {
        var translation = p['text'];
        callback(translation, word);
        return;
      }
    }
  };
  x.onerror = function() {
    errorCallback('Network error: ' + searchUrl, word);
  };
  x.send();
}

var wordsfromto = null;
var words = {};
var wordstoragekey;
function translateWord(word, cb) {
  glosbeRequest(wordsfromto, word, cb, renderStatus);
// cb(word + ':' + Object.keys(words).length);
}
function runTranslation(word) {
  var entry = words[word];
  if (!entry)
    translateWord(word, function(translation) {
      entry = translation;
      words[word] = entry;
      renderStatus(JSON.stringify(entry));
    });
}
function lookupWord(word) {
  var entry = words[word];
  if (!entry) {
    console.log(word + ' unkown!');
    return '?' + word + '?';
  }
  return entry;
}

function loadWords(lang, cb) {
  wordsfromto = lang;
  wordstoragekey = wordsfromto[0] + wordsfromto[1] + '-words';
  chrome.storage.local.get(wordstoragekey, function(items) {
    if (items && items[wordstoragekey]) {
      try {
        words = JSON.parse(items[wordstoragekey]);
        if (typeof words !== 'object')
          words = {}
      }
      catch (e) {
        alert(e);
      }
      renderStatus('Loaded words: ' + wordstoragekey + ' (' + Object.keys(words).length + ')');
      renderStatus(JSON.stringify(words))
    }
    else
      renderStatus('No words loaded: ' + wordstoragekey);
    cb();
  });
}
function storeWords() {
  console.assert(wordstoragekey, 'Storage requires storage key!');
  if (!wordstoragekey) return;
  var mem = {};
  mem[wordstoragekey] = JSON.stringify(words);
  chrome.storage.local.set(mem, function() {
    renderStatus('Stored words: ' + wordstoragekey);
  });
}

function forWords(text, cb) {
  var word = '';
  var finalizeWord = function() {
    if (word) {
      cb(word);
      word = '';
    }
  };

  var charPattern = new RegExp('\\w', 'u');
  for (var j = 0; j < text.length; ++j) {
    var c = text.charAt(j);
    if (charPattern.test(c)) {
      word += c;
    }
    else 
      finalizeWord();
  }
  finalizeWord();
}

function translateText(tab, text) {
  renderStatus('Performing analysis of ' + tab.url);

  var knownWords = words;
  var unknownWords = {};
  for (var i = 0; i < text.length; ++i) {
    forWords(text[i].text, function(word) {
      if (!knownWords[word])
        unknownWords[word] = 1;
    });
  }
  unknownWords = Object.keys(unknownWords);

  var timerRun = 0;
  var translateTimer = window.setInterval(function() {
    if (timerRun < unknownWords.length) {
      runTranslation(unknownWords[timerRun++]);
    }
    else if (timerRun == unknownWords.length) {
      ++timerRun;
      window.clearInterval(translateTimer);
      for (var i = 0; i < text.length; ++i) {
        var output = '';
        forWords(text[i].text, function(word) {
          var trans = lookupWord(word);
          output += '<span class="bggbs">';
          output += word + ' <br><a>(' + trans + ')';
          output += '</a></span>';
        });
        text[i].aug = output;
      }

      if (unknownWords.length)
        storeWords();

      renderStatus('Augmenting ' + tab.url);

      chrome.tabs.sendMessage(tab.id, {babelgarble: 'replace-selected-text', ranges: text}, function(result) {
        if (result && result.num !== undefined)
          renderStatus('Augmented ' + result.num + ' elements: ' + tab.url);
        else
          renderStatus('Could not augment selected text: ' + chrome.runtime.lastEror);
      });
    }
  }, 500);
}

function detectLanguage(tab, text) {
  loadWords(['es', 'en'], function() {
    translateText(tab, text);
  })
}

function tabHooked(tab) {
    renderStatus('Retrieving content of ' + tab.url);
    
    chrome.tabs.sendMessage(tab.id, {babelgarble: 'get-selected-text'}, function(result) {
      if (result && result.ranges)
        detectLanguage(tab, result.ranges);
      else
        renderStatus('Could not retrieve selected text: ' + chrome.runtime.lastEror);
      });
}

function popupLaunched(tab) {
    renderStatus('Hooking into ' + tab.url);
    chrome.tabs.insertCSS(tab.id, { file: 'content.css' });
    chrome.tabs.executeScript(tab.id, {
      file: 'content.js' },
      function () { tabHooked(tab); } 
    );
}
document.addEventListener('DOMContentLoaded', function() {
  processCurrentTab(popupLaunched);
});
