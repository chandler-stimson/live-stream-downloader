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

/* global events */

if (/Firefox/.test(navigator.userAgent)) {
  document.getElementById('power-container').classList.add('disabled');
}
else {
  browser.permissions.contains({
    permissions: ['power']
  }, granted => {
    browser.runtime.lastError;
    document.getElementById('power').checked = granted;
  });

  document.getElementById('power').addEventListener('change', e => {
    if (e.target.checked) {
      browser.permissions.request({
        permissions: ['power']
      }, granted => {
        if (granted) {
          self.notify('Done, Reopen this window to apply', 2000);
        }
        else {
          e.target.checked = false;
        }
      });
    }
    else {
      browser.permissions.remove({
        permissions: ['power']
      });
      self.notify('Done, Reopen this window to apply', 2000);
    }
  });

  events.after.add(() => browser.runtime.sendMessage({
    method: 'release-awake-if-possible'
  }, () => browser.runtime.lastError));

  addEventListener('beforeunload', () => browser.runtime.sendMessage({
    method: 'release-awake-if-possible'
  }, () => browser.runtime.lastError));

  browser.runtime.onMessage.addListener((request, sender, response) => {
    if (request.method === 'any-active' && document.body.dataset.mode === 'download') {
      response(true);
    }
  });
}

