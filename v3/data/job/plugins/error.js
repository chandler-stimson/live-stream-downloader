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

/* global storage, MyGet */

storage.get({
  'error-tolerance': MyGet.OPTIONS['error-tolerance']
}).then(prefs => {
  document.getElementById('error-tolerance').value = prefs['error-tolerance'];

  document.getElementById('error-tolerance').onchange = e => {
    const n = Math.max(1, Math.min(100, e.target.valueAsNumber));
    if (isNaN(n) === false) {
      storage.set({
        'error-tolerance': n
      });
    }
  };
});
