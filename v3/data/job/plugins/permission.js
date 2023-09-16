/* global events */

if (/Firefox/.test(navigator.userAgent)) {
  document.getElementById('power-container').classList.add('disabled');
}
else {
  chrome.permissions.contains({
    permissions: ['power']
  }, granted => {
    chrome.runtime.lastError;
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

  addEventListener('beforeunload', () => chrome.runtime.sendMessage({
    method: 'release-awake-if-possible'
  }, () => chrome.runtime.lastError));

  chrome.runtime.onMessage.addListener((request, sender, response) => {
    if (request.method === 'any-active' && document.body.dataset.mode === 'download') {
      response(true);
    }
  });
}

