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
