
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
    'm3u8', 'mpd' // stream
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
