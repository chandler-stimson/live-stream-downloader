/* global extra, network */

/* context menu */
{
  const once = () => {
    network.types({core: true, extra: true}).then(types => browser.contextMenus.create({
      title: 'Download with Live Stream Downloader',
      id: 'download-link',
      contexts: ['link'],
      targetUrlPatterns: types.map(s => '*://*/*.' + s + '*'),
    }));
    browser.contextMenus.create({
      title: 'Download with Live Stream Downloader',
      id: 'download-media',
      contexts: ['audio', 'video'],
    });
    browser.contextMenus.create({
      title: 'Extract Links',
      id: 'extract-links',
      contexts: ['selection'],
    });
    browser.contextMenus.create({
      title: 'Clear Detected Media List',
      id: 'clear',
      contexts: ['browser_action'],
      documentUrlPatterns: ['*://*/*'],
    });
  };
  if (/Firefox/.test(navigator.userAgent)) {
    document.addEventListener('DOMContentLoaded', once, {
      once: true
    });
  }
  else {
    browser.runtime.onInstalled.addListener(once);
  }
}
browser.contextMenus.onClicked.addListener((info, tab) => {
  if (info.menuItemId === 'clear') {
    browser.scripting.executeScript({
      target: {
        tabId: tab.id
      },
      func: () => {
        if (self.storage) {
          self.storage.clear();
        }
      }
    }).catch(() => {});

    browser.browserAction.setIcon({
      tabId: tab.id,
      path: {
        '16': '/data/icons/16.png',
        '32': '/data/icons/32.png',
        '48': '/data/icons/48.png'
      }
    });
    browser.browserAction.setBadgeText({
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
    const next = () => browser.scripting.executeScript({
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
    next();
  }
});
