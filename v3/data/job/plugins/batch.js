/* global error, download */

self.batch = async (jobs, codec) => {
  try {
    const dir = await window.showDirectoryPicker({
      mode: 'readwrite'
    });
    // make sure we are not overwriting existing files
    const filenames = new Set();
    for await (const file of dir.values()) {
      if (file.kind === 'file') {
        filenames.add(file.name);
      }
    }
    const unique = name => {
      if (filenames.has(name)) {
        // try to append "1" to the filename before file extension
        name = name.replace(/\.(?=[^.]+$)/, '-' + 1 + '.');
        return unique(name);
      }
      return name;
    };

    let index = 1;
    for (const {name, segments} of jobs) {
      const n = unique(name);
      filenames.add(n);

      self.aFile = await dir.getFileHandle(n, {
        create: true
      });
      self.aFile.stat = {
        index,
        total: jobs.length
      };
      await download(segments, self.aFile, codec);
      index += 1;
    }
  }
  catch (e) {
    error(e);
  }
};
