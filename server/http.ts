import { readFileSync } from 'node:fs';
import { readFile as readFileAsync } from 'node:fs/promises';
import { createServer, type IncomingMessage, type Server, type ServerResponse } from 'node:http';
import path from 'node:path';

import { GroupError } from '../lib/groups.ts';
import { landingHtml } from './landing.ts';
import { resolveAppRequest, serveAppFile } from './static-app.ts';
import type { GroupStore } from './store.ts';
import { handleTmdbProxy } from './tmdb-proxy.ts';

function tmdbLogo(): string {
  try {
    return readFileSync(path.join(process.cwd(), 'assets/images/tmdb-logo.svg'), 'utf8');
  } catch {
    return '';
  }
}

const MAX_BODY = 100_000;

function corsOrigin(): string {
  return process.env.CORS_ORIGIN?.trim() || '*';
}

function send(response: ServerResponse, status: number, body: unknown, contentType = 'application/json; charset=utf-8') {
  const payload = typeof body === 'string' ? body : JSON.stringify(body);
  response.writeHead(status, {
    'Content-Type': contentType,
    'Content-Length': Buffer.byteLength(payload),
    'Access-Control-Allow-Origin': corsOrigin(),
    'Access-Control-Allow-Methods': 'GET, POST, OPTIONS',
    'Access-Control-Allow-Headers': 'Content-Type, Authorization',
    'Cache-Control': 'no-store',
  });
  response.end(payload);
}

function readBody(request: IncomingMessage): Promise<Record<string, unknown>> {
  return new Promise((resolve, reject) => {
    const chunks: Buffer[] = [];
    let size = 0;
    request.on('data', (chunk: Buffer) => {
      size += chunk.length;
      if (size > MAX_BODY) {
        reject(new GroupError('That request is too large.', 413));
        request.destroy();
        return;
      }
      chunks.push(chunk);
    });
    request.on('end', () => {
      if (chunks.length === 0) {
        resolve({});
        return;
      }
      try {
        const parsed = JSON.parse(Buffer.concat(chunks).toString('utf8')) as unknown;
        if (!parsed || typeof parsed !== 'object' || Array.isArray(parsed)) {
          reject(new GroupError('Expected a JSON object.'));
          return;
        }
        resolve(parsed as Record<string, unknown>);
      } catch {
        reject(new GroupError('Expected JSON.'));
      }
    });
    request.on('error', reject);
  });
}

function text(value: unknown): string {
  return typeof value === 'string' ? value : '';
}

function movieFrom(body: Record<string, unknown>) {
  const movie = body.movie;
  if (!movie || typeof movie !== 'object' || Array.isArray(movie)) {
    throw new GroupError('A movie is required.');
  }
  const record = movie as Record<string, unknown>;
  return {
    id: text(record.id),
    title: text(record.title),
    year: text(record.year),
    overview: text(record.overview),
    posterUrl: typeof record.posterUrl === 'string' ? record.posterUrl : null,
    stars: typeof record.stars === 'number' ? record.stars : Number.NaN,
    note: text(record.note),
  };
}

function assertAdmin(request: IncomingMessage) {
  const configured = process.env.ADMIN_TOKEN?.trim() ?? '';
  if (!configured) throw new GroupError('Set ADMIN_TOKEN before reviewing reports.', 503);
  const header = request.headers.authorization ?? '';
  if (header !== `Bearer ${configured}`) throw new GroupError('Admin token required.', 401);
}

function escapeHtml(value: string): string {
  return value
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;');
}

function renderInline(line: string): string {
  const withBold = escapeHtml(line).replace(/\*\*(.+?)\*\*/g, '<strong>$1</strong>');
  return withBold.replace(/\[([^\]\n]+)\]\(([^)\s]+)\)/g, (match, label: string, href: string) => {
    const decoded = href.replace(/&amp;/g, '&');
    if (!/^(https?:\/\/|mailto:)/i.test(decoded)) return match;
    return `<a href="${escapeHtml(decoded)}">${label}</a>`;
  });
}

async function privacyDocument(): Promise<string> {
  let markdown = 'Privacy policy unavailable.';
  try {
    markdown = await readFileAsync(path.join(process.cwd(), 'privacy.md'), 'utf8');
  } catch {
    markdown = 'Privacy policy file was not found next to the server.';
  }
  const body = markdown
    .split('\n')
    .map((line) => {
      if (line.startsWith('# ')) return `<h1>${escapeHtml(line.slice(2))}</h1>`;
      if (line.startsWith('## ')) return `<h2>${escapeHtml(line.slice(3))}</h2>`;
      if (!line.trim()) return '';
      const safe = renderInline(line);
      return `<p>${safe}</p>`;
    })
    .join('\n');
  return `<!doctype html><html lang="en"><head><meta charset="utf-8"><meta name="viewport" content="width=device-width, initial-scale=1"><title>Popcorn Circle privacy</title><style>body{font-family:Georgia,serif;max-width:40rem;margin:2rem auto;padding:0 1.25rem;line-height:1.55;background:#0c0c0f;color:#f4f1ea}h1,h2{font-family:sans-serif;line-height:1.2}a{color:#e4a853}</style></head><body>${body}</body></html>`;
}

async function route(store: GroupStore, request: IncomingMessage, response: ServerResponse) {
  if (request.method === 'OPTIONS') {
    send(response, 204, {});
    return;
  }

  const url = new URL(request.url ?? '/', 'http://127.0.0.1');
  const parts = url.pathname.split('/').filter(Boolean);

  if (request.method === 'GET' && (url.pathname === '/' || url.pathname === '')) {
    send(response, 200, landingHtml(tmdbLogo()), 'text/html; charset=utf-8');
    return;
  }

  if (request.method === 'GET' && url.pathname === '/health') {
    send(response, 200, { ok: true });
    return;
  }

  if (request.method === 'GET' && url.pathname === '/privacy') {
    send(response, 200, await privacyDocument(), 'text/html; charset=utf-8');
    return;
  }

  if (url.pathname.startsWith('/api/tmdb')) {
    await handleTmdbProxy(request, response, url.pathname, url.searchParams);
    return;
  }

  if (request.method === 'GET' && (url.pathname === '/app' || url.pathname.startsWith('/app/'))) {
    const resolved = resolveAppRequest(url.pathname);
    if (resolved) {
      serveAppFile(response, resolved.file);
      return;
    }
  }

  if (parts[0] === 'admin') {
    assertAdmin(request);
    if (request.method === 'GET' && parts[1] === 'reports') {
      send(response, 200, { reports: await store.reports() });
      return;
    }
    if (request.method === 'POST' && parts[1] === 'remove') {
      const body = await readBody(request);
      const removed = await store.adminRemove({
        code: text(body.code),
        memberId: text(body.memberId),
        movieId: text(body.movieId),
      });
      send(response, 200, { removed });
      return;
    }
    send(response, 404, { error: 'Not found.' });
    return;
  }

  if (parts[0] !== 'v1' || parts[1] !== 'groups') {
    send(response, 404, { error: 'Not found.' });
    return;
  }

  if (request.method === 'POST' && parts.length === 2) {
    const body = await readBody(request);
    const result = await store.create(text(body.name));
    send(response, 201, result);
    return;
  }

  if (request.method === 'POST' && parts.length === 3 && parts[2] === 'join') {
    const body = await readBody(request);
    const result = await store.join(text(body.code), text(body.name));
    send(response, 200, result);
    return;
  }

  const code = parts[2] ? decodeURIComponent(parts[2]) : '';
  if (!code || code === 'join') {
    send(response, 404, { error: 'Not found.' });
    return;
  }

  if (request.method === 'GET' && parts.length === 3) {
    const view = await store.view({
      code,
      memberId: url.searchParams.get('memberId') ?? '',
      token: url.searchParams.get('token') ?? '',
    });
    send(response, 200, view);
    return;
  }

  if (request.method === 'POST' && parts.length === 4 && parts[3] === 'name') {
    const body = await readBody(request);
    const group = await store.rename({
      code,
      memberId: text(body.memberId),
      token: text(body.token),
      name: text(body.name),
    });
    send(response, 200, { group });
    return;
  }

  if (request.method === 'POST' && parts.length === 4 && parts[3] === 'ratings') {
    const body = await readBody(request);
    const group = await store.rate({
      code,
      memberId: text(body.memberId),
      token: text(body.token),
      movie: movieFrom(body),
    });
    send(response, 200, { group });
    return;
  }

  if (request.method === 'POST' && parts.length === 4 && parts[3] === 'ratings-remove') {
    const body = await readBody(request);
    const group = await store.removeRating({
      code,
      memberId: text(body.memberId),
      token: text(body.token),
      movieId: text(body.movieId),
      title: text(body.title),
      year: text(body.year),
    });
    send(response, 200, { group });
    return;
  }

  if (request.method === 'POST' && parts.length === 4 && parts[3] === 'leave') {
    const body = await readBody(request);
    const group = await store.leave({
      code,
      memberId: text(body.memberId),
      token: text(body.token),
    });
    send(response, 200, { group });
    return;
  }

  if (request.method === 'POST' && parts.length === 4 && (parts[3] === 'block' || parts[3] === 'unblock')) {
    const body = await readBody(request);
    const action = parts[3] === 'block' ? store.block.bind(store) : store.unblock.bind(store);
    const view = await action({
      code,
      memberId: text(body.memberId),
      token: text(body.token),
      blockedMemberId: text(body.blockedMemberId),
    });
    send(response, 200, view);
    return;
  }

  if (request.method === 'POST' && parts.length === 4 && parts[3] === 'reports') {
    const body = await readBody(request);
    const report = await store.report({
      code,
      memberId: text(body.memberId),
      token: text(body.token),
      targetMemberId: text(body.targetMemberId),
      movieId: text(body.movieId),
    });
    send(response, 201, { report });
    return;
  }

  send(response, 404, { error: 'Not found.' });
}

export function createGroupHttpServer(store: GroupStore): Server {
  return createServer((request, response) => {
    route(store, request, response).catch((error: unknown) => {
      if (response.headersSent) return;
      if (error instanceof GroupError) {
        send(response, error.status, { error: error.message });
        return;
      }
      console.error(error);
      send(response, 500, { error: 'The group server hit a problem.' });
    });
  });
}

export function listenGroupServer(
  store: GroupStore,
  port: number,
  host = '127.0.0.1',
): Promise<{ port: number; close: () => Promise<void> }> {
  const server = createGroupHttpServer(store);
  return new Promise((resolve, reject) => {
    server.once('error', reject);
    server.listen(port, host, () => {
      const address = server.address();
      const assigned = address && typeof address === 'object' ? address.port : port;
      resolve({
        port: assigned,
        close: () =>
          new Promise((done, fail) => {
            server.close((error) => (error ? fail(error) : done()));
          }),
      });
    });
  });
}
