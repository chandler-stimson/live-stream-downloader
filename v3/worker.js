chrome.action.onClicked.addListener(async tab => {
  const win = await chrome.windows.getCurrent();

  chrome.storage.local.get({
    width: 800,
    height: 300,
    left: win.left + Math.round((win.width - 800) / 2),
    top: win.top + Math.round((win.height - 300) / 2)
  }, prefs => {
    chrome.windows.create({
      url: 'data/job/index.html?tabId=' + tab.id +
        '&title=' + encodeURIComponent(tab.title) +
        '&href=' + encodeURIComponent(tab.url),
      width: prefs.width,
      height: prefs.height,
      left: prefs.left,
      top: prefs.top,
      type: 'popup'
    });
  });
});

const observe = d => chrome.storage.session.get({
  [d.tabId]: []
}, prefs => {
  if (prefs[d.tabId].indexOf(d.url) === -1) {
    const hrefs = prefs[d.tabId].map(o => o.url);

    if (hrefs.indexOf(d.url) === -1) {
      prefs[d.tabId].push({
        url: d.url,
        initiator: d.initiator,
        responseHeaders: d.responseHeaders
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
chrome.tabs.onRemoved.addListener(tabId => {
  // remove jobs
  chrome.storage.session.remove(tabId + '');
  // clear rules
  chrome.declarativeNetRequest.getSessionRules().then(rules => {
    const ids = rules.filter(r => r.condition.tabIds.indexOf(tabId) !== -1).map(r => r.id);

    if (ids.length) {
      chrome.declarativeNetRequest.updateSessionRules({
        removeRuleIds: ids
      });
    }
  });
});

// clear old list
chrome.webRequest.onBeforeRequest.addListener(d => chrome.storage.session.remove(d.tabId + ''), {
  urls: ['*://*/*'],
  types: ['main_frame']
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
