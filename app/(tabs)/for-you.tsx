import { router } from 'expo-router';
import { useEffect, useMemo, useState } from 'react';
import { ActivityIndicator, Pressable, ScrollView, StyleSheet, View } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';

import { AppText } from '@/components/AppText';
import { MovieCard } from '@/components/MovieCard';
import { colors } from '@/constants/theme';
import { useGroup } from '@/context/GroupProvider';
import { useRatings } from '@/context/RatingsProvider';
import { rememberMovie, rememberMovies } from '@/lib/movie-memory';
import {
  circlePickDetail,
  circlePicks,
  circlePicksMessage,
  forYouEmptyMessage,
  loadPersonalRecommendations,
  recommendationSeeds,
  suggestionReason,
  type PersonalRecommendations,
} from '@/lib/recommendations';
import { readTmdbApiKey, usesTmdbProxy } from '@/lib/tmdb';
import type { Movie } from '@/lib/types';

export default function ForYouScreen() {
  const { ratings, ready } = useRatings();
  const { group, membership, blockedMemberIds } = useGroup();
  const [personal, setPersonal] = useState<PersonalRecommendations>({ picks: [], source: 'none', notice: null });
  const [loading, setLoading] = useState(false);

  const seedKey = useMemo(
    () => recommendationSeeds(ratings).map((seed) => `${seed.movieId}:${seed.stars}:${seed.updatedAt}`).join('|'),
    [ratings],
  );

  useEffect(() => {
    if (!ready) return undefined;
    const seeds = recommendationSeeds(ratings);
    if (seeds.length === 0) {
      setPersonal({ picks: [], source: 'none', notice: null });
      setLoading(false);
      return undefined;
    }

    let cancelled = false;
    setLoading(true);
    void loadPersonalRecommendations({ ratings, key: readTmdbApiKey(), proxy: usesTmdbProxy() }).then((result) => {
      if (cancelled) return;
      setPersonal(result);
      setLoading(false);
    });
    return () => {
      cancelled = true;
    };
  }, [ready, ratings, seedKey]);

  useEffect(() => {
    rememberMovies(personal.picks.map((pick) => pick.movie));
  }, [personal.picks]);

  const picks = useMemo(
    () =>
      circlePicks({
        ratings: group?.ratings ?? [],
        selfMemberId: membership?.memberId ?? null,
        blockedMemberIds,
        alreadyRated: ratings,
      }),
    [blockedMemberIds, group?.ratings, membership?.memberId, ratings],
  );

  useEffect(() => {
    rememberMovies(picks.map((pick) => pick.movie));
  }, [picks]);

  function openMovie(movie: Movie) {
    rememberMovie(movie);
    router.push({ pathname: '/movie/[id]', params: { id: movie.id } });
  }

  const forYouMessage = forYouEmptyMessage({
    ratingCount: ratings.length,
    seedCount: recommendationSeeds(ratings).length,
    resultCount: loading ? 1 : personal.picks.length,
  });
  const circleMessage = circlePicksMessage({
    inGroup: Boolean(membership && group),
    code: group?.code ?? null,
    pickCount: picks.length,
  });

  return (
    <SafeAreaView style={styles.safe} edges={['top']} testID="screen-for-you">
      <ScrollView contentContainerStyle={styles.content}>
        <View style={styles.brandRow}>
          <AppText variant="eyebrow">Popcorn Circle</AppText>
          <Pressable accessibilityRole="link" accessibilityLabel="About Popcorn Circle" onPress={() => router.push('/about')}>
            <AppText variant="meta" style={styles.about}>About</AppText>
          </Pressable>
        </View>
        <AppText variant="display" style={styles.title}>For you</AppText>
        <AppText variant="muted" style={styles.subtitle}>
          Films that sit near the ones you already loved, plus what your circle rated highly.
        </AppText>

        <View style={styles.section}>
          <AppText variant="eyebrow">From your ratings</AppText>
          {!ready || loading ? <ActivityIndicator color={colors.amber} /> : null}
        </View>
        {personal.notice ? (
          <View style={styles.notice}>
            <AppText variant="muted">{personal.notice}</AppText>
          </View>
        ) : null}
        {ready && !loading && forYouMessage ? (
          <AppText variant="muted" testID="for-you-empty">{forYouMessage}</AppText>
        ) : null}
        {ready && !loading
          ? personal.picks.map((pick) => (
            <View key={pick.movie.id} style={styles.item} testID={`for-you-${pick.movie.id}`}>
              <MovieCard
                movie={pick.movie}
                detail={suggestionReason(pick.seedCount)}
                onPress={() => openMovie(pick.movie)}
              />
            </View>
          ))
          : null}
        {!loading && personal.picks.length > 0 ? (
          <AppText variant="meta" style={styles.footer}>
            {personal.source === 'tmdb'
              ? 'Suggestions from TMDB. This app is not endorsed or certified by TMDB.'
              : 'Picked from the shelf by genres you rated highly. Posters load from TMDB.'}
          </AppText>
        ) : null}

        <View style={styles.section}>
          <AppText variant="eyebrow">Circle picks</AppText>
          {membership && group ? <AppText variant="meta">{group.code}</AppText> : null}
        </View>
        {circleMessage ? (
          <AppText variant="muted" testID="circle-picks-note">{circleMessage}</AppText>
        ) : (
          picks.map((pick) => (
            <View key={pick.movie.id} style={styles.item} testID={`circle-pick-${pick.movie.id}`}>
              <MovieCard
                movie={pick.movie}
                detail={circlePickDetail(pick)}
                onPress={() => openMovie(pick.movie)}
              />
            </View>
          ))
        )}
      </ScrollView>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  safe: { flex: 1, backgroundColor: colors.bg },
  content: { paddingHorizontal: 20, paddingTop: 12, paddingBottom: 32 },
  brandRow: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between' },
  about: { color: colors.amber },
  title: { marginTop: 8 },
  subtitle: { marginTop: 8 },
  section: {
    marginTop: 26,
    marginBottom: 12,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
  },
  notice: {
    marginBottom: 12,
    padding: 12,
    borderRadius: 12,
    backgroundColor: colors.amberSoft,
  },
  item: { marginBottom: 10 },
  footer: { marginTop: 4 },
});
