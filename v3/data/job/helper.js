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

{
  let id;
  let content;

  self.notify = (msg, timeout = 750) => {
    if (id === undefined) {
      content = document.title;
    }
    document.title = msg;

    if (timeout) {
      clearTimeout(id);
      id = setTimeout(() => {
        document.title = content;
        id = undefined;
      }, timeout);
    }
  };
}
{
  const cache = [];

  self.prompt = (msg, buttons = {
    ok: 'Retry',
    no: 'Cancel',
    value: ''
  }, confirm = false) => {
    return new Promise((resolve, reject) => {
      const root = document.getElementById('prompt');
      cache.push({resolve, reject});

      if (root.open === false) {
        root.querySelector('p').textContent = msg;
        root.dataset.mode = confirm ? 'confirm' : 'prompt';

        root.querySelector('[name=value]').required = confirm;
        root.querySelector('[name=value]').value = buttons.value;
        root.querySelector('[name=value]').select();
        root.querySelector('[name=value]').type = isNaN(buttons.value) ? 'text' : 'number';
        root.querySelector('[value=default]').textContent = buttons.ok;
        root.querySelector('[value=cancel]').textContent = buttons.no;
        [...root.querySelectorAll('[value=extra]')].forEach((e, n) => {
          e.textContent = buttons.extra ? buttons.extra[n] : '';
        });

        let value = Error('USER_ABORT');

        root.onsubmit = e => {
          e.preventDefault();
          if (e.submitter.value === 'default') {
            value = root.querySelector('[name=value]').value;
            root.close();
          }
          else if (e.submitter.value === 'extra') {
            value = e.submitter.dataset.id;
            root.close();
          }
        };
        root.onclick = e => {
          if (e.target.type === 'button' && e.target.value === 'cancel') {
            root.close();
          }
        };
        root.onclose = () => {
          if (value instanceof Error) {
            for (const {reject} of cache) {
              reject(value);
            }
          }
          else {
            for (const {resolve} of cache) {
              resolve(value);
            }
          }
          cache.length = 0;
        };

        root.showModal();
        root.querySelector(confirm ? '[name=value]' : '[value=default]').focus();
      }
    });
  };
}

const helper = {};

/* is this link downloadable or we need to parse it first */
helper.downloadable = ({meta, entry}) => {
  return meta.ext !== 'txt' &&
    meta.ext !== 'm3u8' &&
    meta.ext !== 'mpd' &&
    entry.url.includes('.m3u8') === false &&
    entry.url.includes('.mpd') === false &&
    entry.url.includes('format=m3u8') === false &&
    entry.url.includes('format=mpd') === false &&
    entry.url.includes('data:application/dash+xml') === false &&
    entry.url.includes('data:application/vnd.apple.mpegurl') === false &&
    entry.url.includes('data:x-mpegURL') === false &&
    entry.url.includes('data:audio/mpegurl') === false &&
    entry.url.includes('data:audio/x-mpegurl') === false;
};

/* generate options for save dialog */
helper.options = ({meta}) => {
  const options = {
    types: [{
      description: 'Video or Audio Files'
    }]
  };

  // this way, the file can get played while download is in progress
  if (meta.ext === 'm3u8' || meta.ext === 'mpd') {
    const df = document.getElementById('default-format').value;
    if (df === 'ts') {
      options.types[0].accept = {
        'video/MP2T': ['.ts']
      };
    }
    else {
      options.types[0].accept = {
        'video/mkv': ['.mkv']
      };
    }
    options.suggestedName =
      (meta.gname || meta.name || 'Untitled') +
      (meta.index ? (' - ' + meta.index) : '') +
      '.' + df;
  }
  else if (meta.ext === '') {
    options.types[0].accept = {
      'video/mkv': ['.mkv']
    };
    options.suggestedName =
      (meta.gname || meta.name || 'Untitled') +
      (meta.index ? (' - ' + meta.index) : '') +
      '.mkv';
  }
  else if (meta.ext) {
    if (meta.mime) {
      options.types[0].accept = {
        [meta.mime]: ['.' + meta.ext]
      };
    }
    options.suggestedName =
      (meta.gname || meta.name || 'Untitled') +
      (meta.index ? (' - ' + meta.index) : '') +
      '.' + meta.ext;
  }

  return options;
};
