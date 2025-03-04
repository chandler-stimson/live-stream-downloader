/* global MyGet, args, tabId */

const response = ({url, responseHeaders = []}) => {
  const headers = new Headers();
  for (const {name, value} of responseHeaders) {
    headers.set(name, value);
  }
  return {
    url,
    headers
  };
};

const addEntries = async entries => {
  const prefs = await chrome.storage.local.get({
    'filename': '[meta.name]' // [meta.name], [title], [hostname], [q:query|method|default-value]
  });
  let hostname = 'NA';
  try {
    const o = new URL(args.get('href'));
    hostname = o.hostname;
  }
  catch (e) {}

  // extract "q:" matches from the page
  if (prefs.filename.includes('[q:')) {
    const regex = /\[q:((?:\[[^\]]*?\]|.)*?)\]/g;

    const matches = [];
    let match;

    while ((match = regex.exec(prefs.filename)) !== null) {
      matches.push(match[1]);
    }

    if (matches.length) {
      try {
        const r = await chrome.scripting.executeScript({
          target: {
            tabId
          },
          func: matches => {
            const results = [];
            for (const match of matches) {
              const [query, method, defaultValue] = match.split('|');
              let value = '';
              try {
                const e = document.querySelector(query);
                if (method) {
                  value = e[method] || e.getAttribute(method);
                }
                else {
                  value = e.textContent;
                }
              }
              catch (e) {}
              value = value || (defaultValue || '');

              results.push({
                match,
                value
              });
            }
            return results;
          },
          args: [matches]
        });

        for (const {match, value} of r[0].result) {
          prefs.filename = prefs.filename.replace('[q:' + match + ']', value);
        }
      }
      catch (e) {
        console.info('Cannot run query search on page', e);
      }
    }
  }

  const t = document.getElementById('entry');
  let naming = 0;
  let counter = 0;
  for (const entry of entries.values()) {
    const clone = document.importNode(t.content, true);
    const div = clone.querySelector('label');
    const en = clone.querySelector('[data-id=name]');
    const exn = clone.querySelector('[data-id=extracted-name]');
    const ex = clone.querySelector('[data-id=ext]');
    const meta = {};

    const name = () => {
      meta.gname = en.textContent = en.title = prefs.filename
        .replace('[meta.name]', meta.name)
        .replace('[title]', args.get('title'))
        .replace('[hostname]', hostname);

      if (prefs.filename.includes('[meta.name]') === false) {
        exn.textContent = exn.title = '(' + meta.name + ')';
      }

      ex.textContent = meta.ext || 'N/A';
    };

    // offline naming
    const r = response(entry instanceof File ? {
      url: 'local/' + entry.name
    } : entry);

    // we already have the content-type so perform offline naming
    MyGet.guess(r, meta);
    name();

    if (!r.headers.get('Content-Type')) {
      // offline naming without meta extraction until we get a response from the server
      name();
      // optional online naming (for the first 20 items)
      if (naming < 20 && r.url.startsWith('http') && document.getElementById('online-resolve-name').checked) {
        naming += 1;

        const controller = new AbortController();
        const signal = controller.signal;

        fetch(r.url, {
          method: 'GET',
          signal
        }).then(r => {
          if (r.ok) {
            MyGet.guess(r, meta);
            name();
          }
          controller.abort();
        }).catch(() => {});
      }
    }

    // we might have recorded a segment of the player, hence the 'Content-Length' header is wrong
    if (r.headers.has('Content-Range')) {
      clone.querySelector('[data-id=size]').textContent = MyGet.size(
        r.headers.get('Content-Range')?.split('/')[1]
      );
    }
    else if (r.headers.has('Content-Length')) {
      clone.querySelector('[data-id=size]').textContent = MyGet.size(r.headers.get('Content-Length'));
    }
    else {
      clone.querySelector('[data-id=size]').textContent = '-';
    }
    clone.querySelector('[data-id=href]').textContent = clone.querySelector('[data-id=href]').title =
      entry.blocked?.value ? entry.blocked.reason : (entry.url || 'N/A');

    clone.querySelector('input[data-id=copy]').onclick = e => navigator.clipboard.writeText(entry.url).then(() => {
      e.target.value = 'Done';
      setTimeout(() => e.target.value = 'Copy', 750);
    }).catch(e => alert(e.message));

    div.entry = entry;
    div.meta = meta;
    div.dataset.blocked = entry.blocked?.value || false;

    if (entry.blocked?.value) {
      clone.querySelector('input[data-id="copy"]').disabled = true;
      clone.querySelector('input[type=submit]').disabled = true;
    }

    document.getElementById('hrefs').appendChild(div);
    const c = document.getElementById('hrefs-container');
    c.scrollTop = c.scrollHeight;

    document.title = `Adding ${counter} of ${entries.size} items...`;
    if (counter % 10 === 0) {
      await new Promise(resolve => requestAnimationFrame(resolve));
    }
    counter += 1;
  }

  document.body.dataset.mode = document.querySelector('form .entry') ? 'ready' : 'empty';
  document.title = 'Download a Media from "' + (args.get('title') || 'New Tab') + '"';
};
