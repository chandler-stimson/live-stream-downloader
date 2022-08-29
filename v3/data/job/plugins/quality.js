/* global storage */

storage.get({
  quality: 'selector' // 'selector', 'highest', 'lowest'
}).then(prefs => {
  document.querySelector(`[name=quality][id="quality-${prefs.quality}"]`).checked = true;

  document.getElementById('options').onchange = e => {
    if (e.target.name === 'quality') {
      storage.set({
        quality: e.target.id.replace('quality-', '')
      });
    }
  };
});
