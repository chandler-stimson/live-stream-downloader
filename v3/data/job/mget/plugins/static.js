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

/* global MyGet */

const MIME_TYPES = {
  'image/jpeg': 'jpg',
  'application/x-javascript': 'js',
  'application/atom+xml': 'atom',
  'application/rss+xml': 'rss',
  'text/plain': 'txt',
  'text/javascript': 'js',
  'image/x-icon': 'ico',
  'image/x-ms-bmp': 'bmp',
  'image/svg+xml': 'svg',
  'application/java-archive': 'jar',
  'application/msword': 'doc',
  'application/postscript': 'ps',
  'application/vnd.ms-excel': 'xls',
  'application/vnd.ms-powerpoint': 'ppt',
  'application/vnd.apple.mpegurl': 'm3u8',
  'application/x-7z-compressed': '7z',
  'application/x-rar-compressed': 'rar',
  'application/x-shockwave-flash': 'swf',
  'application/x-xpinstall': 'xpi',
  'application/xhtml+xml': 'xhtml',
  'application/octet-stream': 'bin',
  'application/binary': 'exe',
  'audio/mpeg': 'mp3',
  'audio/mpegurl': 'm3u8',
  'video/3gpp': '3gp',
  'video/mpeg': 'mpg',
  'video/quicktime': 'mov',
  'video/x-flv': 'flv',
  'video/x-mng': 'mng',
  'video/x-ms-asf': 'asf',
  'video/x-ms-wmv': 'wmv',
  'video/x-msvideo': 'avi'
};

class SGet extends MyGet {
  /* guess filename and extension */
  static guess(resp, meta = {}) {
    const href = resp.url.split('#')[0].split('?')[0];

    const disposition = resp.headers.get('Content-Disposition');
    let name = '';
    if (disposition) {
      const tmp = /filename\*=UTF-8''([^;]*)/.exec(disposition);
      if (tmp && tmp.length) {
        name = tmp[1].replace(/["']$/, '').replace(/^["']/, '');
        name = decodeURIComponent(name);
      }
    }
    if (!name && disposition) {
      const tmp = /filename=([^;]*)/.exec(disposition);
      if (tmp && tmp.length) {
        name = tmp[1].replace(/["']$/, '').replace(/^["']/, '');
      }
    }
    if (!name) {
      if (href.startsWith('data:')) {
        const mime = href.split('data:')[1].split(';')[0];
        meta.ext = (MIME_TYPES[mime] || mime.split('/')[1] || '').split(';')[0];
        name = '';
        meta.mime = mime;
      }
      else {
        const fe = (href.substring(href.lastIndexOf('/') + 1) || 'unknown').slice(-100);
        name = fe;
      }
    }
    name = name || 'unknown';
    // valid file extension "*.webvtt"
    const e = /(.+)\.([^.]{1,6})*$/.exec(name);

    name = e ? e[1] : name;
    meta.mime = resp.headers.get('Content-Type') || '';
    meta.ext = e ? e[2] : (MIME_TYPES[meta.mime] || meta.mime.split('/')[1] || '').split(';')[0];
    meta.ext = meta.ext.slice(0, 15); // cannot be longer than 16 characters.
    //
    meta.name = decodeURIComponent(name) || meta.name;
  }
  static size(bytes, si = true, dp = 1) {
    bytes = Number(bytes);
    const thresh = si ? 1000 : 1024;

    if (Math.abs(bytes) < thresh) {
      return bytes + ' B';
    }

    const units = si ?
      ['KB', 'MB', 'GB', 'TB', 'PB', 'EB', 'ZB', 'YB'] :
      ['KiB', 'MiB', 'GiB', 'TiB', 'PiB', 'EiB', 'ZiB', 'YiB'];
    let u = -1;
    const r = 10 ** dp;

    do {
      bytes /= thresh;
      ++u;
    } while (Math.round(Math.abs(bytes) * r) / r >= thresh && u < units.length - 1);

    return bytes.toFixed(dp) + ' ' + units[u];
  }
  headers(segment, position, request, response) {
    if (position === 0) {
      self.MyGet.guess(response, this.meta);
    }

    return super.headers(segment, position, request, response);
  }
}

self.MyGet = SGet;
