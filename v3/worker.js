// the headers that need to be recorded
const HEADERS = ['content-length', 'accept-ranges', 'content-type', 'content-disposition'];
// do not allow downloading from these resources
const BLOCKED_LIST = ['.globo.com', '.gstatic.com', '.playm4u', '.youtube.com'];
// supported types
const TYPES = [
  'flv', 'avi', 'wmv', 'mov', 'mp4', 'webm', 'mkv', // video
  'pcm', 'wav', 'mp3', 'aac', 'ogg', 'wma', // audio
  'm3u8' // stream
];
TYPES.extra = [
  'zip', 'rar', '7z', 'tar.gz',
  'img', 'iso', 'bin',
  'exe', 'dmg', 'deb'
];
TYPES.sub = ['vtt', 'webvtt', 'srt'];

self.importScripts('context.js');

/* extra objects */
const extra = {};

const open = async (tab, extra = []) => {
  const win = await chrome.windows.getCurrent();

  chrome.storage.local.get({
    width: 800,
    height: 500, // for Windows we need this
    left: win.left + Math.round((win.width - 800) / 2),
    top: win.top + Math.round((win.height - 500) / 2)
  }, prefs => {
    const args = new URLSearchParams();
    args.set('tabId', tab.id);
    args.set('title', tab.title || '');
    args.set('href', tab.url || '');
    for (const {key, value} of extra) {
      args.set(key, value);
    }

    chrome.windows.create({
      url: 'data/job/index.html?' + args.toString(),
      width: prefs.width,
      height: prefs.height,
      left: prefs.left,
      top: prefs.top,
      type: 'popup'
    });
  });
};
chrome.action.onClicked.addListener(tab => open(tab));
chrome.action.setBadgeBackgroundColor({
  color: '#666666'
});

const badge = (n, tabId) => {
  if (n) {
    chrome.action.setIcon({
      tabId: tabId,
      path: {
        '16': 'data/icons/active/16.png',
        '32': 'data/icons/active/32.png',
        '48': 'data/icons/active/48.png'
      }
    });

    chrome.action.setBadgeText({
      tabId: tabId,
      text: new Intl.NumberFormat('en-US', {
        notation: 'compact',
        maximumFractionDigits: 1
      }).format(n)
    });
  }
  else {
    chrome.action.setIcon({
      tabId: tabId,
      path: {
        '16': 'data/icons/16.png',
        '32': 'data/icons/32.png',
        '48': 'data/icons/48.png'
      }
    });
    chrome.action.setBadgeText({
      tabId: tabId,
      text: ''
    });
  }
};

const observe = d => {
  // hard-coded exception list
  if (BLOCKED_LIST.some(s => d.url.includes(s) && d.url.split(s)[0].split('/').length === 3)) {
    return console.warn('This request is not being processed');
  }

  // unsupported content types
  if (d.responseHeaders.some(({name, value}) => {
    return name === 'content-type' && value && value.startsWith('text/html');
  })) {
    return;
  }

  chrome.storage.session.get({
    [d.tabId]: []
  }, prefs => {
    const hrefs = prefs[d.tabId].map(o => o.url);

    if (hrefs.includes(d.url) === false) {
      prefs[d.tabId].push({
        url: d.url,
        initiator: d.initiator,
        timeStamp: d.timeStamp,
        responseHeaders: d.responseHeaders.filter(o => HEADERS.indexOf(o.name.toLowerCase()) !== -1)
      });
      prefs[d.tabId] = prefs[d.tabId].slice(-200);
      chrome.storage.session.set(prefs);
      badge(prefs[d.tabId].length, d.tabId);
    }
  });
};
observe.mime = d => {
  for (const {name, value} of d.responseHeaders) {
    if (name === 'content-type' && value && (
      value.startsWith('video/') || value.startsWith('audio/')
    )) {
      return observe(d);
    }
  }
};

/* clear old list on remove */
chrome.tabs.onRemoved.addListener(tabId => {
  // remove jobs
  chrome.storage.session.remove(tabId + '');
  // clear rules
  chrome.declarativeNetRequest.updateSessionRules({
    removeRuleIds: [tabId]
  });
});

/* clear old list on reload */
chrome.tabs.onUpdated.addListener((tabId, info) => {
  if (info.status === 'loading') {
    chrome.storage.session.remove(tabId + '');
    badge(0, tabId);
  }
});
// find media
chrome.webRequest.onHeadersReceived.addListener(d => observe(d), {
  urls: ['*://*/*'],
  types: ['media']
}, ['responseHeaders']);
chrome.webRequest.onHeadersReceived.addListener(d => observe(d), {
  urls: TYPES.map(s => '*://*/*.' + s + '*'),
  types: ['xmlhttprequest']
}, ['responseHeaders']);
console.log(1111);

// https://iandevlin.com/html5/webvtt-example.html
// https://developer.mozilla.org/en-US/docs/Web/HTML/Element/track
// https://demos.jwplayer.com/closed-captions/
chrome.webRequest.onHeadersReceived.addListener(d => observe(d), {
  urls: TYPES.sub.map(s => '*://*/*.' + s + '*'),
  types: ['xmlhttprequest', 'other']
}, ['responseHeaders']);
// watch for video and audio mime-types
{
  const run = () => chrome.storage.local.get({
    'mime-watch': false
  }, prefs => {
    if (prefs['mime-watch']) {
      chrome.webRequest.onHeadersReceived.addListener(observe.mime, {
        urls: ['*://*/*'],
        types: ['xmlhttprequest']
      }, ['responseHeaders']);
    }
    else {
      chrome.webRequest.onHeadersReceived.removeListener(observe.mime);
    }
  });
  run();
  chrome.storage.onChanged.addListener(ps => ps['mime-watch'] && run());
}

chrome.runtime.onMessage.addListener((request, sender, response) => {
  if (request.method === 'get-jobs') {
    chrome.storage.session.get({
      [request.tabId]: []
    }, prefs => {
      response(prefs[request.tabId]);
    });

    return true;
  }
  else if (request.method === 'release-awake-if-possible') {
    if (chrome.power) {
      chrome.runtime.sendMessage({
        method: 'any-active'
      }, r => {
        chrome.runtime.lastError;
        if (r !== true) {
          chrome.power.releaseKeepAwake();
        }
      });
    }
  }
  else if (request.method === 'get-extra') {
    response(extra[request.tabId] || []);
    delete extra[request.tabId];
  }
});

/* delete all leftover cache requests */
{
  const once = async () => {
    for (const key of await caches.keys()) {
      await caches.delete(key);
    }
  };

  chrome.runtime.onInstalled.addListener(once);
  chrome.runtime.onStartup.addListener(once);
}

/* delete all old indexedDB databases left from "v2" version */
{
  const once = () => indexedDB.databases().then(dbs => {
    for (const db of dbs) {
      indexedDB.deleteDatabase(db.Name);
    }
  });
  if (indexedDB.databases) {
    chrome.runtime.onInstalled.addListener(once);
    chrome.runtime.onStartup.addListener(once);
  }
}

/* FAQs & Feedback */
{
  const {management, runtime: {onInstalled, setUninstallURL, getManifest}, storage, tabs} = chrome;
  if (navigator.webdriver !== true) {
    const page = getManifest().homepage_url;
    const {name, version} = getManifest();
    onInstalled.addListener(({reason, previousVersion}) => {
      management.getSelf(({installType}) => installType === 'normal' && storage.local.get({
        'faqs': true,
        'last-update': 0
      }, prefs => {
        if (reason === 'install' || (prefs.faqs && reason === 'update')) {
          const doUpdate = (Date.now() - prefs['last-update']) / 1000 / 60 / 60 / 24 > 45;
          if (doUpdate && previousVersion !== version) {
            tabs.query({active: true, currentWindow: true}, tbs => tabs.create({
              url: page + '?version=' + version + (previousVersion ? '&p=' + previousVersion : '') + '&type=' + reason,
              active: reason === 'install',
              ...(tbs && tbs.length && {index: tbs[0].index + 1})
            }));
            storage.local.set({'last-update': Date.now()});
          }
        }
      }));
    });
    setUninstallURL(page + '?rd=feedback&name=' + encodeURIComponent(name) + '&version=' + version);
  }
}
