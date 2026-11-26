import { router } from 'expo-router';
import { useState } from 'react';
import {
  ActivityIndicator,
  FlatList,
  Pressable,
  StyleSheet,
  TextInput,
  View,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';

import { AppText, useFontsReady } from '@/components/AppText';
import { ConfirmDialog } from '@/components/ConfirmDialog';
import { Poster } from '@/components/Poster';
import { PrimaryButton } from '@/components/PrimaryButton';
import { Stars } from '@/components/Stars';
import { useCardColumns, useScreenMode } from '@/components/useScreenMode';
import { colors, fonts } from '@/constants/theme';
import { formMaxWidth, pageTitleSize } from '@/lib/layout';
import { useGroup } from '@/context/GroupProvider';
import { useRatings } from '@/context/RatingsProvider';
import { GROUP_CODE_LENGTH, groupFeed, languageError, normalizeGroupCode, type GroupFeedItem } from '@/lib/groups';
import { rememberMovie } from '@/lib/movie-memory';
import { formatRatedOn, formatStars } from '@/lib/ratings';

export default function GroupScreen() {
  const fontsReady = useFontsReady();
  const mode = useScreenMode();
  const columns = useCardColumns();
  const {
    ready,
    displayName,
    setDisplayName,
    membership,
    group,
    syncError,
    createGroup,
    joinGroup,
    leaveGroup,
    blockMember,
    unblockMember,
    reportRating,
    blockedMemberIds,
  } = useGroup();
  const { clearAll } = useRatings();
  const [code, setCode] = useState('');
  const [nameFocused, setNameFocused] = useState(false);
  const [codeFocused, setCodeFocused] = useState(false);
  const [busy, setBusy] = useState<'create' | 'join' | 'leave' | null>(null);
  const [formError, setFormError] = useState<string | null>(null);
  const [confirming, setConfirming] = useState(false);
  const [alsoDeleteLocal, setAlsoDeleteLocal] = useState(false);
  const [reportTarget, setReportTarget] = useState<GroupFeedItem | null>(null);
  const [blockTarget, setBlockTarget] = useState<GroupFeedItem | null>(null);
  const [notice, setNotice] = useState<string | null>(null);
  const feed = group ? groupFeed(group) : [];
  const nameReady = displayName.trim().length > 0;
  const codeReady = normalizeGroupCode(code).length === GROUP_CODE_LENGTH;

  async function onCreate() {
    if (!nameReady || busy) return;
    setBusy('create');
    setFormError(null);
    const nameProblem = languageError(displayName, 'name');
    if (nameProblem) {
      setFormError(nameProblem);
      setBusy(null);
      return;
    }
    try {
      await createGroup();
    } catch (error) {
      setFormError(error instanceof Error ? error.message : 'Could not start a group.');
    } finally {
      setBusy(null);
    }
  }

  async function onJoin() {
    if (!nameReady || !codeReady || busy) return;
    setBusy('join');
    setFormError(null);
    const nameProblem = languageError(displayName, 'name');
    if (nameProblem) {
      setFormError(nameProblem);
      setBusy(null);
      return;
    }
    try {
      await joinGroup(code);
    } catch (error) {
      setFormError(error instanceof Error ? error.message : 'Could not join that group.');
    } finally {
      setBusy(null);
    }
  }

  async function onLeave() {
    setConfirming(false);
    setBusy('leave');
    setFormError(null);
    try {
      await leaveGroup();
      if (alsoDeleteLocal) await clearAll();
      setAlsoDeleteLocal(false);
    } catch (error) {
      setFormError(error instanceof Error ? error.message : 'Could not leave the group.');
    } finally {
      setBusy(null);
    }
  }

  function openRating(item: GroupFeedItem) {
    rememberMovie({
      id: item.movieId,
      title: item.title,
      year: item.year,
      overview: item.overview,
      posterUrl: item.posterUrl,
    });
    router.push({ pathname: '/movie/[id]', params: { id: item.movieId } });
  }

  if (!ready) {
    return (
      <SafeAreaView style={styles.safe} edges={['top']} testID="screen-group">
        <ActivityIndicator color={colors.amber} style={styles.spinner} />
      </SafeAreaView>
    );
  }

  if (!membership || !group) {
    return (
      <SafeAreaView style={styles.safe} edges={['top']} testID="screen-group">
        <View style={[styles.form, formMaxWidth(mode) ? { maxWidth: formMaxWidth(mode) } : null]}>
          <AppText variant="eyebrow">Together</AppText>
          <AppText variant="display" style={[styles.title, pageTitleSize(mode)]}>
            Watch with friends
          </AppText>
          <AppText variant="muted" style={styles.subtitle}>
            Start a group or join one with a short code. Your name stays on this phone. No account.
          </AppText>

          <AppText variant="eyebrow" style={styles.fieldLabel}>
            Your name
          </AppText>
          <TextInput
            value={displayName}
            onChangeText={setDisplayName}
            onFocus={() => setNameFocused(true)}
            onBlur={() => setNameFocused(false)}
            placeholder="Raghav"
            placeholderTextColor={colors.textFaint}
            accessibilityLabel="Your name"
            testID="display-name"
            maxLength={24}
            style={[styles.input, nameFocused && styles.inputFocused, fontsReady ? { fontFamily: fonts.body } : null]}
          />

          <View style={styles.action}>
            <PrimaryButton
              label={busy === 'create' ? 'Starting…' : 'Start a group'}
              onPress={() => void onCreate()}
              disabled={!nameReady || busy !== null}
              testID="start-group"
            />
          </View>

          <AppText variant="eyebrow" style={styles.fieldLabel}>
            Have a code
          </AppText>
          <TextInput
            value={code}
            onChangeText={(value) => setCode(normalizeGroupCode(value).slice(0, GROUP_CODE_LENGTH))}
            onFocus={() => setCodeFocused(true)}
            onBlur={() => setCodeFocused(false)}
            placeholder="AB7K2Q"
            placeholderTextColor={colors.textFaint}
            accessibilityLabel="Join code"
            testID="join-code"
            autoCapitalize="characters"
            autoCorrect={false}
            maxLength={8}
            style={[
              styles.input,
              styles.codeInput,
              codeFocused && styles.inputFocused,
              fontsReady ? { fontFamily: fonts.semibold } : null,
            ]}
          />
          <View style={styles.action}>
            <PrimaryButton
              label={busy === 'join' ? 'Joining…' : 'Join group'}
              onPress={() => void onJoin()}
              disabled={!nameReady || !codeReady || busy !== null}
              testID="join-group"
            />
          </View>
          {formError ? (
            <AppText variant="muted" style={styles.error} testID="group-error">
              {formError}
            </AppText>
          ) : null}
          <AppText variant="meta" style={styles.footer}>
            Ratings you already saved stay on this phone. A film is shared only when you save it while you’re in the group.
          </AppText>
          <Pressable accessibilityRole="link" onPress={() => router.push('/about')} style={styles.aboutLink}>
            <AppText variant="meta" style={styles.actionLabel}>About and privacy</AppText>
          </Pressable>
        </View>
      </SafeAreaView>
    );
  }

  return (
    <SafeAreaView style={styles.safe} edges={['top']} testID="screen-group">
      <FlatList
        key={columns}
        numColumns={columns}
        columnWrapperStyle={columns > 1 ? styles.row : undefined}
        data={feed}
        keyExtractor={(item) => `${item.memberId}-${item.movieId}`}
        contentContainerStyle={[styles.list, { paddingBottom: 48 }]}
        ListHeaderComponent={
          <View>
            <AppText variant="eyebrow">Your group</AppText>
            <AppText
              variant="display"
              selectable
              style={styles.code}
              testID="group-code"
              accessibilityLabel={`Join code ${group.code}`}
            >
              {group.code}
            </AppText>
            <AppText variant="muted">
              Share this Popcorn Circle code. Anyone who joins can see the ratings and notes in the group.
            </AppText>
            <View style={styles.members}>
              {group.members.map((member) => {
                const mine = member.id === membership.memberId;
                const blocked = blockedMemberIds.includes(member.id);
                return (
                  <View key={member.id} style={[styles.member, mine && styles.memberMine]}>
                    <AppText variant="meta" style={mine ? styles.memberMineLabel : undefined}>
                      {mine ? `${member.name} · you` : blocked ? `${member.name} · blocked` : member.name}
                    </AppText>
                    {blocked ? (
                      <Pressable
                        accessibilityRole="button"
                        accessibilityLabel={`Unblock ${member.name}`}
                        testID={`unblock-${member.id}`}
                        onPress={() => void unblockMember(member.id)}
                      >
                        <AppText variant="meta" style={styles.actionLabel}>Unblock</AppText>
                      </Pressable>
                    ) : null}
                  </View>
                );
              })}
            </View>
            {syncError ? (
              <View style={styles.notice}>
                <AppText variant="muted">{syncError}</AppText>
              </View>
            ) : null}
            {formError ? (
              <AppText variant="muted" style={styles.error}>
                {formError}
              </AppText>
            ) : null}
            <View style={styles.feedHead}>
              <AppText variant="eyebrow">Shared ratings</AppText>
              <AppText variant="meta">{feed.length}</AppText>
            </View>
          </View>
        }
        ListEmptyComponent={
          <AppText variant="muted">
            Nothing shared yet. Rate a film from Search and it will show up here for everyone in {group.code}.
          </AppText>
        }
        renderItem={({ item }) => {
          const mine = item.memberId === membership.memberId;
          return (
            <View style={[styles.card, columns > 1 && styles.cardWide]} testID={`group-rating-${item.memberId}-${item.movieId}`}>
              <Pressable
                accessibilityRole="button"
                accessibilityLabel={`${item.memberName} rated ${item.title} ${formatStars(item.stars)}`}
                onPress={() => openRating(item)}
                style={({ pressed }) => [styles.cardMain, pressed && styles.pressed]}
              >
                <Poster uri={item.posterUrl} title={item.title} width={56} height={84} radius={8} />
                <View style={styles.cardCopy}>
                  <AppText variant="title" numberOfLines={2}>
                    {item.title}
                  </AppText>
                  <AppText variant="meta">
                    {mine ? 'You' : item.memberName} · {item.year}
                  </AppText>
                  <View style={styles.starRow}>
                    <Stars value={item.stars} size={13} />
                    <AppText variant="meta" style={styles.score}>
                      {formatStars(item.stars)}
                    </AppText>
                    <AppText variant="meta" style={styles.when}>
                      {formatRatedOn(item.updatedAt)}
                    </AppText>
                  </View>
                  {item.note ? (
                    <AppText variant="muted" numberOfLines={3} style={styles.note}>
                      {item.note}
                    </AppText>
                  ) : null}
                </View>
              </Pressable>
              {mine ? null : (
                <View style={styles.actions}>
                  <Pressable
                    accessibilityRole="button"
                    accessibilityLabel={`Report ${item.memberName}'s note on ${item.title}`}
                    testID={`report-${item.memberId}-${item.movieId}`}
                    onPress={() => setReportTarget(item)}
                  >
                    <AppText variant="meta" style={styles.actionLabel}>Report</AppText>
                  </Pressable>
                  <Pressable
                    accessibilityRole="button"
                    accessibilityLabel={`Block ${item.memberName}`}
                    testID={`block-${item.memberId}`}
                    onPress={() => setBlockTarget(item)}
                  >
                    <AppText variant="meta" style={styles.actionLabel}>Block</AppText>
                  </Pressable>
                </View>
              )}
            </View>
          );
        }}
        ListFooterComponent={
          <View>
            {notice ? <AppText variant="muted" testID="group-notice" style={styles.noticeText}>{notice}</AppText> : null}
            <Pressable
              accessibilityRole="button"
              accessibilityState={{ checked: alsoDeleteLocal }}
              testID="also-delete-local"
              onPress={() => setAlsoDeleteLocal((value) => !value)}
              style={styles.checkRow}
            >
              <View style={[styles.check, alsoDeleteLocal && styles.checkOn]} />
              <AppText variant="muted">Also delete My Ratings on this phone</AppText>
            </Pressable>
            <Pressable
              accessibilityRole="button"
              accessibilityLabel="Leave group and delete my data"
              testID="leave-delete"
              onPress={() => setConfirming(true)}
              style={styles.leave}
            >
              <AppText variant="body" style={styles.leaveLabel}>
                {busy === 'leave' ? 'Deleting…' : 'Leave group and delete my data'}
              </AppText>
            </Pressable>
            <Pressable accessibilityRole="link" onPress={() => router.push('/about')} style={styles.aboutLink}>
              <AppText variant="meta" style={styles.actionLabel}>About and privacy</AppText>
            </Pressable>
          </View>
        }
      />
      <ConfirmDialog
        visible={confirming}
        title="Delete your group data?"
        body={
          alsoDeleteLocal
            ? 'This removes your name, shared ratings, and notes from the server, and deletes My Ratings on this phone.'
            : 'This removes your name, shared ratings, and notes from the server. My Ratings on this phone stays.'
        }
        confirmLabel="Delete my data"
        onCancel={() => setConfirming(false)}
        onConfirm={() => void onLeave()}
      />
      <ConfirmDialog
        visible={reportTarget !== null}
        title="Report this note?"
        body={reportTarget ? `Report ${reportTarget.memberName}'s note on ${reportTarget.title}. A developer can review it and remove it.` : ''}
        confirmLabel="Report"
        onCancel={() => setReportTarget(null)}
        onConfirm={() => {
          const target = reportTarget;
          setReportTarget(null);
          if (!target) return;
          void reportRating({ memberId: target.memberId, movieId: target.movieId })
            .then(() => setNotice('Report sent. A developer can review it from the admin list.'))
            .catch((error: unknown) => setFormError(error instanceof Error ? error.message : 'Could not send the report.'));
        }}
      />
      <ConfirmDialog
        visible={blockTarget !== null}
        title={blockTarget ? `Block ${blockTarget.memberName}?` : 'Block'}
        body="Their ratings and notes will be hidden on this device. You can unblock them from the member list. The block is saved with your membership."
        confirmLabel="Block"
        onCancel={() => setBlockTarget(null)}
        onConfirm={() => {
          const target = blockTarget;
          setBlockTarget(null);
          if (!target) return;
          void blockMember(target.memberId).catch((error: unknown) =>
            setFormError(error instanceof Error ? error.message : 'Could not block that person.'),
          );
        }}
      />
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  safe: {
    flex: 1,
    backgroundColor: colors.bg,
  },
  spinner: {
    marginTop: 48,
  },
  form: {
    paddingHorizontal: 20,
    paddingTop: 12,
    paddingBottom: 28,
  },
  list: {
    paddingHorizontal: 20,
    paddingTop: 12,
    paddingBottom: 28,
  },
  title: {
    marginTop: 8,
  },
  subtitle: {
    marginTop: 8,
  },
  fieldLabel: {
    marginTop: 22,
    marginBottom: 8,
  },
  input: {
    minHeight: 52,
    borderRadius: 14,
    borderWidth: 1,
    borderColor: colors.line,
    backgroundColor: colors.input,
    color: colors.text,
    fontSize: 16,
    paddingHorizontal: 14,
    paddingVertical: 12,
  },
  codeInput: {
    letterSpacing: 3,
    fontSize: 20,
  },
  inputFocused: {
    borderColor: colors.amber,
  },
  action: {
    marginTop: 12,
  },
  error: {
    marginTop: 14,
    color: colors.danger,
  },
  footer: {
    marginTop: 18,
  },
  code: {
    marginTop: 8,
    letterSpacing: 6,
    fontSize: 42,
    lineHeight: 48,
  },
  members: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 8,
    marginTop: 16,
  },
  member: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
    borderRadius: 999,
    borderWidth: 1,
    borderColor: colors.line,
    backgroundColor: colors.surface,
    paddingHorizontal: 12,
    paddingVertical: 6,
  },
  memberMine: {
    borderColor: colors.amber,
    backgroundColor: colors.amberSoft,
  },
  memberMineLabel: {
    color: colors.amber,
  },
  notice: {
    marginTop: 14,
    padding: 12,
    borderRadius: 12,
    backgroundColor: colors.amberSoft,
  },
  feedHead: {
    marginTop: 22,
    marginBottom: 12,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
  },
  row: { gap: 12 },
  cardWide: { flex: 1 },
  card: {
    marginBottom: 10,
    borderRadius: 16,
    backgroundColor: colors.surface,
    borderWidth: 1,
    borderColor: colors.line,
    paddingBottom: 8,
  },
  cardMain: {
    flexDirection: 'row',
    gap: 12,
    padding: 12,
    paddingBottom: 4,
  },
  pressed: {
    opacity: 0.86,
  },
  cardCopy: {
    flex: 1,
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
  },
  actions: {
    flexDirection: 'row',
    gap: 16,
    marginTop: 4,
    paddingHorizontal: 12,
    paddingBottom: 8,
  },
  actionLabel: {
    color: colors.amber,
  },
  checkRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 10,
    marginTop: 18,
    minHeight: 44,
  },
  check: {
    width: 18,
    height: 18,
    borderRadius: 4,
    borderWidth: 1,
    borderColor: colors.textFaint,
  },
  checkOn: {
    backgroundColor: colors.amber,
    borderColor: colors.amber,
  },
  noticeText: {
    marginTop: 8,
  },
  aboutLink: {
    minHeight: 44,
    justifyContent: 'center',
  },
  leave: {
    minHeight: 48,
    alignItems: 'center',
    justifyContent: 'center',
    marginTop: 8,
  },
  leaveLabel: {
    color: colors.danger,
  },
});
