import type { GroupMembership, GroupMovieInput, GroupRecord, GroupSessionResult, GroupView } from '@/lib/groups';

export class GroupApiError extends Error {
  constructor(message: string) {
    super(message);
    this.name = 'GroupApiError';
  }
}

export function groupApiBase(env?: Record<string, string | undefined>): string {
  // Direct property reads so Expo can inline the public values for a native build.
  // The hosted website sets EXPO_PUBLIC_GROUP_API_SAME_ORIGIN and calls this origin.
  const sameOrigin = env === undefined ? process.env.EXPO_PUBLIC_GROUP_API_SAME_ORIGIN : env.EXPO_PUBLIC_GROUP_API_SAME_ORIGIN;
  if (sameOrigin === '1') return '';
  const value = env === undefined ? process.env.EXPO_PUBLIC_GROUP_API_URL : env.EXPO_PUBLIC_GROUP_API_URL;
  const trimmed = typeof value === 'string' ? value.trim().replace(/\/$/, '') : '';
  return trimmed || 'http://127.0.0.1:43124';
}

async function request<T>(path: string, body?: unknown): Promise<T> {
  const base = groupApiBase();
  let response: Response;
  try {
    response = await fetch(`${base}${path}`, {
      method: body === undefined ? 'GET' : 'POST',
      headers: body === undefined ? undefined : { 'Content-Type': 'application/json' },
      body: body === undefined ? undefined : JSON.stringify(body),
    });
  } catch {
    const where = base || 'this site';
    throw new GroupApiError(`Couldn't reach the group server at ${where}. Start it with npm run circle.`);
  }

  const payload = (await response.json().catch(() => null)) as { error?: string } | null;
  if (!response.ok) {
    throw new GroupApiError(payload?.error || 'The group server rejected that.');
  }
  return payload as T;
}

export function createRemoteGroup(name: string): Promise<GroupSessionResult> {
  return request('/v1/groups', { name });
}

export function joinRemoteGroup(code: string, name: string): Promise<GroupSessionResult> {
  return request('/v1/groups/join', { code, name });
}

export async function fetchRemoteGroup(code: string, membership: GroupMembership | null): Promise<GroupView> {
  const query = membership
    ? `?memberId=${encodeURIComponent(membership.memberId)}&token=${encodeURIComponent(membership.token)}`
    : '';
  return request<GroupView>(`/v1/groups/${encodeURIComponent(code)}${query}`);
}

export async function publishRemoteRating(membership: GroupMembership, movie: GroupMovieInput): Promise<GroupRecord> {
  const payload = await request<{ group: GroupRecord }>(`/v1/groups/${encodeURIComponent(membership.code)}/ratings`, {
    memberId: membership.memberId,
    token: membership.token,
    movie,
  });
  return payload.group;
}

export async function removeRemoteRating(
  membership: GroupMembership,
  movie: { id: string; title: string; year: string },
): Promise<GroupRecord> {
  const payload = await request<{ group: GroupRecord }>(
    `/v1/groups/${encodeURIComponent(membership.code)}/ratings-remove`,
    {
      memberId: membership.memberId,
      token: membership.token,
      movieId: movie.id,
      title: movie.title,
      year: movie.year,
    },
  );
  return payload.group;
}

export async function blockRemoteMember(membership: GroupMembership, blockedMemberId: string): Promise<GroupView> {
  return request<GroupView>(`/v1/groups/${encodeURIComponent(membership.code)}/block`, {
    memberId: membership.memberId,
    token: membership.token,
    blockedMemberId,
  });
}

export async function unblockRemoteMember(membership: GroupMembership, blockedMemberId: string): Promise<GroupView> {
  return request<GroupView>(`/v1/groups/${encodeURIComponent(membership.code)}/unblock`, {
    memberId: membership.memberId,
    token: membership.token,
    blockedMemberId,
  });
}

export async function reportRemoteRating(
  membership: GroupMembership,
  target: { memberId: string; movieId: string },
): Promise<void> {
  await request(`/v1/groups/${encodeURIComponent(membership.code)}/reports`, {
    memberId: membership.memberId,
    token: membership.token,
    targetMemberId: target.memberId,
    movieId: target.movieId,
  });
}

export async function leaveRemoteGroup(membership: GroupMembership): Promise<GroupRecord> {
  const payload = await request<{ group: GroupRecord }>(`/v1/groups/${encodeURIComponent(membership.code)}/leave`, {
    memberId: membership.memberId,
    token: membership.token,
  });
  return payload.group;
}
