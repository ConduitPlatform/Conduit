import { describe, it } from 'node:test';
import assert from 'node:assert/strict';
import { GrpcError } from '@conduitplatform/grpc-sdk';
import { status } from '@grpc/grpc-js';
import {
  assertDiscoveryRequestAllowed,
  buildDiscoveryAnswer,
  decideLinkProofUse,
  discoveryRedirectUrl,
  discoveryRequestError,
  DiscoveryAccount,
  isDiscoveryAccepted,
  isLinkProofLive,
  isProofConsumed,
  linkProofData,
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

describe('link proof token data and use', () => {
  it('expires ten minutes after issue', () => {
    const data = linkProofData([{ realmId: 'r-acme', userId: 'u1' }], NOW);
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
    );
    assert.deepEqual(decideLinkProofUse(data, 'r-acme', NOW), { userId: 'acme-user' });
    assert.deepEqual(decideLinkProofUse(data, null, NOW), { userId: 'global-user' });
    assert.equal(decideLinkProofUse(data, 'r-other', NOW), null);
  });

  it('refuses an expired proof', () => {
    const data = linkProofData([{ realmId: 'r-acme', userId: 'u1' }], NOW);
    assert.equal(decideLinkProofUse(data, 'r-acme', NOW + REALM_LINK_PROOF_TTL_MS), null);
  });

  it('refuses a proof with a malformed entry', () => {
    const data = { entries: [{ realmId: 'r-acme', userId: '' }], expiresAt: NOW + 1 };
    assert.equal(decideLinkProofUse(data, 'r-acme', NOW), null);
    assert.equal(decideLinkProofUse({ expiresAt: NOW + 1 }, 'r-acme', NOW), null);
  });

  it('counts a consumption only when the conditional delete removed the row', () => {
    assert.equal(isProofConsumed({ deletedCount: 1 }), true);
    assert.equal(isProofConsumed({ deletedCount: 0 }), false);
    assert.equal(isProofConsumed(null), false);
  });
});

describe('oauthDiscoveryFilter', () => {
  it('matches the provider id or the verified email', () => {
    assert.deepEqual(oauthDiscoveryFilter('google', { id: 'g-1', email: 'a@b.co' }), {
      $or: [{ 'google.id': 'g-1' }, { email: 'a@b.co' }],
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

describe('discoveryRedirectUrl', () => {
  it('carries the realms as base64url JSON and the proof token', () => {
    const answer = {
      realms: [
        { slug: 'acme', name: 'Acme' },
        { slug: null, name: null },
      ],
      proofToken: 'proof-1',
    };
    const url = new URL(discoveryRedirectUrl('https://app.example/cb?keep=1', answer));
    assert.equal(url.searchParams.get('keep'), '1');
    assert.equal(url.searchParams.get('proofToken'), 'proof-1');
    const realms = JSON.parse(
      Buffer.from(url.searchParams.get('realms')!, 'base64url').toString('utf8'),
    );
    assert.deepEqual(realms, answer.realms);
  });

  it('omits the proof token when there is none', () => {
    const url = new URL(discoveryRedirectUrl('https://app.example/cb', { realms: [] }));
    assert.equal(url.searchParams.has('proofToken'), false);
    assert.equal(url.searchParams.get('realms'), Buffer.from('[]').toString('base64url'));
  });
});
