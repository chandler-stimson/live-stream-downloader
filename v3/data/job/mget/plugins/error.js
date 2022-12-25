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
  runs a pipe several times if it is broken;
  it is considered that the writable supports overwriting old segments
*/

class EGet extends MyGet {
  constructor(...args) {
    super(...args);

    this.options['error-tolerance'] = 10; // number; number of times a single uri can throw error before breaking
    this.options['error-delay'] = 300; // ms; min-delay before restarting the segment
    this.options['error-handler'] = e => Promise.reject(e);
    this.options['error-recovery'] = true; // if true, the extension does not download already download chunks of a segment anymore

    this.errors = new WeakMap(); // stores error counts
  }
  monitor(...args) {
    super.monitor(...args);
    // when data is received, reset the error count
    const [segment,, size] = args;

    // do not download already fetched chunks
    if (this.options['error-recovery'] && segment.range) {
      segment.range.start += size;
    }

    this.errors.set(segment, 0);
  }
  async pipe(...args) {
    const [segment] = args;

    this.errors.set(segment, -1);
    for (;;) {
      const n = this.errors.get(segment) + 1;
      this.errors.set(segment, n);

      try {
        const r = await super.pipe(...args);
        return r;
      }
      catch (e) {
        console.info('pipe is broken', e.message);
        if (this.controller.signal.aborted) {
          throw e;
        }
        if (n > this.options['error-tolerance']) {
          await this.options['error-handler'](e, 'BROKEN_PIPE');
          this.errors.set(segment, 0);
        }
      }
      const delay = Math.min(5000, this.options['error-delay'] * n);
      await new Promise(resolve => setTimeout(resolve, delay));
    }
  }
}

self.MyGet = EGet;
