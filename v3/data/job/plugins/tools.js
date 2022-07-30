/* global error, options, events */

{
  const hrefs = document.getElementById('hrefs');
  hrefs.addEventListener('change', () => {
    const b = Boolean(hrefs.querySelector(':checked'));

    document.getElementById('download-all').disabled = !b;
  });
  document.getElementById('download-all').onclick = async () => {
    try {
      const divs = [...hrefs.querySelectorAll(':checked')].map(e => e.closest('label'));
      const filenames = {};

      const dir = await window.showDirectoryPicker({
        mode: 'readwrite'
      });

      // if there are duplicates, fix file-index
      for await (const file of dir.values()) {
        if (file.kind === 'file') {
          filenames[file.name] = 0;
        }
      }
      const validate = div => {
        const name = options(div).suggestedName;

        filenames[name] = name in filenames ? filenames[name] : -1;
        filenames[name] += 1;

        div.meta.index = filenames[name];

        const n = options(div).suggestedName;
        if (n in filenames) {
          if (filenames[name]) {
            validate(div);
          }
        }
        else {
          filenames[n] = 0;
        }
      };

      for (const div of divs) {
        validate(div);
      }

      const next = async () => {
        if (divs.length) {
          const div = divs.shift();

          self.aFile = await dir.getFileHandle(options(div).suggestedName, {
            create: true
          });
          self.aFile.stat = {
            index: next.total - divs.length,
            total: next.total
          };

          div.querySelector('[type=submit]').click();
        }
        else {
          delete self.aFile;
        }
      };
      next.total = divs.length;
      events.after.push(next);
      next();
    }
    catch (e) {
      error(e);
    }
  };
  document.getElementById('select-all').onclick = () => {
    for (const e of hrefs.querySelectorAll('input[type=checkbox]')) {
      e.checked = true;
    }
    hrefs.querySelector('input[type=checkbox]').dispatchEvent(new Event('change', {bubbles: true}));
  };
  document.getElementById('select-none').onclick = () => {
    for (const e of hrefs.querySelectorAll('input[type=checkbox]')) {
      e.checked = false;
    }
    hrefs.querySelector('input[type=checkbox]').dispatchEvent(new Event('change', {bubbles: true}));
  };
  document.getElementById('remove-duplicates').onclick = () => {
    const entries = hrefs.querySelectorAll('.entry');

    const cache = new Set();

    for (const entry of entries) {
      const href = entry.querySelector('[data-id=href]').textContent;

      if (cache.has(href)) {
        entry.remove();
      }
      cache.add(href);
    }
  };
  document.getElementById('keep-hls').onclick = () => {
    const entries = hrefs.querySelectorAll('.entry');

    for (const entry of entries) {
      if (entry?.meta?.ext !== 'm3u8') {
        entry.remove();
      }
    }
    if (!hrefs.querySelector('.entry')) {
      document.body.dataset.mode = 'empty';
    }
  };
}

