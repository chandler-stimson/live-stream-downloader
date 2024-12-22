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

/* global network*/

// update network blocked list
{
  const image = async href => {
    const img = await createImageBitmap(await (await fetch(href)).blob());
    const {width: w, height: h} = img;
    const canvas = new OffscreenCanvas(w, h);
    const ctx = canvas.getContext('2d');
    ctx.drawImage(img, 0, 0, w, h);

    return ctx.getImageData(0, 0, w, h);
  };

  // display forbidden icon for blocked hostnames
  const icon = () => {
    if (chrome.declarativeContent) {
      chrome.declarativeContent.onPageChanged.removeRules(undefined, async () => {
        const hosts = await network.hosts();
        const list = hosts.filter(o => o.type === 'host').map(o => o.value.replace(/^\./, ''));

        const conditions = list.map(hostSuffix => new chrome.declarativeContent.PageStateMatcher({
          pageUrl: {hostSuffix}
        }));

        chrome.declarativeContent.onPageChanged.addRules([{
          conditions,
          actions: [
            new chrome.declarativeContent.SetIcon({
              imageData: {
                16: await image('/data/icons/forbidden/16.png'),
                32: await image('/data/icons/forbidden/32.png')
              }
            })
          ]
        }]);
      });
    }
  };

  // This list includes the list of rules to get blocked by this extension
  // The extension does not offer downloading resources included in this list
  chrome.alarms.onAlarm.addListener(a => {
    if (a.name === 'update-network') {
      fetch(network.LIST).then(r => {
        if (r.ok) {
          caches.open(network.NAME).then(cache => cache.put(network.LIST, r)).then(icon);
        }
        else {
          icon();
        }
      });
    }
  });
  const ucheck = () => {
    if (ucheck.done) {
      return;
    }
    ucheck.done = true;

    chrome.alarms.create('update-network', {
      when: Date.now() + 30000,
      periodInMinutes: 60 * 24 * 7 // every 7 days
    });
  };

  chrome.runtime.onInstalled.addListener(ucheck);
  chrome.runtime.onStartup.addListener(ucheck);
}
