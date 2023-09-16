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
