import type { Movie } from '@/lib/types';

function normalize(value: string): string {
  return value
    .toLowerCase()
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    .replace(/[^a-z0-9]+/g, ' ')
    .trim();
}

function words(value: string): string[] {
  const normalized = normalize(value);
  return normalized ? normalized.split(' ') : [];
}

function matchTokens(
  titleWords: string[],
  year: string,
  tokens: string[],
): { prefix: number } | null {
  let prefix = 0;

  for (const token of tokens) {
    if (token === year) continue;
    if (titleWords.some((word) => word === token)) continue;
    if (token.length >= 2 && titleWords.some((word) => word.startsWith(token))) {
      prefix += 1;
      continue;
    }
    return null;
  }

  return { prefix };
}

export function searchShelf(query: string, movies: Movie[]): Movie[] {
  const normalizedQuery = normalize(query);
  if (!normalizedQuery) return [...movies];

  const tokens = normalizedQuery.split(' ');

  return movies
    .map((movie) => {
      const titleWords = words(movie.title);
      const titleNorm = titleWords.join(' ');
      const matched = matchTokens(titleWords, movie.year, tokens);
      if (!matched) return { movie, score: 0 };

      let score = 60;
      if (titleNorm === normalizedQuery) score = 100;
      else if (titleNorm.startsWith(normalizedQuery)) score = 90;
      else if (matched.prefix === 0) score = 80;
      else score = 70;

      return { movie, score };
    })
    .filter((row) => row.score > 0)
    .sort((a, b) => b.score - a.score || a.movie.title.localeCompare(b.movie.title))
    .map((row) => row.movie);
}
