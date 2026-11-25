const SUPPORT_KEY = 'EXPO_PUBLIC_SUPPORT_EMAIL';
export const SUPPORT_EMAIL_PLACEHOLDER = 'support@popcorncircle.com';

export function supportContact(env: Record<string, string | undefined> = process.env): {
  email: string;
  placeholder: boolean;
} {
  const value = env[SUPPORT_KEY];
  const trimmed = typeof value === 'string' ? value.trim() : '';
  if (!trimmed) return { email: SUPPORT_EMAIL_PLACEHOLDER, placeholder: true };
  return { email: trimmed, placeholder: false };
}
