import { Image } from 'expo-image';
import { useState } from 'react';
import { Platform, Pressable, StyleSheet, View } from 'react-native';

import { AppText } from '@/components/AppText';
import { colors } from '@/constants/theme';
import type { Movie } from '@/lib/types';

type Props = {
  movie: Movie;
  detail?: string;
  onPress: () => void;
};

export function PosterTile({ movie, detail, onPress }: Props) {
  const [failed, setFailed] = useState(false);
  return (
    <Pressable
      accessibilityRole="button"
      accessibilityLabel={`${movie.title}, ${movie.year}`}
      testID={`movie-${movie.id}`}
      onPress={onPress}
      style={({ pressed, hovered }) => [
        styles.tile,
        Platform.OS === 'web' && styles.pointer,
        (pressed || hovered) && styles.hover,
      ]}
    >
      {movie.posterUrl && !failed ? (
        <Image
          source={{ uri: movie.posterUrl }}
          style={styles.poster}
          contentFit="cover"
          accessibilityLabel={`${movie.title} poster`}
          onError={() => setFailed(true)}
        />
      ) : (
        <View style={[styles.poster, styles.fallback]}>
          <AppText variant="meta" numberOfLines={3} style={styles.fallbackTitle}>
            {movie.title}
          </AppText>
        </View>
      )}
      <AppText variant="title" numberOfLines={2} style={styles.title}>
        {movie.title}
      </AppText>
      <AppText variant="meta">{movie.year}</AppText>
      {detail ? (
        <AppText variant="meta" numberOfLines={2} style={styles.detail}>
          {detail}
        </AppText>
      ) : null}
    </Pressable>
  );
}

const styles = StyleSheet.create({
  tile: {
    width: '100%',
  },
  pointer: {
    cursor: 'pointer',
  },
  hover: {
    opacity: 0.88,
  },
  poster: {
    width: '100%',
    aspectRatio: 2 / 3,
    borderRadius: 14,
    backgroundColor: colors.surfaceRaised,
    marginBottom: 10,
  },
  fallback: {
    alignItems: 'center',
    justifyContent: 'center',
    padding: 10,
    borderWidth: 1,
    borderColor: colors.line,
  },
  fallbackTitle: {
    textAlign: 'center',
  },
  title: {
    fontSize: 16,
    lineHeight: 20,
  },
  detail: {
    marginTop: 4,
    color: colors.amber,
  },
});
