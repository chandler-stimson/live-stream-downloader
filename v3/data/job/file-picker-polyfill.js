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
  FileSystemFileHandle.prototype.download = async function() {
    const blob = await this.getFile();
    const objectURL = URL.createObjectURL(blob);

    const link = document.createElement('a');
    link.href = objectURL;
    link.download = this.name.slice(7);
    document.body.append(link);
    link.click();
    setTimeout(() => {
      URL.revokeObjectURL(objectURL);
      navigator.storage.getDirectory().then(root => {
        root.removeEntry(this.name);
      });
    }, 100);
  };

  FileSystemDirectoryHandle.prototype.getFileHandle = new Proxy(FileSystemDirectoryHandle.prototype.getFileHandle, {
    apply(target, self, args) {
      const [name] = args;
      args[0] = (Math.random() + 1).toString(36).substring(2, 7) + ' - ' + name;

      return Reflect.apply(target, self, args);
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
