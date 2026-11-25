import { Link, Stack } from 'expo-router';
import { StyleSheet, View } from 'react-native';

import { AppText } from '@/components/AppText';
import { colors } from '@/constants/theme';

export default function NotFoundScreen() {
  return (
    <>
      <Stack.Screen options={{ headerShown: false }} />
      <View style={styles.container}>
        <AppText variant="display" style={styles.title}>
          This screen isn’t in the log
        </AppText>
        <Link href="/" style={styles.link}>
          <AppText variant="body" style={styles.linkText}>
            Back to search
          </AppText>
        </Link>
      </View>
    </>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: colors.bg,
    alignItems: 'flex-start',
    justifyContent: 'center',
    padding: 24,
  },
  title: {
    fontSize: 32,
    lineHeight: 36,
  },
  link: {
    marginTop: 16,
    minHeight: 44,
    justifyContent: 'center',
  },
  linkText: {
    color: colors.amber,
  },
});
