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

      const type = args[1]?.type;
      if (type === 'application/vnd.apple.mpegurl') {
        const reader = new FileReader();
        reader.onload = () => port.dispatchEvent(new CustomEvent('media-detected', {
          detail: {
            url: reader.result,
            type
          }
        }));
        reader.readAsDataURL(this);
      }
    }
  }
  self.Blob = SpoofBlob;
}
