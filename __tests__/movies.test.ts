/// <reference types="jest" />
import { SAMPLE_MOVIES } from '../lib/sample-movies';
import { searchShelf } from '../lib/search';
import { previewShelf, searchMovies } from '../lib/movies';
import {
  largerPoster,
  mapTmdbMovie,
  readTmdbApiKey,
  searchTmdb,
  tmdbRequest,
  TMDB_FALLBACK_NOTICE,
} from '../lib/tmdb';

const shelf = SAMPLE_MOVIES;

describe('shelf search', () => {
  it('ships a usable offline catalog', () => {
    const ids = shelf.map((movie) => movie.id);
    expect(new Set(ids).size).toBe(ids.length);
    expect(shelf.length).toBeGreaterThanOrEqual(24);
    for (const movie of shelf) {
      expect(movie.title.trim().length).toBeGreaterThan(0);
      expect(movie.year).toMatch(/^\d{4}$/);
      expect(movie.overview.length).toBeGreaterThan(20);
      expect(movie.posterUrl).toMatch(/^https:\/\/image\.tmdb\.org\/t\/p\/w342\//);
    }
  });

  it('returns the shelf in editorial order when the query is empty', () => {
    expect(searchShelf('   ', shelf).map((movie) => movie.id)).toEqual(shelf.map((movie) => movie.id));
  });

  it('matches titles without accents, punctuation, or full words', () => {
    expect(searchShelf('inception', shelf).map((movie) => movie.title)).toEqual(['Inception']);
    expect(searchShelf('amelie', shelf)[0]?.title).toBe('Amélie');
    expect(searchShelf('schindler', shelf)[0]?.title).toBe("Schindler's List");
    expect(searchShelf('whip', shelf)[0]?.title).toBe('Whiplash');
    expect(searchShelf('spirited away', shelf)[0]?.title).toBe('Spirited Away');
  });

  it('can match a year and ignores words that only appear in the overview', () => {
    const from1994 = searchShelf('1994', shelf).map((movie) => movie.title);
    expect(from1994).toEqual(['Forrest Gump', 'Pulp Fiction', 'The Shawshank Redemption']);
    expect(searchShelf('briefcase', shelf)).toEqual([]);
    expect(searchShelf('zzzz', shelf)).toEqual([]);
  });

  it('does not mutate the catalog', () => {
    const before = shelf.map((movie) => movie.id).join('|');
    searchShelf('the', shelf);
    expect(shelf.map((movie) => movie.id).join('|')).toBe(before);
  });
});

describe('TMDB search', () => {
  it('reads a trimmed key and treats blanks as missing', () => {
    expect(readTmdbApiKey({ EXPO_PUBLIC_TMDB_API_KEY: '  abc  ' })).toBe('abc');
    expect(readTmdbApiKey({ EXPO_PUBLIC_TMDB_API_KEY: '   ' })).toBeNull();
    expect(readTmdbApiKey({})).toBeNull();
  });

  it('sends a v3 key as api_key and a v4 token as a bearer header', () => {
    const v3 = tmdbRequest('abcd1234', 'Spirited Away');
    expect(v3.url).toContain('query=Spirited+Away');
    expect(v3.url).toContain('include_adult=false');
    expect(v3.url).toContain('api_key=abcd1234');
    expect(v3.headers.Authorization).toBeUndefined();

    const v4 = tmdbRequest('eyJhbGciOiJIUzI1NiJ9.token', 'Dune');
    expect(v4.url).not.toContain('api_key');
    expect(v4.headers.Authorization).toBe('Bearer eyJhbGciOiJIUzI1NiJ9.token');
  });

  it('maps a TMDB result into the app movie shape', () => {
    expect(
      mapTmdbMovie({
        id: 7,
        title: '  Nope ',
        release_date: '2022-07-22',
        overview: '  Clouds. ',
        poster_path: '/nope.jpg',
      }),
    ).toEqual({
      id: 'tmdb-7',
      title: 'Nope',
      year: '2022',
      overview: 'Clouds.',
      posterUrl: 'https://image.tmdb.org/t/p/w342/nope.jpg',
    });

    expect(mapTmdbMovie({ id: 8, title: 'Untitled', overview: '   ', poster_path: null })).toMatchObject({
      year: '—',
      overview: 'No overview yet.',
      posterUrl: null,
    });
    expect(mapTmdbMovie({ title: 'Missing id' })).toBeNull();
  });

  it('upgrades a list poster to the detail size', () => {
    expect(largerPoster('https://image.tmdb.org/t/p/w342/nope.jpg')).toBe(
      'https://image.tmdb.org/t/p/w500/nope.jpg',
    );
    expect(largerPoster(null)).toBeNull();
  });

  it('uses the network when a key is present', async () => {
    const fetchImpl = jest.fn(async () => ({
      ok: true,
      json: async () => ({
        results: [{ id: 27205, title: 'Inception', release_date: '2010-07-16', overview: 'Dreams.', poster_path: '/inception.jpg' }],
      }),
    })) as unknown as typeof fetch;

    const result = await searchMovies('Inception', { key: 'abcd', fetchImpl, shelf });
    expect(result.source).toBe('tmdb');
    expect(result.movies[0]).toMatchObject({ id: 'tmdb-27205', title: 'Inception' });
    expect(result.notice).toBeNull();
  });

  it('falls back to the shelf when TMDB fails', async () => {
    const fetchImpl = jest.fn(async () => {
      throw new Error('offline');
    }) as unknown as typeof fetch;

    const result = await searchMovies('Inception', { key: 'abcd', fetchImpl, shelf });
    expect(result.source).toBe('shelf');
    expect(result.notice).toBe(TMDB_FALLBACK_NOTICE);
    expect(result.movies[0]?.title).toBe('Inception');
  });

  it('stays on the shelf when there is no key', async () => {
    const result = await searchMovies('coco', { key: null, shelf });
    expect(result).toEqual(previewShelf('coco', shelf));
    expect(result.movies[0]?.title).toBe('Coco');
  });

  it('rejects a non-ok TMDB response inside the client', async () => {
    const fetchImpl = jest.fn(async () => ({
      ok: false,
      status: 401,
      json: async () => ({}),
    })) as unknown as typeof fetch;

    await expect(searchTmdb('Dune', 'bad-key', fetchImpl)).rejects.toThrow(/401/);
  });
});
