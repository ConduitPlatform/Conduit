import { describe, it } from 'node:test';
import assert from 'node:assert/strict';
import {
  classifyRealmMember,
  decorateMembers,
  relationsTouchTeams,
  relationTeamIds,
  relationUserIds,
} from './teamRealm.logic.js';

const REALM = 'aaaaaaaaaaaaaaaaaaaaaaaa';
const OTHER = 'bbbbbbbbbbbbbbbbbbbbbbbb';

describe('classifyRealmMember', () => {
  it('users without a home realm become home users and get the realm', () => {
    assert.deepEqual(classifyRealmMember(undefined, REALM), {
      type: 'home',
      setHomeRealm: true,
    });
    assert.deepEqual(classifyRealmMember(null, REALM), {
      type: 'home',
      setHomeRealm: true,
    });
    assert.deepEqual(classifyRealmMember('', REALM), {
      type: 'home',
      setHomeRealm: true,
    });
  });

  it('keeps the home realm when it is this realm', () => {
    assert.deepEqual(classifyRealmMember(REALM, REALM), {
      type: 'home',
      setHomeRealm: false,
    });
  });

  it('users of another realm are guests', () => {
    assert.deepEqual(classifyRealmMember(OTHER, REALM), {
      type: 'guest',
      setHomeRealm: false,
    });
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
