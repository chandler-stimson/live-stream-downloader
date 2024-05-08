/* global storage */

storage.get({
  'filename': '[meta.name]',
  'online-resolve-name': true
}).then(prefs => {
  document.getElementById('filename').value = prefs.filename;
  document.getElementById('online-resolve-name').checked = prefs['online-resolve-name'];
});

const changed = target => {
  storage.set({
    filename: target.value || '[meta.name]'
  }).then(() => self.notify('Done, Reopen this window to apply', 2000));
};

{
  let id;
  document.getElementById('filename').addEventListener('input', e => {
    id = clearTimeout(id);
    id = setTimeout(changed, 2000, e.target);
  });
}

document.getElementById('online-resolve-name').onchange = e => chrome.storage.local.set({
  'online-resolve-name': e.target.checked
});
