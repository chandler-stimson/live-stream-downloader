/* global events */

chrome.permissions.contains({
  permissions: ['power']
}, granted => {
  if (granted === false) {
    const div = document.createElement('div');
    div.textContent = 'Use Ctrl + P or Command + P once to allow the extension to keep your computer awake while downloading';

    document.getElementById('intro').appendChild(div);
  }
});

window.addEventListener('keydown', e => {
  const meta = e.ctrlKey || e.metaKey;

  if (e.code === 'KeyP' && meta) {
    e.preventDefault();

    chrome.permissions.request({
      permissions: ['power']
    }, granted => granted && self.notify('Done, Reopen this window to apply', 750));
  }
});

events.before.push(() => {
  if (chrome.power) {
    chrome.power.requestKeepAwake('display');
  }
});
events.after.push(() => {
  if (chrome.power) {
    chrome.power.releaseKeepAwake();
  }
});
