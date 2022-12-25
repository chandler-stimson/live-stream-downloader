/* global storage */

storage.get({
  'mime-watch': false
}).then(prefs => {
  document.getElementById('mime-watch').checked = prefs['mime-watch'];

  document.getElementById('mime-watch').onchange = e => {
    storage.set({
      'mime-watch': e.target.checked
    });
  };
});
