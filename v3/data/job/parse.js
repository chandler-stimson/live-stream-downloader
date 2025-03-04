/* global m3u8Parser, mpdParser */

// eslint-disable-next-line no-unused-vars
const parse = async (manifest, file, href, codec, next) => {
  console.info('Parsing', href || manifest);

  // data uri
  if (manifest.startsWith('data:')) {
    manifest = await fetch(manifest).then(r => r.text());
  }

  // manifest is URL
  if (manifest.split('\n').length === 1) {
    if (!href) {
      href = manifest;
    }

    let uri;
    if (manifest.startsWith('http') || manifest.startsWith('blob:')) {
      uri = new URL(manifest);
    }
    else if (href && (href.startsWith('http') || href.startsWith('blob:'))) {
      uri = new URL(manifest, href);
    }
    else {
      href = await prompt(`What is the base URL for "${manifest}"`, {
        ok: 'Set Base',
        no: 'Abort'
      }, true);
      uri = new URL(manifest, href);
    }

    // what if manifest is a media
    if (!uri.href.includes('.mpd') && !uri.href.includes('.m3u8')) {
      const r = await fetch(uri.href);
      const type = r.headers.get('Content-Type');
      if (type) {
        if (type.startsWith('video/') || type.startsWith('audio/')) {
          return next([{
            uri: uri.href,
            base: href
          }], file, codec);
        }
      }
    }

    manifest = await fetch(uri.href).then(r => {
      if (r.ok) {
        href = uri.href;
        return r.text();
      }
      throw Error('FAILED_TO_FETCH_' + r.status);
    });
  }

  let parser;

  if (href && (href.includes('.mpd')) || (manifest.includes('<MPD'))) {
    parser = {
      manifest: mpdParser.parse(manifest, {
        manifestUri: href
      })
    };
  }
  else {
    parser = new m3u8Parser.Parser();
    parser.push(manifest);
    parser.end();
  }

  console.info('[Manifest]', parser);

  const playlists = parser.manifest.playlists || [];
  // add media groups
  if (parser.manifest.mediaGroups) {
    for (const [type, group] of Object.entries(parser.manifest.mediaGroups)) {
      try {
        Object.values(group).forEach(g => {
          for (const [lang, o] of Object.entries(g)) {
            for (const c of (o.playlists || [o])) {
              playlists.push({
                ...c,
                group: {
                  lang,
                  type
                }
              });
            }
          }
        });
      }
      catch (e) {
        console.error('cannot append a media group', e);
      }
    }
  }

  if (playlists.length) {
    const {quality} = await chrome.storage.local.get({
      quality: 'selector'
    });

    let n = 0; // highest
    // sort based on highest quality
    playlists.sort((a, b) => {
      // dealing with groups
      if (a.group && !b.group) {
        return 1;
      }
      if (b.group && !a.group) {
        return -1;
      }
      if (a.group && b.group) {
        return b.group.type.localeCompare(a.group.type);
      }

      try {
        const one = b.attributes.RESOLUTION.width - a.attributes.RESOLUTION.width;

        // same quality
        if (one === 0 && 'BANDWIDTH' in b.attributes) {
          return b.attributes.BANDWIDTH - a.attributes.BANDWIDTH;
        }
        return one;
      }
      catch (e) {
        return 0;
      }
    });
    if (quality === 'selector') {
      const msgs = [];

      const trim = (str = '', trimSize = 40) => {
        if (str.length <= trimSize) {
          return str;
        }

        const start = str.substring(0, trimSize / 2 - 2); // -2 to account for the ellipsis
        const end = str.substring(str.length - trimSize / 2 + 1); // +1 to keep the ellipsis at the end

        return start + '...' + end;
      };

      for (const playlist of playlists) {
        if (playlist.attributes && playlist.attributes.RESOLUTION) {
          msgs.push(
            'Video [' +
            playlist.attributes.RESOLUTION.width + ' × ' +
            playlist.attributes.RESOLUTION.height + ']   ' +
            trim(playlist.resolvedUri || playlist.uri)
          );
        }
        else if (playlist.group) {
          const features = [playlist.group.lang.toLowerCase()];
          if (playlist.attributes?.CODECS) {
            features.push(playlist.attributes?.CODECS);
          }
          if (playlist.attributes?.BANDWIDTH) {
            features.push(playlist.attributes?.BANDWIDTH);
          }

          msgs.push(
            playlist.group.type.toLowerCase() + ' [' +
            features.join(' - ') + ']   ' +
            trim(playlist.resolvedUri || playlist.uri, 30)
          );
        }
        else {
          msgs.push(trim(playlist.resolvedUri || playlist.uri));
        }
      }
      n = (playlists.length > 1 ? await prompt('Select one stream:\n\n' + msgs.map((m, n) => n + '. ' + m).join('\n'), {
        ok: 'Select Quality',
        no: 'Abort',
        value: 0
      }, true) : 0);
    }
    else if (quality === 'lowest') {
      // remove media groups first
      // n = playlists.length - 1;
      n = playlists.filter(o => !o.group).length - 1;
    }

    const playlist = playlists[Number(n)];
    if (playlist) {
      if (playlist.segments && playlist.segments.length) {
        parser.manifest.segments = playlist.segments;
      }
      else {
        try {
          const codec = playlist.attributes?.CODECS;
          const o = new URL(playlist.resolvedUri || playlist.uri, href || undefined);
          return parse(o.href, file, undefined, codec, next);
        }
        catch (e) {
          return parse(playlist.resolvedUri || playlist.uri, file, href, undefined, next);
        }
      }
    }
    else {
      throw Error('UNKNOWN_QUALITY');
    }
  }

  const segments = parser.manifest.segments;

  if (segments.length) {
    // do we have a valid segment
    if (!href && segments[0].uri.startsWith('http') === false) {
      href = await prompt(`What is the base URL for "${segments[0].uri}"`, {
        ok: 'Set Base',
        no: 'Abort'
      }, true);
    }

    return next(segments.map(segment => {
      segment.base = href;
      return segment;
    }), file, codec);
  }
  else {
    throw Error('No_SEGMENT_DETECTED');
  }
};
