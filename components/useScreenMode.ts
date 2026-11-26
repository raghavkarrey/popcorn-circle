import { useWindowDimensions, Platform } from 'react-native';

import { cardColumns, layoutMode, posterColumns, type LayoutMode } from '@/lib/layout';

export function useScreenMode(): LayoutMode {
  const { width } = useWindowDimensions();
  return layoutMode(width, Platform.OS === 'web' ? 'web' : 'native');
}

export function usePosterColumns(): number {
  const { width } = useWindowDimensions();
  return posterColumns(width, Platform.OS === 'web' ? 'web' : 'native');
}

export function useCardColumns(): number {
  const { width } = useWindowDimensions();
  return cardColumns(width, Platform.OS === 'web' ? 'web' : 'native');
}
