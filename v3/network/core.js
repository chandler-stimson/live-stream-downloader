
const network = {
  // the headers that need to be recorded
  HEADERS: ['content-length', 'accept-ranges', 'content-type', 'content-disposition']
};

{
  // supported types
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

  network.types = (options = {core: true}) => {
    return new Promise(resolve => chrome.storage.local.get({
      'network.types': [
        ...(options.core ? CORE : []),
        ...(options.extra ? EXTRA : []),
        ...(options.sub ? SUB : [])
      ]
    }, prefs => resolve(prefs['network.types'])));
  };
}

// do not allow downloading from blocked resources
network.blocked = () => caches.open('network').then(async cache => {
  const r = await cache.match('/network/blocked.json');
  if (r) {
    console.log('using cache');
    return r;
  }
  return fetch('/network/blocked.json');
}).then(r => r.json()).then(a => {
  const list = a.map(o => o.value);

  return d => list.some(s => d.url.includes(s) && d.url.split(s)[0].split('/').length === 3);
});

// update network blocked list
{
  // This list includes the latest list of rules to get blocked by this extension
  // The extension does not offer downloading resources included in this list
  const host = 'https://cdn.jsdelivr.net/gh/chandler-stimson/live-stream-downloader@latest/v3/network/blocked.json';
  chrome.alarms.onAlarm.addListener(a => {
    if (a.name === 'update-network') {
      fetch(host).then(r => {
        if (r.ok) {
          console.log('updating cache');
          caches.open('network').then(cache => cache.put('/network/blocked.json', r));
        }
      });
    }
  });
  chrome.runtime.onInstalled.addListener(() => chrome.alarms.create('update-network', {
    delayInMinutes: 1,
    periodInMinutes: 60 * 24 // every 24 hours
  }));
}
