export const GROUP_CODE_LENGTH = 6;
export const GROUP_NAME_MAX = 24;
export const GROUP_NOTE_MAX = 280;
export const GROUP_MEMBER_MAX = 24;
export const GROUP_CODE_ALPHABET = 'ABCDEFGHJKLMNPQRSTUVWXYZ23456789';

export class GroupError extends Error {
  readonly status: number;

  constructor(message: string, status = 400) {
    super(message);
    this.name = 'GroupError';
    this.status = status;
  }
}

export type GroupMember = {
  id: string;
  name: string;
  joinedAt: number;
};

export type GroupRating = {
  memberId: string;
  movieId: string;
  title: string;
  year: string;
  overview: string;
  posterUrl: string | null;
  stars: number;
  note: string;
  updatedAt: number;
};

export type GroupRecord = {
  code: string;
  createdAt: number;
  members: GroupMember[];
  ratings: GroupRating[];
};

export type GroupMembership = {
  code: string;
  memberId: string;
  token: string;
};

export type GroupSessionResult = {
  group: GroupRecord;
  membership: GroupMembership;
};

type StoredMember = GroupMember & { token: string };

type StoredGroup = {
  code: string;
  createdAt: number;
  members: StoredMember[];
  ratings: GroupRating[];
};

export type GroupDatabase = {
  groups: StoredGroup[];
};

export type GroupMovieInput = {
  id: string;
  title: string;
  year?: string;
  overview?: string;
  posterUrl?: string | null;
  stars: number;
  note?: string;
  updatedAt?: number;
};

const randomId = (random: () => number, size: number) => {
  let value = '';
  for (let index = 0; index < size; index += 1) {
    value += GROUP_CODE_ALPHABET[Math.floor(random() * GROUP_CODE_ALPHABET.length)];
  }
  return value;
};

export function normalizeGroupCode(input: string): string {
  return input
    .toUpperCase()
    .replace(/[^A-Z0-9]/g, '')
    .split('')
    .filter((character) => GROUP_CODE_ALPHABET.includes(character))
    .join('');
}

export function normalizeDisplayName(input: string): string {
  return input.trim().replace(/\s+/g, ' ').slice(0, GROUP_NAME_MAX);
}

function requireName(input: string): string {
  const name = normalizeDisplayName(input);
  if (!name) throw new GroupError('Enter a name.');
  return name;
}

function requireCode(input: string): string {
  const code = normalizeGroupCode(input);
  if (code.length !== GROUP_CODE_LENGTH) {
    throw new GroupError('Enter the 6-character join code.');
  }
  return code;
}

function isValidStars(stars: number): boolean {
  if (typeof stars !== 'number' || !Number.isFinite(stars)) return false;
  const steps = Math.round(stars * 2);
  if (Math.abs(stars * 2 - steps) > 1e-6) return false;
  return steps >= 1 && steps <= 10;
}

function normalizeNote(note: string): string {
  const trimmed = note.trim();
  return trimmed.length <= GROUP_NOTE_MAX ? trimmed : trimmed.slice(0, GROUP_NOTE_MAX);
}

function normalizeTitle(title: string): string {
  return title
    .toLowerCase()
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    .replace(/[^a-z0-9]+/g, ' ')
    .trim();
}

export function publicGroup(group: StoredGroup): GroupRecord {
  return {
    code: group.code,
    createdAt: group.createdAt,
    members: group.members.map(({ id, name, joinedAt }) => ({ id, name, joinedAt })),
    ratings: group.ratings.map((rating) => ({ ...rating })),
  };
}

function findGroup(db: GroupDatabase, code: string): StoredGroup {
  const group = db.groups.find((item) => item.code === code);
  if (!group) throw new GroupError("That code doesn't match a group.", 404);
  return group;
}

function replaceGroup(db: GroupDatabase, group: StoredGroup): GroupDatabase {
  return {
    groups: db.groups.map((item) => (item.code === group.code ? group : item)),
  };
}

function assertMember(group: StoredGroup, memberId: string, token: string): StoredMember {
  const member = group.members.find((item) => item.id === memberId);
  if (!member || member.token !== token) {
    throw new GroupError("That device isn't a member of this group.", 403);
  }
  return member;
}

function sameFilm(rating: GroupRating, movieId: string, title: string, year: string): boolean {
  if (rating.movieId === movieId) return true;
  return normalizeTitle(rating.title) === normalizeTitle(title) && rating.year === year;
}

export function createJoinCode(random: () => number = Math.random): string {
  return randomId(random, GROUP_CODE_LENGTH);
}

export function createGroup(
  db: GroupDatabase,
  input: { name: string; now?: number; random?: () => number },
): { db: GroupDatabase; result: GroupSessionResult } {
  const name = requireName(input.name);
  const now = input.now ?? Date.now();
  const random = input.random ?? Math.random;
  let code = '';
  for (let attempt = 0; attempt < 8; attempt += 1) {
    const next = createJoinCode(random);
    if (!db.groups.some((group) => group.code === next)) {
      code = next;
      break;
    }
  }
  if (!code) throw new GroupError('Could not make a join code. Try again.', 500);

  const member: StoredMember = {
    id: `m_${randomId(random, 8)}`,
    name,
    token: randomId(random, 24),
    joinedAt: now,
  };
  const group: StoredGroup = { code, createdAt: now, members: [member], ratings: [] };
  return {
    db: { groups: [...db.groups, group] },
    result: {
      group: publicGroup(group),
      membership: { code, memberId: member.id, token: member.token },
    },
  };
}

export function joinGroup(
  db: GroupDatabase,
  input: { code: string; name: string; now?: number; random?: () => number },
): { db: GroupDatabase; result: GroupSessionResult } {
  const code = requireCode(input.code);
  const name = requireName(input.name);
  const group = findGroup(db, code);
  if (group.members.length >= GROUP_MEMBER_MAX) {
    throw new GroupError('This group is full.', 409);
  }
  const now = input.now ?? Date.now();
  const random = input.random ?? Math.random;
  const member: StoredMember = {
    id: `m_${randomId(random, 8)}`,
    name,
    token: randomId(random, 24),
    joinedAt: now,
  };
  const next: StoredGroup = { ...group, members: [...group.members, member] };
  return {
    db: replaceGroup(db, next),
    result: {
      group: publicGroup(next),
      membership: { code, memberId: member.id, token: member.token },
    },
  };
}

export function renameMember(
  db: GroupDatabase,
  input: { code: string; memberId: string; token: string; name: string },
): { db: GroupDatabase; group: GroupRecord } {
  const group = findGroup(db, requireCode(input.code));
  const member = assertMember(group, input.memberId, input.token);
  const name = requireName(input.name);
  const next: StoredGroup = {
    ...group,
    members: group.members.map((item) => (item.id === member.id ? { ...item, name } : item)),
  };
  return { db: replaceGroup(db, next), group: publicGroup(next) };
}

export function upsertGroupRating(
  db: GroupDatabase,
  input: { code: string; memberId: string; token: string; movie: GroupMovieInput },
): { db: GroupDatabase; group: GroupRecord } {
  const group = findGroup(db, requireCode(input.code));
  const member = assertMember(group, input.memberId, input.token);
  const movieId = input.movie.id?.trim() ?? '';
  const title = input.movie.title?.trim() ?? '';
  if (!movieId || !title) throw new GroupError('A movie title is required.');
  if (!isValidStars(input.movie.stars)) {
    throw new GroupError('Choose a rating from half a star to five, in half-star steps.');
  }
  const year = input.movie.year?.trim() || '—';
  const rating: GroupRating = {
    memberId: member.id,
    movieId,
    title,
    year,
    overview: (input.movie.overview ?? '').trim().slice(0, 500),
    posterUrl: typeof input.movie.posterUrl === 'string' && input.movie.posterUrl.trim() ? input.movie.posterUrl : null,
    stars: input.movie.stars,
    note: normalizeNote(input.movie.note ?? ''),
    updatedAt: input.movie.updatedAt ?? Date.now(),
  };
  const ratings = group.ratings.filter(
    (item) => item.memberId !== member.id || !sameFilm(item, rating.movieId, rating.title, rating.year),
  );
  const next: StoredGroup = { ...group, ratings: [...ratings, rating] };
  return { db: replaceGroup(db, next), group: publicGroup(next) };
}

export function removeGroupRating(
  db: GroupDatabase,
  input: { code: string; memberId: string; token: string; movieId: string; title?: string; year?: string },
): { db: GroupDatabase; group: GroupRecord } {
  const group = findGroup(db, requireCode(input.code));
  const member = assertMember(group, input.memberId, input.token);
  const movieId = input.movieId.trim();
  const title = input.title?.trim() ?? '';
  const year = input.year?.trim() ?? '';
  const next: StoredGroup = {
    ...group,
    ratings: group.ratings.filter((item) => {
      if (item.memberId !== member.id) return true;
      if (item.movieId === movieId) return false;
      if (title && year && normalizeTitle(item.title) === normalizeTitle(title) && item.year === year) return false;
      return true;
    }),
  };
  return { db: replaceGroup(db, next), group: publicGroup(next) };
}

export function leaveGroup(
  db: GroupDatabase,
  input: { code: string; memberId: string; token: string },
): { db: GroupDatabase; group: GroupRecord } {
  const group = findGroup(db, requireCode(input.code));
  const member = assertMember(group, input.memberId, input.token);
  const next: StoredGroup = {
    ...group,
    members: group.members.filter((item) => item.id !== member.id),
    ratings: group.ratings.filter((item) => item.memberId !== member.id),
  };
  return { db: replaceGroup(db, next), group: publicGroup(next) };
}

export function readGroup(db: GroupDatabase, code: string): GroupRecord {
  return publicGroup(findGroup(db, requireCode(code)));
}

export type GroupFeedItem = GroupRating & { memberName: string };

export function groupFeed(group: GroupRecord): GroupFeedItem[] {
  return group.ratings
    .map((rating) => ({
      ...rating,
      memberName: group.members.find((member) => member.id === rating.memberId)?.name ?? 'Someone',
    }))
    .sort((a, b) => b.updatedAt - a.updatedAt || a.memberName.localeCompare(b.memberName));
}

export function ratingsForMovie(
  group: GroupRecord,
  movie: { id: string; title: string; year: string },
): GroupFeedItem[] {
  return groupFeed(group).filter(
    (rating) =>
      rating.movieId === movie.id ||
      (normalizeTitle(rating.title) === normalizeTitle(movie.title) && rating.year === movie.year),
  );
}

export function emptyGroupDatabase(): GroupDatabase {
  return { groups: [] };
}
