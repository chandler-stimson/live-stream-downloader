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
  runs a pipe several times if it is broken;
  it is considered that the writable supports overwriting old segments
*/


/* a fetch that fixes broken pipe */
class EGet extends MyGet {
  constructor(...args) {
    super(...args);

    this.options['thread-timeout'] = this.options['thread-timeout'] || 10000; // ms
    this.options['thread-initial-timeout'] = this.options['thread-initial-timeout'] || 10000; // ms
    // number of times a single uri can throw error before breaking
    this.options['error-tolerance'] = this.options['error-tolerance'] || 30; // number;
    // min-delay before restarting the segment
    this.options['error-delay'] = this.options['error-delay'] || 300; // ms;
    this.options['error-handler'] = e => Promise.reject(e);

    this.errors = new Map(); // stores error counts
    this.errors.set('_not_initialized_', 0); // track the server for failing to open a new connection.
  }

  /* returns the native fetch */
  async native(...args) {
    let [request] = args;
    const [, params, extra] = args;

    const {errors, options} = this;

    const timeout = {
      delay: {
        pump: this.options['thread-timeout'],
        initial: this.options['thread-initial-timeout']
      }
    };

    // none recoverable status codes
    const broken = status => {
      // 408 Request Timeout, 425 Too Early, 429 Too Many Requests
      if (status >= 400 && status < 500 && [408, 425, 429].includes(status) === false) {
        return true;
      }
      return false;
    };

    /* native fetch with custom timeout (if supported) */
    const native = () => {
      timeout.controller = new AbortController();

      if ('AbortSignal' in self && 'any' in AbortSignal) {
        const signal = params?.signal ?
          AbortSignal.any([timeout.controller.signal, params.signal]) : timeout.controller.signal;

        return super.native(request, {
          ...params,
          signal
        }, extra);
      }
      return super.native(request, params, extra);
    };

    let response;
    // try to fix broken pipe before header received
    for (;;) {
      try {
        let id;
        response = await Promise.race([
          native(),
          new Promise((resolve, reject) => {
            id = setTimeout(() => {
              // breaks the native response instead of rejecting
              timeout.controller.abort(Error('NO_INIT_TIMEOUT'));
            }, timeout.delay.initial);
          })
        ]);
        clearTimeout(id);
        if (!response.ok) {
          throw Error('STATUS_' + response.status);
        }
        break;
      }
      catch (e) {
        // reconfigure the MGet if there are too many fails on starting point
        {
          const counter = errors.get('_not_initialized_');
          // store the total number of failing for starting a new pipe
          if (e.message === 'NO_INIT_TIMEOUT') {
            errors.set('_not_initialized_', counter + 1);
          }
          if (counter === 20) {
            this.options.threads = Math.min(2, this.options.threads);
            this.options['thread-initial-timeout'] = Math.max(30000, this.options['thread-initial-timeout']);
            console.info('[error plugin]', 'Lowering the thread count and increasing the error timeout', this.options);
          }
        }

        const counter = errors.get(request.url) ?? 0;
        errors.set(request.url, counter + 1);
        console.info('pipe is broken :: ', e.message, `#${counter}`);

        // if server returns 403 or 404 error, there is no need to retry
        if (params.signal?.aborted) {
          throw e;
        }
        else if (counter > options['error-tolerance'] || broken(response?.status)) {
          const href = await options['error-handler'](e, 'BROKEN_PIPE', request.url);
          if (href) {
            request = new Request(href, request);
            if (extra.segment) {
              extra.segment.uri = href;
            }
            errors.set(href, 0);
          }
          else {
            throw e;
          }
        }
        else {
          const delay = Math.min(20000, options['error-delay'] * counter);
          await new Promise(resolve => setTimeout(resolve, delay));
        }
      }
    }

    return new Proxy(response, {
      get(target, prop, receiver) {
        if (prop !== 'body') {
          const value = target[prop];
          if (value instanceof Function) {
            return function(...args) {
              return value.apply(this === receiver ? target : this, args);
            };
          }
          return value;
        }

        let reader;
        let offset = 0;
        let controller;
        let active = true;
        let start = 0;
        let end;
        if (request.headers.has('Range')) {
          const range = request.headers.get('Range');
          const [ss, se] = range.split('=')[1].split('-');
          start = Number(ss);
          if (se) {
            end = Number(se);
          }
        }

        // try to fix broken pipe after data flow
        const recover = async e => {
          if (!active) {
            return;
          }
          if (params?.signal?.aborted) {
            return;
          }

          const counter = errors.get(request.url) ?? 0;
          console.info('pipe is broken :: ', e.message, `#${counter}`);

          const delay = Math.min(20000, options['error-delay'] * counter);
          await new Promise(resolve => setTimeout(resolve, delay));

          try {
            if (offset) {
              start += offset;
              offset = 0;
              request.headers.set('Range', 'bytes=' + start + '-' + (end || ''));
            }

            response = await native();
            if (!response.ok) {
              throw Error('STATUS_' + response.status);
            }
            if (offset && response.status !== 206) {
              throw Error('BROKEN_PIPE_NOT_RANGABLE');
            }

            reader = response.body.getReader();

            pump();
          }
          catch (e) {
            errors.set(request.url, counter + 1);

            // if server returns 403 or 404 error, there is no need to retry
            if (counter > options['error-tolerance'] || broken(response?.status)) {
              try {
                const href = await options['error-handler'](e, 'BROKEN_PIPE', request.url);
                if (href) {
                  args[0] = request = new Request(href, request);
                  if (extra.segment) {
                    extra.segment.uri = href;
                  }
                  errors.set(href, 0);
                  recover(e);
                }
                else {
                  controller.error(e);
                }
              }
              catch (e) {
                controller.error(e);
              }
            }
            else {
              recover(e);
            }
          }
        };

        const pump = () => {
          if (!active) {
            return;
          }
          // timeout
          clearTimeout(timeout.controller.id);
          timeout.controller.id = setTimeout(() => {
            timeout.controller.abort(Error('TIMEOUT'));
          }, timeout.delay.pump);

          // pump
          return reader.read().then(({done, value}) => {
            if (done) {
              // what if server returns done but the range is not full-field
              if (response.ok && end) {
                if (start + offset < end) {
                  recover(Error('SMALL_SEGMENT'));
                  return;
                }
              }
              try {
                controller.close();
              }
              catch (e) {}

              return;
            }
            errors.set(request.url, 0);

            // what if server returns more data than needed
            if (end) {
              if (start + offset + value.byteLength + 1 > end) {
                const v = value.slice(0, end - start - offset + 1);
                offset += v.byteLength;

                controller.enqueue(v);
                controller.close();
                console.info('[error plugin]', 'server returns more data than requested');
                // terminate the request to prevent extra data fetching
                timeout.controller.abort(Error('EXTRA_DATA'));
                return;
              }
            }

            controller.enqueue(value);
            offset += value.byteLength;

            return pump();
          }).catch(e => recover(e));
        };

        return new ReadableStream({
          start(c) {
            controller = c;
            controller.close = new Proxy(controller.close, {
              apply(target, self, args) {
                clearTimeout(timeout.controller.id);
                return Reflect.apply(target, self, args);
              }
            });
            controller.error = new Proxy(controller.error, {
              apply(target, self, args) {
                clearTimeout(timeout.controller.id);
                return Reflect.apply(target, self, args);
              }
            });

            reader = Reflect.get(target, prop).getReader();

            return pump();
          },
          cancel() {
            active = false;
            reader.cancel();
            clearTimeout(timeout.controller.id);
          }
        });
      }
    });
  }
}

self.MyGet = EGet;
