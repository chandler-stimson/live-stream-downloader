/* global storage, MyGet */

storage.get({
  'error-recovery': MyGet.OPTIONS['error-recovery']
}).then(prefs => {
  document.getElementById('error-recovery').checked = prefs['error-recovery'];

  document.getElementById('error-recovery').onchange = e => {
    storage.set({
      'error-recovery': e.target.checked
    });
  };
});
