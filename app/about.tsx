import { router } from 'expo-router';
import { useState } from 'react';
import { Image } from 'expo-image';
import { Linking, Pressable, ScrollView, StyleSheet, View } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';

import { AppText } from '@/components/AppText';
import { ChevronLeftIcon } from '@/components/Icons';
import { ConfirmDialog } from '@/components/ConfirmDialog';
import { colors } from '@/constants/theme';
import { useRatings } from '@/context/RatingsProvider';
import { useGroup } from '@/context/GroupProvider';
import { groupApiBase } from '@/lib/group-api';
import { supportContact } from '@/lib/support';

const TMDB_NOTICE =
  'This application uses TMDB and the TMDB APIs but is not endorsed, certified, or otherwise approved by TMDB.';

export default function AboutScreen() {
  const { clearAll, ratings } = useRatings();
  const { apiBase } = useGroup();
  const email = supportContact();
  const mailto = `mailto:${email}`;
  const [confirming, setConfirming] = useState(false);
  const privacyUrl = `${groupApiBase()}/privacy`;

  return (
    <SafeAreaView style={styles.safe} edges={['top', 'bottom']} testID="screen-about">
      <ScrollView contentContainerStyle={styles.content}>
        <Pressable accessibilityRole="button" accessibilityLabel="Go back" onPress={() => router.back()} style={styles.back}>
          <ChevronLeftIcon color={colors.text} />
          <AppText variant="body">Back</AppText>
        </Pressable>
        <AppText variant="eyebrow">Popcorn Circle</AppText>
        <AppText variant="display" style={styles.title}>About</AppText>
        <AppText variant="muted" style={styles.body}>
          A movie log for one person, and a group when you want company. Ratings you keep to yourself stay on this phone.
        </AppText>

        <AppText variant="eyebrow" style={styles.section}>Support</AppText>
        <AppText
          variant="body"
          accessibilityRole="link"
          href={mailto}
          onPress={() => void Linking.openURL(mailto)}
          style={styles.link}
          testID="support-email"
        >
          {email}
        </AppText>

        <AppText variant="eyebrow" style={styles.section}>Privacy</AppText>
        <Pressable accessibilityRole="link" testID="privacy-link" onPress={() => void Linking.openURL(privacyUrl)}>
          <AppText variant="body" style={styles.link}>Read the privacy policy</AppText>
        </Pressable>
        <AppText variant="meta">{privacyUrl}</AppText>

        <AppText variant="eyebrow" style={styles.section}>On this phone</AppText>
        <AppText variant="muted">{ratings.length === 1 ? '1 saved rating.' : `${ratings.length} saved ratings.`}</AppText>
        <Pressable
          accessibilityRole="button"
          testID="delete-local-ratings"
          onPress={() => setConfirming(true)}
          style={styles.delete}
        >
          <AppText variant="body" style={styles.deleteLabel}>Delete My Ratings on this phone</AppText>
        </Pressable>

        <View style={styles.tmdb}>
          <Image
            source={require('../assets/images/tmdb-logo.svg')}
            style={styles.logo}
            contentFit="contain"
            accessibilityLabel="TMDB"
          />
          <AppText variant="meta" style={styles.notice}>{TMDB_NOTICE}</AppText>
        </View>
        <AppText variant="meta">Group server: {apiBase}</AppText>
      </ScrollView>
      <ConfirmDialog
        visible={confirming}
        title="Delete My Ratings?"
        body="This removes every rating and note stored on this phone. Shared group ratings are not deleted unless you also leave the group."
        confirmLabel="Delete"
        onCancel={() => setConfirming(false)}
        onConfirm={() => {
          setConfirming(false);
          void clearAll();
        }}
      />
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  safe: { flex: 1, backgroundColor: colors.bg },
  content: { paddingHorizontal: 20, paddingBottom: 32 },
  back: { flexDirection: 'row', alignItems: 'center', gap: 4, minHeight: 44, alignSelf: 'flex-start', marginLeft: -6 },
  title: { marginTop: 8, fontSize: 34, lineHeight: 38 },
  body: { marginTop: 10 },
  section: { marginTop: 28, marginBottom: 8 },
  link: { color: colors.amber },
  delete: { minHeight: 48, justifyContent: 'center' },
  deleteLabel: { color: colors.danger },
  tmdb: { marginTop: 36, paddingTop: 16, borderTopWidth: 1, borderTopColor: colors.line, gap: 10 },
  logo: { width: 72, height: 52, opacity: 0.85 },
  notice: { maxWidth: 320 },
});
