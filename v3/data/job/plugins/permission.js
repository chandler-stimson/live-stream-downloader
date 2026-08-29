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

/* global events */

// use the HTML Screen Wake Lock API instead of the "power" permission
const powerContainer = document.getElementById('power-container');
const power = document.getElementById('power');

let wakeLock = null;

const request = async () => {
  try {
    wakeLock = await navigator.wakeLock.request('screen');
  }
  catch (e) {
    console.warn('Keep Awake is not available', e);
  }
};
const release = () => {
  if (wakeLock) {
    wakeLock.release().catch(() => {});
    wakeLock = null;
  }
};

chrome.storage.local.get({
  'power': true
}, prefs => {
  power.checked = prefs.power;
  if (!('wakeLock' in navigator)) {
    powerContainer.classList.add('disabled');
  }
});

power.addEventListener('change', e => {
  chrome.storage.local.set({
    'power': e.target.checked
  });
});

events.before.add(() => {
  if (power.checked) {
    request();
  }
});
events.after.add(release);

// the wake lock is released when the tab is hidden; re-acquire it on return
document.addEventListener('visibilitychange', () => {
  if (document.visibilityState === 'visible' && power.checked && document.body.dataset.mode === 'download') {
    request();
  }
});

addEventListener('beforeunload', release);
