/* global events */

chrome.permissions.contains({
  permissions: ['power']
}, granted => {
  document.getElementById('power').checked = granted;
});

document.getElementById('power').addEventListener('change', e => {
  if (e.target.checked) {
    chrome.permissions.request({
      permissions: ['power']
    }, granted => {
      if (granted) {
        self.notify('Done, Reopen this window to apply', 2000);
      }
      else {
        e.target.checked = false;
      }
    });
  }
  else {
    chrome.permissions.remove({
      permissions: ['power']
    });
    self.notify('Done, Reopen this window to apply', 2000);
  }
});

events.before.add(() => {
  if (chrome.power) {
    chrome.power.requestKeepAwake('display');
  }
});
events.after.add(() => chrome.runtime.sendMessage({
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
