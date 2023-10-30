let port;
try {
  port = document.getElementById('hls-port');
  port.remove();
}
catch (e) {
  port = document.createElement('span');
  port.id = 'hls-port';
  document.documentElement.append(port);
}

port.addEventListener('media-detected', e => {
  const {url, type} = e.detail;
  chrome.runtime.sendMessage({
    method: 'media-detected',
    context: 'blob-detector-plugin',
    d: {
      url,
      responseHeaders: [{
        name: 'content-type',
        value: type
      }]
    }
  });
});
