/* global storage, MyGet */

storage.get({
  threads: MyGet.OPTIONS.threads
}).then(prefs => {
  document.getElementById('threads').textContent = prefs.threads;

  document.getElementById('threads-selector').onclick = () => self.prompt('Number of simultaneous threads used for downloading [1-5]:', {
    ok: 'Apply',
    no: 'Cancel',
    value: prefs.threads
  }, true).then(threads => {
    threads = Math.max(1, Math.min(5, Number(threads)));
    if (isNaN(threads) === false) {
      storage.set({
        threads
      });
      document.getElementById('threads').textContent = threads;
    }
  });
});
