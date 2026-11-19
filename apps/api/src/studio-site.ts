const assetPrefix = '/_studio';
const publisherRecord = 'google.com, pub-8278526737142254, DIRECT, f08c47fec0942fa0\n';
const robots = 'User-agent: *\nAllow: /app-ads.txt\n';

async function videoResponse(request: Request, response: Response) {
  const headers = new Headers(response.headers);
  headers.set('Accept-Ranges', 'bytes');
  const range = request.headers.get('Range')?.match(/^bytes=(\d*)-(\d*)$/i);
  const ifRange = request.headers.get('If-Range');
  if (request.method !== 'GET' || response.status !== 200 || !range || (!range[1] && !range[2])
    || (ifRange && (ifRange.startsWith('W/') || ifRange !== headers.get('ETag')))) {
    return new Response(response.body, { status: response.status, headers });
  }

  // Static Assets limits individual files to 25 MiB and returns the complete video for Range requests.
  const video = await response.arrayBuffer();
  const size = video.byteLength;
  const start = range[1] ? Number(range[1]) : Math.max(0, size - Number(range[2]));
  const end = range[1] && range[2] ? Math.min(size - 1, Number(range[2])) : size - 1;
  if (start > end) {
    headers.set('Content-Range', `bytes */${size}`);
    headers.delete('Content-Length');
    return new Response(null, { status: 416, headers });
  }
  headers.set('Content-Range', `bytes ${start}-${end}/${size}`);
  headers.set('Content-Length', String(end - start + 1));
  return new Response(video.slice(start, end + 1), { status: 206, headers });
}

export function serveStudioSite(request: Request, assets?: Pick<Fetcher, 'fetch'>) {
  const url = new URL(request.url);
  const path = url.pathname;
  if (url.hostname === 'hiddenstage.app' && (path === '/app-ads.txt' || path === '/robots.txt')) {
    if (request.method !== 'GET' && request.method !== 'HEAD') {
      return new Response(null, { status: 405, headers: { Allow: 'GET, HEAD' } });
    }
    return new Response(request.method === 'HEAD' ? null : path === '/app-ads.txt' ? publisherRecord : robots, {
      headers: {
        'Content-Type': 'text/plain; charset=utf-8',
        'Cache-Control': 'public, max-age=300',
        'X-Content-Type-Options': 'nosniff',
      },
    });
  }
  if (!assets || (request.method !== 'GET' && request.method !== 'HEAD')) return;

  if (/^\/official(?:\/(ko|en|ja))?\/?$/.test(path)) {
    return assets.fetch(new Request(new URL(assetPrefix + '/games/cloud-garden/', url), { method: 'HEAD' }))
      .then(page => page.ok
        ? new Response(null, { status: 302, headers: { Location: '/games/cloud-garden/' } })
        : undefined);
  }
  const isStudioPath = path === '/' || path === '/style.css' || path === '/site.js'
    || /^\/(gallery|games|stories|media)(\/|$)/.test(path);
  if (!isStudioPath) return;

  url.pathname = assetPrefix + path;
  const headers = new Headers();
  const etag = request.headers.get('If-None-Match');
  if (etag) headers.set('If-None-Match', etag);
  return assets.fetch(new Request(url, { method: request.method, headers, redirect: 'manual' })).then(response => {
    if (path === '/' && response.status === 404) return;
    const location = response.headers.get('Location');
    if (location) {
      const redirect = new URL(location, url);
      if (redirect.origin === url.origin && redirect.pathname.startsWith(assetPrefix + '/')) {
        const rewritten = new Headers(response.headers);
        rewritten.set('Location', redirect.pathname.slice(assetPrefix.length) + redirect.search);
        return new Response(response.body, { status: response.status, headers: rewritten });
      }
    }
    return path.startsWith('/media/') && path.endsWith('.mp4')
      ? videoResponse(request, response)
      : response;
  });
}
