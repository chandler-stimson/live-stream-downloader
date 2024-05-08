/* global build */

const extract = (code = '') => {
  const links = new Set();

  try {
    const parser = new DOMParser();
    const doc = parser.parseFromString(code, 'text/html');
    for (const a of doc.querySelectorAll('[href]')) {
      links.add(a.href);
    }
    for (const a of doc.querySelectorAll('[src]')) {
      links.add(a.src);
    }
  }
  catch (e) {}

  const parts = code.split(/\s+/);
  parts.forEach(word => {
    try {
      const url = new URL(word);
      links.add(url.href);
    }
    catch (e) {}
  });

  // Inaccurate and most likely truncated links. Only add those that are not extracted with the native method
  const r = /(\b(https?|ftp|file):\/\/[-A-Z0-9+&@#/%?=~_|!:,.;]*[-A-Z0-9+&@#/%=~_|])/ig;
  const alreadyExtracted = [...links.keys()];
  for (const link of (code.match(r) || [])) {
    if (alreadyExtracted.some(a => a.startsWith(link)) === false) {
      links.add(link);
    }
  }

  return links;
};

document.ondragover = e => e.preventDefault();
document.ondrop = e => {
  e.preventDefault();

  if (document.body.dataset.mode === 'download' || document.body.dataset.mode === 'parse') {
    return;
  }

  if (e.dataTransfer.files.length) {
    build([...e.dataTransfer.files]);
  }
  else {
    const code = e.dataTransfer.getData('text/html') || e.dataTransfer.getData('text/plain');

    const links = extract(code);
    links.add(e.dataTransfer.getData('text/uri-list'));

    if (links.size) {
      build([...links].filter(s => s).map(url => ({url})));
    }
    else {
      self.notify('No link is detected!', 750);
    }
  }
};

document.onpaste = e => {
  if (document.body.dataset.mode === 'download' || document.body.dataset.mode === 'parse') {
    return;
  }

  const code = e.clipboardData.getData('Text');

  const links = extract(code);
  if (links.size) {
    build([...links].filter(s => s).map(url => ({url})));
  }
  else {
    self.notify('No link is detected!', 750);
  }
};
