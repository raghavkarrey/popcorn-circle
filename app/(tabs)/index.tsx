import { router } from 'expo-router';
import { useEffect, useState } from 'react';
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
import { MovieCard } from '@/components/MovieCard';
import { colors, fonts } from '@/constants/theme';
import { useRatings } from '@/context/RatingsProvider';
import { rememberMovie, rememberMovies } from '@/lib/movie-memory';
import { previewShelf, searchMovies } from '@/lib/movies';
import { findRatingForMovie } from '@/lib/ratings';
import { readTmdbApiKey } from '@/lib/tmdb';
import type { Movie, SearchResult } from '@/lib/types';

export default function SearchScreen() {
  const fontsReady = useFontsReady();
  const { ratings } = useRatings();
  const hasKey = Boolean(readTmdbApiKey());
  const [query, setQuery] = useState('');
  const [focused, setFocused] = useState(false);
  const [loading, setLoading] = useState(false);
  const [state, setState] = useState<SearchResult>(() => previewShelf(''));

  useEffect(() => {
    const trimmed = query.trim();
    const key = readTmdbApiKey();

    if (!trimmed || !key) {
      setLoading(false);
      setState(previewShelf(query));
      return;
    }

    let cancelled = false;
    setLoading(true);
    const timer = setTimeout(() => {
      void searchMovies(trimmed, { key }).then((result) => {
        if (cancelled) return;
        setState(result);
        setLoading(false);
      });
    }, 280);

    return () => {
      cancelled = true;
      clearTimeout(timer);
    };
  }, [query]);

  useEffect(() => {
    rememberMovies(state.movies);
  }, [state.movies]);

  function openMovie(movie: Movie) {
    rememberMovie(movie);
    router.push({ pathname: '/movie/[id]', params: { id: movie.id } });
  }

  const sectionTitle = loading ? 'Searching' : query.trim() ? 'Results' : 'On the shelf';

  return (
    <SafeAreaView style={styles.safe} edges={['top']} testID="screen-search">
      <FlatList
        data={loading ? [] : state.movies}
        extraData={ratings}
        keyExtractor={(movie) => movie.id}
        keyboardShouldPersistTaps="handled"
        keyboardDismissMode="on-drag"
        contentContainerStyle={styles.list}
        ListHeaderComponent={
          <View>
            <AppText variant="eyebrow">Aftercredits</AppText>
            <AppText variant="display" style={styles.title}>
              What did you watch?
            </AppText>
            <AppText variant="muted" style={styles.subtitle}>
              Raghav’s private log. Ratings stay on this phone.
            </AppText>

            <View style={[styles.field, focused && styles.fieldFocused]}>
              <TextInput
                value={query}
                onChangeText={setQuery}
                onFocus={() => setFocused(true)}
                onBlur={() => setFocused(false)}
                placeholder="Search by title"
                placeholderTextColor={colors.textFaint}
                accessibilityLabel="Search movies by title"
                testID="search-input"
                autoCapitalize="none"
                autoCorrect={false}
                returnKeyType="search"
                clearButtonMode="while-editing"
                style={[styles.input, fontsReady ? { fontFamily: fonts.body } : null]}
              />
              {query.length > 0 ? (
                <Pressable accessibilityRole="button" accessibilityLabel="Clear search" onPress={() => setQuery('')} hitSlop={8}>
                  <AppText variant="meta" style={styles.clear}>
                    Clear
                  </AppText>
                </Pressable>
              ) : null}
            </View>

            <AppText variant="meta" style={styles.source}>
              {hasKey ? 'Searching TMDB when you type.' : 'Searching the on-device shelf.'}
            </AppText>

            {state.notice ? (
              <View style={styles.notice}>
                <AppText variant="muted">{state.notice}</AppText>
              </View>
            ) : null}

            <View style={styles.section}>
              <AppText variant="eyebrow">{sectionTitle}</AppText>
              {loading ? <ActivityIndicator color={colors.amber} /> : (
                <AppText variant="meta">{state.movies.length}</AppText>
              )}
            </View>
          </View>
        }
        ListEmptyComponent={
          loading ? undefined : (
            <View style={styles.empty}>
              <AppText variant="title">No matches</AppText>
              <AppText variant="muted" style={styles.emptyBody}>
                {hasKey
                  ? 'Try another title, or a shorter piece of it.'
                  : 'Nothing on the shelf matches. Add a TMDB key to search the full catalog.'}
              </AppText>
            </View>
          )
        }
        ListFooterComponent={
          loading ? undefined : (
            <AppText variant="meta" style={styles.footer}>
              {state.source === 'tmdb'
                ? 'Results from TMDB. This app is not endorsed or certified by TMDB.'
                : 'These titles ship with the app, so it works with no account. Posters load from TMDB.'}
            </AppText>
          )
        }
        renderItem={({ item }) => (
          <View style={styles.item}>
            <MovieCard movie={item} rating={findRatingForMovie(ratings, item)} onPress={() => openMovie(item)} />
          </View>
        )}
      />
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  safe: {
    flex: 1,
    backgroundColor: colors.bg,
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
  field: {
    marginTop: 18,
    minHeight: 52,
    borderRadius: 14,
    borderWidth: 1,
    borderColor: colors.line,
    backgroundColor: colors.input,
    paddingHorizontal: 14,
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
  },
  fieldFocused: {
    borderColor: colors.amber,
  },
  input: {
    flex: 1,
    color: colors.text,
    fontSize: 16,
    paddingVertical: 14,
  },
  clear: {
    color: colors.amber,
  },
  source: {
    marginTop: 8,
  },
  notice: {
    marginTop: 12,
    padding: 12,
    borderRadius: 12,
    backgroundColor: colors.amberSoft,
  },
  section: {
    marginTop: 22,
    marginBottom: 12,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
  },
  item: {
    marginBottom: 10,
  },
  empty: {
    paddingVertical: 12,
  },
  emptyBody: {
    marginTop: 6,
  },
  footer: {
    marginTop: 8,
    marginBottom: 12,
  },
});
