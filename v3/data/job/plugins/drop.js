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

/* global addEntries */

{
  const extract = (code = '') => {
    const links = new Map();

    try {
      const parser = new DOMParser();
      const doc = parser.parseFromString(code, 'text/html');
      for (const a of doc.querySelectorAll('[href]')) {
        links.set(a.href, {
          url: a.href
        });
      }
      for (const a of doc.querySelectorAll('[src]')) {
        links.set(a.src, {
          url: a.src
        });
      }
    }
    catch (e) {}

    const parts = code.split(/\s+/);
    parts.forEach(word => {
      try {
        const url = new URL(word);
        links.set(url.href, {
          url: url.href
        });
      }
      catch (e) {}
    });

    // Inaccurate and most likely truncated links. Only add those that are not extracted with the native method
    const r = /(\b(https?|ftp|file):\/\/[-A-Z0-9+&@#/%?=~_|!:,.;]*[-A-Z0-9+&@#/%=~_|])/ig;
    const alreadyExtracted = [...links.keys()];
    for (const link of (code.match(r) || [])) {
      if (alreadyExtracted.some(a => a.startsWith(link)) === false) {
        links.set(link, {
          url: link
        });
      }
    }

    return links;
  };

  document.ondragover = e => e.preventDefault();
  document.ondrop = e => {
    e.preventDefault();

    if (document.body.dataset.mode === 'download' || document.body.dataset.mode === 'parse') {
      return;
    }

    if (e.dataTransfer.files.length) {
      const files = new Map();
      for (const file of e.dataTransfer.files) {
        files.set(file.name, file);
      }
      addEntries(files);
    }
    else {
      const code = e.dataTransfer.getData('text/html') || e.dataTransfer.getData('text/plain');

      const links = extract(code);
      const url = e.dataTransfer.getData('text/uri-list');
      links.set(url, {
        url
      });

      if (links.size) {
        addEntries(links);
      }
      else {
        self.notify('No link is detected!', 750);
      }
    }
  };

  document.onpaste = e => {
    if (document.body.dataset.mode === 'download' || document.body.dataset.mode === 'parse') {
      return;
    }

    const code = e.clipboardData.getData('Text');

    const links = extract(code);
    if (links.size) {
      addEntries(links);
    }
    else {
      self.notify('No link is detected!', 750);
    }
  };
}
