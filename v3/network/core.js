
const network = {
  // the headers that need to be recorded
  HEADERS: ['content-length', 'accept-ranges', 'content-type', 'content-disposition'],
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
    return new Promise(resolve => browser.storage.local.get({
      'network.types': [
        ...(query.core ? CORE : []),
        ...(query.extra ? EXTRA : []),
        ...(query.sub ? SUB : [])
      ]
    }, prefs => resolve(prefs['network.types'])));
  };
}
