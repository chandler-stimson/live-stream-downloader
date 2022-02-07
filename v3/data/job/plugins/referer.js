/* global events args */

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

    await chrome.declarativeNetRequest.updateSessionRules({
      removeRuleIds: [cId],
      addRules: [{
        'id': cId,
        'action': {
          'type': 'modifyHeaders',
          'requestHeaders': [{
            'operation': 'set',
            'header': 'referer',
            'value': initiator
          }]
        },
        'condition': {
          'tabIds': [cId]
        }
      }]
    });
  },
  remove() {
    return chrome.declarativeNetRequest.updateSessionRules({
      removeRuleIds: [net.id]
    });
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
