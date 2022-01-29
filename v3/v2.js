// v2
chrome.action = chrome.action || chrome.browserAction;

chrome.storage.cache = {};
chrome.storage.session = chrome.storage.session || {
  get(ps, c) {
    const r = {};
    for (const [key, value] of Object.entries(ps)) {
      r[key] = chrome.storage.cache[key] || value;
    }
    c(r);
  },
  set(ps) {
    for (const [key, value] of Object.entries(ps)) {
      chrome.storage.cache[key] = value;
    }
  },
  remove(key) {
    delete chrome.storage.cache[key];
  }
};

chrome.windows.getCurrent = new Proxy(chrome.windows.getCurrent, {
  apply(target, self, args) {
    return new Promise(resolve => Reflect.apply(target, self, [...args, resolve]));
  }
});
