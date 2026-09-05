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

// https://ww9.0123movie.net/movie/ugly-betty-season-1-6373.html

/* global tld */

const activate = async () => {
  if (activate.busy) {
    return;
  }
  activate.busy = true;
  const prefs = await chrome.storage.local.get({
    'mime-watch': false,
    'mime-watch-scope-mode': 'all',
    'mime-watch-allowlist': []
  });
  await chrome.scripting.unregisterContentScripts({
    ids: ['bb_main', 'bb_isolated']
  }).catch(() => {});

  if (prefs['mime-watch']) {
    let matches = [];
    if (prefs['mime-watch-scope-mode'] === 'all') {
      matches = ['*://*/*'];
    }
    else if (prefs['mime-watch-allowlist'].length) {
      matches = prefs['mime-watch-allowlist'].map(host => '*://*.' + host + '/*');
    }
console.log(matches);
    if (matches.length) {
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
    }
    else {
      console.info('Blob detection is disabled', 'matching list is empty');
    }
  }
  activate.busy = false;
};

const menuPrefs = () => chrome.storage.local.get({
  'mime-watch': false,
  'mime-watch-scope-mode': 'all'
});

const createMenus = () => menuPrefs().then(prefs => {
  const enabled = prefs['mime-watch'];
  const create = props => chrome.contextMenus.create(props, () => void chrome.runtime.lastError);
  create({
    title: 'Improved Media Detection',
    id: 'mime-watch-root',
    contexts: ['action'],
    documentUrlPatterns: ['*://*/*']
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
});

const syncMenus = () => menuPrefs().then(prefs => {
  const enabled = prefs['mime-watch'];
  const update = (id, props) => chrome.contextMenus.update(id, props).catch(() => {});
  update('mime-watch-toggle', {
    checked: enabled
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
}).catch(() => {});

{
  const once = () => {
    if (once.done) {
      return;
    }
    once.done = true;
    createMenus();
  };
  chrome.runtime.onStartup.addListener(once);
  chrome.runtime.onInstalled.addListener(once);
}

chrome.contextMenus.onClicked.addListener((info, tab) => {
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
});

chrome.storage.onChanged.addListener(ps => {
  if (ps['mime-watch'] || ps['mime-watch-scope-mode'] || ps['mime-watch-allowlist']) {
    activate();
    syncMenus();
  }
});

chrome.runtime.onStartup.addListener(activate);
chrome.runtime.onInstalled.addListener(activate);
