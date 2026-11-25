export const SUPPORT_EMAIL = 'popcorncircleapp@gmail.com';

export function supportContact(env?: Record<string, string | undefined>): string {
  // A direct property read lets Expo inline EXPO_PUBLIC_SUPPORT_EMAIL.
  // Callers that pass an object, including tests, keep the dynamic lookup.
  const value = env === undefined ? process.env.EXPO_PUBLIC_SUPPORT_EMAIL : env.EXPO_PUBLIC_SUPPORT_EMAIL;
  const trimmed = typeof value === 'string' ? value.trim() : '';
  return trimmed || SUPPORT_EMAIL;
}
