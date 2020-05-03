/* global Get */

const get = (filename, url, threads = 1) => {
  const core = new Get({
    configs: {
      'use-native-when-possible': false,
      'max-number-of-threads': threads
    },
    observe: {
      complete(success, e) {
        if (success) {
          core.resolve(new Response(core.properties.file.stream(), {
            headers: {
              'Content-Type': 'video/mp4'
            }
          }));
        }
        else {
          console.warn('Get Error', e);
          if (core.properties.downloaded) {
            core.reject(Error('GET is broken'));
          }
          else {
            fetch(url).then(r => {
              if (r.ok) {
                return r.blob().then(() => core.resolve(r));
              }
              core.reject(Error('Cannot Fetch'));
            }).catch(e => core.reject(e));
          }
        }
      }
    }
  });
  core.promise = new Promise((resolve, reject) => {
    core.resolve = resolve;
    core.reject = reject;
  });
  core.properties.filename = filename;
  core.fetch(url);

  return core;
};

async function getSegments(filename, segments, progress = () => {}, controls = {}) {
  const gets = [];
  controls.abort = () => {
    for (const get of gets) {
      get.pause();
      get.reject();
      try {
        get.properties.file.remove();
      }
      catch (e) {}
    }
  };
  // remove duplicated links
  const links = segments.map(o => o.uri).filter((s, i, l) => l.indexOf(s) === i);

  const NUMBER = 4;
  const sjobs = Math.min(NUMBER - 2, links.length);
  const threads = links.length === 1 ? NUMBER + 1 : 2;
  console.log('Total Simultaneous Jobs', sjobs);
  console.log('Number of Threads per Job', threads);

  const id = setInterval(() => {
    const actives = gets.filter(g => g.properties.paused === false);
    const downloaded = actives.reduce((p, c) => p + c.properties.downloaded, 0);
    const size = actives.reduce((p, c) => p + c.properties.size, 0);

    let p = gets.length - actives.length;
    if (size && actives.length) {
      p += (downloaded / size) * actives.length;
    }
    progress((p / links.length * 100).toFixed(0) + '%');
  }, 1000);

  try {
    for (let i = 0; i < links.length; i += sjobs) {
      const gs = links.slice(i, i + sjobs).map(link => get(filename, link, threads));
      gets.push(...gs);

      await Promise.all(gs.map(g => g.promise.then(stream => {
        g.stream = stream;
      })));
    }
    const blobs = [];
    for (const get of gets) {
      blobs.push(await get.stream.blob());
      try {
        get.properties.file.remove();
      }
      catch (e) {}
    }
    const properties = gets[0].properties;
    const blob = new Blob(blobs, {
      type: properties.mime || 'video/mp4'
    });
    clearInterval(id);
    return {
      properties,
      blob
    };
  }
  catch (e) {
    for (const get of gets) {
      get.pause();
      try {
        get.properties.file.remove();
      }
      catch (e) {}
    }
    clearInterval(id);
    throw e;
  }
}

// restore indexdb
{
  const restore = async () => {
    const os = 'databases' in indexedDB ? await indexedDB.databases() : Object.keys(localStorage)
      .filter(name => name.startsWith('file:'))
      .map(name => ({
        name: name.replace('file:', '')
      }));
    for (const o of os) {
      indexedDB.deleteDatabase(o.name);
      console.log('Deleting Job', o);
    }
  };

  chrome.runtime.onStartup.addListener(restore);
  chrome.runtime.onInstalled.addListener(restore);
}
