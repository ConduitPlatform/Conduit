import { describe, it } from 'node:test';
import assert from 'node:assert/strict';
import { GrpcError } from '@conduitplatform/grpc-sdk';
import { ModuleError } from '@conduitplatform/module-tools';
import { status } from '@grpc/grpc-js';
import {
  assertTeamPromotable,
  buildRealmSettingsWrite,
  DEMOTE_STEPS,
  deepMergeClearing,
  describeUsers,
  guestsNotAllowedError,
  pickSettingsFields,
  planOldHomeMembership,
  planPromoteMembers,
  resolveSlugChange,
  sanitizeRealmInput,
  toRealmDto,
  toRealmMember,
} from './realm.logic.js';
import { defaultRealmSettings } from '../utils/realm.logic.js';

const REALM = 'aaaaaaaaaaaaaaaaaaaaaaaa';
const OTHER = 'bbbbbbbbbbbbbbbbbbbbbbbb';
const OTHER2 = 'cccccccccccccccccccccccc';

const openGuests = { guests: { allowed: true, allowedHomeRealms: [] } };
const closedGuests = { guests: { allowed: false, allowedHomeRealms: [] } };

function isInvalidArgument(e: unknown) {
  return e instanceof GrpcError && e.code === status.INVALID_ARGUMENT;
}

describe('planPromoteMembers', () => {
  const users = [
    { _id: 'u1', email: 'a@x.io' },
    { _id: 'u2', email: 'b@x.io', homeRealm: null },
    { _id: 'u3', email: 'c@x.io', homeRealm: OTHER },
    { _id: 'u4', email: 'd@x.io', homeRealm: REALM },
  ];

  it('makes users without a home realm home users and sets the realm', () => {
    const plan = planPromoteMembers(users, REALM, openGuests);
    assert.deepEqual(plan.home, ['u1', 'u2', 'u4']);
    assert.deepEqual(plan.setHomeRealm, ['u1', 'u2']);
  });

  it('makes users of another home realm guests', () => {
    const plan = planPromoteMembers(users, REALM, openGuests);
    assert.deepEqual(plan.guests, ['u3']);
    assert.deepEqual(plan.rejected, []);
  });

  it('keeps a user whose home realm is already this team as home user', () => {
    const plan = planPromoteMembers([users[3]], REALM, closedGuests);
    assert.deepEqual(plan.home, ['u4']);
    assert.deepEqual(plan.setHomeRealm, []);
    assert.deepEqual(plan.rejected, []);
  });

  it('rejects would-be guests when guests are not allowed', () => {
    const plan = planPromoteMembers(users, REALM, closedGuests);
    assert.deepEqual(plan.guests, []);
    assert.deepEqual(
      plan.rejected.map(user => user._id),
      ['u3'],
    );
    // home candidates are unaffected by the guest policy
    assert.deepEqual(plan.home, ['u1', 'u2', 'u4']);
  });

  it('honours allowedHomeRealms', () => {
    const policies = { guests: { allowed: true, allowedHomeRealms: [OTHER2] } };
    const plan = planPromoteMembers(users, REALM, policies);
    assert.deepEqual(
      plan.rejected.map(user => user._id),
      ['u3'],
    );
    const trusted = planPromoteMembers(users, REALM, {
      guests: { allowed: true, allowedHomeRealms: [OTHER] },
    });
    assert.deepEqual(trusted.guests, ['u3']);
  });

  it('plans each user once', () => {
    const plan = planPromoteMembers([users[0], users[0]], REALM, openGuests);
    assert.deepEqual(plan.home, ['u1']);
  });
});

describe('guestsNotAllowedError', () => {
  it('lists the users in the message and keeps the error code', () => {
    const error = guestsNotAllowedError(
      [{ _id: 'u3', email: 'c@x.io' }, { _id: 'u5', username: 'eve' }, { _id: 'u6' }],
      'promote',
    );
    assert.ok(error instanceof ModuleError);
    assert.equal(error.code, status.PERMISSION_DENIED);
    const body = JSON.parse(error.message);
    assert.equal(body.conduitCode, 'GUESTS_NOT_ALLOWED');
    assert.match(body.message, /u3 \(c@x\.io\), u5 \(eve\), u6/);
  });

  it('caps long lists', () => {
    const many = Array.from({ length: 25 }, (_, i) => ({ _id: `u${i}` }));
    assert.match(describeUsers(many), /and 5 more$/);
  });
});

describe('resolveSlugChange', () => {
  it('ignores a missing or unchanged slug', () => {
    assert.equal(resolveSlugChange('acme', undefined, false), undefined);
    assert.equal(resolveSlugChange('acme', 'acme', false), undefined);
    assert.equal(resolveSlugChange('acme', ' ACME ', false), undefined);
  });

  it('needs force for a real change', () => {
    assert.throws(() => resolveSlugChange('acme', 'other', undefined), isInvalidArgument);
    assert.throws(() => resolveSlugChange('acme', 'other', false), isInvalidArgument);
    assert.equal(resolveSlugChange('acme', 'Other', true), 'other');
  });

  it('rejects non-string slugs', () => {
    assert.throws(() => resolveSlugChange('acme', 5, true), isInvalidArgument);
  });
});

describe('sanitizeRealmInput', () => {
  it('passes valid input through and ignores slug, force and unknown keys', () => {
    const input = sanitizeRealmInput({
      slug: 'acme',
      force: true,
      teamId: REALM,
      bogus: 1,
      active: false,
      registration: { allowWithoutInvite: true },
      policies: {
        requireTwoFa: true,
        allowedClientIds: ['web'],
        guests: { allowed: false, allowedHomeRealms: [OTHER] },
      },
      strategies: { local: { enabled: false }, phone: { enabled: true, nope: 1 } },
    });
    assert.deepEqual(input, {
      active: false,
      registration: { allowWithoutInvite: true },
      policies: {
        requireTwoFa: true,
        allowedClientIds: ['web'],
        guests: { allowed: false, allowedHomeRealms: [OTHER] },
      },
      strategies: { local: { enabled: false }, phone: { enabled: true } },
    });
  });

  it('rejects wrong types', () => {
    for (const body of [
      { active: 'yes' },
      { active: null },
      { policies: { requireTwoFa: 1 } },
      { policies: { allowedClientIds: 'web' } },
      { policies: { guests: { allowedHomeRealms: ['acme'] } } },
      { strategies: { local: { enabled: null } } },
      { strategies: { oauth: { notAProvider: { enabled: true } } } },
      { strategies: { oauth: { google: { clientId: 5 } } } },
      { registration: [] },
      'text',
    ]) {
      assert.throws(
        () => sanitizeRealmInput(body),
        isInvalidArgument,
        JSON.stringify(body),
      );
    }
  });

  it('turns cleared secrets into empty strings and drops echoed read flags', () => {
    const input = sanitizeRealmInput({
      strategies: {
        oauth: {
          google: {
            enabled: true,
            clientSecret: null,
            hasClientSecret: true,
            clientId: null,
          },
          apple: { privateKey: null, teamId: null, keyId: 'K' },
          github: { privateKey: 'ignored', teamId: 'ignored' },
        },
      },
    });
    assert.deepEqual(input.strategies?.oauth, {
      google: { enabled: true, clientSecret: '', clientId: null },
      apple: { privateKey: '', teamId: null, keyId: 'K' },
      github: {},
    });
  });

  it('treats blank credentials like null', () => {
    const input = sanitizeRealmInput({
      strategies: { oauth: { google: { clientId: '  ', redirect_uri: '' } } },
    });
    assert.deepEqual(input.strategies?.oauth, {
      google: { clientId: null, redirect_uri: null },
    });
  });
});

describe('deepMergeClearing', () => {
  it('merges objects, replaces arrays and removes nulls', () => {
    const base = {
      a: { b: 1, c: [1, 2], d: { e: 1 } },
      keep: true,
    };
    const merged = deepMergeClearing(base, {
      a: { b: null, c: [3], d: { f: 2 } },
      added: { x: null, y: 1 },
    });
    assert.deepEqual(merged, {
      a: { c: [3], d: { e: 1, f: 2 } },
      keep: true,
      added: { y: 1 },
    });
    // inputs are not mutated
    assert.deepEqual(base, { a: { b: 1, c: [1, 2], d: { e: 1 } }, keep: true });
  });
});

describe('buildRealmSettingsWrite', () => {
  it('builds promote settings from the defaults', () => {
    const { settings, oauthSecrets } = buildRealmSettingsWrite({
      base: defaultRealmSettings(),
      input: {
        slug: 'acme',
        strategies: {
          username: { enabled: true },
          oauth: { google: { enabled: true, clientId: 'id', clientSecret: 's3cret' } },
        },
        policies: { guests: { allowed: false } },
      },
    });
    assert.equal(settings.active, true);
    assert.equal(settings.strategies.local.enabled, true);
    assert.equal(settings.strategies.username.enabled, true);
    assert.deepEqual(settings.strategies.oauth, {
      google: { enabled: true, clientId: 'id' },
    });
    assert.equal(settings.policies.guests.allowed, false);
    assert.deepEqual(settings.policies.guests.allowedHomeRealms, []);
    assert.deepEqual(oauthSecrets, { google: { clientSecret: 's3cret' } });
  });

  const stored = {
    ...defaultRealmSettings(),
    strategies: {
      ...defaultRealmSettings().strategies,
      oauth: {
        google: {
          enabled: true,
          clientId: 'own-id',
          redirect_uri: 'https://x/cb',
          accountLinking: false,
        },
        apple: { enabled: true, teamId: 'T', keyId: 'K' },
      },
    },
    policies: {
      ...defaultRealmSettings().policies,
      // SQL adapters read an empty primitive array back as ['']
      allowedClientIds: [''],
    },
  };
  const storedSecrets = {
    google: { clientSecret: 'old' },
    apple: { clientSecret: 'a', privateKey: 'p' },
  };

  it('null clears plain credentials and secrets, omitted fields keep their value', () => {
    const { settings, oauthSecrets } = buildRealmSettingsWrite({
      base: stored,
      baseSecrets: storedSecrets,
      input: {
        strategies: {
          oauth: {
            google: { clientId: null, clientSecret: null },
            apple: { privateKey: null, teamId: null, keyId: null },
          },
        },
      },
    });
    assert.deepEqual(settings.strategies.oauth.google, {
      enabled: true,
      redirect_uri: 'https://x/cb',
      accountLinking: false,
    });
    assert.deepEqual(settings.strategies.oauth.apple, { enabled: true });
    assert.deepEqual(oauthSecrets, { apple: { clientSecret: 'a' } });
  });

  it('null accountLinking and verificationRequired inherit the global setting', () => {
    const { settings } = buildRealmSettingsWrite({
      base: {
        ...stored,
        strategies: {
          ...stored.strategies,
          local: { enabled: true, verificationRequired: true },
        },
      },
      baseSecrets: storedSecrets,
      input: {
        strategies: {
          local: { verificationRequired: null },
          oauth: { google: { accountLinking: null } },
        },
      },
    });
    assert.deepEqual(settings.strategies.local, { enabled: true });
    assert.equal('accountLinking' in settings.strategies.oauth.google!, false);
  });

  it('replaces secrets, keeps untouched ones and never leaks them into settings', () => {
    const { settings, oauthSecrets } = buildRealmSettingsWrite({
      base: stored,
      baseSecrets: storedSecrets,
      input: { strategies: { oauth: { google: { clientSecret: 'new' } } } },
    });
    assert.deepEqual(oauthSecrets, {
      google: { clientSecret: 'new' },
      apple: { clientSecret: 'a', privateKey: 'p' },
    });
    assert.equal('clientSecret' in settings.strategies.oauth.google!, false);
  });

  it('arrays replace and SQL array shapes are normalized', () => {
    const untouched = buildRealmSettingsWrite({ base: stored, input: {} });
    assert.deepEqual(untouched.settings.policies.allowedClientIds, []);
    const { settings } = buildRealmSettingsWrite({
      base: stored,
      input: { policies: { allowedClientIds: ['web', 'ios'] } },
    });
    assert.deepEqual(settings.policies.allowedClientIds, ['web', 'ios']);
    const again = buildRealmSettingsWrite({
      base: { ...stored, policies: { ...stored.policies, allowedClientIds: ['a', 'b'] } },
      input: { policies: { allowedClientIds: ['c'] } },
    });
    assert.deepEqual(again.settings.policies.allowedClientIds, ['c']);
  });

  it('keeps unrelated stored values on a partial patch', () => {
    const { settings } = buildRealmSettingsWrite({
      base: stored,
      baseSecrets: storedSecrets,
      input: { active: false },
    });
    assert.equal(settings.active, false);
    assert.deepEqual(settings.strategies.oauth, stored.strategies.oauth);
    assert.equal(settings.policies.guests.allowed, true);
  });

  it('reads documents with Mongo extras', () => {
    const picked = pickSettingsFields({
      _id: 'x',
      team: REALM,
      createdAt: new Date(),
      ...stored,
    });
    assert.deepEqual(Object.keys(picked).sort(), [
      'active',
      'policies',
      'registration',
      'strategies',
    ]);
  });
});

describe('response builders', () => {
  it('toRealmDto masks secrets', () => {
    const dto = toRealmDto(
      { _id: REALM },
      {
        ...defaultRealmSettings(),
        strategies: {
          ...defaultRealmSettings().strategies,
          oauth: { google: { enabled: true, clientId: 'id' } },
        },
        oauthSecrets: { google: { clientSecret: 's3cret' } },
      },
      { home: 2, guest: 1 },
    );
    assert.deepEqual(dto.counts, { home: 2, guest: 1 });
    assert.equal('oauthSecrets' in dto.settings, false);
    assert.equal(dto.settings.strategies.oauth.google?.hasClientSecret, true);
    assert.equal(JSON.stringify(dto).includes('s3cret'), false);
  });

  it('toRealmMember adds role and membershipType', () => {
    assert.deepEqual(toRealmMember({ _id: 'u1' }, 'owner', 'guest'), {
      _id: 'u1',
      role: 'owner',
      membershipType: 'guest',
    });
    assert.deepEqual(toRealmMember({ _id: 'u1' }, undefined, undefined), { _id: 'u1' });
  });
});

describe('new OAuth provider entries', () => {
  it('default to disabled when the write does not say', () => {
    const { settings } = buildRealmSettingsWrite({
      base: defaultRealmSettings(),
      input: {
        strategies: {
          oauth: {
            google: { clientId: 'id', clientSecret: 's' },
            github: { enabled: true },
          },
        },
      },
    });
    assert.equal(settings.strategies.oauth.google?.enabled, false);
    assert.equal(settings.strategies.oauth.github?.enabled, true);
  });

  it('keep an existing enabled flag when only credentials are patched', () => {
    const base = {
      ...defaultRealmSettings(),
      strategies: {
        ...defaultRealmSettings().strategies,
        oauth: { google: { enabled: true, clientId: 'old' } },
      },
    };
    const { settings } = buildRealmSettingsWrite({
      base,
      baseSecrets: { google: { clientSecret: 'kept' } },
      input: { strategies: { oauth: { google: { clientId: 'new' } } } },
    });
    assert.equal(settings.strategies.oauth.google?.enabled, true);
    assert.equal(settings.strategies.oauth.google?.clientId, 'new');
  });
});

describe('DEMOTE_STEPS', () => {
  it('stops the realm from resolving before the realm sessions are swept', () => {
    const at = (step: (typeof DEMOTE_STEPS)[number]) => DEMOTE_STEPS.indexOf(step);
    assert.ok(at('deleteMemberships') < at('publish'));
    assert.ok(at('deleteSettings') < at('publish'));
    assert.ok(at('flipTeam') < at('publish'));
    assert.equal(at('sweepRealmTokens'), DEMOTE_STEPS.length - 1);
    assert.ok(at('blockHomeUsers') < at('flipTeam'));
  });
});

describe('planOldHomeMembership', () => {
  it('turns the old home membership into a guest one when the policy allows', () => {
    assert.equal(planOldHomeMembership(openGuests, OTHER), 'guest');
    assert.equal(planOldHomeMembership(openGuests, null), 'guest');
    assert.equal(
      planOldHomeMembership(
        { guests: { allowed: true, allowedHomeRealms: [OTHER] } },
        OTHER,
      ),
      'guest',
    );
  });

  it('strips the user from the old realm otherwise', () => {
    assert.equal(planOldHomeMembership(closedGuests, OTHER), 'revoke');
    assert.equal(
      planOldHomeMembership(
        { guests: { allowed: true, allowedHomeRealms: [OTHER] } },
        null,
      ),
      'revoke',
    );
    assert.equal(
      planOldHomeMembership(
        { guests: { allowed: true, allowedHomeRealms: [OTHER] } },
        OTHER2,
      ),
      'revoke',
    );
    assert.equal(planOldHomeMembership(undefined, OTHER), 'revoke');
  });
});

describe('OAuth credential pairing on write', () => {
  const withOauth = (oauth: Record<string, any>) => ({
    ...defaultRealmSettings(),
    strategies: { ...defaultRealmSettings().strategies, oauth },
  });
  const write = (params: Parameters<typeof buildRealmSettingsWrite>[0]) =>
    buildRealmSettingsWrite(params);

  it('rejects a clientId without a clientSecret and names the provider', () => {
    assert.throws(
      () =>
        write({
          base: defaultRealmSettings(),
          input: { strategies: { oauth: { github: { enabled: true, clientId: 'id' } } } },
        }),
      (err: any) =>
        err.code === status.INVALID_ARGUMENT &&
        /oauth\.github.*clientSecret/.test(err.message),
    );
  });

  it('counts the stored secret when the write omits it', () => {
    const base = withOauth({ google: { enabled: true } });
    const { oauthSecrets } = write({
      base,
      baseSecrets: { google: { clientSecret: 'stored' } },
      input: { strategies: { oauth: { google: { clientId: 'id' } } } },
    });
    assert.deepEqual(oauthSecrets, { google: { clientSecret: 'stored' } });
  });

  it('rejects clearing the secret while the clientId stays', () => {
    const base = withOauth({ google: { enabled: true, clientId: 'id' } });
    assert.throws(
      () =>
        write({
          base,
          baseSecrets: { google: { clientSecret: 'stored' } },
          input: { strategies: { oauth: { google: { clientSecret: null } } } },
        }),
      /oauth\.google.*clientId requires its own clientSecret/,
    );
  });

  it('rejects a supplied clientSecret without any clientId', () => {
    assert.throws(
      () =>
        write({
          base: defaultRealmSettings(),
          input: { strategies: { oauth: { google: { clientSecret: 'x' } } } },
        }),
      /oauth\.google.*clientSecret requires a clientId/,
    );
  });

  it('tolerates a stored secret left behind by clearing the clientId', () => {
    const base = withOauth({ google: { enabled: true, clientId: 'id' } });
    const { settings, oauthSecrets } = write({
      base,
      baseSecrets: { google: { clientSecret: 'stored' } },
      input: { strategies: { oauth: { google: { clientId: null } } } },
    });
    assert.equal('clientId' in settings.strategies.oauth.google!, false);
    assert.deepEqual(oauthSecrets, { google: { clientSecret: 'stored' } });
  });

  it('does not re-validate providers a write leaves alone', () => {
    // legacy mixed pair on google, the write only touches github
    const base = withOauth({ google: { enabled: true, clientId: 'id' } });
    assert.doesNotThrow(() =>
      write({
        base,
        input: { strategies: { oauth: { github: { enabled: false } } } },
      }),
    );
    assert.doesNotThrow(() => write({ base, input: { active: false } }));
  });

  it('skips a disabled provider whose credentials the write does not touch', () => {
    const base = withOauth({ google: { enabled: true, clientId: 'id' } });
    assert.doesNotThrow(() =>
      write({
        base,
        input: { strategies: { oauth: { google: { enabled: false } } } },
      }),
    );
    // enabling the incomplete pair is refused
    assert.throws(
      () =>
        write({
          base: withOauth({ google: { enabled: false, clientId: 'id' } }),
          input: { strategies: { oauth: { google: { enabled: true } } } },
        }),
      /oauth\.google/,
    );
  });

  it('accepts a complete pair', () => {
    const { oauthSecrets } = write({
      base: defaultRealmSettings(),
      input: {
        strategies: {
          oauth: { google: { enabled: true, clientId: 'id', clientSecret: 's' } },
        },
      },
    });
    assert.deepEqual(oauthSecrets, { google: { clientSecret: 's' } });
  });

  it('allows an incomplete pair for the GitOps import (secrets never travel)', () => {
    assert.doesNotThrow(() =>
      write({
        base: defaultRealmSettings(),
        allowIncompleteCredentials: true,
        input: { strategies: { oauth: { google: { enabled: true, clientId: 'id' } } } },
      }),
    );
  });

  it('does not apply the secret pairing to Apple, which signs from its key triple', () => {
    assert.doesNotThrow(() =>
      write({
        base: defaultRealmSettings(),
        input: { strategies: { oauth: { apple: { enabled: true, clientId: 'svc' } } } },
      }),
    );
  });
});

describe('Apple key triple on write', () => {
  const base = defaultRealmSettings();
  const apple = (entry: Record<string, any>) => ({
    base,
    input: { strategies: { oauth: { apple: { enabled: true, ...entry } } } },
  });

  it('rejects a partial triple', () => {
    for (const entry of [
      { teamId: 'T' },
      { keyId: 'K' },
      { privateKey: 'P' },
      { teamId: 'T', keyId: 'K' },
      { privateKey: 'P', teamId: 'T' },
    ]) {
      assert.throws(
        () => buildRealmSettingsWrite(apple(entry)),
        (err: any) =>
          err.code === status.INVALID_ARGUMENT &&
          /oauth\.apple.*together/.test(err.message),
      );
    }
  });

  it('accepts all three or none', () => {
    assert.doesNotThrow(() =>
      buildRealmSettingsWrite(apple({ privateKey: 'P', teamId: 'T', keyId: 'K' })),
    );
    assert.doesNotThrow(() => buildRealmSettingsWrite(apple({ clientId: 'svc' })));
  });

  it('counts the stored private key when the write only sends the ids', () => {
    const stored = {
      ...base,
      strategies: { ...base.strategies, oauth: { apple: { enabled: true } } },
    };
    const { oauthSecrets } = buildRealmSettingsWrite({
      base: stored,
      baseSecrets: { apple: { privateKey: 'P' } },
      input: { strategies: { oauth: { apple: { teamId: 'T', keyId: 'K' } } } },
    });
    assert.deepEqual(oauthSecrets, { apple: { privateKey: 'P' } });
    // clearing only the key leaves a partial triple
    assert.throws(
      () =>
        buildRealmSettingsWrite({
          base: {
            ...base,
            strategies: {
              ...base.strategies,
              oauth: { apple: { enabled: true, teamId: 'T', keyId: 'K' } },
            },
          },
          baseSecrets: { apple: { privateKey: 'P' } },
          input: { strategies: { oauth: { apple: { privateKey: null } } } },
        }),
      /oauth\.apple/,
    );
  });
});

describe('assertTeamPromotable', () => {
  it('refuses realms and the default team', () => {
    assert.doesNotThrow(() => assertTeamPromotable({ isDefault: false }));
    assert.throws(
      () => assertTeamPromotable({ realm: { enabled: true } }),
      (err: any) => err.code === status.ALREADY_EXISTS,
    );
    assert.throws(
      () => assertTeamPromotable({ isDefault: true }),
      (err: any) => err.code === status.FAILED_PRECONDITION,
    );
  });
});
