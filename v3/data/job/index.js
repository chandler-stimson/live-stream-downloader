/* global MyGet, m3u8Parser */

const args = new URLSearchParams(location.search);

const tabId = Number(args.get('tabId')); // original tab
let cId; // id of this tab

let initiator = args.get('href');

document.title += ' from "' + args.get('title') + '"';

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
chrome.tabs.query({
  active: true,
  currentWindow: true
}, tbs => cId = tbs[0].id);

chrome.storage.session.get({
  [tabId]: []
}, prefs => {
  const os = prefs[tabId];
  // const os = [{
  //   url: 'http://127.0.0.1:8000/example/sample/unencrypted.m3u8'
  // }, {
  //   url: 'https://bitdash-a.akamaihd.net/content/sintel/hls/playlist.m3u8'
  // }, {
  //   url: 'https://bitdash-a.akamaihd.net/content/MI201109210084_1/m3u8s/f08e80da-bf1d-4e3d-8899-f0f6155f6efa.m3u8'
  // }];

  const t = document.getElementById('entry');
  for (const o of os) {
    const clone = document.importNode(t.content, true);

    const meta = {};
    const r = response(o);
    MyGet.guess(r, meta);

    clone.querySelector('[data-id=name]').textContent = clone.querySelector('[data-id=name]').title = meta.name;
    clone.querySelector('[data-id=ext]').textContent = meta.ext;
    clone.querySelector('[data-id=size]').textContent = MyGet.size(r.headers.get('Content-Length') || '0');
    clone.querySelector('[data-id=href]').textContent = clone.querySelector('[data-id=href]').title = o.url;

    const div = clone.querySelector('div');
    div.response = r;
    div.url = o.url;
    div.initiator = o.initiator;
    div.meta = meta;

    document.getElementById('hrefs').appendChild(div);
  }
});

const error = e => {
  console.warn(e);
  document.title = e.message;
  document.body.dataset.mode = 'error';
};

const net = {
  async id() {
    const rules = await chrome.declarativeNetRequest.getSessionRules();
    for (let i = 1; i < chrome.declarativeNetRequest.MAX_NUMBER_OF_DYNAMIC_RULES; i += 1) {
      if (rules.some(o => o.id === i) === false) {
        return i;
      }
    }
    throw Error('MAX_NUNBER_ACTIVE_RULES');
  },
  async add(href) {
    const id = await net.id();
    await chrome.declarativeNetRequest.updateSessionRules({
      removeRuleIds: [id],
      addRules: [{
        id,
        'action': {
          'type': 'modifyHeaders',
          'requestHeaders': [{
            'operation': 'set',
            'header': 'referer',
            'value': initiator
          }]
        },
        'condition': {
          'urlFilter': href,
          'tabIds': [cId]
        }
      }]
    });

    return id;
  },
  remove(id) {
    return chrome.declarativeNetRequest.updateSessionRules({
      removeRuleIds: [id]
    });
  }
};

const download = async (segments, file) => {
  document.body.dataset.mode = 'download';
  const n = new MyGet();

  const stat = {
    fetched: 0,
    current: 0,
    total: segments.length
  };

  const timer = setInterval(() => {
    // downloading a single file
    if (stat.total === 1) {
      if (n.sizes.has(0)) {
        document.title = (stat.fetched / n.sizes.get(0) * 100).toFixed(1) + '% fetched';
      }
      else {
        document.title = MyGet.size(stat.fetched) + ' fetched...';
      }
    }
    else {
      document.title = (stat.current / stat.total * 100).toFixed(1) + '% fetched...';
    }
  }, 500);

  try {
    // attach disk writer
    n.attach(file);

    // monitor progress
    n.monitor = function(segment, position, size) {
      stat.current = position;
      stat.fetched += size;
    };

    // referer header
    n.prepare = async function(segment) {
      try {
        const {href} = new URL(segment.uri, segment.base || undefined);
        segment.rId = await net.add(href);
      }
      catch (e) {}
    };
    n.flush = async function(segment) {
      try {
        await net.remove(segment.rId);
      }
      catch (e) {}
    };

    await n.fetch(segments);
    clearInterval(timer);
    document.title = 'Done. Media is ready!';

    // try to rename
    if (n.meta.name && n.meta.ext) {
      const name = n.meta.name + '.' + n.meta.ext;
      if (name !== file.name) {
        if (confirm(`Your media is ready! Would you like to rename it from "${file.name}" to "${name}"?

  -> This will overwrite an existing file with the same name.`)) {
          file.rename(name);
        }
      }
    }

    document.body.dataset.mode = 'ready';
  }
  catch (e) {
    error(e);
    clearInterval(timer);
  }
};

const parser = async (href, file) => {
  document.title = 'Parsing M3U8 manifest ...';
  document.body.dataset.mode = 'parse';

  const manifest = await fetch(href).then(r => {
    if (r.ok) {
      return r.text();
    }
    throw Error('FAILED_TO_FETCH_' + r.status);
  });
  const p = new m3u8Parser.Parser();

  p.push(manifest);
  p.end();

  const playlists = p.manifest.playlists || [];
  if (playlists.length) {
    const msgs = [];
    for (const playlist of playlists) {
      if (playlist.attributes && playlist.attributes.RESOLUTION) {
        msgs.push(playlist.attributes.RESOLUTION.width + ' × ' + playlist.attributes.RESOLUTION.height + ' -> ' + playlist.uri.substr(-30));
      }
      else {
        msgs.push(playlist.uri.substr(-30));
      }
    }
    const n = prompt('Select one stream:\n\n' + msgs.map((m, n) => n + '. ' + m).join('\n'), 0);
    console.log(n);

    if (n && isNaN(n) === false) {
      const v = playlists[Number(n)];
      if (v) {
        const o = new URL(v.uri, href);
        return parser(o.href, file);
      }
    }
    throw Error('USER_ABORT');
  }

  const segments = p.manifest.segments.map(o => {
    o.base = href;
    return o;
  });

  document.title = 'Downloading ' + href;
  return download(segments, file);
};

document.getElementById('hrefs').onsubmit = async e => {
  e.preventDefault();

  try {
    const div = e.submitter.closest('div');

    const options = {
      types: [{
        description: 'Video or Audio Files'
      }]
    };
    // this way, the file can get played will download is in progress
    if (div.meta.ext === 'm3u8') {
      div.meta.ext = 'mkv';
      div.meta.mime = 'video/mkv';
    }
    if (div.meta.ext && div.meta.mime) {
      options.types[0].accept = {
        [div.meta.mime]: ['.' + div.meta.ext]
      };
    }
    const file = await window.showSaveFilePicker(options);

    // fix initiator
    initiator = div.initiator || args.get('href');

    if (div.url.indexOf('.m3u8') === -1) {
      document.title = 'Downloading ' + div.url;
      await download([{
        uri: div.url
      }], file);
    }
    else {
      await parser(div.url, file);
    }
  }
  catch (e) {
    error(e);
  }
};
