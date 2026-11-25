import { mkdir, readFile, rename, writeFile } from 'node:fs/promises';
import path from 'node:path';

import {
  createGroup,
  emptyGroupDatabase,
  joinGroup,
  leaveGroup,
  readGroup,
  removeGroupRating,
  renameMember,
  upsertGroupRating,
  type GroupDatabase,
  type GroupMembership,
  type GroupMovieInput,
  type GroupRecord,
  type GroupSessionResult,
} from '../lib/groups.ts';

export type GroupStore = {
  create(name: string): Promise<GroupSessionResult>;
  join(code: string, name: string): Promise<GroupSessionResult>;
  read(code: string): Promise<GroupRecord>;
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
};

export function createMemoryGroupStore(initial?: GroupDatabase): GroupStore {
  let db = initial ?? emptyGroupDatabase();
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
  };
}

export function createFileGroupStore(filePath: string): GroupStore {
  let chain = Promise.resolve();

  async function readDb(): Promise<GroupDatabase> {
    try {
      const raw = await readFile(filePath, 'utf8');
      const parsed = JSON.parse(raw) as GroupDatabase;
      if (!parsed || !Array.isArray(parsed.groups)) return emptyGroupDatabase();
      return parsed;
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
  };
}
