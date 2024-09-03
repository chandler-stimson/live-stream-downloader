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

/* global events args */

document.getElementById('referer').textContent = args.get('href') || 'Empty';

const net = {
  async add(initiator) {
    if (!initiator || initiator.startsWith('http') === false) {
      console.warn('referer skipped', initiator);
      return;
    }

    const [tab] = await new Promise(resolve => chrome.tabs.query({
      active: true,
      currentWindow: true
    }, resolve));
    const cId = net.id = tab.id;

    const {origin} = new URL(initiator);

    const headers = [{
      'operation': 'set',
      'header': 'origin',
      'value': origin
    }, {
      'operation': 'set',
      'header': 'referer',
      'value': initiator
    }];
    await chrome.declarativeNetRequest.updateSessionRules({
      removeRuleIds: [cId],
      addRules: [{
        'id': cId,
        'action': {
          'type': 'modifyHeaders',
          'requestHeaders': headers
        },
        'condition': {
          'tabIds': [cId]
        }
      }]
    });
  },
  remove() {
    if (net.id) {
      return chrome.declarativeNetRequest.updateSessionRules({
        removeRuleIds: [net.id]
      });
    }
  }
};

events.before.add(async o => {
  const referer = o.initiator || args.get('href');
  if (referer.startsWith('http')) {
    await net.add(referer);
  }
  document.getElementById('referer').textContent = referer || 'Empty';
});

events.after.add(() => {
  net.remove();
});
