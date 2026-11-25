import { useId } from 'react';
import { Platform, Pressable, StyleSheet, View } from 'react-native';
import Svg, { ClipPath, Defs, Path, Rect } from 'react-native-svg';
import * as Haptics from 'expo-haptics';

import { STAR_PATH } from '@/components/Icons';
import { colors } from '@/constants/theme';
import { formatStars } from '@/lib/ratings';

function starFill(value: number, index: number): number {
  const amount = value - (index - 1);
  if (amount >= 1) return 1;
  if (amount <= 0) return 0;
  return amount;
}

function StarGlyph({ size, amount }: { size: number; amount: number }) {
  const clipId = `star-${useId().replace(/:/g, '')}`;
  const clipWidth = 24 * Math.max(0, Math.min(1, amount));

  return (
    <Svg width={size} height={size} viewBox="0 0 24 24">
      <Defs>
        <ClipPath id={clipId}>
          <Rect x="0" y="0" width={clipWidth} height="24" />
        </ClipPath>
      </Defs>
      <Path d={STAR_PATH} fill={colors.starEmpty} />
      {clipWidth > 0 ? <Path d={STAR_PATH} fill={colors.amber} clipPath={`url(#${clipId})`} /> : null}
    </Svg>
  );
}

export function Stars({ value, size = 16 }: { value: number; size?: number }) {
  return (
    <View
      accessibilityLabel={`${formatStars(value)} out of 5 stars`}
      style={[styles.row, { gap: Math.max(2, size * 0.15) }]}
    >
      {[1, 2, 3, 4, 5].map((index) => (
        <StarGlyph key={index} size={size} amount={starFill(value, index)} />
      ))}
    </View>
  );
}

function tick() {
  if (Platform.OS === 'web') return;
  void Haptics.selectionAsync();
}

export function StarPicker({ value, onChange }: { value: number; onChange: (next: number) => void }) {
  function choose(next: number) {
    if (next !== value) tick();
    onChange(next);
  }

  return (
    <View
      accessibilityLabel="Rating"
      accessibilityValue={{ text: value ? `${formatStars(value)} of 5` : 'Not rated' }}
      style={styles.picker}
      testID="star-picker"
    >
      {[1, 2, 3, 4, 5].map((index) => (
        <View key={index} style={styles.slot}>
          <StarGlyph size={28} amount={starFill(value, index)} />
          <View style={styles.hits}>
            <Pressable
              accessibilityRole="button"
              accessibilityLabel={`${formatStars(index - 0.5)} stars`}
              testID={`star-${index - 0.5}`}
              style={styles.hit}
              onPress={() => choose(index - 0.5)}
            />
            <Pressable
              accessibilityRole="button"
              accessibilityLabel={`${formatStars(index)} stars`}
              testID={`star-${index}`}
              style={styles.hit}
              onPress={() => choose(index)}
            />
          </View>
        </View>
      ))}
    </View>
  );
}

const styles = StyleSheet.create({
  row: {
    flexDirection: 'row',
    alignItems: 'center',
  },
  picker: {
    flex: 1,
    flexDirection: 'row',
    alignItems: 'center',
  },
  slot: {
    flex: 1,
    height: 48,
    alignItems: 'center',
    justifyContent: 'center',
  },
  hits: {
    position: 'absolute',
    top: 0,
    right: 0,
    bottom: 0,
    left: 0,
    flexDirection: 'row',
  },
  hit: {
    width: '50%',
    height: '100%',
  },
});
