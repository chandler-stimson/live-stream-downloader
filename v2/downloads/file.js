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
  constructor(id = 'file:' + Math.random(), memory = false) {
    this.id = id;
    this.opened = false;
    this.memory = memory;

    this.connections = {};
    chrome.runtime.onConnect.addListener(port => {
      if (this.connections[port.name]) {
        this.connections[port.name](port);
      }
    });
  }
  async space(size) {
    const {quota, usage} = await navigator.storage.estimate();
    if (quota - usage < size) {
      throw Error(`FATAL: requested filesize is "${size}", but granted filesize is "${quota - usage}"`);
    }
  }
  async open() {
    const alternative = e => {
      console.warn('Cannot use IndexedDB database, use memory instead', e);
      this.cache = {
        meta: [],
        chunks: []
      };
      this.opened = true;
    };
    return new Promise((resolve, reject) => {
      // file is ready
      if (this.db || this.cache) {
        resolve();
      }
      else if (this.memory) {
        throw Error('per user request');
      }
      else {
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
      }
    }).catch(alternative);
  }
  meta(...objs) {
    return new Promise((resolve, reject) => {
      if (this.db) {
        const transaction = this.db.transaction('meta', 'readwrite');
        transaction.oncomplete = resolve;
        transaction.onerror = e => reject(Error('File.meta, ' + e.target.error));
        for (const obj of objs) {
          transaction.objectStore('meta').add(obj);
        }
      }
      else {
        this.cache.meta.push(...objs);
        resolve();
      }
    });
  }
  properties() {
    // get data and convert to blob
    return new Promise((resolve, reject) => {
      if (this.db) {
        const transaction = this.db.transaction('meta', 'readonly');
        const store = transaction.objectStore('meta');
        const meta = store.getAll();
        meta.onsuccess = function() {
          resolve(meta.result);
        };
        meta.onerror = e => reject(Error('File.properties, ' + e.target.error));
      }
      else {
        resolve([]);
      }
    });
  }
  chunks(...objs) {
    return new Promise((resolve, reject) => {
      if (this.db) {
        const transaction = this.db.transaction('chunks', 'readwrite');
        transaction.oncomplete = resolve;
        transaction.onerror = e => reject(Error('File.chunks, ' + e.target.error));
        for (const obj of objs) {
          transaction.objectStore('chunks').add(obj);
        }
      }
      else {
        this.cache.chunks.push(...objs);
        resolve();
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
  decrypt(key, chunk) { // key = {value, iv, method}
    key.iv = key.iv && key.iv.length ? (new Uint8Array(key.iv)).buffer : new ArrayBuffer(16);
    key.value = (new Uint8Array(key.value)).buffer;

    return new Promise((resolve, reject) => {
      if (key.method === 'AES-128') {
        crypto.subtle.importKey('raw', key.value, {
          name: 'AES-CBC',
          length: 128
        }, false, ['decrypt']).then(importedKey => crypto.subtle.decrypt({
          name: 'AES-CBC',
          iv: key.iv
        }, importedKey, chunk.buffer)).then(resolve, reject);
      }
      else {
        reject(Error(`"${key.method}" encryption is not supported`));
      }
    });
  }
  count() {
    return new Promise((resolve, reject) => {
      if (this.db) {
        const transaction = this.db.transaction('chunks', 'readonly');
        const store = transaction.objectStore('chunks');
        const request = store.count();
        request.onsuccess = () => resolve(request.result);
        request.onerror = e => reject(Error('File.count, ' + e.target.error));
      }
      else {
        resolve(this.cache.chunks.length);
      }
    });
  }
  stream(options, progress = () => {}) {
    const chunks = [];
    const length = options.offsets.length;
    const size = () => {
      if (options.keys && options.keys.length) {
        return -1 * (options.offsets.shift() - options.offsets[0]);
      }
      else { // do not create buffer when file is not encrypted
        return 0;
      }
    };
    const mo = { // keep chunks in memory until length meet the size for decryption
      buffer: options.keys && options.keys.length ? new Uint8Array(size()) : new Uint8Array(0),
      key: options.keys && options.keys.length ? options.keys[0] : null,
      offset: 0
    };
    let resolve = () => {};
    let reject = () => {};
    let request = {};
    let error = '';

    const decrypt = chunk => {
      try {
        mo.buffer.set(chunk, mo.offset);
      }
      catch (e) {
        error = e;
        reject(e);
      }
      mo.offset += chunk.byteLength;

      if (mo.offset === mo.buffer.byteLength) {
        this.decrypt(mo.key, mo.buffer).then(ab => {
          chunks.push(new Uint8Array(ab));
          if (options.offsets.length === 0) {
            decrypt.readyState = 'done';
          }
          resolve();
        }).catch(e => {
          error = e;
          reject(e);
        });
        // reset buffer
        mo.key = options.keys[length - options.offsets.length];
        mo.buffer = new Uint8Array(size());
        mo.offset = 0;
      }
    };
    decrypt.readyState = options.keys && options.keys.length ? 'pending' : 'done';

    if (this.db) {
      const encrypted = options.keys && options.keys.length;
      const transaction = this.db.transaction('chunks', 'readonly');
      request = transaction.objectStore('chunks').openCursor();
      request.onsuccess = e => {
        const cursor = e.target.result;
        if (cursor) {
          if (encrypted) {
            decrypt(cursor.value.buffer);
          }
          else {
            chunks.push(cursor.value.buffer);
            resolve();
          }
          cursor.continue();
        }
        else if (encrypted && decrypt.readyState === 'done') {
          resolve();
        }
        else if (!encrypted) {
          resolve();
        }
      };
      transaction.onerror = e => {
        error = new Error(e.target.error);
        reject(error);
      };
    }
    else {
      this.cache.chunks.sort((a, b) => a.offset - b.offset).forEach(o => {
        if (options.keys && options.keys.length) {
          decrypt(o.buffer);
        }
        else {
          chunks.push(o.buffer);
        }
      });
      request.readyState = 'done';
      if (resolve) {
        resolve();
      }
    }
    return new ReadableStream({
      pull(controller) {
        if (error) {
          throw error;
        }
        else if (chunks.length) {
          const chunk = chunks.shift();
          progress();
          controller.enqueue(chunk);
        }
        else if (request.readyState === 'done' && decrypt.readyState === 'done') {
          controller.close();
        }
        else {
          return new Promise((res, rej) => {
            resolve = res;
            reject = rej;
          }).then(() => {
            const chunk = chunks.shift();
            if (chunk) {
              progress();
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
  store({url, filename}) {
    const d = options => new Promise((resolve, reject) => chrome.downloads.download(options, id => {
      const lastError = chrome.runtime.lastError;
      if (lastError) {
        return reject(lastError);
      }
      resolve(id);
    }));
    return d({
      url,
      filename: filename || 'unknown'
    }).catch(() => d({ // in case the filename is not valid, just pass the URL
      url
    }));
  }
  async download(options, started = () => {}) {
    if (options.dialog) {
      const width = 500;
      const height = 200;
      const left = screen.availLeft + Math.round((screen.availWidth - width) / 2);
      const top = screen.availTop + Math.round((screen.availHeight - height) / 2);

      const code = await new Promise(resolve => {
        this.connections[this.id] = port => {
          port.onMessage.addListener(request => {
            if (request.method === 'close-db') {
              if (this.db) {
                this.db.close();
              }
            }
            else if (request.method === 'count') {
              this.count().then(count => port.postMessage({
                method: 'count',
                count
              }));
            }
            else if (request.method === 'closed') {
              resolve(request.code);
            }
          });
        };
        chrome.windows.create({
          url: chrome.extension.getURL('/downloads/save-dialog/index.html') +
            '?id=' + this.id + '&options=' + encodeURIComponent(JSON.stringify(options)),
          width,
          height,
          left,
          top,
          type: 'popup'
        });
      });
      if (code === 0) {
        started(-1);
        return Promise.resolve();
      }
    }

    const stream = this.stream(options);
    const response = new Response(stream, {
      headers: {
        'Content-Type': options.mime || 'text/plain'
      }
    });
    const blob = await response.blob();
    const url = URL.createObjectURL(blob);

    return this.store({
      url,
      filename: options.filename
    }).then(id => new Promise((resolve, reject) => {
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
    }));
  }
  remove() {
    if (this.db) {
      this.db.close();
    }
    if (('databases' in indexedDB) === false) {
      localStorage.removeItem('file:' + this.id);
    }
    return new Promise((resolve, reject) => {
      if (this.db) {
        const request = indexedDB.deleteDatabase(this.id);
        request.onsuccess = () => {
          resolve();
        };
        request.onerror = e => reject(Error(e.target.error));
      }
      else {
        resolve();
      }
    });
  }
}
