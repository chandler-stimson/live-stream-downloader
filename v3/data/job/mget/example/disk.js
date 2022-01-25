/* global MyGet, m3u8Parser */

document.getElementById('start').onclick = async () => {
  const handle = await window.showSaveFilePicker({
    types: [{
      description: 'Video',
      accept: {
        'text/plain': ['.ts']
      }
    }]
  });
  const file = await handle.createWritable();

  const parser = new m3u8Parser.Parser();
  const manifest = await fetch('sample/encrypted.m3u8').then(r => r.text());
  parser.push(manifest);
  parser.end();

  parser.manifest.segments = parser.manifest.segments.map(o => {
    o.base = 'http://127.0.0.1:8000/example/sample/';
    return o;
  });

  const n = new MyGet();
  n.attach(file);

  n.fetch(parser.manifest.segments).then(() => {
    console.log('done');
    n.cache.writer.close();
  });
};



// document.getElementById('start').onclick = async () => {
//   const file = await window.showSaveFilePicker({
//     types: [{
//       description: 'ZIP',
//       accept: {
//         'text/plain': ['.zip']
//       }
//     }]
//   });

//   const segments = [{uri: 'http://127.0.0.1:8000/example/sample/med.zip'}];

//   const n = new MyGet();
//   n.attach(file);

//   n.fetch(segments).then(() => {
//     console.log('done', n.cache.cache);
//     n.cache.writer.close();
//   });
// };
