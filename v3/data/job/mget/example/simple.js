/* global MyGet */

console.log('starting');
const n = new MyGet(undefined);
n.fetch([{
  uri: 'sample/small.zip',
  base: 'http://127.0.0.1:8000/example/',
  method: 'GET'
}]).then(() => {
  const os = Object.values(n.cache).flat();
  os.sort((a, b) => a.offset - b.offset);
  const chunks = os.map(o => o.chunk);

  const b = new Blob(chunks, {
    type: n.meta.mime
  });
  const href = URL.createObjectURL(b);
  const a = document.createElement('a');
  a.href = href;
  a.download = n.meta.name + '.' + n.meta.ext;

  a.click();
});
