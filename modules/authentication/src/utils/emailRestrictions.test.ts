import assert from 'node:assert/strict';
import { describe, it } from 'node:test';
import {
  evaluateEmailRestrictions,
  type DisposableEmailSets,
  type EmailRestrictionsConfig,
} from './emailRestrictions.js';

function config(
  overrides: Partial<EmailRestrictionsConfig> = {},
): EmailRestrictionsConfig {
  return {
    enabled: true,
    blockDisposableEmails: true,
    blockPlusAddressing: true,
    blockedAddresses: [],
    blockedDomains: [],
    allowedAddresses: [],
    allowedDomains: [],
    ...overrides,
  };
}

const disposable: DisposableEmailSets = {
  domains: new Set(['mailinator.com']),
  wildcards: new Set(['anonaddy.com']),
};

describe('evaluateEmailRestrictions', () => {
  it('allows all addresses when the master switch is off except reserved anonymous domains', () => {
    const result = evaluateEmailRestrictions(
      'user+tag@mailinator.com',
      config({ enabled: false }),
      disposable,
    );
    assert.deepEqual(result, { allowed: true });

    assert.deepEqual(
      evaluateEmailRestrictions('attacker@anonymous.com', config({ enabled: false }), disposable),
      { allowed: false, reason: 'reserved anonymous domain' },
    );
  });

  it('denies reserved anonymous.com even when allowlisted', () => {
    const result = evaluateEmailRestrictions(
      'attacker@anonymous.com',
      config({ allowedAddresses: ['attacker@anonymous.com'] }),
      disposable,
    );
    assert.deepEqual(result, { allowed: false, reason: 'reserved anonymous domain' });
  });

  it('denies subdomains of anonymous.com', () => {
    const result = evaluateEmailRestrictions(
      'user@mail.anonymous.com',
      config({ enabled: false }),
      disposable,
    );
    assert.deepEqual(result, { allowed: false, reason: 'reserved anonymous domain' });
  });

  it('denies plus addressing in the local part', () => {
    const result = evaluateEmailRestrictions(
      'user+tag@example.com',
      config(),
      disposable,
    );
    assert.deepEqual(result, { allowed: false, reason: 'plus addressing' });
  });

  it('denies an exact blocked address', () => {
    const result = evaluateEmailRestrictions(
      'blocked@example.com',
      config({
        blockPlusAddressing: false,
        blockedAddresses: ['blocked@example.com'],
      }),
      disposable,
    );
    assert.deepEqual(result, { allowed: false, reason: 'blocked address' });
  });

  it('denies suffix domain matches without treating a bare TLD as a suffix', () => {
    const blocked = config({
      blockPlusAddressing: false,
      blockedDomains: ['evil.com', 'com'],
    });
    assert.deepEqual(
      evaluateEmailRestrictions('user@mail.evil.com', blocked, disposable),
      { allowed: false, reason: 'blocked domain' },
    );
    assert.deepEqual(
      evaluateEmailRestrictions('user@evil.com', blocked, disposable),
      { allowed: false, reason: 'blocked domain' },
    );
    assert.deepEqual(
      evaluateEmailRestrictions('user@notevil.com', blocked, disposable),
      { allowed: true },
    );
    assert.deepEqual(
      evaluateEmailRestrictions('user@example.com', blocked, disposable),
      { allowed: true },
    );
    assert.deepEqual(
      evaluateEmailRestrictions('user@com', blocked, disposable),
      { allowed: true },
    );
  });

  it('allows allowlisted addresses and domains to override other rules', () => {
    const restricted = config({
      blockedDomains: ['example.com'],
      allowedAddresses: ['vip+tag@blocked.com'],
      allowedDomains: ['trusted.example.com'],
    });
    assert.deepEqual(
      evaluateEmailRestrictions('vip+tag@blocked.com', restricted, disposable),
      { allowed: true },
    );
    assert.deepEqual(
      evaluateEmailRestrictions('user@mail.trusted.example.com', restricted, disposable),
      { allowed: true },
    );
    assert.deepEqual(
      evaluateEmailRestrictions('user@example.com', restricted, disposable),
      { allowed: false, reason: 'blocked domain' },
    );
  });

  it('ignores non-string list entries', () => {
    const blocked = config({
      blockPlusAddressing: false,
      blockedDomains: ['evil.com', null as unknown as string, 42 as unknown as string],
    });
    assert.deepEqual(
      evaluateEmailRestrictions('user@evil.com', blocked, disposable),
      { allowed: false, reason: 'blocked domain' },
    );
  });

  it('denies disposable domains and wildcard parents', () => {
    assert.deepEqual(
      evaluateEmailRestrictions(
        'user@mailinator.com',
        config({ blockPlusAddressing: false }),
        disposable,
      ),
      { allowed: false, reason: 'disposable domain' },
    );
    assert.deepEqual(
      evaluateEmailRestrictions(
        'user@mail.anonaddy.com',
        config({ blockPlusAddressing: false }),
        disposable,
      ),
      { allowed: false, reason: 'disposable domain' },
    );
    assert.deepEqual(
      evaluateEmailRestrictions(
        'user@example.com',
        config({ blockPlusAddressing: false }),
        disposable,
      ),
      { allowed: true },
    );
  });
});
