/* global m3u8Parser, getSegments */
'use strict';

const notify = e => chrome.notifications.create({
  type: 'basic',
  iconUrl: '/data/icons/48.png',
  title: chrome.runtime.getManifest().name,
  message: e.message || e
});

const inspect = d => {
  if (d.tabId && d.tabId > 0) {
    fetch(d.url).then(r => r.text()).then(content => onMessage({
      method: 'manifest',
      content,
      frameId: d.frameId,
      url: d.url
    }, {
      tab: {
        id: d.tabId
      }
    })).catch(e => console.warn('ERROR', e));
  }
};

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

const onMessage = (request, sender) => {
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
        chrome.browserAction.setBadgeText({
          text: Object.keys(segments[tabId]).length + '',
          tabId
        });
      }
      else {
        console.log('IGNORED', parser);
      }
    }
  }
  else if (request.method === 'close') {
    chrome.tabs.executeScript({
      code: `{
        const e = document.getElementById('hsl-drop-down');
        if (e) {
          e.remove();
        }
      }`
    });
  }
};
chrome.runtime.onMessage.addListener(onMessage);

const jobs = {};
chrome.browserAction.onClicked.addListener(tab => {
  const badge = text => chrome.browserAction.setBadgeText({
    tabId: tab.id,
    text
  });

  if (jobs[tab.id]) {
    return chrome.tabs.executeScript({
      code: `confirm('Are you sure you want to abort the active job?')`
    }, ([bol]) => {
      if (bol) {
        badge('');
        notify('Active job is aborted');
        const job = jobs[tab.id];
        delete jobs[tab.id];
        job.abort();
      }
    });
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
    const att = attributes[tab.id];
    const aa = playlists[a].filter(s => att[s]).filter(s => att[s].RESOLUTION).sort((a, b) => {
      return att[a].RESOLUTION.width - att[b].RESOLUTION.width;
    }).shift();
    const ab = playlists[b].filter(s => att[s]).filter(s => att[s].RESOLUTION).sort((a, b) => {
      return att[a].RESOLUTION.width - att[b].RESOLUTION.width;
    }).shift();

    if (aa && ab) {
      return att[ab].RESOLUTION.width - att[aa].RESOLUTION.width;
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

  chrome.tabs.executeScript({
    code: `{
      const msg = ${JSON.stringify(msg)}.join('\\n');
      prompt('Select n stream:\\n\\n' + msg, 1);
    }`,
    runAt: 'document_start'
  }, arr => {
    if (arr && arr.length) {
      const index = arr[0];
      if (list[Number(index) - 1] && list[Number(index) - 1][1]) {
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
            badge(Object.keys(segments[tab.id]).length + '');
          });
        }).catch(e => {
          badge('E');
          console.warn(e);
        }).finally(() => delete jobs[tab.id]);
      }
      else if (index) {
        console.log(index, Number(index) - 1, list[Number(index) - 1]);
        notify('Selected index is out of range');
      }
    }
  });
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

chrome.contextMenus.create({
  title: 'Parse with Live Stream Downloader',
  contexts: ['link'],
  targetUrlPatterns: ['*://*/*.m3u8*'],
  onclick: (info, tab) => inspect({
    tabId: tab.id,
    frameId: info.frameId,
    url: info.linkUrl
  })
});
chrome.contextMenus.create({
  title: 'Parse a Local M3U8 File with Live Stream Downloader',
  contexts: ['browser_action', 'page'],
  onclick: () => chrome.tabs.executeScript({
    runAt: 'document_start',
    code: `{
      const e = document.getElementById('hsl-drop-down');
      if (e) {
        e.remove();
      }
      const iframe = document.createElement('iframe');
      iframe.id = 'hsl-drop-down';
      iframe.style = 'border: none; position: fixed; top: 10px; right: 10px; width: 400px;' +
                     'height: 200px; box-shadow: 0 1px 6px 0 rgba(32,33,36,0.28); z-index: 2147483647;';
      iframe.src = chrome.runtime.getURL('/data/scripts/user.html');
      document.body.appendChild(iframe);
      console.log(iframe);
    }`
  })
});

/* FAQs & Feedback */
{
  const {management, runtime: {onInstalled, setUninstallURL, getManifest}, storage, tabs} = chrome;
  if (navigator.webdriver !== true) {
    const page = getManifest().homepage_url;
    const {name, version} = getManifest();
    onInstalled.addListener(({reason, previousVersion}) => {
      management.getSelf(({installType}) => installType === 'normal' && storage.local.get({
        'faqs': true,
        'last-update': 0
      }, prefs => {
        if (reason === 'install' || (prefs.faqs && reason === 'update')) {
          const doUpdate = (Date.now() - prefs['last-update']) / 1000 / 60 / 60 / 24 > 45;
          if (doUpdate && previousVersion !== version) {
            tabs.create({
              url: page + '?version=' + version + (previousVersion ? '&p=' + previousVersion : '') + '&type=' + reason,
              active: reason === 'install'
            });
            storage.local.set({'last-update': Date.now()});
          }
        }
      }));
    });
    setUninstallURL(page + '?rd=feedback&name=' + encodeURIComponent(name) + '&version=' + version);
  }
}
