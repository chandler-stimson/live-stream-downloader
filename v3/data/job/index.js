/**
    MyGet - A multi-thread downloading library
    Copyright (C) 2014-2022 [Chandler Stimson]

    This program is free software: you can redistribute it and/or modify
    it under the terms of the Mozilla Public License as published by
    the Mozilla Foundation, either version 2 of the License, or
    (at your option) any later version.
    This program is distributed in the hope that it will be useful,
    but WITHOUT ANY WARRANTY; without even the implied warranty of
    MERCHANTABILITY or FITNESS FOR A PARTICULAR PURPOSE.  See the
    Mozilla Public License for more details.
    You should have received a copy of the Mozilla Public License
    along with this program.  If not, see {https://www.mozilla.org/en-US/MPL/}.

    GitHub: https://github.com/chandler-stimson/live-stream-downloader/
    Homepage: https://webextension.org/listing/hls-downloader.html
*/

/* global parse, MyGet, network, extract, helper, addEntries */

const args = new URLSearchParams(location.search);

const tabId = Number(args.get('tabId')); // original tab
const progress = document.getElementById('current-progress');

const events = {
  before: new Set(), // before download begins
  after: new Set() // after download ends
};

document.title = 'Inspecting tab...';
Promise.all([
  tabId ? extract.storage(tabId) : [],
  tabId ? extract.performance(tabId): [],
  tabId ? extract.player(tabId) : []
]).then(async ([storageEntries, performanceEntries, playerEntries]) => {
  const entries = new Map();
  if (args.get('extra') === 'true') {
    try {
      const links = await new Promise(resolve => chrome.runtime.sendMessage({
        method: 'get-extra',
        tabId
      }, resolve));

      for (const url of links) {
        entries.set(url, {url});
      }
    }
    catch (e) {
      console.error(e);
    }
  }

  try {
    for (const entry of (playerEntries || [])) {
      entries.set(entry.url, entry);
    }
  }
  catch (e) {}
  try {
    for (const entry of (performanceEntries || [])) {
      entries.set(entry.url, entry);
    }
  }
  catch (e) {}
  // overwrite performanceEntries which does not include details
  try {
    for (const entry of (storageEntries || [])) {
      entries.set(entry.url, entry);
    }
  }
  catch (e) {}

  // append: accepts both JSON and url as value
  for (const s of args.getAll('append')) {
    try {
      const o = JSON.parse(s);
      if (o.url) {
        entries.set(o.url, o);
      }
    }
    catch (e) {
      entries.set(s, {
        url: s
      });
    }
  }

  let forbiddens = 0;
  // remove forbidden links
  const blocked = await network.blocked();
  for (const [stream, entry] of entries.entries()) {
    entry.blocked = blocked({
      host: args.get('href'),
      stream
    });
    if (entry.blocked.value) {
      forbiddens += 1;
    }
  }

  await addEntries(entries);

  // forbidden
  document.getElementById('forbiddens').textContent = forbiddens;
  if (forbiddens) {
    document.body.classList.add('forbidden');
  }
});

const error = e => {
  console.warn(e);
  document.title = e?.message;
  document.body.dataset.mode = 'error';
};

const download = async (segments, file, codec = '') => {
  document.body.dataset.mode = 'download';
  progress.value = 0;

  // remove discontinuity
  const timelines = {};
  for (const segment of segments) {
    timelines[segment.timeline] = timelines[segment.timeline] || [];
    timelines[segment.timeline].push(segment);
  }
  const timingObjects = Object.entries(timelines);

  if (timingObjects.length > 1) {
    const msg = `This M3U8 media file contains different timelines, each usually representing a separate piece of ` +
      `media (short timelines are often ads). Choose the timeline you want to download. You can repeat the process ` +
      `to download more timelines later. It's best to download each timeline separately, but you can also download ` +
      `all segments into one file (though it might not play properly).`;

    // select the longest timeline
    let suggested = 0;
    let largestObject = 0;
    for (const [id, a] of timingObjects) {
      if (largestObject < a.length) {
        suggested = id;
        largestObject = a.length;
      }
    }
    const selected = await self.prompt(msg + `

${timingObjects.map(([id, a]) => {
    return id + ' (includes ' + a.length + ' segments)';
  }).join('\n')}`, {
      ok: 'Select a Timeline',
      extra: ['Download Each Separately', 'Ignore Timelines'],
      no: 'Cancel',
      value: suggested
    }, true);

    if (selected === 'extra-0') {
      const jobs = [];
      for (const [timeline, segments] of timingObjects) {
        const name = file.name.replace(/\.(?=[^.]+$)/, '-' + timeline + '.');
        jobs.push({name, segments});
      }
      try {
        file.remove();
      }
      catch (e) {}
      return self.batch(jobs, codec);
    }
    else if (selected !== 'extra-1') {
      segments = timelines[selected];
    }
  }
  if (Array.isArray(segments) === false) {
    throw Error('UNKNOWN_TIMELINE');
  }

  // remove duplicated segments (e.g. video/fMP4)
  const links = [];
  segments = segments.filter(segment => {
    if (links.indexOf(segment.uri) === -1) {
      links.push(segment.uri);
      return true;
    }
    return false;
  });

  // segment with initialization map
  segments = segments.map(segment => {
    if (segment.map) {
      const uri = segment.map.resolvedUri || segment.map.uri;
      if (uri && uri !== segment.uri) {
        return [{
          ...segment,
          ...segment.map,
          cache: true // cache this fetch
        }, segment];
      }
    }
    return segment;
  }).flat();

  const stat = {
    fetched: 0,
    current: 0,
    total: segments.length
  };

  const myGet = new MyGet();
  myGet.meta['base-codec'] = codec;

  // stats
  myGet.monitor = new Proxy(myGet.monitor, {
    apply(target, self, args) {
      const [, position, chunk] = args;
      stat.current = Math.max(stat.current, position);
      stat.fetched += chunk.byteLength;

      return Reflect.apply(target, self, args);
    }
  });

  Object.assign(myGet.options, await chrome.storage.local.get({
    'threads': MyGet.OPTIONS.threads,
    'thread-timeout': MyGet.OPTIONS['thread-timeout']
  }));

  // instead of breaking, let the user retry
  myGet.options['error-handler'] = (e, source, href) => {
    return self.prompt(`Connection to the server is broken (${source} -> ${e.message})!

Use the box below to update the URL`, {
      ok: 'Retry',
      no: 'Cancel',
      value: href
    }, true).then(v => {
      if (v) {
        try {
          new URL(v);
          return v;
        }
        catch (e) {
          console.info('URL replacement ignored', e);
        }
      }
    });
  };

  console.info('MyGet Instance', myGet);

  const timer = setInterval(() => {
    // downloading a single segment file
    if (stat.total === 1) {
      if (myGet.sizes.has(0)) {
        const percent = stat.fetched / myGet.sizes.get(0) * 100;
        document.title =
          percent.toFixed(1) + `% fetched [${MyGet.size(stat.fetched)}/${MyGet.size(myGet.sizes.get(0))}]` +
          ` [Threads: ${myGet.actives}]`;

        progress.value = stat.fetched;
        progress.max = myGet.sizes.get(0);
      }
      else {
        document.title = MyGet.size(stat.fetched) + ' fetched...';
      }
    }
    // downloading multiple segment file
    else {
      document.title = (stat.current / stat.total * 100).toFixed(1) +
        `% fetched [${stat.current}/${stat.total}] (${MyGet.size(stat.fetched)})` + ` [Threads: ${myGet.actives}]`;

      progress.value = stat.current;
      progress.max = stat.total;
    }
    //
    if (self.aFile) {
      document.title += ' Job [' + self.aFile.stat.index + '/' + self.aFile.stat.total + ']';
    }
  }, 750);

  try {
    // attach disk writer
    await myGet.attach(file);

    // download
    await myGet.fetch(segments);
    clearInterval(timer);

    document.title = 'Done. Media is ready!';
    if ('download' in file) { // Firefox
      file.download(file.name);
    }

    // try to rename
    if (myGet.meta.name && myGet.meta.ext && file.move) {
      const name = myGet.meta.name + '.' + myGet.meta.ext;
      if (name !== file.name) {
        const input = document.querySelector('[data-active=true] input[data-id=rename]');
        if (input) {
          input.disabled = false;
          input.onclick = e => {
            if (confirm(`Rename media from "${file.name}" to "${name}"?

-> This will overwrite an existing file with the same name.`)) {
              file.move(name).catch(e => self.notify(e.message));
              e.target.disabled = true;
            }
          };
        }
      }
    }

    document.body.dataset.mode = 'done';
  }
  catch (e) {
    error(e);
  }
  clearInterval(timer);
};

/* queued entries wait on an unlimited promise until the user presses Start */
const queue = new Map(); // label -> {controller, resolve, promise, file, button}

/* queued entries start via the Download button and cancel via the Queue button */
const setQueued = (div, queued) => {
  const download = div.querySelector('[data-id=download]');
  const q = div.querySelector('[data-id=queue]');
  if (queued) {
    // keep the current labels so that they can be restored (they may be localized)
    download.dataset.label = download.value;
    q.dataset.label = q.value;
    download.value = 'Start';
    download.dataset.action = 'start';
    q.value = 'Cancel Queue';
    q.dataset.action = 'cancel';
  }
  else {
    download.value = download.dataset.label || download.value;
    q.value = q.dataset.label || q.value;
    delete download.dataset.label;
    delete q.dataset.label;
    download.dataset.action = 'download';
    q.dataset.action = 'queue';
  }
};

{
  // double ESC (within 1 second) cancels all queue items at once;
  // programmatic (e.isTrusted === false) invocations skip the confirmation
  let stamp = 0;
  addEventListener('keydown', e => {
    if (e.key !== 'Escape') {
      stamp = 0;
      return;
    }
    const now = Date.now();
    if (stamp && now - stamp < 1000) {
      stamp = 0;
      if (queue.size && (e.isTrusted === false || confirm('Cancel all queued downloads?'))) {
        for (const [div, record] of queue) {
          record.controller.abort(Error('QUEUE_ABORT')); // rejects the unlimited promise
          setQueued(div, false);
        }
        queue.clear();
        self.notify('Queue canceled');
      }
    }
    else {
      stamp = now;
    }
  });
}

/* prepare the changes that a rejected save request requires; null when there is nothing to adjust */
const adjust = opts => {
  const msgs = [];

  // remove illegal or problematic characters from the suggested name for Windows, macOS, Linux
  // https://github.com/chandler-stimson/live-stream-downloader/issues/46
  let name = opts.suggestedName || '';
  const n = name.replace(
    /[\\/:*?"<>|\0]|^[\s.]+|[\s.]+$|[~`!@#$%^&+={}[\];,]/g,
    '_'
  );
  if (n !== name) {
    msgs.push(`The file name "${name}" contains unsupported characters and is replaced by "${n}".`);
    name = n;
  }

  // the file type filter must be dropped when a MIME type or an extension is not acceptable
  const types = Array.isArray(opts.types) ? opts.types : [];
  const accept = types[0]?.accept;
  const invalid = accept && Object.entries(accept).some(([mime, exts]) => {
    return /^[a-z0-9.+-]+\/[a-z0-9.+-]+$/i.test(mime) === false ||
      exts.some(ext => /^\.[^.]{1,15}$/.test(ext) === false);
  });
  if (types.length && (!accept || invalid)) {
    msgs.push('The requested file type filter is rejected by the file dialog and will be removed. The "All files" filter can then be used to select any file name.');
    return {
      name,
      dropTypes: true,
      msg: msgs.join('\n')
    };
  }

  return msgs.length ? {
    name,
    msg: msgs.join('\n')
  } : null;
};

/* ask user for picking a location; when the request fails, report the required changes
   to the user and let the dialog itself provide the user gesture that each retried request needs */
const pickSaveFile = async opts => {
  let attempts = 0;
  let firstError = null;
  for (;;) {
    try {
      // use the original name
      return await window.showSaveFilePicker(opts);
    }
    catch (e) {
      if (e?.name !== 'AbortError') {
        console.error(e);
      }
      firstError = firstError || e;
      attempts += 1;

      // do not retry endlessly; the first error is the actual cause
      if (attempts >= 3) {
        throw firstError;
      }
      // an unknown error cannot be fixed by retrying with a fresh gesture
      if (e?.name !== 'AbortError' && e instanceof TypeError === false) {
        throw e;
      }

      const proposal = adjust(opts);
      try {
        // activating this dialog hands its user gesture over to the retried picker call below
        const name = await self.prompt(proposal ? `The file dialog rejected this request.

${proposal.msg}

Update the file name and retry?` : `The file dialog request was aborted before it could be shown.

Update the file name and retry?`, {
          ok: 'Retry',
          no: 'Cancel',
          value: proposal ? proposal.name : (opts.suggestedName || '')
        });

        if (name) {
          opts.suggestedName = name;
        }
        else {
          // the user cleared the box; let the file dialog suggest a name
          delete opts.suggestedName;
        }
        if (proposal?.dropTypes) {
          delete opts.types;
        }
      }
      catch {
        // the user canceled the dialog; keep the original picker error
        throw firstError;
      }
    }
  }
};

const run = async (div, picked, button) => {
  const label = button.value; // preserve for restoring (it may be localized)
  document.body.dataset.mode = 'prepare';

  try {
    div.dataset.active = true;

    const opts = helper.options(div);
    let file = picked || self.aFile;
    // ask user for picking
    if (!file) {
      // example for failing download
      // {suggestedName: 'x.mkv', types: [{description: 'V', accept: {'video/x-matroska': ['.verylongextensionfile']}}]}
      file = await pickSaveFile(opts);
    }

    button.value = 'Processing...';

    // run pre
    for (const callback of events.before) {
      await callback(div.entry);
    }

    if (div.entry instanceof File) {
      await new Promise((resolve, reject) => {
        document.title = 'Parsing M3U8 manifest ...';
        document.body.dataset.mode = 'parse';
        const reader = new FileReader();
        reader.onload = () => parse(reader.result, file, undefined, undefined, (segments, file, codec) => {
          document.title = 'Downloading ' + segments[0].base;
          return download(segments, file, codec);
        }).then(resolve, reject);
        reader.readAsText(div.entry, 'utf-8');
      });
    }
    else {
      if (helper.downloadable(div)) {
        document.title = 'Downloading ' + div.entry.url;
        await download([{
          uri: div.entry.url
        }], file);
      }
      else {
        document.title = 'Parsing M3U8 manifest ...';
        document.body.dataset.mode = 'parse';
        await parse(div.entry.url, file, undefined, undefined, (segments, file, codec) => {
          document.title = 'Downloading ' + segments[0].base;
          return download(segments, file, codec);
        });
      }
    }
    div.classList.remove('error');
    div.classList.add('done');
  }
  catch (e) {
    // the user dismissed the file picker dialog; this is not an error
    if (e?.name === 'AbortError') {
      document.body.dataset.mode = 'ready';
      self.notify('The file dialog was dismissed; press the download button to try again.', 5000);
    }
    else {
      div.classList.remove('done');
      div.classList.add('error');
      error(e);
    }
  }

  // run post
  for (const callback of events.after) {
    /* success, done */
    callback(
      document.body.dataset.mode === 'done',
      'aFile' in self ? self.aFile.stat.index === self.aFile.stat.total : true
    );
  }

  button.value = label;
  div.dataset.active = false;
};

document.getElementById('hrefs').onsubmit = async e => {
  e.preventDefault();
  const button = e.submitter;
  const div = button.closest('label');

  // dispatch on the stable action (button.value may be localized)
  const action = button.dataset.action;

  // queue: pick the location now; the download continues once Start is pressed
  if (action === 'queue') {
    document.body.dataset.mode = 'prepare';
    try {
      const file = await pickSaveFile(helper.options(div));

      const record = {
        controller: new AbortController(),
        file,
        button: div.querySelector('[data-id=download]')
      };
      record.promise = new Promise((resolve, reject) => {
        record.resolve = resolve;
        // abort listener rejects the unlimited promise
        record.controller.signal.addEventListener('abort', () => {
          reject(record.controller.signal.reason || Error('QUEUE_ABORT'));
        });
      });
      record.promise.then(() => {
        if (queue.delete(div)) {
          setQueued(div, false);
          run(div, record.file, record.button);
        }
      }, () => {});

      queue.set(div, record);
      setQueued(div, true);
      self.notify('Press Start to begin. Press Esc twice to cancel all queued jobs.', 5000);
      document.body.dataset.mode = 'ready';
    }
    catch (e) {
      // the user dismissed the file picker dialog; this is not an error
      if (e?.name === 'AbortError') {
        document.body.dataset.mode = 'ready';
        self.notify('The file dialog was dismissed; press the queue button to try again.', 5000);
      }
      else {
        div.classList.remove('done');
        div.classList.add('error');
        error(e);
      }
    }
    return;
  }

  // Start resolves the queued promise; the continuation starts the download
  if (action === 'start') {
    queue.get(div)?.resolve();
    return;
  }

  // remove a single job from the queue
  if (action === 'cancel') {
    const record = queue.get(div);
    if (record) {
      record.controller.abort(Error('QUEUE_ABORT')); // rejects the unlimited promise
      queue.delete(div);
      setQueued(div, false);
    }
    return;
  }

  run(div, null, button);
};
