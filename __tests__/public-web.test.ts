/// <reference types="jest" />
import http from 'node:http';
import { readFileSync } from 'node:fs';
import path from 'node:path';

import { searchMovies } from '../lib/movies';
import { listenGroupServer } from '../server/http';
import { createMemoryGroupStore } from '../server/store';
import { resetTmdbProxyState, tmdbProxyTarget } from '../server/tmdb-proxy';

function listen() {
  return listenGroupServer(createMemoryGroupStore(), 0);
}

function get(port: number, pathname: string): Promise<{ status: number; headers: http.IncomingHttpHeaders; body: string }> {
  return new Promise((resolve, reject) => {
    const request = http.request(
      { hostname: '127.0.0.1', port, path: pathname, method: 'GET' },
      (response) => {
        const chunks: Buffer[] = [];
        response.on('data', (chunk: Buffer) => chunks.push(chunk));
        response.on('end', () => {
          resolve({
            status: response.statusCode ?? 0,
            headers: response.headers,
            body: Buffer.concat(chunks).toString('utf8'),
          });
        });
      },
    );
    request.on('error', reject);
    request.end();
  });
}

describe('TMDB proxy allowlist', () => {
  it('accepts search and related-movie paths only', () => {
    expect(tmdbProxyTarget('/api/tmdb/search', new URLSearchParams('query=Dune'))).toContain('/search/movie');
    expect(tmdbProxyTarget('/api/tmdb/movie/238/recommendations', new URLSearchParams())).toContain('/movie/238/recommendations');
    expect(tmdbProxyTarget('/api/tmdb/movie/238/similar', new URLSearchParams())).toContain('/movie/238/similar');
    expect(tmdbProxyTarget('/api/tmdb/movie/238/credits', new URLSearchParams())).toBeNull();
    expect(tmdbProxyTarget('/api/tmdb/movie/238/recommendations/extra', new URLSearchParams())).toBeNull();
    expect(tmdbProxyTarget('/api/tmdb/search', new URLSearchParams())).toBeNull();
  });

  it('does not put an api key in the client request when the web app uses the proxy', async () => {
    const fetchImpl = jest.fn(async () => ({
      ok: true,
      json: async () => ({ results: [] }),
    }));
    await searchMovies('Dune', { key: null, proxy: true, fetchImpl: fetchImpl as unknown as typeof fetch });
    const url = String((fetchImpl.mock.calls as unknown[][])[0]?.[0]);
    expect(url.startsWith('/api/tmdb/search?query=Dune')).toBe(true);
    expect(url).not.toContain('api_key');
    expect(url).not.toContain('themoviedb.org');
  });
});

describe('public site routes', () => {
  const previousKey = process.env.TMDB_API_KEY;
  const previousTimeout = process.env.TMDB_PROXY_TIMEOUT_MS;
  const originalFetch = global.fetch;

  beforeEach(() => {
    resetTmdbProxyState();
  });

  afterEach(() => {
    if (previousKey === undefined) delete process.env.TMDB_API_KEY;
    else process.env.TMDB_API_KEY = previousKey;
    if (previousTimeout === undefined) delete process.env.TMDB_PROXY_TIMEOUT_MS;
    else process.env.TMDB_PROXY_TIMEOUT_MS = previousTimeout;
    global.fetch = originalFetch;
  });

  it('serves the landing page, the app shell, and deep links without replacing the API', async () => {
    const server = await listen();
    try {
      const home = await get(server.port, '/');
      expect(home.status).toBe(200);
      expect(home.body).toContain('href="/app"');
      expect(home.body).toContain('Open the app');

      const health = await get(server.port, '/health');
      expect(health.body).toContain('"ok":true');

      const privacy = await get(server.port, '/privacy');
      expect(privacy.status).toBe(200);
      expect(privacy.body).toContain('privacy');

      const shell = readFileSync(path.join(process.cwd(), 'web', 'index.html'), 'utf8');
      const app = await get(server.port, '/app');
      const deep = await get(server.port, '/app/movie/tmdb-238');
      expect(app.status).toBe(200);
      expect(app.headers['content-type']).toContain('text/html');
      expect(app.headers['cache-control']).toBe('no-cache');
      expect(deep.body).toBe(shell);
      expect(deep.body).toContain('/app/');
    } finally {
      await server.close();
    }
  });

  it('returns 503 and does not call TMDB when the server key is missing', async () => {
    delete process.env.TMDB_API_KEY;
    const fetchImpl = jest.fn();
    global.fetch = fetchImpl as unknown as typeof fetch;
    const server = await listen();
    try {
      const response = await get(server.port, '/api/tmdb/search?query=Dune');
      expect(response.status).toBe(503);
      expect(response.body).toContain('not configured');
      expect(fetchImpl).not.toHaveBeenCalled();
      const denied = await get(server.port, '/api/tmdb/movie/238/credits');
      expect(denied.status).toBe(404);
    } finally {
      await server.close();
    }
  });

  it('times out a stalled TMDB response', async () => {
    process.env.TMDB_API_KEY = 'test-key';
    process.env.TMDB_PROXY_TIMEOUT_MS = '30';
    global.fetch = ((_url: string, init?: RequestInit) =>
      new Promise((_resolve, reject) => {
        init?.signal?.addEventListener('abort', () => {
          const error = new Error('aborted');
          error.name = 'AbortError';
          reject(error);
        });
      })) as typeof fetch;
    const server = await listen();
    try {
      const response = await get(server.port, '/api/tmdb/movie/238/recommendations');
      expect(response.status).toBe(504);
      expect(response.body).toContain('timed out');
      expect(response.body).not.toContain('test-key');
    } finally {
      await server.close();
    }
  });

  it('forwards an allowlisted search and keeps the key on the server', async () => {
    process.env.TMDB_API_KEY = 'test-key';
    const seen: string[] = [];
    global.fetch = (async (url: string) => {
      seen.push(String(url));
      return new Response(JSON.stringify({ results: [] }), { status: 200, headers: { 'Content-Type': 'application/json' } });
    }) as typeof fetch;
    const server = await listen();
    try {
      const response = await get(server.port, '/api/tmdb/search?query=Dune&api_key=client-secret');
      expect(response.status).toBe(200);
      expect(response.body).toContain('"results"');
      expect(seen[0]).toContain('/search/movie');
      expect(seen[0]).toContain('api_key=test-key');
      expect(seen[0]).not.toContain('client-secret');
      expect(response.body).not.toContain('test-key');
    } finally {
      await server.close();
    }
  });
});
