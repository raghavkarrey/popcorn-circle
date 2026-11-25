import { createContext, useContext } from 'react';
import { Text, type TextProps, type TextStyle } from 'react-native';

import { colors, fonts } from '@/constants/theme';

export const FontReadyContext = createContext(false);

export function useFontsReady(): boolean {
  return useContext(FontReadyContext);
}

type Variant = 'eyebrow' | 'display' | 'title' | 'body' | 'muted' | 'meta' | 'score';

const variantStyle: Record<Variant, TextStyle> = {
  eyebrow: {
    fontSize: 12,
    letterSpacing: 1.4,
    textTransform: 'uppercase',
    color: colors.amber,
  },
  display: {
    fontSize: 34,
    lineHeight: 38,
    letterSpacing: -0.6,
    color: colors.text,
  },
  title: {
    fontSize: 18,
    lineHeight: 23,
    color: colors.text,
  },
  body: {
    fontSize: 16,
    lineHeight: 23,
    color: colors.text,
  },
  muted: {
    fontSize: 14,
    lineHeight: 20,
    color: colors.textMuted,
  },
  meta: {
    fontSize: 13,
    lineHeight: 18,
    color: colors.textFaint,
  },
  score: {
    fontSize: 28,
    lineHeight: 32,
    color: colors.amber,
  },
};

const variantFont: Record<Variant, string> = {
  eyebrow: fonts.semibold,
  display: fonts.display,
  title: fonts.display,
  body: fonts.body,
  muted: fonts.body,
  meta: fonts.medium,
  score: fonts.display,
};

type Props = TextProps & {
  variant?: Variant;
};

export function AppText({ variant = 'body', style, ...rest }: Props) {
  const fontsReady = useFontsReady();
  return (
    <Text
      {...rest}
      style={[variantStyle[variant], { fontFamily: fontsReady ? variantFont[variant] : undefined }, style]}
    />
  );
}
