import { describe, it } from 'node:test';
import assert from 'node:assert/strict';
import { buildEffectiveSettings, defaultRealmSettings } from '../utils/realm.logic.js';
import {
  buildRealmDiscovery,
  buildUserRealms,
  enterRealmTokenFlags,
  isLeaveRefused,
  linkSourceStillValid,
  LinkSession,
  selectLinkSource,
  subteamIdsOnLeave,
  summarizePolicies,
  toRealmRef,
} from './realm.logic.js';
import { linkProofData } from './realmDiscovery.logic.js';

const team = { _id: 'r1', name: 'Acme', realm: { enabled: true, slug: 'acme' } };

function effectiveWith(patch: Record<string, unknown>) {
  const base = defaultRealmSettings();
  return buildEffectiveSettings(
    {
      google: { clientId: 'global-id', clientSecret: 'global-secret' },
    },
    { ...base, ...patch } as typeof base,
  );
}

describe('buildRealmDiscovery', () => {
  it('summarizes strategies and policies without secrets', () => {
    const effective = effectiveWith({
      strategies: {
        ...defaultRealmSettings().strategies,
        username: { enabled: true },
        oauth: {
          google: { enabled: true, clientId: 'own', clientSecret: 'shh' },
          github: { enabled: false },
          linkedin: { enabled: true },
        },
      },
      policies: {
        ...defaultRealmSettings().policies,
        requireTwoFa: true,
        guests: { allowed: false, allowedHomeRealms: [] },
      },
    });
    const discovery = buildRealmDiscovery(team, effective);
    assert.deepEqual(discovery, {
      name: 'Acme',
      slug: 'acme',
      strategies: {
        local: true,
        username: true,
        magicLink: false,
        phone: false,
        metamask: false,
        biometric: false,
        oauth: ['google', 'linkedin'],
      },
      policies: { requireTwoFa: true, requireVerifiedEmail: false, guestsAllowed: false },
    });
    assert.equal(JSON.stringify(discovery).includes('shh'), false);
    assert.equal(JSON.stringify(discovery).includes('global-secret'), false);
  });
});

describe('user realms', () => {
  const home = { team: toRealmRef(team) };
  const guest = {
    team: toRealmRef({ _id: 'r2', name: 'Beta', realm: { enabled: true, slug: 'beta' } }),
    policies: summarizePolicies({ requireTwoFa: true, requireVerifiedEmail: false }),
  };

  it('toRealmRef exposes id, name and slug', () => {
    assert.deepEqual(home.team, { _id: 'r1', name: 'Acme', slug: 'acme' });
  });

  it('lists home and guest realms', () => {
    assert.deepEqual(buildUserRealms({ homeRealmId: 'r1', home, guests: [guest] }), {
      home,
      guests: [guest],
    });
  });

  it('is null for a global user and hides the home realm from the guests', () => {
    const none = buildUserRealms({ homeRealmId: null, home: null, guests: [] });
    assert.deepEqual(none, { home: null, guests: [] });
    const dup = buildUserRealms({
      homeRealmId: 'r2',
      home: { team: guest.team },
      guests: [guest],
    });
    assert.deepEqual(dup.guests, []);
  });
});

describe('enterRealmTokenFlags', () => {
  it('does not mint sudo tokens from a session without sudo', () => {
    assert.deepEqual(enterRealmTokenFlags({ authorized: true, sudo: false }), {
      noSudo: true,
      twoFaPass: true,
    });
    assert.deepEqual(enterRealmTokenFlags({ authorized: true }), {
      noSudo: true,
      twoFaPass: true,
    });
    assert.deepEqual(enterRealmTokenFlags({ authorized: false }), {
      noSudo: true,
      twoFaPass: false,
    });
    assert.deepEqual(enterRealmTokenFlags(undefined), {
      noSudo: true,
      twoFaPass: false,
    });
  });

  it('carries sudo over only when the entering token has it', () => {
    assert.deepEqual(enterRealmTokenFlags({ authorized: true, sudo: true }), {
      noSudo: false,
      twoFaPass: true,
    });
  });
});

const LINK_NOW = 1_700_000_000_000;

function linkProof(clientId = 'client-1') {
  return linkProofData(
    [
      { realmId: 'r-acme', userId: 'acme-user' },
      { realmId: null, userId: 'global-user' },
    ],
    LINK_NOW,
    clientId,
  );
}

const acmeSession: LinkSession = {
  userId: 'session-user',
  homeRealmId: 'r-acme',
  anonymous: false,
  authorized: true,
};

describe('selectLinkSource', () => {
  it('lets a proof win over a session of the same realm', () => {
    assert.deepEqual(
      selectLinkSource({
        proof: linkProof(),
        clientId: 'client-1',
        sourceRealm: 'r-acme',
        now: LINK_NOW,
        session: acmeSession,
      }),
      { flow: 'proof', userId: 'acme-user', sourceRealmId: 'r-acme' },
    );
  });

  it('uses the session of the home realm when no proof is given', () => {
    assert.deepEqual(
      selectLinkSource({
        proof: null,
        clientId: 'client-1',
        sourceRealm: undefined,
        now: LINK_NOW,
        session: acmeSession,
      }),
      { flow: 'session', userId: 'session-user', sourceRealmId: 'r-acme' },
    );
  });

  it('refuses a session whose home realm is not the named source realm', () => {
    assert.equal(
      selectLinkSource({
        proof: null,
        clientId: 'client-1',
        sourceRealm: 'r-other',
        now: LINK_NOW,
        session: acmeSession,
      }),
      null,
    );
    assert.equal(
      selectLinkSource({
        proof: null,
        clientId: 'client-1',
        sourceRealm: null,
        now: LINK_NOW,
        session: acmeSession,
      }),
      null,
    );
  });

  it('does not take a proof of another source realm', () => {
    assert.equal(
      selectLinkSource({
        proof: linkProof(),
        clientId: 'client-1',
        sourceRealm: 'r-other',
        now: LINK_NOW,
        session: null,
      }),
      null,
    );
  });

  it('takes the global entry of a proof for the global source', () => {
    assert.deepEqual(
      selectLinkSource({
        proof: linkProof(),
        clientId: 'client-1',
        sourceRealm: null,
        now: LINK_NOW,
        session: null,
      }),
      { flow: 'proof', userId: 'global-user', sourceRealmId: null },
    );
  });

  it('refuses an anonymous or unauthorized session', () => {
    for (const session of [
      { ...acmeSession, anonymous: true },
      { ...acmeSession, authorized: false },
    ]) {
      assert.equal(
        selectLinkSource({
          proof: null,
          clientId: 'client-1',
          sourceRealm: undefined,
          now: LINK_NOW,
          session,
        }),
        null,
      );
    }
  });

  it('refuses a proof from another client, but a session of the client still stands', () => {
    assert.equal(
      selectLinkSource({
        proof: linkProof('client-1'),
        clientId: 'client-2',
        sourceRealm: 'r-acme',
        now: LINK_NOW,
        session: null,
      }),
      null,
    );
    assert.deepEqual(
      selectLinkSource({
        proof: linkProof('client-1'),
        clientId: 'client-2',
        sourceRealm: 'r-acme',
        now: LINK_NOW,
        session: acmeSession,
      }),
      { flow: 'session', userId: 'session-user', sourceRealmId: 'r-acme' },
    );
  });

  it('falls back to the session when the proof has expired', () => {
    const expired = LINK_NOW + 10 * 60 * 1000;
    assert.deepEqual(
      selectLinkSource({
        proof: linkProof(),
        clientId: 'client-1',
        sourceRealm: 'r-acme',
        now: expired,
        session: acmeSession,
      }),
      { flow: 'session', userId: 'session-user', sourceRealmId: 'r-acme' },
    );
  });

  it('is null with neither a live proof nor a session', () => {
    assert.equal(
      selectLinkSource({
        proof: null,
        clientId: 'client-1',
        sourceRealm: undefined,
        now: LINK_NOW,
        session: null,
      }),
      null,
    );
  });
});

describe('linkSourceStillValid', () => {
  it('holds for a proof whose account is still homed in the proven realm', () => {
    assert.equal(
      linkSourceStillValid({
        flow: 'proof',
        sourceRealmId: 'r-acme',
        homeRealmId: 'r-acme',
        hasTwoFA: false,
      }),
      true,
    );
    assert.equal(
      linkSourceStillValid({
        flow: 'proof',
        sourceRealmId: null,
        homeRealmId: null,
        hasTwoFA: false,
      }),
      true,
    );
  });

  it('refuses a proof whose account has moved home since it was issued', () => {
    assert.equal(
      linkSourceStillValid({
        flow: 'proof',
        sourceRealmId: 'r-acme',
        homeRealmId: 'r-other',
        hasTwoFA: false,
      }),
      false,
    );
    assert.equal(
      linkSourceStillValid({
        flow: 'session',
        sourceRealmId: 'r-acme',
        homeRealmId: null,
        hasTwoFA: false,
      }),
      false,
    );
  });

  it('refuses a proof whose account has gained 2FA since it was issued', () => {
    assert.equal(
      linkSourceStillValid({
        flow: 'proof',
        sourceRealmId: 'r-acme',
        homeRealmId: 'r-acme',
        hasTwoFA: true,
      }),
      false,
    );
  });

  it('does not refuse a session for its 2FA state (the assurance rules decide that)', () => {
    assert.equal(
      linkSourceStillValid({
        flow: 'session',
        sourceRealmId: 'r-acme',
        homeRealmId: 'r-acme',
        hasTwoFA: true,
      }),
      true,
    );
  });
});

describe('leaving a realm', () => {
  it('refuses to leave the home realm', () => {
    assert.equal(isLeaveRefused('r-acme', 'r-acme'), true);
  });

  it('allows leaving a guest realm, and a global user leaves any realm', () => {
    assert.equal(isLeaveRefused('r-acme', 'r-other'), false);
    assert.equal(isLeaveRefused(null, 'r-other'), false);
    assert.equal(isLeaveRefused(undefined, 'r-other'), false);
  });

  it('removes the relations of the sub-teams only, not the realm team again', () => {
    assert.deepEqual(subteamIdsOnLeave('root', ['root', 'child', 'grand']), [
      'child',
      'grand',
    ]);
    assert.deepEqual(subteamIdsOnLeave('root', ['root']), []);
  });
});
