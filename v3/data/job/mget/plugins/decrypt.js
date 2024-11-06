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

/*
  write to "basic-cache" instead of "cache" using "BasicWriter"
  on flush, writes to the "cache" using "MemoryWriter"
*/

class DGet extends MyGet {
  constructor(...args) {
    super(...args);

    this['basic-cache'] = {};
    this['decrypted-offset'] = 0;
  }
  static merge(array) {
    // make sure to remove possible duplicated chunks (in case of error, the same chunk if fetched one more time)
    const chunks = {};
    for (const {offset, chunk} of array) {
      if (chunks[offset]) {
        if (chunks[offset].byteLength < chunk.byteLength) {
          chunks[offset] = chunk;
        }
      }
      else {
        chunks[offset] = chunk;
      }
    }
    const offsets = Object.keys(chunks).map(Number);
    offsets.sort((a, b) => a - b);

    return {
      offsets,
      chunks: offsets.map(a => chunks[a])
    };
  }
  writer(segment, position) {
    // only use "basic-cache" when we are dealing with encrypted segment
    if (segment.key) {
      if (segment.key.method.toUpperCase() === 'AES-128') {
        const offset = this.offset(segment, position);
        return new self.BasicWriter(position, offset, this['basic-cache']);
      }
      else {
        throw Error('UNSUPPORTED_ENCRYPTION');
      }
    }
    else {
      return super.writer(segment, position);
    }
  }
  async flush(segment, position) {
    if (segment.key) {
      const {href} = new URL(segment.key.uri, segment.base || segment.uri);
      const r = await this.native(href, {
        'credentials': 'include'
      }, {
        save: true
      });
      if (!r.ok) {
        throw Error('BROKEN_KEY_STATUS_' + r.status);
      }

      const value = await r.arrayBuffer();

      const {offsets, chunks} = DGet.merge(this['basic-cache'][position]);

      delete this['basic-cache'][position];
      const encrypted = await (new Blob(chunks)).arrayBuffer();

      // const iv = segment.key?.iv?.buffer || new ArrayBuffer(16);

      let iv;
      if (segment.key?.iv) {
        iv = segment.key?.iv?.buffer;
      }
      // since the manifest does not provide an IV,
      // HLS.js will automatically generate one based on the segment sequence number
      else {
        const e = new Uint8Array(16);
        for (let r = 12; r < 16; r++) {
          e[r] = (position + 1) >> 8 * (15 - r) & 255;
        }
        iv = e.buffer;
      }

      const decrypted = await crypto.subtle.importKey('raw', value, {
        name: 'AES-CBC',
        length: 128
      }, false, ['decrypt']).then(importedKey => {
        return crypto.subtle.decrypt({
          name: 'AES-CBC',
          iv
        }, importedKey, encrypted);
      });
      // console.info('position mismatch', offsets[0], this['decrypted-offset']);

      // write to the original cache
      const stream = new self.MemoryWriter(position, offsets[0] + this['decrypted-offset'], this.cache);
      const writable = await stream.getWriter();

      await writable.write(new Uint8Array(decrypted));

      // since we write each segment sequentially, we can fix the write position mismatch here
      this['decrypted-offset'] += (decrypted.byteLength - encrypted.byteLength);
    }
    else {
      return;
    }
  }
}

self.MyGet = DGet;
