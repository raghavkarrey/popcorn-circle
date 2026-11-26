import type { IncomingMessage, ServerResponse } from 'node:http';

const UPSTREAM = 'https://api.themoviedb.org/3';
const WINDOW_MS = 60_000;
const LIMIT = 60;
const MAX_RESPONSE = 1_000_000;

type Bucket = { count: number; reset: number };

const buckets = new Map<string, Bucket>();

export function resetTmdbProxyState(): void {
  buckets.clear();
}

export function tmdbProxyTarget(pathname: string, query: URLSearchParams): string | null {
  if (pathname === '/api/tmdb/search') {
    const text = query.get('query')?.trim() ?? '';
    if (!text || text.length > 100) return null;
    const url = new URL(`${UPSTREAM}/search/movie`);
    url.searchParams.set('query', text);
    url.searchParams.set('include_adult', 'false');
    url.searchParams.set('language', 'en-US');
    url.searchParams.set('page', '1');
    return url.toString();
  }

  const match = /^\/api\/tmdb\/movie\/(\d{1,10})\/(recommendations|similar)$/.exec(pathname);
  if (!match) return null;
  const url = new URL(`${UPSTREAM}/movie/${match[1]}/${match[2]}`);
  url.searchParams.set('include_adult', 'false');
  url.searchParams.set('language', 'en-US');
  url.searchParams.set('page', '1');
  return url.toString();
}

function clientIp(request: IncomingMessage): string {
  const forwarded = request.headers['x-forwarded-for'];
  const raw = typeof forwarded === 'string' ? forwarded.split(',')[0]?.trim() : request.socket.remoteAddress;
  return (raw || 'unknown').slice(0, 80);
}

function allowRequest(ip: string, now: number): boolean {
  const current = buckets.get(ip);
  if (!current || now >= current.reset) {
    if (buckets.size > 2000) {
      const oldest = buckets.keys().next().value;
      if (oldest) buckets.delete(oldest);
    }
    buckets.set(ip, { count: 1, reset: now + WINDOW_MS });
    return true;
  }
  if (current.count >= LIMIT) return false;
  current.count += 1;
  return true;
}

function sendJson(response: ServerResponse, status: number, body: unknown, extra: Record<string, string> = {}): void {
  const payload = JSON.stringify(body);
  response.writeHead(status, {
    'Content-Type': 'application/json; charset=utf-8',
    'Content-Length': Buffer.byteLength(payload),
    'Cache-Control': 'no-store',
    'Access-Control-Allow-Origin': process.env.CORS_ORIGIN?.trim() || '*',
    ...extra,
  });
  response.end(payload);
}

export async function handleTmdbProxy(
  request: IncomingMessage,
  response: ServerResponse,
  pathname: string,
  query: URLSearchParams,
  fetchImpl: typeof fetch = fetch,
): Promise<boolean> {
  if (!pathname.startsWith('/api/tmdb')) return false;
  if (request.method !== 'GET') {
    sendJson(response, 405, { error: 'TMDB proxy only accepts GET.' });
    return true;
  }

  const target = tmdbProxyTarget(pathname, query);
  if (!target) {
    sendJson(response, pathname === '/api/tmdb/search' ? 400 : 404, {
      error: pathname === '/api/tmdb/search' ? 'Enter a movie title to search.' : 'That catalog path is not available.',
    });
    return true;
  }

  const now = Date.now();
  if (!allowRequest(clientIp(request), now)) {
    sendJson(response, 429, { error: 'Too many catalog requests. Try again in a minute.' }, { 'Retry-After': '60' });
    return true;
  }

  const key = process.env.TMDB_API_KEY?.trim() ?? '';
  if (!key) {
    sendJson(response, 503, { error: 'TMDB is not configured.' });
    return true;
  }

  const url = new URL(target);
  const headers: Record<string, string> = { Accept: 'application/json' };
  if (key.startsWith('ey')) headers.Authorization = `Bearer ${key}`;
  else url.searchParams.set('api_key', key);

  const timeoutMs = Number(process.env.TMDB_PROXY_TIMEOUT_MS) || 8000;
  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), timeoutMs);
  try {
    const upstream = await fetchImpl(url.toString(), { headers, signal: controller.signal });
    const text = await upstream.text();
    if (!upstream.ok) {
      sendJson(response, 502, { error: `TMDB responded with ${upstream.status}` });
      return true;
    }
    if (text.length > MAX_RESPONSE) {
      sendJson(response, 502, { error: 'TMDB returned an unexpected payload.' });
      return true;
    }
    response.writeHead(200, {
      'Content-Type': 'application/json; charset=utf-8',
      'Content-Length': Buffer.byteLength(text),
      'Cache-Control': 'public, max-age=60',
      'Access-Control-Allow-Origin': process.env.CORS_ORIGIN?.trim() || '*',
    });
    response.end(text);
    return true;
  } catch (error) {
    const aborted = error instanceof Error && (error.name === 'AbortError' || error.message.toLowerCase().includes('abort'));
    sendJson(response, aborted ? 504 : 502, { error: aborted ? 'TMDB timed out.' : 'TMDB did not respond.' });
    return true;
  } finally {
    clearTimeout(timer);
  }
}
