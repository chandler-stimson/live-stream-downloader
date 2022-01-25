/* global MyGet */

// assumes that this.cache is replaced with {writer, offset = 0, cache = {}};
class DiskWriter {
  constructor(id, offset = 0, o) {
    return new WritableStream({
      async write(chunk) {
        await o.writer.write({
          type: 'write',
          data: chunk,
          position: offset
        });
        offset += chunk.byteLength;
      },
      close() {}
    }, {});
  }
}
self.MemoryWriter = DiskWriter;

class FGet extends MyGet {
  /* prepare disk usage */
  async attach(file) {
    const writer = await file.createWritable();
    writer.target = file;
    file.writer = writer;

    this.cache = {
      writer
    };
  }
  async fetch(...args) {
    await super.fetch(...args);
    await this.cache.writer.close();
  }
}
self.MyGet = FGet;
