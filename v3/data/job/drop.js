/* global build */

document.ondragover = e => e.preventDefault();
document.ondrop = e => {
  e.preventDefault();

  if (e.dataTransfer.files.length) {
    build([...e.dataTransfer.files]);
  }
  else {
    const links = new Set();

    links.add(e.dataTransfer.getData('text/uri-list'));

    const code =
      e.dataTransfer.getData('text/html') ||
      e.dataTransfer.getData('text/plain') || '';

    const parser = new DOMParser();
    const doc = parser.parseFromString(code, 'text/html');
    for (const a of doc.querySelectorAll('[href]')) {
      links.add(a.href);
    }
    for (const a of doc.querySelectorAll('[src]')) {
      links.add(a.src);
    }
    const r = /(\b(https?|ftp|file):\/\/[-A-Z0-9+&@#/%?=~_|!:,.;]*[-A-Z0-9+&@#/%=~_|])/ig;
    for (const link of (code.match(r) || [])) {
      links.add(link);
    }

    if (links.size) {
      build([...links].filter(s => s).map(url => ({url})));
    }
  }
};
