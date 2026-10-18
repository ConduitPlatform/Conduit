import assert from 'node:assert/strict';
import { describe, it } from 'node:test';
import {
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
    // unknown realm ids are dropped, known ones become slugs
    assert.deepEqual((out.policies as any).guests, {
      allowed: true,
      allowedHomeRealmSlugs: ['other'],
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
