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

/* global observe, tld */

const bbdetector = {};

bbdetector.mime = {
  observe(d) {
    for (const {name, value} of d.responseHeaders) {
      if ((name === 'content-type' || name === 'Content-Type') && value && (
        value.startsWith('video/') || value.startsWith('audio/')
      )) {
        console.log(d);

        return observe(d);
      }
    }
  }
};

bbdetector.activate = async () => {
  if (bbdetector.busy) {
    bbdetector.pending = true;
    return;
  }
  bbdetector.busy = true;
  const prefs = await chrome.storage.local.get({
    'mime-watch': false,
    'detect-media': true,
    'mime-watch-scope-mode': 'all',
    'mime-watch-allowlist': []
  });
  await chrome.scripting.unregisterContentScripts({
    ids: ['bb_main', 'bb_isolated']
  }).catch(() => {});
  chrome.webRequest.onHeadersReceived.removeListener(bbdetector.mime.observe);

  if (prefs['mime-watch'] && prefs['detect-media']) {
    let matches = [];
    if (prefs['mime-watch-scope-mode'] === 'all') {
      matches = ['*://*/*'];
    }
    else if (prefs['mime-watch-allowlist'].length) {
      matches = prefs['mime-watch-allowlist'].map(host => '*://*.' + host + '/*');
    }
    if (matches.length) {
      console.info('blob detection', 'network observer is installed');
      const props = {
        'matches': matches,
        'allFrames': true,
        'matchOriginAsFallback': true,
        'runAt': 'document_start'
      };

      try {
        await chrome.scripting.registerContentScripts([{
          ...props,
          'id': 'bb_main',
          'world': 'MAIN',
          'js': ['/plugins/blob-detector/inject/main.js']
        }]);
        await chrome.scripting.registerContentScripts([{
          ...props,
          'id': 'bb_isolated',
          'world': 'ISOLATED',
          'js': ['/plugins/blob-detector/inject/isolated.js']
        }]);
      }
      catch (e) {}

      chrome.webRequest.onHeadersReceived.addListener(bbdetector.mime.observe, {
        urls: matches,
        types: ['xmlhttprequest']
      }, ['responseHeaders']);
    }
    else {
      console.info('blob detection', 'network observer is removed: empty list');
    }
  }
  else {
    console.info('blob detection', 'network observer is removed');
  }
  bbdetector.busy = false;
  if (bbdetector.pending) {
    bbdetector.pending = false;
    bbdetector.activate();
  }
};

bbdetector.menu = {};

bbdetector.menu.prefs = () => chrome.storage.local.get({
  'mime-watch': false,
  'detect-media': true,
  'mime-watch-scope-mode': 'all'
});

bbdetector.menu.create = async () => {
  if (bbdetector.menu.create.done) {
    return;
  }
  bbdetector.menu.create.done = true;
  const prefs = await bbdetector.menu.prefs();
  const enabled = prefs['mime-watch'] && prefs['detect-media'];
  const create = props => chrome.contextMenus.create(props, () => void chrome.runtime.lastError);

  create({
    title: 'Improved Media Detection',
    id: 'mime-watch-root',
    contexts: ['action'],
    documentUrlPatterns: ['*://*/*'],
    parentId: 'detect-media-root',
    enabled: prefs['detect-media']
  });
  create({
    title: 'Enabled',
    id: 'mime-watch-toggle',
    type: 'checkbox',
    checked: prefs['mime-watch'],
    contexts: ['action'],
    documentUrlPatterns: ['*://*/*'],
    parentId: 'mime-watch-root'
  });
  create({
    title: 'Scope',
    id: 'mime-watch-scope-root',
    contexts: ['action'],
    documentUrlPatterns: ['*://*/*'],
    enabled,
    parentId: 'mime-watch-root'
  });
  create({
    title: 'All Hosts',
    id: 'mime-watch-scope-all',
    type: 'radio',
    checked: prefs['mime-watch-scope-mode'] === 'all',
    contexts: ['action'],
    documentUrlPatterns: ['*://*/*'],
    parentId: 'mime-watch-scope-root'
  });
  create({
    title: 'Allow List Only',
    id: 'mime-watch-scope-allowlist',
    type: 'radio',
    checked: prefs['mime-watch-scope-mode'] === 'allowlist',
    contexts: ['action'],
    documentUrlPatterns: ['*://*/*'],
    parentId: 'mime-watch-scope-root'
  });
  create({
    title: 'Allow List',
    id: 'mime-watch-allowlist-root',
    contexts: ['action'],
    documentUrlPatterns: ['*://*/*'],
    enabled,
    parentId: 'mime-watch-root'
  });
  create({
    title: 'Add Current Tab to Allow List',
    id: 'mime-watch-allowlist-add',
    contexts: ['action'],
    documentUrlPatterns: ['*://*/*'],
    parentId: 'mime-watch-allowlist-root'
  });
  create({
    title: 'Remove Current Tab from Allow List',
    id: 'mime-watch-allowlist-remove',
    contexts: ['action'],
    documentUrlPatterns: ['*://*/*'],
    parentId: 'mime-watch-allowlist-root'
  });
};

bbdetector.menu.sync = async () => {
  const prefs = await bbdetector.menu.prefs();
  const enabled = prefs['mime-watch'] && prefs['detect-media'];
  const update = (id, props) => chrome.contextMenus.update(id, props).catch(() => {});
  update('mime-watch-toggle', {
    checked: prefs['mime-watch']
  });
  update('mime-watch-root', {
    enabled: prefs['detect-media']
  });
  update('mime-watch-scope-root', {
    enabled
  });
  update('mime-watch-scope-all', {
    checked: prefs['mime-watch-scope-mode'] === 'all'
  });
  update('mime-watch-scope-allowlist', {
    checked: prefs['mime-watch-scope-mode'] === 'allowlist'
  });
  update('mime-watch-allowlist-root', {
    enabled
  });
};

bbdetector.menu.onClick = (info, tab) => {
  if (info.menuItemId === 'mime-watch-toggle') {
    chrome.storage.local.set({
      'mime-watch': info.checked
    });
  }
  else if (info.menuItemId === 'mime-watch-scope-all') {
    chrome.storage.local.set({
      'mime-watch-scope-mode': 'all'
    });
  }
  else if (info.menuItemId === 'mime-watch-scope-allowlist') {
    chrome.storage.local.set({
      'mime-watch-scope-mode': 'allowlist'
    });
  }
  else if (info.menuItemId === 'mime-watch-allowlist-add' || info.menuItemId === 'mime-watch-allowlist-remove') {
    let host = '';
    try {
      const u = new URL(tab.url);
      if (u.protocol === 'http:' || u.protocol === 'https:') {
        host = tld.getDomain(u.hostname) || u.hostname;
      }
    }
    catch (e) {}

    if (host) {
      chrome.storage.local.get({
        'mime-watch-allowlist': []
      }).then(prefs => {
        const list = prefs['mime-watch-allowlist'];
        if (info.menuItemId === 'mime-watch-allowlist-add') {
          if (list.includes(host) === false) {
            chrome.storage.local.set({
              'mime-watch-allowlist': [...list, host]
            });
          }
        }
        else {
          chrome.storage.local.set({
            'mime-watch-allowlist': list.filter(h => h !== host)
          });
        }
      });
    }
    else {
      console.info('This page does not have valid hostname', host);
      self.notify(tab.id, '!', 'This page does not have valid hostname');
    }
  }
};

bbdetector.onChange = ps => {
  if (ps['mime-watch'] || ps['mime-watch-scope-mode'] || ps['mime-watch-allowlist'] || ps['detect-media']) {
    bbdetector.activate();
    bbdetector.menu.sync();
  }
};

chrome.contextMenus.onClicked.addListener(bbdetector.menu.onClick);
chrome.storage.onChanged.addListener(bbdetector.onChange);
{
  const once = () => {
    if (once.done) {
      return;
    }
    once.done = true;
    bbdetector.menu.create();
    bbdetector.activate();
  };
  chrome.runtime.onStartup.addListener(once);
  chrome.runtime.onInstalled.addListener(once);
}
