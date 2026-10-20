import { describe, it } from 'node:test';
import assert from 'node:assert/strict';
import { GrpcError } from '@conduitplatform/grpc-sdk';
import { status } from '@grpc/grpc-js';
import {
  assertDiscoveryRequestAllowed,
  buildDiscoveryAnswer,
  decideLinkProofUse,
  DISCOVERY_MAX_ACCOUNTS,
  DISCOVERY_PASSWORD_MAX_ACCOUNTS,
  discoveryRedirectUrl,
  discoveryRequestError,
  DiscoveryAccount,
  isDiscoveryAccepted,
  isLinkProofLive,
  isProofConsumed,
  linkProofData,
  oauthAccountLinking,
  oauthAccountListed,
  oauthAccountMatch,
  oauthDiscoveryFilter,
  REALM_LINK_PROOF_TTL_MS,
} from './realmDiscovery.logic.js';

const NOW = 1_700_000_000_000;

function account(patch: Partial<DiscoveryAccount> = {}): DiscoveryAccount {
  return {
    userId: 'u1',
    realmId: 'r-acme',
    slug: 'acme',
    name: 'Acme',
    hasTwoFA: false,
    ...patch,
  };
}

describe('discoveryRequestError', () => {
  it('does nothing without discover', () => {
    assert.equal(
      discoveryRequestError({ discover: false, enabled: false, realm: 'acme' }),
      null,
    );
  });

  it('refuses discover while the discovery login is off', () => {
    assert.equal(
      discoveryRequestError({ discover: true, enabled: false }),
      'Discovery login is not enabled',
    );
  });

  it('makes discover and realm mutually exclusive', () => {
    assert.equal(
      discoveryRequestError({ discover: true, enabled: true, realm: 'acme' }),
      'discover and realm are mutually exclusive',
    );
    assert.equal(
      discoveryRequestError({ discover: true, enabled: true, realm: '' }),
      null,
    );
    assert.equal(
      discoveryRequestError({ discover: true, enabled: true, realm: null }),
      null,
    );
  });

  it('refuses an invitation token on a discovery login', () => {
    assert.equal(
      discoveryRequestError({
        discover: true,
        enabled: true,
        invitationToken: 'inv',
      }),
      'discover does not accept an invitation token',
    );
  });

  it('allows a plain discovery request', () => {
    assert.equal(discoveryRequestError({ discover: true, enabled: true }), null);
  });

  it('throws INVALID_ARGUMENT from the assertion', () => {
    assert.throws(
      () => assertDiscoveryRequestAllowed({ discover: true, enabled: false }),
      (err: unknown) => err instanceof GrpcError && err.code === status.INVALID_ARGUMENT,
    );
    assert.doesNotThrow(() =>
      assertDiscoveryRequestAllowed({ discover: false, enabled: false }),
    );
  });
});

describe('isDiscoveryAccepted', () => {
  const verified = {
    hashed: true,
    matches: true,
    verificationRequired: false,
    isVerified: false,
  };

  it('accepts an active account with the strategy at home and a matching password', () => {
    assert.equal(
      isDiscoveryAccepted({
        active: true,
        strategyEnabledAtHome: true,
        password: verified,
      }),
      true,
    );
  });

  it('refuses an inactive account', () => {
    assert.equal(
      isDiscoveryAccepted({
        active: false,
        strategyEnabledAtHome: true,
        password: verified,
      }),
      false,
    );
  });

  it('refuses an account whose home realm does not enable the strategy', () => {
    assert.equal(
      isDiscoveryAccepted({
        active: true,
        strategyEnabledAtHome: false,
        password: verified,
      }),
      false,
    );
  });

  it('refuses a password mismatch and an account without a password hash', () => {
    assert.equal(
      isDiscoveryAccepted({
        active: true,
        strategyEnabledAtHome: true,
        password: { ...verified, matches: false },
      }),
      false,
    );
    assert.equal(
      isDiscoveryAccepted({
        active: true,
        strategyEnabledAtHome: true,
        password: { ...verified, hashed: false },
      }),
      false,
    );
  });

  it('applies the verification rule of the home realm to password accounts', () => {
    const required = { ...verified, verificationRequired: true, isVerified: false };
    assert.equal(
      isDiscoveryAccepted({
        active: true,
        strategyEnabledAtHome: true,
        password: required,
      }),
      false,
    );
    assert.equal(
      isDiscoveryAccepted({
        active: true,
        strategyEnabledAtHome: true,
        password: { ...required, isVerified: true },
      }),
      true,
    );
  });

  it('accepts a phone or OAuth account on active and strategy alone', () => {
    assert.equal(
      isDiscoveryAccepted({ active: true, strategyEnabledAtHome: true }),
      true,
    );
  });
});

describe('buildDiscoveryAnswer', () => {
  it('lists every accepted realm and a proof entry for each one', () => {
    const { realms, proofEntries } = buildDiscoveryAnswer([
      account(),
      account({ userId: 'u2', realmId: 'r-beta', slug: 'beta', name: 'Beta' }),
    ]);
    assert.deepEqual(realms, [
      { slug: 'acme', name: 'Acme' },
      { slug: 'beta', name: 'Beta' },
    ]);
    assert.deepEqual(proofEntries, [
      { realmId: 'r-acme', userId: 'u1' },
      { realmId: 'r-beta', userId: 'u2' },
    ]);
  });

  it('lists a 2FA account with requiresTwoFa and leaves it out of the proof', () => {
    const { realms, proofEntries } = buildDiscoveryAnswer([account({ hasTwoFA: true })]);
    assert.deepEqual(realms, [{ slug: 'acme', name: 'Acme', requiresTwoFa: true }]);
    assert.deepEqual(proofEntries, []);
  });

  it('lists a global account as null slug and name, with a global proof entry', () => {
    const { realms, proofEntries } = buildDiscoveryAnswer([
      account({ realmId: null, slug: null, name: null, userId: 'g1' }),
    ]);
    assert.deepEqual(realms, [{ slug: null, name: null }]);
    assert.deepEqual(proofEntries, [{ realmId: null, userId: 'g1' }]);
  });

  it('lists one realm once, keeping the first account for the proof', () => {
    const { realms, proofEntries } = buildDiscoveryAnswer([
      account({ userId: 'first' }),
      account({ userId: 'second' }),
    ]);
    assert.equal(realms.length, 1);
    assert.deepEqual(proofEntries, [{ realmId: 'r-acme', userId: 'first' }]);
  });

  it('marks a realm as requiring 2FA when a later account of it has 2FA', () => {
    const { realms, proofEntries } = buildDiscoveryAnswer([
      account({ userId: 'plain' }),
      account({ userId: 'twofa', hasTwoFA: true }),
    ]);
    assert.deepEqual(realms, [{ slug: 'acme', name: 'Acme', requiresTwoFa: true }]);
    assert.deepEqual(proofEntries, []);
  });

  it('answers nothing for no accounts', () => {
    assert.deepEqual(buildDiscoveryAnswer([]), { realms: [], proofEntries: [] });
  });
});

describe('discovery limits', () => {
  it('caps the password discovery at 15 accounts and the phone and OAuth ones at 50', () => {
    assert.equal(DISCOVERY_PASSWORD_MAX_ACCOUNTS, 15);
    assert.equal(DISCOVERY_MAX_ACCOUNTS, 50);
  });
});

describe('link proof token data and use', () => {
  it('expires ten minutes after issue', () => {
    const data = linkProofData([{ realmId: 'r-acme', userId: 'u1' }], NOW, 'client-1');
    assert.equal(data.expiresAt, NOW + REALM_LINK_PROOF_TTL_MS);
    assert.equal(REALM_LINK_PROOF_TTL_MS, 10 * 60 * 1000);
  });

  it('is live until its expiry and not after', () => {
    assert.equal(isLinkProofLive({ expiresAt: NOW + 1 }, NOW), true);
    assert.equal(isLinkProofLive({ expiresAt: NOW }, NOW), false);
    assert.equal(isLinkProofLive({ expiresAt: NOW - 1 }, NOW), false);
    assert.equal(isLinkProofLive({}, NOW), false);
    assert.equal(isLinkProofLive(null, NOW), false);
  });

  it('vouches for the account of the requested source realm only', () => {
    const data = linkProofData(
      [
        { realmId: 'r-acme', userId: 'acme-user' },
        { realmId: null, userId: 'global-user' },
      ],
      NOW,
      'client-1',
    );
    assert.deepEqual(decideLinkProofUse(data, 'r-acme', NOW, 'client-1'), {
      userId: 'acme-user',
    });
    assert.deepEqual(decideLinkProofUse(data, null, NOW, 'client-1'), {
      userId: 'global-user',
    });
    assert.equal(decideLinkProofUse(data, 'r-other', NOW, 'client-1'), null);
  });

  it('refuses an expired proof', () => {
    const data = linkProofData([{ realmId: 'r-acme', userId: 'u1' }], NOW, 'client-1');
    assert.equal(
      decideLinkProofUse(data, 'r-acme', NOW + REALM_LINK_PROOF_TTL_MS, 'client-1'),
      null,
    );
  });

  it('refuses a proof with a malformed entry', () => {
    const data = {
      entries: [{ realmId: 'r-acme', userId: '' }],
      expiresAt: NOW + 1,
      clientId: 'client-1',
    };
    assert.equal(decideLinkProofUse(data, 'r-acme', NOW, 'client-1'), null);
    assert.equal(
      decideLinkProofUse(
        { expiresAt: NOW + 1, clientId: 'client-1' },
        'r-acme',
        NOW,
        'client-1',
      ),
      null,
    );
  });

  it('counts a consumption only when the conditional delete removed the row', () => {
    assert.equal(isProofConsumed({ deletedCount: 1 }), true);
    assert.equal(isProofConsumed({ deletedCount: 0 }), false);
    assert.equal(isProofConsumed(null), false);
  });
});

describe('link proof client binding', () => {
  const data = linkProofData([{ realmId: null, userId: 'u1' }], NOW, 'client-1');

  it('serves the proof to the client it was issued to', () => {
    assert.deepEqual(decideLinkProofUse(data, null, NOW, 'client-1'), { userId: 'u1' });
  });

  it('refuses the proof from another client', () => {
    assert.equal(decideLinkProofUse(data, null, NOW, 'client-2'), null);
  });

  it('refuses the proof from a request with no client', () => {
    assert.equal(decideLinkProofUse(data, null, NOW, undefined), null);
    assert.equal(decideLinkProofUse(data, null, NOW, null), null);
    assert.equal(decideLinkProofUse(data, null, NOW, ''), null);
  });

  it('refuses a proof that was issued without a client', () => {
    const noClient = { entries: data.entries, expiresAt: NOW + 1 };
    assert.equal(decideLinkProofUse(noClient, null, NOW, 'client-1'), null);
    assert.equal(decideLinkProofUse({ ...noClient, clientId: '' }, null, NOW, ''), null);
  });
});

describe('oauthDiscoveryFilter', () => {
  it('matches the provider id or the email', () => {
    assert.deepEqual(oauthDiscoveryFilter('google', { id: 'g-1', email: 'a@b.co' }), {
      $or: [{ 'google.id': 'g-1' }, { email: 'a@b.co' }],
    });
  });

  it('lower-cases the email, as accounts store it', () => {
    assert.deepEqual(oauthDiscoveryFilter('google', { email: ' A@B.Co ' }), {
      $or: [{ email: 'a@b.co' }],
    });
  });

  it('uses only the identity the payload carries', () => {
    assert.deepEqual(oauthDiscoveryFilter('github', { id: 42 }), {
      $or: [{ 'github.id': '42' }],
    });
    assert.deepEqual(oauthDiscoveryFilter('github', { email: 'a@b.co' }), {
      $or: [{ email: 'a@b.co' }],
    });
  });

  it('is null when there is neither an id nor an email', () => {
    assert.equal(oauthDiscoveryFilter('github', {}), null);
    assert.equal(oauthDiscoveryFilter('github', { id: '', email: '' }), null);
  });
});

describe('oauthAccountMatch', () => {
  it('matches the stored provider id, as a string or a number', () => {
    assert.deepEqual(oauthAccountMatch({ id: 42 }, { providerId: '42' }), {
      byId: true,
      byEmail: false,
    });
    assert.deepEqual(oauthAccountMatch({ id: 'g-1' }, { providerId: 'g-2' }), {
      byId: false,
      byEmail: false,
    });
  });

  it('matches the email case-insensitively', () => {
    assert.deepEqual(oauthAccountMatch({ email: 'A@B.co' }, { email: 'a@b.co' }), {
      byId: false,
      byEmail: true,
    });
  });

  it('does not match an account with no id or email to an empty identity', () => {
    assert.deepEqual(oauthAccountMatch({}, { providerId: undefined, email: undefined }), {
      byId: false,
      byEmail: false,
    });
    assert.deepEqual(oauthAccountMatch({ id: '' }, { providerId: '' }), {
      byId: false,
      byEmail: false,
    });
  });
});

describe('oauthAccountLinking', () => {
  it('uses the realm setting when the realm sets one, whichever way', () => {
    assert.equal(oauthAccountLinking(true, false), true);
    assert.equal(oauthAccountLinking(false, true), false);
  });

  it('falls back to the global setting when the realm sets none', () => {
    assert.equal(oauthAccountLinking(undefined, true), true);
    assert.equal(oauthAccountLinking(null, false), false);
  });
});

describe('oauthAccountListed', () => {
  const byId = { byId: true, byEmail: false };
  const byEmail = { byId: false, byEmail: true };
  const both = { byId: true, byEmail: true };
  const none = { byId: false, byEmail: false };

  it('always lists a provider-id match, with or without account linking', () => {
    assert.equal(oauthAccountListed(byId, true), true);
    assert.equal(oauthAccountListed(byId, false), true);
    assert.equal(oauthAccountListed(both, false), true);
  });

  it('lists an email-only match only when account linking is allowed for its scope', () => {
    assert.equal(oauthAccountListed(byEmail, true), true);
    assert.equal(oauthAccountListed(byEmail, false), false);
  });

  it('never lists an account that matches neither', () => {
    assert.equal(oauthAccountListed(none, true), false);
    assert.equal(oauthAccountListed(none, false), false);
  });
});

describe('discoveryRedirectUrl', () => {
  it('carries the realms and the proof token in the fragment, not the query', () => {
    const answer = {
      realms: [
        { slug: 'acme', name: 'Acme' },
        { slug: null, name: null },
      ],
      proofToken: 'proof-1',
    };
    const url = new URL(discoveryRedirectUrl('https://app.example/cb?keep=1', answer));
    assert.equal(url.searchParams.get('keep'), '1');
    assert.equal(url.searchParams.has('proofToken'), false);
    assert.equal(url.searchParams.has('realms'), false);
    const fragment = new URLSearchParams(url.hash.slice(1));
    assert.equal(fragment.get('proofToken'), 'proof-1');
    const realms = JSON.parse(
      Buffer.from(fragment.get('realms')!, 'base64url').toString('utf8'),
    );
    assert.deepEqual(realms, answer.realms);
  });

  it('omits the proof token from the fragment when there is none', () => {
    const url = new URL(discoveryRedirectUrl('https://app.example/cb', { realms: [] }));
    const fragment = new URLSearchParams(url.hash.slice(1));
    assert.equal(fragment.has('proofToken'), false);
    assert.equal(fragment.get('realms'), Buffer.from('[]').toString('base64url'));
  });
});
