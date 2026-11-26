import { router, usePathname } from 'expo-router';
import { Pressable, StyleSheet, View } from 'react-native';

import { AppText } from '@/components/AppText';
import { PeopleIcon, SearchIcon, SparkIcon, StarIcon } from '@/components/Icons';
import { colors } from '@/constants/theme';
import { useGroup } from '@/context/GroupProvider';
import { useRatings } from '@/context/RatingsProvider';
import { SIDEBAR_WIDTH } from '@/lib/layout';

const ITEMS = [
  { href: '/', label: 'Search', testID: 'nav-search', icon: SearchIcon },
  { href: '/for-you', label: 'For you', testID: 'nav-for-you', icon: SparkIcon },
  { href: '/ratings', label: 'My Ratings', testID: 'nav-ratings', icon: StarIcon },
  { href: '/group', label: 'Group', testID: 'nav-group', icon: PeopleIcon },
  { href: '/about', label: 'About', testID: 'nav-about', icon: null },
] as const;

function active(pathname: string, href: string): boolean {
  const path = pathname.replace(/\/app(?=\/|$)/, '') || '/';
  if (href === '/') return path === '/' || path === '';
  return path === href || path.startsWith(`${href}/`);
}

export function DesktopNav() {
  const pathname = usePathname();
  const { ratings } = useRatings();
  const { group } = useGroup();
  const badges: Record<string, number> = {
    '/ratings': ratings.length,
    '/group': group?.members.length ?? 0,
  };

  return (
    <View style={styles.bar} testID="desktop-nav">
      <AppText variant="eyebrow" style={styles.logo}>Popcorn Circle</AppText>
      {ITEMS.map((item) => {
        const selected = active(pathname, item.href);
        const badge = badges[item.href] ?? 0;
        const Icon = item.icon;
        return (
          <Pressable
            key={item.href}
            accessibilityRole="link"
            accessibilityState={{ selected }}
            testID={item.testID}
            onPress={() => router.push(item.href as '/')}
            style={({ hovered, pressed }) => [
              styles.item,
              selected && styles.itemOn,
              (hovered || pressed) && !selected && styles.itemHover,
            ]}
          >
            {Icon ? <Icon color={selected ? colors.amber : colors.textMuted} size={18} /> : <View style={styles.dot} />}
            <AppText variant="body" style={selected ? styles.labelOn : styles.label}>
              {item.label}
            </AppText>
            {badge > 0 ? (
              <View style={styles.badge}>
                <AppText variant="meta" style={styles.badgeText}>{badge}</AppText>
              </View>
            ) : null}
          </Pressable>
        );
      })}
    </View>
  );
}

const styles = StyleSheet.create({
  bar: {
    width: SIDEBAR_WIDTH,
    backgroundColor: '#101014',
    borderRightWidth: 1,
    borderRightColor: colors.line,
    paddingTop: 28,
    paddingHorizontal: 14,
    gap: 4,
  },
  logo: {
    marginBottom: 22,
    marginLeft: 12,
  },
  item: {
    minHeight: 44,
    borderRadius: 12,
    paddingHorizontal: 12,
    flexDirection: 'row',
    alignItems: 'center',
    gap: 10,
    cursor: 'pointer',
  },
  itemOn: {
    backgroundColor: colors.amberSoft,
  },
  itemHover: {
    backgroundColor: colors.surface,
  },
  label: {
    color: colors.textMuted,
    flex: 1,
  },
  labelOn: {
    color: colors.text,
    flex: 1,
  },
  dot: {
    width: 18,
  },
  badge: {
    minWidth: 22,
    height: 22,
    borderRadius: 11,
    backgroundColor: colors.amber,
    alignItems: 'center',
    justifyContent: 'center',
    paddingHorizontal: 6,
  },
  badgeText: {
    color: colors.amberInk,
    fontSize: 11,
  },
});
