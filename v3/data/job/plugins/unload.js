/* global events */

events.before.push(() => {
  window.onbeforeunload = () => 'Downloading...';
});

events.after.push(() => {
  window.onbeforeunload = null;
});
