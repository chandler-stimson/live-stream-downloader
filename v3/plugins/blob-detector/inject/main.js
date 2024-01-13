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

  const OriginalBlob = self.Blob;

  class SpoofBlob extends OriginalBlob {
    constructor(...args) {
      super(...args);

      try {
        const type = args[1]?.type;
        if (type === 'application/vnd.apple.mpegurl') {
          port.dispatchEvent(new CustomEvent('media-detected', {
            detail: {
              type,
              content: args[0].join('')
            }
          }));
        }
      }
      catch (e) {
        console.info('cannot extract M3U8 content', e);
      }
    }
  }
  self.Blob = SpoofBlob;
}
