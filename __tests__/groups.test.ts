/// <reference types="jest" />
import { mkdtemp, rm } from 'node:fs/promises';
import http from 'node:http';
import os from 'node:os';
import path from 'node:path';

import {
  GroupError,
  REVIEWER_CODE,
  adminRemoveRating,
  blockMember,
  containsObjectionableLanguage,
  createGroup,
  emptyGroupDatabase,
  ensureReviewGroup,
  groupFeed,
  joinGroup,
  languageError,
  leaveGroup,
  listReports,
  normalizeDisplayName,
  normalizeGroupCode,
  ratingsForMovie,
  readGroup,
  removeGroupRating,
  reportRating,
  unblockMember,
  upsertGroupRating,
  viewGroup,
} from '../lib/groups';
import { createFileGroupStore, createMemoryGroupStore } from '../server/store';
import { listenGroupServer } from '../server/http';

const inception = {
  id: 'shelf-inception',
  title: 'Inception',
  year: '2010',
  overview: 'A dream.',
  posterUrl: 'https://image.tmdb.org/t/p/w342/inception.jpg',
  stars: 4.5,
  note: '  The hallway.  ',
};

describe('group codes and names', () => {
  it('keeps only the unambiguous characters in a join code', () => {
    expect(normalizeGroupCode(' ab-7k 2q ')).toBe('AB7K2Q');
    expect(normalizeGroupCode('o0i1')).toBe('');
  });

  it('trims a display name and caps it', () => {
    expect(normalizeDisplayName('  Raghav   B  ')).toBe('Raghav B');
    expect(normalizeDisplayName(` ${'a'.repeat(40)} `)).toHaveLength(24);
  });
});

describe('group membership and ratings', () => {
  function seed() {
    const created = createGroup(emptyGroupDatabase(), { name: '  Raghav  ', now: 10 });
    const joined = joinGroup(created.db, { code: created.result.membership.code, name: 'Priya', now: 20 });
    return { created, joined };
  }

  it('starts a group and lets a second person join with the code', () => {
    const { created, joined } = seed();
    expect(created.result.group.members.map((member) => member.name)).toEqual(['Raghav']);
    expect(joined.result.group.members.map((member) => member.name)).toEqual(['Raghav', 'Priya']);
    expect(JSON.stringify(joined.result.group)).not.toContain(joined.result.membership.token);
    expect(readGroup(joined.db, created.result.membership.code).code).toBe(created.result.membership.code);
  });

  it('rejects a blank name, a short code, and an unknown code', () => {
    expect(() => createGroup(emptyGroupDatabase(), { name: '   ' })).toThrow(GroupError);
    expect(() => joinGroup(emptyGroupDatabase(), { code: 'AB', name: 'Priya' })).toThrow(/6-character/);
    const { created } = seed();
    expect(() => joinGroup(created.db, { code: 'ZZZZZZ', name: 'Priya' })).toThrow(/doesn't match/);
  });

  it('shares a rating with the group and replaces that member’s earlier take', () => {
    const { created, joined } = seed();
    const first = upsertGroupRating(joined.db, {
      ...created.result.membership,
      movie: { ...inception, updatedAt: 30 },
    });
    const second = upsertGroupRating(first.db, {
      ...created.result.membership,
      movie: { ...inception, id: 'tmdb-27205', stars: 5, note: 'Still the hallway.', updatedAt: 40 },
    });

    const feed = groupFeed(second.group);
    expect(feed).toHaveLength(1);
    expect(feed[0]).toMatchObject({
      memberName: 'Raghav',
      movieId: 'tmdb-27205',
      stars: 5,
      note: 'Still the hallway.',
    });

    const priya = upsertGroupRating(second.db, {
      ...joined.result.membership,
      movie: { ...inception, stars: 4, note: 'The train.', updatedAt: 50 },
    });
    expect(groupFeed(priya.group).map((item) => item.memberName)).toEqual(['Priya', 'Raghav']);
    expect(ratingsForMovie(priya.group, { id: 'other', title: 'Inception', year: '2010' })).toHaveLength(2);
  });

  it('refuses another member’s token and an invalid score', () => {
    const { created, joined } = seed();
    expect(() =>
      upsertGroupRating(joined.db, {
        code: created.result.membership.code,
        memberId: created.result.membership.memberId,
        token: joined.result.membership.token,
        movie: inception,
      }),
    ).toThrow(/isn't a member/);

    expect(() =>
      upsertGroupRating(joined.db, {
        ...created.result.membership,
        movie: { ...inception, stars: 4.2 },
      }),
    ).toThrow(/half a star/);
  });

  it('removes only the leaving member’s ratings', () => {
    const { created, joined } = seed();
    const rated = upsertGroupRating(joined.db, { ...created.result.membership, movie: { ...inception, updatedAt: 30 } });
    const both = upsertGroupRating(rated.db, {
      ...joined.result.membership,
      movie: { ...inception, stars: 3, note: 'Hmm.', updatedAt: 40 },
    });
    const left = leaveGroup(both.db, created.result.membership);
    expect(left.group.members.map((member) => member.name)).toEqual(['Priya']);
    expect(left.group.ratings).toHaveLength(1);
    expect(left.group.ratings[0]?.note).toBe('Hmm.');

    const removed = removeGroupRating(both.db, {
      ...joined.result.membership,
      movieId: 'shelf-inception',
      title: 'Inception',
      year: '2010',
    });
    expect(removed.group.ratings.map((rating) => rating.memberId)).toEqual([created.result.membership.memberId]);
  });
});

describe('moderation, reports, blocks, and deletion', () => {
  function pair() {
    const created = createGroup(emptyGroupDatabase(), { name: 'Raghav', now: 1 });
    const joined = joinGroup(created.db, { code: created.result.membership.code, name: 'Priya', now: 2 });
    const rated = upsertGroupRating(joined.db, {
      ...created.result.membership,
      movie: { id: 'shelf-inception', title: 'Inception', year: '2010', stars: 5, note: 'The hallway.', updatedAt: 3 },
    });
    return { created, joined, rated };
  }

  it('rejects profanity in a display name and a shared note, and allows ordinary words', () => {
    expect(containsObjectionableLanguage('what the shit')).toBe(true);
    expect(containsObjectionableLanguage('sh1t')).toBe(true);
    expect(containsObjectionableLanguage('classic cinema')).toBe(false);
    expect(languageError('oh shit', 'note')).toMatch(/isn't allowed/);
    expect(() => createGroup(emptyGroupDatabase(), { name: 'shit' })).toThrow(GroupError);
    const created = createGroup(emptyGroupDatabase(), { name: 'Raghav' });
    expect(() =>
      upsertGroupRating(created.db, {
        ...created.result.membership,
        movie: { id: 'shelf-coco', title: 'Coco', year: '2017', stars: 4, note: 'this is bullshit' },
      }),
    ).toThrow(/offensive language/);
  });

  it('records a report and lets an admin remove the note', () => {
    const { created, joined, rated } = pair();
    const reported = reportRating(rated.db, {
      ...joined.result.membership,
      targetMemberId: created.result.membership.memberId,
      movieId: 'shelf-inception',
      now: 9,
    });
    expect(listReports(reported.db)).toHaveLength(1);
    expect(listReports(reported.db)[0]).toMatchObject({ status: 'open', title: 'Inception', noteExcerpt: 'The hallway.' });
    const removed = adminRemoveRating(reported.db, {
      code: created.result.membership.code,
      memberId: created.result.membership.memberId,
      movieId: 'shelf-inception',
    });
    expect(removed.removed).toBe(1);
    expect(readGroup(removed.db, created.result.membership.code).ratings).toHaveLength(0);
    expect(listReports(removed.db)[0]?.status).toBe('removed');
  });

  it('hides a blocked member’s ratings and keeps the block in the saved group', () => {
    const { created, joined, rated } = pair();
    const blocked = blockMember(rated.db, {
      ...joined.result.membership,
      blockedMemberId: created.result.membership.memberId,
    });
    expect(blocked.view.blockedMemberIds).toEqual([created.result.membership.memberId]);
    expect(blocked.view.group.ratings).toHaveLength(0);
    expect(blocked.view.group.members.map((member) => member.name)).toEqual(['Raghav', 'Priya']);
    const visibleAgain = viewGroup(blocked.db, {
      code: created.result.membership.code,
      memberId: joined.result.membership.memberId,
      token: joined.result.membership.token,
    });
    expect(visibleAgain.group.ratings).toHaveLength(0);
    const cleared = unblockMember(blocked.db, {
      ...joined.result.membership,
      blockedMemberId: created.result.membership.memberId,
    });
    expect(cleared.view.blockedMemberIds).toEqual([]);
    expect(cleared.view.group.ratings).toHaveLength(1);
  });

  it('deletes only the leaving member’s shared ratings, notes, and membership', () => {
    const { created, joined, rated } = pair();
    const both = upsertGroupRating(rated.db, {
      ...joined.result.membership,
      movie: { id: 'shelf-coco', title: 'Coco', year: '2017', stars: 4, note: 'The guitar.', updatedAt: 8 },
    });
    const left = leaveGroup(both.db, joined.result.membership);
    const group = readGroup(left.db, created.result.membership.code);
    expect(group.members.map((member) => member.name)).toEqual(['Raghav']);
    expect(group.ratings.map((rating) => rating.note)).toEqual(['The hallway.']);
  });

  it('seeds one reviewer group and does not duplicate it', () => {
    const seeded = ensureReviewGroup(emptyGroupDatabase());
    expect(seeded.groups.map((group) => group.code)).toEqual([REVIEWER_CODE]);
    expect(seeded.groups[0]?.ratings.length).toBeGreaterThanOrEqual(3);
    expect(ensureReviewGroup(seeded).groups).toHaveLength(1);
  });
});

describe('group server', () => {
  it('keeps a group on disk for the next process', async () => {
    const dir = await mkdtemp(path.join(os.tmpdir(), 'aftercredits-'));
    const file = path.join(dir, 'circles.json');
    try {
      const first = createFileGroupStore(file);
      const created = await first.create('Raghav');
      const second = createFileGroupStore(file);
      const group = await second.read(created.membership.code);
      expect(group.members.map((member) => member.name)).toEqual(['Raghav']);
      expect(JSON.stringify(group)).not.toContain(created.membership.token);
    } finally {
      await rm(dir, { recursive: true, force: true });
    }
  });

  it('lets two clients join by code and see each other’s ratings', async () => {
    const server = await listenGroupServer(createMemoryGroupStore(), 0);
    const base = `http://127.0.0.1:${server.port}`;

    function call(pathname: string, body?: unknown): Promise<{ status: number; json: Record<string, any> }> {
      return new Promise((resolve, reject) => {
        const request = http.request(
          base + pathname,
          {
            method: body === undefined ? 'GET' : 'POST',
            headers: {
              Connection: 'close',
              ...(body === undefined ? {} : { 'Content-Type': 'application/json' }),
            },
          },
          (response) => {
            const chunks: Buffer[] = [];
            response.on('data', (chunk: Buffer) => chunks.push(chunk));
            response.on('end', () => {
              const raw = Buffer.concat(chunks).toString('utf8');
              let json: Record<string, any> = {};
              try {
                json = raw ? (JSON.parse(raw) as Record<string, any>) : {};
              } catch {
                json = { raw };
              }
              resolve({ status: response.statusCode ?? 0, json });
            });
          },
        );
        request.on('error', reject);
        if (body !== undefined) request.write(JSON.stringify(body));
        request.end();
      });
    }

    try {
      const createdResponse = await call('/v1/groups', { name: 'Raghav' });
      expect(createdResponse.status).toBe(201);
      const created = createdResponse.json as {
        membership: { code: string; memberId: string; token: string };
      };

      const joined = await call('/v1/groups/join', {
        code: ` ${created.membership.code.toLowerCase()} `,
        name: 'Priya',
      });
      const joinedMembership = (joined.json as { membership: { code: string; token: string } }).membership;

      const published = await call(`/v1/groups/${created.membership.code}/ratings`, {
        memberId: created.membership.memberId,
        token: created.membership.token,
        movie: inception,
      });

      const seen = await call(`/v1/groups/${joinedMembership.code}`);
      const seenGroup = (seen.json as { group: { ratings: { note: string }[]; members: unknown[] } }).group;
      expect(seenGroup.ratings).toHaveLength(1);
      expect(seenGroup.ratings[0]?.note).toBe('The hallway.');
      expect((published.json as { group: { members: unknown[] } }).group.members).toHaveLength(2);

      const forbidden = await call(`/v1/groups/${created.membership.code}/ratings`, {
        memberId: created.membership.memberId,
        token: joinedMembership.token,
        movie: inception,
      });
      expect(forbidden.status).toBe(403);

      const health = await call('/health');
      expect(health.json).toEqual({ ok: true });
      const admin = await call('/admin/reports');
      expect(admin.status).toBe(503);
      const privacy = await call('/privacy');
      expect(privacy.status).toBe(200);
      expect(String(privacy.json.raw)).toMatch(/display name/);
      const home = await call('/');
      expect(home.status).toBe(200);
      const homeHtml = String(home.json.raw);
      expect(homeHtml).toContain('Popcorn Circle');
      expect(homeHtml).toContain(
        'This application uses TMDB and the TMDB APIs but is not endorsed, certified, or otherwise approved by TMDB.',
      );
      expect(homeHtml).toContain('href="/privacy"');
      expect(homeHtml).toContain('support@popcorncircle.com');
      expect(homeHtml).toContain('small circle of friends');
    } finally {
      await server.close();
    }
  });
});
