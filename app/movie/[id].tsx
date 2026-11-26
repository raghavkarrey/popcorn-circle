import { router, useLocalSearchParams } from 'expo-router';
import { useEffect, useMemo, useState } from 'react';
import {
  KeyboardAvoidingView,
  Platform,
  Pressable,
  ScrollView,
  StyleSheet,
  TextInput,
  View,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';

import { AppText, useFontsReady } from '@/components/AppText';
import { ChevronLeftIcon } from '@/components/Icons';
import { Poster } from '@/components/Poster';
import { PosterTile } from '@/components/PosterTile';
import { PrimaryButton } from '@/components/PrimaryButton';
import { ConfirmDialog } from '@/components/ConfirmDialog';
import { StarPicker, Stars } from '@/components/Stars';
import { useScreenMode } from '@/components/useScreenMode';
import { colors, fonts } from '@/constants/theme';
import { useGroup } from '@/context/GroupProvider';
import { useRatings } from '@/context/RatingsProvider';
import { ratingsForMovie } from '@/lib/groups';
import { pageTitleSize } from '@/lib/layout';
import { rememberMovie } from '@/lib/movie-memory';
import { resolveMovie } from '@/lib/movies';
import { findRatingForMovie, formatStars, MAX_NOTE_LENGTH } from '@/lib/ratings';
import { fetchTmdbRelated, largerPoster, readTmdbApiKey, tmdbNumericId, usesTmdbProxy } from '@/lib/tmdb';
import type { Movie } from '@/lib/types';

export default function MovieScreen() {
  const fontsReady = useFontsReady();
  const mode = useScreenMode();
  const desktop = mode === 'desktop';
  const [related, setRelated] = useState<Movie[]>([]);
  const params = useLocalSearchParams<{ id: string }>();
  const id = typeof params.id === 'string' ? params.id : params.id?.[0] ?? '';
  const { ratings, ready, rate, remove } = useRatings();
  const { membership, group, publish, unpublish } = useGroup();
  const movie = useMemo(() => resolveMovie(id, ratings), [id, ratings]);
  const existing = movie ? findRatingForMovie(ratings, movie) : undefined;
  const shared = movie && group ? ratingsForMovie(group, movie) : [];

  const [stars, setStars] = useState(0);
  const [note, setNote] = useState('');
  const [hydrated, setHydrated] = useState(false);
  const [noteFocused, setNoteFocused] = useState(false);
  const [saving, setSaving] = useState(false);
  const [formError, setFormError] = useState<string | null>(null);
  const [confirming, setConfirming] = useState(false);

  useEffect(() => {
    if (!desktop || !movie) {
      setRelated([]);
      return;
    }
    const numericId = tmdbNumericId(movie.id);
    const key = readTmdbApiKey();
    const proxy = usesTmdbProxy();
    if (!numericId || (!key && !proxy)) {
      setRelated([]);
      return;
    }
    let cancelled = false;
    void fetchTmdbRelated(numericId, key ?? '', fetch, { proxy })
      .then((movies) => {
        if (!cancelled) setRelated(movies.slice(0, 8));
      })
      .catch(() => {
        if (!cancelled) setRelated([]);
      });
    return () => {
      cancelled = true;
    };
  }, [desktop, movie]);

  useEffect(() => {
    if (!ready || hydrated) return;
    if (existing) {
      setStars(existing.stars);
      setNote(existing.note);
    }
    setHydrated(true);
  }, [ready, hydrated, existing]);

  function goBack() {
    if (router.canGoBack()) router.back();
    else router.replace('/');
  }

  async function onSave() {
    if (!movie || stars <= 0 || saving) return;
    setSaving(true);
    setFormError(null);
    try {
      const saved = await rate({ movie, stars, note });
      if (membership) {
        try {
          await publish(saved);
        } catch (error) {
          setFormError(
            error instanceof Error
              ? `Saved on this phone, but the group didn't get it. ${error.message}`
              : "Saved on this phone, but the group didn't get it.",
          );
          setSaving(false);
          return;
        }
      }
      goBack();
    } catch (error) {
      setFormError(error instanceof Error ? error.message : 'Could not save this rating.');
      setSaving(false);
    }
  }

  async function onRemove() {
    if (!existing) return;
    setConfirming(false);
    try {
      await remove(existing.movieId);
      if (membership && movie) {
        try {
          await unpublish({ id: existing.movieId, title: movie.title, year: movie.year });
        } catch (error) {
          setFormError(
            error instanceof Error
              ? `Removed on this phone, but it's still in the group. ${error.message}`
              : "Removed on this phone, but it's still in the group.",
          );
          return;
        }
      }
      goBack();
    } catch (error) {
      setFormError(error instanceof Error ? error.message : 'Could not remove this rating.');
    }
  }

  return (
    <SafeAreaView style={styles.safe} edges={['top', 'bottom']} testID="screen-movie">
      <KeyboardAvoidingView style={styles.flex} behavior={Platform.OS === 'ios' ? 'padding' : undefined}>
        <ScrollView contentContainerStyle={styles.content} keyboardShouldPersistTaps="handled">
          <Pressable accessibilityRole="button" accessibilityLabel="Go back" onPress={goBack} style={styles.back} hitSlop={8}>
            <ChevronLeftIcon color={colors.text} />
            <AppText variant="body">Back</AppText>
          </Pressable>

          {!movie && ready ? (
            <View style={styles.missing}>
              <AppText variant="display" style={styles.missingTitle}>
                That title isn’t here
              </AppText>
              <AppText variant="muted" style={styles.missingBody}>
                It may have been a search result that wasn’t saved. Anything you already rated is still in My Ratings.
              </AppText>
              <PrimaryButton label="Back to search" onPress={() => router.replace('/')} />
            </View>
          ) : null}

          {movie ? (
            <View style={desktop ? styles.split : undefined}>
              <View style={desktop ? styles.posterCol : styles.posterWrap}>
                <Poster
                  uri={largerPoster(movie.posterUrl)}
                  title={movie.title}
                  width={desktop ? 300 : 180}
                  height={desktop ? 450 : 270}
                  radius={16}
                />
              </View>
              <View style={desktop ? styles.infoCol : undefined}>
              <AppText variant="display" style={[styles.movieTitle, pageTitleSize(mode)]}>
                {movie.title}
              </AppText>
              <AppText variant="meta" style={styles.year}>
                {movie.year}
              </AppText>
              <AppText variant="muted" style={styles.overview}>
                {movie.overview}
              </AppText>

              <AppText variant="eyebrow" style={styles.section}>
                Your rating
              </AppText>
              <View style={styles.ratingRow}>
                <StarPicker value={stars} onChange={setStars} />
                <AppText variant="score" style={styles.score}>
                  {stars ? formatStars(stars) : '–'}
                </AppText>
              </View>
              <AppText variant="meta">Tap the left half of a star for a half.</AppText>

              <AppText variant="eyebrow" style={styles.section}>
                Note
              </AppText>
              <TextInput
                value={note}
                onChangeText={(text) => setNote(text.slice(0, MAX_NOTE_LENGTH))}
                onFocus={() => setNoteFocused(true)}
                onBlur={() => setNoteFocused(false)}
                placeholder="A line for later. A scene, a performance, a mood."
                placeholderTextColor={colors.textFaint}
                accessibilityLabel="Review note"
                testID="note-input"
                multiline
                maxLength={MAX_NOTE_LENGTH}
                textAlignVertical="top"
                style={[
                  styles.note,
                  noteFocused && styles.noteFocused,
                  fontsReady ? { fontFamily: fonts.body } : null,
                ]}
              />
              {noteFocused || note.length > 0 ? (
                <AppText variant="meta" style={styles.count}>
                  {note.length}/{MAX_NOTE_LENGTH}
                </AppText>
              ) : null}

              {formError ? (
                <AppText variant="muted" style={styles.error}>
                  {formError}
                </AppText>
              ) : null}

              <View style={styles.save}>
                <PrimaryButton
                  label={saving ? 'Saving…' : existing ? 'Update rating' : 'Save rating'}
                  onPress={() => void onSave()}
                  disabled={stars <= 0 || saving || !ready}
                  testID="save-rating"
                />
              </View>

              {membership ? (
                <AppText variant="meta" style={styles.shareHint}>
                  Saving also shares this with group {membership.code}.
                </AppText>
              ) : null}

              {existing ? (
                <Pressable
                  accessibilityRole="button"
                  accessibilityLabel="Remove rating"
                  testID="remove-rating"
                  onPress={() => setConfirming(true)}
                  style={styles.remove}
                >
                  <AppText variant="body" style={styles.removeLabel}>
                    Remove from log
                  </AppText>
                </Pressable>
              ) : null}

              {desktop && related.length > 0 ? (
                <>
                  <AppText variant="eyebrow" style={styles.section}>More like this</AppText>
                  <View style={styles.related}>
                    {related.map((item) => (
                      <View key={item.id} style={styles.relatedItem}>
                        <PosterTile
                          movie={item}
                          onPress={() => {
                            rememberMovie(item);
                            router.push({ pathname: '/movie/[id]', params: { id: item.id } });
                          }}
                        />
                      </View>
                    ))}
                  </View>
                  <AppText variant="meta">Suggestions from TMDB. This app is not endorsed or certified by TMDB.</AppText>
                </>
              ) : null}

              <AppText variant="eyebrow" style={styles.section}>
                In the group
              </AppText>
              {!membership ? (
                <AppText variant="muted">
                  This rating stays on this phone. Open Group when you want friends to see it.
                </AppText>
              ) : shared.length === 0 ? (
                <AppText variant="muted">Nobody in {membership.code} has rated this yet.</AppText>
              ) : (
                <View testID="group-movie-ratings" style={styles.sharedList}>
                  {shared.map((item) => {
                    const mine = item.memberId === membership.memberId;
                    return (
                      <View key={`${item.memberId}-${item.movieId}`} style={styles.sharedCard} testID={`friend-rating-${item.memberId}`}>
                        <View style={styles.sharedHead}>
                          <AppText variant="title">{mine ? `${item.memberName} (you)` : item.memberName}</AppText>
                          <AppText variant="meta" style={styles.sharedScore}>
                            {formatStars(item.stars)}
                          </AppText>
                        </View>
                        <Stars value={item.stars} size={14} />
                        {item.note ? (
                          <AppText variant="muted" style={styles.sharedNote}>
                            {item.note}
                          </AppText>
                        ) : null}
                      </View>
                    );
                  })}
                </View>
              )}
              </View>
            </View>
          ) : null}
        </ScrollView>
      </KeyboardAvoidingView>
      <ConfirmDialog
        visible={confirming}
        title="Remove this rating?"
        body={
          movie
            ? membership
              ? `${movie.title} leaves this phone, and your copy in the group goes with it.`
              : `${movie.title} leaves the log, and the note goes with it.`
            : ''
        }
        confirmLabel="Remove"
        onCancel={() => setConfirming(false)}
        onConfirm={() => void onRemove()}
      />
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  safe: {
    flex: 1,
    backgroundColor: colors.bg,
  },
  flex: {
    flex: 1,
  },
  content: {
    paddingHorizontal: 20,
    paddingBottom: 32,
  },
  back: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
    minHeight: 44,
    alignSelf: 'flex-start',
    marginLeft: -6,
  },
  posterWrap: {
    alignItems: 'center',
    marginTop: 8,
  },
  split: {
    flexDirection: 'row',
    alignItems: 'flex-start',
    gap: 36,
    marginTop: 8,
    width: '100%',
  },
  posterCol: {
    width: 300,
  },
  infoCol: {
    flex: 1,
    minWidth: 320,
    maxWidth: 720,
  },
  related: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    marginHorizontal: -8,
  },
  relatedItem: {
    width: '25%',
    padding: 8,
  },
  movieTitle: {
    marginTop: 18,
    fontSize: 32,
    lineHeight: 36,
  },
  year: {
    marginTop: 6,
  },
  overview: {
    marginTop: 14,
  },
  section: {
    marginTop: 26,
    marginBottom: 10,
  },
  ratingRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
  },
  score: {
    width: 52,
    textAlign: 'right',
  },
  note: {
    minHeight: 110,
    borderRadius: 14,
    borderWidth: 1,
    borderColor: colors.line,
    backgroundColor: colors.input,
    color: colors.text,
    fontSize: 16,
    lineHeight: 22,
    paddingHorizontal: 14,
    paddingVertical: 12,
  },
  noteFocused: {
    borderColor: colors.amber,
  },
  count: {
    marginTop: 6,
    textAlign: 'right',
  },
  error: {
    marginTop: 12,
    color: colors.danger,
  },
  save: {
    marginTop: 18,
  },
  shareHint: {
    marginTop: 8,
  },
  sharedList: {
    gap: 10,
  },
  sharedCard: {
    borderRadius: 14,
    borderWidth: 1,
    borderColor: colors.line,
    backgroundColor: colors.surface,
    padding: 12,
    gap: 6,
  },
  sharedHead: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    gap: 8,
  },
  sharedScore: {
    color: colors.amber,
  },
  sharedNote: {
    marginTop: 2,
  },
  remove: {
    minHeight: 48,
    alignItems: 'center',
    justifyContent: 'center',
    marginTop: 8,
  },
  removeLabel: {
    color: colors.danger,
  },
  missing: {
    marginTop: 28,
    gap: 12,
  },
  missingTitle: {
    fontSize: 32,
    lineHeight: 36,
  },
  missingBody: {
    marginBottom: 8,
  },
});
