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

/*
  write to a temp cache instead of "this.cache"
  on close, writes to the "this.cache" using "MemoryWriter"
*/

class DGet extends MyGet {
  writer(segment, position) {
    // only use "basic-cache" when we are dealing with encrypted segment
    if (segment.key) {
      if (segment.key.method.toUpperCase() !== 'AES-128') {
        throw Error('UNSUPPORTED_KEY_' + segment.key.method);
      }

      const offset = this.offset(segment, position);
      const ocache = this.cache;

      const M = class {
        constructor(offset = 0) {
          const cache = [];

          return new WritableStream({
            start() {},
            write(chunk) {
              cache.push({
                offset,
                chunk
              });
              offset += chunk.byteLength;

              return Promise.resolve();
            },
            async close() {
              const {href} = new URL(segment.key.uri, segment.base);

              // try 5 times to get the key
              let value;
              for (let n = 0; ; n += 1) {
                try {
                  value = await fetch(href).then(r => r.arrayBuffer());
                  break;
                }
                catch (e) {
                  if (n < 5) {
                    await new Promise(resolve => setTimeout(resolve, 500));
                  }
                  else {
                    throw Error('FAILED_TO_GET_KEY');
                  }
                }
              }

              const chunks = cache.map(o => o.chunk);
              const encrypted = await (new Blob(chunks)).arrayBuffer();

              const decrypted = await crypto.subtle.importKey('raw', value, {
                name: 'AES-CBC',
                length: 128
              }, false, ['decrypt']).then(importedKey => crypto.subtle.decrypt({
                name: 'AES-CBC',
                iv: new ArrayBuffer(16)
              }, importedKey, encrypted));

              const offset = cache[0].offset;

              const stream = new self.MemoryWriter(position, offset, ocache);
              const writable = await stream.getWriter();
              await writable.write(new Uint8Array(decrypted));
            }
          }, {});
        }
      };

      const stream = new M(offset);
      return stream;
    }
    else {
      return super.writer(segment, position);
    }
  }
}

self.MyGet = DGet;
