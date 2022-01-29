// the headers that need to be recorded
const HEADERS = ['content-length', 'accept-ranges', 'content-type', 'content-disposition'];
// do not allow downloading from these resources
const BLOCKED_LIST = ['.globo.com', '.gstatic.com'];

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
    args.set('title', tab.title || 'This Page');
    args.set('href', tab.url);
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

chrome.action.onClicked.addListener(async tab => {
  open(tab);
});

const observe = d => {
  // hard-coded exception list
  if (BLOCKED_LIST.some(s => d.url.indexOf(s) !== -1)) {
    return console.warn('This request is not being processed');
  }

  chrome.storage.session.get({
    [d.tabId]: []
  }, prefs => {
    if (prefs[d.tabId].indexOf(d.url) === -1) {
      const hrefs = prefs[d.tabId].map(o => o.url);

      if (hrefs.indexOf(d.url) === -1) {
        prefs[d.tabId].push({
          url: d.url,
          initiator: d.initiator,
          responseHeaders: d.responseHeaders.filter(o => HEADERS.indexOf(o.name.toLowerCase()) !== -1)
        });

        chrome.storage.session.set(prefs);

        chrome.action.setIcon({
          tabId: d.tabId,
          path: {
            '16': 'data/icons/active/16.png',
            '32': 'data/icons/active/32.png',
            '48': 'data/icons/active/48.png'
          }
        });
        chrome.action.setBadgeText({
          tabId: d.tabId,
          text: prefs[d.tabId].length + ''
        });
      }
    }
  });
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
  }
});
// find media
chrome.webRequest.onHeadersReceived.addListener(observe, {
  urls: ['*://*/*'],
  types: ['media']
}, ['responseHeaders']);
chrome.webRequest.onHeadersReceived.addListener(observe, {
  urls: [
    '*://*/*.flv*', '*://*/*.avi*', '*://*/*.wmv*', '*://*/*.mov*', '*://*/*.mp4*',
    '*://*/*.pcm*', '*://*/*.wav*', '*://*/*.mp3*', '*://*/*.aac*', '*://*/*.ogg*', '*://*/*.wma*',
    '*://*/*.m3u8*'
  ],
  types: ['xmlhttprequest']
}, ['responseHeaders']);

/* context menu */
{
  const once = () => {
    chrome.contextMenus.create({
      title: 'Download with Live Stream Downloader',
      id: 'download-link',
      contexts: ['link'],
      targetUrlPatterns: [
        '*://*/*.flv*', '*://*/*.avi*', '*://*/*.wmv*', '*://*/*.mov*', '*://*/*.mp4*', '*://*/*.pcm*',
        '*://*/*.wav*', '*://*/*.mp3*', '*://*/*.aac*', '*://*/*.ogg*', '*://*/*.wma*', '*://*/*.m3u8*'
      ]
    });
    chrome.contextMenus.create({
      title: 'Download with Live Stream Downloader',
      id: 'download-media',
      contexts: ['audio', 'video']
    });
    chrome.contextMenus.create({
      title: 'Clear Detected Media List',
      id: 'clear',
      contexts: ['action', 'browser_action'],
      targetUrlPatterns: ['*://*/*']
    });
    chrome.contextMenus.create({
      title: 'Test Video Downloading',
      id: 'test',
      contexts: ['action', 'browser_action'],
      targetUrlPatterns: ['*://*/*']
    });
  };
  chrome.runtime.onInstalled.addListener(once);
  chrome.runtime.onStartup.addListener(once);
}
chrome.contextMenus.onClicked.addListener((info, tab) => {
  if (info.menuItemId === 'test') {
    chrome.tabs.create({
      url: 'https://webbrowsertools.com/test-download-with/'
    });
  }
  else if (info.menuItemId === 'clear') {
    chrome.storage.session.remove(tab.id + '');
    chrome.action.setIcon({
      tabId: tab.id,
      path: {
        '16': 'data/icons/16.png',
        '32': 'data/icons/32.png',
        '48': 'data/icons/48.png'
      }
    });
    chrome.action.setBadgeText({
      tabId: tab.id,
      text: ''
    });
  }
  else if (info.menuItemId === 'download-link') {
    open(tab, [{
      key: 'append',
      value: info.linkUrl
    }]);
  }
  else if (info.menuItemId === 'download-media') {
    open(tab, [{
      key: 'append',
      value: info.srcUrl
    }]);
  }
});

chrome.runtime.onMessage.addListener((request, sender, response) => {
  if (request.method === 'get-jobs') {
    chrome.storage.session.get({
      [request.tabId]: []
    }, prefs => {
      response(prefs[request.tabId]);
    });

    return true;
  }
});

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
