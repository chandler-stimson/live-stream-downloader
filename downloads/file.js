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

class File { /* write to disk */
  constructor(id = 'file:' + Math.random()) {
    this.id = id;
    this.opened = false;
  }
  async space(size) {
    const {quota, usage} = await navigator.storage.estimate();
    if (quota - usage < size) {
      throw Error(`FATAL: requested filesize is "${size}", but granted filesize is "${quota - usage}"`);
    }
  }
  async open() {
    return new Promise((resolve, reject) => {
      const request = indexedDB.open(this.id, 1);
      request.onupgradeneeded = () => {
        // TODO - Remove this line when Firefox supports indexedDB.databases()
        if (('databases' in indexedDB) === false) {
          localStorage.setItem('file:' + this.id, true);
        }
        // storage for chunks
        request.result.createObjectStore('chunks', {
          keyPath: 'offset'
        });
        request.result.createObjectStore('meta', {
          autoIncrement: true
        });
      };
      request.onerror = e => reject(Error('File.open, ' + e.target.error));
      request.onsuccess = () => {
        this.db = request.result;
        this.opened = true;
        resolve();
      };
    });
  }
  meta(...objs) {
    return new Promise((resolve, reject) => {
      const transaction = this.db.transaction('meta', 'readwrite');
      transaction.oncomplete = resolve;
      transaction.onerror = e => reject(Error('File.meta, ' + e.target.error));
      for (const obj of objs) {
        transaction.objectStore('meta').add(obj);
      }
    });
  }
  properties() {
    // get data and convert to blob
    return new Promise((resolve, reject) => {
      const transaction = this.db.transaction('meta', 'readonly');
      const store = transaction.objectStore('meta');
      const meta = store.getAll();
      meta.onsuccess = function() {
        resolve(meta.result);
      };
      meta.onerror = e => reject(Error('File.properties, ' + e.target.error));
    });
  }
  chunks(...objs) {
    return new Promise((resolve, reject) => {
      const transaction = this.db.transaction('chunks', 'readwrite');
      transaction.oncomplete = resolve;
      transaction.onerror = e => reject(Error('File.chunks, ' + e.target.error));
      for (const obj of objs) {
        transaction.objectStore('chunks').add(obj);
      }
    });
  }
  async ranges() {
    let downloaded = 0;
    const objects = await new Promise((resolve, reject) => {
      const transaction = this.db.transaction('chunks', 'readonly');
      const chunks = [];
      transaction.objectStore('chunks').openCursor().onsuccess = e => {
        const cursor = e.target.result;
        if (cursor) {
          chunks.push(cursor.value);
          cursor.continue();
        }
      };
      transaction.onerror = e => reject(Error('File.objects, ' + e.target.error));
      transaction.oncomplete = () => resolve(chunks);
    });

    const rRanges = objects.map(a => [a.offset, a.offset + a.buffer.byteLength]);
    rRanges.sort((a, b) => a[0] - b[0]);
    const ranges = [];
    if (rRanges.length === 0) {
      return {ranges, downloaded};
    }
    let start = rRanges[0][0];
    let end = rRanges[0][0];
    rRanges.forEach((range, i) => {
      downloaded += range[1] - range[0];
      if (end === range[0]) {
        end = range[1];
      }
      else {
        ranges.push([start, end - 1]);

        start = rRanges[i][0];
        end = rRanges[i + 1] ? rRanges[i + 1][0] : NaN;
      }
    });
    ranges.push([start, rRanges.pop()[1] - 1]);

    return {ranges, downloaded};
  }
  stream() {
    const chunks = [];
    let resolve;
    const transaction = this.db.transaction('chunks', 'readonly');
    const request = transaction.objectStore('chunks').openCursor();
    request.onsuccess = e => {
      const cursor = e.target.result;
      if (cursor) {
        chunks.push(cursor.value.buffer);
        cursor.continue();
      }
      if (resolve) {
        resolve();
      }
    };
    transaction.onerror = e => {
      throw Error('File.stream, ' + e.target.error);
    };
    return new ReadableStream({
      pull(controller) {
        if (chunks.length) {
          controller.enqueue(chunks.shift());
        }
        else if (request.readyState === 'done') {
          controller.close();
        }
        else {
          return new Promise(r => resolve = r).then(() => {
            const chunk = chunks.shift();
            if (chunk) {
              controller.enqueue(chunk);
            }
            else {
              controller.close();
            }
          });
        }
      }
    }, {});
  }
  async download(options, started = () => {}) {
    const stream = this.stream();
    const response = new Response(stream, {
      headers: {
        'Content-Type': options.mime || 'text/plain'
      }
    });
    const blob = await response.blob();
    const url = URL.createObjectURL(blob);

    return new Promise((resolve, reject) => {
      chrome.downloads.download({
        url,
        filename: options.filename || 'unknown'
      }, id => {
        chrome.downloads.search({
          id
        }, ([d]) => started(d));
        function observe(d) {
          if (d.id === id && d.state) {
            if (d.state.current === 'complete' || d.state.current === 'interrupted') {
              chrome.downloads.onChanged.removeListener(observe);
              URL.revokeObjectURL(url);
              if (d.state.current === 'complete') {
                chrome.downloads.search({id}, ([d]) => {
                  if (d) {
                    resolve(d);
                  }
                  else {
                    reject(Error('I am not able to find the downloaded file!'));
                  }
                });
              }
              else {
                reject(Error('The downloading job got interrupted'));
              }
            }
          }
        }
        chrome.downloads.onChanged.addListener(observe);
      });
    });
  }
  remove() {
    if (this.db) {
      this.db.close();
    }
    if (('databases' in indexedDB) === false) {
      localStorage.removeItem('file:' + this.id);
    }
    return new Promise((resolve, reject) => {
      const request = indexedDB.deleteDatabase(this.id);
      request.onsuccess = () => {
        resolve();
      };
      request.onerror = e => reject(Error(e.target.error));
    });
  }
}
