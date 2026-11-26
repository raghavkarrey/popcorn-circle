import { containsObjectionableLanguage, type GroupRating } from '@/lib/groups';
import { normalizeTitle } from '@/lib/ratings';
import { SAMPLE_MOVIES } from '@/lib/sample-movies';
import { SHELF_GENRES } from '@/lib/shelf-genres';
import { fetchTmdbRelated, searchTmdb, tmdbNumericId, type TmdbSuggestion } from '@/lib/tmdb';
import type { Movie, Rating } from '@/lib/types';

export const RECOMMENDATION_MIN_STARS = 4;
export const RECOMMENDATION_SEED_LIMIT = 5;
export const CIRCLE_PICK_MIN_AVERAGE = 4;

export const FOR_YOU_EMPTY =
  'Rate a few movies first. Suggestions start once you give something 4 stars or more.';
export const FOR_YOU_NEED_HIGHER =
  'Rate a movie 4 stars or higher and this list will fill in.';
export const FOR_YOU_NONE_LEFT = 'Nothing new to suggest from those favorites yet.';
export const CIRCLE_PICKS_NO_GROUP = 'Join a group to see movies your circle rated highly.';
export const SHELF_FALLBACK_NOTICE =
  'The movie database did not respond. Showing shelf films that share genres with your favorites.';

export type RecommendationSeed = {
  movieId: string;
  title: string;
  year: string;
  stars: number;
  updatedAt: number;
};

export type PersonalPick = {
  movie: Movie;
  seedCount: number;
  score: number;
};

export type PersonalSource = 'tmdb' | 'shelf' | 'none';

export type PersonalRecommendations = {
  picks: PersonalPick[];
  source: PersonalSource;
  notice: string | null;
};

export type CirclePick = {
  movie: Movie;
  average: number;
  memberCount: number;
};

type RatedRef = { movieId: string; title: string; year: string };

type ShelfFilm = { movie: Movie; genres: readonly string[] };

function titleKey(movie: { title: string; year: string }): string {
  return `${normalizeTitle(movie.title)}|${movie.year}`;
}

function movieIdentity(movie: { id?: string; movieId?: string }): string {
  return movie.movieId ?? movie.id ?? '';
}

function isRated(movie: { id?: string; movieId?: string; title: string; year: string }, rated: RatedRef[]): boolean {
  const id = movieIdentity(movie);
  const key = titleKey(movie);
  return rated.some((item) => (id !== '' && item.movieId === id) || titleKey(item) === key);
}

export function recommendationSeeds(
  ratings: RecommendationSeed[],
  limit = RECOMMENDATION_SEED_LIMIT,
): RecommendationSeed[] {
  return ratings
    .filter((rating) => rating.stars >= RECOMMENDATION_MIN_STARS)
    .sort((a, b) => b.updatedAt - a.updatedAt || a.title.localeCompare(b.title))
    .slice(0, limit);
}

export function forYouEmptyMessage(input: { ratingCount: number; seedCount: number; resultCount: number }): string | null {
  if (input.ratingCount === 0) return FOR_YOU_EMPTY;
  if (input.seedCount === 0) return FOR_YOU_NEED_HIGHER;
  if (input.resultCount === 0) return FOR_YOU_NONE_LEFT;
  return null;
}

export function circlePicksMessage(input: { inGroup: boolean; code: string | null; pickCount: number }): string | null {
  if (!input.inGroup) return CIRCLE_PICKS_NO_GROUP;
  if (input.pickCount === 0) {
    const code = input.code ?? 'your group';
    return `Nothing in ${code} averages 4 stars that you haven't rated.`;
  }
  return null;
}

export function formatAverage(value: number): string {
  if (!Number.isFinite(value)) return '';
  const rounded = Math.round(value * 10) / 10;
  return Number.isInteger(rounded) ? String(rounded) : rounded.toFixed(1);
}

export function suggestionReason(seedCount: number): string {
  if (seedCount === 1) return 'Suggested by 1 of your favorites';
  return `Suggested by ${seedCount} of your favorites`;
}

export function circlePickDetail(pick: CirclePick): string {
  const people = pick.memberCount === 1 ? '1 member' : `${pick.memberCount} members`;
  return `${formatAverage(pick.average)} average · ${people}`;
}

type IncomingSuggestion = {
  movie: Movie;
  voteAverage: number;
  seedKey: string;
};

export function rankSuggestions(items: IncomingSuggestion[], rated: RatedRef[]): PersonalPick[] {
  const merged = new Map<string, { movie: Movie; voteAverage: number; seeds: Set<string> }>();
  for (const item of items) {
    if (isRated(item.movie, rated)) continue;
    const existing = merged.get(item.movie.id);
    if (!existing) {
      merged.set(item.movie.id, {
        movie: item.movie,
        voteAverage: item.voteAverage,
        seeds: new Set([item.seedKey]),
      });
      continue;
    }
    existing.seeds.add(item.seedKey);
    if (item.voteAverage > existing.voteAverage) existing.voteAverage = item.voteAverage;
  }

  return [...merged.values()]
    .map((item) => ({
      movie: item.movie,
      seedCount: item.seeds.size,
      score: item.voteAverage,
    }))
    .sort((a, b) => b.seedCount - a.seedCount || b.score - a.score || a.movie.title.localeCompare(b.movie.title));
}

export function shelfFilms(shelf: Movie[] = SAMPLE_MOVIES): ShelfFilm[] {
  return shelf.map((movie) => ({ movie, genres: SHELF_GENRES[movie.id] ?? [] }));
}

export function rankShelf(seeds: RecommendationSeed[], rated: RatedRef[], shelf: Movie[] = SAMPLE_MOVIES): PersonalPick[] {
  const films = shelfFilms(shelf);
  const seedFilms = seeds
    .map((seed) => films.find((film) => film.movie.id === seed.movieId || titleKey(film.movie) === titleKey(seed)))
    .filter((film): film is ShelfFilm => Boolean(film));
  if (seedFilms.length === 0) return [];

  const seedRefs = seedFilms.map((item) => ({ movieId: item.movie.id, title: item.movie.title, year: item.movie.year }));
  const picks: PersonalPick[] = [];
  for (const film of films) {
    if (isRated(film.movie, rated) || isRated(film.movie, seedRefs)) continue;
    let seedCount = 0;
    let shared = 0;
    for (const seed of seedFilms) {
      const overlap = film.genres.filter((genre) => seed.genres.includes(genre)).length;
      if (overlap > 0) {
        seedCount += 1;
        shared += overlap;
      }
    }
    if (seedCount === 0) continue;
    picks.push({ movie: film.movie, seedCount, score: shared });
  }

  return picks.sort((a, b) => b.seedCount - a.seedCount || b.score - a.score || a.movie.title.localeCompare(b.movie.title));
}

async function resolveTmdbId(
  seed: RecommendationSeed,
  key: string,
  fetchImpl: typeof fetch,
  inputProxy = false,
): Promise<number | null> {
  const direct = tmdbNumericId(seed.movieId);
  if (direct) return direct;
  const matches = await searchTmdb(seed.title, key, fetchImpl, { proxy: inputProxy });
  const exact = matches.find((movie) => normalizeTitle(movie.title) === normalizeTitle(seed.title) && movie.year === seed.year);
  const titled = matches.find((movie) => normalizeTitle(movie.title) === normalizeTitle(seed.title));
  return tmdbNumericId((exact ?? titled)?.id ?? '');
}

export async function loadPersonalRecommendations(input: {
  ratings: RecommendationSeed[];
  key: string | null;
  proxy?: boolean;
  fetchImpl?: typeof fetch;
  shelf?: Movie[];
}): Promise<PersonalRecommendations> {
  const fetchImpl = input.fetchImpl ?? fetch;
  const shelf = input.shelf ?? SAMPLE_MOVIES;
  const proxy = input.proxy === true;
  const seeds = recommendationSeeds(input.ratings);
  const shelfPicks = () => rankShelf(seeds, input.ratings, shelf).slice(0, 20);
  if (seeds.length === 0) return { picks: [], source: 'none', notice: null };
  if (!input.key && !proxy) return { picks: shelfPicks(), source: 'shelf', notice: null };

  const incoming: IncomingSuggestion[] = [];
  let reached = false;
  for (const seed of seeds) {
    try {
      const tmdbId = await resolveTmdbId(seed, input.key ?? '', fetchImpl, proxy);
      if (!tmdbId) continue;
      const related: TmdbSuggestion[] = await fetchTmdbRelated(tmdbId, input.key ?? '', fetchImpl, { proxy });
      reached = true;
      for (const movie of related) {
        incoming.push({ movie, voteAverage: movie.voteAverage, seedKey: seed.movieId });
      }
    } catch {
      // One seed failing still leaves the others usable.
    }
  }

  if (!reached) {
    return { picks: shelfPicks(), source: 'shelf', notice: SHELF_FALLBACK_NOTICE };
  }

  return {
    picks: rankSuggestions(incoming, input.ratings).slice(0, 20),
    source: 'tmdb',
    notice: null,
  };
}

export function circlePicks(input: {
  ratings: GroupRating[];
  selfMemberId: string | null;
  blockedMemberIds: string[];
  alreadyRated: RatedRef[];
}): CirclePick[] {
  const blocked = new Set(input.blockedMemberIds);
  const buckets = new Map<string, { movie: Movie; stars: number[]; members: Set<string> }>();

  for (const rating of input.ratings) {
    if (input.selfMemberId && rating.memberId === input.selfMemberId) continue;
    if (blocked.has(rating.memberId)) continue;
    if (
      containsObjectionableLanguage(rating.title) ||
      containsObjectionableLanguage(rating.overview) ||
      containsObjectionableLanguage(rating.note)
    ) {
      continue;
    }
    if (isRated(rating, input.alreadyRated)) continue;

    const key = titleKey(rating) || rating.movieId;
    const movie: Movie = {
      id: rating.movieId,
      title: rating.title,
      year: rating.year,
      overview: rating.overview,
      posterUrl: rating.posterUrl,
    };
    const bucket = buckets.get(key);
    if (!bucket) {
      buckets.set(key, { movie, stars: [rating.stars], members: new Set([rating.memberId]) });
      continue;
    }
    bucket.stars.push(rating.stars);
    bucket.members.add(rating.memberId);
    if (!bucket.movie.posterUrl && movie.posterUrl) bucket.movie = { ...movie };
  }

  return [...buckets.values()]
    .map((bucket) => ({
      movie: bucket.movie,
      average: bucket.stars.reduce((sum, stars) => sum + stars, 0) / bucket.stars.length,
      memberCount: bucket.members.size,
    }))
    .filter((pick) => pick.average >= CIRCLE_PICK_MIN_AVERAGE)
    .sort((a, b) => b.average - a.average || b.memberCount - a.memberCount || a.movie.title.localeCompare(b.movie.title));
}
