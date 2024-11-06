/**
    MyGet - A multi-thread downloading library
    Copyright (C) 2014-2022 [Chandler Stimson]

    This program is free software: you can redistribute it and/or modify
    it under the terms of the Mozilla Public License as published by
    the Mozilla Foundation, either version 2 of the License, or
    (at your option) any later version.
    This program is distributed in the hope that it will be useful,
    but WITHOUT ANY WARRANTY; without even the implied warranty of
    MERCHANTABILITY or FITNESS FOR A PARTICULAR PURPOSE.  See the
    Mozilla Public License for more details.
    You should have received a copy of the Mozilla Public License
    along with this program.  If not, see {https://www.mozilla.org/en-US/MPL/}.

    GitHub: https://github.com/chandler-stimson/live-stream-downloader/
    Homepage: https://webextension.org/listing/hls-downloader.html
*/

/* global extra, network */

/* context menu */
{
  const once = () => {
    if (once.done) {
      return;
    }
    once.done = true;

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
  browser.runtime.onStartup.addListener(once);
  browser.runtime.onInstalled.addListener(once);
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
    }).catch(e => {
      console.error(e);
      self.notify(tab.id, 'E', e.message || 'Unknown Error');
    });

    chrome.permissions.request({
      permissions: ['scripting']
    }, granted => {
      if (granted !== false) {
        next();
      }
    });
  }
});
