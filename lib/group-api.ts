import type { GroupMembership, GroupMovieInput, GroupRecord, GroupSessionResult } from '@/lib/groups';

export class GroupApiError extends Error {
  constructor(message: string) {
    super(message);
    this.name = 'GroupApiError';
  }
}

const API_KEY = 'EXPO_PUBLIC_GROUP_API_URL';

export function groupApiBase(env: Record<string, string | undefined> = process.env): string {
  const value = env[API_KEY];
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
    throw new GroupApiError(`Couldn't reach the group server at ${base}. Start it with npm run circle.`);
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

export async function fetchRemoteGroup(code: string): Promise<GroupRecord> {
  const payload = await request<{ group: GroupRecord }>(`/v1/groups/${encodeURIComponent(code)}`);
  return payload.group;
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

export async function leaveRemoteGroup(membership: GroupMembership): Promise<GroupRecord> {
  const payload = await request<{ group: GroupRecord }>(`/v1/groups/${encodeURIComponent(membership.code)}/leave`, {
    memberId: membership.memberId,
    token: membership.token,
  });
  return payload.group;
}
