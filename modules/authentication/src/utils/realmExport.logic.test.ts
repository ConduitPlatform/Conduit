import assert from 'node:assert/strict';
import { describe, it } from 'node:test';
import {
  applyTrustedHomeRealms,
  decideTrustedHomeRealms,
  ImportTally,
  realmsDisabledSkipMessage,
  topLevelTeamQuery,
  UNRESOLVED_REALM_PREFIX,
  buildImportedSettings,
  buildSlugById,
  exportRealmSettings,
  exportTeamRealm,
  parseImportedRealm,
  resolveAllowedHomeRealms,
} from './realmExport.logic.js';

const OTHER_ID = 'aaaaaaaaaaaaaaaaaaaaaaaa';

const stored = {
  _id: 'x',
  team: 'y',
  createdAt: new Date(),
  updatedAt: new Date(),
  active: true,
  strategies: {
    local: { enabled: true },
    username: { enabled: false },
    magicLink: { enabled: false },
    phone: { enabled: false },
    metamask: { enabled: false },
    biometric: { enabled: false },
    oauth: {
      google: { enabled: true, clientId: 'cid', redirect_uri: 'https://x/cb' },
      apple: { enabled: true, teamId: 'T', keyId: 'K' },
    },
  },
  registration: { allowWithoutInvite: true },
  policies: {
    requireTwoFa: false,
    requireVerifiedEmail: true,
    allowedClientIds: ['c1'],
    guests: { allowed: true, allowedHomeRealms: [OTHER_ID, 'bbbbbbbbbbbbbbbbbbbbbbbb'] },
  },
  oauthSecrets: { google: { clientSecret: 'TOPSECRET' }, apple: { privateKey: 'PK' } },
};

describe('realm export', () => {
  it('exports the team marker', () => {
    assert.deepEqual(exportTeamRealm({ realm: { enabled: true, slug: 'acme' } }), {
      enabled: true,
      slug: 'acme',
    });
    assert.deepEqual(exportTeamRealm({ realm: { enabled: false, slug: 'old' } }), {
      enabled: false,
    });
    assert.deepEqual(exportTeamRealm({}), { enabled: false });
  });

  it('exports masked settings with null secrets and no ids or timestamps', () => {
    const slugById = buildSlugById([
      { _id: OTHER_ID, realm: { enabled: true, slug: 'other' } },
    ]);
    const out = exportRealmSettings(stored, slugById);
    const json = JSON.stringify(out);
    assert.ok(!json.includes('TOPSECRET'));
    assert.ok(!json.includes('PK'));
    assert.ok(!json.includes('oauthSecrets'));
    assert.ok(!json.includes('hasClientSecret'));
    for (const key of ['_id', 'team', 'createdAt', 'updatedAt']) {
      assert.equal(key in out, false);
    }
    const oauth = (out.strategies as any).oauth;
    assert.deepEqual(oauth.google, {
      enabled: true,
      clientId: 'cid',
      redirect_uri: 'https://x/cb',
      clientSecret: null,
    });
    assert.deepEqual(oauth.apple, {
      enabled: true,
      teamId: 'T',
      keyId: 'K',
      clientSecret: null,
      privateKey: null,
    });
    // known realm ids become slugs, unknown ones are kept as unresolved markers so the
    // import fails closed instead of widening the list
    assert.deepEqual((out.policies as any).guests, {
      allowed: true,
      allowedHomeRealmSlugs: [
        'other',
        `${UNRESOLVED_REALM_PREFIX}bbbbbbbbbbbbbbbbbbbbbbbb`,
      ],
    });
    assert.deepEqual((out.policies as any).allowedClientIds, ['c1']);
  });
});

describe('realm import', () => {
  it('treats records without an enabled realm as plain teams', () => {
    assert.deepEqual(parseImportedRealm({ name: 'a' }), { enabled: false });
    assert.deepEqual(parseImportedRealm({ realm: { enabled: false } }), {
      enabled: false,
    });
    assert.throws(() => parseImportedRealm({ realm: 'x' }), /object/);
  });

  it('validates the slug', () => {
    assert.throws(() => parseImportedRealm({ realm: { enabled: true } }), /slug/);
    assert.throws(
      () => parseImportedRealm({ realm: { enabled: true, slug: 'Bad Slug!' } }),
      /slug/,
    );
    const parsed = parseImportedRealm({ realm: { enabled: true, slug: ' Acme ' } });
    assert.equal(parsed.enabled && parsed.slug, 'acme');
  });

  it('never imports secrets, flags or team ids', () => {
    const parsed = parseImportedRealm({
      realm: { enabled: true, slug: 'acme' },
      realmSettings: {
        strategies: {
          oauth: {
            google: {
              enabled: true,
              clientId: 'c',
              clientSecret: 'LEAK',
              hasClientSecret: true,
            },
            apple: { enabled: true, privateKey: 'LEAK2', clientSecret: null },
          },
        },
        policies: {
          guests: {
            allowed: false,
            allowedHomeRealms: [OTHER_ID],
            allowedHomeRealmSlugs: ['other', 'other'],
          },
        },
      },
    });
    assert.ok(parsed.enabled);
    if (!parsed.enabled) return;
    const json = JSON.stringify(parsed.input);
    assert.ok(!json.includes('LEAK'));
    assert.ok(!json.includes('hasClientSecret'));
    assert.ok(!json.includes(OTHER_ID));
    assert.deepEqual(parsed.allowedHomeRealmSlugs, ['other']);
    assert.deepEqual(parsed.input.policies.guests, { allowed: false });
  });

  it('builds settings from defaults, keeping stored secrets of remaining providers', () => {
    const parsed = parseImportedRealm({
      realm: { enabled: true, slug: 'acme' },
      realmSettings: {
        strategies: {
          local: { enabled: false },
          oauth: { google: { enabled: true, clientId: 'c', clientSecret: null } },
        },
      },
    });
    assert.ok(parsed.enabled);
    if (!parsed.enabled) return;
    const { settings, oauthSecrets } = buildImportedSettings({
      input: parsed.input,
      existingSecrets: {
        google: { clientSecret: 'kept' },
        github: { clientSecret: 'dropped' },
      },
    });
    assert.equal(settings.strategies.local.enabled, false);
    assert.equal(settings.strategies.username.enabled, false);
    assert.deepEqual(settings.policies.guests, { allowed: true, allowedHomeRealms: [] });
    assert.deepEqual(oauthSecrets, { google: { clientSecret: 'kept' } });
    assert.ok(!JSON.stringify(settings).includes('kept'));
  });

  it('rejects unknown providers', () => {
    const parsed = parseImportedRealm({
      realm: { enabled: true, slug: 'acme' },
      realmSettings: { strategies: { oauth: { nope: { enabled: true } } } },
    });
    assert.ok(parsed.enabled);
    if (!parsed.enabled) return;
    assert.throws(() => buildImportedSettings({ input: parsed.input }), /provider/);
  });

  it('resolves trusted home realm slugs', () => {
    const result = resolveAllowedHomeRealms(['a', 'b'], new Map([['a', 'id-a']]));
    assert.deepEqual(result, { ids: ['id-a'], missing: ['b'] });
  });
});

describe('unresolved trusted home realms', () => {
  it('parses unresolved markers apart from slugs instead of throwing', () => {
    const parsed = parseImportedRealm({
      realm: { enabled: true, slug: 'acme' },
      realmSettings: {
        policies: {
          guests: { allowedHomeRealmSlugs: ['other', 'unresolved:abc123'] },
        },
      },
    });
    assert.ok(parsed.enabled);
    if (!parsed.enabled) return;
    assert.deepEqual(parsed.allowedHomeRealmSlugs, ['other']);
    assert.deepEqual(parsed.unresolvedHomeRealms, ['unresolved:abc123']);
  });

  it('a marker alone still means the file restricts the list', () => {
    const parsed = parseImportedRealm({
      realm: { enabled: true, slug: 'acme' },
      realmSettings: {
        policies: { guests: { allowedHomeRealmSlugs: ['unresolved:x'] } },
      },
    });
    assert.ok(parsed.enabled);
    if (!parsed.enabled) return;
    assert.deepEqual(parsed.allowedHomeRealmSlugs, []);
    assert.deepEqual(parsed.unresolvedHomeRealms, ['unresolved:x']);
  });

  it('still rejects a malformed slug', () => {
    assert.throws(() =>
      parseImportedRealm({
        realm: { enabled: true, slug: 'acme' },
        realmSettings: { policies: { guests: { allowedHomeRealmSlugs: ['Bad Slug!'] } } },
      }),
    );
  });
});

describe('decideTrustedHomeRealms', () => {
  const idBySlug = new Map([
    ['a', 'id-a'],
    ['b', 'id-b'],
  ]);

  it('leaves the settings alone when the file says nothing', () => {
    assert.equal(
      decideTrustedHomeRealms({ slugs: undefined, idBySlug, storedIds: ['x'] }),
      null,
    );
  });

  it('stores the resolved ids when everything resolves', () => {
    assert.deepEqual(
      decideTrustedHomeRealms({ slugs: ['a', 'b'], idBySlug, storedIds: null }),
      { allowedHomeRealms: ['id-a', 'id-b'], disallowGuests: false, missing: [] },
    );
    assert.deepEqual(decideTrustedHomeRealms({ slugs: [], idBySlug, storedIds: ['x'] }), {
      allowedHomeRealms: [],
      disallowGuests: false,
      missing: [],
    });
  });

  it('keeps the stored list of an existing realm when a slug is unresolved', () => {
    assert.deepEqual(
      decideTrustedHomeRealms({
        slugs: ['a', 'zzz'],
        idBySlug,
        storedIds: ['old-1', ''],
      }),
      { allowedHomeRealms: ['old-1'], disallowGuests: false, missing: ['zzz'] },
    );
    // an existing realm with an empty stored list stays "any home realm"
    assert.deepEqual(
      decideTrustedHomeRealms({ slugs: ['zzz'], idBySlug, storedIds: [] }),
      { allowedHomeRealms: [], disallowGuests: false, missing: ['zzz'] },
    );
  });

  it('disables guests of a new realm when a slug is unresolved', () => {
    assert.deepEqual(
      decideTrustedHomeRealms({ slugs: ['a', 'zzz'], idBySlug, storedIds: null }),
      { allowedHomeRealms: ['id-a'], disallowGuests: true, missing: ['zzz'] },
    );
  });

  it('treats an unresolved marker like a missing slug', () => {
    assert.deepEqual(
      decideTrustedHomeRealms({
        slugs: ['a'],
        unresolved: ['unresolved:gone'],
        idBySlug,
        storedIds: null,
      }),
      { allowedHomeRealms: ['id-a'], disallowGuests: true, missing: ['unresolved:gone'] },
    );
  });

  it('applies the decision to the settings without mutating them', () => {
    const settings = {
      policies: {
        guests: { allowed: true, allowedHomeRealms: [] as string[] },
        other: 1,
      },
    };
    const closed = applyTrustedHomeRealms(settings, {
      allowedHomeRealms: ['id-a'],
      disallowGuests: true,
      missing: ['zzz'],
    });
    assert.deepEqual(closed.policies.guests, {
      allowed: false,
      allowedHomeRealms: ['id-a'],
    });
    assert.equal((closed.policies as any).other, 1);
    assert.deepEqual(settings.policies.guests, { allowed: true, allowedHomeRealms: [] });
    assert.equal(applyTrustedHomeRealms(settings, null), settings);
    const kept = applyTrustedHomeRealms(settings, {
      allowedHomeRealms: ['k'],
      disallowGuests: false,
      missing: [],
    });
    assert.equal(kept.policies.guests.allowed, true);
  });
});

describe('export -> import round trip', () => {
  const idOf = new Map([
    ['other', OTHER_ID],
    ['acme', 'cccccccccccccccccccccccc'],
  ]);

  const roundTrip = (settings: Record<string, any>, slugById: Map<string, string>) => {
    const exported = exportRealmSettings(settings, slugById);
    const parsed = parseImportedRealm({
      realm: { enabled: true, slug: 'acme' },
      realmSettings: exported,
    });
    assert.ok(parsed.enabled);
    if (!parsed.enabled) throw new Error('unreachable');
    const decision = decideTrustedHomeRealms({
      slugs: parsed.allowedHomeRealmSlugs,
      unresolved: parsed.unresolvedHomeRealms,
      idBySlug: idOf,
      storedIds: normalize(settings.policies.guests.allowedHomeRealms),
    });
    const built = buildImportedSettings({
      input: parsed.input,
      existingSecrets: settings.oauthSecrets,
    });
    return {
      exported,
      decision,
      settings: applyTrustedHomeRealms(built.settings, decision),
      oauthSecrets: built.oauthSecrets,
    };
  };
  const normalize = (ids: string[]) => ids.filter(Boolean);

  it('re-importing an export reproduces the settings and keeps stored secrets', () => {
    const once = roundTrip(
      {
        ...stored,
        policies: {
          ...stored.policies,
          guests: { allowed: true, allowedHomeRealms: [OTHER_ID] },
        },
      },
      buildSlugById([{ _id: OTHER_ID, realm: { enabled: true, slug: 'other' } }]),
    );
    assert.deepEqual(once.settings.policies.guests, {
      allowed: true,
      allowedHomeRealms: [OTHER_ID],
    });
    assert.equal(once.settings.registration.allowWithoutInvite, true);
    assert.equal(once.settings.policies.requireVerifiedEmail, true);
    assert.deepEqual(once.settings.policies.allowedClientIds, ['c1']);
    assert.deepEqual(once.oauthSecrets, stored.oauthSecrets);
    assert.equal(JSON.stringify(once.settings).includes('TOPSECRET'), false);

    // the settings that come out export to the same file again (idempotent)
    const again = exportRealmSettings(
      { ...once.settings, oauthSecrets: once.oauthSecrets },
      buildSlugById([{ _id: OTHER_ID, realm: { enabled: true, slug: 'other' } }]),
    );
    assert.deepEqual(again, once.exported);
  });

  it('an id that did not resolve at export fails closed on import', () => {
    const once = roundTrip(stored, buildSlugById([]));
    // nothing resolved: the existing realm keeps its stored list
    assert.equal(once.decision?.missing.length, 2);
    assert.deepEqual(once.decision?.allowedHomeRealms, [
      OTHER_ID,
      'bbbbbbbbbbbbbbbbbbbbbbbb',
    ]);
  });
});

describe('topLevelTeamQuery', () => {
  it('matches a null or missing parent by name', () => {
    assert.deepEqual(topLevelTeamQuery('Acme'), {
      name: 'Acme',
      $or: [{ parentTeam: null }, { parentTeam: { $exists: false } }],
    });
  });
});

describe('ImportTally', () => {
  const fresh = () => ({ created: 0, updated: 0, failed: 0, errors: [] as string[] });

  it('counts each record once', () => {
    const result = fresh();
    const tally = new ImportTally(result);
    tally.created(0);
    tally.updated(1);
    tally.updated(2);
    assert.deepEqual([result.created, result.updated, result.failed], [1, 2, 0]);
  });

  it('moves a record that fails later from created/updated to failed', () => {
    const result = fresh();
    const tally = new ImportTally(result);
    tally.created(0);
    tally.updated(1);
    tally.failed(0, 'a: realm: nested');
    tally.failed(1, 'b: parent: nested');
    assert.deepEqual([result.created, result.updated, result.failed], [0, 0, 2]);
    assert.deepEqual(result.errors, ['a: realm: nested', 'b: parent: nested']);
  });

  it('does not double count a record that fails twice, but keeps both errors', () => {
    const result = fresh();
    const tally = new ImportTally(result);
    tally.updated(0);
    tally.failed(0, 'first');
    tally.failed(0, 'second');
    assert.equal(result.failed, 1);
    assert.equal(result.updated, 0);
    assert.deepEqual(result.errors, ['first', 'second']);
    assert.equal(tally.outcome(0), 'failed');
  });

  it('reports a skipped realm part without changing the record outcome', () => {
    const result = fresh();
    const tally = new ImportTally(result);
    tally.created(0);
    tally.updated(1);
    tally.skipped(realmsDisabledSkipMessage('acme'));
    assert.deepEqual([result.created, result.updated, result.failed], [1, 1, 0]);
    assert.equal(result.errors.length, 1);
    assert.match(result.errors[0], /^acme: realm: skipped, realms are disabled/);
    assert.match(result.errors[0], /REALMS_DISABLED/);
    assert.equal(tally.outcome(0), 'created');
  });

  it('counts a record that failed outright once', () => {
    const result = fresh();
    const tally = new ImportTally(result);
    tally.failed(3, 'Missing name');
    assert.deepEqual([result.created, result.updated, result.failed], [0, 0, 1]);
  });
});
