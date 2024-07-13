{
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

  self.Blob = new Proxy(self.Blob, {
    construct(Target, args) {
      try {
        const type = args[1]?.type;

        if (type === 'application/vnd.apple.mpegurl') {
          port.dispatchEvent(new CustomEvent('media-detected', {
            detail: {
              content: args[0].join(''),
              type
            }
          }));
        }
      }
      catch (e) {
        console.info('cannot extract M3U8 content', e);
      }

      return new Target(...args);
    }
  });
}
