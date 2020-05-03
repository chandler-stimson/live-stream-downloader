/* global Get */
'use strict';

const downloader = url => new Promise((resolve, reject) => {
  const get = new Get({
    configs: {
      'use-native-when-possible': false
    },
    observe: {
      headers() {},
      complete(success, error) {
        if (success) {
          resolve(get);
        }
        else {
          reject(error);
          try {
            get.properties.file.remove();
          }
          catch (e) {}
        }
      }
    }
  });
  get.fetch(url);
});

(async segments => {
  const gets = [];
  const links = segments.map(o => o.uri).filter((s, i, l) => l.indexOf(s) === i);

  for (const link of links) {
    chrome.runtime.sendMessage({
      method: 'badge',
      text: `${links.indexOf(link) + 1}/${links.length}`
    });
    console.log('Downloading', link);
    gets.push(await downloader(link));
  }
  const blobs = [];
  for (const get of gets) {
    const response = new Response(get.properties.file.stream(), {
      headers: {
        'Content-Type': 'video/mp4'
      }
    });
    blobs.push(await response.blob());
  }
  const blob = new Blob(blobs, {
    type: gets[0].properties.mime || 'video/mp4'
  });
  const href = URL.createObjectURL(blob);
  const a = document.createElement('a');
  a.href = href;
  a.download = document.title + '.' + (gets[0].properties.fileextension || 'mp4');
  a.click();
  window.setTimeout(() => {
    URL.revokeObjectURL(href);
  }, 30000);
  chrome.runtime.sendMessage({
    method: 'badge',
    text: ''
  });
})(window.json);
