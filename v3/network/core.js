
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
network.blocked = () => caches.open(network.NAME).then(async cache => {
  const r = await cache.match(network.LIST);
  if (r) {
    return r;
  }
  return fetch('/network/blocked.json');
}).then(r => r.json()).then(a => {
  const list = a.map(o => o.value);

  // currently only supports type=host
  return d => {
    return list.some(s => d.url.includes(s) && d.url.split(s)[0].split('/').length === 3);
  };
});

// update network blocked list
{
  // This list includes the list of rules to get blocked by this extension
  // The extension does not offer downloading resources included in this list
  chrome.alarms.onAlarm.addListener(a => {
    if (a.name === 'update-network') {
      fetch(network.LIST).then(r => {
        if (r.ok) {
          caches.open(network.NAME).then(cache => cache.put(network.LIST, r));
        }
      });
    }
  });
  chrome.runtime.onInstalled.addListener(() => chrome.alarms.create('update-network', {
    when: Date.now() + 1000,
    periodInMinutes: 60 * 24 // every 24 hours
  }));
}
