/* global m3u8Parser, getSegments */
'use strict';

const notify = e => chrome.notifications.create({
  type: 'basic',
  iconUrl: '/data/icons/48.png',
  title: chrome.runtime.getManifest().name,
  message: e.message || e
});

const inspect = d => chrome.tabs.executeScript(d.tabId, {
  runAt: 'document_start',
  frameId: d.frameId,
  code: `fetch("${d.url}").then(r => r.text()).then(content => chrome.runtime.sendMessage({
    method: 'manifest',
    content,
    frameId: ${d.frameId},
    url: '${d.url}'
  })).catch(e => console.warn('ERROR', e));`
});

const cache = {};
chrome.webRequest.onBeforeRequest.addListener(d => {
  cache[d.tabId] = cache[d.tabId] || {};
  if (cache[d.tabId][d.url]) {
    return;
  }
  cache[d.tabId][d.url] = true;
  inspect(d);
}, {
  urls: ['*://*/*.m3u8', '*://*/*.m3u8*']
});

const segments = {};
const attributes = {};
chrome.tabs.onRemoved.addListener(tabId => {
  delete segments[tabId];
  delete attributes[tabId];
  delete cache[tabId];
});
chrome.webNavigation.onCommitted.addListener(d => {
  if (d.frameId === 0) {
    delete segments[d.tabId];
    delete attributes[d.tabId];
    delete cache[d.tabId];
  }
});
const path = (root, rel) => {
  let a = root.split('/');
  const b = rel.split('/').filter(a => a);
  const index = a.indexOf(b[0]);
  if (index === -1) {
    a.pop();
  }
  else {
    a = a.slice(0, index);
  }
  a.push(rel);
  return a.join('/');
};

chrome.runtime.onMessage.addListener((request, sender) => {
  const tabId = sender.tab.id;

  if (request.method === 'manifest') {
    const parser = new m3u8Parser.Parser();
    parser.push(request.content);
    parser.end();
    const {manifest} = parser;
    if (manifest) {
      if (manifest.playlists) {
        for (const playlist of manifest.playlists) {
          let url = playlist.uri;
          if (url.startsWith('http') === false) {
            url = path(request.url, url);
          }
          attributes[tabId] = attributes[tabId] || {};
          attributes[tabId][url] = playlist.attributes;
          inspect({
            tabId,
            frameId: request.frameId,
            url
          });
        }
      }
      else if (manifest.segments && manifest.segments.length) {
        segments[tabId] = segments[tabId] || {};
        segments[tabId][request.url] = manifest.segments.map(o => {
          if (o.uri.startsWith('http')) {
            return o;
          }
          else {
            return {
              ...o,
              uri: path(request.url, o.uri)
            };
          }
        });
        segments[tabId][request.url].frameId = request.frameId;

        chrome.browserAction.setIcon({
          tabId,
          path: {
            '16': 'data/icons/active/16.png',
            '19': 'data/icons/active/19.png',
            '32': 'data/icons/active/32.png',
            '38': 'data/icons/active/38.png',
            '48': 'data/icons/active/48.png',
            '64': 'data/icons/active/64.png'
          }
        });
      }
      else {
        console.log('IGNORED', parser);
      }
    }
  }
});

const jobs = {};
chrome.browserAction.onClicked.addListener(tab => {
  const badge = text => chrome.browserAction.setBadgeText({
    tabId: tab.id,
    text
  });

  if (jobs[tab.id]) {
    if (confirm('Are you sure you want to abort the active job?')) {
      badge('');
      notify('Active job is aborted');
      const job = jobs[tab.id];
      delete jobs[tab.id];
      job.abort();
    }
    return;
  }

  if (!segments[tab.id]) {
    return notify('No HLS stream is detected for this tab');
  }

  const playlists = {};
  Object.keys(segments[tab.id]).forEach(url => {
    const playlist = url.split('/').pop().split(/[?#]/)[0].replace('.m3u8', '');
    playlists[playlist] = playlists[playlist] || [];
    playlists[playlist].push(url);
  });
  for (const key of Object.keys(playlists)) {
    playlists[key].sort((a, b) => {
      const aa = attributes[tab.id] ? attributes[tab.id][a] : null;
      const ab = attributes[tab.id] ? attributes[tab.id][b] : null;

      if (aa && ab && aa.RESOLUTION && ab.RESOLUTION) {
        return ab.RESOLUTION.width - aa.RESOLUTION.width;
      }
      if (aa && aa.RESOLUTION) {
        return -1;
      }
      if (ab && ab.RESOLUTION) {
        return +1;
      }
    });
  }
  const list = [];
  for (const playlist of Object.keys(playlists).sort((a, b) => {
    const aa = playlists[a].filter(s => attributes[tab.id][s]).filter(s => attributes[tab.id][s].RESOLUTION).sort((a, b) => {
      return attributes[tab.id][a].RESOLUTION.width - attributes[tab.id][b].RESOLUTION.width;
    }).shift();
    const ab = playlists[b].filter(s => attributes[tab.id][s]).filter(s => attributes[tab.id][s].RESOLUTION).sort((a, b) => {
      return attributes[tab.id][a].RESOLUTION.width - attributes[tab.id][b].RESOLUTION.width;
    }).shift();

    if (aa && ab) {
      return attributes[tab.id][ab].RESOLUTION.width - attributes[tab.id][aa].RESOLUTION.width;
    }
    if (aa) {
      return -1;
    }
    if (ab) {
      return 1;
    }
  })) {
    for (const url of playlists[playlist]) {
      list.push([playlist, url]);
    }
  }
  const msg = [];
  list.forEach(([playlist, url], i) => {
    const attribute = attributes[tab.id] ? attributes[tab.id][url] : null;
    const segment = segments[tab.id][url];
    let extension = 'NA';
    if (segment[0].uri.indexOf('.') !== -1) {
      extension = segment[0].uri.split('.').pop().split('?')[0].toUpperCase();
    }
    const num = ('0' + (i + 1)).substr(-2);
    if (attribute && attribute.RESOLUTION) {
      const {width, height} = attribute.RESOLUTION;
      msg.push(`${num}. [${playlist.substr(-10)}] ${extension} ${width}x${height} - ${segment.length} segments`);
    }
    else {
      msg.push(`${num}. [${playlist.substr(-10)}] ${extension} Stream - ${segment.length} segments`);
    }
  });

  const index = prompt('Select an stream:\n\n' + msg.join('\n'), 1);
  if (index) {
    const segment = segments[tab.id][list[Number(index) - 1][1]];
    let extension = '';
    if (segment[0].uri.indexOf('.') !== -1) {
      extension = segment[0].uri.split('.').pop().split('?')[0];
    }
    const controls = {};
    jobs[tab.id] = controls;
    getSegments(tab.title, segment, badge, controls).then(o => {
      const url = URL.createObjectURL(o.blob);
      const filename = o.properties.filename + '.' + extension || o.properties.fileextension || 'mkv';
      chrome.downloads.download({
        url,
        filename
      }, () => {
        URL.revokeObjectURL(url);
        badge('');
      });
    }).catch(e => {
      badge('E');
      console.warn(e);
    }).finally(() => delete jobs[tab.id]);
  }
});
chrome.tabs.onRemoved.addListener(tabId => {
  if (jobs[tabId]) {
    notify('Active job is aborted');
    jobs[tabId].abort();
  }
});
chrome.webNavigation.onCommitted.addListener(d => {
  if (d.frameId === 0 && jobs[d.tabId]) {
    notify('Active job is aborted');
    jobs[d.tabId].abort();
  }
});
