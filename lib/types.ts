export type Movie = {
  id: string;
  title: string;
  year: string;
  overview: string;
  posterUrl: string | null;
};

export type MovieSource = 'tmdb' | 'shelf';

export type SearchResult = {
  movies: Movie[];
  source: MovieSource;
  notice: string | null;
};

export type SortMode = 'recent' | 'highest';

export type Rating = {
  movieId: string;
  title: string;
  year: string;
  overview: string;
  posterUrl: string | null;
  stars: number;
  note: string;
  updatedAt: number;
};
