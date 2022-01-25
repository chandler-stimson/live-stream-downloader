/* global MyGet */

console.log('starting');
const n = new MyGet(undefined);
n.fetch([{
  uri: 'sample/segment.split.1.ts',
  base: 'http://127.0.0.1:8000/example/',
  method: 'GET'
}]).then(() => {
  // remove duplicated chunks (due to error)

  const chunks = {};
  for (const {position, chunk} of n.cache) {
    if (chunks[position]) {
      if (chunks[position].byteLength > chunk.byteLength) {
        chunks[position] = chunk;
      }
    }
    else {
      chunks[position] = chunk;
    }
  }

  const keys = Object.keys(chunks).map(Number);
  keys.sort((a, b) => a - b);

  const b = new Blob(keys.map(k => chunks[k]));
  const href = URL.createObjectURL(b);
  const a = document.createElement('a');
  a.href = href;
  a.download = 'a.bin';
  a.click();
});
