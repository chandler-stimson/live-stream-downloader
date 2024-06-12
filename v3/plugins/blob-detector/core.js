// https://ww9.0123movie.net/movie/ugly-betty-season-1-6373.html

const activate = () => {
  if (activate.busy) {
    return;
  }
  activate.busy = true;
  browser.storage.local.get({
    'mime-watch': false
  }, async prefs => {
    await browser.scripting.unregisterContentScripts({
      ids: ['bb_main', 'bb_isolated']
    }).catch(() => {});

    if (prefs['mime-watch']) {
      const props = {
        'matches': ['*://*/*'],
        'allFrames': true,
        'matchOriginAsFallback': true,
        'runAt': 'document_start'
      };

      try {
        await browser.scripting.registerContentScripts([{
          ...props,
          'id': 'bb_main',
          'world': 'MAIN',
          'js': ['/plugins/blob-detector/inject/main.js']
        }]);
        await browser.scripting.registerContentScripts([{
          ...props,
          'id': 'bb_isolated',
          'world': 'ISOLATED',
          'js': ['/plugins/blob-detector/inject/isolated.js']
        }]);
      }
      catch (e) {}
    }
    activate.busy = false;
  });
};

browser.runtime.onStartup.addListener(activate);
browser.runtime.onInstalled.addListener(activate);
browser.storage.onChanged.addListener(ps => ps['mime-watch'] && activate());
