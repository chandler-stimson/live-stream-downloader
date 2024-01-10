
const network = {
  // the headers that need to be recorded
  HEADERS: ['content-length', 'accept-ranges', 'content-type', 'content-disposition'],
  // HOST
  LIST: 'https://cdn.jsdelivr.net/gh/chandler-stimson/live-stream-downloader@latest/v3/network/blocked.json',
  // Cache name
  NAME: 'network.persistent'
};

// supported types
{
  const CORE = [
    'flv', 'avi', 'wmv', 'mov', 'mp4', 'webm', 'mkv', // video
    'pcm', 'wav', 'mp3', 'aac', 'ogg', 'wma', // audio
    'm3u8' // stream
  ];
  const EXTRA = [
    'zip', 'rar', '7z', 'tar.gz',
    'img', 'iso', 'bin',
    'exe', 'dmg', 'deb'
  ];
  const SUB = ['vtt', 'webvtt', 'srt'];

  network.types = (query = {core: true}) => {
    return new Promise(resolve => chrome.storage.local.get({
      'network.types': [
        ...(query.core ? CORE : []),
        ...(query.extra ? EXTRA : []),
        ...(query.sub ? SUB : [])
      ]
    }, prefs => resolve(prefs['network.types'])));
  };
}

// do not allow downloading from blocked resources
{
  network.hosts = () => caches.open(network.NAME).then(async cache => {
    const r = await cache.match(network.LIST);
    if (r) {
      return r;
    }
    return fetch('/network/blocked.json');
  }).then(r => r.json());

  network.blocked = () => network.hosts().then(a => {
    // Currently only supports "host" type
    const list = a.filter(o => o.type === 'host').map(o => o.value);

    const cached = d => {
      return list.some(s => d.url.includes(s) && d.url.split(s)[0].split('/').length === 3);
    };
    network.blocked = () => Promise.resolve(cached);
    return cached;
  });
}

// update network blocked list
{
  const image = async href => {
    const img = await createImageBitmap(await (await fetch(href)).blob());
    const {width: w, height: h} = img;
    const canvas = new OffscreenCanvas(w, h);
    const ctx = canvas.getContext('2d');
    ctx.drawImage(img, 0, 0, w, h);

    return ctx.getImageData(0, 0, w, h);
  };

  // display forbidden icon for blocked hostnames
  const icon = () => chrome.declarativeContent.onPageChanged.removeRules(undefined, async () => {
    const hosts = await network.hosts();
    const list = hosts.filter(o => o.type === 'host').map(o => o.value.replace(/^\./, ''));

    const conditions = list.map(hostSuffix => new chrome.declarativeContent.PageStateMatcher({
      pageUrl: {hostSuffix}
    }));

    chrome.declarativeContent.onPageChanged.addRules([{
      conditions,
      actions: [
        new chrome.declarativeContent.SetIcon({
          imageData: {
            16: await image('/data/icons/forbidden/16.png'),
            32: await image('/data/icons/forbidden/32.png')
          }
        })
      ]
    }]);
  });

  // This list includes the list of rules to get blocked by this extension
  // The extension does not offer downloading resources included in this list
  chrome.alarms.onAlarm.addListener(a => {
    if (a.name === 'update-network') {
      fetch(network.LIST).then(r => {
        if (r.ok) {
          caches.open(network.NAME).then(cache => cache.put(network.LIST, r)).then(icon);
        }
        else {
          icon();
        }
      });
    }
  });
  chrome.runtime.onInstalled.addListener(() => chrome.alarms.create('update-network', {
    when: Date.now() + 1000,
    periodInMinutes: 60 * 24 * 7 // every 7 days
  }));
}
