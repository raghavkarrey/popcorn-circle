/// <reference types="jest" />
import {
  RATINGS_STORAGE_KEY,
  RatingValidationError,
  buildRating,
  createRatingsRepository,
  deleteRating,
  findRatingForMovie,
  formatRatedOn,
  formatStars,
  formatSummary,
  isValidStars,
  normalizeNote,
  parseStoredRatings,
  sortRatings,
  upsertRating,
  type KeyValueStore,
} from '../lib/ratings';
import type { Movie, Rating } from '../lib/types';

const inception: Movie = {
  id: 'shelf-inception',
  title: 'Inception',
  year: '2010',
  overview: 'A thief plants an idea.',
  posterUrl: 'https://image.tmdb.org/t/p/w342/inception.jpg',
};

function rating(overrides: Partial<Rating> = {}): Rating {
  return {
    movieId: 'shelf-inception',
    title: 'Inception',
    year: '2010',
    overview: 'A thief plants an idea.',
    posterUrl: inception.posterUrl,
    stars: 4,
    note: 'Again.',
    updatedAt: 1_000,
    ...overrides,
  };
}

function memoryStore(): KeyValueStore & { raw(): string | null } {
  const data = new Map<string, string>();
  return {
    async getItem(key) {
      return data.has(key) ? (data.get(key) ?? null) : null;
    },
    async setItem(key, value) {
      data.set(key, value);
    },
    async removeItem(key) {
      data.delete(key);
    },
    raw() {
      return data.get(RATINGS_STORAGE_KEY) ?? null;
    },
  };
}

describe('star values', () => {
  it.each([0.5, 1, 1.5, 2, 2.5, 3, 3.5, 4, 4.5, 5])('accepts %s', (stars) => {
    expect(isValidStars(stars)).toBe(true);
  });

  it.each([0, 0.25, 1.2, 5.5, 6, -1, Number.NaN, Number.POSITIVE_INFINITY])('rejects %s', (stars) => {
    expect(isValidStars(stars)).toBe(false);
  });

  it('formats whole stars without a decimal', () => {
    expect(formatStars(5)).toBe('5');
    expect(formatStars(4.5)).toBe('4.5');
    expect(formatStars(0.5)).toBe('0.5');
  });
});

describe('notes', () => {
  it('trims and caps the note at 280 characters', () => {
    expect(normalizeNote('   hello   ')).toBe('hello');
    expect(normalizeNote(`  ${'a'.repeat(300)}  `)).toHaveLength(280);
    expect(normalizeNote('   ')).toBe('');
    expect(normalizeNote('kept  spacing')).toBe('kept  spacing');
  });
});

describe('buildRating', () => {
  it('snapshots the movie and trims the note', () => {
    const saved = buildRating({
      movie: inception,
      stars: 4.5,
      note: '  the hallway  ',
      updatedAt: 50,
    });

    expect(saved).toEqual({
      movieId: 'shelf-inception',
      title: 'Inception',
      year: '2010',
      overview: 'A thief plants an idea.',
      posterUrl: inception.posterUrl,
      stars: 4.5,
      note: 'the hallway',
      updatedAt: 50,
    });
  });

  it('rejects a missing title and an invalid score', () => {
    expect(() => buildRating({ movie: { ...inception, title: '  ' }, stars: 3 })).toThrow(RatingValidationError);
    expect(() => buildRating({ movie: inception, stars: 4.2 })).toThrow(/half a star/);
  });
});

describe('list edits', () => {
  it('replaces a rating without mutating the previous list', () => {
    const original = [rating({ stars: 2, note: 'first' })];
    const updated = upsertRating(original, rating({ stars: 5, note: 'second', updatedAt: 2 }));

    expect(original[0]?.stars).toBe(2);
    expect(updated).toHaveLength(1);
    expect(updated[0]).toMatchObject({ stars: 5, note: 'second' });
  });

  it('adds a second film', () => {
    const updated = upsertRating([rating()], rating({ movieId: 'shelf-coco', title: 'Coco' }));
    expect(updated.map((item) => item.movieId)).toEqual(['shelf-inception', 'shelf-coco']);
  });

  it('deletes only the requested film', () => {
    const original = [rating(), rating({ movieId: 'shelf-coco', title: 'Coco' })];
    const updated = deleteRating(original, 'shelf-inception');
    expect(original).toHaveLength(2);
    expect(updated.map((item) => item.movieId)).toEqual(['shelf-coco']);
    expect(deleteRating(updated, 'missing')).toEqual(updated);
  });
});

describe('sorting and lookup', () => {
  const rows = [
    rating({ movieId: 'a', title: 'Amélie', stars: 3, updatedAt: 10 }),
    rating({ movieId: 'b', title: 'Barbie', stars: 5, updatedAt: 20 }),
    rating({ movieId: 'c', title: 'Coco', stars: 5, updatedAt: 30 }),
  ];

  it('sorts by most recent, then title', () => {
    expect(sortRatings(rows, 'recent').map((item) => item.movieId)).toEqual(['c', 'b', 'a']);
    expect(rows.map((item) => item.movieId)).toEqual(['a', 'b', 'c']);
  });

  it('sorts by highest stars, using recency as the tie break', () => {
    expect(sortRatings(rows, 'highest').map((item) => item.movieId)).toEqual(['c', 'b', 'a']);
  });

  it('matches a saved film by title and year when the catalog id changes', () => {
    const named = findRatingForMovie(
      [rating({ movieId: 'old-id', title: 'Amélie', year: '2001' })],
      { id: 'tmdb-194', title: '  amelie  ', year: '2001' },
    );
    expect(named?.movieId).toBe('old-id');

    const differentYear = findRatingForMovie(
      [rating({ movieId: 'old-id', title: 'The Godfather', year: '1972' })],
      { id: 'tmdb-238', title: 'the godfather', year: '1974' },
    );
    expect(differentYear).toBeUndefined();
  });

  it('summarizes the log', () => {
    expect(formatSummary([])).toBe('Nothing logged yet');
    expect(formatSummary([rating({ stars: 5 })])).toBe('1 film · 5 average');
    expect(formatSummary([rating({ stars: 5 }), rating({ movieId: 'b', stars: 4 }), rating({ movieId: 'c', stars: 4 })])).toBe(
      '3 films · 4.3 average',
    );
  });
});

describe('dates', () => {
  const now = new Date(2026, 10, 25, 15, 0, 0).getTime();

  it('uses calendar days rather than elapsed hours', () => {
    expect(formatRatedOn(new Date(2026, 10, 25, 0, 20, 0).getTime(), now)).toBe('Today');
    expect(formatRatedOn(new Date(2026, 10, 24, 23, 50, 0).getTime(), new Date(2026, 10, 25, 0, 10, 0).getTime())).toBe(
      'Yesterday',
    );
    const older = new Date(2024, 0, 2, 12, 0, 0).getTime();
    expect(formatRatedOn(older, now)).toBe(
      new Intl.DateTimeFormat('en-US', { month: 'short', day: 'numeric', year: 'numeric' }).format(older),
    );
  });
});

describe('storage', () => {
  it('returns an empty log for missing, broken, or non-array data', () => {
    expect(parseStoredRatings(null)).toEqual([]);
    expect(parseStoredRatings('{')).toEqual([]);
    expect(parseStoredRatings('{"ok":true}')).toEqual([]);
  });

  it('drops invalid rows, trims notes, and keeps the newest duplicate', () => {
    const raw = JSON.stringify([
      rating({ note: '  keep me  ', updatedAt: 1 }),
      { movieId: 'broken' },
      { movieId: 'bad-stars', title: 'Nope', stars: 4.2, updatedAt: 5 },
      rating({ stars: 2, note: 'older', updatedAt: 1 }),
      rating({ stars: 5, note: 'newer', updatedAt: 9 }),
    ]);

    const parsed = parseStoredRatings(raw);
    expect(parsed).toHaveLength(1);
    expect(parsed[0]).toMatchObject({ stars: 5, note: 'newer', updatedAt: 9 });
  });

  it('saves, replaces, and removes through the repository', async () => {
    const store = memoryStore();
    const repo = createRatingsRepository(store);

    expect(await repo.load()).toEqual([]);

    const first = rating({ stars: 3, note: 'first', updatedAt: 10 });
    await repo.upsert(first);
    await repo.upsert(rating({ movieId: 'shelf-coco', title: 'Coco', stars: 5, updatedAt: 11 }));
    await repo.upsert(rating({ stars: 4.5, note: 'rewritten', updatedAt: 12 }));

    const loaded = await repo.load();
    expect(loaded).toHaveLength(2);
    expect(loaded.find((item) => item.movieId === 'shelf-inception')).toMatchObject({
      stars: 4.5,
      note: 'rewritten',
    });

    const remaining = await repo.remove('shelf-coco');
    expect(remaining.map((item) => item.movieId)).toEqual(['shelf-inception']);
    expect(JSON.parse(store.raw() ?? '[]')).toHaveLength(1);

    const untouched = await repo.remove('missing');
    expect(untouched).toHaveLength(1);
  });
});
