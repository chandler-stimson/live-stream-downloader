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

/* transfer the stream only when conditions met */
class PolicyStream extends TransformStream {
  constructor(size, fetched = 0) {
    super({
      async transform(chunk, controller) {
        fetched += chunk.byteLength;

        if (fetched <= size) {
          await controller.enqueue(chunk);
        }
        else {
          await controller.enqueue(chunk.slice(0, size - fetched));
          await controller.terminate();
        }
      }
    });
  }
}

/* use this to get fetch stats */
class StatsStream extends TransformStream {
  constructor(c = () => {}) {
    let offset = 0;
    super({
      transform(chunk, controller) {
        c(chunk, offset);
        offset += chunk.byteLength;
        return controller.enqueue(chunk);
      }
    });
  }
}
self.StatsStream = StatsStream;

/* a simple memory writable stream */
class BasicWriter {
  constructor(id, offset = 0, cache = {}) {
    return new WritableStream({
      start() {},
      write(chunk) {
        cache[id] = cache[id] || [];

        cache[id].push({
          offset,
          chunk
        });
        offset += chunk.byteLength;

        return Promise.resolve();
      }
    }, {});
  }
}
self.BasicWriter = BasicWriter;
self.MemoryWriter = BasicWriter;

/* a basic multi-thread, multi segment Get implementation */
class MGet {
  constructor(options = MGet.OPTIONS) {
    this.options = options;
    this.controller = new AbortController();
    this.actives = 0;
    this.sizes = new Map(); // track segment offsets
    this.cache = {}; // store chunks of each segment in an array
    this.meta = { // name, ext, mime
      'written-size': 0
    };
  }
  /* get called before a segment is started */
  prepare(segment, position) {
    return Promise.resolve();
  }
  /* get called once per new segment */
  headers(segment, position, request, response) {
    return Promise.resolve();
  }
  /* get called when a segment is fully fetched */
  flush(segment, position) {
    return Promise.resolve();
  }
  /* get called when a new chunk is written */
  monitor(segment, position, chunk, offset) {
    // console.info(segment.range.start + offset);
    this.meta['written-size'] += chunk.byteLength;
  }
  /* get called when all segments are fetched */
  fetch(segments, params = {}) {
    return new Promise((resolve, reject) => {
      let position = 0;

      const start = async () => {
        try {
          // a dummy check to see if we can resolve the position of the next segment. If not, ignore this call
          if (segments.length) {
            this.offset(segments[0], position);
          }
          //
          const segment = segments.shift();
          position += 1;

          if (segment) {
            try {
              const p = position - 1;

              await this.prepare(segment, p);
              await this.pipe(segment, params, p, () => {
                // start a new segment if we have a free thread and there are leftover segments
                if (this.number() && segments.length) {
                  start();
                }
              });
              await this.flush(segment, p);
              start();
            }
            catch (e) {
              reject(e);
            }
          }
          else {
            if (this.actives === 0) {
              this.meta.done = true;
              resolve();
            }
          }
        }
        catch (e) {}
      };
      start();
    }).catch(e => {
      console.warn(e);
      this.controller.abort(Error(e?.message || 'Unknown Error'));
      throw e;
    });
  }
  /* returns total number of permitted new network connections */
  number() {
    return Math.max(0, this.options['threads'] - this.actives);
  }
  /* offset from segment */
  offset(segment, position) {
    let offset = 0;
    for (let n = 0; n < position; n += 1) {
      offset += this.sizes.get(n);
      if (isNaN(offset)) {
        throw Error('OFFSET_NOT_RESOLVED_' + n);
      }
    }

    return offset + (segment.range?.start || 0);
  }

  /* returns a valid writable stream */
  writer(segment, position) {
    const offset = this.offset(segment, position);

    const stream = new self.MemoryWriter(position, offset, this.cache);
    return stream;
  }
  /* returns the native fetch */
  async native(request, params, extra = {}) { // extra.save, extra.segment
    const r = await fetch(request, params);
    return r;
  }
  /*
    returns a valid link with arguments from a segment
    {
      uri: 'a.mp4',
      base: 'http://example.com?expires=1212'
    } -> http://example.com/a.mp4?expires=1212
  */
  link(segment) {
    // appending base arguments causes issue. see:
    // https://github.com/chandler-stimson/live-stream-downloader/issues/144
    if (segment.resolvedUri) {
      const {href} = new URL((segment.resolvedUri || segment.uri), segment.base || undefined);
      return href;
    }
    const {href, search} = new URL(segment.uri, segment.base || undefined);
    if (search === '') {
      try {
        const o = new URL(segment.base);
        if (o.search) {
          return href + o.search;
        }
      }
      catch (e) {}
    }

    return href;
  }
  /*
    starts a single thread. If server supports range and size is greater than 'thread-size', runs multiple threads
    settled is called when all segments are initiated. This can be used to asynchronously call other pipes if necessary
  */
  pipe(segment, params, position = 0, settled = () => {}) {
    const href = this.link(segment);

    const request = new Request(href, {
      method: segment.method || 'GET'
    });
    if (segment.range) {
      request.headers.append('Range', `bytes=${segment.range.start}-${segment.range.end}`);
    }
    else {
      // some servers perform better with ranged requests (some return less bytes, so we cannot use this)
      // request.headers.append('Range', `bytes=0-`);
    }

    this.actives += 1;
    const extra = {
      save: segment.cache,
      segment
    };
    return this.native(request, {
      ...params,
      signal: this.controller.signal,
      credentials: 'include'
    }, extra).then(r => {
      const sizes = [];
      if (r.headers.has('Content-Length')) {
        sizes.push(r.headers.get('Content-Length'));
      }
      // the server might only return Content-Range or the size returned by content size is limited to a segment
      if (r.headers.has('Content-Range')) {
        const [ss, se, sr] = r.headers.get('Content-Range').replace('bytes ', '').split(/[-/]/);

        // server
        if (ss === '0' && se) {
          sizes.push(sr);
          const v = Number(se) - Number(ss) + 1;
          if (this.options['thread-size'] > v) {
            this.options['thread-size'] = v;
            console.info('LOWERING_THREAD_SIZE', v);
          }
        }
        else if (ss && se) {
          sizes.push((Number(se) - Number(ss) + 1));
        }
        else {
          sizes.push(sr);
        }
      }
      const encoding = r.headers.get('Content-Encoding');


      // Size is the maximum of whatever is returned by 'Content-Length' and 'Content-Range'
      // for gzip, to prevent PIPE_SIZE_MISMATCH;
      const ss = sizes.map(Number).filter(s => !isNaN(s));
      const s = ss.length ? Math.max(...ss) : '';
      const size = isNaN(s) || encoding === 'gzip' ? 0 : Number(s);

      if (r.ok && this.sizes.has(position) === false) {
        if (size) { // only save size if there is a header for it
          this.sizes.set(position, size);
        }
        this.headers(segment, position, request, r);
      }
      const writable = this.writer(segment, position);

      const type = r.headers.get('Accept-Ranges');
      const computable = r.headers.get('Length-Computable');

      if (r.ok && segment.range && r.status !== 206) {
        throw Error('NO_RANGE_SUPPORT_' + r.status);
      }
      else if (r.ok) {
        // server supports range
        const rangable = size && (
          (type === 'bytes' && computable !== 'false') || r.status === 206
        );

        if (rangable && size > this.options['thread-size']) {
          segment.extraThreads = segment.extraThreads || new Set();

          return new Promise((resolve, reject) => {
            let start = segment.range?.start || 0;
            const end = segment.range?.end || size - 1;

            // prepare other ranges
            const ranges = [];
            for (;;) {
              start += this.options['thread-size'];
              if (start < (segment.range?.end || size)) {
                ranges.push(start);
              }
              else {
                break;
              }
            }

            // start the first part -> .pipeThrough(timeout)
            const policy = new PolicyStream(this.options['thread-size']);
            segment.range = { // this is useful for error recovery
              start: 0,
              end: this.options['thread-size'],
              complex: true
            };
            const monitor = new StatsStream((chunk, offset) => {
              this.monitor(segment, position, chunk, offset);
            });

            const oResponse = r.body.pipeThrough(policy).pipeThrough(monitor).pipeTo(writable)
              .then(() => {
                this.actives -= 1;
                more();
              }, e => {
                reject(e);
                more();
              });
            // start other parts
            const more = () => {
              const ns = this.number();
              for (let n = 0; n < ns; n += 1) {
                const start = ranges.shift();
                if (start) {
                  const exResponse = this.pipe({ // do not pass the "settled" method to the subsequent pipes
                    ...segment,
                    range: {
                      start,
                      end: Math.min(start + this.options['thread-size'] - 1, end)
                    }
                  }, params, position).then(() => {
                    segment.extraThreads.delete(exResponse);
                    more();
                  }).catch(e => {
                    segment.extraThreads.delete(exResponse);
                    reject(e);
                  });
                  segment.extraThreads.add(exResponse);
                }
                else {
                  break;
                }
              }
              if (ranges.length === 0 && segment.extraThreads.size === 0) {
                oResponse.finally(() => resolve());
              }
              settled();
              settled = () => {};
            };
            more();
          });
        }
        else {
          settled();
          // if server does not return the segment size
          let s = 0;
          const monitor = new StatsStream((chunk, offset) => {
            s += chunk.byteLength;

            this.monitor(segment, position, chunk, offset);
          });

          return r.body.pipeThrough(monitor).pipeTo(writable).then(() => {
            if (this.sizes.has(position) === false) { // save the extracted size for later use
              console.info('SET_SIZE', position, s);
              this.sizes.set(position, s);
            }
            else if (s !== size) {
              console.error('PIPE_SIZE_MISMATCH', s, size, segment.range, r);
              throw Error('PIPE_SIZE_MISMATCH');
            }
            this.actives -= 1;
          });
        }
      }
      else {
        throw Error('STATUS_' + r.status);
      }
    }).catch(e => {
      this.actives -= 1;
      throw e;
    });
  }
}
MGet.OPTIONS = {
  'thread-size': 3 * 1024 * 1024, // bytes; size of each segment (do not increase unless check with a large file)
  // thread-timeout: ms for inactivity period before breaking. Do not use small value since it is also used for
  // downloading from server that does not support ranging
  'thread-timeout': 10000, // ms
  'thread-initial-timeout': 10000, // ms
  'error-tolerance': 30, // number of times a single uri can throw error before breaking
  'error-delay': 300, // ms; min-delay before restarting the segment
  'threads': 2, // number; max number of simultaneous threads
  'next-segment-wait': 2000 // ms; time to wait after a segment is started, before considering the next segment,
};

self.MyGet = MGet;
