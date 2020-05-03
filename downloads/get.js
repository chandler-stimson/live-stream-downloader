/**
    Turbo Download Manager - .A download manager with the ability to pause and resume downloads

    Copyright (C) 2014-2020 [InBasic](https://add0n.com/turbo-download-manager-v2.html)

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

    GitHub: https://github.com/inbasic/turbo-download-manager-v2/
    Homepage: https://add0n.com/turbo-download-manager-v2.html
*/

const MIME_TYPES = {
  'text/html': 'html',
  'text/css': 'css',
  'text/xml': 'xml',
  'image/gif': 'gif',
  'image/jpeg': 'jpg',
  'application/x-javascript': 'js',
  'application/atom+xml': 'atom',
  'application/rss+xml': 'rss',
  'text/plain': 'txt',
  'text/javascript': 'js',
  'image/png': 'png',
  'image/tiff': 'tiff',
  'image/x-icon': 'ico',
  'image/x-ms-bmp': 'bmp',
  'image/svg+xml': 'svg',
  'image/webp': 'webp',
  'application/java-archive': 'jar',
  'application/msword': 'doc',
  'application/pdf': 'pdf',
  'application/postscript': 'ps',
  'application/rtf': 'rtf',
  'application/vnd.ms-excel': 'xls',
  'application/vnd.ms-powerpoint': 'ppt',
  'application/x-7z-compressed': '7z',
  'application/x-rar-compressed': 'rar',
  'application/x-shockwave-flash': 'swf',
  'application/x-xpinstall': 'xpi',
  'application/xhtml+xml': 'xhtml',
  'application/zip': 'zip',
  'application/octet-stream': 'bin',
  'audio/midi': 'midi',
  'audio/mpeg': 'mp3',
  'audio/ogg': 'ogg',
  'video/3gpp': '3gp',
  'video/mpeg': 'mpg',
  'video/quicktime': 'mov',
  'video/x-flv': 'flv',
  'video/x-mng': 'mng',
  'video/x-ms-asf': 'asf',
  'video/x-ms-wmv': 'wmv',
  'video/x-msvideo': 'avi',
  'video/mp4': 'mp4'
};
const MAGIC_BYTES = {
  'gif': [
    ['47', '49', '46', '38', '37', '61'],
    ['47', '49', '46', '38', '39', '61']
  ],
  'jpg': [
    ['ff', 'd8', 'ff', 'db'],
    ['ff', 'd8', 'ff', 'e0', '?', '?', '4a', '46', '49', '46', '00', '01'],
    ['ff', 'd8', 'ff', 'e1', '?', '?', '45', '78', '69', '66', '00', '00']
  ],
  'rpm': [
    ['ed', 'ab', 'ee', 'db']
  ],
  'bin': [
    ['53', '50', '30', '31']
  ],
  'pdb': [
    ['00', '00', '00', '00', '00', '00', '00', '00', '00', '00', '00', '00', '00', '00', '00', '00', '00', '00', '00', '00', '00', '00', '00', '00']
  ],
  'dba': [
    ['be', 'ba', 'fe', 'ca']
  ],
  'dba2': [
    ['00', '01', '42', '44']
  ],
  'tda': [
    ['00', '01', '44', '54']
  ],
  'tda2': [
    ['00', '01', '00', '00']
  ],
  'ico': [
    ['00', '00', '01', '00']
  ],
  '3gp': [
    ['66', '74', '79', '70', '33', '67']
  ],
  'bac': [
    ['42', '41', '43', '4b', '4d', '49', '4b', '45', '44', '49', '53', '4b']
  ],
  'bz2': [
    ['42', '5a', '68']
  ],
  'tif': [
    ['49', '49', '2a', '00']
  ],
  'tiff': [
    ['4d', '4d', '00', '2a']
  ],
  'cr2': [
    ['49', '49', '2a', '00', '10', '00', '00', '00', '43', '52']
  ],
  'cin': [
    ['80', '2a', '5f', 'd7']
  ],
  'cin1': [
    ['52', '4e', '43', '01']
  ],
  'cin2': [
    ['52', '4e', '43', '02']
  ],
  'dpx': [
    ['53', '44', '50', '58']
  ],
  'dpx2': [
    ['58', '50', '44', '53']
  ],
  'exr': [
    ['76', '2f', '31', '01']
  ],
  'bpg': [
    ['42', '50', '47', 'fb']
  ],
  'ilbm': [
    ['46', '4f', '52', '4d', '?', '?', '?', '?', '49', '4c', '42', '4d']
  ],
  '8svx': [
    ['46', '4f', '52', '4d', '?', '?', '?', '?', '38', '53', '56', '58']
  ],
  'acbm': [
    ['46', '4f', '52', '4d', '?', '?', '?', '?', '41', '43', '42', '4d']
  ],
  'anbm': [
    ['46', '4f', '52', '4d', '?', '?', '?', '?', '41', '4e', '42', '4d']
  ],
  'anim': [
    ['46', '4f', '52', '4d', '?', '?', '?', '?', '41', '4e', '49', '4d']
  ],
  'faxx': [
    ['46', '4f', '52', '4d', '?', '?', '?', '?', '46', '41', '58', '58']
  ],
  'ftxt': [
    ['46', '4f', '52', '4d', '?', '?', '?', '?', '46', '54', '58', '54']
  ],
  'smus': [
    ['46', '4f', '52', '4d', '?', '?', '?', '?', '53', '4d', '55', '53']
  ],
  'cmus': [
    ['46', '4f', '52', '4d', '?', '?', '?', '?', '43', '4d', '55', '53']
  ],
  'yuvn': [
    ['46', '4f', '52', '4d', '?', '?', '?', '?', '59', '55', '56', '4e']
  ],
  'iff': [
    ['46', '4f', '52', '4d', '?', '?', '?', '?', '46', '41', '4e', '54']
  ],
  'aiff': [
    ['46', '4f', '52', '4d', '?', '?', '?', '?', '41', '49', '46', '46']
  ],
  'idx': [
    ['49', '4e', '44', '58']
  ],
  'lz': [
    ['4c', '5a', '49', '50']
  ],
  'zip': [
    ['50', '4b', '03', '04'],
    ['50', '4b', '05', '06'],
    ['50', '4b', '07', '08']
  ],
  'jar': [
    ['50', '4b', '03', '04'],
    ['50', '4b', '05', '06'],
    ['50', '4b', '07', '08']
  ],
  'odt': [
    ['50', '4b', '03', '04'],
    ['50', '4b', '05', '06'],
    ['50', '4b', '07', '08']
  ],
  'ods': [
    ['50', '4b', '03', '04'],
    ['50', '4b', '05', '06'],
    ['50', '4b', '07', '08']
  ],
  'odp': [
    ['50', '4b', '03', '04'],
    ['50', '4b', '05', '06'],
    ['50', '4b', '07', '08']
  ],
  'docx': [
    ['50', '4b', '03', '04'],
    ['50', '4b', '05', '06'],
    ['50', '4b', '07', '08']
  ],
  'xlsx': [
    ['50', '4b', '03', '04'],
    ['50', '4b', '05', '06'],
    ['50', '4b', '07', '08']
  ],
  'pptx': [
    ['50', '4b', '03', '04'],
    ['50', '4b', '05', '06'],
    ['50', '4b', '07', '08']
  ],
  'vsdx': [
    ['50', '4b', '03', '04'],
    ['50', '4b', '05', '06'],
    ['50', '4b', '07', '08']
  ],
  'apk': [
    ['50', '4b', '03', '04'],
    ['50', '4b', '05', '06'],
    ['50', '4b', '07', '08']
  ],
  'aar': [
    ['50', '4b', '03', '04'],
    ['50', '4b', '05', '06'],
    ['50', '4b', '07', '08']
  ],
  'rar': [
    ['52', '61', '72', '21', '1a', '07', '00'],
    ['52', '61', '72', '21', '1a', '07', '01', '00'],
    ['7f', '45', '4c', '46']
  ],
  'png': [
    ['89', '50', '4e', '47', '0d', '0a', '1a', '0a']
  ],
  'class': [
    ['ca', 'fe', 'ba', 'be'],
    ['ef', 'bb', 'bf'],
    ['fe', 'ed', 'fa', 'ce'],
    ['fe', 'ed', 'fa', 'cf'],
    ['ce', 'fa', 'ed', 'fe'],
    ['cf', 'fa', 'ed', 'fe'],
    ['ff', 'fe'],
    ['ff', 'fe'],
    ['ff', 'fe', '00', '00']
  ],
  'ps': [
    ['25', '21', '50', '53']
  ],
  'pdf': [
    ['25', '50', '44', '46']
  ],
  'asf': [
    ['30', '26', 'b2', '75', '8e', '66', 'cf', '11', 'a6', 'd9', '00', 'aa', '00', '62', 'ce', '6c']
  ],
  'wma': [
    ['30', '26', 'b2', '75', '8e', '66', 'cf', '11', 'a6', 'd9', '00', 'aa', '00', '62', 'ce', '6c']
  ],
  'wmv': [
    ['30', '26', 'b2', '75', '8e', '66', 'cf', '11', 'a6', 'd9', '00', 'aa', '00', '62', 'ce', '6c']
  ],
  'deploymentimage': [
    ['24', '53', '44', '49', '30', '30', '30', '31']
  ],
  'ogg': [
    ['4f', '67', '67', '53']
  ],
  'oga': [
    ['4f', '67', '67', '53']
  ],
  'ogv': [
    ['4f', '67', '67', '53']
  ],
  'psd': [
    ['38', '42', '50', '53']
  ],
  'wav': [
    ['52', '49', '46', '46', '?', '?', '?', '?', '57', '41', '56', '45']
  ],
  'avi': [
    ['52', '49', '46', '46', '?', '?', '?', '?', '41', '56', '49', '20']
  ],
  'mp3': [
    ['ff', 'fb'],
    ['49', '44', '33']
  ],
  'iso': [
    ['43', '44', '30', '30', '31']
  ],
  'flac': [
    ['66', '4c', '61', '43']
  ],
  'mid': [
    ['4d', '54', '68', '64']
  ],
  'midi': [
    ['4d', '54', '68', '64']
  ],
  'doc': [
    ['d0', 'cf', '11', 'e0', 'a1', 'b1', '1a', 'e1']
  ],
  'xls': [
    ['d0', 'cf', '11', 'e0', 'a1', 'b1', '1a', 'e1']
  ],
  'ppt': [
    ['d0', 'cf', '11', 'e0', 'a1', 'b1', '1a', 'e1']
  ],
  'msg': [
    ['d0', 'cf', '11', 'e0', 'a1', 'b1', '1a', 'e1']
  ],
  'dex': [
    ['64', '65', '78', '0a', '30', '33', '35', '00']
  ],
  'vmdk': [
    ['4b', '44', '4d']
  ],
  'crx': [
    ['43', '72', '32', '34']
  ],
  'fh8': [
    ['41', '47', '44', '33']
  ],
  'cwk': [
    ['05', '07', '00', '00', '42', '4f', '42', '4f', '05', '07', '00', '00', '00', '00', '00', '00', '00', '00', '00', '00', '00', '01'],
    ['06', '07', 'e1', '00', '42', '4f', '42', '4f', '06', '07', 'e1', '00', '00', '00', '00', '00', '00', '00', '00', '00', '00', '01']
  ],
  'toast': [
    ['45', '52', '02', '00', '00', '00'],
    ['8b', '45', '52', '02', '00', '00', '00']
  ],
  'dmg': [
    ['78', '01', '73', '0d', '62', '62', '60']
  ],
  'xar': [
    ['78', '61', '72', '21']
  ],
  'dat': [
    ['50', '4d', '4f', '43', '43', '4d', '4f', '43']
  ],
  'nes': [
    ['4e', '45', '53', '1a']
  ],
  'tar': [
    ['75', '73', '74', '61', '72', '00', '30', '30'],
    ['75', '73', '74', '61', '72', '20', '20', '00']
  ],
  'tox': [
    ['74', '6f', '78', '33']
  ],
  'mlv': [
    ['4d', '4c', '56', '49']
  ],
  'windowsupdate': [
    ['44', '43', '4d', '01', '50', '41', '33', '30']
  ],
  '7z': [
    ['37', '7a', 'bc', 'af', '27', '1c']
  ],
  'xz': [
    ['fd', '37', '7a', '58', '5a', '00', '00']
  ],
  'tar.xz': [
    ['fd', '37', '7a', '58', '5a', '00', '00']
  ],
  'lz2': [
    ['04', '22', '4d', '18']
  ],
  'cab': [
    ['4d', '53', '43', '46']
  ],
  'mkv': [
    ['1a', '45', 'df', 'a3']
  ],
  'mka': [
    ['1a', '45', 'df', 'a3']
  ],
  'mks': [
    ['1a', '45', 'df', 'a3']
  ],
  'mk3d': [
    ['1a', '45', 'df', 'a3']
  ],
  'webm': [
    ['1a', '45', 'df', 'a3']
  ],
  'dcm': [
    ['44', '49', '43', '4d']
  ],
  'xml': [
    ['3c', '3f', '78', '6d', '6c', '20']
  ],
  'wasm': [
    ['00', '61', '73', '6d']
  ],
  'lep': [
    ['cf', '84', '01']
  ],
  'swf': [
    ['43', '57', '53'],
    ['46', '57', '53']
  ],
  'deb': [
    ['21', '3c', '61', '72', '63', '68', '3e']
  ],
  'rtf': [
    ['7b', '5c', '72', '74', '66', '31']
  ],
  'm2p': [
    ['00', '00', '01', 'ba']
  ],
  'vob': [
    ['00', '00', '01', 'ba']
  ],
  'mpg': [
    ['00', '00', '01', 'ba']
  ],
  'mpeg': [
    ['00', '00', '01', 'ba'],
    ['47'],
    ['00', '00', '01', 'b3']
  ]
};

class SGet { /* a single threading get */
  constructor({
    observe,
    offset // append this bytes offset to disk calls
  }) {
    this.observe = {
      connected() {},
      disk() {},
      warning() {},
      ...observe
    };
    this.size = 0;
    this.offset = offset || 0;
    // if provided, the download is aborted when the content size passes this value
    this['max-size'] = 0;
  }
  async fetch(link, {
    headers = {}
  }) {
    const controller = this.controller = new AbortController();
    const response = await fetch(link, {
      headers,
      credentials: 'include',
      signal: controller.signal
    });
    this.observe.connected(response);
    const reader = response.body.getReader();
    for (;;) {
      await this.wait();
      const {done, value} = await reader.read();
      if (value && value.byteLength) {
        if (this['max-size']) {
          if (this.size < this['max-size']) {
            const ok = this.size + value.byteLength <= this['max-size'];
            const o = {
              buffer: ok ? value : value.slice(0, this['max-size'] - this.size),
              offset: this.offset + this.size
            };
            this.observe.disk(o);
            this.size += o.buffer.byteLength;
            if (ok === false) {
              controller.abort();
              break;
            }
          }
          else {
            this.observe.warning('Still fetching data which is not needed');
          }
        }
        else {
          this.observe.disk({
            buffer: value,
            offset: this.offset + this.size
          });
          this.size += value.byteLength;
        }
      }
      if (done) {
        break;
      }
    }
    return this.size;
  }
  wait() {
    return Promise.resolve();
  }
  abort() {
    this.controller.abort();
  }
  policy(method, value) {
    if (method === 'abort-when-size-exceeds') {
      if (value < this.size) {
        throw Error('Download size exceeds the requested size.');
      }
      this['max-size'] = value;
    }
  }
}
class MGet { /* extends multi-threading */
  constructor({
    configs = {},
    observe = {}
  }) {
    // keeps track of active ranges
    this.ranges = [];
    // active gets
    const me = this;
    this.gets = new class extends Set {
      delete(o) {
        super.delete(o);
        observe.threads(this.size);
      }
      new(...args) {
        const get = new class extends SGet {
          wait() {
            return me.wait();
          }
        }(...args);
        super.add(get);
        observe.threads(this.size);
        return get;
      }
    }();

    let paused = true;
    this.properties = {
      'errors': 0, // total number of sequential fails
      'downloaded': 0, // number of bytes that is written to the disk
      'size': 0 // file-size returned by the server,
    };
    // current downloading status
    Object.defineProperty(this.properties, 'paused', {
      get() {
        return paused;
      },
      set(bol) {
        if (paused !== bol) {
          paused = bol;
          observe.paused(bol);
        }
      }
    });
    this.configs = {
      'max-number-of-threads': 5,
      'max-retires': 10,
      'use-native-when-possible': true,
      'min-segment-size': 1 * 1024 * 1024,
      'max-segment-size': 100 * 1024 * 1024, // max size for a single downloading segment
      'absolute-max-segment-size': 100 * 1024 * 1024, // no thread size can exceed this value
      'overwrite-segment-size': true, // if true, the segment size will be decided when headers received
      ...configs
    };
    this.observe = observe = {
      headers() {}, // called when number of active threads changed
      threads() {}, // called when number of active threads changed
      disk() {}, // called when write is required
      paused() {}, // called when pause status changes
      complete() {}, // called when downloading ends with or without errors
      error() {}, // called on broken channel
      ...observe
    };
  }
  // use this function to pause network access on all threads
  wait() {
    return Promise.resolve();
  }
  finish(status, error) {
    this.observe.complete(status, error);
  }
  disk(o) {
    this.properties.downloaded += o.buffer.byteLength;
    if (this.properties.downloaded === this.properties.size) {
      this.properties.paused = true;
      this.finish(true);
    }
    else if (this.properties.downloaded > this.properties.size) {
      this.pause();
      this.finish(false, Error('downloaded size exceeds file size'));
    }
  }
  /*
    get the first available range
    size: file size; max: max range size; reserved: array of bytes that already fetched
  */
  range(size = this.properties.size - 1, max = this.configs['max-segment-size'], reserved = this.ranges) {
    let cursor = 0;
    let offset = 0;
    for (;;) {
      if (offset > size) {
        return;
      }
      else if (reserved[cursor] && reserved[cursor][0] - offset < max) {
        if (reserved[cursor][0] > offset) {
          const range = [offset, reserved[cursor][0] - 1];
          reserved.splice(cursor, 0, range);
          return range;
        }
        offset = reserved[cursor][1] + 1;
        cursor += 1;
      }
      else {
        const range = [offset, Math.min(size, offset + max)];
        reserved.splice(cursor, 0, range);
        return range;
      }
    }
  }
  /* does servers supports threading */
  support(response) {
    const size = Number(response.headers.get('Content-Length'));
    if (!size) {
      return 'FATAL: server does not report size';
    }
    this.properties.size = size;
    const type = response.headers.get('Accept-Ranges');
    if (type !== 'bytes') {
      return 'FATAL: "Accept-Ranges" header is ' + type;
    }
    if (response.headers.get['Length-Computable'] === 'false') {
      return 'FATAL: "Length-Computable" header is false';
    }
  }
  /* fix the range associate with a broken get */
  fix(range, size) {
    const index = this.ranges.indexOf(range);
    if (size) {
      this.ranges[index][1] = this.ranges[index][0] + size - 1;
    }
    else {
      this.ranges.splice(index, 1);
    }
  }
  fixConfigs() {
    const {configs, properties} = this;

    if (configs['overwrite-segment-size']) {
      configs['max-segment-size'] = Math.max(
        configs['min-segment-size'],
        Math.floor((properties.size - properties.downloaded) / configs['max-number-of-threads'])
      );
    }
    configs['max-segment-size'] = Math.min(
      configs['max-segment-size'],
      configs['absolute-max-segment-size']
    );
  }
  headers(response) {
    this.observe.headers(response);
  }
  /* staring point for new downloads only */
  async fetch(link, headers = {}) {
    const {gets, properties, observe} = this;
    properties.link = link;
    properties.headers = headers;
    const get = gets.new({
      observe: {
        disk: o => this.disk(o),
        connected: response => {
          const e = this.support(response);
          if (e) {
            this.pause();
            return this.finish(false, Error(e));
          }
          // everything looks fine. Let's fix max-segment-size
          this.fixConfigs();
          // Let's do threading
          range = this.range();
          // break this initial get at the end of the first range
          get.policy('abort-when-size-exceeds', range[1] + 1);
          this.thread();
          this.headers(response);
        }
      }
    });
    properties.paused = false;
    let range;
    try {
      await get.fetch(link, {headers});
      if (get.size !== range[1] - range[0] + 1) {
        this.fix(range, get.size);
        console.warn('Received size is not equal to the requested size; segment might be corrupted', range, get.size);
      }
    }
    catch (e) {
      this.fix(range, get.size);
      // if nothing is downloaded from the initial segment, stop
      if (properties.paused === false) {
        observe.error(e);
        if (properties.downloaded === 0) {
          properties.paused = true;
          this.finish(false, e);
        }
      }
    }
    gets.delete(get);
    if (properties.paused === false) {
      this.thread();
    }
  }
  /* check to see if we can add a new thread or not */
  async thread() {
    const {observe, gets, properties, configs} = this;

    if (gets.size >= configs['max-number-of-threads']) { // max reached
      return;
    }
    if (properties.errors > configs['max-retires']) { // max retries
      if (gets.size === 0) {
        properties.paused = true;
        this.finish(false, Error('max retires reached'));
      }
      return;
    }
    if (properties.paused) { // paused state
      return;
    }
    if (properties.downloaded > properties.size) { // max retries
      properties.paused = true;
      this.finish(false, Error('filesize is smaller than downloaded sections'));
      return;
    }
    const range = this.range();
    if (!range) { // no segment left
      if (gets.size === 0) {
        properties.paused = true;
        if (properties.downloaded === properties.size) {
          this.finish(true);
        }
        else {
          this.finish(false, Error('no range left and there is no ongoing thread'));
        }
      }
      return;
    }
    const get = gets.new({
      offset: range[0],
      observe: {
        disk: o => this.disk(o),
        connected: response => {
          if (response.ok && response.status === 206) {
            this.thread();
            // since we have a new connection clear the errors count
            properties.errors = 0;
          }
          else if (response.status !== 206) {
            this.pause();
            this.finish(false, Error('response type of a segmented request is not 206'));
          }
        }
      }
    });
    // python servers sometimes return more bytes
    get.policy('abort-when-size-exceeds', range[1] - range[0] + 1);
    // clone the fetch options and append range value
    try {
      await get.fetch(properties.link, {
        headers: {
          ...properties.headers,
          Range: 'bytes=' + range.join('-')
        }
      });
      if (get.size !== range[1] - range[0] + 1) {
        // example https://developer.apple.com/streaming/examples/advanced-stream-fmp4.html
        console.warn('Received size is not equal to the requested size; segment might be corrupted', range, get.size);
        this.fix(range, get.size);
      }
    }
    catch (e) {
      if (properties.paused === false) {
        properties.errors += 1;
        observe.error(e);
      }
      // fix the range after broken pipe exited
      this.fix(range, get.size);
    }
    gets.delete(get);
    this.thread();
  }
  increase() {
    this.configs['max-number-of-threads'] = Math.min(10, this.configs['max-number-of-threads'] + 1);
    this.thread();
  }
  decrease() {
    this.configs['max-number-of-threads'] = Math.max(1, this.configs['max-number-of-threads'] - 1);
    const values = this.gets.values();
    const get = values.next().value;
    if (get) {
      get.abort();
    }
  }
  pause() {
    this.properties.paused = true;
    for (const get of this.gets) {
      get.abort();
    }
  }
  resume() {
    const {properties} = this;
    properties.paused = false;
    properties.errors = 0;
    // revisit segment size
    this.fixConfigs();
    this.thread();
  }
}
class MSGet extends MGet { /* extends speed calculation */
  constructor(...args) {
    super(...args);

    this.properties.stats = {}; // keep stat objects for each pause period
    this.properties.times = []; // keep stat objects for each pause period
  }
  disk(o) {
    const {configs, properties: {times, stats}} = this;
    const time = (Date.now() / 1000).toFixed(0).toString();

    if (times.indexOf(time) === -1) {
      times.push(time);
      stats[time] = 0;
      for (const time of times.splice(0, times.length - configs['speed-over-seconds'])) {
        delete stats[time];
      }
    }
    stats[time] += o.buffer.byteLength;

    super.disk(o);
  }
  resume() {
    this.properties.stats = {};
    this.properties.times = [];
    super.resume();
  }
  fixConfigs() {
    const {configs} = this;
    configs['speed-over-seconds'] = configs['speed-over-seconds'] || 10;
    super.fixConfigs();
  }
  speed() {
    const bytes = Object.values(this.properties.stats);
    return bytes.length ? bytes.reduce((p, c) => p + c, 0) / bytes.length : 0;
  }
  progress() {
    const {size, downloaded} = this.properties;
    return (downloaded / size * 100).toFixed(1);
  }
}
class FGet extends MSGet { /* extends write to disk */
  constructor(...args) {
    super(...args);
    Object.assign(this.properties, {
      'disk-instances': 0,
      'disk-caches': [], // temporary storage until disk is ready
      'disk-resolves': [] // resolve this array when disk write is ok
    });
  }
  disk(o) {
    this.properties['disk-caches'].push(o);
    this.diskWrite();
    super.disk(o);
  }
  // write to disk
  async diskWrite() {
    const {configs, properties} = this;
    const file = properties.file || {
      opened: false
    };
    if (properties['disk-instances'] >= configs['max-simultaneous-writes'] || file.opened === false) {
      return;
    }
    if (properties['disk-caches'].length === 0 && properties['disk-resolves'].length === 0) {
      if (properties['disk-instances'] === 0 && properties.completed) {
        file.ready = true;
        super.finish(...properties.completed);
      }
      return;
    }
    // empty resolve list
    let resolve;
    while (resolve = properties['disk-resolves'].shift()) {
      resolve();
    }
    properties['disk-instances'] += 1;
    const objs = [];
    while (properties['disk-caches'].length) {
      objs.push(properties['disk-caches'].pop());
    }
    await file.chunks(...objs).catch(e => this.diskError(e));
    properties['disk-instances'] -= 1;
    this.diskWrite();
  }
  diskError(e) {
    this.pause();
    super.finish(false, e);
  }
  // postpone "super.finish" until disk writing is over
  finish(status, error) {
    const {properties} = this;
    const file = properties.file || {
      opened: false
    };
    if (status === false) {
      super.finish(status, error);
    }
    else if (properties['disk-caches'].length === 0 && properties['disk-instances'] === 0 && file.opened) { // make sure file is opened
      file.ready = true;
      super.finish(status, error);
    }
    else {
      this.properties.completed = [status, error];
      this.diskWrite();
    }
  }
  headers(response) {
    const {properties, configs} = this;
    let file = properties.file;
    // open file when headers are ready and check disk space
    if (properties.file === undefined) {
      file = properties.file = new File();
    }
    // open file
    file.open().catch(e => this.diskError(e)).then(() => {
      this.diskWrite();
      // if file is restored, there is no need to add a new meta data
      if (properties.restored !== false) {
        file.meta({
          link: properties.link,
          configs
        });
      }
    });
    // check disk space
    file.space(properties.size).catch(e => this.diskError(e));

    super.headers(response);
  }
  fixConfigs() {
    super.fixConfigs();
    const {configs} = this;
    configs['max-simultaneous-writes'] = configs['max-simultaneous-writes'] || 1;
    // pause all network activities until this value meets
    configs['max-number-memory-chunks'] = configs['max-number-memory-chunks'] || 20;
  }
  wait() {
    const {properties, configs} = this;
    return new Promise(resolve => {
      if (properties['disk-caches'].length > configs['max-number-memory-chunks']) {
        properties['disk-resolves'].push(resolve);
      }
      else {
        resolve();
      }
    });
  }
  /* download the file to user disk (only call when there is no instance left) */
  async download(options, started) {
    const {properties: {file, filename, fileextension, mime, size}} = this;
    if (file.ready && file.opened) {
      const download = async () => {
        await file.download({
          'filename': options.filename || (fileextension ? filename + '.' + fileextension : filename) || 'unknown',
          'mime': options.mime || mime
        }, started);
        await file.remove();
      };
      if (options.verify) {
        const {ranges, downloaded} = await file.ranges();
        if (downloaded === size && ranges.length === 1) {
          return await download();
        }
      }
      else {
        return await download();
      }
      throw Error('File cannot be verified');
    }
    throw Error('File is not ready');
  }
}
class NFGet extends FGet { /* extends filename guessing */
  fixConfigs() {
    const {configs} = this;
    if (configs['use-magic-bytes'] === undefined) {
      configs['use-magic-bytes'] = true;
    }
    super.fixConfigs();
  }
  guess(headers) {
    const disposition = headers.get('Content-Disposition');
    const mime = headers.get('Content-Type').split(';')[0];

    let filename = this.properties.filename || '';
    // get name from Content-Disposition
    if (!filename && disposition) {
      const tmp = /filename\*=UTF-8''([^;]*)/.exec(disposition);
      if (tmp && tmp.length) {
        filename = tmp[1].replace(/["']$/, '').replace(/^["']/, '');
        filename = decodeURIComponent(filename);
      }
    }
    if (!filename && disposition) {
      const tmp = /filename=([^;]*)/.exec(disposition);
      if (tmp && tmp.length) {
        filename = tmp[1].replace(/["']$/, '').replace(/^["']/, '');
      }
    }
    if (disposition && filename) {
      const arr = [...filename].map(v => v.charCodeAt(0)).filter(v => v <= 255);
      filename = (new TextDecoder('UTF-8')).decode(Uint8Array.from(arr));
    }
    // get name from URL
    if (!filename) {
      const url = this.properties.link.replace(/\/$/, '');
      const tmp = /(title|filename)=([^&]+)/.exec(url);
      if (tmp && tmp.length) {
        filename = tmp[2];
      }
      else {
        filename = url.substring(url.lastIndexOf('/') + 1);
      }
      filename = decodeURIComponent(filename.split('?')[0].split('&')[0]);
    }
    // extracting extension from file name
    const se = /\.\w{2,}$/.exec(filename);
    const fileextension = se && se.length ? se[0].substr(1) : MIME_TYPES[mime];
    if (fileextension) {
      const index = filename.lastIndexOf('.' + fileextension);
      if (index !== -1) {
        filename = filename.substr(0, index);
      }
    }
    // removing exceptions
    filename = filename.replace(/[\\/:*?"<>|"]/g, '-');
    // removing trimming white spaces
    filename = filename.trim();
    filename = filename || 'unknown';

    return {filename, fileextension};
  }
  // extract file extension from actual binary
  magic(buffer) {
    const hex = [...buffer].map(h => ('00' + h.toString(16)).substr(-2));

    for (const [extension, buffers] of Object.entries(MAGIC_BYTES)) {
      for (const b of buffers) {
        for (let i = 0; i < b.length && i < buffer.byteLength; i += 1) {
          if (b[i] !== '?') {
            if (hex[i] !== b[i]) {
              break;
            }
            else if (hex[i] === b[i] && i === b.length - 1) {
              return extension;
            }
          }
        }
      }
    }
  }
  headers(response) {
    Object.assign(this.properties, this.guess(response.headers), {
      mime: response.headers.get('Content-Type')
    });
    super.headers(response);
  }
  disk(o) {
    const {properties, configs} = this;
    if (o.offset === 0 && configs['use-magic-bytes'] && o.buffer.byteLength > 10 && !properties.fileextension) {
      const extension = this.magic(o.buffer);
      if (extension) {
        properties.fileextension = extension;
        if (!properties.mime) {
          for (const [mime, e] of Object.entries(MIME_TYPES)) {
            if (extension === e || mime.endsWith(extension)) {
              properties.mime = mime;
              break;
            }
          }
        }
        properties.mime = properties.mime || 'text/' + extension;
      }
    }
    super.disk(o);
  }
}
class SNGet extends NFGet { /* extends session restore */
  /* id = get.properties.file.id */
  async restore(id) {
    const file = new File(id);
    this.properties.file = file;
    await file.open();
    const properties = {};
    this.properties.restored = false;

    for (const o of await file.properties()) {
      Object.assign(properties, o);
    }
    this.properties.link = properties.link;
    if (properties.link === undefined) {
      throw Error('Cannot find link address');
    }
    if (properties.configs) {
      Object.assign(this.configs, properties.configs);
    }
    // restore response (optional)
    try {
      const controller = this.controller = new AbortController();
      const response = await fetch(properties.link, {
        signal: controller.signal
      });
      if (response.ok) {
        controller.abort();
        const message = this.support(response);
        if (message) {
          throw Error(message);
        }
        this.headers(response);
      }
    }
    catch (e) {
      console.warn('Cannot restore headers. Will try on resume');
    }
  }
  async resume() {
    const {properties} = this;
    // this causes the UI to change to in_progress so that the user is not clicking on the resume button multiple times
    properties.paused = false;
    try {
      // seems like the filesize is not yet resolved, lets get head one more time
      if (!properties.size) {
        // restore response
        const controller = this.controller = new AbortController();
        const response = await fetch(properties.link, {
          signal: controller.signal
        });
        if (response.ok) {
          controller.abort();
          const message = this.support(response);
          if (message) {
            throw Error(message);
          }
          this.headers(response);
        }
        else {
          throw Error('Cannot connect to the server');
        }
      }
      if (properties.restored === false) {
        // restore ranges
        const {ranges, downloaded} = await properties.file.ranges();
        this.properties.downloaded = downloaded;
        this.ranges = ranges;
        delete properties.restored;
      }
    }
    catch (e) {
      properties.paused = true;
      this.finish(false, Error('cannot resume, ' + e.message));
    }
    super.resume();
  }
}
window.Get = SNGet;
