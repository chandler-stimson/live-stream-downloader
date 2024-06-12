// links
for (const a of [...document.querySelectorAll('[data-href]')]) {
  if (a.hasAttribute('href') === false) {
    a.href = browser.runtime.getManifest().homepage_url + '#' + a.dataset.href;
  }
}
