import type { Movie, Rating, SortMode } from '@/lib/types';

export const RATINGS_STORAGE_KEY = 'aftercredits.ratings.v1';
export const MIN_STARS = 0.5;
export const MAX_STARS = 5;
export const MAX_NOTE_LENGTH = 280;

export class RatingValidationError extends Error {
  constructor(message: string) {
    super(message);
    this.name = 'RatingValidationError';
  }
}

export interface KeyValueStore {
  getItem(key: string): Promise<string | null>;
  setItem(key: string, value: string): Promise<void>;
  removeItem(key: string): Promise<void>;
}

export function isValidStars(stars: number): boolean {
  if (typeof stars !== 'number' || !Number.isFinite(stars)) return false;
  const steps = Math.round(stars * 2);
  if (Math.abs(stars * 2 - steps) > 1e-6) return false;
  return steps >= 1 && steps <= 10;
}

export function normalizeNote(note: string): string {
  const trimmed = note.trim();
  return trimmed.length <= MAX_NOTE_LENGTH ? trimmed : trimmed.slice(0, MAX_NOTE_LENGTH);
}

export function normalizeTitle(title: string): string {
  return title
    .toLowerCase()
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    .replace(/[^a-z0-9]+/g, ' ')
    .trim();
}

export function formatStars(stars: number): string {
  if (!Number.isFinite(stars)) return '';
  return Number.isInteger(stars) ? String(stars) : stars.toFixed(1);
}

export function buildRating(input: {
  movie: Movie;
  stars: number;
  note?: string;
  updatedAt?: number;
}): Rating {
  const title = input.movie.title?.trim() ?? '';
  const movieId = input.movie.id?.trim() ?? '';

  if (!movieId || !title) {
    throw new RatingValidationError('A movie title is required.');
  }

  if (!isValidStars(input.stars)) {
    throw new RatingValidationError('Choose a rating from half a star to five, in half-star steps.');
  }

  return {
    movieId,
    title,
    year: input.movie.year?.trim() || '—',
    overview: input.movie.overview?.trim() ?? '',
    posterUrl: input.movie.posterUrl,
    stars: input.stars,
    note: normalizeNote(input.note ?? ''),
    updatedAt: input.updatedAt ?? Date.now(),
  };
}

export function upsertRating(ratings: Rating[], next: Rating): Rating[] {
  return [...ratings.filter((rating) => rating.movieId !== next.movieId), next];
}

export function deleteRating(ratings: Rating[], movieId: string): Rating[] {
  return ratings.filter((rating) => rating.movieId !== movieId);
}

export function sortRatings(ratings: Rating[], mode: SortMode): Rating[] {
  const copy = [...ratings];
  if (mode === 'highest') {
    copy.sort((a, b) => b.stars - a.stars || b.updatedAt - a.updatedAt || a.title.localeCompare(b.title));
  } else {
    copy.sort((a, b) => b.updatedAt - a.updatedAt || a.title.localeCompare(b.title));
  }
  return copy;
}

export function findRatingForMovie(
  ratings: Rating[],
  movie: { id: string; title: string; year: string },
): Rating | undefined {
  const byId = ratings.find((rating) => rating.movieId === movie.id);
  if (byId) return byId;

  const title = normalizeTitle(movie.title);
  return ratings.find(
    (rating) => normalizeTitle(rating.title) === title && rating.year === movie.year,
  );
}

export function movieFromRating(rating: Rating): Movie {
  return {
    id: rating.movieId,
    title: rating.title,
    year: rating.year,
    overview: rating.overview,
    posterUrl: rating.posterUrl,
  };
}

export function summarizeRatings(ratings: Rating[]): { count: number; average: number | null } {
  if (ratings.length === 0) return { count: 0, average: null };
  const sum = ratings.reduce((total, rating) => total + rating.stars, 0);
  const average = Math.round((sum / ratings.length) * 10) / 10;
  return { count: ratings.length, average };
}

export function formatSummary(ratings: Rating[]): string {
  const { count, average } = summarizeRatings(ratings);
  if (count === 0 || average === null) return 'Nothing logged yet';
  const films = count === 1 ? '1 film' : `${count} films`;
  return `${films} · ${formatStars(average)} average`;
}

export function formatRatedOn(updatedAt: number, now = Date.now()): string {
  if (!Number.isFinite(updatedAt)) return '';
  const days = calendarDaysBetween(updatedAt, now);
  if (days <= 0) return 'Today';
  if (days === 1) return 'Yesterday';
  return new Intl.DateTimeFormat('en-US', {
    month: 'short',
    day: 'numeric',
    year: 'numeric',
  }).format(updatedAt);
}

function calendarDaysBetween(from: number, to: number): number {
  const start = new Date(from);
  const end = new Date(to);
  const fromUtc = Date.UTC(start.getFullYear(), start.getMonth(), start.getDate());
  const toUtc = Date.UTC(end.getFullYear(), end.getMonth(), end.getDate());
  return Math.round((toUtc - fromUtc) / 86_400_000);
}

function parseRating(value: unknown): Rating | null {
  if (!value || typeof value !== 'object') return null;
  const record = value as Partial<Rating>;

  if (typeof record.movieId !== 'string' || !record.movieId.trim()) return null;
  if (typeof record.title !== 'string' || !record.title.trim()) return null;
  if (typeof record.stars !== 'number' || !isValidStars(record.stars)) return null;
  if (typeof record.updatedAt !== 'number' || !Number.isFinite(record.updatedAt)) return null;

  return {
    movieId: record.movieId,
    title: record.title.trim(),
    year: typeof record.year === 'string' && record.year.trim() ? record.year : '—',
    overview: typeof record.overview === 'string' ? record.overview : '',
    posterUrl: typeof record.posterUrl === 'string' && record.posterUrl.trim() ? record.posterUrl : null,
    stars: record.stars,
    note: typeof record.note === 'string' ? normalizeNote(record.note) : '',
    updatedAt: record.updatedAt,
  };
}

function dedupeRatings(ratings: Rating[]): Rating[] {
  const byId = new Map<string, Rating>();
  for (const rating of ratings) {
    const previous = byId.get(rating.movieId);
    if (!previous || rating.updatedAt >= previous.updatedAt) {
      byId.set(rating.movieId, rating);
    }
  }
  return [...byId.values()];
}

export function parseStoredRatings(raw: string | null): Rating[] {
  if (!raw) return [];

  try {
    const parsed: unknown = JSON.parse(raw);
    if (!Array.isArray(parsed)) return [];
    return dedupeRatings(parsed.map(parseRating).filter((rating): rating is Rating => rating !== null));
  } catch {
    return [];
  }
}

export function createRatingsRepository(store: KeyValueStore, key = RATINGS_STORAGE_KEY) {
  async function load(): Promise<Rating[]> {
    const raw = await store.getItem(key);
    return parseStoredRatings(raw);
  }

  async function save(ratings: Rating[]): Promise<void> {
    await store.setItem(key, JSON.stringify(ratings));
  }

  return {
    load,
    save,
    async upsert(next: Rating): Promise<Rating[]> {
      const updated = upsertRating(await load(), next);
      await save(updated);
      return updated;
    },
    async remove(movieId: string): Promise<Rating[]> {
      const updated = deleteRating(await load(), movieId);
      await save(updated);
      return updated;
    },
  };
}
