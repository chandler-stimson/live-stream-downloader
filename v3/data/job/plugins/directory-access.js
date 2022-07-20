window.addEventListener('keydown', e => {
  const meta = e.ctrlKey || e.metaKey;

  if (e.code === 'KeyO' && meta) {
    window.showDirectoryPicker({
      mode: 'readwrite',
      startIn: 'downloads'
    }).then(handle => {
      const request = indexedDB.open('RootDirectory', 1);
      request.onupgradeneeded = e => {
        const db = e.target.result;
        if (!db.objectStoreNames.contains('handler')) {
          db.createObjectStore('handler', {
            keyPath: 'id',
            autoIncrement: true
          });
        }
      };
      request.onsuccess = e => {
        const db = e.target.result;
        const transaction = db.transaction('handler', 'readwrite');
        const objectStore = transaction.objectStore('handler');
        const request = objectStore.put(handle);
        request.onsuccess = () => console.log('done');
      };
    });
  }
});

{
  const request = indexedDB.open('RootDirectory', 1);
  request.onerror = e => console.error(e);
  request.onsuccess = e => {
    const db = e.target.result;
    const transaction = db.transaction('handler', 'readonly');
    const objectStore = transaction.objectStore('handler');
    objectStore.openCursor().onsuccess = e => {
      const cursor = e.target.result;
      if (cursor) {
        self.directory = cursor.value;
      }
    };
  };
}
