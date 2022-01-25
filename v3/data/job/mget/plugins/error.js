/* global MyGet */

/*
  runs a pipe several times if it is broken;
  it is considered that the writable supports overwriting old segments
*/

class EGet extends MyGet {
  constructor(...args) {
    super(...args);

    this.options['error-tolerance'] = 10; // number; number of times a single uri can throw error before breaking
    this.options['error-delay'] = 500; // ms; delay before restarting the segment
    this.errors = new Map();
  }
  async pipe(...args) {
    for (let n = 0; ; n += 1) {
      try {
        const r = await super.pipe(...args);
        return r;
      }
      catch (e) {
        console.log('pipe is broken', e);
        if (n > this.options['error-tolerance']) {
          throw e;
        }
        this.actives -= 1;
      }
      await new Promise(resolve => setTimeout(resolve, this.options['error-delay']));
    }
  }
}

self.MyGet = EGet;
