/**
    MyGet - A multi-thread downloading library
    Copyright (C) 2014-2022 [Chandler Stimson]

    This program is free software: you can redistribute it and/or modify
    it under the terms of the Mozilla Public License as published by
    the Mozilla Foundation, either version 2 of the License, or
    (at your option) any later version.
    This program is distributed in the hope that it will be useful,
    but WITHOUT ANY WARRANTY; without even the implied warranty of
    MERCHANTABILITY or FITNESS FOR A PARTICULAR PURPOSE.  See the
    Mozilla Public License for more details.
    You should have received a copy of the Mozilla Public License
    along with this program.  If not, see {https://www.mozilla.org/en-US/MPL/}.

    GitHub: https://github.com/chandler-stimson/live-stream-downloader/
    Homepage: https://webextension.org/listing/hls-downloader.html
*/

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
    // Currently only supports "host" and "stream" types
    const hosts = a.filter(o => o.type === 'host').map(o => o.value);
    const streams = a.filter(o => o.type === 'stream').map(o => o.value);

    return d => {
      if (d.host) {
        if (hosts.some(s => d.host.includes(s) && d.host.split(s)[0].split('/').length === 3)) {
          return true;
        }
      }
      if (d.stream) {
        if (streams.some(s => d.stream.includes(s))) {
          return true;
        }
      }
      return false;
    };
  });
}
