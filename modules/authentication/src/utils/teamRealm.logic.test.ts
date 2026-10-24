import { describe, it } from 'node:test';
import assert from 'node:assert/strict';
import {
  classifyRealmMember,
  countUpdated,
  decorateMembers,
  findUnknownRealmIds,
  realmlessTokenQuery,
  relationsTouchTeams,
  relationTeamIds,
  relationUserIds,
} from './teamRealm.logic.js';

const REALM = 'aaaaaaaaaaaaaaaaaaaaaaaa';
const OTHER = 'bbbbbbbbbbbbbbbbbbbbbbbb';

describe('classifyRealmMember', () => {
  it('admin mode: users without a home realm become home users and get the realm', () => {
    for (const none of [undefined, null, '']) {
      assert.deepEqual(classifyRealmMember(none, REALM, 'admin'), {
        type: 'home',
        setHomeRealm: true,
      });
    }
  });

  it('client mode never re-homes: users without a home realm become guests', () => {
    for (const none of [undefined, null, '']) {
      assert.deepEqual(classifyRealmMember(none, REALM, 'client'), {
        type: 'guest',
        setHomeRealm: false,
      });
    }
  });

  it('keeps the home realm when it is this realm, in both modes', () => {
    for (const mode of ['admin', 'client'] as const) {
      assert.deepEqual(classifyRealmMember(REALM, REALM, mode), {
        type: 'home',
        setHomeRealm: false,
      });
    }
  });

  it('users of another realm are guests, in both modes', () => {
    for (const mode of ['admin', 'client'] as const) {
      assert.deepEqual(classifyRealmMember(OTHER, REALM, mode), {
        type: 'guest',
        setHomeRealm: false,
      });
    }
  });
});

describe('countUpdated', () => {
  it('reads the Mongo and SQL update results', () => {
    assert.equal(countUpdated({ matchedCount: 1, modifiedCount: 1 }), 1);
    assert.equal(countUpdated({ matchedCount: 1, modifiedCount: 0 }), 0);
    assert.equal(countUpdated({ matchedCount: 0, modifiedCount: 0 }), 0);
    assert.equal(countUpdated([{ _id: 'u1' }]), 1);
    assert.equal(countUpdated([]), 0);
  });

  it('counts unknown shapes as nothing updated', () => {
    assert.equal(countUpdated(null), 0);
    assert.equal(countUpdated(undefined), 0);
    assert.equal(countUpdated({}), 0);
    assert.equal(countUpdated('ok'), 0);
  });
});

describe('realmlessTokenQuery', () => {
  it('matches tokens with a null or missing realm', () => {
    assert.deepEqual(realmlessTokenQuery(['u1']), {
      user: 'u1',
      $or: [{ realm: null }, { realm: { $exists: false } }],
    });
    assert.deepEqual(realmlessTokenQuery(['u1', 'u2']).user, { $in: ['u1', 'u2'] });
  });
});

describe('findUnknownRealmIds', () => {
  it('lists requested ids that are not realm teams, once', () => {
    assert.deepEqual(findUnknownRealmIds([REALM, OTHER, OTHER], [REALM]), [OTHER]);
    assert.deepEqual(findUnknownRealmIds([REALM], [REALM]), []);
    assert.deepEqual(findUnknownRealmIds([], [REALM]), []);
  });
});

describe('relations', () => {
  const relations = [
    { subject: 'User:u1', relation: 'member', resource: `Team:${REALM}` },
    { subject: 'User:u1', relation: 'owner', resource: 'Team:sub' },
    { subject: 'Team:parent', relation: 'owner', resource: 'Other:thing' },
  ];

  it('extracts team ids', () => {
    assert.deepEqual(relationTeamIds(relations), [REALM, 'sub']);
    assert.deepEqual(relationTeamIds(undefined), []);
  });

  it('detects relations on the realm tree', () => {
    assert.equal(relationsTouchTeams(relations, [REALM]), true);
    assert.equal(relationsTouchTeams(relations, ['sub']), true);
    assert.equal(relationsTouchTeams(relations, [OTHER]), false);
    assert.equal(relationsTouchTeams([], [REALM]), false);
    assert.equal(relationsTouchTeams(null, [REALM]), false);
  });

  it('extracts distinct user ids', () => {
    assert.deepEqual(
      relationUserIds([
        { subject: 'User:u1' },
        { subject: 'User:u2' },
        { subject: 'User:u1' },
        { subject: 'Team:t' },
      ]),
      ['u1', 'u2'],
    );
  });
});

describe('decorateMembers', () => {
  it('adds the membership type to members that have one', () => {
    const members = [{ _id: 'u1' }, { _id: 'u2' }, { _id: 'u3' }];
    const decorated = decorateMembers(members, [
      { user: 'u1', membershipType: 'home' },
      { user: 'u3', membershipType: 'guest' },
    ]);
    assert.equal(decorated, members);
    assert.deepEqual(decorated, [
      { _id: 'u1', membershipType: 'home' },
      { _id: 'u2' },
      { _id: 'u3', membershipType: 'guest' },
    ]);
  });
});
