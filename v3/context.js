/* global TYPES, extra */

/* context menu */
{
  const once = () => {
    chrome.contextMenus.create({
      title: 'Download with Live Stream Downloader',
      id: 'download-link',
      contexts: ['link'],
      targetUrlPatterns: [
        ...TYPES,
        ...TYPES.extra
      ].map(s => '*://*/*.' + s + '*')
    });
    chrome.contextMenus.create({
      title: 'Download with Live Stream Downloader',
      id: 'download-media',
      contexts: ['audio', 'video']
    });
    chrome.contextMenus.create({
      title: 'Extract Links',
      id: 'extract-links',
      contexts: ['selection']
    });
    chrome.contextMenus.create({
      title: 'Clear Detected Media List',
      id: 'clear',
      contexts: ['action', 'browser_action'],
      targetUrlPatterns: ['*://*/*']
    });
  };
  chrome.runtime.onInstalled.addListener(once);
  chrome.runtime.onStartup.addListener(once);
}
chrome.contextMenus.onClicked.addListener((info, tab) => {
  if (info.menuItemId === 'clear') {
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
  else if (info.menuItemId === 'extract-links') {
    chrome.permissions.request({
      permissions: ['scripting']
    }, granted => {
      if (granted) {
        chrome.scripting.executeScript({
          target: {
            tabId: tab.id
          },
          injectImmediately: true,
          func: () => {
            const div = document.createElement('div');
            const rLinks = [];
            const selection = window.getSelection();
            for (let i = 0; i < selection.rangeCount; i++) {
              const range = selection.getRangeAt(i);
              const f = range.cloneContents();
              div.appendChild(f);

              const n = range.commonAncestorContainer;
              if (n.nodeType === Node.ELEMENT_NODE) {
                rLinks.push(n.href);
              }
              else {
                rLinks.push(n.parentNode.href);
              }
            }
            const links = [...rLinks, ...[...div.querySelectorAll('a')].map(a => a.href)];

            const re = /(\b(https?|file):\/\/[-A-Z0-9+&@#\\/%?=~_|!:,.;]*[-A-Z0-9+&@#\\/%=~_|])/gi;
            links.push(
              ...(selection.toString().match(re) || []) .map(s => s.replace(/&amp;/g, '&'))
            );

            return links.filter(href => href).filter((s, i, l) => s && l.indexOf(s) === i);
          }
        }).then(a => {
          const links = a.map(o => o.result || []).flat();

          extra[tab.id] = links;

          open(tab, [{
            key: 'extra',
            value: true
          }]);
        });
      }
    });
  }
});
