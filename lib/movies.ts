import { recallMovie } from '@/lib/movie-memory';
import { movieFromRating } from '@/lib/ratings';
import { findShelfMovie, SAMPLE_MOVIES } from '@/lib/sample-movies';
import { searchShelf } from '@/lib/search';
import { readTmdbApiKey, searchTmdb, TMDB_FALLBACK_NOTICE } from '@/lib/tmdb';
import type { Movie, Rating, SearchResult } from '@/lib/types';

type SearchOptions = {
  key?: string | null;
  fetchImpl?: typeof fetch;
  shelf?: Movie[];
};

export function previewShelf(query: string, shelf: Movie[] = SAMPLE_MOVIES): SearchResult {
  return {
    movies: searchShelf(query, shelf),
    source: 'shelf',
    notice: null,
  };
}

export async function searchMovies(query: string, options: SearchOptions = {}): Promise<SearchResult> {
  const shelf = options.shelf ?? SAMPLE_MOVIES;
  const trimmed = query.trim();
  const key = options.key === undefined ? readTmdbApiKey() : options.key;

  if (!trimmed || !key) {
    return previewShelf(query, shelf);
  }

  try {
    const movies = await searchTmdb(trimmed, key, options.fetchImpl);
    return { movies, source: 'tmdb', notice: null };
  } catch {
    return {
      movies: searchShelf(trimmed, shelf),
      source: 'shelf',
      notice: TMDB_FALLBACK_NOTICE,
    };
  }
}

export function resolveMovie(id: string, ratings: Rating[]): Movie | null {
  if (!id) return null;
  const remembered = recallMovie(id);
  if (remembered) return remembered;
  const shelf = findShelfMovie(id);
  if (shelf) return shelf;
  const rating = ratings.find((item) => item.movieId === id);
  return rating ? movieFromRating(rating) : null;
}
