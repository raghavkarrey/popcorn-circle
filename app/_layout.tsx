import { Fraunces_600SemiBold } from '@expo-google-fonts/fraunces/600SemiBold';
import { Outfit_400Regular } from '@expo-google-fonts/outfit/400Regular';
import { Outfit_500Medium } from '@expo-google-fonts/outfit/500Medium';
import { Outfit_600SemiBold } from '@expo-google-fonts/outfit/600SemiBold';
import { useFonts } from 'expo-font';
import { DarkTheme, Stack, ThemeProvider } from 'expo-router';
import * as SplashScreen from 'expo-splash-screen';
import { StatusBar } from 'expo-status-bar';
import { useEffect, type ReactNode } from 'react';
import { Platform, StyleSheet, View } from 'react-native';
import 'react-native-reanimated';

import { FontReadyContext } from '@/components/AppText';
import { DesktopNav } from '@/components/DesktopNav';
import { useScreenMode } from '@/components/useScreenMode';
import { colors } from '@/constants/theme';
import { CONTENT_MAX } from '@/lib/layout';
import { GroupProvider } from '@/context/GroupProvider';
import { RatingsProvider } from '@/context/RatingsProvider';

export { ErrorBoundary } from 'expo-router';

export const unstable_settings = {
  anchor: '(tabs)',
};

SplashScreen.preventAutoHideAsync().catch(() => {});

const navigationTheme = {
  ...DarkTheme,
  colors: {
    ...DarkTheme.colors,
    background: colors.bg,
    card: colors.surface,
    text: colors.text,
    border: colors.line,
    primary: colors.amber,
    notification: colors.amber,
  },
};

export default function RootLayout() {
  const [loaded, error] = useFonts({
    Fraunces_600SemiBold,
    Outfit_400Regular,
    Outfit_500Medium,
    Outfit_600SemiBold,
  });

  useEffect(() => {
    if (loaded || error) {
      SplashScreen.hideAsync().catch(() => {});
    }
  }, [loaded, error]);

  if (!loaded && !error) return null;

  return (
    <FontReadyContext.Provider value={Boolean(loaded) && !error}>
      <ThemeProvider value={navigationTheme}>
        <RatingsProvider>
          <GroupProvider>
            <StatusBar style="light" />
            <AppFrame>
              <Stack
                screenOptions={{
                  headerShown: false,
                  contentStyle: { backgroundColor: colors.bg },
                }}
              />
            </AppFrame>
          </GroupProvider>
        </RatingsProvider>
      </ThemeProvider>
    </FontReadyContext.Provider>
  );
}

function AppFrame({ children }: { children: ReactNode }) {
  const mode = useScreenMode();
  const wide = Platform.OS === 'web' && mode !== 'phone';
  return (
    <View style={[styles.shell, wide && styles.shellWide]}>
      {mode === 'desktop' ? <DesktopNav /> : null}
      <View style={[styles.frame, mode === 'phone' && styles.framePhone, mode === 'tablet' && styles.frameTablet, mode === 'desktop' && styles.frameDesktop]}>
        <View style={mode === 'desktop' ? styles.column : styles.fill}>{children}</View>
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  shell: {
    flex: 1,
    backgroundColor: colors.bgSunken,
    alignItems: 'center',
  },
  shellWide: {
    alignItems: 'stretch',
    flexDirection: 'row',
    width: '100%',
  },
  frame: {
    flexGrow: 1,
    flexShrink: 1,
    flexBasis: 0,
    minWidth: 0,
    backgroundColor: colors.bg,
  },
  framePhone: {
    width: '100%',
    maxWidth: 480,
  },
  frameTablet: {
    width: '100%',
    maxWidth: 840,
  },
  frameDesktop: {
    backgroundColor: colors.bgSunken,
  },
  fill: {
    flex: 1,
  },
  column: {
    flex: 1,
    width: '100%',
    maxWidth: CONTENT_MAX,
    alignSelf: 'center',
    backgroundColor: colors.bg,
  },
});
