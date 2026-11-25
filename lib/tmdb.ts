import type { Movie } from '@/lib/types';

const TMDB_SEARCH_URL = 'https://api.themoviedb.org/3/search/movie';
const POSTER_BASE = 'https://image.tmdb.org/t/p/w342';

export const TMDB_KEY_NAME = 'EXPO_PUBLIC_TMDB_API_KEY';

export const TMDB_FALLBACK_NOTICE =
  'The movie database did not respond. Showing matches from the shelf instead.';

type TmdbMovie = {
  id?: number;
  title?: string;
  release_date?: string;
  overview?: string;
  poster_path?: string | null;
};

export function readTmdbApiKey(env: Record<string, string | undefined> = process.env): string | null {
  const value = env[TMDB_KEY_NAME];
  const trimmed = typeof value === 'string' ? value.trim() : '';
  return trimmed ? trimmed : null;
}

export function tmdbRequest(key: string, query: string): { url: string; headers: Record<string, string> } {
  const url = new URL(TMDB_SEARCH_URL);
  url.searchParams.set('query', query);
  url.searchParams.set('include_adult', 'false');
  url.searchParams.set('language', 'en-US');
  url.searchParams.set('page', '1');

  const headers: Record<string, string> = { Accept: 'application/json' };
  if (key.startsWith('ey')) {
    headers.Authorization = `Bearer ${key}`;
  } else {
    url.searchParams.set('api_key', key);
  }

  return { url: url.toString(), headers };
}

export function mapTmdbMovie(movie: TmdbMovie): Movie | null {
  if (typeof movie.id !== 'number' || !Number.isFinite(movie.id)) return null;
  if (typeof movie.title !== 'string' || !movie.title.trim()) return null;

  const year = movie.release_date?.slice(0, 4);
  return {
    id: `tmdb-${movie.id}`,
    title: movie.title.trim(),
    year: year && /^\d{4}$/.test(year) ? year : '—',
    overview: movie.overview?.trim() || 'No overview yet.',
    posterUrl: movie.poster_path ? `${POSTER_BASE}${movie.poster_path}` : null,
  };
}

export function largerPoster(url: string | null): string | null {
  if (!url) return null;
  return url.replace('/w342/', '/w500/');
}

export async function searchTmdb(
  query: string,
  key: string,
  fetchImpl: typeof fetch = fetch,
): Promise<Movie[]> {
  const request = tmdbRequest(key, query);
  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), 8000);

  try {
    const response = await fetchImpl(request.url, {
      headers: request.headers,
      signal: controller.signal,
    });

    if (!response.ok) {
      throw new Error(`TMDB responded with ${response.status}`);
    }

    const payload = (await response.json()) as { results?: TmdbMovie[] };
    if (!Array.isArray(payload.results)) {
      throw new Error('TMDB returned an unexpected payload');
    }

    return payload.results
      .map(mapTmdbMovie)
      .filter((movie): movie is Movie => movie !== null)
      .slice(0, 20);
  } finally {
    clearTimeout(timer);
  }
}
