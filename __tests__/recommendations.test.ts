/// <reference types="jest" />
import { SAMPLE_MOVIES } from '../lib/sample-movies';
import { SHELF_GENRES } from '../lib/shelf-genres';
import {
  CIRCLE_PICKS_NO_GROUP,
  FOR_YOU_EMPTY,
  FOR_YOU_NEED_HIGHER,
  FOR_YOU_NONE_LEFT,
  circlePicks,
  circlePicksMessage,
  forYouEmptyMessage,
  loadPersonalRecommendations,
  rankShelf,
  rankSuggestions,
  recommendationSeeds,
} from '../lib/recommendations';
import type { GroupRating } from '../lib/groups';
import type { Movie } from '../lib/types';

function movie(id: string, title: string, vote = 0): Movie & { voteAverage: number } {
  return {
    id,
    title,
    year: '2020',
    overview: `${title} overview long enough to read.`,
    posterUrl: null,
    voteAverage: vote,
  };
}

function groupRating(partial: Partial<GroupRating> & Pick<GroupRating, 'memberId' | 'movieId' | 'title' | 'stars'>): GroupRating {
  return {
    year: '2020',
    overview: 'A shared note about the film.',
    posterUrl: null,
    note: '',
    updatedAt: 1,
    ...partial,
  };
}

describe('recommendation seeds', () => {
  it('keeps 4-star ratings, newest first, and caps the list', () => {
    const seeds = recommendationSeeds([
      { movieId: 'a', title: 'A', year: '2001', stars: 3.5, updatedAt: 50 },
      { movieId: 'b', title: 'B', year: '2002', stars: 4, updatedAt: 10 },
      { movieId: 'c', title: 'C', year: '2003', stars: 5, updatedAt: 30 },
      { movieId: 'd', title: 'D', year: '2004', stars: 4.5, updatedAt: 40 },
      { movieId: 'e', title: 'E', year: '2005', stars: 4, updatedAt: 20 },
      { movieId: 'f', title: 'F', year: '2006', stars: 4, updatedAt: 15 },
      { movieId: 'g', title: 'G', year: '2007', stars: 4, updatedAt: 5 },
    ]);
    expect(seeds.map((seed) => seed.movieId)).toEqual(['d', 'c', 'e', 'f', 'b']);
  });
});

describe('ranking', () => {
  it('merges seeds, drops movies the user already rated, and ranks by seed count then vote average', () => {
    const ranked = rankSuggestions(
      [
        { movie: movie('tmdb-1', 'Alpha'), voteAverage: 7, seedKey: 'seed-a' },
        { movie: movie('tmdb-1', 'Alpha'), voteAverage: 8.4, seedKey: 'seed-a' },
        { movie: movie('tmdb-1', 'Alpha'), voteAverage: 6, seedKey: 'seed-b' },
        { movie: movie('tmdb-2', 'Bravo'), voteAverage: 9.9, seedKey: 'seed-a' },
        { movie: movie('tmdb-3', 'Charlie'), voteAverage: 8, seedKey: 'seed-a' },
        { movie: movie('tmdb-3', 'Charlie'), voteAverage: 8.2, seedKey: 'seed-b' },
        { movie: movie('shelf-inception', 'Inception', 10), voteAverage: 10, seedKey: 'seed-a' },
      ],
      [{ movieId: 'other', title: 'Inception', year: '2020' }],
    );
    expect(ranked.map((pick) => [pick.movie.id, pick.seedCount, pick.score])).toEqual([
      ['tmdb-1', 2, 8.4],
      ['tmdb-3', 2, 8.2],
      ['tmdb-2', 1, 9.9],
    ]);
  });

  it('ranks shelf films by how many favorites share a genre', () => {
    const picks = rankShelf(
      [
        { movieId: 'shelf-inception', title: 'Inception', year: '2010', stars: 5, updatedAt: 2 },
        { movieId: 'shelf-the-matrix', title: 'The Matrix', year: '1999', stars: 4, updatedAt: 1 },
      ],
      [
        { movieId: 'shelf-inception', title: 'Inception', year: '2010' },
        { movieId: 'shelf-the-matrix', title: 'The Matrix', year: '1999' },
      ],
    );
    const dune = picks.find((pick) => pick.movie.id === 'shelf-dune');
    const amelie = picks.find((pick) => pick.movie.id === 'shelf-amelie');
    const matrix = picks.find((pick) => pick.movie.id === 'shelf-the-matrix');
    expect(dune?.seedCount).toBe(2);
    expect(amelie).toBeUndefined();
    expect(matrix).toBeUndefined();
    expect(picks[0]?.seedCount).toBeGreaterThanOrEqual(picks[1]?.seedCount ?? 0);
  });

  it('uses the shelf when there is no TMDB key', async () => {
    const result = await loadPersonalRecommendations({
      ratings: [{ movieId: 'shelf-inception', title: 'Inception', year: '2010', stars: 5, updatedAt: 1 }],
      key: null,
      fetchImpl: () => {
        throw new Error('should not fetch');
      },
    });
    expect(result.source).toBe('shelf');
    expect(result.notice).toBeNull();
    expect(result.picks.some((pick) => pick.movie.id === 'shelf-the-matrix')).toBe(true);
    expect(result.picks.some((pick) => pick.movie.id === 'shelf-inception')).toBe(false);
  });

  it('falls back from an empty recommendations list to similar, then ranks', async () => {
    const fetchImpl = jest.fn(async (url: string) => {
      const similar = String(url).includes('/similar');
      const results = similar
        ? [{ id: 42, title: 'Arrival', release_date: '2016-11-11', overview: 'A linguist meets visitors.', vote_average: 7.6 }]
        : [];
      return { ok: true, status: 200, json: async () => ({ results }) };
    });
    const result = await loadPersonalRecommendations({
      ratings: [{ movieId: 'tmdb-27205', title: 'Inception', year: '2010', stars: 5, updatedAt: 1 }],
      key: 'test-key',
      fetchImpl: fetchImpl as unknown as typeof fetch,
    });
    expect(fetchImpl.mock.calls.some((call) => String(call[0]).includes('/recommendations'))).toBe(true);
    expect(fetchImpl.mock.calls.some((call) => String(call[0]).includes('/similar'))).toBe(true);
    expect(result.source).toBe('tmdb');
    expect(result.picks.map((pick) => pick.movie.title)).toEqual(['Arrival']);
    expect(result.picks[0]?.seedCount).toBe(1);
  });

  it('uses the shelf when TMDB does not respond', async () => {
    const result = await loadPersonalRecommendations({
      ratings: [{ movieId: 'shelf-inception', title: 'Inception', year: '2010', stars: 5, updatedAt: 1 }],
      key: 'test-key',
      fetchImpl: async () => {
        throw new Error('offline');
      },
    });
    expect(result.source).toBe('shelf');
    expect(result.notice).toMatch(/did not respond/);
    expect(result.picks.length).toBeGreaterThan(0);
  });
});

describe('empty states', () => {
  it('tells a new user to rate a few movies first', () => {
    expect(forYouEmptyMessage({ ratingCount: 0, seedCount: 0, resultCount: 0 })).toBe(FOR_YOU_EMPTY);
    expect(forYouEmptyMessage({ ratingCount: 2, seedCount: 0, resultCount: 0 })).toBe(FOR_YOU_NEED_HIGHER);
    expect(forYouEmptyMessage({ ratingCount: 2, seedCount: 1, resultCount: 0 })).toBe(FOR_YOU_NONE_LEFT);
    expect(forYouEmptyMessage({ ratingCount: 2, seedCount: 1, resultCount: 4 })).toBeNull();
  });

  it('hides circle picks behind a note until there is a group', () => {
    expect(circlePicksMessage({ inGroup: false, code: null, pickCount: 0 })).toBe(CIRCLE_PICKS_NO_GROUP);
    expect(circlePicksMessage({ inGroup: true, code: 'APLREV', pickCount: 0 })).toMatch(/APLREV/);
    expect(circlePicksMessage({ inGroup: true, code: 'APLREV', pickCount: 2 })).toBeNull();
  });
});

describe('circle picks', () => {
  const rated = [{ movieId: 'mine', title: 'Inception', year: '2010' }];

  it('averages other members and ignores the user, blocked members, and filtered notes', () => {
    const picks = circlePicks({
      selfMemberId: 'me',
      blockedMemberIds: ['blocked'],
      alreadyRated: rated,
      ratings: [
        groupRating({ memberId: 'me', movieId: 'shelf-dune', title: 'Dune', stars: 5 }),
        groupRating({ memberId: 'alex', movieId: 'shelf-inception', title: 'Inception', year: '2010', stars: 5 }),
        groupRating({ memberId: 'sam', movieId: 'shelf-parasite', title: 'Parasite', year: '2019', stars: 5 }),
        groupRating({ memberId: 'jordan', movieId: 'shelf-parasite', title: 'Parasite', year: '2019', stars: 4 }),
        groupRating({ memberId: 'blocked', movieId: 'shelf-parasite', title: 'Parasite', year: '2019', stars: 1 }),
        groupRating({ memberId: 'alex', movieId: 'shelf-get-out', title: 'Get Out', year: '2017', stars: 5, note: 'This is shit' }),
        groupRating({ memberId: 'sam', movieId: 'shelf-coco', title: 'Coco', year: '2017', stars: 3 }),
      ],
    });
    expect(picks.map((pick) => pick.movie.title)).toEqual(['Parasite']);
    expect(picks[0]).toMatchObject({ average: 4.5, memberCount: 2 });
  });
});

describe('shelf genres', () => {
  it('covers every bundled film', () => {
    for (const movie of SAMPLE_MOVIES) {
      expect(SHELF_GENRES[movie.id]?.length).toBeGreaterThan(0);
    }
  });
});
