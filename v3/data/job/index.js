/* global MyGet, m3u8Parser */

/*
  http://127.0.0.1:8000/example/sample/unencrypted.m3u8
  https://bitdash-a.akamaihd.net/content/sintel/hls/playlist.m3u8
  https://bitdash-a.akamaihd.net/content/MI201109210084_1/m3u8s/f08e80da-bf1d-4e3d-8899-f0f6155f6efa.m3u8
  http://demo.theoplayer.com/drm-aes-protection-128-encryption
  https://anime.anidub.life/anime/full/11270-devushki-poni-enkoma-umayon-01-iz-13.html
  https://soundcloud.com/nba-youngboy/youngboy-never-broke-again
*/

const args = new URLSearchParams(location.search);

const tabId = Number(args.get('tabId')); // original tab

const events = {
  before: [], // before download begins
  after: [] // after download ends
};

document.title += ' from "' + args.get('title') + '"';
document.getElementById('referer').textContent = args.get('href') || '-';
document.getElementById('threads').textContent = MyGet.OPTIONS.threads;

self.notify = (msg, timeout) => {
  if (self.notify.id === undefined) {
    self.notify.content = document.title;
  }
  document.title = msg;

  if (timeout) {
    clearTimeout(self.notify.id);
    self.notify.id = setTimeout(() => {
      document.title = self.notify.content;
      self.notify.id = undefined;
    }, timeout);
  }
};
self.prompt = (msg, buttons = {
  ok: 'Retry',
  no: 'Cancel',
  value: ''
}, confirm = false) => new Promise((resolve, reject) => {
  self.prompt.cache.push({resolve, reject});
  if (self.prompt.busy) {
    return;
  }
  self.prompt.busy = true;

  const root = document.getElementById('prompt');
  root.querySelector('[data-id="msg"]').textContent = msg;
  root.dataset.mode = confirm ? 'confirm' : 'prompt';

  root.querySelector('[data-id="ok"]').value = buttons.ok;

  if (buttons.value !== '') {
    root.querySelector('input[data-id=value]').value = buttons.value;
    root.querySelector('input[data-id=value]').type = isNaN(buttons.value) ? 'text' : 'number';
    root.querySelector('input[data-id=value]').select();
  }

  root.onsubmit = e => {
    e.preventDefault();
    root.classList.add('hidden');
    const value = root.querySelector('input[data-id=value]').value;
    for (const {resolve} of self.prompt.cache) {
      resolve(value);
    }
    self.prompt.cache = [];
    self.prompt.busy = false;
  };
  root.querySelector('[data-id="no"]').onclick = () => {
    root.classList.add('hidden');
    const e = Error('USER_ABORT');
    for (const {reject} of self.prompt.cache) {
      reject(e);
    }
    self.prompt.cache = [];
    self.prompt.busy = false;
  };
  root.querySelector('[data-id="no"]').value = buttons.no;
  root.classList.remove('hidden');

  if (buttons.value !== '') {
    root.querySelector('input[data-id=value]').focus();
  }
  else {
    root.querySelector('[data-id="ok"]').focus();
  }
});
self.prompt.cache = [];

const response = o => {
  const headers = new Headers();
  for (const {name, value} of (o.responseHeaders || [])) {
    headers.set(name, value);
  }
  return {
    url: o.url,
    headers
  };
};
const build = os => {
  const t = document.getElementById('entry');
  for (const o of os) {
    const clone = document.importNode(t.content, true);
    const div = clone.querySelector('div');
    const meta = {};

    const r = response(o instanceof File ? {
      url: 'local/' + o.name
    } : o);
    MyGet.guess(r, meta);

    clone.querySelector('[data-id=name]').textContent = clone.querySelector('[data-id=name]').title = meta.name;
    clone.querySelector('[data-id=ext]').textContent = meta.ext || 'N/A';
    if (r.headers.has('Content-Length')) {
      clone.querySelector('[data-id=size]').textContent = MyGet.size(r.headers.get('Content-Length') || '0');
    }
    else {
      clone.querySelector('[data-id=size]').textContent = 'N/A';
    }
    clone.querySelector('[data-id=href]').textContent = clone.querySelector('[data-id=href]').title = (o.url || 'N/A');

    clone.querySelector('input[data-id=copy]').onclick = e => navigator.clipboard.writeText(o.url).then(() => {
      e.target.value = 'Done';
      setTimeout(() => e.target.value = 'Copy', 750);
    }).catch(e => alert(e.message));

    div.o = o;
    div.meta = meta;

    document.getElementById('hrefs').appendChild(div);
  }

  document.body.dataset.mode = document.querySelector('form .entry') ? 'ready' : 'empty';
};

chrome.runtime.sendMessage({
  method: 'get-jobs',
  tabId
}, os => {
  if (args.has('append')) {
    os.push({
      url: args.get('append')
    });
  }
  // m3u8 on top
  os.sort((a, b) => {
    const ah = a.url.indexOf('m3u8') !== -1;
    const bh = b.url.indexOf('m3u8') !== -1;
    if (ah && bh === false) {
      return -1;
    }
    if (bh && ah === false) {
      return 1;
    }
    return a.timeStamp - b.timeStamp;
  });

  build(os);
});

const error = e => {
  console.warn(e);
  document.title = e.message;
  document.body.dataset.mode = 'error';
};

const download = async (segments, file) => {
  document.body.dataset.mode = 'download';

  // remove duplicated segments (e.g. video/fMP4)
  const links = [];
  segments = segments.filter(s => {
    if (links.indexOf(s.uri) === -1) {
      links.push(s.uri);
      return true;
    }
    return false;
  });

  // segment with initialization map
  segments = segments.map(s => {
    if (s.map && s.map.uri && s.map.uri !== s.uri) {
      return [{
        ...s,
        uri: s.map.uri
      }, s];
    }
    return s;
  }).flat();

  const stat = {
    fetched: 0,
    current: 0,
    total: segments.length
  };

  const n = new class extends MyGet {
    // monitor progress
    monitor(...args) {
      stat.current = Math.max(stat.current, args[1]);
      stat.fetched += args[2];

      return super.monitor(...args);
    }
  };
  // instead of breaking, let the user retry
  n.options['error-handler'] = (e, source) => {
    return self.prompt(`Connection to the server is broken (${source} -> ${e.message})!

Press "Retry" to try one more time`);
  };

  console.log('MyGet', n);

  const timer = setInterval(() => {
    // downloading a single file
    if (stat.total === 1) {
      if (n.sizes.has(0)) {
        const percent = stat.fetched / n.sizes.get(0) * 100;
        document.title = percent.toFixed(1) + `% fetched [${MyGet.size(stat.fetched)}/${MyGet.size(n.sizes.get(0))}]`;
      }
      else {
        document.title = MyGet.size(stat.fetched) + ' fetched...';
      }
    }
    else {
      document.title = (stat.current / stat.total * 100).toFixed(1) +
        `% fetched [${stat.current}/${stat.total}] (${MyGet.size(stat.fetched)})`;
    }
  }, 500);

  try {
    // attach disk writer
    n.attach(file);

    await n.fetch(segments);
    clearInterval(timer);

    document.title = 'Done. Media is ready!';

    // try to rename
    if (n.meta.name && n.meta.ext && file.rename) {
      const name = n.meta.name + '.' + n.meta.ext;
      if (name !== file.name) {
        const input = document.querySelector('[data-active=true] input[data-id=rename]');
        if (input) {
          input.disabled = false;
          input.onclick = e => {
            if (confirm(`Rename media from "${file.name}" to "${name}"?

-> This will overwrite an existing file with the same name.`)) {
              file.rename(name);
              e.target.disabled = true;
            }
          };
        }
      }
    }

    document.body.dataset.mode = 'done';
  }
  catch (e) {
    error(e);
  }
  clearInterval(timer);
};

const parser = async (manifest, file, href) => {
  // data uri
  if (manifest.startsWith('data:')) {
    manifest = await fetch(manifest).then(r => r.text());
  }

  // manifest is URL
  if (manifest.split('\n').length === 1) {
    if (!href) {
      href = manifest;
    }

    let o;
    if (manifest.startsWith('http')) {
      o = new URL(manifest);
    }
    else if (href && href.startsWith('http')) {
      o = new URL(manifest, href);
    }
    else {
      href = await prompt(`What is the base URL for "${manifest}"`, {
        ok: 'Set Base',
        no: 'Abort'
      }, true);
      o = new URL(manifest, href);
    }

    manifest = await fetch(o.href).then(r => {
      if (r.ok) {
        href = o.href;
        return r.text();
      }
      throw Error('FAILED_TO_FETCH_' + r.status);
    });
  }

  document.title = 'Parsing M3U8 manifest ...';
  document.body.dataset.mode = 'parse';

  const p = new m3u8Parser.Parser();

  p.push(manifest);
  p.end();

  const playlists = p.manifest.playlists || [];
  if (playlists.length) {
    const msgs = [];
    // sort based on highest quality
    playlists.sort((a, b) => {
      try {
        return b.attributes.RESOLUTION.width - a.attributes.RESOLUTION.width;
      }
      catch (e) {
        return 0;
      }
    });

    for (const playlist of playlists) {
      if (playlist.attributes && playlist.attributes.RESOLUTION) {
        msgs.push(playlist.attributes.RESOLUTION.width + ' × ' + playlist.attributes.RESOLUTION.height + ' -> ' + playlist.uri.substr(-60));
      }
      else {
        msgs.push(playlist.uri.substr(-30));
      }
    }
    const n = (playlists.length > 1 ? await prompt('Select one stream:\n\n' + msgs.map((m, n) => n + '. ' + m).join('\n'), {
      ok: 'Select Quality',
      no: 'Abort',
      value: 0
    }, true) : 0);

    if (isNaN(n) === false) {
      const v = playlists[Number(n)];
      if (v) {
        try {
          const o = new URL(v.uri, href || undefined);
          return parser(o.href, file);
        }
        catch (e) {
          return parser(v.uri, file, href);
        }
      }
    }
    throw Error('UNKNOWN_QUALITY');
  }

  const segments = p.manifest.segments;

  if (segments.length) {
    // do we have a valid segment
    if (!href && segments[0].uri.startsWith('http') === false) {
      href = await prompt(`What is the base URL for "${segments[0].uri}"`, {
        ok: 'Set Base',
        no: 'Abort'
      }, true);
    }

    document.title = 'Downloading ' + href;
    return download(segments.map(o => {
      o.base = href;
      return o;
    }), file);
  }
  else {
    throw Error('No_SEGMENT_DETECTED');
  }
};

document.getElementById('hrefs').onsubmit = async e => {
  e.preventDefault();
  const div = e.submitter.closest('div');
  try {
    div.dataset.active = true;

    const options = {
      types: [{
        description: 'Video or Audio Files'
      }]
    };
    // this way, the file can get played will download is in progress
    if (div.meta.ext === 'm3u8' || div.meta.ext === '') {
      options.types[0].accept = {
        'video/mkv': ['.mkv']
      };
      options.suggestedName = (div.meta.name || 'Untitled') + '.mkv';
    }
    else if (div.meta.ext) {
      if (div.meta.mime) {
        options.types[0].accept = {
          [div.meta.mime]: ['.' + div.meta.ext]
        };
      }
      options.suggestedName = (div.meta.name || 'Untitled') + '.' + div.meta.ext;
    }

    const file = await window.showSaveFilePicker(options);

    // run pre
    for (const c of events.before) {
      await c(div.o);
    }

    // URL
    if (div.o instanceof File) {
      await new Promise((resolve, reject) => {
        const reader = new FileReader();
        reader.onload = () => parser(reader.result, file, undefined).then(resolve, reject);
        reader.readAsText(div.o, 'utf-8');
      });
    }
    else {
      if (
        div.meta.ext !== 'm3u8' &&
        div.o.url.indexOf('.m3u8') === -1 &&
        div.o.url.indexOf('format=m3u8') === -1
      ) {
        document.title = 'Downloading ' + div.o.url;
        await download([{
          uri: div.o.url
        }], file);
      }
      else {
        await parser(div.o.url, file);
      }
    }
    div.classList.remove('error');
    div.classList.add('done');
  }
  catch (e) {
    div.classList.remove('done');
    div.classList.add('error');
    error(e);
  }

  // run post
  for (const c of events.after) {
    c();
  }

  div.dataset.active = false;
};
