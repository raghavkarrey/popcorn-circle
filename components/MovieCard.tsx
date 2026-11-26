import { Pressable, StyleSheet, View } from 'react-native';

import { AppText } from '@/components/AppText';
import { Poster } from '@/components/Poster';
import { colors } from '@/constants/theme';
import { formatStars } from '@/lib/ratings';
import type { Movie, Rating } from '@/lib/types';

type Props = {
  movie: Movie;
  rating?: Rating;
  detail?: string;
  onPress: () => void;
};

export function MovieCard({ movie, rating, detail, onPress }: Props) {
  return (
    <Pressable
      accessibilityRole="button"
      accessibilityLabel={`${movie.title}, ${movie.year}`}
      testID={`movie-${movie.id}`}
      onPress={onPress}
      style={({ pressed }) => [styles.card, pressed && styles.pressed]}
    >
      <Poster uri={movie.posterUrl} title={movie.title} width={72} height={108} radius={10} />
      <View style={styles.copy}>
        <View style={styles.titleRow}>
          <AppText variant="title" numberOfLines={2} style={styles.title}>
            {movie.title}
          </AppText>
          {rating ? (
            <View style={styles.pill}>
              <AppText variant="meta" style={styles.pillText}>
                {formatStars(rating.stars)}
              </AppText>
            </View>
          ) : null}
        </View>
        <AppText variant="meta">{movie.year}</AppText>
        {detail ? (
          <AppText variant="meta" style={styles.detail}>
            {detail}
          </AppText>
        ) : null}
        <AppText variant="muted" numberOfLines={2} style={styles.overview}>
          {movie.overview}
        </AppText>
      </View>
    </Pressable>
  );
}

const styles = StyleSheet.create({
  card: {
    flexDirection: 'row',
    gap: 14,
    padding: 12,
    borderRadius: 16,
    backgroundColor: colors.surface,
    borderWidth: 1,
    borderColor: colors.line,
  },
  pressed: {
    opacity: 0.86,
  },
  copy: {
    flex: 1,
    paddingTop: 2,
  },
  titleRow: {
    flexDirection: 'row',
    alignItems: 'flex-start',
    gap: 8,
  },
  title: {
    flex: 1,
  },
  pill: {
    backgroundColor: colors.amberSoft,
    borderRadius: 999,
    paddingHorizontal: 8,
    paddingVertical: 3,
  },
  pillText: {
    color: colors.amber,
  },
  detail: {
    marginTop: 4,
    color: colors.amber,
  },
  overview: {
    marginTop: 6,
  },
});
