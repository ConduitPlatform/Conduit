import { describe, it } from 'node:test';
import assert from 'node:assert/strict';
import { buildEffectiveSettings, defaultRealmSettings } from '../utils/realm.logic.js';
import {
  buildRealmDiscovery,
  buildUserRealms,
  summarizePolicies,
  toRealmRef,
} from './realm.logic.js';

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
