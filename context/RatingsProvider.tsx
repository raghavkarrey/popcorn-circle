import { createContext, useCallback, useContext, useEffect, useMemo, useState, type ReactNode } from 'react';

import { ratingsRepository } from '@/lib/ratings-store';
import { buildRating, findRatingForMovie } from '@/lib/ratings';
import type { Movie, Rating } from '@/lib/types';

type RateInput = {
  movie: Movie;
  stars: number;
  note: string;
};

type RatingsContextValue = {
  ratings: Rating[];
  ready: boolean;
  error: string | null;
  rate: (input: RateInput) => Promise<Rating>;
  remove: (movieId: string) => Promise<void>;
  refresh: () => Promise<void>;
};

const RatingsContext = createContext<RatingsContextValue | null>(null);

export function RatingsProvider({ children }: { children: ReactNode }) {
  const [ratings, setRatings] = useState<Rating[]>([]);
  const [ready, setReady] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const refresh = useCallback(async () => {
    try {
      const loaded = await ratingsRepository.load();
      setRatings(loaded);
      setError(null);
    } catch {
      setError('Could not read the ratings saved on this device.');
    } finally {
      setReady(true);
    }
  }, []);

  useEffect(() => {
    void refresh();
  }, [refresh]);

  const rate = useCallback(async (input: RateInput) => {
    const existing = findRatingForMovie(ratings, input.movie);
    const next = buildRating({
      movie: { ...input.movie, id: existing?.movieId ?? input.movie.id },
      stars: input.stars,
      note: input.note,
    });
    const updated = await ratingsRepository.upsert(next);
    setRatings(updated);
    return next;
  }, [ratings]);

  const remove = useCallback(async (movieId: string) => {
    const updated = await ratingsRepository.remove(movieId);
    setRatings(updated);
  }, []);

  const value = useMemo(
    () => ({ ratings, ready, error, rate, remove, refresh }),
    [ratings, ready, error, rate, remove, refresh],
  );

  return <RatingsContext.Provider value={value}>{children}</RatingsContext.Provider>;
}

export function useRatings(): RatingsContextValue {
  const value = useContext(RatingsContext);
  if (!value) {
    throw new Error('useRatings must be used within RatingsProvider');
  }
  return value;
}
