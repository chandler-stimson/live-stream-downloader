/* global MyGet */

/*
  write to "basic-cache" instead of "cache" using "BasicWriter"
  on flush, writes to the "cache" using "MemoryWriter"
*/

class DGet extends MyGet {
  constructor(...args) {
    super(...args);

    this['basic-cache'] = {};
  }
  writer(segment, position) {
    // only use "basic-cache" when we are dealing with encrypted segment
    if (segment.key) {
      const offset = this.offset(segment, position);

      return new self.BasicWriter(position, offset, this['basic-cache']);
    }
    else {
      return super.writer(segment, position);
    }
  }
  async flush(segment, position) {
    if (segment.key) {
      if (segment.key.method === 'AES-128') {
        const {href} = new URL(segment.key.uri, segment.base);
        const value = await fetch(href).then(r => r.arrayBuffer());

        const chunks = this['basic-cache'][position].map(o => o.chunk);
        const encrypted = await (new Blob(chunks)).arrayBuffer();

        const decrypted = await crypto.subtle.importKey('raw', value, {
          name: 'AES-CBC',
          length: 128
        }, false, ['decrypt']).then(importedKey => crypto.subtle.decrypt({
          name: 'AES-CBC',
          iv: new ArrayBuffer(16)
        }, importedKey, encrypted));

        const offset = this['basic-cache'][position][0].offset;
        delete this['basic-cache'][position];

        const stream = new self.MemoryWriter(position, offset, this.cache);
        const writable = await stream.getWriter();
        await writable.write(new Uint8Array(decrypted));
      }
      else {
        throw Error('UNSUPPORTED_KEY');
      }
    }
    else {
      return;
    }
  }
}

self.MyGet = DGet;
