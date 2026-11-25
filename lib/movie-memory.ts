import type { Movie } from '@/lib/types';

const cache = new Map<string, Movie>();

export function rememberMovie(movie: Movie): void {
  cache.set(movie.id, movie);
}

export function rememberMovies(movies: Movie[]): void {
  for (const movie of movies) rememberMovie(movie);
}

export function recallMovie(id: string): Movie | undefined {
  return cache.get(id);
}
