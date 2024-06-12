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
  cache a segment that has {cache: true}
*/

class CGet extends MyGet {
  constructor(...args) {
    super(...args);

    this['cache-id'] = 'myget-cache-' + Math.random();
  }
  async native(request, params, extra) {
    const cache = await caches.open(this['cache-id']);
    let response = await cache.match(request);

    if (response) {
      return response;
    }
    else {
      response = await super.native(request, params, extra);
      if (extra.save) {
        await cache.put(request, response.clone());
      }

      return response;
    }
  }
  // clean the cache
  fetch(...args) {
    const o = super.fetch(...args);

    return o.then(r => {
      caches.delete(this['cache-id']);

      return r;
    }).catch(e => {
      caches.delete(this['cache-id']);
      throw e;
    });
  }
}

self.MyGet = CGet;
