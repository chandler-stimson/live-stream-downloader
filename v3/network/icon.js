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
  chrome.runtime.onInstalled.addListener(() => chrome.alarms.create('update-network', {
    when: Date.now() + 1000,
    periodInMinutes: 60 * 24 * 7 // every 7 days
  }));
}
