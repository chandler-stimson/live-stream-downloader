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

/* global MP4Box, MyGet */

class CodecGet extends MyGet {
  headers(...args) {
    const r = super.headers(...args);

    const position = args[1];
    if (position === 0) {
      if (this.meta?.mime === 'video/mp4') {
        const mp4box = MP4Box.createFile();

        this.meta.box = {
          mp4box,
          count: 0
        };
        mp4box.onError = e => {
          console.warn('MP4Box Error', e);
          delete this.meta.box;
        };
        mp4box.onReady = info => {
          console.log(info, this.meta.box.count);
          delete this.meta.box;

          // can the browser play this file
          if (info.mime) {
            this.meta.codec = info.mime;
            // this.meta.preview = MediaSource.isTypeSupported(info.mime);
            this.meta.preview = Boolean(this.meta.codec);

            if (this.meta.preview) {
              this.preview();
            }
          }
        };
      }
      else if (this?.meta?.['base-codec']) {
        this.meta.codec = this.meta.mime + '; codecs="' + this.meta['base-codec'] + '"';
        for (const codec of [
          this.meta.codec,
          'video/mp4' + '; codecs="' + this.meta['base-codec'] + '"',
          this.meta.mime
        ]) {
          this.meta.preview = MediaSource.isTypeSupported(codec);
          if (this.meta.preview) {
            this.meta.codec = codec;
            this.preview();
          }
        }
      }
      else {
        this.meta.codec = this.meta.mime;
        this.meta.preview = MediaSource.isTypeSupported(this.meta.codec);

        if (this.meta.preview) {
          this.preview();
        }
      }
    }

    return r;
  }
  monitor(...args) {
    try {
      if (this.meta.box) {
        const [segment, position, chunk, offset] = args;
        const buf = chunk.buffer;
        buf.fileStart = (segment?.range?.start || 0) + offset;
        this.meta.box.mp4box.appendBuffer(buf);

        if (this.meta.box) {
          this.meta.box.count += 1;

          // the media is probably not supported
          if (this.meta.box.count > 50) {
            this.meta.box.mp4box.flush();
            delete this.meta.box;
          }
        }
      }
    }
    catch (e) {
      console.log(e);
    }

    return super.monitor(...args);
  }
  /* get called if media is playable */
  preview() {}
}

self.MyGet = CodecGet;
