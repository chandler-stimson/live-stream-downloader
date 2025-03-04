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

/* global network */

const extract = {};

/* extract storage */
extract.storage = async tabId => {
  try {
    const a = await chrome.scripting.executeScript({
      target: {
        tabId
      },
      injectImmediately: true,
      func: () => {
        self.storage = self.storage || new Map();

        return [...self.storage.values()];
      }
    });
    return a[0].result;
  }
  catch (e) {
    return [];
  }
};

/* extract from performance */
extract.performance = async tabId => {
  try {
    const types = await network.types({core: true, extra: false, sub: true});

    const a = await chrome.scripting.executeScript({
      target: {
        tabId
      },
      injectImmediately: true,
      func: types => performance.getEntriesByType('resource').filter(o => {
        if (o.contentType?.startsWith('video/') || o.contentType?.startsWith('audio/')) {
          return true;
        }
        if (['video', 'audio', 'other', 'xmlhttprequest'].includes(o.initiatorType)) {
          for (const type of types) {
            if (o.name.includes('.' + type)) {
              return true;
            }
          }
        }
      }).map(o => ({
        initiator: location.href,
        url: o.name,
        timeStamp: performance.timeOrigin + o.startTime,
        source: 'performance'
      })),
      world: 'MAIN',
      args: [types]
    });
    return a[0].result;
  }
  catch (e) {
    return [];
  }
};

/* extract media from jwplayer and videojs objects */
extract.player = async tabId => {
  try {
    const a = await chrome.scripting.executeScript({
      target: {
        tabId,
        allFrames: true
      },
      injectImmediately: true,
      func: () => {
        const list = [];
        try {
          for (const o of self.jwplayer().getPlaylist()) {
            if (o.file) {
              list.push({
                initiator: location.href,
                url: new URL(o.file, location.href).href,
                timeStamp: performance.timing.domComplete,
                source: 'jwplayer'
              });
            }
            if (o.sources) {
              for (const p of o.sources) {
                if (p.file) {
                  list.push({
                    initiator: location.href,
                    url: new URL(p.file, location.href).href,
                    timeStamp: performance.timing.domComplete,
                    source: 'jwplayer'
                  });
                }
              }
            }
          }
        }
        catch (e) {}

        // videojs
        const apd = v => {
          try {
            const o = v.tech().currentSource_;
            if (o) {
              const m = {
                initiator: location.href,
                url: o.src,
                timeStamp: performance.timing.domComplete,
                source: 'videojs'
              };
              if (o.type) {
                m.responseHeaders = [{
                  name: 'Content-Type',
                  value: o.type
                }];
              }
              list.push(m);
            }
          }
          catch (e) {}
        };

        try {
          for (const v of self.videojs.getAllPlayers()) {
            apd(v);
          }
        }
        catch (e) {}
        for (const e of document.querySelectorAll('video-js, .video-js')) {
          const o = e.player;
          if (o) {
            apd(o);
          }
        }

        return list;
      },
      world: 'MAIN'
    });
    return a.map(o => o.result).flat().filter(a => a);
  }
  catch (e) {
    return [];
  }
};
