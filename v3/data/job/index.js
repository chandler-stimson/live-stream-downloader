/* global MyGet, m3u8Parser, network */

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
const progress = document.getElementById('progress');

const events = {
  before: new Set(), // before download begins
  after: new Set() // after download ends
};

const storage = {
  get(prefs) {
    return new Promise(resolve => chrome.storage.local.get(prefs, resolve));
  },
  set(prefs) {
    return new Promise(resolve => chrome.storage.local.set(prefs, resolve));
  }
};

document.title += ' from "' + (args.get('title') || 'New Tab') + '"';

self.notify = (msg, timeout = 750) => {
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
}, confirm = false) => {
  return new Promise((resolve, reject) => {
    const root = document.getElementById('prompt');
    self.prompt.cache.push({resolve, reject});

    if (root.open === false) {
      root.querySelector('p').textContent = msg;
      root.dataset.mode = confirm ? 'confirm' : 'prompt';

      root.querySelector('[name=value]').required = confirm;
      root.querySelector('[name=value]').value = buttons.value;
      root.querySelector('[name=value]').select();
      root.querySelector('[name=value]').type = isNaN(buttons.value) ? 'text' : 'number';
      root.querySelector('[value=default]').textContent = buttons.ok;
      root.querySelector('[value=cancel]').textContent = buttons.no;

      root.onsubmit = e => {
        e.preventDefault();
        root.close();
        if (e.submitter.value === 'default') {
          const value = root.querySelector('[name=value]').value;
          for (const {resolve} of self.prompt.cache) {
            resolve(value);
          }
        }
        else {
          root.onclose();
        }
        self.prompt.cache = [];
      };
      root.onclose = () => {
        const e = Error('USER_ABORT');
        for (const {reject} of self.prompt.cache) {
          reject(e);
        }
      };

      root.showModal();
      root.querySelector(confirm ? '[name=value]' : '[value=default]').focus();
    }
  });
};
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
const build = async os => {
  const prefs = await storage.get({
    'filename': '[meta.name]' // [meta.name], [title], [hostname]
  });
  let hostname = 'NA';
  try {
    const o = new URL(args.get('href'));
    hostname = o.hostname;
  }
  catch (e) {}

  const t = document.getElementById('entry');
  let naming = 0;
  for (const o of os) {
    const clone = document.importNode(t.content, true);
    const div = clone.querySelector('label');
    const en = clone.querySelector('[data-id=name]');
    const exn = clone.querySelector('[data-id=extracted-name]');
    const ex = clone.querySelector('[data-id=ext]');
    const meta = {};

    const name = () => {
      meta.gname = en.textContent = en.title = prefs.filename
        .replace('[meta.name]', meta.name)
        .replace('[title]', args.get('title'))
        .replace('[hostname]', hostname);

      if (prefs.filename.includes('[meta.name]') === false) {
        exn.textContent = exn.title = '(' + meta.name + ')';
      }

      ex.textContent = meta.ext || 'N/A';
    };

    // offline naming
    const r = response(o instanceof File ? {
      url: 'local/' + o.name
    } : o);
    MyGet.guess(r, meta);

    name();
    // optional online naming (for the first 20 items)
    if (naming < 20 && r.url.startsWith('http') && document.getElementById('online-resolve-name').checked) {
      naming += 1;

      const controller = new AbortController();
      const signal = controller.signal;

      fetch(r.url, {
        method: 'GET',
        signal
      }).then(r => {
        if (r.ok) {
          MyGet.guess(r, meta);
          name();
        }
        controller.abort();
      }).catch(() => {});
    }

    if (r.headers.has('Content-Length')) {
      clone.querySelector('[data-id=size]').textContent = MyGet.size(r.headers.get('Content-Length') || '0');
    }
    else {
      clone.querySelector('[data-id=size]').textContent = '-';
    }
    clone.querySelector('[data-id=href]').textContent = clone.querySelector('[data-id=href]').title = (o.url || 'N/A');

    clone.querySelector('input[data-id=copy]').onclick = e => navigator.clipboard.writeText(o.url).then(() => {
      e.target.value = 'Done';
      setTimeout(() => e.target.value = 'Copy', 750);
    }).catch(e => alert(e.message));

    div.o = o;
    div.meta = meta;

    document.getElementById('hrefs').appendChild(div);
    const c = document.getElementById('hrefs-container');
    c.scrollTop = c.scrollHeight;
  }

  document.body.dataset.mode = document.querySelector('form .entry') ? 'ready' : 'empty';
};

Promise.all([
  chrome.scripting.executeScript({
    target: {
      tabId
    },
    func: url => {
      self.storage = self.storage || new Map();

      if (url && self.storage.has(url) === false) {
        self.storage.set(url, {
          url
        });
      }

      return [...self.storage.values()];
    },
    args: [args.get('append')]
  }).then(a => a[0].result).catch(() => []),
  // get extra available resources
  network.types({core: true, extra: false, sub: true}).then(types => chrome.scripting.executeScript({
    target: {
      tabId
    },
    func: types => performance.getEntries()
      .filter(o => ['video', 'xmlhttprequest'].includes(o.initiatorType))
      .filter(o => {
        for (const type of types) {
          if (o.name.includes('.' + type)) {
            console.log(o.name, type);

            return true;
          }
        }
      })
      .map(o => ({
        initiator: location.href,
        url: o.name,
        timeStamp: performance.now() + o.startTime,
        source: 'performance'
      })),
    world: 'MAIN',
    args: [types]
  }).then(a => a[0].result).catch(() => []))
]).then(async ([os1, os2]) => {
  const os = new Map();

  if (args.get('extra') === 'true') {
    try {
      const links = await new Promise(resolve => chrome.runtime.sendMessage({
        method: 'get-extra',
        tabId
      }, resolve));

      for (const url of links) {
        os.set(url, {url});
      }
    }
    catch (e) {
      console.error(e);
    }
  }
  for (const o of os2) {
    os.set(o.url, o);
  }
  for (const o of os1) { // overwrite os2 which does not include details
    os.set(o.url, o);
  }


  let forbiddens = 0;
  // remove forbidden links
  const blocked = await network.blocked();
  for (const url of os.keys()) {
    if (blocked({url})) {
      os.delete(url);
      forbiddens += 1;
    }
  }

  const items = [...os.values()];

  // m3u8 on top
  items.sort((a, b) => {
    const ah = a.url.includes('m3u8');
    const bh = b.url.includes('m3u8');
    if (ah && bh === false) {
      return -1;
    }
    if (bh && ah === false) {
      return 1;
    }
    return a.timeStamp - b.timeStamp;
  });

  build(items);

  // forbidden
  document.getElementById('forbiddens').textContent = forbiddens;
  if (forbiddens) {
    document.body.classList.add('forbidden');
  }
});

const error = e => {
  console.warn(e);
  document.title = e.message;
  document.body.dataset.mode = 'error';
};

const download = async (segments, file) => {
  document.body.dataset.mode = 'download';
  progress.value = 0;

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
        uri: s.map.uri,
        cache: true // cache this fetch
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
  Object.assign(n.options, await storage.get({
    'threads': MyGet.OPTIONS.threads,
    'error-recovery': MyGet.OPTIONS['error-recovery'],
    'thread-timeout': MyGet.OPTIONS['thread-timeout']
  }));

  // instead of breaking, let the user retry
  n.options['error-handler'] = (e, source, segment) => {
    return self.prompt(`Connection to the server is broken (${source} -> ${e.message})!

Use the box below to update the URL`, {
      ok: 'Retry',
      no: 'Cancel',
      value: segment.uri
    }, true).then(v => {
      if (v) {
        try {
          new URL(v);
          segment.uri = v;
        }
        catch (e) {
          console.info('URL replacement ignored', e);
        }
      }
    });
  };

  console.info('MyGet Instance', n);

  const timer = setInterval(() => {
    // downloading a single file
    if (stat.total === 1) {
      if (n.sizes.has(0)) {
        const percent = stat.fetched / n.sizes.get(0) * 100;
        document.title = percent.toFixed(1) + `% fetched [${MyGet.size(stat.fetched)}/${MyGet.size(n.sizes.get(0))}]` +
          ` [Threads: ${n.actives}]`;

        progress.value = stat.fetched;
        progress.max = n.sizes.get(0);
      }
      else {
        document.title = MyGet.size(stat.fetched) + ' fetched...';
      }
    }
    else {
      document.title = (stat.current / stat.total * 100).toFixed(1) +
        `% fetched [${stat.current}/${stat.total}] (${MyGet.size(stat.fetched)})` + ` [Threads: ${n.actives}]`;

      progress.value = stat.current;
      progress.max = stat.total;
    }
    //
    if (self.aFile) {
      document.title += ' Job [' + self.aFile.stat.index + '/' + self.aFile.stat.total + ']';
    }
  }, 750);

  try {
    // attach disk writer
    n.attach(file);

    await n.fetch(segments);
    clearInterval(timer);

    document.title = 'Done. Media is ready!';
    if ('download' in file) { // Firefox
      file.download(file.name);
    }

    // try to rename
    if (n.meta.name && n.meta.ext && file.move) {
      const name = n.meta.name + '.' + n.meta.ext;
      if (name !== file.name) {
        const input = document.querySelector('[data-active=true] input[data-id=rename]');
        if (input) {
          input.disabled = false;
          input.onclick = e => {
            if (confirm(`Rename media from "${file.name}" to "${name}"?

-> This will overwrite an existing file with the same name.`)) {
              file.move(name);
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
    if (manifest.startsWith('http') || manifest.startsWith('blob:')) {
      o = new URL(manifest);
    }
    else if (href && (href.startsWith('http') || href.startsWith('blob:'))) {
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
    const {quality} = await storage.get({
      quality: 'selector'
    });

    let n = 0; // highest
    // sort based on highest quality
    playlists.sort((a, b) => {
      try {
        return b.attributes.RESOLUTION.width - a.attributes.RESOLUTION.width;
      }
      catch (e) {
        return 0;
      }
    });
    if (quality === 'selector') {
      const msgs = [];

      for (const playlist of playlists) {
        if (playlist.attributes && playlist.attributes.RESOLUTION) {
          msgs.push(playlist.attributes.RESOLUTION.width + ' × ' + playlist.attributes.RESOLUTION.height + ' -> ' + playlist.uri.substr(-60));
        }
        else {
          msgs.push(playlist.uri.substr(-30));
        }
      }
      n = (playlists.length > 1 ? await prompt('Select one stream:\n\n' + msgs.map((m, n) => n + '. ' + m).join('\n'), {
        ok: 'Select Quality',
        no: 'Abort',
        value: 0
      }, true) : 0);
    }
    else if (quality === 'lowest') {
      n = playlists.length - 1;
    }

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

const options = div => {
  const options = {
    types: [{
      description: 'Video or Audio Files'
    }]
  };

  // this way, the file can get played while download is in progress
  if (div.meta.ext === 'm3u8' || div.meta.ext === '') {
    options.types[0].accept = {
      'video/mkv': ['.mkv']
    };
    options.suggestedName =
      (div.meta.gname || div.meta.name || 'Untitled') +
      (div.meta.index ? (' - ' + div.meta.index) : '') +
      '.mkv';
  }
  else if (div.meta.ext) {
    if (div.meta.mime) {
      options.types[0].accept = {
        [div.meta.mime]: ['.' + div.meta.ext]
      };
    }
    options.suggestedName =
      (div.meta.gname || div.meta.name || 'Untitled') +
      (div.meta.index ? (' - ' + div.meta.index) : '') +
      '.' + div.meta.ext;
  }

  return options;
};

document.getElementById('hrefs').onsubmit = async e => {
  e.preventDefault();
  const div = e.submitter.closest('label');
  const button = div.querySelector('input[type="submit"]');

  document.body.dataset.mode = 'prepare';

  try {
    div.dataset.active = true;

    const opts = options(div);
    const file = self.aFile || await window.showSaveFilePicker(opts).catch(e => {
      console.error(e);
      // the explorer rejects the suggested name
      // opts.types[0].accept = {'dd/vv': ['.longextensionfile']};
      if (e instanceof TypeError) {
        return window.showSaveFilePicker({
          types: [{
            accept: {
              'video/mkv': ['.mkv']
            },
            description: 'Video or Audio Files'
          }]
        });
      }
      throw e;
    });
    button.value = 'Processing...';


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
    /* success, done */

    c(document.body.dataset.mode === 'done', 'aFile' in self ? self.aFile.stat.index === self.aFile.stat.total : true);
  }

  button.value = 'Download';
  div.dataset.active = false;
};
