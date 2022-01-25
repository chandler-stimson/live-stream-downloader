'use strict';

const args = new URLSearchParams(location.search);
const file = new File(args.get('id'));
const options = JSON.parse(args.get('options'));

let total = -1;

const port = chrome.runtime.connect({
  name: args.get('id')
});
port.onMessage.addListener(request => {
  if (request.method === 'count') {
    total = request.count;
  }
});
// for encrypted, we need to count offsets
if (options.keys && options.keys.length) {
  total = options.keys.length;
}
else {
  port.postMessage({
    method: 'count'
  });
}

document.getElementById('filename').textContent = options.filename;


const format = (bytes, na = 'NA') => {
  if (bytes <= 0) {
    return na;
  }
  const thresh = 1024;
  if (Math.abs(bytes) < thresh) {
    return bytes + ' B';
  }
  const units = ['KB', 'MB', 'GB', 'TB', 'PB', 'EB', 'ZB', 'YB'];
  let u = -1;
  do {
    bytes /= thresh;
    ++u;
  }
  while (Math.abs(bytes) >= thresh && u < units.length - 1);
  return bytes.toFixed(1) + ' ' + units[u];
};
document.title = 'Move ' + format(options.size) + ' to Disk';

document.getElementById('save').onclick = async e => {
  try {
    const fileextension = options.fileextension || options.mime.split('/')[1];

    const disk = await window.showSaveFilePicker({
      name: options.filename,
      types: [{
        description: options.mime,
        accept: {
          [options.mime]: ['.' + fileextension]
        }
      }]
    });
    const writable = await disk.createWritable();
    await file.open();
    let current = 0;
    const stream = file.stream(options, () => {
      current += 1;
      if (total !== -1) {
        document.title = (current / total * 100).toFixed(0) + '%';
      }
    });

    e.target.disabled = true;
    document.getElementById('remove').disabled = true;
    document.title = 'Please wait...';
    await stream.pipeTo(writable);
    port.postMessage({
      method: 'closed',
      code: 0
    });
    document.title = 'Done';
    window.close();
  }
  catch (e) {
    document.title = e.message;
  }
};

document.getElementById('copy').onclick = () => {
  navigator.clipboard.writeText(options.filename)
    .then(() => document.title = 'Filename is copied to the clipboard')
    .catch(e => document.title = e.message);
};

document.getElementById('remove').onclick = async e => {
  if (window.confirm('Please confirm removing the file from the internal storage')) {
    e.target.disabled = true;
    document.getElementById('save').disabled = true;
    document.title = 'Please wait...';
    await file.open();
    port.postMessage({
      method: 'close-db'
    });
    await file.remove();
    port.postMessage({
      method: 'closed',
      code: 0
    });
    document.title = 'Removed';
    window.close();
  }
};

window.onunload = () => port.postMessage({
  method: 'closed',
  code: -1
});
