/* global events args */

document.getElementById('referer').textContent = args.get('href') || '-';

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

    const headers = [{
      'operation': 'set',
      'header': 'origin',
      'value': initiator
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

events.before.push(async o => {
  const referer = o.initiator || args.get('href');
  await net.add(referer);
  document.getElementById('referer').textContent = referer;
});

events.after.push(() => {
  net.remove();
});
