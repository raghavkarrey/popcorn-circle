import type { GroupMembership } from '@/lib/groups';
import type { KeyValueStore } from '@/lib/ratings';

export const GROUP_SESSION_KEY = 'aftercredits.group.v1';

export type GroupSession = {
  displayName: string;
  membership: GroupMembership | null;
};

export const emptyGroupSession = (): GroupSession => ({ displayName: '', membership: null });

export function parseGroupSession(raw: string | null): GroupSession {
  if (!raw) return emptyGroupSession();
  try {
    const parsed = JSON.parse(raw) as Partial<GroupSession>;
    const displayName = typeof parsed.displayName === 'string' ? parsed.displayName.slice(0, 24) : '';
    const membership = parsed.membership;
    if (
      !membership ||
      typeof membership.code !== 'string' ||
      typeof membership.memberId !== 'string' ||
      typeof membership.token !== 'string'
    ) {
      return { displayName, membership: null };
    }
    return {
      displayName,
      membership: {
        code: membership.code,
        memberId: membership.memberId,
        token: membership.token,
      },
    };
  } catch {
    return emptyGroupSession();
  }
}

export function createGroupSessionRepository(store: KeyValueStore, key = GROUP_SESSION_KEY) {
  return {
    async load(): Promise<GroupSession> {
      return parseGroupSession(await store.getItem(key));
    },
    async save(session: GroupSession): Promise<void> {
      await store.setItem(key, JSON.stringify(session));
    },
  };
}
