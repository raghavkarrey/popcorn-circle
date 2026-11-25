export const GROUP_CODE_LENGTH = 6;
export const GROUP_NAME_MAX = 24;
export const GROUP_NOTE_MAX = 280;
export const GROUP_MEMBER_MAX = 24;
export const GROUP_CODE_ALPHABET = 'ABCDEFGHJKLMNPQRSTUVWXYZ23456789';
export const REVIEWER_CODE = 'APLREV';

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

type StoredMember = GroupMember & { token: string; blockedIds?: string[] };

type StoredGroup = {
  code: string;
  createdAt: number;
  members: StoredMember[];
  ratings: GroupRating[];
};

export type ContentReport = {
  id: string;
  code: string;
  reporterId: string;
  targetMemberId: string;
  targetName: string;
  movieId: string;
  title: string;
  noteExcerpt: string;
  createdAt: number;
  status: 'open' | 'removed';
};

export type GroupDatabase = {
  groups: StoredGroup[];
  reports: ContentReport[];
};

export type GroupView = {
  group: GroupRecord;
  blockedMemberIds: string[];
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

const BANNED_LANGUAGE = new Set([
  'fuck',
  'fucking',
  'fucker',
  'motherfucker',
  'shit',
  'shitting',
  'bullshit',
  'bitch',
  'bastard',
  'asshole',
  'dick',
  'dickhead',
  'cock',
  'cunt',
  'pussy',
  'whore',
  'slut',
  'piss',
  'wanker',
  'twat',
  'nigger',
  'nigga',
  'faggot',
  'fag',
  'dyke',
  'tranny',
  'retard',
  'retarded',
  'spic',
  'kike',
  'chink',
  'gook',
  'wetback',
]);

function languageCandidates(input: string): string[] {
  const tokens = input
    .toLowerCase()
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    .replace(/[@4]/g, 'a')
    .replace(/3/g, 'e')
    .replace(/[1!|]/g, 'i')
    .replace(/0/g, 'o')
    .replace(/[5$]/g, 's')
    .replace(/7/g, 't')
    .replace(/[^a-z]+/g, ' ')
    .trim()
    .split(' ')
    .filter(Boolean);
  const found = [...tokens];
  for (let index = 0; index < tokens.length - 1; index += 1) {
    found.push(`${tokens[index]} ${tokens[index + 1]}`);
  }
  let run = '';
  for (const token of [...tokens, '']) {
    if (token.length === 1) run += token;
    else {
      if (run.length >= 3) found.push(run);
      run = '';
    }
  }
  return found;
}

export function containsObjectionableLanguage(input: string): boolean {
  return languageCandidates(input).some((token) => BANNED_LANGUAGE.has(token));
}

export function languageError(input: string, field: 'name' | 'note'): string | null {
  if (!containsObjectionableLanguage(input)) return null;
  if (field === 'name') return "That name isn't allowed in a group. Please pick another.";
  return "That note isn't allowed in a group. Take out the offensive language and try again.";
}

function requireName(input: string): string {
  const name = normalizeDisplayName(input);
  if (!name) throw new GroupError('Enter a name.');
  const blocked = languageError(name, 'name');
  if (blocked) throw new GroupError(blocked);
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
    ...db,
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
    blockedIds: [],
  };
  const group: StoredGroup = { code, createdAt: now, members: [member], ratings: [] };
  return {
    db: { ...db, groups: [...db.groups, group] },
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
    blockedIds: [],
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
  const note = normalizeNote(input.movie.note ?? '');
  const noteError = languageError(note, 'note');
  if (noteError) throw new GroupError(noteError);
  const rating: GroupRating = {
    memberId: member.id,
    movieId,
    title,
    year,
    overview: (input.movie.overview ?? '').trim().slice(0, 500),
    posterUrl: typeof input.movie.posterUrl === 'string' && input.movie.posterUrl.trim() ? input.movie.posterUrl : null,
    stars: input.movie.stars,
    note,
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

function blockedIdsFor(member: StoredMember): string[] {
  return member.blockedIds ?? [];
}

export function viewGroup(
  db: GroupDatabase,
  input: { code: string; memberId?: string; token?: string },
): GroupView {
  const group = findGroup(db, requireCode(input.code));
  const memberId = input.memberId?.trim() ?? '';
  const token = input.token?.trim() ?? '';
  if (!memberId && !token) return { group: publicGroup(group), blockedMemberIds: [] };
  const member = assertMember(group, memberId, token);
  const blockedMemberIds = blockedIdsFor(member);
  const hidden = new Set(blockedMemberIds);
  return {
    group: {
      ...publicGroup(group),
      ratings: group.ratings.filter((rating) => !hidden.has(rating.memberId)).map((rating) => ({ ...rating })),
    },
    blockedMemberIds,
  };
}

export function blockMember(
  db: GroupDatabase,
  input: { code: string; memberId: string; token: string; blockedMemberId: string },
): { db: GroupDatabase; view: GroupView } {
  const group = findGroup(db, requireCode(input.code));
  const member = assertMember(group, input.memberId, input.token);
  const blockedMemberId = input.blockedMemberId.trim();
  if (!blockedMemberId || blockedMemberId === member.id) {
    throw new GroupError('You can only block another member of the group.');
  }
  if (!group.members.some((item) => item.id === blockedMemberId)) {
    throw new GroupError('That person is not in this group.', 404);
  }
  const blockedIds = [...new Set([...blockedIdsFor(member), blockedMemberId])];
  const next: StoredGroup = {
    ...group,
    members: group.members.map((item) => (item.id === member.id ? { ...item, blockedIds } : item)),
  };
  const updated = replaceGroup(db, next);
  return { db: updated, view: viewGroup(updated, { code: next.code, memberId: member.id, token: member.token }) };
}

export function unblockMember(
  db: GroupDatabase,
  input: { code: string; memberId: string; token: string; blockedMemberId: string },
): { db: GroupDatabase; view: GroupView } {
  const group = findGroup(db, requireCode(input.code));
  const member = assertMember(group, input.memberId, input.token);
  const blockedIds = blockedIdsFor(member).filter((id) => id !== input.blockedMemberId);
  const next: StoredGroup = {
    ...group,
    members: group.members.map((item) => (item.id === member.id ? { ...item, blockedIds } : item)),
  };
  const updated = replaceGroup(db, next);
  return { db: updated, view: viewGroup(updated, { code: next.code, memberId: member.id, token: member.token }) };
}

export function reportRating(
  db: GroupDatabase,
  input: { code: string; memberId: string; token: string; targetMemberId: string; movieId: string; now?: number; random?: () => number },
): { db: GroupDatabase; report: ContentReport } {
  const group = findGroup(db, requireCode(input.code));
  const reporter = assertMember(group, input.memberId, input.token);
  const targetMemberId = input.targetMemberId.trim();
  const movieId = input.movieId.trim();
  if (!targetMemberId || targetMemberId === reporter.id) {
    throw new GroupError('You can report another member’s shared note.');
  }
  const rating = group.ratings.find((item) => item.memberId === targetMemberId && item.movieId === movieId);
  if (!rating) throw new GroupError('That shared rating is no longer there.', 404);
  const target = group.members.find((item) => item.id === targetMemberId);
  const now = input.now ?? Date.now();
  const random = input.random ?? Math.random;
  const report: ContentReport = {
    id: `r_${randomId(random, 10)}`,
    code: group.code,
    reporterId: reporter.id,
    targetMemberId,
    targetName: target?.name ?? 'Someone',
    movieId,
    title: rating.title,
    noteExcerpt: rating.note.slice(0, 80),
    createdAt: now,
    status: 'open',
  };
  return { db: { ...db, reports: [...(db.reports ?? []), report] }, report };
}

export function listReports(db: GroupDatabase): ContentReport[] {
  return [...(db.reports ?? [])].sort((a, b) => b.createdAt - a.createdAt);
}

export function adminRemoveRating(
  db: GroupDatabase,
  input: { code: string; memberId: string; movieId: string },
): { db: GroupDatabase; removed: number } {
  const group = findGroup(db, requireCode(input.code));
  const before = group.ratings.length;
  const next: StoredGroup = {
    ...group,
    ratings: group.ratings.filter((item) => !(item.memberId === input.memberId && item.movieId === input.movieId)),
  };
  const removed = before - next.ratings.length;
  const reports = (db.reports ?? []).map((report) =>
    report.code === next.code && report.targetMemberId === input.memberId && report.movieId === input.movieId
      ? { ...report, status: 'removed' as const }
      : report,
  );
  return { db: { ...replaceGroup(db, next), reports }, removed };
}

export function ensureReviewGroup(db: GroupDatabase, now = Date.UTC(2026, 10, 25)): GroupDatabase {
  if (db.groups.some((group) => group.code === REVIEWER_CODE)) return db;
  const members: StoredMember[] = [
    { id: 'm_review_alex', name: 'Alex', token: 'review-alex-not-for-clients-token', joinedAt: now, blockedIds: [] },
    { id: 'm_review_sam', name: 'Sam', token: 'review-sam-not-for-clients-token', joinedAt: now + 1, blockedIds: [] },
    { id: 'm_review_jordan', name: 'Jordan', token: 'review-jordan-not-for-clients-token', joinedAt: now + 2, blockedIds: [] },
  ];
  const ratings: GroupRating[] = [
    {
      memberId: 'm_review_alex',
      movieId: 'shelf-inception',
      title: 'Inception',
      year: '2010',
      overview: 'A thief is hired to plant an idea so deep it feels like it was always yours.',
      posterUrl: 'https://image.tmdb.org/t/p/w342/oYuLEt3zVCKq57qu2F8dT7NIa6f.jpg',
      stars: 5,
      note: 'A film I keep coming back to.',
      updatedAt: now + 3,
    },
    {
      memberId: 'm_review_sam',
      movieId: 'shelf-spirited-away',
      title: 'Spirited Away',
      year: '2001',
      overview: 'Chihiro takes a job in a spirit bathhouse and has to remember her own name to get home.',
      posterUrl: 'https://image.tmdb.org/t/p/w342/39wmItIWsg5sZMyRUHLkWBcuVCM.jpg',
      stars: 5,
      note: 'Quiet, strange, and kind.',
      updatedAt: now + 4,
    },
    {
      memberId: 'm_review_jordan',
      movieId: 'shelf-parasite',
      title: 'Parasite',
      year: '2019',
      overview: 'One family folds itself into a richer one, until the house runs out of places to hide.',
      posterUrl: 'https://image.tmdb.org/t/p/w342/7IiTTgloJzvGI1TAYymCfbfl3vT.jpg',
      stars: 4.5,
      note: 'The house does all the talking.',
      updatedAt: now + 5,
    },
  ];
  const group: StoredGroup = { code: REVIEWER_CODE, createdAt: now, members, ratings };
  return { ...db, groups: [...db.groups, group] };
}

export function emptyGroupDatabase(): GroupDatabase {
  return { groups: [], reports: [] };
}
