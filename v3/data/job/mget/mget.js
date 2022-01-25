/* transfer the stream only when conditions met */
class PolicyStream extends window.TransformStream {
  constructor(size) {
    let fetched = 0;
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
class StatsStream extends window.TransformStream {
  constructor(c = () => {}) {
    super({
      transform(chunk, controller) {
        c(chunk.byteLength);
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
  }
  /* get called before a segment is started */
  prepare(segment, position) {
    return Promise.resolve();
  }
  /* get called when a segment is fully fetched */
  flush(segment, position) {
    return Promise.resolve();
  }
  /* get called once per new segment */
  headers(segment, position, response) {
    return Promise.resolve();
  }
  /* get called when a new chunk is written */
  monitor(segment, position, size) {
  }
  /* get called when all segments are fetched */
  fetch(segments, params = {}) {
    return new Promise((resolve, reject) => {
      let position = 0;

      const start = async () => {
        const segment = segments.shift();
        position += 1;

        if (segment) {
          // wait for 5 seconds to make sure the old segment started all its segments. Then try to start a new segment
          setTimeout(() => this.number() && segments.length && start(), 5000);

          try {
            await this.prepare(segment, position - 1);
            await this.pipe(segment, params, position - 1);
            await this.flush(segment, position - 1);
            start();
          }
          catch (e) {
            reject(e);
          }
        }
        else {
          if (this.actives === 0) {
            resolve();
          }
        }
      };
      start();
    }).catch(e => {
      console.warn(e);
      this.controller.abort();
      throw Error(e);
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
    }

    return offset + (segment.range?.start || 0);
  }

  /* returns a valid writable stream */
  writer(segment, position) {
    const offset = this.offset(segment, position);

    const stream = new self.MemoryWriter(position, offset, this.cache);
    return stream;
  }
  /* starts a single thread. If server supports range and size is greater than 'thread-size', runs multiple threads */
  pipe(segment, params, position = 0) {
    this.actives += 1;

    const {href} = new URL(segment.uri, segment.base || undefined);
    const request = new Request(href, {
      method: segment.method || 'GET'
    });
    if (segment.range) {
      request.headers.append('Range', `bytes=${segment.range.start}-${segment.range.end}`);
    }

    return fetch(request, {
      ...params,
      signal: this.controller.signal
    }).then(r => {
      const s = Number(r.headers.get('Content-Length'));
      const size = isNaN(s) ? 0 : Number(s);

      if (r.ok && this.sizes.has(position) === false) {
        this.sizes.set(position, size);
        this.headers(segment, position, r);
      }

      const writable = this.writer(segment, position);

      const type = r.headers.get('Accept-Ranges');
      const computable = r.headers.get('Length-Computable');

      if (r.ok && segment.range && r.status !== 206) {
        throw Error('NO_RANGE_SUPPORT_' + r.status);
      }
      else if (r.ok) {
        // server supports range
        if (size && type === 'bytes' && computable !== 'false' && size > this.options['thread-size']) {
          return new Promise((resolve, reject) => {
            let start = segment.range?.start || 0;
            const end = segment.range?.end || size - 1;


            let actives = 1;

            const policy = new PolicyStream(this.options['thread-size']);

            const monitor = new StatsStream(size => {
              this.monitor(segment, position, size);
            });
            r.body.pipeThrough(policy).pipeThrough(monitor).pipeTo(writable).then(() => {
              actives -= 1;
              this.actives -= 1;
              more();
            }).catch(reject);

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

            const more = () => {
              for (let n = 0; n < this.number(); n += 1) {
                const start = ranges.shift();
                if (start) {
                  actives += 1;
                  this.actives += 1;
                  this.pipe({
                    ...segment,
                    range: {
                      start,
                      end: Math.min(start + this.options['thread-size'] - 1, end)
                    }
                  }, params, position).then(() => {
                    actives -= 1;
                    this.actives -= 1;
                    more();
                  }).catch(reject);
                }
                else {
                  break;
                }
              }
              if (actives === 0) {
                resolve();
              }
            };

            more();
          });
        }
        else {
          const monitor = new StatsStream(size => {
            this.monitor(segment, position, size);
          });
          return r.body.pipeThrough(monitor).pipeTo(writable).then(() => this.actives -= 1);
        }
      }
      else {
        throw Error('STATUS_' + r.status);
      }
    });
  }
}
MGet.OPTIONS = {
  'thread-size': 1 * 1024 * 1024, // bytes; size of each segment
  'threads': 3, // number; max number of simultaneous threads
  'next-segment-wait': 2000 // ms; time to wait after a segment is started, before considering the next segment
};

self.MyGet = MGet;
