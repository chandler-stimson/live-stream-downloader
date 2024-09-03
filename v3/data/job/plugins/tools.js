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

/* global error, options, events */

{
  const hrefs = document.getElementById('hrefs');
  hrefs.addEventListener('change', () => {
    const b = Boolean(hrefs.querySelector(':checked'));

    document.getElementById('download-all').disabled = !b;
  });

  /* TO-DO: download with batch() function */
  document.getElementById('download-all').onclick = async () => {
    try {
      const divs = [...hrefs.querySelectorAll(':checked')].map(e => e.closest('label'));
      const filenames = {};

      const dir = await window.showDirectoryPicker({
        mode: 'readwrite'
      });

      // if there are duplicates, fix file-index
      for await (const file of dir.values()) {
        if (file.kind === 'file') {
          filenames[file.name] = 0;
        }
      }
      const validate = div => {
        const name = options(div).suggestedName;

        filenames[name] = name in filenames ? filenames[name] : -1;
        filenames[name] += 1;

        div.meta.index = filenames[name];

        const n = options(div).suggestedName;
        if (n in filenames) {
          if (filenames[name]) {
            validate(div);
          }
        }
        else {
          filenames[n] = 0;
        }
      };

      for (const div of divs) {
        validate(div);
      }

      const next = async () => {
        if (divs.length) {
          const div = divs.shift();

          self.aFile = await dir.getFileHandle(options(div).suggestedName, {
            create: true
          });
          self.aFile.stat = {
            index: next.total - divs.length,
            total: next.total
          };

          div.querySelector('[type=submit]').click();
        }
        else {
          delete self.aFile;
        }
      };
      next.total = divs.length;
      events.after.add(next);
      next();
    }
    catch (e) {
      error(e);
    }
  };
  document.getElementById('select-all').onclick = () => {
    for (const e of hrefs.querySelectorAll('input[type=checkbox]')) {
      e.checked = true;
    }
    hrefs.querySelector('input[type=checkbox]').dispatchEvent(new Event('change', {bubbles: true}));
  };
  document.getElementById('select-none').onclick = () => {
    for (const e of hrefs.querySelectorAll('input[type=checkbox]')) {
      e.checked = false;
    }
    hrefs.querySelector('input[type=checkbox]').dispatchEvent(new Event('change', {bubbles: true}));
  };
  document.getElementById('remove-duplicates').onclick = () => {
    const entries = hrefs.querySelectorAll('.entry');

    const cache = new Set();

    for (const entry of entries) {
      const href = entry.querySelector('[data-id=href]').textContent;

      if (cache.has(href)) {
        entry.remove();
      }
      cache.add(href);
    }
  };
  document.getElementById('keep-hls').onclick = () => {
    const entries = hrefs.querySelectorAll('.entry');

    for (const entry of entries) {
      if (entry?.meta?.ext !== 'm3u8') {
        entry.remove();
      }
    }
    if (!hrefs.querySelector('.entry')) {
      document.body.dataset.mode = 'empty';
    }
  };
}

