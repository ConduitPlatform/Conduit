import assert from 'node:assert/strict';
import { describe, it } from 'node:test';
import { GrpcError } from '@conduitplatform/grpc-sdk';
import { status } from '@grpc/grpc-js';
import { ModuleError } from '@conduitplatform/module-tools';
import { errors } from '../errors.js';
import {
  assertGrantMembershipAllowed,
  buildSetRealmParams,
  parseMembershipType,
  parseOptionalMembershipType,
  parseSettingsJson,
  realmSlugOf,
  stripRealmSecrets,
  toCallbackError,
  toGrpcTeam,
  toRealmResponse,
} from './realmGrpc.logic.js';

const TEAM_ID = '0123456789abcdef01234567';

describe('realm gRPC helpers', () => {
  it('exposes the realm marker on the Team message', () => {
    const team = {
      _id: TEAM_ID,
      name: 'Acme',
      isDefault: false,
      realm: { enabled: true, slug: 'acme' },
    };
    assert.deepEqual(toGrpcTeam(team), {
      id: TEAM_ID,
      name: 'Acme',
      parentTeam: undefined,
      isDefault: false,
      realmEnabled: true,
      realmSlug: 'acme',
    });
    const plain = toGrpcTeam({ _id: TEAM_ID, name: 'x', isDefault: true });
    assert.equal(plain.realmEnabled, false);
    assert.equal(plain.realmSlug, undefined);
  });

  it('ignores the slug of a demoted team', () => {
    assert.equal(realmSlugOf({ realm: { enabled: false, slug: 'old' } }), undefined);
  });

  it('keeps the code of GrpcErrors', () => {
    assert.deepEqual(toCallbackError(new GrpcError(status.NOT_FOUND, 'nope')), {
      code: status.NOT_FOUND,
      message: 'nope',
    });
    assert.equal(toCallbackError(new Error('boom')).code, status.INTERNAL);
  });

  it('validates the membership type', () => {
    assert.equal(parseMembershipType('home'), 'home');
    assert.equal(parseMembershipType('guest'), 'guest');
    assert.throws(() => parseMembershipType('owner'), /home' or 'guest/);
  });

  it('parses settingsJson and only keeps settings keys', () => {
    assert.deepEqual(parseSettingsJson(undefined), {});
    assert.deepEqual(parseSettingsJson(''), {});
    assert.deepEqual(
      parseSettingsJson(JSON.stringify({ active: false, slug: 'x', force: true })),
      { active: false },
    );
    assert.throws(() => parseSettingsJson('{'), /valid JSON/);
    assert.throws(() => parseSettingsJson('[]'), /JSON object/);
  });

  it('builds the write params, request fields win', () => {
    const params = buildSetRealmParams({
      teamId: TEAM_ID,
      slug: 'acme',
      settingsJson: JSON.stringify({ policies: { requireTwoFa: true } }),
      force: false,
    });
    assert.deepEqual(params, {
      policies: { requireTwoFa: true },
      teamId: TEAM_ID,
      slug: 'acme',
      force: false,
    });
    assert.throws(
      () => buildSetRealmParams({ teamId: 'nope', slug: 'acme' }),
      /valid Team ID/,
    );
    assert.throws(() => buildSetRealmParams({ teamId: TEAM_ID, slug: ' ' }), /slug/);
  });

  it('never lets secrets into the response', () => {
    const dto = {
      team: {
        _id: TEAM_ID,
        name: 'Acme',
        isDefault: false,
        realm: { enabled: true, slug: 'acme' },
      },
      settings: {
        active: true,
        oauthSecrets: { google: { clientSecret: 's' } },
        strategies: {
          oauth: { google: { enabled: true, clientSecret: 's', hasClientSecret: true } },
        },
      },
      counts: { home: 2, guest: 1 },
    };
    const response = toRealmResponse(dto);
    assert.equal(response.homeCount, 2);
    assert.equal(response.guestCount, 1);
    assert.equal(response.team.realmSlug, 'acme');
    assert.ok(!response.settingsJson.includes('"s"'));
    assert.ok(!response.settingsJson.includes('oauthSecrets'));
    assert.equal(
      JSON.parse(response.settingsJson).strategies.oauth.google.hasClientSecret,
      true,
    );
    assert.deepEqual(stripRealmSecrets([{ privateKey: 'k', a: 1 }]), [{ a: 1 }]);
  });
});

describe('stripRealmSecrets on nested structures', () => {
  it('removes secrets at any depth, including arrays of arrays and objects', () => {
    const input = {
      settings: {
        strategies: {
          oauth: {
            google: {
              clientId: 'id',
              clientSecret: 'LEAK',
              nested: [[{ privateKey: 'LEAK' }]],
            },
          },
        },
        list: [
          { oauthSecrets: { google: { clientSecret: 'LEAK' } }, keep: 1 },
          [{ a: 1 }],
        ],
      },
    };
    const out = stripRealmSecrets(input);
    assert.ok(!JSON.stringify(out).includes('LEAK'));
    assert.deepEqual(out.settings.strategies.oauth.google.nested, [[{}]]);
    assert.deepEqual(out.settings.list, [{ keep: 1 }, [{ a: 1 }]]);
    // the input is not mutated
    assert.ok(JSON.stringify(input).includes('LEAK'));
  });

  it('keeps the has* flags and scalars', () => {
    assert.deepEqual(
      stripRealmSecrets({ hasClientSecret: true, n: 3, s: 'x', z: null }),
      {
        hasClientSecret: true,
        n: 3,
        s: 'x',
        z: null,
      },
    );
  });
});

describe('toCallbackError with a ModuleError', () => {
  it('keeps the gRPC code and the JSON message with the conduitCode', () => {
    const error = toCallbackError(new ModuleError(errors.REALM_NOT_FOUND));
    assert.equal(error.code, errors.REALM_NOT_FOUND.grpcCode);
    assert.equal(
      (JSON.parse(error.message) as { conduitCode: string }).conduitCode,
      errors.REALM_NOT_FOUND.conduitCode,
    );
  });
});

describe('assertGrantMembershipAllowed', () => {
  const REALM = 'aaaaaaaaaaaaaaaaaaaaaaaa';
  const OTHER = 'bbbbbbbbbbbbbbbbbbbbbbbb';
  const failedPrecondition = (e: unknown) =>
    e instanceof GrpcError && e.code === status.FAILED_PRECONDITION;

  it('refuses a guest membership for a home user of the realm', () => {
    assert.throws(
      () =>
        assertGrantMembershipAllowed({
          type: 'guest',
          realmTeamId: REALM,
          userHomeRealm: REALM,
        }),
      failedPrecondition,
    );
  });

  it('allows guests homed elsewhere or global', () => {
    for (const userHomeRealm of [OTHER, null, undefined]) {
      assert.doesNotThrow(() =>
        assertGrantMembershipAllowed({
          type: 'guest',
          realmTeamId: REALM,
          userHomeRealm,
        }),
      );
    }
  });

  it('refuses a home move over a different home realm unless forced', () => {
    assert.throws(
      () =>
        assertGrantMembershipAllowed({
          type: 'home',
          realmTeamId: REALM,
          userHomeRealm: OTHER,
        }),
      failedPrecondition,
    );
    assert.doesNotThrow(() =>
      assertGrantMembershipAllowed({
        type: 'home',
        realmTeamId: REALM,
        userHomeRealm: OTHER,
        force: true,
      }),
    );
  });

  it('allows a home membership for global users and the current home realm', () => {
    for (const userHomeRealm of [null, undefined, REALM]) {
      assert.doesNotThrow(() =>
        assertGrantMembershipAllowed({ type: 'home', realmTeamId: REALM, userHomeRealm }),
      );
    }
  });
});

describe('parseOptionalMembershipType', () => {
  it('accepts nothing, home and guest and rejects anything else', () => {
    assert.equal(parseOptionalMembershipType(''), undefined);
    assert.equal(parseOptionalMembershipType(undefined), undefined);
    assert.equal(parseOptionalMembershipType('guest'), 'guest');
    assert.throws(() => parseOptionalMembershipType('owner'), /home/);
  });
});
