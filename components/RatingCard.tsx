import { Pressable, StyleSheet, View } from 'react-native';

import { AppText } from '@/components/AppText';
import { TrashIcon } from '@/components/Icons';
import { Poster } from '@/components/Poster';
import { Stars } from '@/components/Stars';
import { colors } from '@/constants/theme';
import { formatRatedOn, formatStars } from '@/lib/ratings';
import type { Rating } from '@/lib/types';

type Props = {
  rating: Rating;
  onPress: () => void;
  onDelete: () => void;
};

export function RatingCard({ rating, onPress, onDelete }: Props) {
  return (
    <View style={styles.card}>
      <Pressable
        accessibilityRole="button"
        accessibilityLabel={`${rating.title}, rated ${formatStars(rating.stars)} of 5`}
        accessibilityHint="Opens this rating to edit it"
        testID={`rating-${rating.movieId}`}
        onPress={onPress}
        style={({ pressed }) => [styles.main, pressed && styles.pressed]}
      >
        <Poster uri={rating.posterUrl} title={rating.title} width={64} height={96} radius={10} />
        <View style={styles.copy}>
          <AppText variant="title" numberOfLines={2} style={styles.title}>
            {rating.title}
          </AppText>
          <AppText variant="meta">{rating.year}</AppText>
          <View style={styles.starRow}>
            <Stars value={rating.stars} size={14} />
            <AppText variant="meta" style={styles.score}>
              {formatStars(rating.stars)}
            </AppText>
            <AppText variant="meta" style={styles.when}>
              {formatRatedOn(rating.updatedAt)}
            </AppText>
          </View>
          {rating.note ? (
            <View style={styles.note}>
              <AppText variant="muted" numberOfLines={3}>
                {rating.note}
              </AppText>
            </View>
          ) : null}
        </View>
      </Pressable>
      <Pressable
        accessibilityRole="button"
        accessibilityLabel={`Remove ${rating.title}`}
        testID={`delete-${rating.movieId}`}
        hitSlop={8}
        onPress={onDelete}
        style={styles.trash}
      >
        <TrashIcon color={colors.textFaint} />
      </Pressable>
    </View>
  );
}

const styles = StyleSheet.create({
  card: {
    position: 'relative',
    borderRadius: 16,
    backgroundColor: colors.surface,
    borderWidth: 1,
    borderColor: colors.line,
  },
  main: {
    flexDirection: 'row',
    gap: 14,
    padding: 12,
    paddingRight: 44,
    borderRadius: 16,
  },
  pressed: {
    opacity: 0.86,
  },
  copy: {
    flex: 1,
  },
  title: {
    paddingRight: 4,
  },
  trash: {
    position: 'absolute',
    top: 8,
    right: 8,
    width: 36,
    height: 36,
    alignItems: 'center',
    justifyContent: 'center',
  },
  starRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
    marginTop: 8,
  },
  score: {
    color: colors.amber,
  },
  when: {
    marginLeft: 'auto',
  },
  note: {
    marginTop: 8,
    paddingLeft: 10,
    borderLeftWidth: 2,
    borderLeftColor: colors.amber,
  },
});
