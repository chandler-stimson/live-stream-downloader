/* global events */

// prevent closing
events.before.add(() => {
  window.onbeforeunload = () => 'Downloading...';
});

events.after.add(() => {
  window.onbeforeunload = null;
});
// auto close on success
const done = (success, done) => {
  window.onbeforeunload = null;

  if (document.getElementById('autoclose').checked) {
    if (success) {
      if (done) {
        const timeout = 5 * 1000;
        self.notify('Closing after 5 seconds...', timeout);
        setTimeout(() => window.close(), timeout);
      }
    }
    else {
      // do not auto close when there is a failed download
      events.after.delete(done);
      console.info('Auto-closing is canceled for this session');
    }
  }
};
events.after.add(done);

chrome.storage.local.get({
  'autoclose': false
}, prefs => document.getElementById('autoclose').checked = prefs.autoclose);

document.getElementById('autoclose').onchange = e => chrome.storage.local.set({
  'autoclose': e.target.checked
});
