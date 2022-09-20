/* global storage */

storage.get({
  'filename': '[meta.name]' // [meta.name], [title], [hostname]
}).then(prefs => {
  document.getElementById('filename').value = prefs.filename;
});

const changed = target => {
  storage.set({
    filename: target.value || '[meta.name]'
  }).then(() => self.notify('Done, Reopen this window to apply', 2000));
};


let id;
document.getElementById('filename').addEventListener('input', e => {
  id = clearTimeout(id);
  id = setTimeout(changed, 2000, e.target);
});
