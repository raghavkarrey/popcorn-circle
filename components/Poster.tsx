import { Image } from 'expo-image';
import { useEffect, useState } from 'react';
import { StyleSheet, View } from 'react-native';

import { AppText } from '@/components/AppText';
import { StarIcon } from '@/components/Icons';
import { colors } from '@/constants/theme';

type Props = {
  uri: string | null;
  title: string;
  width: number;
  height: number;
  radius?: number;
};

export function Poster({ uri, title, width, height, radius = 12 }: Props) {
  const [failed, setFailed] = useState(false);

  useEffect(() => {
    setFailed(false);
  }, [uri]);

  if (!uri || failed) {
    return (
      <View style={[styles.fallback, { width, height, borderRadius: radius }]}>
        <StarIcon size={Math.min(26, width * 0.28)} color={colors.amber} />
        <AppText variant="meta" numberOfLines={4} style={styles.fallbackTitle}>
          {title}
        </AppText>
      </View>
    );
  }

  return (
    <Image
      source={{ uri }}
      style={{ width, height, borderRadius: radius, backgroundColor: colors.surfaceRaised }}
      contentFit="cover"
      transition={180}
      accessibilityLabel={`${title} poster`}
      onError={() => setFailed(true)}
    />
  );
}

const styles = StyleSheet.create({
  fallback: {
    backgroundColor: colors.surfaceRaised,
    borderWidth: 1,
    borderColor: colors.line,
    alignItems: 'center',
    justifyContent: 'center',
    paddingHorizontal: 8,
    gap: 8,
  },
  fallbackTitle: {
    textAlign: 'center',
    color: colors.textMuted,
  },
});
