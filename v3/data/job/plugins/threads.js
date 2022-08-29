/* global storage, MyGet */

storage.get({
  threads: MyGet.OPTIONS.threads
}).then(prefs => {
  document.getElementById('threads').value = prefs.threads;

  document.getElementById('threads').onchange = e => {
    const threads = Math.max(1, Math.min(5, e.target.valueAsNumber));
    if (isNaN(threads) === false) {
      storage.set({
        threads
      });
    }
  };
});
