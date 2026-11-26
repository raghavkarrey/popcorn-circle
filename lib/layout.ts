export type LayoutMode = 'phone' | 'tablet' | 'desktop';
export type LayoutPlatform = 'web' | 'native';

export const TABLET_MIN = 600;
export const DESKTOP_MIN = 900;
export const CONTENT_MAX = 1280;
export const SIDEBAR_WIDTH = 232;
export const FORM_MAX = 520;

export function layoutMode(width: number, platform: LayoutPlatform = 'web'): LayoutMode {
  if (platform !== 'web' || !Number.isFinite(width)) return 'phone';
  if (width >= DESKTOP_MIN) return 'desktop';
  if (width >= TABLET_MIN) return 'tablet';
  return 'phone';
}

export function posterColumns(width: number, platform: LayoutPlatform = 'web'): number {
  if (layoutMode(width, platform) !== 'desktop') return 1;
  if (width >= 1900) return 7;
  if (width >= 1600) return 6;
  if (width >= 1280) return 5;
  return 4;
}

export function cardColumns(width: number, platform: LayoutPlatform = 'web'): number {
  return layoutMode(width, platform) === 'desktop' ? 2 : 1;
}

export function pageTitleSize(mode: LayoutMode): { fontSize: number; lineHeight: number } | null {
  if (mode === 'desktop') return { fontSize: 48, lineHeight: 52 };
  if (mode === 'tablet') return { fontSize: 40, lineHeight: 44 };
  return null;
}

export function formMaxWidth(mode: LayoutMode): number | undefined {
  return mode === 'phone' ? undefined : FORM_MAX;
}

export function showsSidebar(mode: LayoutMode): boolean {
  return mode === 'desktop';
}
