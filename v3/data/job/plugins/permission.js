/* global events */

if (/Firefox/.test(navigator.userAgent)) {
  document.getElementById('power-container').classList.add('disabled');
}
else {
  browser.permissions.contains({
    permissions: ['power']
  }, granted => {
    browser.runtime.lastError;
    document.getElementById('power').checked = granted;
  });

  document.getElementById('power').addEventListener('change', e => {
    if (e.target.checked) {
      browser.permissions.request({
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
      browser.permissions.remove({
        permissions: ['power']
      });
      self.notify('Done, Reopen this window to apply', 2000);
    }
  });

  events.before.add(() => {
    if (browser.power) {
      browser.power.requestKeepAwake('display');
    }
  });
  events.after.add(() => browser.runtime.sendMessage({
    method: 'release-awake-if-possible'
  }, () => browser.runtime.lastError));

  addEventListener('beforeunload', () => browser.runtime.sendMessage({
    method: 'release-awake-if-possible'
  }, () => browser.runtime.lastError));

  browser.runtime.onMessage.addListener((request, sender, response) => {
    if (request.method === 'any-active' && document.body.dataset.mode === 'download') {
      response(true);
    }
  });
}

