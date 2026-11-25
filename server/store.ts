import { mkdir, readFile, rename, writeFile } from 'node:fs/promises';
import path from 'node:path';

import {
  adminRemoveRating,
  blockMember,
  createGroup,
  emptyGroupDatabase,
  ensureReviewGroup,
  joinGroup,
  leaveGroup,
  listReports,
  readGroup,
  removeGroupRating,
  renameMember,
  reportRating,
  unblockMember,
  upsertGroupRating,
  viewGroup,
  type ContentReport,
  type GroupDatabase,
  type GroupMembership,
  type GroupMovieInput,
  type GroupRecord,
  type GroupSessionResult,
  type GroupView,
} from '../lib/groups.ts';

export type GroupStore = {
  create(name: string): Promise<GroupSessionResult>;
  join(code: string, name: string): Promise<GroupSessionResult>;
  read(code: string): Promise<GroupRecord>;
  view(input: { code: string; memberId?: string; token?: string }): Promise<GroupView>;
  rename(input: { code: string; memberId: string; token: string; name: string }): Promise<GroupRecord>;
  rate(input: { code: string; memberId: string; token: string; movie: GroupMovieInput }): Promise<GroupRecord>;
  removeRating(input: {
    code: string;
    memberId: string;
    token: string;
    movieId: string;
    title?: string;
    year?: string;
  }): Promise<GroupRecord>;
  leave(input: GroupMembership): Promise<GroupRecord>;
  block(input: { code: string; memberId: string; token: string; blockedMemberId: string }): Promise<GroupView>;
  unblock(input: { code: string; memberId: string; token: string; blockedMemberId: string }): Promise<GroupView>;
  report(input: { code: string; memberId: string; token: string; targetMemberId: string; movieId: string }): Promise<ContentReport>;
  reports(): Promise<ContentReport[]>;
  adminRemove(input: { code: string; memberId: string; movieId: string }): Promise<number>;
  seed(): Promise<boolean>;
};

function asDatabase(value: GroupDatabase | undefined): GroupDatabase {
  return {
    groups: value?.groups ?? [],
    reports: value?.reports ?? [],
  };
}

export function createMemoryGroupStore(initial?: GroupDatabase): GroupStore {
  let db = asDatabase(initial ?? emptyGroupDatabase());
  let chain = Promise.resolve();

  function run<T>(fn: () => T): Promise<T> {
    const next = chain.then(fn);
    chain = next.then(
      () => undefined,
      () => undefined,
    );
    return next;
  }

  return {
    create(name) {
      return run(() => {
        const out = createGroup(db, { name });
        db = out.db;
        return out.result;
      });
    },
    join(code, name) {
      return run(() => {
        const out = joinGroup(db, { code, name });
        db = out.db;
        return out.result;
      });
    },
    read(code) {
      return run(() => readGroup(db, code));
    },
    view(input) {
      return run(() => viewGroup(db, input));
    },
    rename(input) {
      return run(() => {
        const out = renameMember(db, input);
        db = out.db;
        return out.group;
      });
    },
    rate(input) {
      return run(() => {
        const out = upsertGroupRating(db, input);
        db = out.db;
        return out.group;
      });
    },
    removeRating(input) {
      return run(() => {
        const out = removeGroupRating(db, input);
        db = out.db;
        return out.group;
      });
    },
    leave(input) {
      return run(() => {
        const out = leaveGroup(db, input);
        db = out.db;
        return out.group;
      });
    },
    block(input) {
      return run(() => {
        const out = blockMember(db, input);
        db = out.db;
        return out.view;
      });
    },
    unblock(input) {
      return run(() => {
        const out = unblockMember(db, input);
        db = out.db;
        return out.view;
      });
    },
    report(input) {
      return run(() => {
        const out = reportRating(db, input);
        db = out.db;
        return out.report;
      });
    },
    reports() {
      return run(() => listReports(db));
    },
    adminRemove(input) {
      return run(() => {
        const out = adminRemoveRating(db, input);
        db = out.db;
        return out.removed;
      });
    },
    seed() {
      return run(() => {
        const next = ensureReviewGroup(db);
        const changed = next !== db;
        db = next;
        return changed;
      });
    },
  };
}

export function createFileGroupStore(filePath: string): GroupStore {
  let chain = Promise.resolve();

  async function readDb(): Promise<GroupDatabase> {
    try {
      const raw = await readFile(filePath, 'utf8');
      const parsed = JSON.parse(raw) as GroupDatabase;
      if (!parsed || !Array.isArray(parsed.groups)) return emptyGroupDatabase();
      return asDatabase(parsed);
    } catch (error) {
      const missing = error && typeof error === 'object' && 'code' in error && error.code === 'ENOENT';
      if (!missing && error instanceof SyntaxError) {
        console.warn('Group file was unreadable. Starting with no groups.');
      }
      return emptyGroupDatabase();
    }
  }

  async function writeDb(db: GroupDatabase) {
    await mkdir(path.dirname(filePath), { recursive: true });
    const temp = `${filePath}.tmp`;
    await writeFile(temp, JSON.stringify(db));
    await rename(temp, filePath);
  }

  function run<T>(fn: (db: GroupDatabase) => { db: GroupDatabase; value: T; write?: boolean }): Promise<T> {
    const next = chain.then(async () => {
      const db = await readDb();
      const out = fn(db);
      if (out.write !== false) await writeDb(out.db);
      return out.value;
    });
    chain = next.then(
      () => undefined,
      () => undefined,
    );
    return next;
  }

  return {
    create(name) {
      return run((db) => {
        const out = createGroup(db, { name });
        return { db: out.db, value: out.result };
      });
    },
    join(code, name) {
      return run((db) => {
        const out = joinGroup(db, { code, name });
        return { db: out.db, value: out.result };
      });
    },
    read(code) {
      return run((db) => ({ db, value: readGroup(db, code), write: false }));
    },
    view(input) {
      return run((db) => ({ db, value: viewGroup(db, input), write: false }));
    },
    rename(input) {
      return run((db) => {
        const out = renameMember(db, input);
        return { db: out.db, value: out.group };
      });
    },
    rate(input) {
      return run((db) => {
        const out = upsertGroupRating(db, input);
        return { db: out.db, value: out.group };
      });
    },
    removeRating(input) {
      return run((db) => {
        const out = removeGroupRating(db, input);
        return { db: out.db, value: out.group };
      });
    },
    leave(input) {
      return run((db) => {
        const out = leaveGroup(db, input);
        return { db: out.db, value: out.group };
      });
    },
    block(input) {
      return run((db) => {
        const out = blockMember(db, input);
        return { db: out.db, value: out.view };
      });
    },
    unblock(input) {
      return run((db) => {
        const out = unblockMember(db, input);
        return { db: out.db, value: out.view };
      });
    },
    report(input) {
      return run((db) => {
        const out = reportRating(db, input);
        return { db: out.db, value: out.report };
      });
    },
    reports() {
      return run((db) => ({ db, value: listReports(db), write: false }));
    },
    adminRemove(input) {
      return run((db) => {
        const out = adminRemoveRating(db, input);
        return { db: out.db, value: out.removed };
      });
    },
    seed() {
      return run((db) => {
        const next = ensureReviewGroup(db);
        return { db: next, value: next !== db, write: next !== db };
      });
    },
  };
}
