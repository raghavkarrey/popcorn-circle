import { router } from 'expo-router';
import { useMemo, useState } from 'react';
import { ActivityIndicator, FlatList, Pressable, StyleSheet, View } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';

import { AppText } from '@/components/AppText';
import { ConfirmDialog } from '@/components/ConfirmDialog';
import { PrimaryButton } from '@/components/PrimaryButton';
import { RatingCard } from '@/components/RatingCard';
import { useCardColumns, useScreenMode } from '@/components/useScreenMode';
import { colors } from '@/constants/theme';
import { pageTitleSize } from '@/lib/layout';
import { useRatings } from '@/context/RatingsProvider';
import { rememberMovie } from '@/lib/movie-memory';
import { formatSummary, movieFromRating, sortRatings } from '@/lib/ratings';
import type { Rating, SortMode } from '@/lib/types';

const SORTS: { id: SortMode; label: string }[] = [
  { id: 'recent', label: 'Recent' },
  { id: 'highest', label: 'Highest' },
];

export default function RatingsScreen() {
  const screen = useScreenMode();
  const columns = useCardColumns();
  const { ratings, ready, error, remove, refresh } = useRatings();
  const [mode, setMode] = useState<SortMode>('recent');
  const [pending, setPending] = useState<Rating | null>(null);
  const sorted = useMemo(() => sortRatings(ratings, mode), [ratings, mode]);

  function openRating(rating: Rating) {
    rememberMovie(movieFromRating(rating));
    router.push({ pathname: '/movie/[id]', params: { id: rating.movieId } });
  }

  return (
    <SafeAreaView style={styles.safe} edges={['top']} testID="screen-ratings">
      <FlatList
        key={columns}
        data={ready ? sorted : []}
        numColumns={columns}
        keyExtractor={(rating) => rating.movieId}
        columnWrapperStyle={columns > 1 ? styles.row : undefined}
        contentContainerStyle={styles.list}
        ListHeaderComponent={
          <View>
            <AppText variant="eyebrow">On this device</AppText>
            <AppText variant="display" style={[styles.title, pageTitleSize(screen)]}>
              My ratings
            </AppText>
            <AppText variant="muted" style={styles.summary}>
              {ready ? formatSummary(ratings) : 'Opening your log…'}
            </AppText>
            <View style={styles.sorts}>
              {SORTS.map((sort) => {
                const selected = mode === sort.id;
                return (
                  <Pressable
                    key={sort.id}
                    accessibilityRole="button"
                    accessibilityState={{ selected }}
                    testID={`sort-${sort.id}`}
                    onPress={() => setMode(sort.id)}
                    style={[styles.chip, selected && styles.chipOn]}
                  >
                    <AppText variant="meta" style={selected ? styles.chipLabelOn : undefined}>
                      {sort.label}
                    </AppText>
                  </Pressable>
                );
              })}
            </View>
          </View>
        }
        ListEmptyComponent={
          !ready ? (
            <ActivityIndicator color={colors.amber} style={styles.spinner} />
          ) : error ? (
            <View style={styles.empty}>
              <AppText variant="title">Couldn’t open the log</AppText>
              <AppText variant="muted" style={styles.emptyBody}>
                {error}
              </AppText>
              <View style={styles.emptyAction}>
                <PrimaryButton label="Try again" onPress={() => void refresh()} />
              </View>
            </View>
          ) : (
            <View style={styles.empty}>
              <AppText variant="title">The log is empty</AppText>
              <AppText variant="muted" style={styles.emptyBody}>
                Rate a film from Search. It stays on this device, with whatever note you leave beside it.
              </AppText>
              <View style={styles.emptyAction}>
                <PrimaryButton label="Find a film" onPress={() => router.navigate('/')} />
              </View>
            </View>
          )
        }
        renderItem={({ item }) => (
          <View style={[styles.item, columns > 1 && styles.itemWide]}>
            <RatingCard rating={item} onPress={() => openRating(item)} onDelete={() => setPending(item)} />
          </View>
        )}
      />
      <ConfirmDialog
        visible={pending !== null}
        title="Remove this rating?"
        body={pending ? `${pending.title} leaves the log, and the note goes with it.` : ''}
        confirmLabel="Remove"
        onCancel={() => setPending(null)}
        onConfirm={() => {
          if (!pending) return;
          const movieId = pending.movieId;
          setPending(null);
          void remove(movieId);
        }}
      />
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  safe: {
    flex: 1,
    backgroundColor: colors.bg,
  },
  list: {
    paddingHorizontal: 20,
    paddingTop: 12,
    paddingBottom: 28,
    flexGrow: 1,
  },
  title: {
    marginTop: 8,
  },
  summary: {
    marginTop: 8,
  },
  sorts: {
    flexDirection: 'row',
    gap: 8,
    marginTop: 18,
    marginBottom: 16,
  },
  chip: {
    minHeight: 36,
    paddingHorizontal: 14,
    borderRadius: 999,
    borderWidth: 1,
    borderColor: colors.line,
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: colors.surface,
  },
  chipOn: {
    backgroundColor: colors.amberSoft,
    borderColor: colors.amber,
  },
  chipLabelOn: {
    color: colors.amber,
  },
  row: {
    gap: 12,
  },
  item: {
    marginBottom: 10,
  },
  itemWide: {
    flex: 1,
  },
  spinner: {
    marginTop: 24,
  },
  empty: {
    paddingTop: 12,
  },
  emptyBody: {
    marginTop: 8,
  },
  emptyAction: {
    marginTop: 18,
  },
});
