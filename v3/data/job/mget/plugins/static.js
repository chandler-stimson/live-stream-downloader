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
    Homepage: https://add0n.com/hls-downloader.html
*/

/* global MyGet */

class SGet extends MyGet {
  constructor(...args) {
    super(...args);
    this.meta = {}; // name, ext, mime
  }
  /* guess filename and extension */
  static guess(resp, meta = {}) {
    const href = resp.url.split('#')[0].split('?')[0];
    const fe = href.substring(href.lastIndexOf('/') + 1) || 'unknown';

    const e = /(.+)\.([^.]{1,5})*$/.exec(fe);

    meta.name = e ? e[1] : fe;
    meta.ext = e ? e[2] : '';
    meta.mime = resp.headers.get('Content-Type') || 'application/binary';
  }
  static size(bytes, si = false, dp = 1) {
    bytes = Number(bytes);
    const thresh = si ? 1000 : 1024;

    if (Math.abs(bytes) < thresh) {
      return bytes + ' B';
    }

    const units = si ?
      ['kB', 'MB', 'GB', 'TB', 'PB', 'EB', 'ZB', 'YB'] :
      ['KiB', 'MiB', 'GiB', 'TiB', 'PiB', 'EiB', 'ZiB', 'YiB'];
    let u = -1;
    const r = 10 ** dp;

    do {
      bytes /= thresh;
      ++u;
    } while (Math.round(Math.abs(bytes) * r) / r >= thresh && u < units.length - 1);

    return bytes.toFixed(dp) + ' ' + units[u];
  }
  headers(segment, position, response) {
    if (position === 0) {
      self.MyGet.guess(response, this.meta);
    }
  }
}

self.MyGet = SGet;
