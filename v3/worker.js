/* extra objects */
const extra = {};

const open = async (tab, extra = []) => {
  const win = await browser.windows.getCurrent();

  browser.storage.local.get({
    width: 800,
    height: 500 // for Windows we need this
  }, prefs => {
    const left = win.left + Math.round((win.width - 800) / 2);
    const top = win.top + Math.round((win.height - 500) / 2);

    const args = new URLSearchParams();
    args.set('tabId', tab.id);
    args.set('title', tab.title || '');
    args.set('href', tab.url || '');
    for (const {key, value} of extra) {
      args.set(key, value);
    }

    browser.windows.create({
      url: '/data/job/index.html?' + args.toString(),
      width: prefs.width,
      height: prefs.height,
      left,
      top,
      type: 'popup'
    });
  });
};
browser.browserAction.onClicked.addListener(tab => open(tab));
browser.browserAction.setBadgeBackgroundColor({
  color: '#666666'
});

const badge = (n, tabId) => {
  if (n) {
    browser.browserAction.setIcon({
      tabId: tabId,
      path: {
        '16': "/data/icons/active/download.svg",
        '32': "/data/icons/active/download.svg",
        '48': "/data/icons/active/download.svg"
      }
    });

    browser.browserAction.setBadgeText({
      tabId: tabId,
      text: new Intl.NumberFormat('en-US', {
        notation: 'compact',
        maximumFractionDigits: 1
      }).format(n)
    });
  }
  else {
    browser.browserAction.setIcon({
      tabId: tabId,
      path: {
        '16': "/data/icons/download_off.svg",
        '32': "/data/icons/download_off.svg",
        '48': "/data/icons/download_off.svg"
      }
    });
    browser.browserAction.setBadgeText({
      tabId: tabId,
      text: ''
    });
  }
};

const observe = d => {
  // hard-coded excludes
  if (d.initiator && d.initiator.startsWith('https://www.youtube.com')) {
    return;
  }

  // unsupported content types
  if (d.url.includes('.m3u8') === false && d.responseHeaders.some(({name, value}) => {
    return name === 'content-type' && value && value.startsWith('text/html');
  })) {
    return;
  }

  browser.scripting.executeScript({
    target: {
      tabId: d.tabId
    },
    func: (size, v) => {
      self.storage = self.storage || new Map();
      self.storage.set(v.url, v);
      if (self.storage.size > size) {
        for (const [href] of self.storage) {
          // do not delete important links
          if (href.includes('.m3u8')) {
            continue;
          }
          self.storage.delete(href);
          if (self.storage.size <= size) {
            break;
          }
        }
      }

      return self.storage.size;
    },
    args: [200, {
      url: d.url,
      initiator: d.initiator,
      timeStamp: d.timeStamp,
      responseHeaders: d.responseHeaders.filter(o => network.HEADERS.includes(o.name.toLowerCase()))
    }]
  }).then(c => badge(c[0].result, d.tabId)).catch(() => {});
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
browser.tabs.onRemoved.addListener(tabId => {
  // clear rules
  browser.declarativeNetRequest.updateSessionRules({
    removeRuleIds: [tabId]
  });
});

/* clear old list on reload */
// browser.tabs.onUpdated.addListener((tabId, info) => {
//   if (info.status === 'loading') {
//     badge(0, tabId);
//   }
// });

// media
browser.webRequest.onHeadersReceived.addListener(observe, {
  urls: ['*://*/*'],
  types: ['media']
}, ['responseHeaders']);

// media types
network.types({
  core: true
}).then(types => {
  const cloned = navigator.userAgent.includes('Firefox') ? d => observe(d) : observe;

  browser.webRequest.onHeadersReceived.addListener(cloned, {
    urls: types.map(s => '*://*/*.' + s + '*'),
    types: ['xmlhttprequest']
  }, ['responseHeaders']);
});

// https://iandevlin.com/html5/webvtt-example.html
// https://developer.mozilla.org/en-US/docs/Web/HTML/Element/track
// https://demos.jwplayer.com/closed-captions/
network.types({
  core: false,
  sub: true
}).then(types => {
  const cloned = navigator.userAgent.includes('Firefox') ? d => observe(d) : observe;

  browser.webRequest.onHeadersReceived.addListener(cloned, {
    urls: types.map(s => '*://*/*.' + s + '*'),
    types: ['xmlhttprequest', 'other']
  }, ['responseHeaders']);
});

// watch for video and audio mime-types
{
  const run = () => browser.storage.local.get({
    'mime-watch': false
  }, prefs => {
    if (prefs['mime-watch']) {
      browser.webRequest.onHeadersReceived.addListener(observe.mime, {
        urls: ['*://*/*'],
        types: ['xmlhttprequest']
      }, ['responseHeaders']);
    }
    else {
      browser.webRequest.onHeadersReceived.removeListener(observe.mime);
    }
  });
  run();
  browser.storage.onChanged.addListener(ps => ps['mime-watch'] && run());
}

browser.runtime.onMessage.addListener((request, sender, response) => {
  if (request.method === 'release-awake-if-possible') {
    if (browser.power) {
      browser.runtime.sendMessage({
        method: 'any-active'
      }, r => {
        browser.runtime.lastError;
        if (r !== true) {
          browser.power.releaseKeepAwake();
        }
      });
    }
  }
  else if (request.method === 'get-extra') {
    response(extra[request.tabId] || []);
    delete extra[request.tabId];
  }
  else if (request.method === 'media-detected') {
    observe({
      ...request.d,
      timeStamp: Date.now(),
      tabId: sender.tab.id,
      initiator: sender.url
    });
  }
});

/* delete all leftover cache requests */
{
  const once = async () => {
    for (const key of await caches.keys()) {
      if (key !== network.NAME) {
        caches.delete(key);
      }
    }
  };
  browser.runtime.onStartup.addListener(once);
}

/* delete all old indexedDB databases left from "v2" version */
{
  const once = () => indexedDB.databases().then(dbs => {
    for (const db of dbs) {
      indexedDB.deleteDatabase(db.Name);
    }
  });
  if (indexedDB.databases) {
    browser.runtime.onInstalled.addListener(once);
    browser.runtime.onStartup.addListener(once);
  }
}

/* FAQs & Feedback */
{
  const {management, runtime: {onInstalled, setUninstallURL, getManifest}, storage, tabs} = browser;
  if (navigator.webdriver !== true) {
    const page = "https://github.com/helloyanis/file-downloader-unleashed/blob/master/v3/installed.md";
    onInstalled.addListener(({reason, previousVersion}) => {
      if (reason === 'install') {
        tabs.create({
          url: page
        });
      }
    });
    setUninstallURL("https://github.com/helloyanis/file-downloader-unleashed/blob/master/v3/uninstalled.md");
  }
}
