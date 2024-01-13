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
  const {content, type} = e.detail;

  console.log(e.detail);

  chrome.runtime.sendMessage({
    method: 'media-detected',
    context: 'blob-detector-plugin',
    d: {
      url: 'data:' + type + ';base64,' + btoa(content),
      responseHeaders: [{
        name: 'content-type',
        value: type
      }]
    }
  });
});
