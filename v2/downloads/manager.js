/**
    Turbo Download Manager - .A download manager with the ability to pause and resume downloads

    Copyright (C) 2014-2020 [InBasic](https://add0n.com/turbo-download-manager-v2.html)

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

    GitHub: https://github.com/inbasic/turbo-download-manager-v2/
    Homepage: https://add0n.com/turbo-download-manager-v2.html
*/

/**
Tests:
1. file with no content-type header:
https://tuxproject.de/projects/vim/

2. partial download (402 Payment Required)
https://gz.blockchair.com/bitcoin/addresses/

3. wrong filename
https://www.mozilla.org/en-CA/firefox/all/#product-desktop-release

4. M3U8
https://videojs.com/
https://www.radiantmediaplayer.com/media/rmp-segment/bbb-abr-aes/playlist.m3u8

5. M3U8 AES-128 encrypted
http://demo.theoplayer.com/drm-aes-protection-128-encryption?hsCtaTracking=cc0cef76-cc09-40b0-8e84-c1c278ec8764%7C6c30cfd0-2817-49e5-addc-b1a5afc68170

6. HLS that needs referrer header
https://anime.anidub.life/anime/anime_ongoing/11270-devushki-poni-enkoma-umayon-01-iz-13.html

7. referrer needed
https://seinfeld9.com/episodes/seinfeld-season-1-episode-1/

*/

'use strict';

const downloads = {
  cache: {},
  NORMAL_START_INDEX: 100000,
  index: 100000,
  listeners: {
    onCreated: [],
    onChanged: []
  }
};

downloads.intercept = {
  cache: {},
  observe(referrer, {requestHeaders}) {
    requestHeaders.push({
      name: 'Referer',
      value: referrer
    });
    return {
      requestHeaders
    };
  },
  start(urls, referrer) {
    const id = Math.random();
    if (chrome.webRequest) {
      const observe = downloads.intercept.cache[id] = downloads.intercept.observe.bind(this, referrer);

      const opts = ['requestHeaders', 'blocking'];
      if (/Firefox/.test(navigator.userAgent) === false) {
        opts.push('extraHeaders');
      }
      chrome.webRequest.onBeforeSendHeaders.addListener(observe, {
        tabId: -1,
        urls,
        types: ['xmlhttprequest']
      }, opts);
    }
    return id;
  },
  stop(id) {
    const observe = downloads.intercept.cache[id];
    if (observe) {
      delete downloads.intercept.cache[id];
      chrome.webRequest.onBeforeSendHeaders.removeListener(observe);
    }
  }
};

downloads.download = (options, callback = () => {}, configs = {}, start = true) => {
  if (!options.filename) {
    delete options.filename;
  }
  if (typeof options.urls === 'undefined') {
    if (configs['max-number-of-threads'] === 1 && configs['use-native-when-possible']) {
      return File.prototype.store(options).then(callback);
    }
    options.urls = [options.url];
  }
  else {
    options.url = options.urls[0];
  }
  const id = downloads.index;
  downloads.index += 1;
  const post = obj => {
    const o = {
      ...obj,
      id
    };
    downloads.listeners.onChanged.forEach(c => c(o));
  };
  const info = downloads.cache[id] = {
    state: 'in_progress', // "in_progress", "interrupted", or "complete"
    exists: true,
    paused: true,
    id,
    links: options.urls,
    offsets: [0] // keep track of offsets for segmented requests
  };

  let core; // keep track of the active core
  const observe = {
    file: file => info.file = file,
    extra: extra => {
      info.links = extra.links || info.links;
      info.offsets = extra.offsets || info.offsets;
      if (extra.referrer && extra.links && info.iid === -1) {
        info.iid = downloads.intercept.start(extra.links, extra.referrer);
      }
    },
    error: e => console.warn('a fetch request is broken', e)
  };

  info.iid = -1;
  if (options.urls && options.referrer) {
    info.iid = downloads.intercept.start(options.urls, options.referrer);
  }
  observe.complete = (success, error) => {
    const onerror = async error => {
      console.warn('Job Failed:', error.message);
      info.error = error.message;
      info.state = 'interrupted';
      // we cannot download, let's use native
      if (
        core.properties.restored !== false &&
        core.properties.downloaded === 0 &&
        info.links.length < 2 &&
        configs['use-native-when-possible'] &&
        info.dead !== true
      ) {
        downloads.intercept.stop(info.iid);

        File.prototype.store(options).then(nativeID => chrome.downloads.search({
          id: nativeID
        }, ([native]) => {
          post({native});
          try {
            info.file.remove();
          }
          catch (e) {}
          delete downloads.cache[id];
        }));
      }
      else if (
        info.links.length &&
        core.properties.downloaded === 0 &&
        info.dead !== true
      ) {
        info.error += '. Using fetch API...';
        info.state = 'in_progress';
        if (!info.file) {
          info.file = new File(undefined, configs['use-memory-disk']);
          await info.file.open();
        }
        // abort native fetch if pause is requested or response status is not okay
        const controller = new AbortController();
        core.pause = () => {
          controller.abort();
        };
        fetch(core.properties.link, {
          signal: controller.signal
        }).then(r => {
          if (r.ok) {
            // we don't have filename info when the first chunk is not supporting threading
            Object.assign(core.properties, core.guess(r), {
              mime: r.headers.get('Content-Type')
            });
            r.arrayBuffer().then(ab => {
              const buffer = new Uint8Array(ab);
              info.file.chunks({
                buffer,
                offset: core.properties['disk-write-offset']
              }).then(() => {
                info.file.ready = true;
                observe.complete(true);
              }).catch(e => {
                info.dead = true;
                onerror(e);
              });
            });
          }
          else {
            controller.abort();
            onerror(Error('Failed to fetch'), true);
          }
        });
      }
      if (info.state === 'interrupted') {
        downloads.intercept.stop(info.iid);
      }
      post({
        [info.state === 'interrupted' ? 'error' : 'warning']: {current: info.error}
      });
    };

    const index = info.links.indexOf(core.properties.link);
    if (success && index + 1 === info.links.length) {
      const offset = core.properties.size + core.properties['disk-write-offset'];
      info.offsets.push(offset);
      info.state = 'complete';

      downloads.intercept.stop(info.iid);
      core.download({
        offsets: info.offsets,
        keys: options.keys
      }, native => {
        post({native});
        delete downloads.cache[id];
      }).catch(e => {
        info.dead = true;
        onerror(e);
      });
    }
    else if (success) {
      const offset = core.properties.size + core.properties['disk-write-offset'];

      core = new window.Get({configs, observe});
      // use user-defined filename
      core.properties.filename = options.filename || '';
      core.properties.file = info.file;
      core.properties['disk-write-offset'] = offset;
      info.offsets.push(offset);
      info.core = core;
      core.fetch(info.links[index + 1]);
    }
    else {
      onerror(error);
    }
  };
  observe.paused = current => {
    info.paused = current;
    if (current === false) {
      info.error = '';
    }
    info.state = 'in_progress';
    if (current && core.properties.downloaded === core.properties.size && core.properties.downloaded) {
      info.state = 'transfer';
    }
    post({
      state: {current: 'transfer'},
      paused: {current},
      canResume: {current}
    });
  };
  observe.headers = response => {
    core.properties.finalUrl = response.url;

    const {filename, fileextension} = core.properties;
    post({
      filename: {
        current: fileextension ? filename + '.' + fileextension : filename
      },
      totalBytes: {current: core.properties.size}
    });
  };

  info.core = core = new window.Get({configs, observe});
  Object.assign(core.properties, {
    filename: options.filename || '', // use user-defined filename
    extra: {
      links: [...options.urls], // this will cause links to be appended to the db
      referrer: options.referrer
    }
  });

  configs = core.configs; // read back all configs from core after being fixed

  if (start) {
    core.fetch(options.url);
  }
  callback(id);
  downloads.listeners.onCreated.forEach(c => c(info));
};
downloads.search = (options = {}, callback = () => {}) => {
  let ds = Object.values(downloads.cache);
  if ('paused' in options) {
    ds = ds.filter(({paused}) => options.paused === paused);
  }
  if ('state' in options) {
    ds = ds.filter(({state}) => options.state === state);
  }
  if ('excludeSmallFiles' in options && options.excludeSmallFiles) {
    ds = ds.filter(({name}) => !name.endsWith('.ts') && !name.endsWith('.m4s'));
  }
  callback(ds);
};
downloads.cancel = (id, callback) => {
  downloads.cache[id].core.pause();
  downloads.cache[id].dead = true;
  downloads.cache[id].state = 'interrupted';
  downloads.cache[id].error = 'USER_CANCELED';
  // try {
  //   downloads.cache[id].core.properties.file.remove();
  // }
  // catch (e) {
  //   console.warn('Cannot remove file', e);
  // }
  // downloads.cache[id].exists = false;
  downloads.cache[id].core.observe.complete(false, Error('USER_CANCELED'));
  callback();
};
downloads.onCreated = {
  addListener: c => {
    downloads.listeners.onCreated.push(c);
  }
};
downloads.onChanged = {
  addListener: c => downloads.listeners.onChanged.push(c)
};

const manager = {
  PUASE_ON_META: 3,
  NOT_START_INDEX: 200000,
  nindex: 200000,
  ncache: {},

  native(id) {
    return id < downloads.NORMAL_START_INDEX;
  },
  schedule(job, store = true) {
    const olinks = Object.values(manager.ncache).map(o => o.url);
    job.url = job.url || job.link;
    delete job.link;
    delete job.id;

    if (olinks.indexOf(job.url) === -1) {
      const id = manager.nindex;

      manager.nindex += 1;
      manager.ncache[id] = {
        filename: job.url.split('/').pop(),
        id,
        state: 'not_started',
        ...job
      };

      if (store) {
        chrome.storage.sync.set({
          jobs: Object.values(manager.ncache),
          links: []
        });
      }
    }
    return Promise.resolve();
  },
  search(options, callback, comprehensive = true) {
    const sections = core => [...core.ranges].map(r => {
      for (const get of core.gets) {
        if (get.offset === r[0]) {
          return [get.offset, get.offset + get.size];
        }
      }
      return r;
    });
    const object = ({id, state, exists, paused, core, error, links}) => {
      const {queue, mime, downloaded, size, filename = '', fileextension, finalUrl, link, restored} = core.properties;
      return {
        id,
        state,
        queue,
        exists,
        paused,
        filename: fileextension ? filename + '.' + fileextension : filename,
        finalUrl: finalUrl || link,
        mime,
        bytesReceived: downloaded,
        totalBytes: size,
        m3u8: {
          current: links.indexOf(link || finalUrl),
          count: links.length
        },
        sections: sections(core),
        speed: core.speed(),
        threads: core.gets.size,
        error,
        restored
      };
    };
    if (options.id && options.id >= manager.NOT_START_INDEX) {
      callback([manager.ncache[options.id]]);
    }
    else if (options.id && manager.native(options.id) === false) {
      const o = downloads.cache[options.id];
      return callback([comprehensive && o ? object(o) : o]);
    }
    else if (options.id) {
      if (manager.native(options.id)) {
        chrome.downloads.search(options, callback);
      }
      else {
        downloads.search(options, callback);
      }
    }
    else if (options.state === 'not_started') {
      callback(Object.values(manager.ncache));
    }
    else {
      Promise.all([
        new Promise(resolve => downloads.search(options, resolve)).then(ds => {
          if (comprehensive) {
            return ds.map(object);
          }
          return ds;
        }),
        options.state && options.state === 'transfer' ?
          Promise.resolve([]) :
          new Promise(resolve => chrome.downloads.search(options, resolve))
      ]).then(arr => arr.flat()).then(callback);
    }
  },
  resume(id, callback) {
    if (manager.native(id)) {
      return chrome.downloads.resume(id, callback);
    }
    downloads.cache[id].core.resume();
    callback();
  },
  pause(id, callback) {
    if (manager.native(id)) {
      return chrome.downloads.pause(id, callback);
    }
    downloads.cache[id].core.pause();
    callback();
  },
  cancel(id, callback = () => {}) {
    if (manager.native(id)) {
      return chrome.downloads.cancel(id, callback);
    }
    downloads.cancel(id, callback);
  },
  erase(query, callback = () => {}) {
    manager.search(query, (ds = []) => {
      for (const {id} of ds) {
        if (id >= manager.NOT_START_INDEX) {
          delete manager.ncache[id];
          chrome.storage.sync.set({
            jobs: Object.values(manager.ncache)
          });
        }
        else if (manager.native(id) === false) {
          try {
            downloads.cache[id].core.properties.file.remove();
          }
          catch (e) {
            console.warn('Cannot remove internal file', e);
          }
          delete downloads.cache[id];
        }
        else {
          chrome.downloads.erase({
            id
          });
        }
      }
      callback(ds.map(d => d.id));
    }, false);
  },
  getFileIcon(id, options, callback) {
    if (manager.native(id)) {
      return chrome.downloads.getFileIcon(id, options, callback);
    }
    callback('');
  },
  download(options, callback = () => {}, configs = {}, start = true) {
    manager.search({
      state: 'in_progress'
    }, ds => {
      if (start && ds.filter(d => d.paused === false).length >= manager.PUASE_ON_META) {
        configs['pause-on-meta'] = true;
      }
      downloads.download(options, callback, configs, start);
    }, false);
  },
  onChanged: {
    addListener(c) {
      downloads.onChanged.addListener(c);
      chrome.downloads.onChanged.addListener(c);
    }
  }
};
// start from queue
{
  let id;
  const next = () => manager.search({
    state: 'in_progress'
  }, ds => {
    if (ds.filter(d => d.paused === false) < manager.PUASE_ON_META) {
      const d = ds.filter(d => d.paused && d.core && d.core.properties.queue).shift();
      if (d) {
        d.core.resume();
      }
    }
  }, false);
  const c = () => {
    clearTimeout(id);
    id = setTimeout(next, 300);
  };
  downloads.onChanged.addListener(c);
  chrome.downloads.onChanged.addListener(c);
}

// downloads.download({url: 'http://127.0.0.1:2000/df'}, () => {}, {
//   'max-segment-size': 10 * 1024 * 1024, // max size for a single downloading segment
//   'max-number-of-threads': 5,
//   'overwrite-segment-size': true, // change segment sizes after size is resolved
//   'max-retires': 5,
//   'speed-over-seconds': 10,
//   'max-simultaneous-writes': 3
// });
// window.setTimeout(() => {
//   downloads.pause(10000);
// }, 2000);

// restore indexdb
{
  const restore = async () => {
    const os = 'databases' in indexedDB ? await indexedDB.databases() : Object.keys(localStorage)
      .filter(name => name.startsWith('file:'))
      .map(name => ({
        name: name.replace('file:', '')
      }));
    for (const o of os) {
      downloads.download({}, id => {
        const {core} = downloads.cache[id];
        core.restore(o.name).catch(e => {
          console.warn('Cannot restore segments. This database will be removed', e, core);
          try {
            core.properties.file.remove();
            delete downloads.cache[id];
          }
          catch (e) {}
        });
      }, undefined, false);
    }
  };

  chrome.runtime.onStartup.addListener(restore);
  chrome.runtime.onInstalled.addListener(restore);
}
// restore not started
chrome.storage.sync.get({
  links: [],
  jobs: []
}, prefs => {
  chrome.runtime.lastError;
  if (prefs && prefs.links.length) {
    for (const url of prefs.links) {
      manager.schedule({
        url
      }, false);
    }
  }
  if (prefs && prefs.jobs.length) {
    for (const job of prefs.jobs) {
      manager.schedule(job, false);
    }
  }
});
