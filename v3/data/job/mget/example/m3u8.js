/* global MyGet, m3u8Parser */

fetch('sample/unencrypted.m3u8').then(r => r.text()).then(manifest => {
  const parser = new m3u8Parser.Parser();

  parser.push(manifest);
  parser.end();

  parser.manifest.segments = parser.manifest.segments.map(o => {
    o.base = 'http://127.0.0.1:8000/example/sample/';
    return o;
  });

  const n = new MyGet();
  n.fetch(parser.manifest.segments).then(() => {
    const os = Object.values(n.cache).flat();
    os.sort((a, b) => a.offset - b.offset);
    const chunks = os.map(o => o.chunk);


    const b = new Blob(chunks);
    const href = URL.createObjectURL(b);
    const a = document.createElement('a');
    a.href = href;
    a.download = n.meta.name + '.' + n.meta.ext;
    a.click();
  });
});
