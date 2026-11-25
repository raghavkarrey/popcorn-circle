import { createContext, useCallback, useContext, useEffect, useMemo, useRef, useState, type ReactNode } from 'react';
import { AppState, Platform } from 'react-native';
import AsyncStorage from '@react-native-async-storage/async-storage';

import {
  createRemoteGroup,
  fetchRemoteGroup,
  groupApiBase,
  GroupApiError,
  joinRemoteGroup,
  leaveRemoteGroup,
  publishRemoteRating,
  removeRemoteRating,
} from '@/lib/group-api';
import type { GroupMembership, GroupRecord } from '@/lib/groups';
import { createGroupSessionRepository, emptyGroupSession, type GroupSession } from '@/lib/group-session';
import type { KeyValueStore } from '@/lib/ratings';
import type { Rating } from '@/lib/types';

const webSessionStore: KeyValueStore = {
  async getItem(key) {
    if (typeof sessionStorage === 'undefined') return null;
    return sessionStorage.getItem(key);
  },
  async setItem(key, value) {
    sessionStorage.setItem(key, value);
  },
  async removeItem(key) {
    sessionStorage.removeItem(key);
  },
};

// On the web, each tab keeps its own name and membership so two tabs can be two people.
// Phones keep it in AsyncStorage, one person per device. Personal ratings always stay in AsyncStorage.
const sessionRepository = createGroupSessionRepository(Platform.OS === 'web' ? webSessionStore : AsyncStorage);
const POLL_MS = 2500;

type GroupContextValue = {
  ready: boolean;
  displayName: string;
  setDisplayName: (name: string) => void;
  membership: GroupMembership | null;
  group: GroupRecord | null;
  syncError: string | null;
  apiBase: string;
  createGroup: () => Promise<void>;
  joinGroup: (code: string) => Promise<void>;
  leaveGroup: () => Promise<void>;
  publish: (rating: Rating) => Promise<void>;
  unpublish: (movie: { id: string; title: string; year: string }) => Promise<void>;
  refresh: () => Promise<void>;
};

const GroupContext = createContext<GroupContextValue | null>(null);

export function GroupProvider({ children }: { children: ReactNode }) {
  const [session, setSession] = useState<GroupSession>(emptyGroupSession);
  const [group, setGroup] = useState<GroupRecord | null>(null);
  const [ready, setReady] = useState(false);
  const [syncError, setSyncError] = useState<string | null>(null);
  const sessionRef = useRef(session);
  sessionRef.current = session;

  const persist = useCallback(async (next: GroupSession) => {
    sessionRef.current = next;
    setSession(next);
    await sessionRepository.save(next);
  }, []);

  const refresh = useCallback(async () => {
    const membership = sessionRef.current.membership;
    if (!membership) {
      setGroup(null);
      setSyncError(null);
      return;
    }
    try {
      const next = await fetchRemoteGroup(membership.code);
      if (sessionRef.current.membership?.code !== membership.code) return;
      setGroup(next);
      setSyncError(null);
    } catch (error) {
      if (sessionRef.current.membership?.code !== membership.code) return;
      const message = error instanceof Error ? error.message : 'Could not refresh the group.';
      if (error instanceof GroupApiError && message.includes("doesn't match")) {
        await persist({ ...sessionRef.current, membership: null });
        setGroup(null);
      }
      setSyncError(message);
    }
  }, [persist]);

  useEffect(() => {
    let cancelled = false;
    void sessionRepository.load().then(async (loaded) => {
      if (cancelled) return;
      sessionRef.current = loaded;
      setSession(loaded);
      setReady(true);
      if (loaded.membership) await refresh();
    });
    return () => {
      cancelled = true;
    };
  }, [refresh]);

  useEffect(() => {
    if (!session.membership) return undefined;
    const timer = setInterval(() => {
      void refresh();
    }, POLL_MS);
    const appState = AppState.addEventListener('change', (state) => {
      if (state === 'active') void refresh();
    });
    const onVisible = () => {
      if (document.visibilityState === 'visible') void refresh();
    };
    if (Platform.OS === 'web' && typeof document !== 'undefined') {
      document.addEventListener('visibilitychange', onVisible);
    }
    return () => {
      clearInterval(timer);
      appState.remove();
      if (Platform.OS === 'web' && typeof document !== 'undefined') {
        document.removeEventListener('visibilitychange', onVisible);
      }
    };
  }, [session.membership, refresh]);

  const setDisplayName = useCallback(
    (name: string) => {
      const next = { ...sessionRef.current, displayName: name };
      void persist(next);
    },
    [persist],
  );

  const createGroup = useCallback(async () => {
    const result = await createRemoteGroup(sessionRef.current.displayName);
    await persist({ displayName: result.group.members.find((member) => member.id === result.membership.memberId)?.name ?? sessionRef.current.displayName, membership: result.membership });
    setGroup(result.group);
    setSyncError(null);
  }, [persist]);

  const joinGroup = useCallback(
    async (code: string) => {
      const result = await joinRemoteGroup(code, sessionRef.current.displayName);
      const name = result.group.members.find((member) => member.id === result.membership.memberId)?.name;
      await persist({
        displayName: name ?? sessionRef.current.displayName,
        membership: result.membership,
      });
      setGroup(result.group);
      setSyncError(null);
    },
    [persist],
  );

  const leaveGroup = useCallback(async () => {
    const membership = sessionRef.current.membership;
    if (!membership) return;
    await leaveRemoteGroup(membership);
    await persist({ ...sessionRef.current, membership: null });
    setGroup(null);
    setSyncError(null);
  }, [persist]);

  const publish = useCallback(async (rating: Rating) => {
    const membership = sessionRef.current.membership;
    if (!membership) return;
    const next = await publishRemoteRating(membership, {
      id: rating.movieId,
      title: rating.title,
      year: rating.year,
      overview: rating.overview,
      posterUrl: rating.posterUrl,
      stars: rating.stars,
      note: rating.note,
      updatedAt: rating.updatedAt,
    });
    setGroup(next);
    setSyncError(null);
  }, []);

  const unpublish = useCallback(async (movie: { id: string; title: string; year: string }) => {
    const membership = sessionRef.current.membership;
    if (!membership) return;
    const next = await removeRemoteRating(membership, movie);
    setGroup(next);
    setSyncError(null);
  }, []);

  const value = useMemo<GroupContextValue>(
    () => ({
      ready,
      displayName: session.displayName,
      setDisplayName,
      membership: session.membership,
      group,
      syncError,
      apiBase: groupApiBase(),
      createGroup,
      joinGroup,
      leaveGroup,
      publish,
      unpublish,
      refresh,
    }),
    [
      ready,
      session.displayName,
      session.membership,
      group,
      syncError,
      setDisplayName,
      createGroup,
      joinGroup,
      leaveGroup,
      publish,
      unpublish,
      refresh,
    ],
  );

  return <GroupContext.Provider value={value}>{children}</GroupContext.Provider>;
}

export function useGroup(): GroupContextValue {
  const value = useContext(GroupContext);
  if (!value) throw new Error('useGroup must be used within GroupProvider');
  return value;
}
