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

/* global MyGet, MP4Box */

class PreviewGet extends MyGet {
  preview() {
    console.log(this.meta.codec);
    const mediaSource = new MediaSource();
    const video = document.getElementById('preview');
    video.src = URL.createObjectURL(mediaSource);

    let offset = 0;
    let timeout;
    const bandwidth = 1000 * 1024;

    mediaSource.addEventListener('sourceopen', () => {
      // const sourceBuffer = mediaSource.addSourceBuffer(this.meta.codec);
      const videoSourceBuffer = mediaSource.addSourceBuffer('video/mp4; codecs="avc1.42E01E"');
      const audioSourceBuffer = mediaSource.addSourceBuffer('audio/mp4; codecs="mp4a.40.2"');

      const mp4boxfile = MP4Box.createFile();

      const push = async reason => {
        if (push.busy) {
          return console.log('busy');
        }
        if (videoSourceBuffer.updating || audioSourceBuffer.updating) {
          return console.log('updating');
        }
        if (videoSourceBuffer.readyState === 'closed' || audioSourceBuffer.readyState === 'closed') {
          return console.log('media is not supported');
        }
        clearTimeout(timeout);

        const file = await this.cache.writer.target.getFile();
        const buffer = await file.slice(offset, offset + bandwidth).arrayBuffer();
        console.log(reason, offset, buffer);

        // bytes are not ready yet
        if (buffer.byteLength === 0) {
          if (this.meta.done && this.meta['written-size'] === offset) {
            mediaSource.endOfStream();
            console.log(mediaSource);
          }
          else {
            timeout = setTimeout(push, 2000, 'timeout');
          }
        }
        else {
          mp4boxfile.onMoovStart = () => {
            mp4boxfile.onReady = () => {
              console.log(1);
              videoSourceBuffer.appendBuffer(mp4boxfile.getSegment('video'));
              audioSourceBuffer.appendBuffer(mp4boxfile.getSegment('audio'));

              if (!mediaSource.sourceBuffers[0].updating && video.paused) {
                video.play();
              }
            };
          };

          console.log(buffer);
          buffer.fileStart = offset;
          mp4boxfile.appendBuffer(buffer);
          offset += buffer.byteLength;
        }

        push.busy = false;
      };
      // sourceBuffer.addEventListener('updateend', () => {
      //   push('updateend');
      // });
      push('initial');
      video.play().catch(e => {
        clearTimeout(timeout);
        console.log('cannot preview', e);
      });
    });
  }
}

self.MyGet = PreviewGet;
