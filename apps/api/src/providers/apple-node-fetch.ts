import { Buffer } from 'node:buffer';

export const Headers = globalThis.Headers;

// The Apple library uses the node-fetch v2 timeout option and Response.buffer() for OCSP.
export default async function nodeFetch(url: string, { timeout, ...init }: RequestInit & { timeout?: number } = {}) {
  const signal = timeout ? AbortSignal.timeout(timeout) : init.signal;
  const endpoint = new URL(url);
  const headers = new Headers(init.headers);
  // Apple's OCSP responder accepts RFC 5019 GET requests from Workers.
  if (endpoint.hostname === 'ocsp.apple.com' && init.method === 'POST' &&
      headers.get('content-type') === 'application/ocsp-request' && Buffer.isBuffer(init.body)) {
    const encoded = encodeURIComponent(init.body.toString('base64'));
    if (endpoint.href.length + encoded.length + 1 <= 255) {
      endpoint.pathname += '/' + encoded;
      headers.delete('content-type');
      headers.set('Accept', 'application/ocsp-response');
      init = { ...init, method: 'GET', body: undefined, headers };
    }
  }
  const response = await fetch(endpoint, { ...init, signal });
  return Object.assign(response, { buffer: async () => Buffer.from(await response.arrayBuffer()) });
}
