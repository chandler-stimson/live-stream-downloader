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

/* global FileSystemFileHandle, FileSystemDirectoryHandle,  */
if (typeof self.showSaveFilePicker === 'undefined') {
  /* delete an OPFS file; only call it on handles that this polyfill created,
     no handle of a user-picked file (Chrome) can ever reach it */
  self.removeOPFSFile = async file => {
    try {
      // release an open writable so that "removeEntry" is not blocked by an active stream
      try {
        await file.writer?.abort();
      }
      catch (e) {
        // already closed (the normal case) or aborting is not possible
      }
      const root = await navigator.storage.getDirectory();
      await root.removeEntry(file.name);
    }
    catch (e) {
      // the startup wipe of the background page removes leftovers eventually
      return false;
    }
    return true;
  };

  FileSystemFileHandle.prototype.download = async function() {
    const blob = await this.getFile();
    const objectURL = URL.createObjectURL(blob);

    const link = document.createElement('a');
    link.href = objectURL;
    link.download = this.name.slice(7);
    document.body.append(link);
    link.click();
    link.remove();

    // hand off first, delete later; deleting the OPFS copy before the download
    // starts can invalidate a Firefox blob that is still backed by the file.
    // never rejects (a leftover is picked up by the background page on its next start)
    setTimeout(() => {
      URL.revokeObjectURL(objectURL);
      self.removeOPFSFile(this);
    }, 100);
  };

  FileSystemDirectoryHandle.prototype.getFileHandle = new Proxy(FileSystemDirectoryHandle.prototype.getFileHandle, {
    apply(target, self, args) {
      const [name, options] = args;
      args[0] = (Math.random() + 1).toString(36).substring(2, 7) + ' - ' + name;

      const promise = Reflect.apply(target, self, args);
      // only created files are marked; a read request does not create anything.
      // the marker lets error handlers know that it is safe to delete the file
      // (never set for user-picked files)
      if (options?.create) {
        return promise.then(handle => {
          handle.opfsStaged = true;
          return handle;
        });
      }
      return promise;
    }
  });

  self.showSaveFilePicker = function(options = {}) {
    return navigator.storage.getDirectory().then(root => {
      return root.getFileHandle(options.suggestedName, {
        create: true
      });
    });
  };

  self.showDirectoryPicker = function() {
    return navigator.storage.getDirectory();
  };
}
