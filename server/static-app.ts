import { createReadStream, existsSync, statSync } from 'node:fs';
import type { ServerResponse } from 'node:http';
import path from 'node:path';

const TYPES: Record<string, string> = {
  '.html': 'text/html; charset=utf-8',
  '.js': 'text/javascript; charset=utf-8',
  '.css': 'text/css; charset=utf-8',
  '.json': 'application/json; charset=utf-8',
  '.png': 'image/png',
  '.jpg': 'image/jpeg',
  '.jpeg': 'image/jpeg',
  '.svg': 'image/svg+xml',
  '.ico': 'image/x-icon',
  '.woff': 'font/woff',
  '.woff2': 'font/woff2',
  '.txt': 'text/plain; charset=utf-8',
  '.map': 'application/json; charset=utf-8',
  '.webp': 'image/webp',
};

export function appRoot(cwd = process.cwd()): string {
  return path.resolve(cwd, 'web');
}

export function cacheControlFor(relativePath: string): string {
  const base = path.basename(relativePath);
  if (relativePath.includes(`${path.sep}_expo${path.sep}`) || relativePath.startsWith(`_expo${path.sep}`) || /\.[a-f0-9]{8,}\./i.test(base)) {
    return 'public, max-age=31536000, immutable';
  }
  if (base === 'index.html' || base.endsWith('.html')) return 'no-cache';
  return 'public, max-age=3600';
}

export function resolveAppRequest(pathname: string, root = appRoot()): { file: string; fallback: boolean } | null {
  if (pathname !== '/app' && !pathname.startsWith('/app/')) return null;
  let decoded = pathname.slice(4);
  try {
    decoded = decodeURIComponent(decoded);
  } catch {
    return { file: path.join(root, 'index.html'), fallback: true };
  }
  const relative = decoded.replace(/^\/+/, '');
  if (relative.split('/').some((part) => part === '..' || part === '.')) {
    return { file: path.join(root, 'index.html'), fallback: true };
  }

  const index = path.join(root, 'index.html');
  if (!relative) return { file: index, fallback: true };

  const candidate = path.resolve(root, relative);
  if (candidate !== root && !candidate.startsWith(`${root}${path.sep}`)) {
    return { file: index, fallback: true };
  }
  if (existsSync(candidate) && statSync(candidate).isFile()) {
    return { file: candidate, fallback: false };
  }
  return { file: index, fallback: true };
}

export function serveAppFile(response: ServerResponse, file: string, root = appRoot()): boolean {
  if (!existsSync(file)) {
    response.writeHead(404, { 'Content-Type': 'text/plain; charset=utf-8', 'Cache-Control': 'no-store' });
    response.end('App files are not built.');
    return true;
  }
  const relative = path.relative(root, file);
  const type = TYPES[path.extname(file).toLowerCase()] ?? 'application/octet-stream';
  response.writeHead(200, {
    'Content-Type': type,
    'Cache-Control': cacheControlFor(relative),
  });
  createReadStream(file).pipe(response);
  return true;
}
