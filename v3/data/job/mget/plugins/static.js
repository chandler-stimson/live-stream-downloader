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
