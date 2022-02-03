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
  }
  async pipe(...args) {
    for (let n = 0; ; n += 1) {
      try {
        const r = await super.pipe(...args);
        return r;
      }
      catch (e) {
        console.log('pipe is broken', e.message);
        if (n > this.options['error-tolerance'] || this.controller.signal.aborted) {
          throw e;
        }
      }
      const delay = Math.min(5000, this.options['error-delay'] * n);
      await new Promise(resolve => setTimeout(resolve, delay));
    }
  }
}

self.MyGet = EGet;
