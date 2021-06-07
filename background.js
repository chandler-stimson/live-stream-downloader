/* global manager */
'use strict';

const CONFIG = {
  'use-native-when-possible': false,
  'min-segment-size': 100 * 1024,
  'max-segment-size': 100 * 1024 * 1024,
  'absolute-max-segment-size': 100 * 1024 * 1024,
  'overwrite-segment-size': true,
  'max-number-of-threads': 3,
  'max-retires': 10,
  'speed-over-seconds': 10,
  'max-simultaneous-writes': 3,
  'max-number-memory-chunks': 500
};

const notify = e => chrome.notifications.create({
  type: 'basic',
  iconUrl: '/data/icons/48.png',
  title: chrome.runtime.getManifest().name,
  message: e.message || e
});

const cache = {};
chrome.tabs.onRemoved.addListener(tabId => delete cache[tabId]);

const active = tabId => chrome.browserAction.setIcon({
  tabId,
  path: {
    '16': 'data/icons/active/16.png',
    '19': 'data/icons/active/19.png',
    '32': 'data/icons/active/32.png',
    '38': 'data/icons/active/38.png',
    '48': 'data/icons/active/48.png'
  }
});

const webRequest = {
  observe(d) {
    if (d.tabId > 0) {
      cache[d.tabId] = cache[d.tabId] || {};
      cache[d.tabId][d.url] = d.frameId;
      active(d.tabId);
    }
  },
  apply() {
    chrome.webRequest.onBeforeRequest.addListener(webRequest.observe, {
      urls: ['*://*/*'],
      types: ['media']
    });
    chrome.webRequest.onBeforeRequest.addListener(webRequest.observe, {
      urls: [
        '*://*/*.flv*', '*://*/*.avi*', '*://*/*.wmv*', '*://*/*.mov*', '*://*/*.mp4*',
        '*://*/*.pcm*', '*://*/*.wav*', '*://*/*.mp3*', '*://*/*.aac*', '*://*/*.ogg*', '*://*/*.wma*',
        '*://*/*.m3u8*'
      ],
      types: ['xmlhttprequest']
    });
    // reset
    chrome.webRequest.onBeforeRequest.addListener(d => {
      cache[d.tabId] = {};
    }, {
      urls: ['*://*/*'],
      types: ['main_frame']
    });
  }
};
webRequest.apply();

// remove job on tab close
chrome.tabs.onRemoved.addListener(tabId => {
  const id = Object.keys(ds).filter(id => ds[id].tabId === tabId).shift();
  if (id) {
    manager.cancel(id);
  }
});

const onClicked = (tab, jobs) => {
  const id = Object.keys(ds).filter(id => ds[id].tabId === tab.id).shift();
  if (id) {
    const msg = 'Are you sure you want to abort the active job?';
    chrome.tabs.executeScript({
      code: `confirm('${msg}')`
    }, ar => {
      // on protected tabs use window.confirm instead of injecting script
      if (chrome.runtime.lastError ? confirm(msg) : ar[0]) {
        notify('Active job is aborted');
        manager.cancel(id);
      }
    });
  }
  else {
    chrome.storage.local.get({
      'job-width': 700,
      'job-height': 500,
      'job-left': screen.availLeft + Math.round((screen.availWidth - 700) / 2),
      'job-top': screen.availTop + Math.round((screen.availHeight - 500) / 2)
    }, prefs => {
      jobs = jobs || Object.keys(cache[tab.id] || {}).map(link => ({
        link
      }));
      const args = new URLSearchParams();
      args.append('tabId', tab.id);
      args.append('referrer', tab.url);
      args.append('css', `
        :root {
          --blue: #da8b2e;
        }
        #tools {
          grid-template-columns: min-content min-content;
        }
        #store,
        #merge {
          display: none;
        }
      `);
      args.append('jobs', JSON.stringify(jobs));

      chrome.windows.create({
        url: 'data/add/index.html?' + args.toString(),
        width: prefs['job-width'],
        height: prefs['job-height'],
        left: prefs['job-left'],
        top: prefs['job-top'],
        type: 'popup'
      });
    });
  }
};
chrome.browserAction.onClicked.addListener(onClicked);

const ds = {};

chrome.runtime.onMessage.addListener((request, sender, response) => {
  if (request.method === 'add-jobs') {
    if (request.jobs.length) {
      (async () => {
        for (const {link, referrer, links, base, keys, filename, threads} of request.jobs) {
          const job = {
            url: link,
            filename,
            referrer: referrer
          };
          if (links) {
            delete job.url;
            job.urls = links;
            job.keys = keys;
            if (base) {
              job.urls = job.urls.map(s => s.startsWith('http') ? s : base + s);
            }
          }
          timer.count += 1;
          manager.download(job, id => {
            ds[id] = {
              tabId: request.tabId
            };
            timer.check();
          }, {
            ...CONFIG,
            ...(request.configs || {}),
            'max-number-of-threads': threads ? Math.min(8, threads) : 3
          });
          await new Promise(resolve => setTimeout(resolve, 300));
        }
      })();
      response(true);
    }
    else {
      notify('There is no link to download');
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
  else if (request.method === 'open-add') {
    console.log(request);
    onClicked(sender.tab, request.jobs);
  }
});

const badge = (tabId, text) => chrome.browserAction.setBadgeText({
  tabId,
  text
});

const timer = {
  id: null,
  count: 0,
  tick() {
    for (const id of Object.keys(ds)) {
      manager.search({
        id
      }, ([d]) => {
        if (d) {
          let p = d.m3u8.current / d.m3u8.count * 100;
          if (d.bytesReceived) {
            p += (d.bytesReceived / d.totalBytes) / d.m3u8.count * 100;
          }
          badge(ds[id].tabId, p.toFixed(0) + '%');
        }
      });
    }
  },
  start() {
    clearInterval(timer.id);
    timer.id = setInterval(timer.tick, 1000);
  },
  stop() {
    clearInterval(timer.id);
  },
  check() {
    if (timer.count === 1) {
      timer.start();
    }
    else if (timer.count === 0) {
      timer.stop();
    }
  }
};
// remove when done
manager.onChanged.addListener(d => {
  if (ds[d.id]) {
    if ('native' in d || 'error' in d) {
      timer.count -= 1;
      timer.check();
      badge(ds[d.id].tabId, '');
      delete ds[d.id];
    }
  }
  // delete all none native jobs that are not handled anymore
  else if ('filename' in d && manager.native(d.id) === false) {
    console.log('removing an old job', d);
    manager.erase(d);
  }
});

// conext menu
chrome.contextMenus.create({
  title: 'Parse with Live Stream Downloader',
  contexts: ['link'],
  targetUrlPatterns: ['*://*/*.m3u8*'],
  onclick: (info, tab) => onClicked(tab, [{
    link: info.linkUrl
  }])
});
chrome.contextMenus.create({
  title: 'Test HLS Parsing',
  contexts: ['browser_action'],
  targetUrlPatterns: ['*://*/*'],
  onclick() {
    chrome.tabs.create({
      url: 'https://webbrowsertools.com/test-download-with/'
    });
  }
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
    }`
  }, () => {
    const lastError = chrome.runtime.lastError;
    if (lastError) {
      notify(lastError.message);
    }
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
            tabs.query({active: true, currentWindow: true}, tbs => tabs.create({
              url: page + '?version=' + version + (previousVersion ? '&p=' + previousVersion : '') + '&type=' + reason,
              active: reason === 'install',
              ...(tbs && tbs.length && {index: tbs[0].index + 1})
            }));
            storage.local.set({'last-update': Date.now()});
          }
        }
      }));
    });
    setUninstallURL(page + '?rd=feedback&name=' + encodeURIComponent(name) + '&version=' + version);
  }
}
