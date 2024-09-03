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

const activate = () => {
  if (activate.busy) {
    return;
  }
  activate.busy = true;
  chrome.storage.local.get({
    'mime-watch': false
  }, async prefs => {
    await chrome.scripting.unregisterContentScripts({
      ids: ['bb_main', 'bb_isolated']
    }).catch(() => {});

    if (prefs['mime-watch']) {
      const props = {
        'matches': ['*://*/*'],
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
    activate.busy = false;
  });
};

chrome.runtime.onStartup.addListener(activate);
chrome.runtime.onInstalled.addListener(activate);
chrome.storage.onChanged.addListener(ps => ps['mime-watch'] && activate());
