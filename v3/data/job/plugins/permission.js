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
events.after.push(() => chrome.runtime.sendMessage({
  method: 'release-awake-if-possible'
}, () => chrome.runtime.lastError));

window.addEventListener('beforeunload', () => chrome.runtime.sendMessage({
  method: 'release-awake-if-possible'
}, () => chrome.runtime.lastError));

chrome.runtime.onMessage.addListener((request, sender, response) => {
  if (request.method === 'any-active' && document.body.dataset.mode === 'download') {
    response(true);
  }
});
