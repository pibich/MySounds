'use strict';

const { protocol, net } = require('electron');
const path = require('path');
const { pathToFileURL } = require('url');

function registerMediaScheme() {
  protocol.registerSchemesAsPrivileged([
    {
      scheme: 'media',
      privileges: {
        standard: true,
        secure: true,
        supportFetchAPI: true,
        corsEnabled: true,
        stream: true
      }
    }
  ]);
}

function registerMediaProtocol(soundsDir) {
  const baseDir = path.dirname(path.normalize(soundsDir));
  const root = path.normalize(soundsDir + path.sep);

  protocol.handle('media', async (request) => {
    let pathname;
    try {
      pathname = decodeURIComponent(new URL(request.url).pathname).replace(/^\/+/, '');
    } catch (_) {
      return new Response('Bad request', { status: 400 });
    }
    const abs = path.normalize(path.join(baseDir, pathname));
    if (!abs.startsWith(root)) {
      return new Response('Forbidden', { status: 403 });
    }
    const upstream = await net.fetch(pathToFileURL(abs).toString());
    const headers = new Headers(upstream.headers);
    headers.set('Access-Control-Allow-Origin', '*');
    return new Response(upstream.body, {
      status: upstream.status,
      statusText: upstream.statusText,
      headers
    });
  });
}

module.exports = { registerMediaScheme, registerMediaProtocol };
