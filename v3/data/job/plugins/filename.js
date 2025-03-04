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

chrome.storage.local.get({
  'filename': '[meta.name]',
  'online-resolve-name': true
}).then(prefs => {
  document.getElementById('filename').value = prefs.filename;
  document.getElementById('online-resolve-name').checked = prefs['online-resolve-name'];
});

const changed = target => {
  chrome.storage.local.set({
    filename: target.value || '[meta.name]'
  }).then(() => self.notify('Done, Reopen this window to apply', 2000));
};

{
  let id;
  document.getElementById('filename').addEventListener('input', e => {
    id = clearTimeout(id);
    id = setTimeout(changed, 2000, e.target);
  });
}

document.getElementById('online-resolve-name').onchange = e => chrome.storage.local.set({
  'online-resolve-name': e.target.checked
});
