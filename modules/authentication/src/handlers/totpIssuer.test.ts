import { describe, it } from 'node:test';
import assert from 'node:assert/strict';
import convict from 'convict';
import { generateSecret } from '@conduitplatform/node-2fa';
import { GrpcError } from '@conduitplatform/grpc-sdk';
import { status } from '@grpc/grpc-js';
import authConfig from '../config/config.js';
import {
  DEFAULT_TOTP_ISSUER,
  TOTP_ISSUER_MAX_LENGTH,
  resolveTotpIssuer,
  sanitizeTotpIssuer,
  totpIssuerConfigError,
} from './totpIssuer.js';

const notAllowed = (err: unknown) =>
  err instanceof GrpcError &&
  err.code === status.INVALID_ARGUMENT &&
  err.message === 'Issuer is not allowed';

describe('twoFa issuer config', () => {
  it('defaults the issuer to Conduit and the allowlist to empty', () => {
    assert.equal(DEFAULT_TOTP_ISSUER, 'Conduit');
    const loaded = convict(authConfig);
    loaded.validate({ allowed: 'warn' });
    const properties = loaded.getProperties();
    assert.equal(properties.twoFa.issuer, 'Conduit');
    assert.deepEqual(properties.twoFa.allowedIssuers, []);
    assert.equal(resolveTotpIssuer(properties.twoFa), 'Conduit');
    assert.equal(totpIssuerConfigError(properties.twoFa), null);
  });

  it('accepts an issuer and allowlist through the config schema', () => {
    const loaded = convict(authConfig);
    loaded.load({
      twoFa: {
        issuer: 'Acme',
        allowedIssuers: ['Acme', 'Acme Mobile'],
      },
    });
    loaded.validate({ allowed: 'warn' });
    const properties = loaded.getProperties();
    assert.equal(properties.twoFa.issuer, 'Acme');
    assert.deepEqual(properties.twoFa.allowedIssuers, ['Acme', 'Acme Mobile']);
    assert.equal(resolveTotpIssuer(properties.twoFa), 'Acme');
    assert.equal(totpIssuerConfigError(properties.twoFa), null);
  });

  it('rejects empty, non-string and over-long issuers', () => {
    const long = 'A'.repeat(TOTP_ISSUER_MAX_LENGTH + 1);
    assert.match(totpIssuerConfigError({ issuer: ' :\u200b ' }) ?? '', /twoFa\.issuer/);
    assert.match(totpIssuerConfigError({ issuer: long }) ?? '', /at most 64/);
    assert.match(
      totpIssuerConfigError({ allowedIssuers: ['Acme', ''] }) ?? '',
      /allowedIssuers\[1\] must not be empty/,
    );
    assert.match(
      totpIssuerConfigError({ allowedIssuers: [123] }) ?? '',
      /allowedIssuers\[0\] must be a string/,
    );
    assert.match(
      totpIssuerConfigError({ allowedIssuers: [long] }) ?? '',
      /allowedIssuers\[0\] must be at most 64/,
    );
    assert.match(
      totpIssuerConfigError({ allowedIssuers: 'Acme' }) ?? '',
      /must be a list/,
    );
    assert.equal(
      totpIssuerConfigError({ allowedIssuers: ['👨‍👩‍👧'.repeat(TOTP_ISSUER_MAX_LENGTH)] }),
      null,
    );
  });
});

describe('resolveTotpIssuer', () => {
  it('uses the default issuer when none is configured', () => {
    assert.equal(resolveTotpIssuer({}), 'Conduit');
    assert.equal(resolveTotpIssuer({ issuer: '   ' }), 'Conduit');
    assert.equal(resolveTotpIssuer({ issuer: ':::\n' }), 'Conduit');
  });

  it('uses the configured issuer when the client sends none', () => {
    assert.equal(resolveTotpIssuer({ issuer: 'Acme', allowedIssuers: [] }), 'Acme');
    assert.equal(
      resolveTotpIssuer({ issuer: 'Acme', allowedIssuers: ['X'] }, ''),
      'Acme',
    );
  });

  it('uses an allowlisted client issuer', () => {
    assert.equal(
      resolveTotpIssuer(
        { issuer: 'Conduit', allowedIssuers: ['Acme Mobile'] },
        'Acme Mobile',
      ),
      'Acme Mobile',
    );
    assert.equal(
      resolveTotpIssuer({ issuer: 'Conduit', allowedIssuers: ['Acme'] }, ' Acme\u200b '),
      'Acme',
    );
  });

  it('rejects a client issuer that is not allowlisted', () => {
    assert.throws(
      () =>
        resolveTotpIssuer({ issuer: 'Acme', allowedIssuers: ['Acme Mobile'] }, 'Other'),
      notAllowed,
    );
    assert.throws(
      () => resolveTotpIssuer({ issuer: 'Acme', allowedIssuers: [] }, 'Acme'),
      notAllowed,
    );
    assert.throws(() => resolveTotpIssuer({ issuer: 'Acme' }, 'Acme'), notAllowed);
    assert.throws(
      () => resolveTotpIssuer({ allowedIssuers: ['Acme'] }, 'acme'),
      notAllowed,
    );
    assert.throws(
      () => resolveTotpIssuer({ allowedIssuers: ['Acme'] }, ':\n'),
      notAllowed,
    );
    const longest = 'A'.repeat(TOTP_ISSUER_MAX_LENGTH);
    assert.equal(resolveTotpIssuer({ allowedIssuers: [longest] }, longest), longest);
    assert.throws(
      () => resolveTotpIssuer({ allowedIssuers: [longest] }, `${longest}B`),
      notAllowed,
    );
  });
});

describe('sanitizeTotpIssuer', () => {
  it('strips the label separator and control characters', () => {
    assert.equal(sanitizeTotpIssuer('  Acme:Corp\n'), 'AcmeCorp');
    assert.equal(sanitizeTotpIssuer('\u0000\u0007\u007f\u0085Acme'), 'Acme');
    assert.equal(sanitizeTotpIssuer('  Acme: Corp\t'), 'Acme Corp');
  });

  it('strips bidi and zero-width characters', () => {
    assert.equal(sanitizeTotpIssuer('\u202eemcA\u202c'), 'emcA');
    assert.equal(sanitizeTotpIssuer('Ac\u200bme\u2066\ufeff\u{e0041}'), 'Acme');
  });

  it('keeps the joiners used by emoji sequences and scripts', () => {
    assert.equal(sanitizeTotpIssuer('Team 👨‍👩‍👧'), 'Team 👨‍👩‍👧');
    assert.equal(sanitizeTotpIssuer('می\u200cخواهم'), 'می\u200cخواهم');
  });

  it('keeps non-ASCII letters', () => {
    assert.equal(sanitizeTotpIssuer('Ünïcødé Ελληνικά 日本'), 'Ünïcødé Ελληνικά 日本');
  });

  it('truncates to 64 characters without splitting a grapheme', () => {
    assert.equal(sanitizeTotpIssuer('A'.repeat(80)), 'A'.repeat(TOTP_ISSUER_MAX_LENGTH));
    const emoji = sanitizeTotpIssuer('A'.repeat(63) + '😀😀');
    assert.equal(emoji, 'A'.repeat(63) + '😀');
    const flag = sanitizeTotpIssuer('A'.repeat(63) + '🇬🇷' + 'B');
    assert.equal(flag, 'A'.repeat(63) + '🇬🇷');
    const accent = sanitizeTotpIssuer('A'.repeat(63) + 'e\u0301' + 'B');
    assert.equal(accent, 'A'.repeat(63) + 'e\u0301');
    for (const value of [emoji, flag, accent]) {
      assert.doesNotThrow(() => encodeURIComponent(value));
    }
  });
});

describe('otpauth URI', () => {
  it('url-encodes a sanitized non-ASCII issuer', async () => {
    const issuer = resolveTotpIssuer({ issuer: '  Acme: Corp/R&D Ελλάδα 😀\n' });
    assert.equal(issuer, 'Acme Corp/R&D Ελλάδα 😀');
    const encoded = encodeURIComponent(issuer);
    const { uri } = await generateSecret({ name: issuer, account: 'user@example.com' });
    assert.ok(uri.startsWith(`otpauth://totp/${encoded}`), uri);
    assert.ok(uri.includes(`&issuer=${encoded}`), uri);
  });
});
