import { Tabs } from 'expo-router';
import type { ColorValue } from 'react-native';

import { useFontsReady } from '@/components/AppText';
import { SearchIcon, StarIcon } from '@/components/Icons';
import { colors, fonts } from '@/constants/theme';
import { useRatings } from '@/context/RatingsProvider';

function tint(color: ColorValue): string {
  return typeof color === 'string' ? color : colors.textFaint;
}

export default function TabLayout() {
  const fontsReady = useFontsReady();
  const { ratings } = useRatings();

  return (
    <Tabs
      screenOptions={{
        headerShown: false,
        tabBarActiveTintColor: colors.amber,
        tabBarInactiveTintColor: colors.textFaint,
        tabBarStyle: {
          backgroundColor: '#101014',
          borderTopColor: colors.line,
        },
        tabBarLabelStyle: {
          fontFamily: fontsReady ? fonts.medium : undefined,
          fontSize: 11,
          marginTop: 2,
        },
        sceneStyle: { backgroundColor: colors.bg },
      }}
    >
      <Tabs.Screen
        name="index"
        options={{
          title: 'Search',
          tabBarHideOnKeyboard: true,
          tabBarIcon: ({ color, size }) => <SearchIcon color={tint(color)} size={size} />,
        }}
      />
      <Tabs.Screen
        name="ratings"
        options={{
          title: 'My Ratings',
          tabBarBadge: ratings.length > 0 ? ratings.length : undefined,
          tabBarBadgeStyle: {
            backgroundColor: colors.amber,
            color: colors.amberInk,
            fontSize: 11,
          },
          tabBarIcon: ({ color, size }) => <StarIcon color={tint(color)} size={size - 2} />,
        }}
      />
    </Tabs>
  );
}
