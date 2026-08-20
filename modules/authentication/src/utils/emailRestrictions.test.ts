import { describe, it } from 'node:test';
import assert from 'node:assert/strict';
import {
  evaluateEmailRestrictions,
  type DisposableEmailSets,
  type EmailRestrictionsConfig,
} from './emailRestrictions.js';

const emptyDisposableSets: DisposableEmailSets = {
  domains: new Set(),
  wildcards: new Set(),
};

function restrictions(
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

describe('evaluateEmailRestrictions', () => {
  it('allows any email when the master switch is off except reserved anonymous domains', () => {
    const result = evaluateEmailRestrictions(
      'user+tag@mailinator.com',
      restrictions({ enabled: false, blockedAddresses: ['user+tag@mailinator.com'] }),
      { domains: new Set(['mailinator.com']), wildcards: new Set() },
    );
    assert.deepEqual(result, { allowed: true });

    assert.deepEqual(
      evaluateEmailRestrictions(
        'attacker@anonymous.com',
        restrictions({ enabled: false }),
        emptyDisposableSets,
      ),
      { allowed: false, reason: 'reserved anonymous domain' },
    );
  });

  it('denies reserved anonymous.com even when allowlisted', () => {
    const result = evaluateEmailRestrictions(
      'attacker@anonymous.com',
      restrictions({ allowedAddresses: ['attacker@anonymous.com'] }),
      emptyDisposableSets,
    );
    assert.deepEqual(result, { allowed: false, reason: 'reserved anonymous domain' });
  });

  it('denies subdomains of anonymous.com', () => {
    const result = evaluateEmailRestrictions(
      'user@mail.anonymous.com',
      restrictions({ enabled: false }),
      emptyDisposableSets,
    );
    assert.deepEqual(result, { allowed: false, reason: 'reserved anonymous domain' });
  });

  it('denies plus addressing in the local part', () => {
    const result = evaluateEmailRestrictions(
      'user+tag@example.com',
      restrictions(),
      emptyDisposableSets,
    );
    assert.deepEqual(result, { allowed: false, reason: 'plus addressing' });
  });

  it('denies an exact blocked address', () => {
    const result = evaluateEmailRestrictions(
      'blocked@example.com',
      restrictions({
        blockPlusAddressing: false,
        blockedAddresses: ['blocked@example.com'],
      }),
      emptyDisposableSets,
    );
    assert.deepEqual(result, { allowed: false, reason: 'blocked address' });
  });

  it('denies blocked domains including subdomains but not a bare TLD', () => {
    const config = restrictions({
      blockPlusAddressing: false,
      blockedDomains: ['evil.com', 'com'],
    });
    assert.deepEqual(
      evaluateEmailRestrictions('user@mail.evil.com', config, emptyDisposableSets),
      { allowed: false, reason: 'blocked domain' },
    );
    assert.deepEqual(
      evaluateEmailRestrictions('user@evil.com', config, emptyDisposableSets),
      { allowed: false, reason: 'blocked domain' },
    );
    assert.deepEqual(
      evaluateEmailRestrictions('user@not-evil.com', config, emptyDisposableSets),
      { allowed: true },
    );
    assert.deepEqual(
      evaluateEmailRestrictions('user@gmail.com', config, emptyDisposableSets),
      { allowed: true },
    );
    assert.deepEqual(evaluateEmailRestrictions('user@com', config, emptyDisposableSets), {
      allowed: true,
    });
  });

  it('lets allowlists override later denials', () => {
    const addressOverride = evaluateEmailRestrictions(
      'user+tag@evil.com',
      restrictions({
        blockedDomains: ['evil.com'],
        allowedAddresses: ['user+tag@evil.com'],
      }),
      emptyDisposableSets,
    );
    assert.deepEqual(addressOverride, { allowed: true });

    const domainOverride = evaluateEmailRestrictions(
      'user@mail.trusted.com',
      restrictions({
        blockPlusAddressing: false,
        blockedDomains: ['trusted.com'],
        allowedDomains: ['trusted.com'],
      }),
      emptyDisposableSets,
    );
    assert.deepEqual(domainOverride, { allowed: true });
  });

  it('ignores non-string list entries', () => {
    const config = restrictions({
      blockPlusAddressing: false,
      blockedDomains: ['evil.com', null as unknown as string, 42 as unknown as string],
    });
    assert.deepEqual(
      evaluateEmailRestrictions('user@evil.com', config, emptyDisposableSets),
      { allowed: false, reason: 'blocked domain' },
    );
  });

  it('denies disposable domains and wildcard parents', () => {
    const disposableSets: DisposableEmailSets = {
      domains: new Set(['mailinator.com']),
      wildcards: new Set(['yopmail.com']),
    };
    assert.deepEqual(
      evaluateEmailRestrictions(
        'user@mailinator.com',
        restrictions({ blockPlusAddressing: false }),
        disposableSets,
      ),
      { allowed: false, reason: 'disposable domain' },
    );
    assert.deepEqual(
      evaluateEmailRestrictions(
        'user@sub.yopmail.com',
        restrictions({ blockPlusAddressing: false }),
        disposableSets,
      ),
      { allowed: false, reason: 'disposable domain' },
    );
  });
});
