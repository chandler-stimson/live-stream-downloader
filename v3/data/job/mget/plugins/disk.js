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

// assumes that this.cache is replaced with {writer, offset = 0, cache = {}};
class DiskWriter {
  constructor(id, offset = 0, {writer}) {
    let size = 0;

    return new WritableStream({
      async write(chunk) {
        await writer.write({
          type: 'write',
          data: chunk,
          position: offset + size
        });
        size += chunk.byteLength;
      },
      close() {}
    }, {});
  }
}
self.MemoryWriter = DiskWriter;

class FGet extends MyGet {
  /* prepare disk usage */
  async attach(file) {
    const writer = await file.createWritable();
    writer.target = file;
    file.writer = writer;

    this.cache = {
      writer
    };
  }
  async fetch(...args) {
    await super.fetch(...args);
    await this.cache.writer.close();
  }
}
self.MyGet = FGet;
