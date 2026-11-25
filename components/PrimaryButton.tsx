import { Pressable, StyleSheet } from 'react-native';

import { AppText, useFontsReady } from '@/components/AppText';
import { colors, fonts } from '@/constants/theme';

type Props = {
  label: string;
  onPress: () => void;
  disabled?: boolean;
  tone?: 'amber' | 'danger';
  testID?: string;
};

export function PrimaryButton({ label, onPress, disabled = false, tone = 'amber', testID }: Props) {
  const danger = tone === 'danger';
  const fontsReady = useFontsReady();
  return (
    <Pressable
      accessibilityRole="button"
      accessibilityState={{ disabled }}
      disabled={disabled}
      onPress={onPress}
      testID={testID}
      style={({ pressed }) => [
        styles.button,
        { backgroundColor: danger ? colors.danger : colors.amber },
        disabled && styles.disabled,
        pressed && !disabled && styles.pressed,
      ]}
    >
      <AppText
        variant="body"
        style={[
          styles.label,
          { color: danger ? colors.dangerInk : colors.amberInk },
          fontsReady ? { fontFamily: fonts.semibold } : null,
        ]}
      >
        {label}
      </AppText>
    </Pressable>
  );
}

const styles = StyleSheet.create({
  button: {
    minHeight: 52,
    borderRadius: 14,
    alignItems: 'center',
    justifyContent: 'center',
    paddingHorizontal: 18,
  },
  label: {
    fontSize: 16,
  },
  disabled: {
    opacity: 0.45,
  },
  pressed: {
    opacity: 0.86,
  },
});
