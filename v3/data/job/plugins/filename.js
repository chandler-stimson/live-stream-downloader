/* global storage */
{
  const div = document.createElement('div');
  div.textContent = 'Use Ctrl + N or Command + N to change filename format';

  document.getElementById('intro').appendChild(div);
}

window.addEventListener('keydown', e => {
  const meta = e.ctrlKey || e.metaKey;

  if (e.code === 'KeyN' && meta) {
    e.preventDefault();

    storage.get({
      'filename': '[meta.name]' // [meta.name], [title], [hostname]
    }).then(prefs => {
      self.prompt('Filename format:\n\nAcceptable Keywords: [meta.name], [title], [hostname]', {
        ok: 'Change',
        no: 'Abort',
        value: prefs.filename
      }, true).then(filename => {
        storage.set({
          filename: filename || '[meta.name]'
        }).then(() => location.reload());
      });
    });
  }
});


